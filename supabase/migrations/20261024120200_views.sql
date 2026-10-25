-- Shapers platform: read models for the dashboards.
-- Every view runs with the caller's rights (security_invoker) and only returns
-- members the caller may see: themselves, their buddy mentees, or everyone for
-- admins and Core members (the Team section).

create function public.can_see_member(p_member uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select p_member = public.current_member_id()
      or public.can_view_team()
      or exists (select 1 from members where id = p_member and buddy_id = public.current_member_id())
$$;

-- ---------------------------------------------------------------- hours per week

create view public.week_hours with (security_invoker = true) as
with weeks as (
  select m.id as member_id, gs::date as week_start
  from public.members m,
       generate_series(public.week_start(greatest(m.joined_on,
                         (select tracking_since from public.app_settings)))::timestamp,
                       public.week_start(public.app_today())::timestamp,
                       interval '1 week') gs
  where m.active and public.can_see_member(m.id)
),
-- Finished sessions only (a block that ran out counts to its end). The running
-- session is added live by the client, so it isn't counted twice.
logged as (
  select member_id, public.local_week_start(started_at) as week_start,
         extract(epoch from (coalesce(ended_at, planned_end) - started_at)) / 3600.0 as hours
  from public.work_sessions
  where status = 'approved' and (ended_at is not null or planned_end <= now())
  union all
  select member_id, week_start, hours from public.imported_week_hours
),
summed as (
  select w.member_id, w.week_start, coalesce(sum(l.hours), 0) as hours
  from weeks w
  left join logged l on l.member_id = w.member_id and l.week_start = w.week_start
  group by w.member_id, w.week_start
)
select s.member_id,
       s.week_start,
       round(s.hours::numeric, 2) as hours,
       t.weekly_hours as target,
       exists (select 1 from public.pauses p
               where p.member_id = s.member_id and p.status = 'approved'
                 and p.starts_on <= s.week_start + 6 and p.ends_on >= s.week_start) as paused,
       s.week_start = public.week_start(public.app_today()) as is_current,
       s.hours >= t.weekly_hours as met
from summed s
join public.members m on m.id = s.member_id
join public.tiers t on t.key = m.tier;

-- Consecutive weeks on target, newest first. Paused weeks are skipped (they never
-- break a streak); the current week only counts once it is met.
create view public.hour_streaks with (security_invoker = true) as
with relevant as (
  select member_id, week_start, met
  from public.week_hours
  where not paused and not (is_current and not met)
),
marked as (
  select member_id, week_start, met,
         sum(case when met then 0 else 1 end)
           over (partition by member_id order by week_start desc rows unbounded preceding) as misses_so_far
  from relevant
),
islands as (
  select member_id, week_start, met,
         row_number() over (partition by member_id order by week_start)
           - row_number() over (partition by member_id, met order by week_start) as grp
  from relevant
)
select m.id as member_id,
       coalesce((select count(*) from marked k where k.member_id = m.id and k.misses_so_far = 0), 0)::int as current_streak,
       coalesce((select max(c) from (select count(*) as c from islands i
                                     where i.member_id = m.id and i.met group by i.grp) x), 0)::int as best_streak
from public.members m
where m.active and public.can_see_member(m.id);

-- ---------------------------------------------------------------- meetings and attendance

-- One row per expected member per meeting, with the recorded state.
create view public.member_meetings with (security_invoker = true) as
select mt.id as meeting_id,
       mt.series_id,
       s.name as series_name,
       mt.title,
       mt.starts_at,
       mt.ends_at,
       mt.location,
       m.id as member_id,
       a.state,
       a.source,
       a.recorded_at,
       an.id is not null as absence_notified,
       case
         when a.state is not null then a.state::text
         when mt.starts_at > now() then 'upcoming'
         when mt.ends_at > now() then 'in_progress'
         else 'unrecorded'
       end as status
from public.meetings mt
join public.series s on s.id = mt.series_id
join public.members m
  on m.active
 and (s.everyone or exists (select 1 from public.series_members sm
                            where sm.series_id = s.id and sm.member_id = m.id))
left join public.attendance a on a.meeting_id = mt.id and a.member_id = m.id
left join public.absence_notices an on an.meeting_id = mt.id and an.member_id = m.id
where public.can_see_member(m.id);

create view public.attendance_summary with (security_invoker = true) as
select member_id,
       series_id,
       count(*) filter (where status = 'present')    as present,
       count(*) filter (where status = 'remote')     as remote,
       count(*) filter (where status = 'excused')    as excused,
       count(*) filter (where status = 'unexcused')  as unexcused,
       count(*) filter (where status = 'unrecorded') as unrecorded,
       count(*) filter (where status in ('present', 'remote', 'excused', 'unexcused')) as recorded,
       round(100.0 * count(*) filter (where status in ('present', 'remote'))
             / nullif(count(*) filter (where status in ('present', 'remote', 'excused', 'unexcused')), 0), 1) as attendance_rate
from public.member_meetings
where starts_at <= now()
group by grouping sets ((member_id, series_id), (member_id));

-- Meetings attended in a row. Excused absences neither count nor break the streak.
create view public.meeting_streaks with (security_invoker = true) as
with past as (
  select member_id, starts_at, status
  from public.member_meetings
  where starts_at <= now() and status in ('present', 'remote', 'unexcused')
),
marked as (
  select member_id,
         sum(case when status = 'unexcused' then 1 else 0 end)
           over (partition by member_id order by starts_at desc rows unbounded preceding) as misses_so_far
  from past
)
select m.id as member_id,
       coalesce((select count(*) from marked k where k.member_id = m.id and k.misses_so_far = 0), 0)::int as current_streak
from public.members m
where m.active and public.can_see_member(m.id);

-- ---------------------------------------------------------------- tasks

create view public.task_stats with (security_invoker = true) as
select m.id as member_id,
       count(t.id) filter (where t.status <> 'done')                                    as open_tasks,
       count(t.id) filter (where t.status <> 'done' and t.due_on < public.app_today())  as overdue_tasks,
       count(t.id) filter (where t.status = 'done')                                     as done_total,
       count(t.id) filter (where t.completed_at >= now() - interval '7 days')           as done_7d,
       count(t.id) filter (where t.completed_at >= now() - interval '30 days')          as done_30d,
       max(t.completed_at)                                                              as last_done_at
from public.members m
left join public.tasks t on t.assignee_id = m.id
where m.active
group by m.id;

-- ---------------------------------------------------------------- onboarding

create view public.onboarding_progress with (security_invoker = true) as
select m.id as member_id,
       st.key as step_key,
       st.title,
       st.description,
       st.stage,
       st.admin_only,
       st.auto,
       st.sort,
       mo.member_id is not null or case st.key
         when 'project'       then exists (select 1 from public.tasks t where t.assignee_id = m.id and t.kind = 'task')
         when 'first-hour'    then exists (select 1 from public.work_sessions ws where ws.member_id = m.id)
                                or exists (select 1 from public.imported_week_hours ih where ih.member_id = m.id and ih.hours > 0)
         when 'first-meeting' then exists (select 1 from public.attendance a where a.member_id = m.id and a.state in ('present', 'remote'))
         when 'first-task'    then exists (select 1 from public.tasks t where t.assignee_id = m.id and t.status = 'done')
         else false
       end as done,
       mo.completed_at
from public.members m
cross join public.onboarding_steps st
left join public.member_onboarding mo on mo.member_id = m.id and mo.step_key = st.key
where m.active and public.can_see_member(m.id);

-- ---------------------------------------------------------------- per-member overview (home screen + admin table)

create view public.member_overview with (security_invoker = true) as
with this_week as (
  select * from public.week_hours where is_current
),
recent_att as (
  select member_id,
         count(*) filter (where status in ('present', 'remote'))   as attended,
         count(*) filter (where status = 'unexcused')              as unexcused,
         count(*) filter (where status in ('present', 'remote', 'excused', 'unexcused')) as recorded
  from public.member_meetings
  where starts_at <= now() and starts_at > now() - interval '6 weeks'
  group by member_id
),
onb as (
  select member_id, count(*) filter (where done) as done, count(*) as total,
         max(completed_at) as last_progress_at
  from public.onboarding_progress group by member_id
),
last_seen as (
  select member_id, max(at) as at from (
    select member_id, started_at as at from public.work_sessions
    union all select member_id, recorded_at from public.attendance where source = 'self'
    union all select actor_id, at from public.task_events where actor_id is not null
  ) x group by member_id
)
select m.id as member_id,
       m.name,
       m.email,
       m.tier,
       t.name as tier_name,
       m.is_admin,
       m.buddy_id,
       b.name as buddy_name,
       m.joined_on,
       m.tier_since,
       -- this week
       coalesce(w.hours, 0) as week_hours,
       t.weekly_hours as week_target,
       coalesce(w.paused, false) as paused,
       greatest(t.weekly_hours - coalesce(w.hours, 0), 0) as hours_remaining,
       round(t.weekly_hours * least(extract(isodow from public.app_today()), 7) / 7.0, 1) as expected_by_now,
       not coalesce(w.paused, false)
         and coalesce(w.hours, 0) < round(t.weekly_hours * least(extract(isodow from public.app_today()), 7) / 7.0, 1) as behind,
       -- streaks
       coalesce(hs.current_streak, 0) as hour_streak,
       coalesce(hs.best_streak, 0) as best_hour_streak,
       coalesce(ms.current_streak, 0) as meeting_streak,
       -- attendance, last 6 weeks
       coalesce(ra.attended, 0) as attended_6w,
       coalesce(ra.unexcused, 0) as unexcused_6w,
       round(100.0 * ra.attended / nullif(ra.recorded, 0), 1) as attendance_rate_6w,
       -- tasks
       coalesce(ts.open_tasks, 0) as open_tasks,
       coalesce(ts.overdue_tasks, 0) as overdue_tasks,
       coalesce(ts.done_7d, 0) as tasks_done_7d,
       coalesce(ts.done_30d, 0) as tasks_done_30d,
       ts.last_done_at,
       -- onboarding and tier path
       coalesce(o.done, 0) as onboarding_done,
       coalesce(o.total, 0) as onboarding_total,
       coalesce(o.done, 0) = coalesce(o.total, 0) as onboarding_complete,
       m.onboarding_active,
       m.needs_setup,
       m.graduation_proposed_by,
       m.graduation_proposed_at,
       -- days without onboarding progress, once that reaches stall_days (nudges the buddy)
       case when m.onboarding_active and m.graduation_proposed_by is null
                 and coalesce(o.done, 0) < coalesce(o.total, 0)
                 and public.app_today() - coalesce((o.last_progress_at at time zone 'Europe/Ljubljana')::date, m.joined_on)
                     >= (select stall_days from public.app_settings)
            then public.app_today() - coalesce((o.last_progress_at at time zone 'Europe/Ljubljana')::date, m.joined_on)
       end as stalled_days,
       t.next_tier,
       nt.name as next_tier_name,
       case when t.months_before_review is not null
            then (m.tier_since + make_interval(months => t.months_before_review))::date end as review_on,
       (extract(year from age(public.app_today(), m.tier_since)) * 12
        + extract(month from age(public.app_today(), m.tier_since)))::int as months_in_tier,
       ls.at as last_active_at
from public.members m
join public.tiers t on t.key = m.tier
left join public.tiers nt on nt.key = t.next_tier
left join public.members b on b.id = m.buddy_id
left join this_week w on w.member_id = m.id
left join public.hour_streaks hs on hs.member_id = m.id
left join public.meeting_streaks ms on ms.member_id = m.id
left join recent_att ra on ra.member_id = m.id
left join public.task_stats ts on ts.member_id = m.id
left join onb o on o.member_id = m.id
left join last_seen ls on ls.member_id = m.id
where m.active and public.can_see_member(m.id);

-- ---------------------------------------------------------------- performance score (Team leaderboard)

-- Points of finished tasks (S/M/L = 1/3/8) + 5 per full weekly commitment met,
-- hours judged against each member's own tier, over the last six completed weeks.
create view public.member_scores with (security_invoker = true) as
with win as (
  select public.week_start(public.app_today()) - 42 as from_week
),
task_pts as (
  select t.assignee_id as member_id,
         count(*) as tasks_done,
         sum(case t.size when 'S' then 1 when 'L' then 8 else 3 end) as task_points
  from public.tasks t, win
  where t.status = 'done' and t.completed_at is not null
    and (t.completed_at at time zone 'Europe/Ljubljana')::date >= win.from_week
  group by t.assignee_id
),
week_pts as (
  select w.member_id,
         count(*) filter (where w.met) as weeks_met,
         count(*) as weeks_counted
  from public.week_hours w, win
  where not w.is_current and not w.paused and w.week_start >= win.from_week
  group by w.member_id
)
select m.id as member_id,
       coalesce(tp.task_points, 0) + 5 * coalesce(wp.weeks_met, 0) as total,
       coalesce(tp.task_points, 0) as task_points,
       5 * coalesce(wp.weeks_met, 0) as hours_points,
       coalesce(tp.tasks_done, 0) as tasks_done,
       coalesce(wp.weeks_met, 0) as weeks_met,
       coalesce(wp.weeks_counted, 0) as weeks_counted
from public.members m
left join task_pts tp on tp.member_id = m.id
left join week_pts wp on wp.member_id = m.id
where m.active and public.can_see_member(m.id);

-- ---------------------------------------------------------------- organisation trends (admin analytics)

create view public.org_weekly with (security_invoker = true) as
with hrs as (
  select week_start,
         sum(hours) as total_hours,
         count(*) filter (where not paused) as members_counted,
         count(*) filter (where met and not paused) as members_on_target
  from public.week_hours group by week_start
),
att as (
  select public.local_week_start(starts_at) as week_start,
         count(*) filter (where status in ('present', 'remote')) as attended,
         count(*) filter (where status in ('present', 'remote', 'excused', 'unexcused')) as recorded,
         count(distinct meeting_id) as meetings
  from public.member_meetings where starts_at <= now()
  group by 1
),
tsk as (
  select public.local_week_start(completed_at) as week_start, count(*) as tasks_done
  from public.tasks where completed_at is not null and public.can_view_team()
  group by 1
)
select h.week_start,
       round(h.total_hours, 1) as total_hours,
       h.members_counted,
       h.members_on_target,
       round(100.0 * h.members_on_target / nullif(h.members_counted, 0), 1) as pct_on_target,
       coalesce(a.meetings, 0) as meetings,
       round(100.0 * a.attended / nullif(a.recorded, 0), 1) as attendance_rate,
       coalesce(t.tasks_done, 0) as tasks_done
from hrs h
left join att a using (week_start)
left join tsk t using (week_start)
where public.can_view_team()
order by h.week_start;

create view public.tier_weekly with (security_invoker = true) as
select w.week_start,
       m.tier,
       round(sum(w.hours), 1) as total_hours,
       round(avg(w.hours), 1) as avg_hours,
       count(*) filter (where w.met and not w.paused) as members_on_target,
       count(*) filter (where not w.paused) as members_counted
from public.week_hours w
join public.members m on m.id = w.member_id
where public.can_view_team()
group by w.week_start, m.tier
order by w.week_start, m.tier;
