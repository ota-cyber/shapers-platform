-- Shapers platform: helpers, triggers and RPCs (the frontend's write API).
-- RPCs are security definer and check the caller themselves; tables keep RLS on.

-- ---------------------------------------------------------------- helpers

create function public.app_today() returns date
language sql stable as $$ select (now() at time zone 'Europe/Ljubljana')::date $$;

create function public.week_start(d date) returns date
language sql immutable as $$ select (d - (extract(isodow from d)::int - 1)) $$;

create function public.local_week_start(ts timestamptz) returns date
language sql stable as $$ select public.week_start((ts at time zone 'Europe/Ljubljana')::date) $$;

create function public.current_member_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from members where user_id = auth.uid() and active
$$;

create function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from members where user_id = auth.uid() and active), false)
$$;

-- Tier and admin are separate (docs/PERMISSIONS.md). Core members get full task
-- rights and see the Team section; only the admin role opens admin actions.
create function public.is_core() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select tier = 'core' from members where user_id = auth.uid() and active), false)
$$;

create function public.can_manage_tasks() returns boolean
language sql stable as $$ select public.is_admin() or public.is_core() $$;

create function public.can_view_team() returns boolean
language sql stable as $$ select public.is_admin() or public.is_core() $$;

create function public.is_project_member(p_project uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from project_members
                 where project_id = p_project and member_id = public.current_member_id())
$$;

create function public.require_member() returns uuid
language plpgsql stable security definer set search_path = public as $$
declare me uuid := public.current_member_id();
begin
  if me is null then
    raise exception 'Not signed in as a Shapers member' using errcode = '42501';
  end if;
  return me;
end $$;

create function public.require_admin() returns uuid
language plpgsql stable security definer set search_path = public as $$
declare me uuid := public.require_member();
begin
  if not public.is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  return me;
end $$;

-- Members expected at a meeting: everyone for Community, else the series roster.
create function public.expected_members(p_meeting uuid) returns setof uuid
language sql stable security definer set search_path = public as $$
  select m.id
  from meetings mt
  join series s on s.id = mt.series_id
  join members m on m.active
  where mt.id = p_meeting
    and (s.everyone or exists (select 1 from series_members sm
                               where sm.series_id = s.id and sm.member_id = m.id))
$$;

-- ---------------------------------------------------------------- auth link

create function public.link_auth_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update members set user_id = new.id
  where email = new.email::citext and user_id is null;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.link_auth_user();

create function public.members_before_write() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.user_id is null then
    select id into new.user_id from auth.users where email::citext = new.email;
  end if;
  if tg_op = 'UPDATE' and new.tier is distinct from old.tier
     and new.tier_since is not distinct from old.tier_since then
    new.tier_since := public.app_today();
  end if;
  return new;
end $$;

create trigger members_before_write
  before insert or update on public.members
  for each row execute function public.members_before_write();

-- ---------------------------------------------------------------- tasks: completion, history, membership

create function public.tasks_before_write() returns trigger
language plpgsql as $$
declare me uuid := public.current_member_id();
begin
  -- GO! and Impact members (not admin) work only on tasks assigned to them and
  -- never change owner, project or size. Rules and service jobs (me is null) are exempt.
  if me is not null and not public.can_manage_tasks() and new.kind = 'task' then
    if tg_op = 'INSERT' then
      if new.assignee_id is distinct from me then
        raise exception 'You can only create tasks for yourself' using errcode = '42501';
      end if;
      new.size := 'M';
    elsif old.assignee_id is distinct from me then
      raise exception 'You can only change tasks assigned to you' using errcode = '42501';
    elsif new.assignee_id is distinct from old.assignee_id
       or new.project_id is distinct from old.project_id
       or new.size is distinct from old.size then
      raise exception 'Only Core members and admins can reassign, move or resize tasks' using errcode = '42501';
    end if;
  end if;

  new.updated_at := now();
  if tg_op = 'INSERT' then
    new.created_by := coalesce(new.created_by, public.current_member_id());
    if new.status = 'done' then
      new.completed_at := coalesce(new.completed_at, now());
    else
      new.completed_at := null;
    end if;
  elsif new.status = 'done' and old.status <> 'done' then
    new.completed_at := now();
  elsif new.status <> 'done' then
    new.completed_at := null;
  end if;
  return new;
end $$;

create trigger tasks_before_write
  before insert or update on public.tasks
  for each row execute function public.tasks_before_write();

create function public.tasks_after_write() returns trigger
language plpgsql security definer set search_path = public as $$
declare actor uuid := coalesce(public.current_member_id(), new.created_by);
begin
  -- Whoever holds a task is on its project.
  if new.assignee_id is not null then
    insert into project_members (project_id, member_id)
    values (new.project_id, new.assignee_id)
    on conflict do nothing;
  end if;

  if tg_op = 'INSERT' then
    insert into task_events (task_id, actor_id, kind, to_value, at)
    values (new.id, actor, 'created', new.status::text, new.created_at);
    return new;
  end if;

  actor := public.current_member_id();
  if new.status is distinct from old.status then
    insert into task_events (task_id, actor_id, kind, from_value, to_value)
    values (new.id, actor, 'status', old.status::text, new.status::text);
  end if;
  if new.assignee_id is distinct from old.assignee_id then
    insert into task_events (task_id, actor_id, kind, from_value, to_value)
    values (new.id, actor, 'assignee', old.assignee_id::text, new.assignee_id::text);
  end if;
  if new.priority is distinct from old.priority then
    insert into task_events (task_id, actor_id, kind, from_value, to_value)
    values (new.id, actor, 'priority', old.priority::text, new.priority::text);
  end if;
  if new.due_on is distinct from old.due_on then
    insert into task_events (task_id, actor_id, kind, from_value, to_value)
    values (new.id, actor, 'due', old.due_on::text, new.due_on::text);
  end if;
  if new.starts_on is distinct from old.starts_on then
    insert into task_events (task_id, actor_id, kind, from_value, to_value)
    values (new.id, actor, 'start', old.starts_on::text, new.starts_on::text);
  end if;
  if new.size is distinct from old.size then
    insert into task_events (task_id, actor_id, kind, from_value, to_value)
    values (new.id, actor, 'size', old.size, new.size);
  end if;
  if new.notes is distinct from old.notes then
    insert into task_events (task_id, actor_id, kind)
    values (new.id, actor, 'notes');
  end if;
  if new.project_id is distinct from old.project_id then
    insert into task_events (task_id, actor_id, kind, from_value, to_value)
    values (new.id, actor, 'project', old.project_id::text, new.project_id::text);
  end if;
  if new.title is distinct from old.title then
    insert into task_events (task_id, actor_id, kind, from_value, to_value)
    values (new.id, actor, 'title', old.title, new.title);
  end if;
  return new;
end $$;

create trigger tasks_after_write
  after insert or update on public.tasks
  for each row execute function public.tasks_after_write();

-- ---------------------------------------------------------------- attendance: GO! consequence task

-- Tier rule: each Community meeting a GO! member misses means one general task
-- within 14 days, plus reading the minutes. Imported history doesn't create tasks.
create function public.attendance_consequence() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  mt meetings;
  m  members;
begin
  if new.source = 'import' or new.state not in ('excused', 'unexcused') then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.state in ('excused', 'unexcused') then
    return new;
  end if;
  select * into mt from meetings where id = new.meeting_id;
  select * into m  from members  where id = new.member_id;
  if mt.series_id <> 'community' or m.tier <> 'go' then
    return new;
  end if;
  if exists (select 1 from tasks where kind = 'consequence'
             and source_meeting_id = mt.id and assignee_id = m.id) then
    return new;
  end if;
  insert into tasks (project_id, title, notes, priority, size, starts_on, due_on, assignee_id, kind, source_meeting_id)
  select p.id,
         'Read the Community minutes (' || to_char(mt.starts_at at time zone 'Europe/Ljubljana', 'YYYY-MM-DD') || ')',
         'Missed Community meeting (' || new.state || '): read the minutes and pick up one general task within 14 days.',
         'normal', 'S',
         (mt.starts_at at time zone 'Europe/Ljubljana')::date,
         (mt.starts_at at time zone 'Europe/Ljubljana')::date + 14,
         m.id, 'consequence', mt.id
  from projects p where p.is_general;
  return new;
end $$;

create trigger attendance_consequence
  after insert or update of state on public.attendance
  for each row execute function public.attendance_consequence();

-- ---------------------------------------------------------------- RPC: hours

-- Closes my timer sessions whose 1-hour block ran out without an extension.
create function public.close_expired_sessions(p_member uuid) returns void
language sql security definer set search_path = public as $$
  update work_sessions set ended_at = planned_end
  where member_id = p_member and source = 'timer'
    and ended_at is null and planned_end < now()
$$;

-- Current running session, or null.
create function public.current_session() returns public.work_sessions
language plpgsql security definer set search_path = public as $$
declare me uuid := public.require_member(); s work_sessions;
begin
  perform public.close_expired_sessions(me);
  select * into s from work_sessions
  where member_id = me and source = 'timer' and ended_at is null;
  return s;
end $$;

-- Starts a 1-hour block. Idempotent: a second tap returns the running session.
create function public.clock_in(p_task_id uuid default null) returns public.work_sessions
language plpgsql security definer set search_path = public as $$
declare me uuid := public.require_member(); s work_sessions;
begin
  s := public.current_session();
  if s.id is not null then
    return s;
  end if;
  begin
    insert into work_sessions (member_id, started_at, planned_end, source, task_id)
    values (me, now(), now() + interval '1 hour', 'timer', p_task_id)
    returning * into s;
  exception when unique_violation then
    select * into s from work_sessions
    where member_id = me and source = 'timer' and ended_at is null;
  end;
  return s;
end $$;

-- "Still working?" -> yes. Adds another hour; allowed up to 15 min after the block ends.
create function public.extend_session() returns public.work_sessions
language plpgsql security definer set search_path = public as $$
declare me uuid := public.require_member(); s work_sessions;
begin
  update work_sessions
     set planned_end = planned_end + interval '1 hour'
   where member_id = me and source = 'timer' and ended_at is null
     and now() <= planned_end + interval '15 minutes'
  returning * into s;
  if s.id is null then
    raise exception 'No running session to extend' using errcode = 'P0002';
  end if;
  return s;
end $$;

create function public.clock_out() returns public.work_sessions
language plpgsql security definer set search_path = public as $$
declare me uuid := public.require_member(); s work_sessions;
begin
  perform public.close_expired_sessions(me);
  update work_sessions
     set ended_at = least(now(), planned_end)
   where member_id = me and source = 'timer' and ended_at is null
  returning * into s;
  return s;
end $$;

-- Manual entry. Today or up to backfill_days back is approved at once; older goes to an admin.
create function public.log_hours(p_date date, p_hours numeric, p_note text default null, p_task_id uuid default null)
returns public.work_sessions
language plpgsql security definer set search_path = public as $$
declare
  me uuid := public.require_member();
  start_at timestamptz;
  s work_sessions;
  backfill int := (select backfill_days from app_settings);
begin
  if p_hours is null or p_hours <= 0 or p_hours > 16 then
    raise exception 'Hours must be between 0 and 16' using errcode = '22023';
  end if;
  if p_date > public.app_today() then
    raise exception 'You cannot log hours in the future' using errcode = '22023';
  end if;
  start_at := (p_date + time '09:00') at time zone 'Europe/Ljubljana';
  insert into work_sessions (member_id, started_at, planned_end, ended_at, source, status, note, task_id)
  values (me, start_at,
          start_at + make_interval(mins => round(p_hours * 60)::int),
          start_at + make_interval(mins => round(p_hours * 60)::int),
          'manual',
          case when p_date >= public.app_today() - backfill then 'approved' else 'pending' end::review_status,
          p_note, p_task_id)
  returning * into s;
  return s;
end $$;

create function public.review_session(p_session uuid, p_approve boolean) returns public.work_sessions
language plpgsql security definer set search_path = public as $$
declare me uuid := public.require_admin(); s work_sessions;
begin
  update work_sessions
     set status = case when p_approve then 'approved' else 'rejected' end::review_status,
         reviewed_by = me, reviewed_at = now()
   where id = p_session
  returning * into s;
  return s;
end $$;

create function public.delete_my_session(p_session uuid) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := public.require_member();
begin
  delete from work_sessions where id = p_session and member_id = me;
end $$;

-- ---------------------------------------------------------------- RPC: pauses

create function public.request_pause(p_starts date, p_ends date, p_reason text default null)
returns public.pauses
language plpgsql security definer set search_path = public as $$
declare me uuid := public.require_member(); p pauses;
begin
  insert into pauses (member_id, starts_on, ends_on, reason)
  values (me, p_starts, p_ends, p_reason)
  returning * into p;
  return p;
end $$;

create function public.review_pause(p_pause uuid, p_approve boolean) returns public.pauses
language plpgsql security definer set search_path = public as $$
declare me uuid := public.require_admin(); p pauses;
begin
  update pauses
     set status = case when p_approve then 'approved' else 'rejected' end::review_status,
         reviewed_by = me
   where id = p_pause
  returning * into p;
  return p;
end $$;

-- ---------------------------------------------------------------- RPC: meetings

-- Member check-in at the start of a meeting.
create function public.check_in_meeting(p_meeting uuid, p_remote boolean default false)
returns public.attendance
language plpgsql security definer set search_path = public as $$
declare
  me uuid := public.require_member();
  mt meetings;
  cfg app_settings;
  a attendance;
begin
  select * into mt from meetings where id = p_meeting;
  if mt.id is null then
    raise exception 'Meeting not found' using errcode = 'P0002';
  end if;
  select * into cfg from app_settings;
  if not cfg.check_in_any_time and (
       now() < mt.starts_at - make_interval(mins => cfg.check_in_opens_minutes)
    or now() > mt.ends_at   + make_interval(mins => cfg.check_in_closes_minutes)) then
    raise exception 'Check-in opens % minutes before the meeting and closes % minutes after it ends',
      cfg.check_in_opens_minutes, cfg.check_in_closes_minutes using errcode = '22023';
  end if;
  insert into attendance (meeting_id, member_id, state, source, recorded_by)
  values (p_meeting, me, case when p_remote then 'remote' else 'present' end::attendance_state, 'self', me)
  on conflict (meeting_id, member_id) do update
    set state = excluded.state, source = 'self', recorded_by = me, recorded_at = now()
  returning * into a;
  return a;
end $$;

-- Absence notice. In time (per tier deadline) -> excused right away.
create function public.notify_absence(p_meeting uuid, p_reason text default null)
returns public.absence_notices
language plpgsql security definer set search_path = public as $$
declare
  me uuid := public.require_member();
  mt meetings;
  t tiers;
  deadline_hours int;
  n absence_notices;
begin
  select * into mt from meetings where id = p_meeting;
  if mt.id is null then
    raise exception 'Meeting not found' using errcode = 'P0002';
  end if;
  if now() >= mt.starts_at then
    raise exception 'This meeting has already started' using errcode = '22023';
  end if;
  select t2.* into t from tiers t2 join members m on m.tier = t2.key where m.id = me;
  deadline_hours := coalesce(case when mt.series_id = 'community'
                                  then t.absence_notice_hours_community
                                  else t.absence_notice_hours_project end, 0);
  insert into absence_notices (meeting_id, member_id, reason, in_time)
  values (p_meeting, me, p_reason, now() <= mt.starts_at - make_interval(hours => deadline_hours))
  on conflict (meeting_id, member_id) do update
    set reason = excluded.reason
  returning * into n;
  if n.in_time then
    insert into attendance (meeting_id, member_id, state, source, recorded_by, note)
    values (p_meeting, me, 'excused', 'self', me, p_reason)
    on conflict (meeting_id, member_id) do update
      set state = 'excused', source = 'self', recorded_by = me, recorded_at = now(), note = excluded.note;
  end if;
  return n;
end $$;

-- Admin: record a whole meeting in one call. Everyone expected gets p_default,
-- except members listed in p_exceptions ({"<member_id>": "unexcused", ...}).
-- Members who already checked themselves in keep their own record unless listed.
create function public.record_meeting_attendance(
  p_meeting uuid,
  p_default public.attendance_state default 'present',
  p_exceptions jsonb default '{}'::jsonb)
returns int
language plpgsql security definer set search_path = public as $$
declare
  me uuid := public.require_admin();
  n int;
begin
  with targets as (
    select e.member_id,
           coalesce((p_exceptions ->> e.member_id::text)::attendance_state, p_default) as state,
           p_exceptions ? e.member_id::text as listed
    from public.expected_members(p_meeting) as e(member_id)
  ), upserted as (
    insert into attendance (meeting_id, member_id, state, source, recorded_by)
    select p_meeting, t.member_id, t.state, 'admin', me
    from targets t
    left join attendance a on a.meeting_id = p_meeting and a.member_id = t.member_id
    where t.listed or a.member_id is null or a.source <> 'self'
    on conflict (meeting_id, member_id) do update
      set state = excluded.state, source = 'admin', recorded_by = me, recorded_at = now()
    returning 1
  )
  select count(*) into n from upserted;
  return n;
end $$;

create function public.set_attendance(p_meeting uuid, p_member uuid, p_state public.attendance_state, p_note text default null)
returns public.attendance
language plpgsql security definer set search_path = public as $$
declare me uuid := public.require_admin(); a attendance;
begin
  insert into attendance (meeting_id, member_id, state, source, recorded_by, note)
  values (p_meeting, p_member, p_state, 'admin', me, p_note)
  on conflict (meeting_id, member_id) do update
    set state = excluded.state, source = 'admin', recorded_by = me,
        recorded_at = now(), note = coalesce(excluded.note, attendance.note)
  returning * into a;
  return a;
end $$;

-- ---------------------------------------------------------------- RPC: projects, members, onboarding

-- Core or admin: add a project in one step.
create function public.create_project(
  p_name text,
  p_description text default null,
  p_lead uuid default null,
  p_members uuid[] default '{}',
  p_color text default null,
  p_series text default null)
returns public.projects
language plpgsql security definer set search_path = public as $$
declare me uuid := public.require_member(); p projects;
begin
  if not public.can_manage_tasks() then
    raise exception 'Only Core members and admins can create projects' using errcode = '42501';
  end if;
  insert into projects (name, description, lead_id, color, series_id, created_by)
  values (trim(p_name), p_description, coalesce(p_lead, me), p_color, p_series, me)
  returning * into p;
  insert into project_members (project_id, member_id)
  select p.id, x from unnest(array_append(p_members, p_lead)) as x
  where x is not null
  on conflict do nothing;
  return p;
end $$;

create function public.complete_onboarding_step(p_step text, p_member uuid default null, p_done boolean default true)
returns void
language plpgsql security definer set search_path = public as $$
declare
  me uuid := public.require_member();
  target uuid := coalesce(p_member, me);
  st onboarding_steps;
begin
  select * into st from onboarding_steps where key = p_step;
  if st.key is null then
    raise exception 'Unknown onboarding step %', p_step using errcode = 'P0002';
  end if;
  if not (select onboarding_active from members where id = target) then
    raise exception 'This member is not onboarding' using errcode = '22023';
  end if;
  if st.auto then
    raise exception 'This step completes itself' using errcode = '22023';
  end if;
  -- Members tick their own steps, buddies their mentees', admins anything.
  if not public.is_admin() and (
       st.admin_only
    or (target <> me and not exists (select 1 from members where id = target and buddy_id = me))) then
    raise exception 'Only an admin can tick this step' using errcode = '42501';
  end if;
  if p_done then
    insert into member_onboarding (member_id, step_key, completed_by)
    values (target, p_step, me)
    on conflict do nothing;
  else
    delete from member_onboarding where member_id = target and step_key = p_step;
  end if;
end $$;

-- ---------------------------------------------------------------- RPC: tasks (field-level rules)

-- Create a task. GO!/Impact members (not admin) may only create tasks for themselves.
create function public.create_task(
  p_project uuid,
  p_title text,
  p_assignee uuid default null,
  p_status public.task_status default 'todo',
  p_priority public.task_priority default 'normal',
  p_size text default 'M',
  p_starts date default null,
  p_due date default null,
  p_notes text default null)
returns public.tasks
language plpgsql security definer set search_path = public as $$
declare me uuid := public.require_member(); t tasks;
begin
  if not public.can_manage_tasks() then
    if p_assignee is not null and p_assignee <> me then
      raise exception 'You can only create tasks for yourself' using errcode = '42501';
    end if;
    p_assignee := me;
  end if;
  insert into tasks (project_id, title, assignee_id, status, priority, size, starts_on, due_on, notes)
  values (p_project, trim(p_title), p_assignee, p_status, p_priority, coalesce(p_size, 'M'),
          coalesce(p_starts, p_due - 5), p_due, p_notes)
  returning * into t;
  return t;
end $$;

-- Patch a task with only the fields given, e.g. {"status": "done"}.
-- Members who don't manage tasks are refused if the patch so much as mentions
-- assignee_id, project_id or size, even with the current value.
create function public.update_task(p_task uuid, p_patch jsonb) returns public.tasks
language plpgsql security definer set search_path = public as $$
declare
  me uuid := public.require_member();
  t tasks;
  allowed text[] := array['title', 'notes', 'status', 'priority', 'starts_on', 'due_on', 'assignee_id', 'project_id', 'size'];
  k text;
begin
  select * into t from tasks where id = p_task;
  if t.id is null then
    raise exception 'Task not found' using errcode = 'P0002';
  end if;
  for k in select jsonb_object_keys(p_patch) loop
    if not k = any (allowed) then
      raise exception 'Unknown task field %', k using errcode = '22023';
    end if;
  end loop;
  if not public.can_manage_tasks() then
    if t.assignee_id is distinct from me then
      raise exception 'You can only change tasks assigned to you' using errcode = '42501';
    end if;
    if p_patch ?| array['assignee_id', 'project_id', 'size'] then
      raise exception 'Only Core members and admins can reassign, move or resize tasks' using errcode = '42501';
    end if;
  end if;
  t := jsonb_populate_record(t, p_patch);
  update tasks set
    title = t.title, notes = t.notes, status = t.status, priority = t.priority,
    starts_on = t.starts_on, due_on = t.due_on, assignee_id = t.assignee_id,
    project_id = t.project_id, size = t.size
  where id = p_task
  returning * into t;
  return t;
end $$;

-- An hour clocked against a task shows up in the task's history.
create function public.work_session_clocked() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.task_id is not null and new.ended_at is not null and old.ended_at is null then
    insert into task_events (task_id, actor_id, kind, to_value, at)
    values (new.task_id, new.member_id, 'clocked',
            round(extract(epoch from (new.ended_at - new.started_at)) / 3600.0 * 4) / 4 || ' h',
            new.ended_at);
  end if;
  return new;
end $$;

create trigger work_session_clocked
  after update of ended_at on public.work_sessions
  for each row execute function public.work_session_clocked();

-- ---------------------------------------------------------------- RPC: members, setup, graduation

-- Admin: add a new member; they start as GO! and onboard.
create function public.add_member(
  p_name text,
  p_email text,
  p_buddy uuid default null,
  p_series text[] default '{}',
  p_avatar text default 'sprout')
returns public.members
language plpgsql security definer set search_path = public as $$
declare me uuid := public.require_admin(); m members;
begin
  insert into members (name, email, tier, buddy_id, avatar, onboarding_active, joined_on, tier_since)
  values (trim(p_name), lower(trim(p_email)), 'go', p_buddy, p_avatar, true, public.app_today(), public.app_today())
  returning * into m;
  insert into series_members (series_id, member_id)
  select s, m.id from unnest(p_series) s where s <> 'community'
  on conflict do nothing;
  return m;
end $$;

-- Admin, deploy day: existing members from the roster. They keep their tier, skip
-- onboarding and get the short setup. Emails already on file are skipped.
-- p_rows: [{"name": "...", "email": "...", "tier": "go|impact|core", "tier_since": "2026-01-01"}]
create function public.import_roster(p_rows jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid := public.require_admin(); added int;
begin
  with rows as (
    select distinct on (lower(r ->> 'email'))
           trim(r ->> 'name') as name,
           lower(trim(r ->> 'email')) as email,
           (r ->> 'tier')::tier_key as tier,
           coalesce((r ->> 'tier_since')::date, public.app_today()) as since
    from jsonb_array_elements(p_rows) r
  ), ins as (
    insert into members (name, email, tier, joined_on, tier_since, onboarding_active, needs_setup)
    select name, email, tier, since, since, false, true from rows
    on conflict (email) do nothing
    returning 1
  )
  select count(*) into added from ins;
  return jsonb_build_object('added', added, 'skipped', jsonb_array_length(p_rows) - added);
end $$;

-- Self only: the imported member's setup steps.
create function public.complete_setup(p_step text, p_done boolean default true) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := public.require_member();
begin
  if p_done then
    insert into member_setup (member_id, step_key) values (me, p_step) on conflict do nothing;
  else
    delete from member_setup where member_id = me and step_key = p_step;
  end if;
end $$;

-- Picking a project records interest only; a lead assigns the first task.
create function public.join_project(p_project uuid, p_member uuid default null) returns void
language plpgsql security definer set search_path = public as $$
declare
  me uuid := public.require_member();
  target uuid := coalesce(p_member, me);
begin
  if target <> me and not public.is_admin()
     and not exists (select 1 from members where id = target and buddy_id = me) then
    raise exception 'You can only pick projects for yourself' using errcode = '42501';
  end if;
  insert into project_interest (member_id, project_id) values (target, p_project) on conflict do nothing;
  if (select onboarding_active from members where id = target) then
    insert into member_onboarding (member_id, step_key, completed_by)
    values (target, 'project', me) on conflict do nothing;
  end if;
  if (select needs_setup from members where id = target) then
    insert into member_setup (member_id, step_key) values (target, 'projects') on conflict do nothing;
  end if;
end $$;

-- The buddy proposes ending onboarding once every step is done; an admin confirms.
create function public.propose_graduation(p_member uuid) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := public.require_member(); m members;
begin
  select * into m from members where id = p_member;
  if m.buddy_id is distinct from me then
    raise exception 'Only the buddy can propose ending onboarding' using errcode = '42501';
  end if;
  if not m.onboarding_active then
    raise exception 'This member is not onboarding' using errcode = '22023';
  end if;
  if exists (select 1 from public.onboarding_progress where member_id = p_member and not done) then
    raise exception 'Every onboarding step has to be done first' using errcode = '22023';
  end if;
  update members set graduation_proposed_by = me, graduation_proposed_at = now() where id = p_member;
end $$;

create function public.resolve_graduation(p_member uuid, p_approve boolean) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := public.require_admin();
begin
  update members
     set onboarding_active = case when p_approve and graduation_proposed_by is not null then false else onboarding_active end,
         graduation_proposed_by = null,
         graduation_proposed_at = null
   where id = p_member;
end $$;

-- Admin: change tier (restarts the time-in-tier clock via trigger).
create function public.set_tier(p_member uuid, p_tier public.tier_key) returns public.members
language plpgsql security definer set search_path = public as $$
declare me uuid := public.require_admin(); m members;
begin
  update members set tier = p_tier where id = p_member returning * into m;
  return m;
end $$;
