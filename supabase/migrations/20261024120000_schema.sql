-- Shapers platform: core schema.
-- Times are stored as timestamptz; "weeks" and "days" are computed in Europe/Ljubljana.

create extension if not exists citext;

-- ---------------------------------------------------------------- enums

create type public.tier_key         as enum ('go', 'impact', 'core');
-- Lanes of the team's board: Idea lane, Priority lane, In progress, Validation, Done.
create type public.task_status      as enum ('idea', 'todo', 'doing', 'review', 'done');
create type public.task_priority    as enum ('low', 'normal', 'high');
create type public.attendance_state as enum ('present', 'remote', 'excused', 'unexcused');
create type public.review_status    as enum ('approved', 'pending', 'rejected');

-- ---------------------------------------------------------------- config

-- Tier rules are data so leadership can change them without a deploy.
create table public.tiers (
  key                       public.tier_key primary key,
  name                      text not null unique,
  weekly_hours              numeric(5,1) not null check (weekly_hours >= 0),
  notice_months             int,
  community_misses_per_year int,          -- null = not defined
  absence_notice_hours_community int,     -- null = not defined
  absence_notice_hours_project   int,
  pause_weeks_per_year      int,          -- null = not defined
  months_before_review      int,          -- GO! -> Impact after 6 months
  next_tier                 public.tier_key,
  sort                      int not null
);

insert into public.tiers values
  ('go',     'Shapers GO!',    4,  1, 0,    72,   24,   null, 6,    'impact', 1),
  ('impact', 'Shapers Impact', 10, 2, 3,    null, null, 6,    null, 'core',   2),
  ('core',   'Shapers Core',   70, 3, null, null, null, null, null, null,     3);

create table public.app_settings (
  id                      boolean primary key default true check (id),
  check_in_opens_minutes  int not null default 15,   -- before meeting start
  check_in_closes_minutes int not null default 15,   -- after meeting end
  check_in_any_time       boolean not null default false, -- demo switch
  backfill_days           int not null default 1,    -- older manual entries need approval
  stall_days              int not null default 7,    -- no onboarding progress for this long nudges the buddy
  tracking_since          date not null default current_date -- first week with hours data
);
insert into public.app_settings default values;

-- ---------------------------------------------------------------- people

create table public.members (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid unique references auth.users (id) on delete set null,
  name        text not null,
  email       citext not null unique,
  tier        public.tier_key not null default 'go' references public.tiers (key),
  is_admin    boolean not null default false,
  joined_on   date not null default current_date,
  tier_since  date not null default current_date,
  buddy_id    uuid references public.members (id) on delete set null,
  handle      text generated always as (split_part(email::text, '@', 1)) stored,
  slack_user_id text,
  avatar      text,                                   -- image key in the frontend's /public/img
  -- Onboarding: true while a new member works through the checklist. Members who
  -- joined before the platform never onboard; they get the short setup instead.
  onboarding_active      boolean not null default false,
  needs_setup            boolean not null default false,
  graduation_proposed_by uuid references public.members (id) on delete set null,
  graduation_proposed_at timestamptz,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);
create index on public.members (buddy_id);
create unique index members_handle on public.members (handle);

create table public.series (
  id       text primary key,          -- slug, e.g. 'shapers-tech'
  name     text not null unique,      -- as in the calendar: 'Shapers Tech'
  everyone boolean not null default false, -- Community: all members expected
  sort     int not null
);

insert into public.series values
  ('community',     'Community',     true,  1),
  ('summer-school', 'Summer School', false, 2),
  ('grants',        'Grants',        false, 3),
  ('shape-talks',   'Shape Talks',   false, 4),
  ('shapers-tech',  'Shapers Tech',  false, 5),
  ('shapers-voice', 'Shapers Voice', false, 6);

create table public.series_members (
  series_id text not null references public.series (id) on delete cascade,
  member_id uuid not null references public.members (id) on delete cascade,
  primary key (series_id, member_id)
);
create index on public.series_members (member_id);

-- ---------------------------------------------------------------- meetings (read from Google Calendar)

create table public.meetings (
  id            uuid primary key default gen_random_uuid(),
  ical_uid      text not null unique,   -- stable across .ics import and Calendar API
  gcal_event_id text,
  series_id     text not null references public.series (id),
  title         text not null,
  starts_at     timestamptz not null,
  ends_at       timestamptz not null check (ends_at > starts_at),
  location      text,
  description   text,
  synced_at     timestamptz not null default now()
);
create index on public.meetings (starts_at);
create index on public.meetings (series_id, starts_at);

create table public.attendance (
  meeting_id  uuid not null references public.meetings (id) on delete cascade,
  member_id   uuid not null references public.members (id) on delete cascade,
  state       public.attendance_state not null,
  source      text not null check (source in ('self', 'admin', 'import')),
  recorded_by uuid references public.members (id) on delete set null,
  recorded_at timestamptz not null default now(),
  note        text,
  primary key (meeting_id, member_id)
);
create index on public.attendance (member_id);

create table public.absence_notices (
  id         uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings (id) on delete cascade,
  member_id  uuid not null references public.members (id) on delete cascade,
  reason     text,
  in_time    boolean not null,   -- given before the tier's notice deadline
  created_at timestamptz not null default now(),
  unique (meeting_id, member_id)
);

-- ---------------------------------------------------------------- projects and tasks

create table public.projects (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  description text,
  series_id   text references public.series (id),
  color       text,
  lead_id     uuid references public.members (id) on delete set null,
  is_general  boolean not null default false,  -- home of consequence tasks
  created_by  uuid references public.members (id) on delete set null,
  created_at  timestamptz not null default now(),
  archived_at timestamptz
);
create unique index projects_one_general on public.projects (is_general) where is_general;

insert into public.projects (name, description, series_id, color, is_general)
values ('General', 'Organisation-wide tasks, including follow-ups for missed Community meetings.', 'community', '#64748b', true);

create table public.project_members (
  project_id uuid not null references public.projects (id) on delete cascade,
  member_id  uuid not null references public.members (id) on delete cascade,
  added_at   timestamptz not null default now(),
  primary key (project_id, member_id)
);
create index on public.project_members (member_id);

create table public.tasks (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.projects (id) on delete cascade,
  title        text not null check (length(trim(title)) > 0),
  notes        text,
  status       public.task_status not null default 'todo',
  priority     public.task_priority not null default 'normal',
  -- Effort, set by Core or admin only: S/M/L = 1/3/8 points in the performance score.
  size         text not null default 'M' check (size in ('S', 'M', 'L')),
  starts_on    date,                      -- timeline bar start
  due_on       date,                      -- timeline bar end
  assignee_id  uuid references public.members (id) on delete set null,
  kind         text not null default 'task' check (kind in ('task', 'consequence')),
  source_meeting_id uuid references public.meetings (id) on delete set null,
  sort_order   double precision not null default extract(epoch from now()),
  created_by   uuid references public.members (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  completed_at timestamptz
);
create index on public.tasks (project_id, status);
create index on public.tasks (assignee_id, status);
create index on public.tasks (completed_at);

-- Full history, so a moved card never loses where it came from.
create table public.task_events (
  id         bigint generated always as identity primary key,
  task_id    uuid not null references public.tasks (id) on delete cascade,
  actor_id   uuid references public.members (id) on delete set null,
  kind       text not null check (kind in ('created', 'status', 'assignee', 'priority', 'due', 'start',
                                           'project', 'title', 'notes', 'size', 'clocked')),
  from_value text,
  to_value   text,
  at         timestamptz not null default now()
);
create index on public.task_events (task_id, at);

-- ---------------------------------------------------------------- hours

-- Timer sessions run in 1-hour blocks (planned_end). A session nobody extends
-- ends at planned_end; it is closed lazily the next time the member's clock is touched.
create table public.work_sessions (
  id          uuid primary key default gen_random_uuid(),
  member_id   uuid not null references public.members (id) on delete cascade,
  started_at  timestamptz not null,
  planned_end timestamptz not null check (planned_end > started_at),
  ended_at    timestamptz check (ended_at is null or ended_at >= started_at),
  source      text not null check (source in ('timer', 'manual')),
  status      public.review_status not null default 'approved',
  note        text,
  task_id     uuid references public.tasks (id) on delete set null,
  reviewed_by uuid references public.members (id) on delete set null,
  reviewed_at timestamptz,
  created_at  timestamptz not null default now()
);
create index on public.work_sessions (member_id, started_at);
create unique index work_sessions_one_open_timer
  on public.work_sessions (member_id) where ended_at is null and source = 'timer';

-- Weekly totals from before the platform existed (sandbox hours.csv).
create table public.imported_week_hours (
  member_id  uuid not null references public.members (id) on delete cascade,
  week_start date not null check (extract(isodow from week_start) = 1),
  hours      numeric(6,2) not null check (hours >= 0),
  primary key (member_id, week_start)
);

create table public.pauses (
  id          uuid primary key default gen_random_uuid(),
  member_id   uuid not null references public.members (id) on delete cascade,
  starts_on   date not null,
  ends_on     date not null check (ends_on >= starts_on),
  reason      text,
  status      public.review_status not null default 'pending',
  reviewed_by uuid references public.members (id) on delete set null,
  created_at  timestamptz not null default now()
);
create index on public.pauses (member_id, starts_on);

-- ---------------------------------------------------------------- onboarding

-- Mirrors the two real onboarding meetings. Keys match the frontend's step ids.
create table public.onboarding_steps (
  key         text primary key,
  title       text not null,
  description text,
  stage       text not null,                  -- group heading in the checklist
  admin_only  boolean not null default false, -- only an admin can tick it
  auto        boolean not null default false, -- computed from activity
  sort        int not null
);

insert into public.onboarding_steps values
  ('values',        'Read what Shapers stands for', 'Values, and the rules everyone keeps.',          'Meeting one · values and rules', false, false, 1),
  ('tiers',         'Learn how tiers work',         'GO!, Impact, Core, and what each asks of you.',  'Meeting one · values and rules', false, false, 2),
  ('contract',      'Sign your contract',           'One page. Your buddy has it.',                   'Meeting two · tools and project', false, false, 3),
  ('email',         'Get your Shapers email',       'Your address on the organisation''s domain.',    'Meeting two · tools and project', false, false, 4),
  ('slack',         'Join Slack',                   'Where absences are announced.',                  'Meeting two · tools and project', false, false, 5),
  ('calendar',      'Subscribe to the calendar',    'Every meeting, read from Google Calendar.',      'Meeting two · tools and project', false, false, 6),
  ('buddy',         'Meet your buddy',              'Twenty minutes, every week.',                    'Meeting two · tools and project', false, false, 7),
  ('project',       'Pick your first project',      'Where your hours will go.',                      'Meeting two · tools and project', false, false, 8),
  ('first-hour',    'Clock your first hour',        'At Impact Hub. One tap.',                        'Your first weeks',                false, true,  9),
  ('first-task',    'Finish your first task',       'Anything. Small is fine.',                       'Your first weeks',                false, true,  10),
  ('first-meeting', 'Attend your first meeting',    'Clock in when it starts.',                       'Your first weeks',                false, true,  11);

create table public.member_onboarding (
  member_id    uuid not null references public.members (id) on delete cascade,
  step_key     text not null references public.onboarding_steps (key) on delete cascade,
  completed_at timestamptz not null default now(),
  completed_by uuid references public.members (id) on delete set null,
  primary key (member_id, step_key)
);

-- Short setup for members imported from the roster (they skip onboarding).
-- 'first-hour' is derived from their hours, not stored.
create table public.member_setup (
  member_id    uuid not null references public.members (id) on delete cascade,
  step_key     text not null check (step_key in ('confirm-tier', 'projects')),
  completed_at timestamptz not null default now(),
  primary key (member_id, step_key)
);

-- Projects a member picked; the project lead assigns their first task.
create table public.project_interest (
  member_id  uuid not null references public.members (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (member_id, project_id)
);
