"use client";

// Frontend-only store. Every exported action is one backend call later;
// see docs/FRONTEND.md for the mapping. State persists in localStorage so the
// demo survives a reload.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { AttendanceState, TaskSize, Db, Member, OnboardingStepId, Priority, Project, SetupStepId, Task, TaskStatus } from "./types";
import { seedDb, ONBOARDING_STEPS, SETUP_STEPS, STALL_DAYS } from "./seed";
import { addDays, isoDate, weekStart } from "./dates";
import { standing, type Standing, COMMUNITY_NOTICE_H, PROJECT_NOTICE_H } from "./tiers";

const KEY = "shapers-ui-v5";
const BLOCK_MS = 3_600_000;
const PROMPT_BEFORE_MS = 5 * 60_000;

interface Prefs {
  meId: string;
  /** demo switch: treat the next meeting as live so meeting clock-in can be shown */
  liveMeeting: boolean;
}

interface Ctx {
  db: Db;
  prefs: Prefs;
  now: Date;
  today: string;
  me: Member;
  my: Standing;
  member: (id: string | null) => Member | undefined;
  standingOf: (id: string) => Standing;
  stillWorkingDue: boolean;
  setPrefs: (p: Partial<Prefs>) => void;
  reset: () => void;
  clockIn: (taskId: string | null) => void;
  stillWorking: () => void;
  clockOut: () => void;
  logHours: (date: string, hours: number, note?: string) => "logged" | "requested";
  resolveBackfill: (id: string, approve: boolean) => void;
  updateTask: (id: string, patch: Partial<Task>, what: string) => void;
  addTask: (t: { projectId: string; title: string; assigneeId: string | null; due: string | null; priority: Priority; status?: TaskStatus; start?: string | null; size?: TaskSize }) => void;
  moveTask: (id: string, to: { status?: TaskStatus; projectId?: string; assigneeId?: string | null }) => void;
  setTaskDates: (id: string, start: string, due: string) => void;
  addProject: (p: Omit<Project, "id">) => void;
  meetingClockIn: (meetingId: string, state: "present" | "remote") => void;
  recordAttendance: (meetingId: string, memberId: string, state: AttendanceState) => void;
  announceAbsence: (meetingId: string) => boolean;
  completeStep: (memberId: string, step: OnboardingStepId, value?: boolean) => void;
  joinProject: (memberId: string, projectId: string) => void;
  requestPause: (from: string, to: string, reason: string) => void;
  resolvePause: (id: string, approve: boolean) => void;
  setTier: (memberId: string, tier: Member["tier"]) => void;
  addMember: (m: { name: string; email: string; buddyId: string | null; series: Member["series"] }) => void;
  importRoster: (rows: RosterRow[]) => { added: number; skipped: number };
  completeSetup: (memberId: string, step: SetupStepId, value?: boolean) => void;
  proposeGraduation: (memberId: string) => void;
  resolveGraduation: (memberId: string, approve: boolean) => void;
  liveMeetingId: string | null;
  onboardingDone: (m: Member) => Record<OnboardingStepId, boolean>;
  /** null when the member has nothing to set up */
  setupDone: (m: Member) => Record<SetupStepId, boolean> | null;
  /** days without onboarding progress, once that reaches STALL_DAYS; null otherwise */
  stalledDays: (m: Member) => number | null;
}

export interface RosterRow {
  name: string;
  email: string;
  tier: Member["tier"];
  /** ISO date the member reached their current tier; defaults to today */
  tierSince?: string;
}

const WEEKLY: Record<Member["tier"], number> = { "GO!": 4, Impact: 10, Core: 70 };

const AppCtx = createContext<Ctx | null>(null);

export function useApp(): Ctx {
  const c = useContext(AppCtx);
  if (!c) throw new Error("useApp outside provider");
  return c;
}

const uid = () => Math.random().toString(36).slice(2, 9);
const AVATARS = ["bust", "stone", "apple", "moon", "dove", "hands", "compass", "sprout", "book", "key"];

function load(): { db: Db; prefs: Prefs } {
  const fresh = { db: seedDb(), prefs: { meId: "petra.jerman", liveMeeting: false } };
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...fresh, ...JSON.parse(raw) };
  } catch {}
  return fresh;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<{ db: Db; prefs: Prefs } | null>(null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    setState(load());
    const t = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!state) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {}
  }, [state]);

  const mutate = useCallback((fn: (db: Db, prefs: Prefs) => void) => {
    setState((s) => {
      if (!s) return s;
      const db = structuredClone(s.db);
      const prefs = { ...s.prefs };
      fn(db, prefs);
      return { db, prefs };
    });
  }, []);

  // A block that ran out without "still working?" closes at the end of the block.
  const closing = useRef(false);
  useEffect(() => {
    if (!state || closing.current) return;
    const expired = state.db.sessions.filter((s) => new Date(s.blockEnd) <= now);
    if (!expired.length) return;
    closing.current = true;
    mutate((db) => {
      for (const s of expired) finishSession(db, s.memberId, new Date(s.blockEnd));
    });
    closing.current = false;
  }, [now, state, mutate]);

  const value = useMemo<Ctx | null>(() => {
    if (!state) return null;
    const { db, prefs } = state;
    const today = isoDate(now);
    const member = (id: string | null) => db.members.find((m) => m.id === id);
    const me = member(prefs.meId) ?? db.members[0];
    const standingOf = (id: string) => standing(db, member(id)!, today, now);
    const session = db.sessions.find((s) => s.memberId === me.id);
    const stillWorkingDue = !!session && new Date(session.blockEnd).getTime() - now.getTime() <= PROMPT_BEFORE_MS;

    const upcoming = db.meetings.filter((m) => new Date(m.end) > now).sort((a, b) => a.start.localeCompare(b.start));
    // A meeting is live only while it is going on: from its start to its end.
    const realLive = upcoming.find((m) => new Date(m.start) <= now && m.memberIds.includes(me.id));
    const liveMeetingId = realLive?.id ?? (prefs.liveMeeting ? (upcoming.find((m) => m.memberIds.includes(me.id))?.id ?? null) : null);

    const onboardingDone = (m: Member) => {
      const auto: Partial<Record<OnboardingStepId, boolean>> = {
        "first-hour": db.hours.some((h) => h.memberId === m.id && h.hours > 0),
        "first-task": db.tasks.some((t) => t.assigneeId === m.id && t.status === "done"),
        "first-meeting": db.attendance.some((a) => a.memberId === m.id && (a.state === "present" || a.state === "remote")),
        project: db.tasks.some((t) => t.assigneeId === m.id),
      };
      return Object.fromEntries(
        ONBOARDING_STEPS.map((s) => [s.id, !!(m.onboarding?.[s.id] || auto[s.id])]),
      ) as Record<OnboardingStepId, boolean>;
    };
    const setupDone = (m: Member) => {
      if (!m.setup) return null;
      const firstHour = db.hours.some((h) => h.memberId === m.id && h.hours > 0) || db.sessions.some((x) => x.memberId === m.id);
      return Object.fromEntries(SETUP_STEPS.map((s) => [s.id, !!(m.setup?.[s.id] || (s.id === "first-hour" && firstHour))])) as Record<SetupStepId, boolean>;
    };
    const stalledDays = (m: Member) => {
      if (m.onboarding === null || m.graduation || Object.values(onboardingDone(m)).every(Boolean)) return null;
      const days = Math.floor((new Date(today).getTime() - new Date(m.onboardingProgressAt ?? m.joined).getTime()) / 864e5);
      return days >= STALL_DAYS ? days : null;
    };

    return {
      db,
      prefs,
      now,
      today,
      me,
      my: standing(db, me, today, now),
      member,
      standingOf,
      stillWorkingDue,
      liveMeetingId,
      onboardingDone,
      setupDone,
      stalledDays,
      setPrefs: (p) => setState((s) => (s ? { ...s, prefs: { ...s.prefs, ...p } } : s)),
      reset: () => setState({ db: seedDb(), prefs }),
      clockIn: (taskId) =>
        mutate((db) => {
          if (db.sessions.some((s) => s.memberId === me.id)) return;
          db.sessions.push({ memberId: me.id, start: now.toISOString(), blockEnd: new Date(now.getTime() + BLOCK_MS).toISOString(), taskId });
        }),
      stillWorking: () =>
        mutate((db) => {
          const s = db.sessions.find((x) => x.memberId === me.id);
          if (s) s.blockEnd = new Date(new Date(s.blockEnd).getTime() + BLOCK_MS).toISOString();
        }),
      clockOut: () => mutate((db) => finishSession(db, me.id, now)),
      logHours: (date, hours, note = "") => {
        const yesterday = addDays(today, -1);
        if (date >= yesterday) {
          mutate((db) => addHours(db, me.id, date, hours));
          return "logged";
        }
        mutate((db) => db.backfills.push({ id: uid(), memberId: me.id, date, hours, note, status: "pending" }));
        return "requested";
      },
      resolveBackfill: (id, approve) =>
        mutate((db) => {
          const b = db.backfills.find((x) => x.id === id);
          if (!b || b.status !== "pending") return;
          b.status = approve ? "approved" : "declined";
          if (approve) addHours(db, b.memberId, b.date, b.hours);
        }),
      updateTask: (id, patch, what) =>
        mutate((db) => {
          const t = db.tasks.find((x) => x.id === id);
          if (!t) return;
          Object.assign(t, patch);
          if (patch.status) t.doneAt = patch.status === "done" ? now.toISOString().slice(0, 10) : null;
          t.history.push({ at: now.toISOString(), by: me.id, what });
        }),
      addTask: (t) =>
        mutate((db) =>
          db.tasks.push({
            id: uid(), notes: "", doneAt: null, ...t, size: t.size ?? "M", status: t.status ?? "todo", start: t.start ?? (t.due ? addDays(t.due, -5) : null),
            history: [{ at: now.toISOString(), by: me.id, what: "created" }],
          }),
        ),
      addProject: (p) => mutate((db) => db.projects.push({ ...p, id: uid() })),
      moveTask: (id, to) =>
        mutate((db) => {
          const t = db.tasks.find((x) => x.id === id);
          if (!t) return;
          const what: string[] = [];
          if (to.status && to.status !== t.status) {
            what.push(`moved to ${STATUS_LABEL[to.status]}`);
            t.status = to.status;
            t.doneAt = to.status === "done" ? now.toISOString().slice(0, 10) : null;
          }
          if (to.projectId && to.projectId !== t.projectId) {
            what.push(`moved to ${db.projects.find((p) => p.id === to.projectId)?.name}`);
            t.projectId = to.projectId;
          }
          if (to.assigneeId !== undefined && to.assigneeId !== t.assigneeId) {
            what.push(to.assigneeId ? `handed to ${db.members.find((m) => m.id === to.assigneeId)?.name}` : "unassigned");
            t.assigneeId = to.assigneeId;
          }
          if (what.length) t.history.push({ at: now.toISOString(), by: me.id, what: what.join(", ") });
        }),
      setTaskDates: (id, start, due) =>
        mutate((db) => {
          const t = db.tasks.find((x) => x.id === id);
          if (!t || (t.start === start && t.due === due)) return;
          t.start = start;
          t.due = due;
          t.history.push({ at: now.toISOString(), by: me.id, what: `dates ${start} → ${due}` });
        }),
      meetingClockIn: (meetingId, state) =>
        mutate((db) => setAttendance(db, meetingId, me.id, state)),
      recordAttendance: (meetingId, memberId, state) =>
        mutate((db) => {
          setAttendance(db, meetingId, memberId, state);
          const m = db.meetings.find((x) => x.id === meetingId)!;
          const who = db.members.find((x) => x.id === memberId)!;
          // GO! rule: a missed Community meeting creates one general task within 14 days.
          const date = isoDate(new Date(m.start));
          const title = `Read the Community minutes (${date})`;
          if (state === "unexcused" && m.series === "Community" && who.tier === "GO!" && !db.tasks.some((t) => t.title === title && t.assigneeId === memberId)) {
            db.tasks.push({
              id: uid(), projectId: "community-night", title, notes: "Missed Community meeting: read the minutes and pick up one general task within 14 days.",
              assigneeId: memberId, status: "todo", priority: "normal", size: "S", start: date, due: addDays(date, 14), doneAt: null,
              history: [{ at: now.toISOString(), by: "rules", what: "created by the GO! absence rule" }],
            });
          }
        }),
      announceAbsence: (meetingId) => {
        const m = db.meetings.find((x) => x.id === meetingId)!;
        const hoursAhead = (new Date(m.start).getTime() - now.getTime()) / 3_600_000;
        const excused = hoursAhead >= (m.series === "Community" ? COMMUNITY_NOTICE_H : PROJECT_NOTICE_H);
        mutate((db) => {
          db.absences = db.absences.filter((a) => !(a.memberId === me.id && a.meetingId === meetingId));
          db.absences.push({ memberId: me.id, meetingId, at: now.toISOString(), excused });
        });
        return excused;
      },
      completeStep: (memberId, step, v = true) =>
        mutate((db) => {
          const m = db.members.find((x) => x.id === memberId)!;
          if (m.onboarding === null) return; // existing members aren't onboarding; never switch them into it
          m.onboarding = { ...m.onboarding, [step]: v };
          if (v) m.onboardingProgressAt = today;
        }),
      // Records interest only. Members can't pick up tasks themselves; the project lead assigns the first one.
      joinProject: (memberId, projectId) =>
        mutate((db) => {
          const m = db.members.find((x) => x.id === memberId)!;
          m.wantsProjects = Array.from(new Set([...(m.wantsProjects ?? []), projectId]));
          if (m.onboarding !== null) {
            m.onboarding = { ...m.onboarding, project: true };
            m.onboardingProgressAt = today;
          }
          if (m.setup) m.setup = { ...m.setup, projects: true };
        }),
      requestPause: (from, to, reason) =>
        mutate((db) => db.pauses.push({ id: uid(), memberId: me.id, from, to, reason, status: "requested" })),
      resolvePause: (id, approve) =>
        mutate((db) => {
          if (approve) db.pauses.find((p) => p.id === id)!.status = "approved";
          else db.pauses = db.pauses.filter((p) => p.id !== id);
        }),
      setTier: (memberId, tier) =>
        mutate((db) => {
          const m = db.members.find((x) => x.id === memberId)!;
          m.tier = tier;
          m.weeklyHours = WEEKLY[tier];
          m.tierSince = today;
        }),
      addMember: ({ name, email, buddyId, series }) =>
        mutate((db) => {
          const id = email.split("@")[0] || uid();
          db.members.push({
            id, name, email, tier: "GO!", weeklyHours: 4, admin: false, series: ["Community", ...series.filter((s) => s !== "Community")],
            joined: today, tierSince: today, buddyId, avatar: "sprout", onboarding: {}, onboardingProgressAt: today, seeded: true,
          });
        }),
      // Deploy day: existing members come in from the roster and get the short setup, not onboarding.
      importRoster: (rows) => {
        const known = new Set(db.members.map((m) => m.email.toLowerCase()));
        const fresh = rows.filter((r, i) => !known.has(r.email.toLowerCase()) && rows.findIndex((x) => x.email.toLowerCase() === r.email.toLowerCase()) === i);
        mutate((db) => {
          fresh.forEach((r, i) => {
            const since = r.tierSince ?? today;
            db.members.push({
              id: r.email.split("@")[0] || uid(), name: r.name, email: r.email, tier: r.tier, weeklyHours: WEEKLY[r.tier], admin: false,
              series: ["Community"], joined: since, tierSince: since, buddyId: null, avatar: AVATARS[i % AVATARS.length],
              onboarding: null, setup: {}, seeded: true,
            });
          });
        });
        return { added: fresh.length, skipped: rows.length - fresh.length };
      },
      completeSetup: (memberId, step, v = true) =>
        mutate((db) => {
          const m = db.members.find((x) => x.id === memberId)!;
          if (m.setup) m.setup = { ...m.setup, [step]: v };
        }),
      // The buddy says onboarding is done; an admin confirms in Approvals.
      proposeGraduation: (memberId) =>
        mutate((db) => {
          const m = db.members.find((x) => x.id === memberId)!;
          if (m.buddyId !== me.id || !Object.values(onboardingDone(m)).every(Boolean)) return;
          m.graduation = { proposedBy: me.id, at: today };
        }),
      resolveGraduation: (memberId, approve) =>
        mutate((db) => {
          if (!me.admin) return;
          const m = db.members.find((x) => x.id === memberId)!;
          if (approve && m.graduation) m.onboarding = null;
          m.graduation = null;
        }),
    };
  }, [state, now, mutate]);

  if (!value) return <div className="boot" />;
  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

function addHours(db: Db, memberId: string, date: string, hours: number) {
  const ws = weekStart(date);
  const row = db.hours.find((h) => h.memberId === memberId && h.weekStart === ws);
  if (row) row.hours = Math.round((row.hours + hours) * 100) / 100;
  else db.hours.push({ memberId, weekStart: ws, hours });
}

function finishSession(db: Db, memberId: string, end: Date) {
  const s = db.sessions.find((x) => x.memberId === memberId);
  if (!s) return;
  const h = Math.round((Math.max(0, (end.getTime() - new Date(s.start).getTime()) / 3_600_000)) * 4) / 4;
  addHours(db, memberId, isoDate(new Date(s.start)), h);
  const t = s.taskId ? db.tasks.find((x) => x.id === s.taskId) : undefined;
  if (t && h > 0) t.history.push({ at: end.toISOString(), by: memberId, what: `${h} h clocked` });
  db.sessions = db.sessions.filter((x) => x.memberId !== memberId);
}

function setAttendance(db: Db, meetingId: string, memberId: string, state: AttendanceState) {
  const m = db.meetings.find((x) => x.id === meetingId)!;
  const date = isoDate(new Date(m.start));
  const row = db.attendance.find((a) => a.memberId === memberId && a.series === m.series && a.date === date);
  if (row) row.state = state;
  else db.attendance.push({ memberId, series: m.series, date, state });
}

export function attendanceOf(db: Db, meetingId: string, memberId: string): AttendanceState | null {
  const m = db.meetings.find((x) => x.id === meetingId)!;
  const date = isoDate(new Date(m.start));
  return db.attendance.find((a) => a.memberId === memberId && a.series === m.series && a.date === date)?.state ?? null;
}

export type { TaskStatus };

export const STATUS_LABEL: Record<TaskStatus, string> = {
  idea: "Idea lane",
  todo: "Priority lane",
  doing: "In progress",
  review: "Validation",
  done: "Done",
};
