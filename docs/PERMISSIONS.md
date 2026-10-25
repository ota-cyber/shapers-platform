# Permissions

Decided by Jure, 2026-10-24. **The backend must enforce these rules.** The UI hides what a person can't do (`src/lib/permissions.ts`), but hiding a button is not security: every write endpoint has to check them again.

## Tier and admin are separate

- **Tier** (GO!, Impact, Core) is about commitment and tasks. **Core members are not admins.**
- **Admin** is a role chosen separately and is unrelated to tier. Any member, of any tier, can be an admin (`Member.admin`). In the sandbox the three admins happen to be Core; do not rely on that.

## Tasks

| Who | Task rights |
|---|---|
| **Core** members | Full write access to every task and project |
| **Admins** (any tier) | Full write access to every task and project |
| **GO!** and **Impact** members (not admin) | Write access only to tasks assigned to them |

### What a GO! / Impact member may do

| Action | Own assigned task | Any other task |
|---|---|---|
| See it on the board and timeline | yes | yes (read only) |
| Change status (drag between columns) | yes | no |
| Change start date, due date, length (timeline drag) | yes | no |
| Change priority | yes | no |
| Add or edit notes and details | yes | no |
| Assign or hand it to someone else, or unassign it | **no** | no |
| Move it around the board: status and project (drag between columns and project rows) | yes | no |
| Pick up an unassigned task ("take it") | **no**: someone with full task access assigns it first | n/a |
| Create a task **for themselves** (any project; it is assigned to them) | yes | n/a |
| Create a task for someone else, or create a project | **no** | n/a |
| Change a task's size (S / M / L) | **no** | no |
| Delete a task | no | no |

In short: a member works only on what has been assigned to them. Once a task is theirs, they can move it anywhere on the board, schedule it and fill it in however they like, but they cannot change who owns it or touch anything belonging to someone else.

### What Core members and admins may do

Everything above on every task: create, edit, assign, reassign, move between projects, schedule, change status, and create projects.

## Team section

Visible to **admins and Core members**. Core sees people, their member pages (week, performance, attendance, tasks), the leaderboard, overview, moving up / dropping and new members. Admin-only inside it: approvals, recording attendance, adding members, changing tiers, confirming graduation.

## Admin-only screens

Admin role only, never granted by tier: the Team section (everyone's stats, moving up / dropping, onboarding overview), approvals (back-filled hours, pauses), recording meeting attendance, adding members, changing someone's tier.

## Backend checklist

- Every task write (`PATCH /tasks/:id`, move, dates) checks: `user.tier === "Core" || user.admin || task.assigneeId === user.id`.
- Field `assigneeId` is writable only by Core members and admins. Reject the whole request if anyone else sends it, even with an unchanged value.
- Field `projectId`: Core members and admins on any task; GO!/Impact members only on tasks assigned to them.
- `POST /tasks`: anyone. If the creator is GO!/Impact and not admin, force `assigneeId` to the creator (reject any other value).
- `POST /projects`: Core members and admins only.
- Field `size` (S / M / L) is writable only by Core members and admins: it feeds the performance score, so members must not be able to inflate it.
- Admin endpoints (approvals, attendance recording, member and tier changes) check `user.admin` only, never the tier.
- Keep writing the task history entry (who, what, when) on every change, so changes stay traceable.
- Read the tier at request time, so a promotion or demotion changes task rights immediately.

## Onboarding

When a new member picks projects during onboarding, the app only records their choice (`Member.wantsProjects`). It does not assign them a task. The project lead (or anyone with full task access) assigns the first task.

## Onboarding graduation and roster import

- **Ending onboarding:** only the member's **buddy** can propose it, and only once every onboarding step is done. Only an **admin** can confirm it (or send it back with "not yet"). Decided by Jure, 2026-10-24.
- **Importing the roster** (existing members, deploy day) is admin-only, like adding a member.
- **Removing someone from Shapers** (the button at the bottom of their profile) and **restoring them** (Team → Approvals → Blacklist) are admin-only. An admin can't remove themselves. A removed member's email is blacklisted: every query is refused (inactive member) and signing in again can't re-create them. Decided by Jure, 2026-10-25.
- **Setup steps** (check tier, pick projects) are written by the member themselves. A member who thinks their tier is wrong is told to ask an admin; they cannot change it.

## Decided later

- 2026-10-24: GO! and Impact members **can** create tasks for themselves (Jure).
- 2026-10-24: tasks get a size, S / M / L = 1 / 3 / 8 points, set by Core or admin only (Jure). Used by the performance leaderboard: score = points of finished tasks + 5 per full weekly commitment met, hours judged against each member's own tier.
- 2026-10-25: every tier can move their own tasks around the whole board, including into another project's row (Jure). Reassigning to another person stays Core/admin only.
