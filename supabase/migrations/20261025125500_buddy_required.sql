-- 2026-10-25 (Jure): a member who is onboarding without a buddy can't do anything
-- until an admin assigns one. "Meet your buddy" always counts.

-- Every RPC write goes through require_member: blocked while onboarding without a buddy.
create or replace function public.require_member() returns uuid
language plpgsql stable security definer set search_path = public as $$
declare m members;
begin
  select * into m from members where user_id = auth.uid() and active;
  if m.id is null then
    raise exception 'Not signed in as a Shapers member' using errcode = '42501';
  end if;
  if m.onboarding_active and m.buddy_id is null and not m.is_admin then
    raise exception 'Waiting for your buddy: an admin assigns one before you can start' using errcode = '42501';
  end if;
  return m.id;
end $$;

-- Admin: give someone a buddy (or change it).
create function public.set_buddy(p_member uuid, p_buddy uuid) returns public.members
language plpgsql security definer set search_path = public as $$
declare me uuid := public.require_admin(); m members;
begin
  if p_member = p_buddy then
    raise exception 'Someone can''t be their own buddy' using errcode = '22023';
  end if;
  update members set buddy_id = p_buddy where id = p_member returning * into m;
  return m;
end $$;

-- Ending onboarding needs every step, "Meet your buddy" included.
create or replace function public.resolve_graduation(p_member uuid, p_approve boolean) returns void
language plpgsql security definer set search_path = public as $$
declare
  me uuid := public.require_admin();
  m members;
  ready boolean;
begin
  select * into m from members where id = p_member;
  ready := m.graduation_proposed_by is not null
        or not exists (select 1 from public.onboarding_progress where member_id = p_member and not done);
  if p_approve and m.onboarding_active and ready then
    update members set onboarding_active = false, graduation_proposed_by = null, graduation_proposed_at = null
    where id = p_member;
    insert into activity (kind, member_id, text)
    values ('onboarding_completed', p_member,
            '🎉 ' || m.name || ' completed onboarding and is now a full ' ||
            (select name from tiers where key = m.tier) || ' member.');
  else
    update members set graduation_proposed_by = null, graduation_proposed_at = null where id = p_member;
  end if;
end $$;
