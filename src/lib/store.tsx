"use client";

// Frontend-only store. Every exported action is one backend call later;
// see docs/FRONTEND.md for the mapping. State persists in localStorage so the
// demo survives a reload.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { AttendanceState, TaskSize, Db, Member, OnboardingStepId, Priority, Project, SetupStepId, Task, TaskStatus } from "./types";
import type { NotifyCategory } from "./notifications";
import { seedDb, ONBOARDING_STEPS, SETUP_STEPS, STALL_DAYS } from "./seed";
import { addDays, isoDate, weekStart } from "./dates";
import { standing, type Standing, COMMUNITY_NOTICE_H, PROJECT_NOTICE_H } from "./tiers";
import { api, backendEnabled, loadDb, myHandle, sessionEmail, signInAs, signInWithGoogle, signOut, syncCalendar } from "./backend";
import { SignIn } from "@/components/SignIn";

const KEY = "shapers-ui-v5";
const PREFS_KEY = "shapers-ui-prefs";
const DEFAULT_PREFS = { meId: "petra.jerman", liveMeeting: false };
export const DEFAULT_NOTIFY: Record<NotifyCategory, boolean> = { hours: true, meetings: true, tasks: true, onboarding: true, admin: true };
const BLOCK_MS = 3_600_000;
const PROMPT_BEFORE_MS = 5 * 60_000;

interface Prefs {
  meId: string;
  /** demo switch: treat the next meeting as live so meeting clock-in can be shown */
  liveMeeting: boolean;
  /** push notification switches per category (sent to the backend with the device subscription) */
  notify?: Record<NotifyCategory, boolean>;
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
  /** Signed-in email in backend mode (Google or demo); null in local demo mode. */
  authEmail: string | null;
  signOut: () => void;
  clockIn: (taskId: string | null) => void;
  stillWorking: () => void;
  clockOut: () => void;
  logHours: (date: string, hours: number, note?: string) => "logged" | "requested";
  resolveBackfill: (id: string, approve: boolean) => void;
  updateTask: (id: string, patch: Partial<Task>, what: string) => void;
  addTask: (t: { projectId: string; title: string; assigneeId: string | null; due: string | null; priority: Priority; status?: TaskStatus; start?: string | null; size?: TaskSize }) => void;
  moveTask: (id: string, to: { status?: TaskStatus; projectId?: string; assigneeId?: string | null }) => void;
  setTaskDates: (id: string, start: string, due: string) => void;
  unscheduleTask: (id: string) => void;
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

function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
  } catch {}
  return DEFAULT_PREFS;
}

function load(): { db: Db; prefs: Prefs } {
  const fresh = { db: seedDb(), prefs: DEFAULT_PREFS };
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...fresh, ...JSON.parse(raw) };
  } catch {}
  return fresh;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<{ db: Db; prefs: Prefs } | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [error, setError] = useState<string | null>(null);
  // Backend mode only: who is signed in. "signed-out" and "not-member" show the sign-in screen.
  const [auth, setAuth] = useState<{ status: "loading" | "signed-out" | "not-member" | "ready"; email: string | null }>({ status: "loading", email: null });
  const [busy, setBusy] = useState(false);

  // Backend mode: the database is the truth. Reload after every write and every minute.
  const reload = useCallback(() => {
    if (!backendEnabled) return Promise.resolve();
    return loadDb()
      .then((db) => setState((s) => (s ? { ...s, db } : s)))
      .catch((e: Error) => setError(e.message));
  }, []);

  /** Sends one action to the backend; on refusal shows why, then shows the true state again. */
  const remote = useCallback(
    (call: () => Promise<unknown>) => {
      if (!backendEnabled) return;
      call()
        .then(() => setError(null))
        .catch((e: Error) => setError(e.message))
        .finally(() => void reload());
    },
    [reload],
  );

  /** Signs whoever is signed in into the app: their roster member becomes "me". */
  const start = useCallback(async () => {
    try {
      const email = await sessionEmail();
      if (!email) return setAuth({ status: "signed-out", email: null });
      const handle = await myHandle(email);
      if (!handle) return setAuth({ status: "not-member", email });
      const db = await loadDb();
      setState({ db, prefs: { ...loadPrefs(), meId: handle } });
      setAuth({ status: "ready", email });
      if (await syncCalendar()) void reload();
    } catch (e) {
      setError((e as Error).message);
      setAuth({ status: "signed-out", email: null });
    }
  }, [reload]);

  const demoSignIn = useCallback(
    (handle: string) => {
      setBusy(true);
      setError(null);
      signInAs(handle).then(start).catch((e: Error) => setError(e.message)).finally(() => setBusy(false));
    },
    [start],
  );

  const doSignOut = useCallback(() => {
    void signOut().then(() => {
      setState(null);
      setAuth({ status: "signed-out", email: null });
    });
  }, []);

  useEffect(() => {
    if (backendEnabled) {
      void start();
    } else {
      setState(load());
    }
    const t = setInterval(() => setNow(new Date()), 15_000);
    const r = backendEnabled ? setInterval(() => void reload(), 60_000) : undefined;
    // Meetings come from Google Calendar; refresh them every few minutes (admins only).
    const c = backendEnabled ? setInterval(() => void syncCalendar().then((synced) => (synced ? reload() : undefined)), 5 * 60_000) : undefined;
    return () => {
      clearInterval(t);
      if (r) clearInterval(r);
      if (c) clearInterval(c);
    };
  }, [reload, start]);

  useEffect(() => {
    if (!state) return;
    try {
      if (backendEnabled) localStorage.setItem(PREFS_KEY, JSON.stringify(state.prefs));
      else localStorage.setItem(KEY, JSON.stringify(state));
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

    const base: Ctx = {
      db,
      prefs,
      authEmail: null,
      signOut: () => {},
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
      unscheduleTask: (id) =>
        mutate((db) => {
          const t = db.tasks.find((x) => x.id === id);
          if (!t || (!t.start && !t.due)) return;
          t.start = null;
          t.due = null;
          t.history.push({ at: now.toISOString(), by: me.id, what: "removed from calendar" });
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
    if (!backendEnabled) return base;

    // Backend mode: every action still updates the screen at once, then goes to the
    // database, which enforces the rules; the reload afterwards shows the true state.
    const overrides: Partial<Ctx> = {
      authEmail: auth.email,
      signOut: doSignOut,
      // "View as" signs in as that demo member (it ends a Google session).
      setPrefs: (p) => {
        base.setPrefs(p);
        if (p.meId && p.meId !== prefs.meId) {
          signInAs(p.meId)
            .then(() => setAuth((a) => ({ ...a, email: `${p.meId}@sandbox.example` })))
            .then(reload)
            .catch((e: Error) => setError(e.message));
        }
      },
      reset: () => void reload(),
      clockIn: (taskId) => { base.clockIn(taskId); remote(() => api.clockIn(taskId)); },
      stillWorking: () => { base.stillWorking(); remote(api.stillWorking); },
      clockOut: () => { base.clockOut(); remote(api.clockOut); },
      logHours: (date, hours, note = "") => {
        const r = base.logHours(date, hours, note);
        remote(() => api.logHours(date, hours, note));
        return r;
      },
      resolveBackfill: (id, approve) => { base.resolveBackfill(id, approve); remote(() => api.resolveBackfill(id, approve)); },
      updateTask: (id, patch, what) => { base.updateTask(id, patch, what); remote(() => api.updateTask(id, patch)); },
      addTask: (t) => { base.addTask(t); remote(() => api.addTask(t)); },
      moveTask: (id, to) => {
        // Send only what actually changes, so members aren't refused for an unchanged owner or project.
        const t = db.tasks.find((x) => x.id === id);
        const patch: Partial<Task> = {};
        if (t && to.status && to.status !== t.status) patch.status = to.status;
        if (t && to.projectId && to.projectId !== t.projectId) patch.projectId = to.projectId;
        if (t && to.assigneeId !== undefined && to.assigneeId !== t.assigneeId) patch.assigneeId = to.assigneeId;
        base.moveTask(id, to);
        remote(() => api.updateTask(id, patch));
      },
      setTaskDates: (id, start, due) => { base.setTaskDates(id, start, due); remote(() => api.updateTask(id, { start, due })); },
      unscheduleTask: (id) => { base.unscheduleTask(id); remote(() => api.updateTask(id, { start: null, due: null })); },
      addProject: (p) => { base.addProject(p); remote(() => api.addProject(p)); },
      meetingClockIn: (meetingId, st) => { base.meetingClockIn(meetingId, st); remote(() => api.meetingClockIn(meetingId, st)); },
      recordAttendance: (meetingId, memberId, st) => {
        base.recordAttendance(meetingId, memberId, st);
        remote(() => api.recordAttendance(meetingId, memberId, st));
      },
      announceAbsence: (meetingId) => {
        const excused = base.announceAbsence(meetingId);
        remote(() => api.announceAbsence(meetingId));
        return excused;
      },
      completeStep: (memberId, step, v = true) => { base.completeStep(memberId, step, v); remote(() => api.completeStep(memberId, step, v)); },
      joinProject: (memberId, projectId) => { base.joinProject(memberId, projectId); remote(() => api.joinProject(memberId, projectId)); },
      requestPause: (from, to, reason) => { base.requestPause(from, to, reason); remote(() => api.requestPause(from, to, reason)); },
      resolvePause: (id, approve) => { base.resolvePause(id, approve); remote(() => api.resolvePause(id, approve)); },
      setTier: (memberId, tier) => { base.setTier(memberId, tier); remote(() => api.setTier(memberId, tier)); },
      addMember: (m) => { base.addMember(m); remote(() => api.addMember(m)); },
      importRoster: (rows) => {
        const r = base.importRoster(rows);
        remote(() => api.importRoster(rows));
        return r;
      },
      completeSetup: (memberId, step, v = true) => { base.completeSetup(memberId, step, v); remote(() => api.completeSetup(step, v)); },
      proposeGraduation: (memberId) => { base.proposeGraduation(memberId); remote(() => api.proposeGraduation(memberId)); },
      resolveGraduation: (memberId, approve) => { base.resolveGraduation(memberId, approve); remote(() => api.resolveGraduation(memberId, approve)); },
    };
    return { ...base, ...overrides };
  }, [state, now, mutate, remote, reload, auth.email, doSignOut]);

  if (backendEnabled && (auth.status === "signed-out" || auth.status === "not-member")) {
    return (
      <SignIn
        notMemberEmail={auth.status === "not-member" ? auth.email : null}
        busy={busy}
        error={error}
        onGoogle={() => {
          setBusy(true);
          signInWithGoogle().catch((e: Error) => { setError(e.message); setBusy(false); });
        }}
        onDemo={demoSignIn}
        onSignOut={doSignOut}
      />
    );
  }
  if (!value) return error ? <div className="boot backend-error">{error}</div> : <div className="boot" />;
  return (
    <AppCtx.Provider value={value}>
      {children}
      {error && (
        <div role="alert" className="backend-error" onClick={() => setError(null)}>
          {error}
        </div>
      )}
    </AppCtx.Provider>
  );
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
