// Tier rules live in data, not code: leadership can change these numbers.
// Source: Nik's tier email (2026-10-24) + sandbox README. See the wiki,
// organization/membership-tiers.md, for the open contradictions.

import type { Attendance, Db, Member, TierId } from "./types";
import { addDays, daysBetween, weekStart } from "./dates";

export interface TierRule {
  id: TierId;
  name: string;
  glyph: string;
  weeklyHours: number;
  who: string;
  presence: string;
  notice: string;
  pause: string;
  community: string;
  absence: string;
  consequence: string;
  /** months in tier before the next tier is usually considered */
  monthsToNext: number | null;
  next: TierId | null;
}

export const TIERS: TierRule[] = [
  {
    id: "GO!",
    name: "Shapers GO!",
    glyph: "⊙",
    weeklyHours: 4,
    who: "New members who are reliable and take responsibility for tasks and projects.",
    presence: "4 h a week at the office",
    notice: "1 month",
    pause: "Short periods only, agreed with your buddy. Missed time is made up.",
    community: "Mandatory, in person. Remote only when ill or travelling.",
    absence: "Community: on Slack at least 72 h before. Project meetings: at least 24 h before.",
    consequence: "Each missed Community meeting: one general task within 14 days, and read the minutes.",
    monthsToNext: 6,
    next: "Impact",
  },
  {
    id: "Impact",
    name: "Shapers Impact",
    glyph: "☽",
    weeklyHours: 10,
    who: "Members who have proven themselves on several projects and know the culture.",
    presence: "10 h a week at the office",
    notice: "2 months",
    pause: "Up to 6 weeks a year in total, announced in advance.",
    community: "May miss 3 a year, never two in a row. A team lead attends or sends someone who reports.",
    absence: "Not defined",
    consequence: "Not defined",
    monthsToNext: null,
    next: "Core",
  },
  {
    id: "Core",
    name: "Shapers Core",
    glyph: "↑",
    weeklyHours: 70,
    who: "The team dedicated to the organisation and its vision every day.",
    presence: "A full working week, weekends if needed",
    notice: "3 months",
    pause: "Not defined",
    community: "Not defined",
    absence: "Not defined",
    consequence: "Not defined",
    monthsToNext: null,
    next: null,
  },
];

export const tierRule = (id: TierId) => TIERS.find((t) => t.id === id)!;

// Backend mode loads these from the tiers table (applyRules in backend.ts).
export let COMMUNITY_NOTICE_H = 72;
export let PROJECT_NOTICE_H = 24;
export function setNoticeHours(community: number, project: number) {
  COMMUNITY_NOTICE_H = community;
  PROJECT_NOTICE_H = project;
}

export interface WeekRow {
  weekStart: string;
  hours: number;
  target: number;
  kept: boolean;
  paused: boolean;
  current: boolean;
}

export interface Standing {
  member: Member;
  rule: TierRule;
  nextRule: TierRule | null;
  thisWeek: number;
  target: number;
  toKeep: number;
  toNextPace: number | null;
  weeks: WeekRow[];
  streak: number;
  avg4: number;
  consistency: number; // share of completed weeks at target
  monthsInTier: number;
  attendanceRate: number; // attended (present + remote) of all recorded
  attendance: Record<string, number>;
  readiness: { time: boolean; hours: boolean; attendance: boolean };
  trend: "up" | "steady" | "down";
  /** what the admin view flags */
  flag: "moving-up" | "dropping" | null;
}

export function isPaused(db: Db, memberId: string, week: string): boolean {
  return db.pauses.some(
    (p) => p.memberId === memberId && p.status === "approved" && p.from <= addDays(week, 6) && p.to >= week,
  );
}

export function sessionHours(db: Db, memberId: string, now: Date): number {
  const s = db.sessions.find((x) => x.memberId === memberId);
  if (!s) return 0;
  return Math.max(0, (now.getTime() - new Date(s.start).getTime()) / 3_600_000);
}

export function standing(db: Db, member: Member, today: string, now: Date): Standing {
  const rule = tierRule(member.tier);
  const nextRule = rule.next ? tierRule(rule.next) : null;
  const target = member.weeklyHours;
  const thisWeekStart = weekStart(today);

  const mine = db.hours.filter((h) => h.memberId === member.id).sort((a, b) => a.weekStart.localeCompare(b.weekStart));
  const weeks: WeekRow[] = mine.map((h) => {
    const current = h.weekStart === thisWeekStart;
    const hours = h.hours + (current ? sessionHours(db, member.id, now) : 0);
    const paused = isPaused(db, member.id, h.weekStart);
    return { weekStart: h.weekStart, hours, target, kept: hours >= target, paused, current };
  });
  if (!weeks.some((w) => w.current)) {
    const hours = sessionHours(db, member.id, now);
    weeks.push({ weekStart: thisWeekStart, hours, target, kept: hours >= target, paused: isPaused(db, member.id, thisWeekStart), current: true });
  }

  const done = weeks.filter((w) => !w.current && w.weekStart < thisWeekStart);
  const cur = weeks.find((w) => w.current)!;

  // Streak: completed weeks at target, newest first. Pause weeks never break it.
  let streak = 0;
  for (let i = done.length - 1; i >= 0; i--) {
    if (done[i].paused) continue;
    if (done[i].kept) streak++;
    else break;
  }
  if (cur.kept) streak++;

  const last4 = done.slice(-4);
  const avg4 = last4.length ? last4.reduce((s, w) => s + w.hours, 0) / last4.length : cur.hours;
  const counted = done.filter((w) => !w.paused);
  const consistency = counted.length ? counted.filter((w) => w.kept).length / counted.length : 0;

  const att: Record<string, number> = { present: 0, remote: 0, excused: 0, unexcused: 0 };
  db.attendance.filter((a) => a.memberId === member.id).forEach((a) => att[a.state]++);
  const recorded = att.present + att.remote + att.excused + att.unexcused;
  const attendanceRate = recorded ? (att.present + att.remote) / recorded : 1;

  const monthsInTier = daysBetween(member.tierSince, today) / 30.44;
  const readiness = {
    time: rule.monthsToNext ? monthsInTier >= rule.monthsToNext : false,
    hours: consistency >= 0.8,
    attendance: att.unexcused === 0 && attendanceRate >= 0.8,
  };

  const prev2 = done.slice(-2).filter((w) => !w.paused);
  const recent = done.slice(-2).reduce((s, w) => s + w.hours, 0) / Math.max(1, done.slice(-2).length);
  const earlier = done.slice(-4, -2).reduce((s, w) => s + w.hours, 0) / Math.max(1, done.slice(-4, -2).length);
  const trend = recent > earlier * 1.1 ? "up" : recent < earlier * 0.9 ? "down" : "steady";

  let flag: Standing["flag"] = null;
  if (prev2.length === 2 && prev2.every((w) => !w.kept)) flag = "dropping";
  else if (avg4 < target * 0.75 && done.length >= 2) flag = "dropping";
  // Within a month of the tier clock counts, so leadership sees people coming up before the date.
  const nearlyTime = rule.monthsToNext !== null && monthsInTier >= rule.monthsToNext - 1;
  if (!flag && nextRule && readiness.hours && readiness.attendance && (nearlyTime || avg4 >= nextRule.weeklyHours)) flag = "moving-up";

  return {
    member,
    rule,
    nextRule,
    thisWeek: cur.hours,
    target,
    toKeep: Math.max(0, target - cur.hours),
    toNextPace: nextRule ? Math.max(0, nextRule.weeklyHours - cur.hours) : null,
    weeks,
    streak,
    avg4,
    consistency,
    monthsInTier,
    attendanceRate,
    attendance: att,
    readiness,
    trend,
    flag,
  };
}

export interface Badge {
  id: string;
  name: string;
  line: string;
  earned: boolean;
  image: string;
}

export function badges(db: Db, s: Standing): Badge[] {
  const id = s.member.id;
  const tasksDone = db.tasks.filter((t) => t.assigneeId === id && t.status === "done").length;
  const attended = s.attendance.present + s.attendance.remote;
  return [
    { id: "first-hour", name: "First hour", line: "You clocked in. It counts.", earned: s.weeks.some((w) => w.hours > 0), image: "stopwatch" },
    { id: "first-task", name: "First task", line: "Something moved because of you.", earned: tasksDone > 0, image: "pencil" },
    { id: "streak-4", name: "Four weeks", line: "A month at your tier, no gaps.", earned: s.streak >= 4, image: "stone" },
    { id: "streak-8", name: "Eight weeks", line: "Two months. Now it's a habit.", earned: s.streak >= 8, image: "moon" },
    { id: "full-house", name: "Full house", line: "Ten meetings attended.", earned: attended >= 10, image: "chair" },
    { id: "clean-record", name: "Clean record", line: "No unexcused absence.", earned: attended > 0 && s.attendance.unexcused === 0, image: "dove" },
  ];
}

export function attendanceFor(db: Db, memberId: string): Attendance[] {
  return db.attendance.filter((a) => a.memberId === memberId).sort((a, b) => b.date.localeCompare(a.date));
}
