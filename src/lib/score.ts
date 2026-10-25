// Performance score, decided by Jure on 2026-10-24 (docs/PERMISSIONS.md, docs/NEXT-team-page.md):
// finished task points (S/M/L = 1/3/8) + 5 per full weekly commitment met,
// hours judged against each member's own tier, over the last six weeks.

import type { Db, TaskSize } from "./types";
import type { Standing } from "./tiers";
import { addDays, weekStart } from "./dates";

export const TASK_POINTS: Record<TaskSize, number> = { S: 1, M: 3, L: 8 };
export const SIZE_LABEL: Record<TaskSize, string> = { S: "Small", M: "Medium", L: "Large" };
export const POINTS_PER_WEEK_MET = 5;
export const SCORE_WEEKS = 6;

export interface Score {
  total: number;
  taskPoints: number;
  hoursPoints: number;
  tasksDone: number;
  weeksMet: number;
  weeksCounted: number;
}

export function score(db: Db, s: Standing, today: string): Score {
  const from = addDays(weekStart(today), -7 * SCORE_WEEKS);
  const done = db.tasks.filter((t) => t.assigneeId === s.member.id && t.status === "done" && t.doneAt && t.doneAt >= from);
  const taskPoints = done.reduce((sum, t) => sum + TASK_POINTS[t.size ?? "M"], 0);
  // completed weeks only; pause weeks don't count either way
  const weeks = s.weeks.filter((w) => !w.current && !w.paused && w.weekStart >= from);
  const weeksMet = weeks.filter((w) => w.kept).length;
  const hoursPoints = weeksMet * POINTS_PER_WEEK_MET;
  return { total: taskPoints + hoursPoints, taskPoints, hoursPoints, tasksDone: done.length, weeksMet, weeksCounted: weeks.length };
}
