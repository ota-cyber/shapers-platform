-- Everything the screens show about the rules comes from the database, so
-- leadership can change it without a deploy: tier rule texts, setup steps.
-- Plus restart_onboarding, for testing and demoing onboarding repeatedly.

-- ---------------------------------------------------------------- tier rule texts

alter table public.tiers
  add column glyph            text,
  add column who              text,
  add column presence         text,
  add column notice_text      text,
  add column pause_text       text,
  add column community_text   text,
  add column absence_text     text,
  add column consequence_text text;

update public.tiers set
  glyph = '⊙',
  who = 'New members who are reliable and take responsibility for tasks and projects.',
  presence = '4 h a week at the office',
  notice_text = '1 month',
  pause_text = 'Short periods only, agreed with your buddy. Missed time is made up.',
  community_text = 'Mandatory, in person. Remote only when ill or travelling.',
  absence_text = 'Community: on Slack at least 72 h before. Project meetings: at least 24 h before.',
  consequence_text = 'Each missed Community meeting: one general task within 14 days, and read the minutes.'
where key = 'go';

update public.tiers set
  glyph = '☽',
  who = 'Members who have proven themselves on several projects and know the culture.',
  presence = '10 h a week at the office',
  notice_text = '2 months',
  pause_text = 'Up to 6 weeks a year in total, announced in advance.',
  community_text = 'May miss 3 a year, never two in a row. A team lead attends or sends someone who reports.',
  absence_text = 'Not defined',
  consequence_text = 'Not defined'
where key = 'impact';

update public.tiers set
  glyph = '↑',
  who = 'The team dedicated to the organisation and its vision every day.',
  presence = 'A full working week, weekends if needed',
  notice_text = '3 months',
  pause_text = 'Not defined',
  community_text = 'Not defined',
  absence_text = 'Not defined',
  consequence_text = 'Not defined'
where key = 'core';

-- ---------------------------------------------------------------- setup steps (imported members)

create table public.setup_steps (
  key   text primary key,
  title text not null,
  line  text,
  auto  boolean not null default false,
  sort  int not null
);

insert into public.setup_steps values
  ('confirm-tier', 'Check your tier and hours',   'What we have on file for you.', false, 1),
  ('projects',     'Pick your projects',          'So your leads can find you.',   false, 2),
  ('first-hour',   'Clock your first hour here',  'One tap at Impact Hub.',        true,  3);

alter table public.setup_steps enable row level security;
create policy "members read" on public.setup_steps for select to authenticated using (true);

-- ---------------------------------------------------------------- restart onboarding

-- Puts a member back at day one of onboarding: ticked steps, project picks,
-- hours, meeting check-ins, absence notices and their own tasks are removed,
-- tasks others assigned to them are unassigned. For testing and demos.
-- Allowed for the member themselves or an admin; never on an admin's account.
create function public.restart_onboarding(p_member uuid default null) returns void
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
  -- This reset is a rule of its own; let it past the per-member task guard.
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
         joined_on = public.app_today()
   where id = target;
end $$;

-- The task guard steps aside only for restart_onboarding (transaction-scoped flag).
create or replace function public.tasks_before_write() returns trigger
language plpgsql as $$
declare me uuid := public.current_member_id();
begin
  -- GO! and Impact members (not admin) work only on tasks assigned to them and
  -- never change owner or size. Rules and service jobs (me is null) are exempt.
  if me is not null and not public.can_manage_tasks() and new.kind = 'task'
     and coalesce(current_setting('app.task_guard_off', true), '') <> 'on' then
    if tg_op = 'INSERT' then
      if new.assignee_id is distinct from me then
        raise exception 'You can only create tasks for yourself' using errcode = '42501';
      end if;
      new.size := 'M';
    elsif old.assignee_id is distinct from me then
      raise exception 'You can only change tasks assigned to you' using errcode = '42501';
    elsif new.assignee_id is distinct from old.assignee_id
       or new.size is distinct from old.size then
      raise exception 'Only Core members and admins can hand tasks to someone else or resize them' using errcode = '42501';
    end if;
  end if;

  new.updated_at := now();
  if tg_op = 'INSERT' then
    new.created_by := coalesce(new.created_by, me);
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

