-- 2026-10-25 (docs/PERMISSIONS.md): every tier can move their own tasks anywhere
-- on the board, including into another project. Owner and size stay Core/admin only.

create or replace function public.tasks_before_write() returns trigger
language plpgsql as $$
declare me uuid := public.current_member_id();
begin
  -- GO! and Impact members (not admin) work only on tasks assigned to them and
  -- never change owner or size. Rules and service jobs (me is null) are exempt.
  if me is not null and not public.can_manage_tasks() and new.kind = 'task' then
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

-- Patch a task with only the fields given, e.g. {"status": "done"}.
-- Members who don't manage tasks are refused if the patch so much as mentions
-- assignee_id or size, even with the current value.
create or replace function public.update_task(p_task uuid, p_patch jsonb) returns public.tasks
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
    if p_patch ?| array['assignee_id', 'size'] then
      raise exception 'Only Core members and admins can hand tasks to someone else or resize them' using errcode = '42501';
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
