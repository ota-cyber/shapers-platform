// Supabase backend for the store. Loads the database into the Db shape the
// screens already use (src/lib/types.ts) and turns each store action into an
// RPC. Rules and permissions are enforced by the database (docs/BACKEND.md,
// docs/PERMISSIONS.md); the UI keeps its own checks only to hide buttons.
//
// Enabled when NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set.
// "View as" signs in as that sandbox member with the demo password.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type {
  AttendanceState, Db, Member, OnboardingStepId, Priority, Series, SetupStepId, Task, TaskSize, TaskStatus, TierId,
} from "./types";
import { isoDate } from "./dates";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const DEMO_PASSWORD = process.env.NEXT_PUBLIC_DEMO_PASSWORD ?? "shapers-demo";
const DEMO_DOMAIN = process.env.NEXT_PUBLIC_DEMO_EMAIL_DOMAIN ?? "sandbox.example";

export const backendEnabled = Boolean(URL && KEY);
const sb: SupabaseClient | null = backendEnabled ? createClient(URL!, KEY!) : null;

const SERIES: Record<string, Series> = {
  community: "Community", "summer-school": "Summer School", grants: "Grants",
  "shape-talks": "Shape Talks", "shapers-tech": "Shapers Tech", "shapers-voice": "Shapers Voice",
};
const SERIES_ID = Object.fromEntries(Object.entries(SERIES).map(([k, v]) => [v, k])) as Record<Series, string>;
const TIER: Record<string, TierId> = { go: "GO!", impact: "Impact", core: "Core" };
const TIER_KEY: Record<TierId, string> = { "GO!": "go", Impact: "impact", Core: "core" };
const AVATARS = ["bust", "stone", "apple", "moon", "dove", "hands", "compass", "sprout", "book", "key"];
const LANE: Record<TaskStatus, string> = { idea: "Idea lane", todo: "Priority lane", doing: "In progress", review: "Validation", done: "Done" };

/** UI ids <-> database ids. Members use their handle (email prefix), meetings their iCal UID prefix. */
const ids = { member: new Map<string, string>(), memberUi: new Map<string, string>(), meeting: new Map<string, string>() };
const memberUuid = (handle: string | null) => (handle ? ids.member.get(handle) ?? null : null);
const memberHandle = (uuid: string | null) => (uuid ? ids.memberUi.get(uuid) ?? uuid : null);
const meetingUuid = (uiId: string) => ids.meeting.get(uiId) ?? uiId;

function must<T>(r: { data: T | null; error: { message: string } | null }): T {
  if (r.error) throw new Error(r.error.message);
  return r.data as T;
}

// ------------------------------------------------------------------ sign-in

export async function signInAs(handle: string): Promise<void> {
  const email = `${handle}@${DEMO_DOMAIN}`;
  const { data } = await sb!.auth.getSession();
  if (data.session?.user.email === email) return;
  if (data.session) await sb!.auth.signOut();
  const r = await sb!.auth.signInWithPassword({ email, password: DEMO_PASSWORD });
  if (r.error) throw new Error(`Sign-in as ${handle} failed: ${r.error.message}`);
}

/** Pulls meetings from Google Calendar (read only). The database lets only admins run it;
 *  for everyone else the call is refused and ignored. */
export async function syncCalendar(): Promise<boolean> {
  const { error } = await sb!.functions.invoke("sync-calendar");
  return !error;
}

// ------------------------------------------------------------------ load

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function loadDb(): Promise<Db> {
  const nowIso = new Date().toISOString();
  const [
    members, tiers, seriesMembers, onboarding, setup, interest, hours, meetings, attendance,
    projects, tasks, events, sessions, manual, pauses, absences,
  ] = await Promise.all([
    sb!.from("members").select("id,handle,name,email,tier,is_admin,joined_on,tier_since,buddy_id,avatar,onboarding_active,needs_setup,graduation_proposed_by,graduation_proposed_at").eq("active", true).order("created_at"),
    sb!.from("tiers").select("key,weekly_hours"),
    sb!.from("series_members").select("series_id,member_id"),
    sb!.from("member_onboarding").select("member_id,step_key,completed_at"),
    sb!.from("member_setup").select("member_id,step_key"),
    sb!.from("project_interest").select("member_id,project_id"),
    sb!.from("week_hours").select("member_id,week_start,hours"),
    sb!.from("meetings").select("id,ical_uid,series_id,starts_at,ends_at,location").order("starts_at"),
    sb!.from("attendance").select("meeting_id,member_id,state"),
    sb!.from("projects").select("id,name,series_id,lead_id,description").is("archived_at", null).order("created_at"),
    sb!.from("tasks").select("*").order("sort_order"),
    sb!.from("task_events").select("task_id,actor_id,kind,from_value,to_value,at").order("at").limit(5000),
    sb!.from("work_sessions").select("member_id,started_at,planned_end,task_id").eq("source", "timer").is("ended_at", null).gt("planned_end", nowIso),
    sb!.from("work_sessions").select("id,member_id,started_at,ended_at,note,status,reviewed_at").eq("source", "manual"),
    sb!.from("pauses").select("id,member_id,starts_on,ends_on,reason,status").neq("status", "rejected"),
    sb!.from("absence_notices").select("member_id,meeting_id,created_at,in_time"),
  ]).then((rs) => rs.map((r) => must<any[]>(r as any)));

  ids.member.clear();
  ids.memberUi.clear();
  ids.meeting.clear();
  for (const m of members) {
    ids.member.set(m.handle, m.id);
    ids.memberUi.set(m.id, m.handle);
  }
  const meetingUi = new Map<string, any>();
  for (const mt of meetings) {
    const uiId = String(mt.ical_uid).split("@")[0];
    ids.meeting.set(uiId, mt.id);
    meetingUi.set(mt.id, { ...mt, uiId });
  }
  const weekly = Object.fromEntries(tiers.map((t: any) => [t.key, Number(t.weekly_hours)]));
  const projectName = new Map(projects.map((p: any) => [p.id, p.name]));
  const memberName = new Map(members.map((m: any) => [m.id, m.name]));
  const seriesOf = (memberId: string) => seriesMembers.filter((s: any) => s.member_id === memberId).map((s: any) => SERIES[s.series_id]);

  const out: Db = {
    members: members.map((m: any, i: number): Member => {
      const steps = onboarding.filter((o: any) => o.member_id === m.id);
      const lastStep = steps.map((o: any) => o.completed_at).sort().pop();
      const setupSteps = setup.filter((s: any) => s.member_id === m.id).map((s: any) => s.step_key as SetupStepId);
      return {
        id: m.handle,
        name: m.name,
        email: m.email,
        tier: TIER[m.tier],
        weeklyHours: weekly[m.tier],
        admin: m.is_admin,
        series: ["Community", ...seriesOf(m.id)],
        joined: m.joined_on,
        tierSince: m.tier_since,
        buddyId: memberHandle(m.buddy_id),
        avatar: m.avatar ?? AVATARS[i % AVATARS.length],
        onboarding: m.onboarding_active
          ? Object.fromEntries(steps.map((o: any) => [o.step_key, true])) as Partial<Record<OnboardingStepId, boolean>>
          : null,
        onboardingProgressAt: lastStep ? isoDate(new Date(lastStep)) : undefined,
        graduation: m.graduation_proposed_by
          ? { proposedBy: memberHandle(m.graduation_proposed_by)!, at: isoDate(new Date(m.graduation_proposed_at)) }
          : null,
        setup: m.needs_setup ? Object.fromEntries(setupSteps.map((s) => [s, true])) : null,
        wantsProjects: interest.filter((x: any) => x.member_id === m.id).map((x: any) => x.project_id),
      };
    }),
    hours: hours.map((h: any) => ({ memberId: memberHandle(h.member_id)!, weekStart: h.week_start, hours: Number(h.hours) })),
    meetings: meetings.map((mt: any) => {
      const everyone = mt.series_id === "community";
      const expected = everyone
        ? members.map((m: any) => m.handle)
        : seriesMembers.filter((s: any) => s.series_id === mt.series_id).map((s: any) => memberHandle(s.member_id)!);
      return {
        id: meetingUi.get(mt.id).uiId, series: SERIES[mt.series_id], start: mt.starts_at, end: mt.ends_at,
        location: mt.location ?? "", memberIds: expected,
      };
    }),
    attendance: attendance
      .filter((a: any) => meetingUi.has(a.meeting_id))
      .map((a: any) => {
        const mt = meetingUi.get(a.meeting_id);
        return { memberId: memberHandle(a.member_id)!, series: SERIES[mt.series_id], date: isoDate(new Date(mt.starts_at)), state: a.state as AttendanceState };
      }),
    projects: projects.map((p: any) => ({
      id: p.id, name: p.name, series: SERIES[p.series_id ?? "community"], leadId: memberHandle(p.lead_id) ?? "", description: p.description ?? "",
    })),
    tasks: tasks.map((t: any): Task => ({
      id: t.id,
      projectId: t.project_id,
      title: t.title,
      notes: t.notes ?? "",
      assigneeId: memberHandle(t.assignee_id),
      status: t.status,
      priority: t.priority,
      size: t.size,
      start: t.starts_on,
      due: t.due_on,
      doneAt: t.completed_at ? isoDate(new Date(t.completed_at)) : null,
      history: events
        .filter((e: any) => e.task_id === t.id)
        .map((e: any) => ({ at: e.at, by: memberHandle(e.actor_id) ?? "rules", what: describe(e, projectName, memberName) })),
    })),
    sessions: sessions.map((s: any) => ({ memberId: memberHandle(s.member_id)!, start: s.started_at, blockEnd: s.planned_end, taskId: s.task_id })),
    pauses: pauses.map((p: any) => ({
      id: p.id, memberId: memberHandle(p.member_id)!, from: p.starts_on, to: p.ends_on, reason: p.reason ?? "",
      status: p.status === "approved" ? "approved" : "requested",
    })),
    // Manual entries that went through (or wait for) an admin are the back-fill requests.
    backfills: manual
      .filter((s: any) => s.status !== "approved" || s.reviewed_at)
      .map((s: any) => ({
        id: s.id, memberId: memberHandle(s.member_id)!, date: isoDate(new Date(s.started_at)),
        hours: Math.round(((new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 3_600_000) * 100) / 100,
        note: s.note ?? "", status: s.status === "rejected" ? "declined" : s.status,
      })),
    absences: absences
      .filter((a: any) => meetingUi.has(a.meeting_id))
      .map((a: any) => ({ memberId: memberHandle(a.member_id)!, meetingId: meetingUi.get(a.meeting_id).uiId, at: a.created_at, excused: a.in_time })),
  };
  return out;
}

function describe(e: any, projectName: Map<string, string>, memberName: Map<string, string>): string {
  switch (e.kind) {
    case "created": return "created";
    case "status": return e.to_value === "done" ? "marked done" : `moved to ${LANE[e.to_value as TaskStatus] ?? e.to_value}`;
    case "assignee": return e.to_value ? `handed to ${memberName.get(e.to_value) ?? "someone"}` : "unassigned";
    case "priority": return `priority ${e.to_value}`;
    case "due": return `due ${e.to_value ?? "cleared"}`;
    case "start": return `starts ${e.to_value ?? "cleared"}`;
    case "project": return `moved to ${projectName.get(e.to_value) ?? "another project"}`;
    case "title": return "renamed";
    case "notes": return "notes updated";
    case "size": return `size ${e.to_value}`;
    case "clocked": return `${e.to_value} clocked`;
    default: return e.kind;
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// ------------------------------------------------------------------ actions

async function rpc(fn: string, args: Record<string, unknown> = {}) {
  const { data, error } = await sb!.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data;
}

const TASK_FIELDS: Record<string, string> = {
  title: "title", notes: "notes", status: "status", priority: "priority", size: "size",
  start: "starts_on", due: "due_on", assigneeId: "assignee_id", projectId: "project_id",
};

export const api = {
  clockIn: (taskId: string | null) => rpc("clock_in", { p_task_id: taskId }),
  stillWorking: () => rpc("extend_session"),
  clockOut: () => rpc("clock_out"),
  logHours: (date: string, hours: number, note: string) => rpc("log_hours", { p_date: date, p_hours: hours, p_note: note || null }),
  resolveBackfill: (id: string, approve: boolean) => rpc("review_session", { p_session: id, p_approve: approve }),

  /** Sends only the fields given; the database refuses fields the person may not change. */
  updateTask: (id: string, patch: Partial<Task>) => {
    const body: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(patch)) {
      if (!(k in TASK_FIELDS)) continue;
      body[TASK_FIELDS[k]] = k === "assigneeId" ? memberUuid(v as string | null) : v;
    }
    return Object.keys(body).length ? rpc("update_task", { p_task: id, p_patch: body }) : Promise.resolve();
  },
  addTask: (t: { projectId: string; title: string; assigneeId: string | null; due: string | null; priority: Priority; status?: TaskStatus; start?: string | null; size?: TaskSize }) =>
    rpc("create_task", {
      p_project: t.projectId, p_title: t.title, p_assignee: memberUuid(t.assigneeId), p_status: t.status ?? "todo",
      p_priority: t.priority, p_size: t.size ?? "M", p_starts: t.start ?? null, p_due: t.due,
    }),
  addProject: (p: { name: string; series: Series; leadId: string; description: string }) =>
    rpc("create_project", { p_name: p.name, p_description: p.description || null, p_lead: memberUuid(p.leadId), p_series: SERIES_ID[p.series] }),

  meetingClockIn: (meetingId: string, state: "present" | "remote") =>
    rpc("check_in_meeting", { p_meeting: meetingUuid(meetingId), p_remote: state === "remote" }),
  recordAttendance: (meetingId: string, memberId: string, state: AttendanceState) =>
    rpc("set_attendance", { p_meeting: meetingUuid(meetingId), p_member: memberUuid(memberId), p_state: state }),
  announceAbsence: (meetingId: string) => rpc("notify_absence", { p_meeting: meetingUuid(meetingId) }),

  completeStep: (memberId: string, step: OnboardingStepId, done: boolean) =>
    rpc("complete_onboarding_step", { p_step: step, p_member: memberUuid(memberId), p_done: done }),
  joinProject: (memberId: string, projectId: string) => rpc("join_project", { p_project: projectId, p_member: memberUuid(memberId) }),
  completeSetup: (step: SetupStepId, done: boolean) =>
    step === "first-hour" ? Promise.resolve() : rpc("complete_setup", { p_step: step, p_done: done }),
  proposeGraduation: (memberId: string) => rpc("propose_graduation", { p_member: memberUuid(memberId) }),
  resolveGraduation: (memberId: string, approve: boolean) => rpc("resolve_graduation", { p_member: memberUuid(memberId), p_approve: approve }),

  requestPause: (from: string, to: string, reason: string) => rpc("request_pause", { p_starts: from, p_ends: to, p_reason: reason || null }),
  resolvePause: (id: string, approve: boolean) => rpc("review_pause", { p_pause: id, p_approve: approve }),
  setTier: (memberId: string, tier: TierId) => rpc("set_tier", { p_member: memberUuid(memberId), p_tier: TIER_KEY[tier] }),
  addMember: (m: { name: string; email: string; buddyId: string | null; series: Series[] }) =>
    rpc("add_member", { p_name: m.name, p_email: m.email, p_buddy: memberUuid(m.buddyId), p_series: m.series.map((s) => SERIES_ID[s]) }),
  importRoster: (rows: { name: string; email: string; tier: TierId; tierSince?: string }[]) =>
    rpc("import_roster", { p_rows: rows.map((r) => ({ name: r.name, email: r.email, tier: TIER_KEY[r.tier], tier_since: r.tierSince ?? null })) }),
};
