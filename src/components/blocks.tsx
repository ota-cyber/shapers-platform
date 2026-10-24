"use client";

import Link from "next/link";
import { useState } from "react";
import { useApp, attendanceOf } from "@/lib/store";
import { addDays, fmt, hoursLabel } from "@/lib/dates";
import { headline, nextMeeting } from "@/lib/copy";
import { ONBOARDING_STEPS } from "@/lib/seed";
import { Avatar, Img, Sheet, Signs, first, handle } from "./ui";

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
  const { me, onboardingDone } = useApp();
  return me.onboarding !== null && Object.values(onboardingDone(me)).some((v) => !v);
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
  const { db, standingOf } = useApp();
  const ranked = db.members
    .filter((m) => m.onboarding === null)
    .map((m) => standingOf(m.id))
    .sort((a, b) => b.streak - a.streak || b.avg4 / b.target - a.avg4 / a.target)
    .slice(0, 5);
  return (
    <section className="sect">
      <div className="label m">Leading the way</div>
      <div className="h-l" style={{ marginTop: 10 }}>Who&apos;s carrying the institute right now.</div>
      <div style={{ marginTop: 10 }}>
        {ranked.map((s, i) => (
          <Link key={s.member.id} href={`/team/${s.member.id}`} className="person" style={{ padding: "12px 0" }}>
            <span className="serif" style={{ fontSize: 26, width: 22 }}>{i + 1}</span>
            <Avatar m={s.member} size="s" />
            <div className="grow">
              <div><span className="nm">{s.member.name}</span><span className="hd">{handle(s.member)}</span></div>
              <Signs s={s} small />
            </div>
            <span className="mono-lc">{Math.round((s.avg4 / s.target) * 100)}%</span>
          </Link>
        ))}
      </div>
      <p className="small muted" style={{ marginTop: 8 }}>Ranked by streak, then the last four weeks&apos; hours against each member&apos;s commitment.</p>
      <Link href="/team?view=overview" className="btn" style={{ marginTop: 18 }}>Review everyone&apos;s stats</Link>
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

export function NextMeeting() {
  const { db, me, now, liveMeetingId, meetingClockIn, announceAbsence } = useApp();
  const live = liveMeetingId ? db.meetings.find((m) => m.id === liveMeetingId && m.memberIds.includes(me.id)) : undefined;
  const m = live ?? nextMeeting(db, me.id, now);
  const [msg, setMsg] = useState<string | null>(null);
  if (!m) return null;
  const state = attendanceOf(db, m.id, me.id);
  const absent = db.absences.find((a) => a.memberId === me.id && a.meetingId === m.id);
  return (
    <section className="sect">
      <div className="label m">{live ? "Happening now" : "Next meeting"}</div>
      <div className="between" style={{ marginTop: 12, alignItems: "flex-start" }}>
        <div>
          <div className="h-l">{m.series}</div>
          <div className="mono-lc muted" style={{ marginTop: 4 }}>{fmt.weekday(m.start)} {fmt.short(m.start)} · {fmt.time(m.start)}–{fmt.time(m.end)}</div>
          <div className="small muted">{m.location}</div>
        </div>
        <Img name="chair" className="float-img" />
      </div>
      {live ? (
        state === "present" || state === "remote" ? (
          <p className="h-s" style={{ marginTop: 14 }}>You&apos;re in, {state === "remote" ? "remotely" : "in person"}. Meetings don&apos;t count as hours.</p>
        ) : (
          <div className="row" style={{ marginTop: 16 }}>
            <button className="btn" onClick={() => meetingClockIn(m.id, "present")}>I&apos;m here</button>
            <button className="btn outline" onClick={() => meetingClockIn(m.id, "remote")}>Remote</button>
          </div>
        )
      ) : (
        <div style={{ marginTop: 14 }}>
          {absent || msg ? (
            <p className="small">{msg ?? (absent!.excused ? "Absence announced in time. It counts as excused." : "Absence announced late. It will count as unexcused.")}</p>
          ) : (
            <button className="link" onClick={() => setMsg(announceAbsence(m.id) ? "Absence announced in time. It counts as excused. Tell the team on Slack too." : `Less than ${m.series === "Community" ? 72 : 24} h before: this will count as unexcused.`)}>
              I can&apos;t make it
            </button>
          )}
          <p className="small muted" style={{ marginTop: 8 }}>Clock-in opens 15 minutes before it starts.</p>
        </div>
      )}
    </section>
  );
}

export function AdminToday() {
  const { db, standingOf, me } = useApp();
  if (!me.admin) return null;
  const all = db.members.map((m) => standingOf(m.id));
  const behind = all.filter((s) => s.toKeep > 0).sort((a, b) => b.toKeep / b.target - a.toKeep / a.target);
  const up = all.filter((s) => s.flag === "moving-up");
  const down = all.filter((s) => s.flag === "dropping");
  const pending = db.backfills.filter((b) => b.status === "pending").length + db.pauses.filter((p) => p.status === "requested").length;
  const newbies = db.members.filter((m) => m.onboarding !== null).length;
  return (
    <section className="sect">
      <div className="label m">At the institute</div>
      <div className="h-l" style={{ marginTop: 10 }}>{behind.length} of {all.length} are under their hours this week.</div>
      <ul className="compat" style={{ marginTop: 14 }}>
        <li><span className="face">↑</span><div><Link href="/team?view=up" className="t">Moving up</Link><div className="s">{up.map((s) => first(s.member)).join(", ") || "Nobody yet"}</div></div></li>
        <li className={down.length ? "bad" : ""}><span className="face" style={down.length ? { background: "var(--dark)", color: "#fff" } : undefined}>↓</span><div><Link href="/team?view=dropping" className="t">Dropping</Link><div className="s">{down.map((s) => first(s.member)).join(", ") || "Nobody"}</div></div></li>
        <li><span className="face">✎</span><div><Link href="/team?view=approvals" className="t">Waiting for you</Link><div className="s">{pending} approval{pending === 1 ? "" : "s"}</div></div></li>
        <li><span className="face">⊙</span><div><Link href="/team?view=new" className="t">Onboarding</Link><div className="s">{newbies} new member{newbies === 1 ? "" : "s"}</div></div></li>
      </ul>
      <Link href="/team?view=overview" className="arrow" style={{ marginTop: 10 }}>How the institute is doing →</Link>
    </section>
  );
}

