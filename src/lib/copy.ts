// Co–Star-style copy, written from live data. Short, direct, a little dry.
// Encourage, don't police: the hard numbers live in the admin view.

import type { Db, Meeting, Member, Task } from "./types";
import type { Standing } from "./tiers";
import { addDays, fmt, hoursLabel, weekStart } from "./dates";

const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];
const word = (n: number) => WORDS[n] ?? String(n);

function pick<T>(arr: T[], seed: string, n: number): T[] {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const out: T[] = [];
  const pool = [...arr];
  while (out.length < n && pool.length) {
    out.push(pool.splice(h % pool.length, 1)[0]);
    h = (h * 1103515245 + 12345) >>> 0;
  }
  return out;
}

function spoken(h: number): string {
  if (h <= 0.5) return "Half an hour";
  if (h <= 1) return "One hour";
  if (h % 1 === 0.5) return `${word(Math.floor(h)).replace(/^./, (c) => c.toUpperCase())} and a half hours`;
  return `${word(Math.round(h)).replace(/^./, (c) => c.toUpperCase())} hours`;
}

export function headline(s: Standing, clockedIn: boolean, today: string): string {
  const daysLeft = 6 - ((new Date(today + "T12:00:00Z").getUTCDay() + 6) % 7);
  if (clockedIn) return "This hour is already counting.";
  if (s.thisWeek === 0) return "The first hour is the hard one. Start it anyway.";
  if (s.toKeep === 0) {
    if (s.nextRule && s.thisWeek >= s.nextRule.weeklyHours) return `You worked an ${s.nextRule.id} week. Someone noticed.`;
    return s.streak >= 4 ? `Week ${s.streak} at ${s.member.tier}. Consistency is a personality.` : "Your week is already made. Anything more is a gift.";
  }
  if (s.toKeep <= 1.5) return `${spoken(s.toKeep)} stands between you and a ${word(s.streak + 1)}-week streak.`;
  if (daysLeft <= 1) return `${spoken(s.toKeep)} left and one day to find them. Choose the Hub.`;
  return `${spoken(s.toKeep)} this week. One good afternoon at the Hub.`;
}

export function nextMeeting(db: Db, memberId: string, now: Date): Meeting | undefined {
  return db.meetings
    .filter((m) => m.memberIds.includes(memberId) && new Date(m.end) > now)
    .sort((a, b) => a.start.localeCompare(b.start))[0];
}

export function myOpenTasks(db: Db, memberId: string): Task[] {
  return db.tasks
    .filter((t) => t.assigneeId === memberId && t.status !== "done")
    .sort((a, b) => (a.due ?? "9999").localeCompare(b.due ?? "9999"));
}

const shortTask = (t: Task) => t.title.split(" ").slice(0, 3).join(" ");

export function doDont(db: Db, s: Standing, now: Date, today: string): { do: string[]; dont: string[] } {
  const m = nextMeeting(db, s.member.id, now);
  const t = myOpenTasks(db, s.member.id)[0];
  const doList = [
    s.toKeep > 0 ? "The Hub, today" : "A slow extra hour",
    m ? `${m.series === "Community" ? "Community" : m.series}, ${fmt.dow(m.start).slice(0, 3).toLowerCase().replace(/^./, (c) => c.toUpperCase())}` : "Ask your buddy",
    t ? shortTask(t) : "Pick up a task",
  ];
  const dont = pick(
    ["Back-filling from memory", "Skipping Community", "Carrying it alone", "Ghosting your buddy", "Overpromising", "Silent absences", "Tasks without dates", "Meetings as hours"],
    today + s.member.id,
    3,
  );
  return { do: doList, dont };
}

export interface Line {
  e: string;
  pre: string;
  keys: { label: string; href: string }[];
}

export function emojiLines(db: Db, s: Standing, today: string): Line[] {
  const power: Line["keys"] = [];
  const pressure: Line["keys"] = [];
  const trouble: Line["keys"] = [];
  const tasks = myOpenTasks(db, s.member.id);
  const overdue = tasks.filter((t) => t.due && t.due < today);
  const soon = tasks.filter((t) => t.due && t.due >= today && t.due <= addDays(today, 7));
  const doneWeek = db.tasks.filter((t) => t.assigneeId === s.member.id && t.doneAt && t.doneAt >= weekStart(today));

  (s.toKeep === 0 ? power : s.avg4 < s.target * 0.75 ? trouble : pressure).push({ label: "hours", href: "/you?tab=chart" });
  (s.attendance.unexcused > 0 ? trouble : s.attendanceRate >= 0.9 ? power : pressure).push({ label: "meetings", href: "/you?tab=meetings" });
  if (overdue.length) trouble.push({ label: "deadlines", href: "/tasks" });
  else if (soon.length) pressure.push({ label: "this week's tasks", href: "/tasks" });
  if (doneWeek.length) power.push({ label: "finishing things", href: "/tasks" });
  if (s.streak >= 3) power.push({ label: "consistency", href: "/you?tab=chart" });
  if (s.member.buddyId) (s.toKeep > 0 && s.streak === 0 ? pressure : power).push({ label: "your buddy", href: `/team/${s.member.buddyId}` });

  const out: Line[] = [];
  if (power.length) out.push({ e: "🌱", pre: "Power in", keys: power });
  if (pressure.length) out.push({ e: "🔥", pre: "Pressure in", keys: pressure });
  if (trouble.length) out.push({ e: "🚫", pre: "Trouble with", keys: trouble });
  return out;
}

export function narrative(db: Db, s: Standing): string[] {
  const t = myOpenTasks(db, s.member.id)[0];
  const p1 =
    s.toKeep > 0
      ? `This week you've logged ${hoursLabel(s.thisWeek)} of your ${s.target}. You don't have to be heroic about the rest; you have to be at the Hub for ${hoursLabel(s.toKeep)}.`
      : `You've kept ${s.member.tier} this week with ${hoursLabel(s.thisWeek)}. Rest is part of the job. So is showing up next Monday.`;
  const p2 = t
    ? `Your nearest task is "${t.title}"${t.due ? `, due ${fmt.short(t.due)}` : ""}. Finish one thing before you start the next.`
    : "Nothing is assigned to you. That's a question to bring to your buddy, not a holiday.";
  const p3 = s.nextRule
    ? s.member.tier === "GO!"
      ? `Month ${Math.min(6, Math.max(1, Math.ceil(s.monthsInTier)))} of the six GO! months. Impact is a pace of ${s.nextRule.weeklyHours} h a week; leadership decides when you're there.`
      : `Core isn't a number. It's being recognised as the person who's always there.`
    : "You're Core. The tiers below are watching how you do it.";
  return [p1, p2, p3];
}

export function memberSummary(s: Standing, viewer: Member): string {
  const name = s.member.name.split(" ")[0];
  const you = viewer.id === s.member.id;
  const who = you ? "You" : name;
  const h = `${who} logged ${hoursLabel(s.thisWeek)} of ${s.target} this week`;
  const streak = s.streak > 0 ? `, on a ${s.streak}-week streak` : ", with no streak running";
  const trend = s.trend === "up" ? " The last two weeks are trending up." : s.trend === "down" ? " The last two weeks dipped." : "";
  const flag = s.flag === "dropping" ? ` ${you ? "You've" : name + " has"} been under target lately. A good moment to ask how it's going.` : s.flag === "moving-up" ? ` ${you ? "You're" : name + " is"} showing the pattern of the next tier.` : "";
  return `${h}${streak}.${trend}${flag}`;
}
