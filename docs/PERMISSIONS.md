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
| Move it to another project | **no** | no |
| Pick up an unassigned task ("take it") | **no**: someone with full task access assigns it first | n/a |
| Create a task **for themselves** (any project; it is assigned to them) | yes | n/a |
| Create a task for someone else, or create a project | **no** | n/a |
| Delete a task | no | no |

In short: a member works only on what has been assigned to them. Once a task is theirs, they can schedule it and fill it in however they like, but they cannot change who owns it, where it lives, or anything belonging to someone else.

### What Core members and admins may do

Everything above on every task: create, edit, assign, reassign, move between projects, schedule, change status, and create projects.

## Admin-only screens

Admin role only, never granted by tier: the Team section (everyone's stats, moving up / dropping, onboarding overview), approvals (back-filled hours, pauses), recording meeting attendance, adding members, changing someone's tier.

## Backend checklist

- Every task write (`PATCH /tasks/:id`, move, dates) checks: `user.tier === "Core" || user.admin || task.assigneeId === user.id`.
- Fields `assigneeId` and `projectId` are writable only by Core members and admins. Reject the whole request if anyone else sends them, even with an unchanged value.
- `POST /tasks`: anyone. If the creator is GO!/Impact and not admin, force `assigneeId` to the creator (reject any other value).
- `POST /projects`: Core members and admins only.
- Admin endpoints (approvals, attendance recording, member and tier changes) check `user.admin` only, never the tier.
- Keep writing the task history entry (who, what, when) on every change, so changes stay traceable.
- Read the tier at request time, so a promotion or demotion changes task rights immediately.

## Onboarding

When a new member picks projects during onboarding, the app only records their choice (`Member.wantsProjects`). It does not assign them a task. The project lead (or anyone with full task access) assigns the first task.

## Decided later

- 2026-10-24: GO! and Impact members **can** create tasks for themselves (Jure).
