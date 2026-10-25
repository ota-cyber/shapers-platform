// Task permissions, as decided by Jure on 2026-10-24. The UI only hides what a
// person may not do; the backend must enforce the same rules (docs/PERMISSIONS.md).
//
// Two separate things:
// - Tier: Core members get full write access to tasks. Core does NOT make someone an admin.
// - Admin: a role chosen separately, unrelated to tier. Admins also get full task access,
//   plus the admin screens (Team, approvals, attendance recording, tier changes).

import type { Member, Task } from "./types";

/** Full write access to every task and project: Core tier, or the admin role. */
export const canManageTasks = (m: Member) => m.tier === "Core" || m.admin;

export interface TaskRights {
  /** status, dates, length, priority, notes */
  edit: boolean;
  /** hand to someone else or unassign */
  reassign: boolean;
  /** move to another project (any tier, own tasks; decided 2026-10-25) */
  move: boolean;
}

export function taskRights(me: Member, t: Task): TaskRights {
  if (canManageTasks(me)) return { edit: true, reassign: true, move: true };
  // Everyone can move their own tasks anywhere on the board (status and project); only reassigning stays restricted.
  const mine = t.assigneeId === me.id;
  return { edit: mine, reassign: false, move: mine };
}

/** Everyone can create tasks; GO! and Impact members only for themselves (assignee is forced to them). */
export const canCreateTasks = () => true;

/** Who a new task may be assigned to at creation. */
export const canAssignOthers = (me: Member) => canManageTasks(me);

/** Creating projects needs full task access. */
export const canCreateProjects = (me: Member) => canManageTasks(me);
