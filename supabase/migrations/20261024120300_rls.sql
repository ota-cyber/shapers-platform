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

-- Admin writes
create policy "admin write" on public.members         for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin write" on public.series_members  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin write" on public.projects        for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin write" on public.project_members for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin write" on public.tiers           for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin write" on public.app_settings    for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- Tasks: members create tasks in their projects; they can change tasks they hold,
-- pick up unassigned tasks in their projects, and hand tasks to someone else.
create policy "create in my projects" on public.tasks for insert to authenticated
  with check (public.is_admin() or public.is_project_member(project_id));

create policy "change mine or unassigned" on public.tasks for update to authenticated
  using (public.is_admin()
         or assignee_id = public.current_member_id()
         or (assignee_id is null and public.is_project_member(project_id)))
  with check (public.is_admin() or public.is_project_member(project_id));

create policy "admin delete" on public.tasks for delete to authenticated
  using (public.is_admin());

-- RPCs check the caller themselves (require_member / require_admin).
