-- 2026-10-25 (Jure):
-- 1. Clock in = one hour, booked at the press. Pressing again inside that hour adds
--    nothing; after it, clock in again. Nobody has to clock out.
-- 2. A task moving to Done is shared in the team's Slack channel and streamed to
--    the app, which shows it as a pop-up.

-- ---------------------------------------------------------------- 1. one-hour clock-in

-- The current hour block, or null.
create or replace function public.current_session() returns public.work_sessions
language plpgsql security definer set search_path = public as $$
declare me uuid := public.require_member(); s work_sessions;
begin
  select * into s from work_sessions
  where member_id = me and source = 'timer' and planned_end > now()
  order by started_at desc limit 1;
  return s;
end $$;

-- Books one hour now. Inside a running hour it returns that hour instead.
create or replace function public.clock_in(p_task_id uuid default null) returns public.work_sessions
language plpgsql security definer set search_path = public as $$
declare me uuid := public.require_member(); s work_sessions;
begin
  perform pg_advisory_xact_lock(hashtext('clock_in:' || me::text));  -- double taps queue up
  s := public.current_session();
  if s.id is not null then
    return s;
  end if;
  insert into work_sessions (member_id, started_at, planned_end, ended_at, source, task_id)
  values (me, now(), now() + interval '1 hour', now() + interval '1 hour', 'timer', p_task_id)
  returning * into s;
  if p_task_id is not null then
    insert into task_events (task_id, actor_id, kind, to_value) values (p_task_id, me, 'clocked', '1 h');
  end if;
  return s;
end $$;

-- Pressed by mistake: removes the running hour (only while it runs). Clocking in
-- again afterwards books one new hour, never more.
create or replace function public.undo_clock_in() returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := public.require_member(); s work_sessions;
begin
  s := public.current_session();
  if s.id is null then
    raise exception 'There is no running hour to remove' using errcode = 'P0002';
  end if;
  delete from task_events where task_id = s.task_id and kind = 'clocked' and actor_id = me and at >= s.started_at;
  delete from work_sessions where id = s.id;
end $$;

-- Kept for older clients: an hour is an hour, so these change nothing.
create or replace function public.extend_session() returns public.work_sessions
language sql security definer set search_path = public as $$ select public.current_session() $$;

create or replace function public.clock_out() returns public.work_sessions
language sql security definer set search_path = public as $$ select public.current_session() $$;

-- ---------------------------------------------------------------- 2. Slack + live pop-up

-- Secrets the API never exposes (the private schema isn't served by PostgREST).
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create table if not exists private.settings (
  key   text primary key,
  value text not null
);
revoke all on private.settings from public, anon, authenticated;

create extension if not exists pg_net with schema extensions;

create function public.task_done_to_slack() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare
  url text;
  who text;
  project text;
begin
  if new.status <> 'done' or (tg_op = 'UPDATE' and old.status = 'done') then
    return new;
  end if;
  select value into url from private.settings where key = 'slack_webhook_url';
  if url is null or url = '' then
    return new;
  end if;
  select name into who from members where id = coalesce(public.current_member_id(), new.assignee_id);
  select name into project from projects where id = new.project_id;
  perform net.http_post(
    url := url,
    body := jsonb_build_object('text',
      '✅ ' || coalesce(who, 'Someone') || ' finished “' || new.title || '” · ' || coalesce(project, 'a project')),
    headers := '{"Content-Type": "application/json"}'::jsonb
  );
  return new;
end $$;

create trigger task_done_to_slack
  after insert or update of status on public.tasks
  for each row execute function public.task_done_to_slack();

-- Live updates: the app listens for task history rows (RLS still applies).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables
                     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'task_events') then
    alter publication supabase_realtime add table public.task_events;
  end if;
end $$;
