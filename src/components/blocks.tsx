"use client";

import Link from "next/link";
import { useState } from "react";
import { useApp } from "@/lib/store";
import { score } from "@/lib/score";
import { addDays, fmt, hoursLabel } from "@/lib/dates";
import { headline } from "@/lib/copy";
import { ONBOARDING_STEPS, SETUP_STEPS } from "@/lib/seed";
import { Avatar, Sheet, Signs, first, handle } from "./ui";

/** The week's one-line statement, for both everyday and onboarding mode. */
export function useHeadline(): string {
  const { me, my, today, db, onboardingDone } = useApp();
  const done = onboardingDone(me);
  if (me.onboarding !== null && Object.values(done).some((v) => !v)) {
    const n = Object.values(done).filter(Boolean).length;
    return `You're ${n} of ${ONBOARDING_STEPS.length} steps into Shapers. The rest is the fun part.`;
  }
  return headline(my, db.sessions.some((s) => s.memberId === me.id), today);
}

/** True while a member still has onboarding steps left. */
export function useOnboarding(): boolean {
  const { me } = useApp();
  // Onboarding lasts until the buddy proposes the end and an admin confirms (all 11 steps first).
  return me.onboarding !== null;
}

/** Existing members on their first days in the app: three steps, then the normal home. */
export function SetupCard() {
  const { me, db, setupDone, completeSetup, joinProject } = useApp();
  const [off, setOff] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const done = setupDone(me);
  if (!done || Object.values(done).every(Boolean)) return null;
  const n = Object.values(done).filter(Boolean).length;
  return (
    <section className="sect">
      <div className="label m">Setting up · {n} of {SETUP_STEPS.length}</div>
      <div className="h-l" style={{ marginTop: 10 }}>You already know Shapers. Three things and the app knows you too.</div>
      <div className="rows" style={{ margin: "14px -18px -20px" }}>
        {SETUP_STEPS.map((st) => (
          <div key={st.id} style={{ alignItems: "flex-start", flexWrap: "wrap" }}>
            <div className="grow">
              <div className="k" style={{ textDecoration: done[st.id] ? "line-through" : undefined, color: done[st.id] ? "var(--muted)" : undefined }}>{st.title}</div>
              {!done[st.id] && st.id === "confirm-tier" && (
                <div className="small muted">
                  {off ? "Tell an admin. They change tiers and hours." : `${me.tier}, ${me.weeklyHours} h a week, ${me.tier} since ${fmt.short(me.tierSince)}.`}
                </div>
              )}
              {!done[st.id] && st.id === "projects" && (
                <div className="row" style={{ flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                  {db.projects.map((p) => (
                    <button key={p.id} className={`btn-s ${picked.includes(p.id) ? "on" : ""}`} onClick={() => setPicked(picked.includes(p.id) ? picked.filter((x) => x !== p.id) : [...picked, p.id])}>{p.name}</button>
                  ))}
                </div>
              )}
              {!done[st.id] && st.id === "first-hour" && <div className="small muted">{st.line} It ticks itself.</div>}
            </div>
            {!done[st.id] && st.id === "confirm-tier" && (
              <>
                <button className="btn-s on" onClick={() => completeSetup(me.id, "confirm-tier")}>That&apos;s right</button>
                {!off && <button className="btn-s" onClick={() => setOff(true)}>Not right</button>}
              </>
            )}
            {!done[st.id] && st.id === "projects" && (
              <button className="btn-s on" disabled={!picked.length} onClick={() => picked.forEach((id) => joinProject(me.id, id))}>Save</button>
            )}
            {done[st.id] && <span className="v">Done</span>}
          </div>
        ))}
      </div>
    </section>
  );
}

/** Buddies: mentees who stopped moving, and mentees ready to finish onboarding. */
export function BuddyNudges() {
  const { me, db, stalledDays, onboardingDone } = useApp();
  const mentees = db.members.filter((m) => m.buddyId === me.id && m.onboarding !== null);
  const stuck = mentees.map((m) => ({ m, d: stalledDays(m) })).filter((x) => x.d !== null);
  const ready = mentees.filter((m) => !m.graduation && Object.values(onboardingDone(m)).every(Boolean));
  if (!stuck.length && !ready.length) return null;
  return (
    <section className="sect">
      <div className="label m">Your mentees</div>
      <ul className="compat" style={{ marginTop: 14 }}>
        {stuck.map(({ m, d }) => (
          <li key={m.id}>
            <span className="face">☽</span>
            <div>
              <Link href={`/team/${m.id}`} className="t">{first(m)} hasn&apos;t moved in {d} days</Link>
              <div className="s">Not a warning. A good moment to ask how it&apos;s going.</div>
            </div>
          </li>
        ))}
        {ready.map((m) => (
          <li key={m.id}>
            <span className="face">↑</span>
            <div>
              <Link href={`/team/${m.id}`} className="t">{first(m)} has done every step</Link>
              <div className="s">If they&apos;ve found their place, end their onboarding. An admin confirms.</div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** New members: who their buddy is, and a nudge to ask for help. */
export function BuddyCard() {
  const { me, member, standingOf } = useApp();
  const b = member(me.buddyId);
  if (!b) return null;
  return (
    <section className="sect buddy">
      <div className="label m">Your buddy</div>
      <div className="row" style={{ marginTop: 14 }}>
        <Avatar m={b} />
        <div className="grow">
          <div><span className="h-m">{b.name}</span> <span className="muted small">{handle(b)}</span></div>
          <Signs s={standingOf(b.id)} small />
        </div>
      </div>
      <div className="h-l" style={{ marginTop: 18 }}>Stuck? Ask {first(b)}. That&apos;s what buddies are for.</div>
      <p className="body" style={{ marginTop: 8 }}>
        Nobody expects you to know how Shapers works yet. {first(b)} meets you for twenty minutes every week, and in between
        any question counts: a task you&apos;re unsure about, who to talk to, how to log your hours.
      </p>
      <div className="row" style={{ marginTop: 14, flexWrap: "wrap" }}>
        <span className="mono-lc" style={{ userSelect: "all" }}>{b.email}</span>
        <CopyButton text={b.email} />
      </div>
    </section>
  );
}

function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      className="btn-s"
      onClick={() => navigator.clipboard?.writeText(text).then(() => setDone(true), () => setDone(false))}
    >
      {done ? "Copied" : "Copy email"}
    </button>
  );
}

/** Admins: the members doing best lately, by streak, then hours against their commitment. */
export function TopPerformers() {
  const { db, standingOf, today } = useApp();
  const ranked = db.members
    .filter((m) => m.onboarding === null)
    .map((m) => standingOf(m.id))
    .map((s) => ({ s, sc: score(db, s, today) }))
    .sort((a, b) => b.sc.total - a.sc.total || b.sc.taskPoints - a.sc.taskPoints)
    .slice(0, 5);
  return (
    <section className="sect">
      <div className="label m">Leading the way</div>
      <div className="h-l" style={{ marginTop: 10 }}>Who&apos;s carrying the institute right now.</div>
      <div style={{ marginTop: 10 }}>
        {ranked.map(({ s, sc }, i) => (
          <Link key={s.member.id} href={`/team/${s.member.id}`} className="person" style={{ padding: "12px 0" }}>
            <span className="serif" style={{ fontSize: 26, width: 22 }}>{i + 1}</span>
            <Avatar m={s.member} size="s" />
            <div className="grow">
              <div><span className="nm">{s.member.name}</span><span className="hd">{handle(s.member)}</span></div>
              <Signs s={s} small />
            </div>
            <span className="mono-lc">{sc.total} pt</span>
          </Link>
        ))}
      </div>
      <p className="small muted" style={{ marginTop: 8 }}>Finished task points plus 5 per week at commitment, last six weeks.</p>
      <Link href="/team?view=leaderboard" className="btn" style={{ marginTop: 18 }}>Review everyone&apos;s stats</Link>
    </section>
  );
}

export function LogHoursLink() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="link" onClick={() => setOpen(true)}>Log hours instead</button>
      {open && <LogHours onClose={() => setOpen(false)} />}
    </>
  );
}

export function LogHours({ onClose }: { onClose: () => void }) {
  const { today, logHours } = useApp();
  const [day, setDay] = useState<"today" | "yesterday" | "older">("today");
  const [older, setOlder] = useState(addDays(today, -3));
  const [h, setH] = useState(1);
  const [note, setNote] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const date = day === "today" ? today : day === "yesterday" ? addDays(today, -1) : older;

  if (result)
    return (
      <Sheet title="Log hours" onClose={onClose}>
        <div className="glance">
          <div className="h-l">{result === "logged" ? `${hoursLabel(h)} logged.` : "Sent for approval."}</div>
          <p className="small" style={{ marginTop: 10 }}>
            {result === "logged" ? "It's already in your week." : "Anything older than yesterday goes to an admin first. You'll see it in your week once approved."}
          </p>
          <button className="btn" style={{ marginTop: 26 }} onClick={onClose}>Done</button>
        </div>
      </Sheet>
    );

  return (
    <Sheet title="Log hours" onClose={onClose}>
      <div className="pad stack" style={{ paddingTop: 22 }}>
        <div className="h-l center">When were you at the Hub?</div>
        <div className="row" style={{ justifyContent: "center" }}>
          {(["today", "yesterday", "older"] as const).map((d) => (
            <button key={d} className={`btn-s ${day === d ? "on" : ""}`} onClick={() => setDay(d)}>{d}</button>
          ))}
        </div>
        {day === "older" && (
          <div className="field">
            <label>Date</label>
            <input type="date" value={older} max={addDays(today, -2)} onChange={(e) => setOlder(e.target.value)} />
          </div>
        )}
        <div className="center" style={{ padding: "8px 0" }}>
          <div className="row" style={{ justifyContent: "center", gap: 22 }}>
            <button className="btn-s" onClick={() => setH(Math.max(0.5, h - 0.5))} aria-label="Less">−</button>
            <span className="serif" style={{ fontSize: 54, lineHeight: 1, minWidth: 110 }}>{h}</span>
            <button className="btn-s" onClick={() => setH(Math.min(14, h + 0.5))} aria-label="More">+</button>
          </div>
          <div className="label m" style={{ marginTop: 8 }}>Hours</div>
        </div>
        {day === "older" && (
          <div className="field">
            <label>Note for the admin</label>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Forgot to clock in on Tuesday." />
          </div>
        )}
        <button className="btn block" onClick={() => setResult(logHours(date, h, note))}>
          {day === "older" ? "Request approval" : "Log " + hoursLabel(h)}
        </button>
        <p className="small muted center">Meetings don&apos;t count as hours. Clock in to those separately.</p>
      </div>
    </Sheet>
  );
}

export function AdminToday() {
  const { db, standingOf, me, stalledDays, setupDone } = useApp();
  if (!me.admin) return null;
  const all = db.members.map((m) => standingOf(m.id));
  const behind = all.filter((s) => s.toKeep > 0).sort((a, b) => b.toKeep / b.target - a.toKeep / a.target);
  const up = all.filter((s) => s.flag === "moving-up");
  const down = all.filter((s) => s.flag === "dropping");
  const pending =
    db.backfills.filter((b) => b.status === "pending").length +
    db.pauses.filter((p) => p.status === "requested").length +
    db.members.filter((m) => m.graduation).length;
  const newbies = db.members.filter((m) => m.onboarding !== null).length;
  const stuck = db.members.filter((m) => stalledDays(m) !== null).length;
  const settingUp = db.members.filter((m) => { const d = setupDone(m); return d && !Object.values(d).every(Boolean); }).length;
  return (
    <section className="sect">
      <div className="label m">At the institute</div>
      <div className="h-l" style={{ marginTop: 10 }}>{behind.length} of {all.length} are under their hours this week.</div>
      <ul className="compat" style={{ marginTop: 14 }}>
        <li><span className="face">↑</span><div><Link href="/team?view=up" className="t">Moving up</Link><div className="s">{up.map((s) => first(s.member)).join(", ") || "Nobody yet"}</div></div></li>
        <li className={down.length ? "bad" : ""}><span className="face" style={down.length ? { background: "var(--dark)", color: "#fff" } : undefined}>↓</span><div><Link href="/team?view=dropping" className="t">Dropping</Link><div className="s">{down.map((s) => first(s.member)).join(", ") || "Nobody"}</div></div></li>
        <li><span className="face">✎</span><div><Link href="/team?view=approvals" className="t">Waiting for you</Link><div className="s">{pending} approval{pending === 1 ? "" : "s"}</div></div></li>
        <li><span className="face">⊙</span><div><Link href="/team?view=new" className="t">Onboarding</Link><div className="s">{newbies} new member{newbies === 1 ? "" : "s"}{stuck ? `, ${stuck} stuck a week` : ""}{settingUp ? ` · ${settingUp} still setting up` : ""}</div></div></li>
      </ul>
      <Link href="/team?view=overview" className="arrow" style={{ marginTop: 10 }}>How the institute is doing →</Link>
    </section>
  );
}

