-- Shapers platform: row-level security.
-- Reading: the organisation is transparent about projects, tasks and meetings;
-- personal records (hours, attendance, pauses) are visible to the member, their
-- buddy and admins. Writing: tasks directly through the API, everything else via RPCs.

alter table public.tiers               enable row level security;
alter table public.app_settings        enable row level security;
alter table public.members             enable row level security;
alter table public.series              enable row level security;
alter table public.series_members      enable row level security;
alter table public.meetings            enable row level security;
alter table public.attendance          enable row level security;
alter table public.absence_notices     enable row level security;
alter table public.projects            enable row level security;
alter table public.project_members     enable row level security;
alter table public.tasks               enable row level security;
alter table public.task_events         enable row level security;
alter table public.work_sessions       enable row level security;
alter table public.imported_week_hours enable row level security;
alter table public.pauses              enable row level security;
alter table public.onboarding_steps    enable row level security;
alter table public.member_onboarding   enable row level security;
alter table public.member_setup        enable row level security;
alter table public.project_interest    enable row level security;

-- Shared reference data
create policy "members read" on public.tiers            for select to authenticated using (true);
create policy "members read" on public.app_settings     for select to authenticated using (true);
create policy "members read" on public.series           for select to authenticated using (true);
create policy "members read" on public.series_members   for select to authenticated using (true);
create policy "members read" on public.meetings         for select to authenticated using (true);
create policy "members read" on public.onboarding_steps for select to authenticated using (true);
create policy "members read" on public.members          for select to authenticated using (public.current_member_id() is not null);
create policy "members read" on public.projects         for select to authenticated using (public.current_member_id() is not null);
create policy "members read" on public.project_members  for select to authenticated using (public.current_member_id() is not null);
create policy "members read" on public.tasks            for select to authenticated using (public.current_member_id() is not null);
create policy "members read" on public.task_events      for select to authenticated using (public.current_member_id() is not null);

-- Personal records
create policy "own, mentee or admin" on public.attendance          for select to authenticated using (public.can_see_member(member_id));
create policy "own, mentee or admin" on public.absence_notices     for select to authenticated using (public.can_see_member(member_id));
create policy "own, mentee or admin" on public.work_sessions       for select to authenticated using (public.can_see_member(member_id));
create policy "own, mentee or admin" on public.imported_week_hours for select to authenticated using (public.can_see_member(member_id));
create policy "own, mentee or admin" on public.pauses              for select to authenticated using (public.can_see_member(member_id));
create policy "own, mentee or admin" on public.member_onboarding   for select to authenticated using (public.can_see_member(member_id));
create policy "own, mentee or admin" on public.member_setup        for select to authenticated using (public.can_see_member(member_id));
create policy "members read"         on public.project_interest    for select to authenticated using (public.current_member_id() is not null);

-- Admin writes
create policy "admin write" on public.members         for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin write" on public.series_members  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "core or admin write" on public.projects for all to authenticated using (public.can_manage_tasks()) with check (public.can_manage_tasks());
create policy "admin write" on public.project_members for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin write" on public.tiers           for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin write" on public.app_settings    for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- Tasks (docs/PERMISSIONS.md): Core members and admins change any task. GO! and
-- Impact members change only tasks assigned to them and create tasks only for
-- themselves; the tasks_before_write trigger also stops them changing owner,
-- project or size. Prefer the create_task / update_task RPCs.
create policy "create" on public.tasks for insert to authenticated
  with check (public.can_manage_tasks() or assignee_id = public.current_member_id());

create policy "change" on public.tasks for update to authenticated
  using (public.can_manage_tasks() or assignee_id = public.current_member_id())
  with check (public.can_manage_tasks() or assignee_id = public.current_member_id());

create policy "delete" on public.tasks for delete to authenticated
  using (public.can_manage_tasks());

-- RPCs check the caller themselves (require_member / require_admin).
