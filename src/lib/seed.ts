// Demo database: the hackathon sandbox (roster, hours, attendance, calendar)
// plus seed data the sandbox lacks (projects, tasks, join dates, buddies,
// onboarding). The backend replaces all of this.

import sandbox from "@/data/sandbox.json";
import { addDays } from "./dates";
import type { Db, Member, OnboardingStepId, Project, Series, SetupStepId, Task, TaskStatus, Priority } from "./types";

const AVATARS = ["bust", "stone", "apple", "moon", "dove", "hands", "compass", "sprout", "book", "key"];

// Join and tier dates are not in the sandbox; these are plausible seeds.
const TIER_SINCE: Record<string, string> = {
  "ana.kovac": "2023-09-01", "luka.novak": "2024-01-15", "maja.horvat": "2024-06-01",
  "ziga.krajnc": "2025-11-01", "nina.zupan": "2025-09-15", "jan.potocnik": "2026-01-10",
  "eva.vidmar": "2025-06-01", "matic.kos": "2026-03-01", "sara.mlakar": "2026-02-01",
  "rok.golob": "2025-10-01", "zala.turk": "2026-06-01", "nejc.kralj": "2026-07-01",
  "tjasa.bozic": "2026-09-01", "aljaz.hribar": "2026-05-15", "petra.jerman": "2026-04-27",
  "blaz.bizjak": "2026-06-15", "katja.lesjak": "2026-08-01", "urban.petek": "2026-09-01",
  "neza.oblak": "2026-05-01", "filip.rozman": "2026-07-15",
};

const BUDDY: Record<string, string> = {
  "zala.turk": "rok.golob", "nejc.kralj": "nina.zupan", "tjasa.bozic": "luka.novak",
  "aljaz.hribar": "ziga.krajnc", "petra.jerman": "jan.potocnik", "blaz.bizjak": "maja.horvat",
  "katja.lesjak": "eva.vidmar", "urban.petek": "sara.mlakar", "neza.oblak": "rok.golob",
  "filip.rozman": "ana.kovac", "lea.zorman": "rok.golob", "tim.vrhovnik": "eva.vidmar",
};

const done = <K extends string>(ids: K[]) => Object.fromEntries(ids.map((i) => [i, true])) as Partial<Record<K, boolean>>;

const NEW_MEMBERS: Member[] = [
  {
    id: "lea.zorman", name: "Lea Zorman", email: "lea.zorman@sandbox.example", tier: "GO!", weeklyHours: 4,
    admin: false, series: ["Community", "Shapers Tech"], joined: "2026-10-12", tierSince: "2026-10-12",
    buddyId: "rok.golob", avatar: "sprout", seeded: true,
    onboarding: done(["values", "tiers", "contract", "email", "slack", "buddy", "first-hour"]),
    onboardingProgressAt: "2026-10-14", // stalled: her buddy Rok gets the nudge
  },
  {
    id: "tim.vrhovnik", name: "Tim Vrhovnik", email: "tim.vrhovnik@sandbox.example", tier: "GO!", weeklyHours: 4,
    admin: false, series: ["Community", "Grants"], joined: "2026-10-19", tierSince: "2026-10-19",
    buddyId: "eva.vidmar", avatar: "key", seeded: true,
    onboarding: done(["values", "tiers"]),
    onboardingProgressAt: "2026-10-21",
  },
  {
    id: "mia.kranjc", name: "Mia Kranjc", email: "mia.kranjc@sandbox.example", tier: "GO!", weeklyHours: 4,
    admin: false, series: ["Community", "Shape Talks"], joined: "2026-09-28", tierSince: "2026-09-28",
    buddyId: "rok.golob", avatar: "dove", seeded: true,
    // every step done: her buddy Rok can propose ending onboarding
    onboarding: done(["values", "tiers", "contract", "email", "slack", "calendar", "buddy", "project", "first-hour", "first-task", "first-meeting"]),
    onboardingProgressAt: "2026-10-22",
  },
];

// Members who joined before the platform and are still on their three setup steps.
const SETUP: Record<string, SetupStepId[]> = { "zala.turk": ["confirm-tier"], "nejc.kralj": [] };

const PROJECTS: Project[] = [
  { id: "summer-school", name: "Summer School 2027", series: "Summer School", leadId: "luka.novak", description: "Programme, venue and mentors for next summer's school." },
  { id: "erasmus", name: "Erasmus+ KA2 application", series: "Grants", leadId: "ana.kovac", description: "Partnership application, due before the EU deadline." },
  { id: "mol-grant", name: "City of Ljubljana grant", series: "Grants", leadId: "jan.potocnik", description: "Youth programme call from the municipality." },
  { id: "talks-14", name: "Shape Talks #14", series: "Shape Talks", leadId: "eva.vidmar", description: "November evening of talks at Impact Hub." },
  { id: "speakers", name: "Speaker pipeline", series: "Shape Talks", leadId: "matic.kos", description: "A standing list of speakers for the next three events." },
  { id: "website", name: "Website rebuild", series: "Shapers Tech", leadId: "rok.golob", description: "New site with events, projects and a join form." },
  { id: "platform", name: "Coordination platform", series: "Shapers Tech", leadId: "maja.horvat", description: "This app: tasks, hours, attendance and tiers in one place." },
  { id: "podcast", name: "Podcast season 2", series: "Shapers Voice", leadId: "ziga.krajnc", description: "Eight episodes with alumni and partners." },
  { id: "newsletter", name: "Newsletter and Instagram", series: "Shapers Voice", leadId: "sara.mlakar", description: "Monthly newsletter and a weekly post rhythm." },
  { id: "community-night", name: "Community night", series: "Community", leadId: "ana.kovac", description: "December gathering for members, alumni and friends." },
];

type T = [string, string, string | null, TaskStatus, Priority, string | null, string | null];
// [project, title, assignee, status, priority, due, doneAt]
const TASKS: T[] = [
  ["summer-school", "Shortlist three venues", "luka.novak", "doing", "high", "2026-10-30", null],
  ["summer-school", "Draft the mentor call", "tjasa.bozic", "todo", "normal", "2026-11-06", null],
  ["summer-school", "Collect last year's feedback", "aljaz.hribar", "done", "normal", "2026-10-16", "2026-10-15"],
  ["summer-school", "Budget v1", "blaz.bizjak", "todo", "normal", "2026-11-13", null],
  ["erasmus", "Partner letters of intent", "ana.kovac", "doing", "high", "2026-10-28", null],
  ["erasmus", "Write the impact section", "katja.lesjak", "todo", "high", "2026-11-02", null],
  ["erasmus", "Budget table in the EU template", "filip.rozman", "review", "normal", "2026-11-04", null],
  ["erasmus", "Read the programme guide", "tim.vrhovnik", "todo", "normal", "2026-10-31", null],
  ["mol-grant", "Check eligibility criteria", "jan.potocnik", "done", "normal", "2026-10-10", "2026-10-09"],
  ["mol-grant", "Activity plan for 2027", "eva.vidmar", "todo", "normal", "2026-11-10", null],
  ["talks-14", "Confirm three speakers", "petra.jerman", "doing", "high", "2026-10-29", null],
  ["talks-14", "Book Impact Hub event room", "eva.vidmar", "done", "normal", "2026-10-20", "2026-10-19"],
  ["talks-14", "Event page and sign-up form", "petra.jerman", "todo", "normal", "2026-11-03", null],
  ["talks-14", "Speaker brief template", "petra.jerman", "done", "low", "2026-10-17", "2026-10-16"],
  ["speakers", "List 20 possible speakers", "matic.kos", "todo", "normal", "2026-11-07", null],
  ["speakers", "Outreach email draft", "jan.potocnik", "idea", "low", null, null],
  ["website", "Wireframes for the events page", "rok.golob", "review", "normal", "2026-10-30", null],
  ["website", "Collect project photos", "zala.turk", "todo", "normal", "2026-11-05", null],
  ["website", "Set up hosting", "nejc.kralj", "done", "normal", "2026-10-14", "2026-10-13"],
  ["website", "Write the About page", "lea.zorman", "todo", "normal", "2026-11-04", null],
  ["platform", "Import the roster", "maja.horvat", "done", "high", "2026-10-24", "2026-10-24"],
  ["platform", "Calendar connection", "nina.zupan", "doing", "high", "2026-10-25", null],
  ["platform", "Onboarding checklist copy", "urban.petek", "todo", "normal", "2026-10-31", null],
  ["podcast", "Record episode 1", "ziga.krajnc", "doing", "high", "2026-10-29", null],
  ["podcast", "Guest list for episodes 2–8", "neza.oblak", "todo", "normal", "2026-11-05", null],
  ["podcast", "Cover art", "sara.mlakar", "done", "low", "2026-10-12", "2026-10-11"],
  ["newsletter", "October newsletter", "sara.mlakar", "doing", "normal", "2026-10-31", null],
  ["newsletter", "Post: Shape Talks #14 teaser", "neza.oblak", "todo", "normal", "2026-10-27", null],
  ["community-night", "Pick a date", "ana.kovac", "done", "normal", "2026-10-15", "2026-10-14"],
  ["community-night", "Invite alumni", "luka.novak", "todo", "normal", "2026-11-14", null],
  ["community-night", "Catering quotes", null, "idea", "low", "2026-11-20", null],
  ["summer-school", "Partner with a hostel for housing", null, "idea", "normal", null, null],
  ["newsletter", "Monthly alumni spotlight", null, "idea", "low", null, null],
  ["talks-14", "Ask a sponsor for drinks", "eva.vidmar", "review", "low", "2026-10-26", null],
];

export function seedDb(): Db {
  const roster = (sandbox.members as Omit<Member, "joined" | "tierSince" | "buddyId" | "avatar" | "onboarding">[]).map(
    (m, i): Member => ({
      ...m,
      series: m.series as Series[],
      joined: TIER_SINCE[m.id] ?? "2026-01-01",
      tierSince: TIER_SINCE[m.id] ?? "2026-01-01",
      buddyId: BUDDY[m.id] ?? null,
      avatar: AVATARS[i % AVATARS.length],
      onboarding: null,
      ...(SETUP[m.id] ? { setup: done(SETUP[m.id]) } : {}),
    }),
  );
  const members = [...roster, ...NEW_MEMBERS];

  const tasks: Task[] = TASKS.map(([projectId, title, assigneeId, status, priority, due, doneAt], i) => ({
    id: `t${i + 1}`,
    projectId,
    title,
    notes: "",
    assigneeId,
    status,
    priority,
    size: priority === "high" ? "L" : priority === "low" ? "S" : i % 3 === 0 ? "L" : "M",
    start: due ? addDays(due, -(4 + (i % 4) * 3)) : null,
    due,
    doneAt,
    history: [
      { at: "2026-10-05T09:00:00Z", by: PROJECTS.find((p) => p.id === projectId)!.leadId, what: "created" },
      ...(doneAt ? [{ at: doneAt + "T15:00:00Z", by: assigneeId ?? "", what: "marked done" }] : []),
    ],
  }));

  return {
    members,
    hours: [
      ...sandbox.hours,
      { memberId: "lea.zorman", weekStart: "2026-10-12", hours: 2 },
      { memberId: "lea.zorman", weekStart: "2026-10-19", hours: 1.5 },
    ],
    attendance: sandbox.attendance as Db["attendance"],
    meetings: sandbox.meetings as Db["meetings"],
    projects: PROJECTS,
    tasks,
    sessions: [],
    pauses: [],
    backfills: [
      { id: "b1", memberId: "urban.petek", date: "2026-10-20", hours: 2, note: "Forgot to clock in at the hub on Tuesday.", status: "pending" },
    ],
    absences: [],
  };
}

/** No onboarding progress for this many days nudges the buddy. */
export const STALL_DAYS = 7;

export const SETUP_STEPS: { id: SetupStepId; title: string; line: string; auto?: boolean }[] = [
  { id: "confirm-tier", title: "Check your tier and hours", line: "What we have on file for you." },
  { id: "projects", title: "Pick your projects", line: "So your leads can find you." },
  { id: "first-hour", title: "Clock your first hour here", line: "One tap at Impact Hub.", auto: true },
];

export const ONBOARDING_STEPS: { id: OnboardingStepId; group: string; title: string; line: string; auto?: boolean }[] = [
  { id: "values", group: "Meeting one · values and rules", title: "Read what Shapers stands for", line: "Values, and the rules everyone keeps." },
  { id: "tiers", group: "Meeting one · values and rules", title: "Learn how tiers work", line: "GO!, Impact, Core, and what each asks of you." },
  { id: "contract", group: "Meeting two · tools and project", title: "Sign your contract", line: "One page. Your buddy has it." },
  { id: "email", group: "Meeting two · tools and project", title: "Get your Shapers email", line: "Your address on the organisation's domain." },
  { id: "slack", group: "Meeting two · tools and project", title: "Join Slack", line: "Where absences are announced." },
  { id: "calendar", group: "Meeting two · tools and project", title: "Subscribe to the calendar", line: "Every meeting, read from Google Calendar." },
  { id: "buddy", group: "Meeting two · tools and project", title: "Meet your buddy", line: "Twenty minutes, every week." },
  { id: "project", group: "Meeting two · tools and project", title: "Pick your first project", line: "Where your hours will go." },
  { id: "first-hour", group: "Your first weeks", title: "Clock your first hour", line: "At Impact Hub. One tap.", auto: true },
  { id: "first-task", group: "Your first weeks", title: "Finish your first task", line: "Anything. Small is fine.", auto: true },
  { id: "first-meeting", group: "Your first weeks", title: "Attend your first meeting", line: "Clock in when it starts.", auto: true },
];
