-- 2026-10-25 (Jure): anyone who signs in starts onboarding straight away; an admin
-- approves them at the end, when every onboarding step is done. Finishing the
-- onboarding screens and completing onboarding are both announced: in Slack and
-- as a live pop-up in the app.

-- ---------------------------------------------------------------- activity feed (Slack + pop-ups)

create table public.activity (
  id         bigint generated always as identity primary key,
  kind       text not null,
  member_id  uuid references public.members (id) on delete cascade,
  text       text not null,
  created_at timestamptz not null default now()
);
alter table public.activity enable row level security;
create policy "members read" on public.activity for select to authenticated
  using (public.current_member_id() is not null);

create function public.post_to_slack(p_text text) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare url text;
begin
  select value into url from private.settings where key = 'slack_webhook_url';
  if url is null or url = '' then
    return;
  end if;
  perform net.http_post(url := url, body := jsonb_build_object('text', p_text),
                        headers := '{"Content-Type": "application/json"}'::jsonb);
end $$;
revoke execute on function public.post_to_slack(text) from public, anon, authenticated;

create function public.activity_to_slack() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.post_to_slack(new.text);
  return new;
end $$;

create trigger activity_to_slack
  after insert on public.activity
  for each row execute function public.activity_to_slack();

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables
                     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'activity') then
    alter publication supabase_realtime add table public.activity;
  end if;
end $$;

-- ---------------------------------------------------------------- open join

-- A signed-in person who isn't on the roster becomes a GO! member who onboards.
create function public.join_platform() returns public.members
language plpgsql security definer set search_path = public as $$
declare
  u auth.users;
  m members;
begin
  select * into u from auth.users where id = auth.uid();
  if u.id is null then
    raise exception 'Sign in first' using errcode = '42501';
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

-- ---------------------------------------------------------------- onboarding events

-- End of the onboarding screens: starter history (once) and the welcome announcement (every time).
create function public.onboarding_screens_done() returns void
language plpgsql security definer set search_path = public as $$
declare
  me uuid := public.require_member();
  m members;
  buddy text;
begin
  perform public.seed_starter_history();
  select * into m from members where id = me;
  select name into buddy from members where id = m.buddy_id;
  insert into activity (kind, member_id, text)
  values ('onboarding_screens', me,
          '👋 ' || m.name || ' finished the onboarding screens. Welcome to Shapers!'
          || coalesce(' Buddy: ' || buddy || '.', ''));
end $$;

-- Admin: end someone's onboarding. Allowed when their buddy proposed it or every
-- onboarding step is done. Announced in Slack and the app.
create or replace function public.resolve_graduation(p_member uuid, p_approve boolean) returns void
language plpgsql security definer set search_path = public as $$
declare
  me uuid := public.require_admin();
  m members;
  ready boolean;
begin
  select * into m from members where id = p_member;
  -- Without a buddy, "Meet your buddy" can't happen, so it doesn't block the end of onboarding.
  ready := m.graduation_proposed_by is not null
        or not exists (select 1 from public.onboarding_progress
                       where member_id = p_member and not done
                         and not (step_key = 'buddy' and m.buddy_id is null));
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
