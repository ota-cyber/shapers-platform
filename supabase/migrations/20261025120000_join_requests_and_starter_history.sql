-- Anyone can sign in with Google. Someone not on the roster becomes a join
-- request; an admin approves it and they become a GO! member who onboards.
-- Finishing the onboarding screens gives them a starter history (demo data).

-- ---------------------------------------------------------------- join requests

create table public.join_requests (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null unique references auth.users (id) on delete cascade,
  email      citext not null,
  name       text not null,
  status     public.review_status not null default 'pending',
  decided_by uuid references public.members (id) on delete set null,
  created_at timestamptz not null default now(),
  decided_at timestamptz
);

alter table public.join_requests enable row level security;
create policy "own or admin" on public.join_requests for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- Called by a signed-in person who is not on the roster. Idempotent.
create function public.request_to_join() returns public.join_requests
language plpgsql security definer set search_path = public as $$
declare
  u auth.users;
  r join_requests;
begin
  select * into u from auth.users where id = auth.uid();
  if u.id is null then
    raise exception 'Sign in first' using errcode = '42501';
  end if;
  if exists (select 1 from members where email = u.email::citext) then
    raise exception 'You are already a member' using errcode = '22023';
  end if;
  insert into join_requests (user_id, email, name)
  values (u.id, u.email,
          coalesce(nullif(u.raw_user_meta_data ->> 'full_name', ''), nullif(u.raw_user_meta_data ->> 'name', ''), split_part(u.email, '@', 1)))
  on conflict (user_id) do update set email = excluded.email
  returning * into r;
  return r;
end $$;

-- Admin: approve -> a new GO! member who starts onboarding (optionally with a buddy).
create function public.approve_join_request(p_request uuid, p_buddy uuid default null) returns public.members
language plpgsql security definer set search_path = public as $$
declare
  me uuid := public.require_admin();
  r join_requests;
  m members;
begin
  select * into r from join_requests where id = p_request and status = 'pending';
  if r.id is null then
    raise exception 'Request not found or already decided' using errcode = 'P0002';
  end if;
  insert into members (name, email, tier, buddy_id, avatar, onboarding_active, joined_on, tier_since)
  values (r.name, lower(r.email::text), 'go', p_buddy, 'sprout', true, public.app_today(), public.app_today())
  on conflict (email) do update set onboarding_active = true
  returning * into m;
  update join_requests set status = 'approved', decided_by = me, decided_at = now() where id = r.id;
  return m;
end $$;

create function public.decline_join_request(p_request uuid) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := public.require_admin();
begin
  update join_requests set status = 'rejected', decided_by = me, decided_at = now()
  where id = p_request and status = 'pending';
end $$;

-- ---------------------------------------------------------------- starter history

alter table public.members add column starter_seeded_at timestamptz;

-- After the onboarding screens: four weeks of sample hours, the Community
-- meetings of those weeks, and three tasks, so a new profile looks alive.
-- Self only, once (restart_onboarding clears it).
create function public.seed_starter_history() returns boolean
language plpgsql security definer set search_path = public as $$
declare
  me uuid := public.require_member();
  m members;
  t tiers;
  from_week date := public.week_start(public.app_today()) - 28;
  proj uuid;
begin
  select * into m from members where id = me;
  if m.starter_seeded_at is not null or not m.onboarding_active then
    return false;
  end if;
  select * into t from tiers where key = m.tier;
  perform set_config('app.task_guard_off', 'on', true);

  -- Four past weeks around the tier target; the profile "has been around" a month.
  update members set joined_on = least(joined_on, from_week), tier_since = least(tier_since, from_week),
                     starter_seeded_at = now()
  where id = me;
  insert into imported_week_hours (member_id, week_start, hours)
  select me, from_week + 7 * i, round(t.weekly_hours * (array[0.75, 1.1, 1.0, 1.25])[i + 1], 1)
  from generate_series(0, 3) i
  on conflict (member_id, week_start) do nothing;

  -- Community meetings in those weeks: attended, one remotely.
  insert into attendance (meeting_id, member_id, state, source, recorded_at)
  select mt.id, me,
         case when row_number() over (order by mt.starts_at) = 2 then 'remote' else 'present' end::attendance_state,
         'admin', mt.starts_at + interval '5 minutes'
  from meetings mt
  where mt.series_id = 'community' and mt.starts_at >= from_week and mt.starts_at < now()
  on conflict (meeting_id, member_id) do nothing;

  -- Three tasks on a real project: one done, one in progress, one next.
  select id into proj from projects where not is_general and archived_at is null order by created_at limit 1;
  if proj is not null then
    insert into tasks (project_id, title, assignee_id, status, priority, size, starts_on, due_on, created_by, created_at, completed_at, kind)
    values
      (proj, 'Introduce yourself in #general',       me, 'done',  'normal', 'S', public.app_today() - 9, public.app_today() - 6, me, now() - interval '10 days', now() - interval '6 days', 'task'),
      (proj, 'Shadow your buddy at the next event',  me, 'doing', 'normal', 'M', public.app_today() - 2, public.app_today() + 5, me, now() - interval '3 days',  null, 'task'),
      (proj, 'Draft one post for the newsletter',    me, 'todo',  'low',    'S', public.app_today() + 3, public.app_today() + 10, me, now() - interval '1 day', null, 'task');
  end if;
  return true;
end $$;

-- restart_onboarding also clears the starter history flag (and, through its
-- deletes, the starter hours, attendance and tasks).
create or replace function public.restart_onboarding(p_member uuid default null) returns void
language plpgsql security definer set search_path = public as $$
declare
  me uuid := public.require_member();
  target uuid := coalesce(p_member, me);
begin
  if target <> me and not public.is_admin() then
    raise exception 'You can only restart your own onboarding' using errcode = '42501';
  end if;
  if (select is_admin from members where id = target) then
    raise exception 'Admin accounts can''t be restarted. Use a GO! test member.' using errcode = '42501';
  end if;
  perform set_config('app.task_guard_off', 'on', true);
  delete from member_onboarding   where member_id = target;
  delete from member_setup        where member_id = target;
  delete from project_interest    where member_id = target;
  delete from work_sessions       where member_id = target;
  delete from imported_week_hours where member_id = target;
  delete from attendance          where member_id = target;
  delete from absence_notices     where member_id = target;
  delete from pauses              where member_id = target;
  delete from tasks               where created_by = target or (assignee_id = target and kind = 'consequence');
  update tasks set assignee_id = null where assignee_id = target;
  delete from project_members     where member_id = target;
  update members
     set onboarding_active = true, needs_setup = false,
         graduation_proposed_by = null, graduation_proposed_at = null,
         joined_on = public.app_today(), tier_since = public.app_today(),
         starter_seeded_at = null
   where id = target;
end $$;
