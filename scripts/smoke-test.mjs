#!/usr/bin/env node
// End-to-end check of the backend over the real API, signed in as real demo users.
// Run after a fresh `supabase db reset` + create-demo-users (it writes test data).
//
//   SUPABASE_URL=... SUPABASE_ANON_KEY=... SUPABASE_SERVICE_ROLE_KEY=... DEMO_PASSWORD=... node scripts/smoke-test.mjs

const { SUPABASE_URL: url, SUPABASE_ANON_KEY: anon, SUPABASE_SERVICE_ROLE_KEY: service, DEMO_PASSWORD: password } = process.env;
if (!url || !anon || !service || !password) {
  console.error("Set SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY and DEMO_PASSWORD.");
  process.exit(1);
}

let failures = 0;
const ok = (cond, label, extra = "") => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}${extra ? `  (${extra})` : ""}`);
  if (!cond) failures++;
};

async function api(token, path, { method = "GET", body, key = anon } = {}) {
  const r = await fetch(`${url}${path}`, {
    method,
    headers: { apikey: key, Authorization: `Bearer ${token}`, "Content-Type": "application/json", Prefer: "return=representation" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await r.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { status: r.status, ok: r.ok, data };
}
const rpc = (token, fn, args = {}) => api(token, `/rest/v1/rpc/${fn}`, { method: "POST", body: args });
const get = (token, path) => api(token, `/rest/v1/${path}`);

async function signIn(email) {
  const r = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: anon, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const j = await r.json();
  if (!j.access_token) throw new Error(`Sign-in failed for ${email}: ${JSON.stringify(j)}`);
  return j.access_token;
}

// Test subjects from the demo cast (see scripts/build_seed.py).
const all = (await api(service, "/rest/v1/members?select=id,email,handle,tier,is_admin,buddy_id&order=email", { key: service })).data;
const by = (h) => all.find((m) => m.handle === h);
const goMember = by("petra.jerman");   // GO!, has tasks, buddy Jan
const buddy = all.find((m) => m.id === goMember.buddy_id);
const admin = by("ana.kovac");         // admin (and Core)
const outsider = by("matic.kos");      // Impact, not related to Petra
const newbie = by("lea.zorman");       // onboarding, stalled, buddy Rok
const mia = by("mia.kranjc");          // onboarding, every step done, buddy Rok
const rok = by("rok.golob");
const setupMember = by("zala.turk");   // imported, on setup steps

// Meeting check-in window is part of the test; the demo seed opens it.
await api(service, "/rest/v1/app_settings?id=eq.true", { method: "PATCH", body: { check_in_any_time: false }, key: service });

const member = await signIn(goMember.email);
const buddyToken = await signIn(buddy.email);
const adminToken = await signIn(admin.email);
const rokToken = await signIn(rok.email);
const newbieToken = await signIn(newbie.email);
const setupToken = await signIn(setupMember.email);

// ---- visibility
let r = await get(member, "member_overview?select=member_id");
ok(r.ok && r.data.length === 1 && r.data[0].member_id === goMember.id, "member sees only their own overview row", `${r.data?.length} rows`);
r = await get(member, `attendance?select=member_id&member_id=eq.${outsider.id}`);
ok(r.ok && r.data.length === 0, "member cannot read someone else's attendance");
r = await get(member, "tasks?select=id");
ok(r.ok && r.data.length >= 30, "member can read all tasks", `${r.data?.length}`);
r = await get(buddyToken, `member_overview?select=member_id&member_id=eq.${goMember.id}`);
ok(r.ok && r.data.length === 1, "buddy can see their mentee");
r = await get(adminToken, "member_overview?select=member_id");
ok(r.ok && r.data.length === all.length, "admin sees every member", `${r.data?.length}`);
r = await get(member, "org_weekly?select=week_start");
ok(r.ok && r.data.length === 0, "org analytics hidden from members");
r = await get(adminToken, "org_weekly?select=week_start,total_hours,attendance_rate,tasks_done");
ok(r.ok && r.data.length >= 6, "admin gets weekly org analytics", `${r.data?.length} weeks`);

// ---- hours
const before = (await get(member, "member_overview?select=week_hours")).data[0].week_hours;
const s1 = await rpc(member, "clock_in");
const s2 = await rpc(member, "clock_in");
ok(s1.ok && s2.ok && s1.data.id === s2.data.id, "double clock-in returns the same session");
const ext = await rpc(member, "extend_session");
ok(ext.ok && new Date(ext.data.planned_end) - new Date(s1.data.planned_end) === 3600e3, "extend adds one hour");
const out = await rpc(member, "clock_out");
ok(out.ok && out.data.ended_at, "clock out ends the session");
const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Ljubljana" });
const old = new Date(Date.now() - 4 * 864e5).toLocaleDateString("sv-SE", { timeZone: "Europe/Ljubljana" });
const lh = await rpc(member, "log_hours", { p_date: today, p_hours: 1.5, p_note: "smoke test" });
ok(lh.ok && lh.data.status === "approved", "logging today is approved at once");
const lo = await rpc(member, "log_hours", { p_date: old, p_hours: 2 });
ok(lo.ok && lo.data.status === "pending", "logging 4 days back needs approval");
const after = (await get(member, "member_overview?select=week_hours")).data[0].week_hours;
ok(Math.abs(after - before - 1.5) < 0.05, "week hours include the new entry", `${before} -> ${after}`);
const rv = await rpc(member, "review_session", { p_session: lo.data.id, p_approve: true });
ok(!rv.ok, "member cannot approve their own entry");
const ra = await rpc(adminToken, "review_session", { p_session: lo.data.id, p_approve: true });
ok(ra.ok && ra.data.status === "approved", "admin approves the old entry");

// ---- meetings
const upcoming = (await get(member, `member_meetings?select=meeting_id,series_id,starts_at&member_id=eq.${goMember.id}&series_id=eq.community&status=eq.upcoming&order=starts_at`)).data;
const later = upcoming.find((m) => new Date(m.starts_at) - Date.now() > 80 * 3600e3);
const ci = await rpc(member, "check_in_meeting", { p_meeting: later.meeting_id });
ok(!ci.ok, "check-in is closed long before the meeting");
const na = await rpc(member, "notify_absence", { p_meeting: later.meeting_id, p_reason: "Travelling" });
ok(na.ok && na.data.in_time === true, "absence notice 72h+ ahead is in time");
const st = (await get(member, `member_meetings?select=status&meeting_id=eq.${later.meeting_id}&member_id=eq.${goMember.id}`)).data[0];
ok(st.status === "excused", "in-time notice marks the meeting excused");
const cons = (await get(member, `tasks?select=id,kind,due_on&assignee_id=eq.${goMember.id}&kind=eq.consequence&source_meeting_id=eq.${later.meeting_id}`)).data;
ok(cons.length === 1, "GO! member missing Community gets a follow-up task");

const past = (await get(adminToken, "meetings?select=id,series_id&starts_at=lt.now()&order=starts_at.desc&limit=1")).data[0];
const rec = await rpc(adminToken, "record_meeting_attendance", { p_meeting: past.id, p_default: "present", p_exceptions: { [goMember.id]: "remote" } });
ok(rec.ok && rec.data > 0, "admin records a whole meeting in one call", `${rec.data} rows`);
const rm = await rpc(member, "record_meeting_attendance", { p_meeting: past.id });
ok(!rm.ok, "member cannot record a whole meeting");

// ---- tasks (docs/PERMISSIONS.md)
const project = (await get(member, "projects?select=id&is_general=eq.false&limit=1")).data[0].id;
const mine = (await get(member, `tasks?select=id,status&assignee_id=eq.${goMember.id}&status=neq.done&limit=1`)).data[0];
const upd = await rpc(member, "update_task", { p_task: mine.id, p_patch: { status: "done", priority: "high", starts_on: "2026-10-20", due_on: "2026-10-30" } });
ok(upd.ok && upd.data.completed_at, "member finishes and reschedules their own task");
const ev = (await get(member, `task_events?select=kind,to_value&task_id=eq.${mine.id}`)).data;
ok(ev.some((e) => e.kind === "status" && e.to_value === "done") && ev.some((e) => e.kind === "start"), "changes are in the task history");
const handoff = await rpc(member, "update_task", { p_task: mine.id, p_patch: { assignee_id: buddy.id } });
ok(!handoff.ok, "member cannot hand their task to someone else");
const sameOwner = await rpc(member, "update_task", { p_task: mine.id, p_patch: { assignee_id: goMember.id } });
ok(!sameOwner.ok, "member is refused even when sending their own id as assignee");
const resize = await rpc(member, "update_task", { p_task: mine.id, p_patch: { size: "L" } });
ok(!resize.ok, "member cannot change a task's size");
const other = (await get(member, `projects?select=id&is_general=eq.false&id=neq.${project}&limit=1`)).data[0].id;
const moved = await rpc(member, "update_task", { p_task: mine.id, p_patch: { project_id: other } });
ok(moved.ok && moved.data.project_id === other, "member moves their own task to another project (2026-10-25 rule)");
const cleared = await rpc(member, "update_task", { p_task: mine.id, p_patch: { starts_on: null, due_on: null } });
ok(cleared.ok && cleared.data.starts_on === null && cleared.data.due_on === null, "member removes their task from the calendar");
const othersTask = (await get(member, `tasks?select=id&assignee_id=eq.${outsider.id}&limit=1`)).data[0];
const steal = await rpc(member, "update_task", { p_task: othersTask.id, p_patch: { status: "done" } });
ok(!steal.ok, "member cannot change someone else's task");
const unassigned = (await get(member, "tasks?select=id&assignee_id=is.null&limit=1")).data[0];
const take = await rpc(member, "update_task", { p_task: unassigned.id, p_patch: { assignee_id: goMember.id } });
ok(!take.ok, "member cannot pick up an unassigned task");
const ownNew = await rpc(member, "create_task", { p_project: project, p_title: "Smoke: my own task", p_size: "L" });
ok(ownNew.ok && ownNew.data.assignee_id === goMember.id && ownNew.data.size === "M", "member creates a task for themselves (size stays M)");
const forOther = await rpc(member, "create_task", { p_project: project, p_title: "Smoke: for someone else", p_assignee: buddy.id });
ok(!forOther.ok, "member cannot create a task for someone else");
const adminMove = await rpc(adminToken, "update_task", { p_task: mine.id, p_patch: { assignee_id: buddy.id, size: "L" } });
ok(adminMove.ok && adminMove.data.assignee_id === buddy.id, "admin reassigns and resizes any task");
const memberProj = await rpc(member, "create_project", { p_name: "Smoke: member project" });
ok(!memberProj.ok, "member cannot create a project");
const proj = await rpc(adminToken, "create_project", { p_name: `Smoke project ${Date.now()}`, p_lead: admin.id, p_members: [goMember.id], p_series: "shapers-tech" });
ok(proj.ok && proj.data.id, "admin adds a project in one step");

// ---- onboarding, setup, graduation, scores
r = await get(newbieToken, `onboarding_progress?select=step_key,done&member_id=eq.${newbie.id}`);
ok(r.ok && r.data.length === 11, "onboarding checklist has 11 steps", `${r.data?.filter((x) => x.done).length} done`);
r = await get(rokToken, `member_overview?select=stalled_days&member_id=eq.${newbie.id}`);
ok(r.ok && r.data[0]?.stalled_days >= 7, "buddy sees the stalled mentee", `${r.data?.[0]?.stalled_days} days`);
ok((await rpc(newbieToken, "complete_onboarding_step", { p_step: "calendar" })).ok, "new member ticks their own step");
ok(!(await rpc(member, "complete_onboarding_step", { p_step: "calendar" })).ok, "a member who isn't onboarding has no steps to tick");
ok((await rpc(rokToken, "join_project", { p_project: project, p_member: newbie.id })).ok, "buddy records a project pick for their mentee");
ok(!(await rpc(rokToken, "propose_graduation", { p_member: newbie.id })).ok, "graduation needs every step done");
ok(!(await rpc(adminToken, "propose_graduation", { p_member: mia.id })).ok, "only the buddy proposes graduation");
ok((await rpc(rokToken, "propose_graduation", { p_member: mia.id })).ok, "buddy proposes ending Mia's onboarding");
ok(!(await rpc(rokToken, "resolve_graduation", { p_member: mia.id, p_approve: true })).ok, "buddy cannot confirm it");
ok((await rpc(adminToken, "resolve_graduation", { p_member: mia.id, p_approve: true })).ok, "admin confirms");
r = await get(adminToken, `members?select=onboarding_active&id=eq.${mia.id}`);
ok(r.data[0].onboarding_active === false, "Mia is out of onboarding");
ok((await rpc(setupToken, "complete_setup", { p_step: "projects" })).ok, "imported member ticks a setup step");
const imp = await rpc(adminToken, "import_roster", { p_rows: [{ name: "Smoke Person", email: `smoke${Date.now()}@sandbox.example`, tier: "impact" }, { name: "Dup", email: goMember.email, tier: "go" }] });
ok(imp.ok && imp.data.added === 1 && imp.data.skipped === 1, "roster import adds new and skips known emails");
ok(!(await rpc(member, "set_tier", { p_member: goMember.id, p_tier: "core" })).ok, "member cannot change a tier");
r = await get(adminToken, "member_scores?select=member_id,total,task_points,hours_points&order=total.desc&limit=3");
ok(r.ok && r.data.length === 3 && r.data[0].total > 0, "leaderboard scores", r.data?.map((x) => x.total).join(","));
r = await get(member, "member_scores?select=member_id");
ok(r.ok && r.data.length === 1, "a GO! member only sees their own score");
r = await get(adminToken, "hour_streaks?select=current_streak,best_streak&order=best_streak.desc&limit=1");
ok(r.ok && r.data[0].best_streak > 0, "streaks are computed", `best ${r.data?.[0]?.best_streak}`);

await api(service, "/rest/v1/app_settings?id=eq.true", { method: "PATCH", body: { check_in_any_time: true }, key: service });
console.log(failures ? `\n${failures} check(s) failed` : "\nAll checks passed");
process.exit(failures ? 1 : 0);
