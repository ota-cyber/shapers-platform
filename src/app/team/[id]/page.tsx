"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { useApp } from "@/lib/store";
import { fmt, hoursLabel } from "@/lib/dates";
import { memberSummary, myOpenTasks } from "@/lib/copy";
import { ONBOARDING_STEPS } from "@/lib/seed";
import { TIERS } from "@/lib/tiers";
import type { TierId } from "@/lib/types";
import { AttendanceRecord, PathCard, TierChart } from "@/components/profile";
import { Avatar, Signs, Tabs, Useful, first, handle } from "@/components/ui";

type Tab = "overview" | "hours" | "meetings" | "tasks";

export default function MemberPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { member, standingOf, me, db, today, onboardingDone, setTier, completeStep } = useApp();
  const [tab, setTab] = useState<Tab>("overview");
  const [pendingTier, setPendingTier] = useState<TierId | null>(null);
  const m = member(id);
  if (!m) return <div className="empty">No such member.</div>;
  const s = standingOf(m.id);
  const isBuddy = me.id === m.buddyId;
  const canSeeAll = me.admin || isBuddy || me.id === m.id;
  const buddy = member(m.buddyId);
  const done = onboardingDone(m);
  const tasksDone = db.tasks.filter((t) => t.assigneeId === m.id && t.status === "done").sort((a, b) => (b.doneAt ?? "").localeCompare(a.doneAt ?? ""));
  const open = myOpenTasks(db, m.id);

  const head = (
    <>
      <div className="phead" style={{ paddingTop: 14 }}>
        <button onClick={() => router.back()} aria-label="Back" style={{ fontSize: 22, width: 22 }}>‹</button>
        <Avatar m={m} />
        <div className="grow">
          <div><span className="name">{handle(m)}</span></div>
          <Signs s={s} />
        </div>
      </div>
      <Tabs items={[{ id: "overview", label: "Overview" }, { id: "hours", label: "Hours" }, { id: "meetings", label: "Meetings" }, { id: "tasks", label: "Tasks" }]} value={tab} onChange={setTab} />
    </>
  );

  const faces = [
    { t: "Hours this week", s: `${hoursLabel(s.thisWeek)} of ${s.target}`, ok: s.toKeep === 0, mid: s.thisWeek >= s.target * 0.5 },
    { t: "Streak", s: `${s.streak} week${s.streak === 1 ? "" : "s"} at ${m.tier}`, ok: s.streak >= 3, mid: s.streak >= 1 },
    { t: "Meetings", s: `${Math.round(s.attendanceRate * 100)}% attended · ${s.attendance.unexcused} unexcused`, ok: s.attendance.unexcused === 0, mid: s.attendanceRate >= 0.75 },
    { t: "Tasks", s: `${tasksDone.length} done · ${open.length} open`, ok: tasksDone.length > 0, mid: open.length > 0 },
    { t: "Time in tier", s: `${s.monthsInTier.toFixed(1)} months in ${m.tier}`, ok: m.tier !== "GO!" || s.readiness.time, mid: true },
  ];

  const overview = (
    <>
      <section className="sect">
        <div><span className="h-l">Today</span> <span className="mono-lc muted" style={{ marginLeft: 6 }}>{fmt.monthDay(today)}</span></div>
        <p className="body" style={{ marginTop: 8 }}>{memberSummary(s, me)}</p>
        <div style={{ marginTop: 14 }}><Useful /></div>
      </section>

      {isBuddy && s.toKeep > 0 && (
        <section className="sect">
          <div className="box">
            <div className="bh">You&apos;re {first(m)}&apos;s buddy</div>
            <div className="bb center">
              <p className="small">{first(m)} is {hoursLabel(s.toKeep)} from their week. Not a warning. Just a good moment to ask how it&apos;s going.</p>
              <p className="mono-lc" style={{ marginTop: 12, userSelect: "all" }}>{m.email}</p>
            </div>
          </div>
        </section>
      )}

      <section className="sect">
        <div className="h-l">How it&apos;s going</div>
        <ul className="compat" style={{ marginTop: 10 }}>
          {faces.map((f) => (
            <li key={f.t} className={!f.ok && !f.mid ? "bad" : ""}>
              <span className="face bar">{f.ok ? ":)" : f.mid ? ":|" : ":("}</span>
              <div><div className="t">{f.t}</div><div className="s">{f.s} →</div></div>
            </li>
          ))}
        </ul>
      </section>

      {m.onboarding !== null && (
        <section className="sect">
          <div className="label">Onboarding · {Object.values(done).filter(Boolean).length} of {ONBOARDING_STEPS.length}</div>
          <div className="rows" style={{ margin: "12px calc(var(--gutter) * -1) 0" }}>
            {ONBOARDING_STEPS.map((st) => (
              <button key={st.id} style={{ width: "100%" }} disabled={!me.admin && !isBuddy} onClick={() => !st.auto && completeStep(m.id, st.id, !done[st.id])}>
                <span className="k" style={{ textAlign: "left", textDecoration: done[st.id] ? "line-through" : undefined, color: done[st.id] ? "var(--muted)" : undefined }}>{st.title}</span>
                <span className="v">{done[st.id] ? "Done" : st.auto ? "Auto" : me.admin || isBuddy ? "Mark" : ""}</span>
              </button>
            ))}
          </div>
          {buddy && <p className="small muted" style={{ marginTop: 10 }}>Buddy: {buddy.name}</p>}
        </section>
      )}

      <section className="sect stack">
        <div className="blackcard">
          <div className="glyph">⊙</div>
          <div className="bh">Hours<br />Commitment: {s.target} h<br />This week: {hoursLabel(s.thisWeek)}</div>
          <p>Average over the last four weeks: {hoursLabel(s.avg4)}. {Math.round(s.consistency * 100)}% of tracked weeks were at target.</p>
          <p>{s.trend === "up" ? "The last two weeks trend up." : s.trend === "down" ? "The last two weeks dipped below the two before." : "Steady over the last month."}</p>
        </div>
        <div className="blackcard white">
          <div className="glyph">☽</div>
          <div className="bh">Meetings<br />Series: {m.series.length}</div>
          <p>{s.attendance.present} present, {s.attendance.remote} remote, {s.attendance.excused} excused, {s.attendance.unexcused} unexcused.</p>
          <p>{m.tier === "GO!" ? "GO! attends Community in person; each unexcused Community miss creates a task within 14 days." : TIERS.find((t) => t.id === m.tier)!.community}</p>
        </div>
      </section>

      {me.id !== m.id && <PathCard s={s} />}

      {me.admin && (
        <section className="sect">
          <div className="label">Admin</div>
          <div className="row" style={{ marginTop: 12, flexWrap: "wrap" }}>
            <span className="small">Tier</span>
            {(["GO!", "Impact", "Core"] as TierId[]).map((t) => (
              <button key={t} className={`btn-s ${m.tier === t ? "on" : ""}`} onClick={() => m.tier !== t && setPendingTier(t)}>{t}</button>
            ))}
          </div>
          {pendingTier && (
            <div className="row" style={{ marginTop: 12, flexWrap: "wrap" }}>
              <span className="small grow">Move {first(m)} to {pendingTier}? The time-in-tier clock restarts today.</span>
              <button className="btn-s on" onClick={() => { setTier(m.id, pendingTier); setPendingTier(null); }}>Move</button>
              <button className="btn-s" onClick={() => setPendingTier(null)}>Cancel</button>
            </div>
          )}
        </section>
      )}
    </>
  );

  const tasks = (
    <>
      <div className="group-h">Open</div>
      <div className="rows">
        {open.map((t) => (
          <Link key={t.id} href={`/tasks?task=${t.id}`}>
            <span className="k">{t.title}<br /><span className="muted">{db.projects.find((p) => p.id === t.projectId)?.name}{t.due ? ` · due ${fmt.short(t.due)}` : ""}</span></span>
            <span className="go">→</span>
          </Link>
        ))}
        {!open.length && <div><span className="k muted">Nothing open</span></div>}
      </div>
      <div className="group-h">Finished · {tasksDone.length}</div>
      <div className="rows">
        {tasksDone.map((t) => (
          <div key={t.id}><span className="k">{t.title}</span><span className="v">{t.doneAt ? fmt.short(t.doneAt) : ""}</span></div>
        ))}
        {!tasksDone.length && <div><span className="k muted">None yet</span></div>}
      </div>
      <div style={{ height: 30 }} />
    </>
  );

  const body = !canSeeAll && tab !== "overview" ? (
    <div className="empty">Only {first(m)}, their buddy and admins see the details.</div>
  ) : tab === "overview" ? overview : tab === "hours" ? <TierChart s={s} /> : tab === "meetings" ? <AttendanceRecord memberId={m.id} /> : tasks;

  return (
    <div className="page narrow">
      <div className="panel-d">{head}{body}</div>
    </div>
  );
}
