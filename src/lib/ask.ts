// "Ask" answers, worked out from the member's own data and the tier rules.
// Placeholder for the backend's agent ("Jarvis"): same question in, same
// { context, answer } shape out.

import type { Db, Member } from "./types";
import type { Standing } from "./tiers";
import { tierRule, COMMUNITY_NOTICE_H, PROJECT_NOTICE_H } from "./tiers";
import { addDays, fmt, hoursLabel } from "./dates";
import { myOpenTasks, nextMeeting } from "./copy";

export type Category = "hours" | "tasks" | "meetings" | "tiers";

export const QUESTIONS: Record<Category, string[]> = {
  hours: ["Am I on track this week?", "How long is my streak?", "Log 2 hours yesterday", "What happens if I go on a pause?"],
  tasks: ["What should I do next?", "What's overdue?", "Who leads my projects?"],
  meetings: ["When is my next meeting?", "How do I announce an absence?", "What's my attendance like?", "What if I miss Community?"],
  tiers: ["When could I become Impact?", "What does my tier ask of me?", "How is Core different?", "Who is my buddy?"],
};

export interface Answer {
  context: string; // the "transiting Jupiter" cell: what the answer is based on
  text: string;
  action?: { kind: "log"; date: string; hours: number };
}

export function answer(q: string, db: Db, me: Member, s: Standing, today: string, now: Date): Answer {
  const x = q.toLowerCase();
  const rule = tierRule(me.tier);

  const log = x.match(/log\s+(\d+(?:[.,]\d+)?)\s*h(?:ours?)?\s*(today|yesterday)?/);
  if (log) {
    const hours = parseFloat(log[1].replace(",", "."));
    const date = log[2] === "yesterday" ? addDays(today, -1) : today;
    return {
      context: `Logging for ${fmt.weekday(date)} ${fmt.short(date)}`,
      text: `${hoursLabel(hours)} for ${log[2] ?? "today"}. Confirm below and it lands in your week straight away. Anything older than yesterday goes to an admin for approval.`,
      action: { kind: "log", date, hours },
    };
  }
  if (/on track|behind|this week|enough/.test(x)) {
    return {
      context: `${hoursLabel(s.thisWeek)} of ${s.target} h · ${me.tier}`,
      text: s.toKeep === 0
        ? `Yes. You've logged ${hoursLabel(s.thisWeek)} against your ${s.target}. Your week is made, and your streak moves to ${s.streak}.`
        : `You've logged ${hoursLabel(s.thisWeek)} of ${s.target}. ${hoursLabel(s.toKeep)} to go before Sunday. One afternoon at the Hub does it. Your four-week average is ${hoursLabel(s.avg4)}.`,
    };
  }
  if (/streak/.test(x)) {
    return {
      context: `${s.weeks.length} weeks of hours`,
      text: s.streak ? `${s.streak} week${s.streak === 1 ? "" : "s"} in a row at ${s.target} h or more. Pause weeks hold the streak; they never break it.` : `No streak running. It starts the first week you reach ${s.target} h.`,
    };
  }
  if (/pause/.test(x)) {
    return { context: `Pause rule · ${me.tier}`, text: `${rule.pause} During a pause your hours don't count as a shortfall and your streak waits for you. Request one in You → Settings.` };
  }
  if (/next|do now|should i do/.test(x) && !/meeting/.test(x)) {
    const t = myOpenTasks(db, me.id)[0];
    if (!t) return { context: "0 open tasks", text: "Nothing is assigned to you. Pick something up on the Tasks board, or ask your buddy where help is needed." };
    const p = db.projects.find((p) => p.id === t.projectId)!;
    return { context: `${myOpenTasks(db, me.id).length} open tasks`, text: `"${t.title}" for ${p.name}${t.due ? `, due ${fmt.short(t.due)}` : ""}. It's the nearest deadline you have. Finish it before starting anything new.` };
  }
  if (/overdue|late/.test(x)) {
    const late = myOpenTasks(db, me.id).filter((t) => t.due && t.due < today);
    return { context: `Deadlines before ${fmt.short(today)}`, text: late.length ? `${late.length} overdue: ${late.map((t) => `"${t.title}"`).join(", ")}. Move the date or hand it over; both are better than silence.` : "Nothing overdue. Rare. Enjoy it." };
  }
  if (/lead/.test(x)) {
    const ps = Array.from(new Set(myOpenTasks(db, me.id).map((t) => t.projectId))).map((id) => db.projects.find((p) => p.id === id)!);
    return { context: `${ps.length} projects`, text: ps.length ? ps.map((p) => `${p.name}: ${db.members.find((m) => m.id === p.leadId)?.name}`).join(". ") + "." : "You're not on a project yet." };
  }
  if (/next meeting|when is/.test(x)) {
    const m = nextMeeting(db, me.id, now);
    return { context: "Read from Google Calendar", text: m ? `${m.series}, ${fmt.weekday(m.start)} ${fmt.short(m.start)} at ${fmt.time(m.start)}, ${m.location}. Clock in when it starts. Meetings don't count as hours.` : "Nothing on the calendar for you." };
  }
  if (/absence|announce|can't make/.test(x)) {
    return { context: `Absence rule · ${me.tier}`, text: `Say it on Slack: at least ${COMMUNITY_NOTICE_H} h before a Community meeting, ${PROJECT_NOTICE_H} h before a project meeting. Tap "I can't make it" on the meeting so it counts as excused.` };
  }
  if (/attendance/.test(x)) {
    const a = s.attendance;
    return { context: `${a.present + a.remote + a.excused + a.unexcused} meetings recorded`, text: `${a.present} in person, ${a.remote} remote, ${a.excused} excused, ${a.unexcused} unexcused. That's ${Math.round(s.attendanceRate * 100)}% attended.` };
  }
  if (/miss community/.test(x)) {
    return { context: `Community rule · ${me.tier}`, text: `${rule.community} ${me.tier === "GO!" ? rule.consequence : ""}`.trim() };
  }
  if (/impact|promot|next tier|move up|become/.test(x)) {
    if (!s.nextRule) return { context: "Core", text: "You're at the top. The tiers below learn from how you do it." };
    if (me.tier === "Impact") return { context: "Impact → Core", text: "Core is by leadership recognition, not a clock: being there every day and carrying the vision. Keep doing what you do." };
    const months = s.monthsInTier;
    return {
      context: `Month ${Math.max(1, Math.ceil(Math.min(6, months)))} of 6 in GO!`,
      text: `GO! lasts at least six months; yours ${months >= 6 ? "are done" : `run to ${fmt.monthDay(addDays(me.tierSince, 183))}`}. Leadership looks for steady hours (${Math.round(s.consistency * 100)}% of your weeks at target so far), showing up, and taking on more. Impact means ${s.nextRule.weeklyHours} h a week. They decide; this is just where you stand.`,
    };
  }
  if (/core/.test(x)) {
    const c = tierRule("Core");
    return { context: "Shapers Core", text: `${c.who} ${c.presence}. You get there by recognition, not by hours alone.` };
  }
  if (/tier|ask of me|rules/.test(x)) {
    return { context: rule.name, text: `${rule.presence}. ${rule.community} Notice period: ${rule.notice}.` };
  }
  if (/buddy/.test(x)) {
    const b = db.members.find((m) => m.id === me.buddyId);
    return { context: "Onboarding", text: b ? `${b.name}. Twenty minutes a week, and the first person to ask about anything.` : "You don't have a buddy assigned. Ask an admin." };
  }
  return {
    context: "Your data and the tier rules",
    text: "I only know your hours, tasks, meetings and the tier rules. Try one of the questions above, or something like \"log 2 hours yesterday\".",
  };
}
