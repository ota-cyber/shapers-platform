"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { useApp } from "@/lib/store";
import { fmt, hoursLabel } from "@/lib/dates";
import { myOpenTasks } from "@/lib/copy";
import { ONBOARDING_STEPS } from "@/lib/seed";
import { score, TASK_POINTS } from "@/lib/score";
import type { TierId } from "@/lib/types";
import { AttendanceRecord, CompletedTasks, TierChart } from "@/components/profile";
import { MeetingsCard } from "@/components/home";
import { WeekTimeline } from "@/components/week";
import { Avatar, Meter, Signs, first, handle } from "@/components/ui";

/** Team → a member: their week first, then everything their profile shows. */
export default function MemberPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { member, standingOf, me, db, today, onboardingDone, setTier, completeStep, stalledDays, proposeGraduation, resolveGraduation } = useApp();
  const [pendingTier, setPendingTier] = useState<TierId | null>(null);
  const m = member(id);
  if (!m) return <div className="empty">No such member.</div>;
  const s = standingOf(m.id);
  const isBuddy = me.id === m.buddyId;
  const canSeeAll = me.admin || me.tier === "Core" || isBuddy || me.id === m.id;
  const buddy = member(m.buddyId);
  const done = onboardingDone(m);
  const allDone = Object.values(done).every(Boolean);
  const stalled = stalledDays(m);
  const sc = score(db, s, today);
  const open = myOpenTasks(db, m.id);

  return (
    <div className="page member">
      <div className="phead" style={{ paddingTop: 14 }}>
        <button onClick={() => router.back()} aria-label="Back" style={{ fontSize: 22, width: 22 }}>‹</button>
        <Avatar m={m} />
        <div className="grow">
          <div><span className="name">{m.name}</span><span className="handle">{handle(m)}</span></div>
          <Signs s={s} />
        </div>
      </div>

      {!canSeeAll ? (
        <div className="empty">Only {first(m)}, their buddy, Core members and admins see the details.</div>
      ) : (
        <>
          {isBuddy && stalled !== null && (
            <div className="home-row"><div className="box">
              <div className="bh">You&apos;re {first(m)}&apos;s buddy</div>
              <div className="bb center">
                <p className="small">No onboarding step has moved in {stalled} days. Ask {first(m)} how it&apos;s going and what&apos;s in the way.</p>
                <p className="mono-lc" style={{ marginTop: 12, userSelect: "all" }}>{m.email}</p>
              </div>
            </div></div>
          )}
          {isBuddy && s.toKeep > 0 && (
            <div className="home-row"><div className="box">
              <div className="bh">You&apos;re {first(m)}&apos;s buddy</div>
              <div className="bb center">
                <p className="small">{first(m)} is {hoursLabel(s.toKeep)} from their week. Not a warning. Just a good moment to ask how it&apos;s going.</p>
                <p className="mono-lc" style={{ marginTop: 12, userSelect: "all" }}>{m.email}</p>
              </div>
            </div></div>
          )}

          <div className="pad"><WeekTimeline memberId={m.id} /></div>

          {/* top row: tasks, attendance, hours, score */}
          <div className="cards four">
            <CompletedTasks memberId={m.id} limit={3} />
            <MeetingsCard memberId={m.id} />
            <section className="card">
              <div className="card-h"><span className="label">Hours</span></div>
              <div className="big"><span className="serif">{hoursLabel(s.thisWeek).replace(" h", "")}</span><span className="of">/ {s.target} h this week</span></div>
              <Meter value={s.thisWeek} max={Math.max(s.target, s.thisWeek)} mark={s.target} />
              <p className="small" style={{ marginTop: 10 }}>
                {s.toKeep > 0 ? `${hoursLabel(s.toKeep)} short of their ${m.tier} week.` : `Week made. ${m.tier} kept.`} {s.streak}-week streak · avg {hoursLabel(s.avg4)}.
              </p>
            </section>
            <section className="card">
              <div className="card-h"><span className="label">Score · last 6 weeks</span></div>
              <div className="big"><span className="serif">{sc.total}</span><span className="of">points</span></div>
              <ul className="card-list">
                <li className="score-row"><span>{sc.tasksDone} task{sc.tasksDone === 1 ? "" : "s"} finished</span><span className="mono-lc">{sc.taskPoints} pt</span></li>
                <li className="score-row"><span>{sc.weeksMet} of {sc.weeksCounted} weeks at {s.target} h</span><span className="mono-lc">{sc.hoursPoints} pt</span></li>
              </ul>
              <p className="small muted" style={{ marginTop: 10 }}>Small {TASK_POINTS.S} · Medium {TASK_POINTS.M} · Large {TASK_POINTS.L} points per finished task, plus 5 per week at commitment.</p>
            </section>
          </div>

          {/* below: hours week by week and meeting stats, as on the profile */}
          <div className="desk-grid two-even" style={{ marginTop: 14 }}>
            <div className="stack">
              <div className="card flush">
                <div className="card-h pad" style={{ paddingTop: 18 }}><span className="label">Hours, week by week</span></div>
                <TierChart s={s} />
              </div>
              <div className="card flush">
                <div className="group-h">Open tasks · {open.length}</div>
                <div className="rows">
                  {open.map((t) => (
                    <Link key={t.id} href={`/tasks?task=${t.id}`}>
                      <span className="k">{t.title}<br /><span className="muted">{db.projects.find((p) => p.id === t.projectId)?.name}{t.due ? ` · due ${fmt.short(t.due)}` : ""}</span></span>
                      <span className="v">{t.size ?? "M"}</span>
                    </Link>
                  ))}
                  {!open.length && <div><span className="k muted">Nothing open</span></div>}
                </div>
              </div>
              {me.admin && (
                <section className="card">
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
            </div>
            <div className="stack">
              <div className="card flush"><AttendanceRecord memberId={m.id} their /></div>
            </div>
          </div>

          {m.onboarding !== null && (
            <>
              <h2 className="sect-title">Onboarding</h2>
              <div className="pad"><div className="card">
                <div className="label">{Object.values(done).filter(Boolean).length} of {ONBOARDING_STEPS.length} steps</div>
                <div className="rows" style={{ margin: "12px -18px 0" }}>
                  {ONBOARDING_STEPS.map((st) => (
                    <button key={st.id} style={{ width: "100%" }} disabled={!me.admin && !isBuddy} onClick={() => !st.auto && completeStep(m.id, st.id, !done[st.id])}>
                      <span className="k" style={{ textAlign: "left", textDecoration: done[st.id] ? "line-through" : undefined, color: done[st.id] ? "var(--muted)" : undefined }}>{st.title}</span>
                      <span className="v">{done[st.id] ? "Done" : st.auto ? "Auto" : me.admin || isBuddy ? "Mark" : ""}</span>
                    </button>
                  ))}
                </div>
                {buddy && <p className="small muted" style={{ marginTop: 10 }}>Buddy: {buddy.name}</p>}
                {m.graduation ? (
                  <div style={{ marginTop: 16 }}>
                    <p className="small">{member(m.graduation.proposedBy)?.name ?? "The buddy"} proposed ending onboarding on {fmt.short(m.graduation.at)}.{me.admin ? "" : " An admin confirms."}</p>
                    {me.admin && (
                      <div className="row" style={{ marginTop: 10, gap: 8 }}>
                        <button className="btn-s on" onClick={() => resolveGraduation(m.id, true)}>Confirm</button>
                        <button className="btn-s" onClick={() => resolveGraduation(m.id, false)}>Not yet</button>
                      </div>
                    )}
                  </div>
                ) : isBuddy && (
                  <div style={{ marginTop: 16 }}>
                    <button className="btn-s on" disabled={!allDone} onClick={() => proposeGraduation(m.id)}>End onboarding</button>
                    <p className="small muted" style={{ marginTop: 8 }}>
                      {allDone ? `When ${first(m)} has found their place. An admin confirms, then home becomes their everyday screen.` : "Every step has to be done first."}
                    </p>
                  </div>
                )}
              </div></div>
            </>
          )}
        </>
      )}
    </div>
  );
}
