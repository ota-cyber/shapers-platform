# Backend API (for the frontend)

Supabase: Postgres + Auth + one Edge Function. The frontend talks to it with
[`@supabase/supabase-js`](https://supabase.com/docs/reference/javascript) using the **anon key** and the signed-in user's session.
Row-level security decides what each person sees, so the frontend never filters for permissions itself.

Types for every table, view and RPC: [`types/database.ts`](../types/database.ts)
(regenerate with `supabase gen types typescript --local > types/database.ts`).

```ts
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../types/database";
export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY);
```

## Sign-in

- Demo: every sandbox member has a sign-in with the demo password (`scripts/create-demo-users.mjs`).
  `supabase.auth.signInWithPassword({ email, password })`. A "view as" picker can list `members` and sign in as the chosen one.
- Real use: Google sign-in (`signInWithOAuth({ provider: "google" })`). A sign-in is linked to a member by email automatically.
- Who am I: `supabase.from("member_overview").select("*").eq("member_id", myId)`; `myId` comes from
  `supabase.from("members").select("id,is_admin").eq("email", session.user.email).single()`.
  `is_admin` decides whether to show admin screens.

## Conventions

- **Writes go through RPCs** (`supabase.rpc(name, args)`), except tasks, which are plain table updates.
- RPC errors come back as `error.message` in plain English, ready to show ("Check-in opens 15 minutes before…").
- Times are `timestamptz` (ISO strings). Weeks are Monday-based in Europe/Ljubljana. Week targets are hours.
- Views only return the members the caller may see: themselves, their buddy mentees, everyone for admins.

## Screens → data

### Home (member) / onboarding

| Need | Call |
|---|---|
| Everything for my header cards | `from("member_overview").select("*").eq("member_id", me).single()` |
| Fields | `week_hours`, `week_target`, `expected_by_now`, `hours_remaining`, `behind`, `paused`, `hour_streak`, `best_hour_streak`, `meeting_streak`, `attendance_rate_6w`, `open_tasks`, `overdue_tasks`, `tasks_done_7d`, `onboarding_done`/`onboarding_total`, `onboarded`, `tier_name`, `next_tier_name`, `review_on`, `months_in_tier`, `buddy_name` |
| Onboarding checklist | `from("onboarding_progress").select("*").eq("member_id", me).order("sort")` → `step_key, title, description, stage, done, admin_only, auto` |
| Tick a step | `rpc("complete_onboarding_step", { p_step, p_done: true })`. Auto steps tick themselves; admin-only steps need an admin; a buddy can pass `p_member` |
| Badges | `from("member_badges").select("*").eq("member_id", me)` → `badge, title, description, earned` |
| Tier rules text | `from("tiers").select("*").order("sort")` |

Suggested logic: show the onboarding checklist as the home screen while `onboarded` is false, then the everyday dashboard.

### Tasks

| Need | Call |
|---|---|
| Projects | `from("projects").select("*, lead:members!projects_lead_id_fkey(name)").is("archived_at", null)` |
| Board for a project | `from("tasks").select("*, assignee:members!tasks_assignee_id_fkey(id,name)").eq("project_id", id).order("sort_order")` |
| My tasks, all projects | `from("tasks").select("*, project:projects(name,color)").eq("assignee_id", me).neq("status", "done")` |
| All tasks (admin board) | `from("tasks").select("*, project:projects(name,color), assignee:members!tasks_assignee_id_fkey(name)")` |
| Finish / move | `from("tasks").update({ status: "done" }).eq("id", id)` (`todo` / `doing` / `done`; `completed_at` is set for you) |
| Priority / date / hand over | `update({ priority })`, `update({ due_on })`, `update({ assignee_id })` |
| New task | `from("tasks").insert({ project_id, title, assignee_id, priority, due_on })` |
| Task history | `from("task_events").select("*, actor:members(name)").eq("task_id", id).order("at")` |
| Add project (admin) | `rpc("create_project", { p_name, p_description, p_lead, p_members: [ids], p_color })` |
| Tasks done per member (admin) | `from("task_stats").select("*")` or the task columns in `member_overview` |

Members can change tasks they hold, pick up unassigned tasks in their projects, and hand tasks on.
Anything else returns 0 updated rows. Assigning a task adds the person to the project.
Tasks with `kind = "consequence"` are the automatic follow-ups for GO! members who miss Community.

### Hours

| Need | Call |
|---|---|
| Running timer? | `rpc("current_session")` → session or `null`. Show "Still working?" when `planned_end` is close |
| Clock in | `rpc("clock_in", { p_task_id? })`. Safe to double-tap |
| Still working → yes | `rpc("extend_session")` (+1 hour; allowed until 15 min after `planned_end`) |
| Clock out | `rpc("clock_out")` |
| No answer | nothing to do: the session ends at `planned_end` by itself |
| Log hours manually | `rpc("log_hours", { p_date: "2026-10-24", p_hours: 1.5, p_note?, p_task_id? })`. Today and yesterday → approved; older → `status: "pending"` until an admin approves |
| My weeks (chart) | `from("week_hours").select("*").eq("member_id", me).order("week_start")` → `hours, target, met, paused, is_current` |
| My entries | `from("work_sessions").select("*").eq("member_id", me).order("started_at", { ascending: false })` |
| Delete my entry | `rpc("delete_my_session", { p_session })` |
| Pause | `rpc("request_pause", { p_starts, p_ends, p_reason })`; admin: `rpc("review_pause", { p_pause, p_approve })` |
| Who is behind (admin) | `from("member_overview").select("*").eq("behind", true)` |
| Pending entries (admin) | `from("work_sessions").select("*, member:members!work_sessions_member_id_fkey(name)").eq("status", "pending")`, then `rpc("review_session", { p_session, p_approve })` |

Meetings never count as hours.

### Meetings

| Need | Call |
|---|---|
| My meetings | `from("member_meetings").select("*").eq("member_id", me).order("starts_at")` → `status`: `upcoming`, `in_progress`, `present`, `remote`, `excused`, `unexcused`, `unrecorded`; `absence_notified` |
| Check in | `rpc("check_in_meeting", { p_meeting, p_remote: false })`. Opens 15 min before, closes 15 min after the end |
| Can't come | `rpc("notify_absence", { p_meeting, p_reason })` → `in_time` true means excused (GO!: 72 h before Community, 24 h before project meetings) |
| My record per series | `from("attendance_summary").select("*").eq("member_id", me)` (`series_id` null = all series) |
| Record a meeting (admin) | `rpc("record_meeting_attendance", { p_meeting, p_default: "present", p_exceptions: { [memberId]: "unexcused" } })`. Self check-ins are kept unless listed |
| Fix one person (admin) | `rpc("set_attendance", { p_meeting, p_member, p_state })` |
| Everyone's record (admin) | `from("member_meetings").select("*")` or `attendance_summary` |
| Sync from Google Calendar (admin) | `supabase.functions.invoke("sync-calendar")` |

### Admin analytics

| Need | Call |
|---|---|
| Member table | `from("member_overview").select("*")` (one row per member, all the numbers above) |
| Organisation per week | `from("org_weekly").select("*")` → `total_hours, pct_on_target, attendance_rate, meetings, tasks_done` |
| Per tier per week | `from("tier_weekly").select("*")` |
| Any member's history | `week_hours`, `member_meetings`, `task_events`, filtered by `member_id` |
| Onboarding overview | `from("member_overview").select("name, onboarding_done, onboarding_total, buddy_name").eq("onboarded", false)` |
| Tier settings | `from("tiers").update({ weekly_hours: 70 }).eq("key", "core")` (admin) |

## Demo switches

- `app_settings.check_in_any_time = true` opens meeting check-in at any time (no live meeting during the demo).
  Admin: `from("app_settings").update({ check_in_any_time: true }).eq("id", true)`.
