-- Demo rule (Jure, 2026-10-25): Lea is the member who always shows onboarding in the
-- presentation. Her account never leaves onboarding, whatever happens while testing.
create function public.keep_demo_onboarding() returns trigger
language plpgsql as $$
begin
  if split_part(new.email::text, '@', 1) = 'lea.zorman' then
    new.onboarding_active := true;
    new.graduation_proposed_by := null;
    new.graduation_proposed_at := null;
    new.tier := 'go';
  end if;
  return new;
end $$;

create trigger keep_demo_onboarding
  before insert or update on public.members
  for each row execute function public.keep_demo_onboarding();
