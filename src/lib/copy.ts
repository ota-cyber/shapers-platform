// Co–Star-style copy, written from live data. Short, direct, a little dry.
// Encourage, don't police: the hard numbers live in the admin view.

import type { Db, Meeting, Member, Task } from "./types";
import type { Standing } from "./tiers";
import { hoursLabel } from "./dates";

const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];
const word = (n: number) => WORDS[n] ?? String(n);

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
