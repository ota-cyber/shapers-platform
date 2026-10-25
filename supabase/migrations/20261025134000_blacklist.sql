-- 2026-10-25 (Jure): admins can remove someone from Shapers from their profile.
-- Removing deactivates the member (every policy goes through current_member_id(),
-- which only sees active members, so they can no longer read or write anything)
-- and blacklists their email so signing in again can't re-create them through
-- join_platform. Admins see the blacklist under Team -> Approvals and can restore.

create table public.blacklist (
  email       citext primary key,
  member_id   uuid references public.members (id) on delete set null,
  name        text not null,
  removed_by  uuid references public.members (id) on delete set null,
  removed_at  timestamptz not null default now()
);
alter table public.blacklist enable row level security;
create policy "admin read" on public.blacklist for select to authenticated using (public.is_admin());

create function public.remove_member(p_member uuid) returns void
language plpgsql security definer set search_path = public as $$
declare m members;
begin
  if not public.is_admin() then
    raise exception 'Only admins can remove members' using errcode = '42501';
  end if;
  select * into m from members where id = p_member and active;
  if m.id is null then
    raise exception 'Member not found' using errcode = 'P0002';
  end if;
  if m.id = public.current_member_id() then
    raise exception 'You can''t remove yourself' using errcode = '42501';
  end if;
  update members set active = false where id = m.id;
  insert into blacklist (email, member_id, name, removed_by)
  values (m.email, m.id, m.name, public.current_member_id())
  on conflict (email) do update set member_id = excluded.member_id, name = excluded.name,
                                    removed_by = excluded.removed_by, removed_at = now();
  -- Their open work goes back to the pool; a running clock-in stops.
  update tasks set assignee_id = null where assignee_id = m.id and status <> 'done';
  update members set buddy_id = null where buddy_id = m.id;
  delete from work_sessions where member_id = m.id and source = 'timer' and ended_at is null;
end $$;

create function public.restore_member(p_email citext) returns void
language plpgsql security definer set search_path = public as $$
declare b blacklist;
begin
  if not public.is_admin() then
    raise exception 'Only admins can restore members' using errcode = '42501';
  end if;
  delete from blacklist where email = p_email returning * into b;
  if b.email is null then
    raise exception 'Not on the blacklist' using errcode = 'P0002';
  end if;
  update members set active = true where id = b.member_id or email = p_email;
end $$;

-- Signing in with a blacklisted email: refuse instead of joining again.
create or replace function public.join_platform() returns public.members
language plpgsql security definer set search_path = public as $$
declare
  u auth.users;
  m members;
begin
  select * into u from auth.users where id = auth.uid();
  if u.id is null then
    raise exception 'Sign in first' using errcode = '42501';
  end if;
  if exists (select 1 from blacklist where email = u.email::citext) then
    raise exception 'Removed from Shapers' using errcode = '42501';
  end if;
  select * into m from members where email = u.email::citext;
  if m.id is not null then
    return m;
  end if;
  -- Everyone onboards with a buddy: the admin or Core member with the fewest mentees.
  insert into members (name, email, tier, avatar, onboarding_active, joined_on, tier_since, buddy_id)
  values (coalesce(nullif(u.raw_user_meta_data ->> 'full_name', ''), nullif(u.raw_user_meta_data ->> 'name', ''), split_part(u.email, '@', 1)),
          lower(u.email), 'go', 'sprout', true, public.app_today(), public.app_today(),
          (select b.id from members b
           where b.active and (b.is_admin or b.tier = 'core')
           order by (select count(*) from members x where x.buddy_id = b.id and x.onboarding_active), b.created_at
           limit 1))
  returning * into m;
  return m;
end $$;

revoke execute on function public.remove_member(uuid) from public, anon;
revoke execute on function public.restore_member(citext) from public, anon;
grant execute on function public.remove_member(uuid) to authenticated;
grant execute on function public.restore_member(citext) to authenticated;
