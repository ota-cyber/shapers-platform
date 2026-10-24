"use client";

// The three things that matter, as cards: hours, meetings, tasks.

import Link from "next/link";
import { useApp, attendanceOf, STATUS_LABEL } from "@/lib/store";
import { addDays, fmt, isoDate, weekStart } from "@/lib/dates";
import { myOpenTasks, nextMeeting } from "@/lib/copy";
import { projectColor } from "@/lib/colors";
import { Meter } from "./ui";

export function MeetingsCard() {
  const { me, my, db, now, today, liveMeetingId, meetingClockIn } = useApp();
  const weekEnd = addDays(weekStart(today), 6);
  const week = db.meetings
    .filter((m) => m.memberIds.includes(me.id) && new Date(m.end) > now && isoDate(new Date(m.start)) <= weekEnd)
    .sort((a, b) => a.start.localeCompare(b.start));
  const next = week[0] ?? nextMeeting(db, me.id, now);
  const live = liveMeetingId ? db.meetings.find((m) => m.id === liveMeetingId && m.memberIds.includes(me.id)) : undefined;
  const liveState = live ? attendanceOf(db, live.id, me.id) : null;
  const day = (iso: string) => `${fmt.dow(iso).slice(0, 3)} ${fmt.time(iso)}`;
  return (
    <section className="card">
      <div className="card-h"><span className="label">Attendance</span></div>
      <div className="big"><span className="serif">{Math.round(my.attendanceRate * 100)}%</span><span className="of">attended · {my.attendance.unexcused} unexcused</span></div>
      <div className="lbl-s">Meet this week</div>
      <ul className="card-list">
        {week.map((m) => (
          <li key={m.id}><Link href={`/meetings/${m.id}`}><span>{m.series}</span><span className="mono-lc muted">{day(m.start)}</span></Link></li>
        ))}
        {!week.length && <li className="muted small">Nothing left this week{next ? ` · next: ${next.series}, ${fmt.short(next.start)}` : ""}</li>}
      </ul>
      {live && (
        <div className="card-actions">
          {liveState === "present" || liveState === "remote" ? (
            <span className="small">Clocked in to {live.series}.</span>
          ) : (
            <>
              <button className="btn" onClick={() => meetingClockIn(live.id, "present")}>I&apos;m here · {live.series}</button>
              <button className="btn outline" onClick={() => meetingClockIn(live.id, "remote")}>Remote</button>
            </>
          )}
        </div>
      )}
    </section>
  );
}

export function TasksCard() {
  const { me, db, today } = useApp();
  const open = myOpenTasks(db, me.id);
  const late = open.filter((t) => t.due && t.due < today).length;
  const ids = db.projects.map((p) => p.id);
  return (
    <section className="card">
      <div className="card-h"><span className="label">Tasks</span><Link href="/tasks" className="arrow">Board →</Link></div>
      <div className="big"><span className="serif">{open.length}</span><span className="of">open · {late} late</span></div>
      <div className="lbl-s">Do</div>
      <ul className="card-list">
        {open.slice(0, 4).map((t) => (
          <li key={t.id}>
            <Link href={`/tasks?task=${t.id}`}>
              <span className="row" style={{ gap: 8, minWidth: 0 }}><span className="kb-chip" style={{ background: projectColor(ids, t.projectId) }} /><span className="ellip">{t.title}</span></span>
              <span className={`mono-lc ${t.due && t.due < today ? "" : "muted"}`}>{t.due ? fmt.short(t.due) : STATUS_LABEL[t.status]}</span>
            </Link>
          </li>
        ))}
        {!open.length && <li className="muted small">Nothing pending. Pick something up on the board.</li>}
      </ul>
    </section>
  );
}

/** Admins: the organisation in three numbers. */
export function OrgCards() {
  const { db, standingOf, today } = useApp();
  const all = db.members.map((m) => standingOf(m.id));
  const onTarget = all.filter((s) => s.toKeep === 0).length;
  const att = db.attendance.filter((a) => a.date >= addDays(today, -28));
  const attended = att.filter((a) => a.state === "present" || a.state === "remote").length;
  const doneWeek = db.tasks.filter((t) => t.doneAt && t.doneAt >= weekStart(today)).length;
  const late = db.tasks.filter((t) => t.status !== "done" && t.due && t.due < today).length;
  return (
    <div className="cards">
      <section className="card">
        <div className="card-h"><span className="label">Institute hours</span><Link href="/team?view=overview" className="arrow">Everyone →</Link></div>
        <div className="big"><span className="serif">{onTarget}</span><span className="of">of {all.length} at their hours this week</span></div>
        <Meter value={onTarget} max={all.length} />
      </section>
      <section className="card">
        <div className="card-h"><span className="label">Institute attendance</span><Link href="/team?view=meetings" className="arrow">Record →</Link></div>
        <div className="big"><span className="serif">{att.length ? Math.round((attended / att.length) * 100) : 0}%</span><span className="of">last 4 weeks · {att.filter((a) => a.state === "unexcused").length} unexcused</span></div>
        <Meter value={attended} max={Math.max(1, att.length)} />
      </section>
      <section className="card">
        <div className="card-h"><span className="label">Institute tasks</span><Link href="/tasks" className="arrow">Board →</Link></div>
        <div className="big"><span className="serif">{doneWeek}</span><span className="of">done this week · {late} late</span></div>
      </section>
    </div>
  );
}

/** Admins: recent meetings, with how many attendances are recorded. */
export function RecordMeetings() {
  const { db, today } = useApp();
  const past = db.meetings.filter((m) => isoDate(new Date(m.start)) <= today).sort((a, b) => b.start.localeCompare(a.start)).slice(0, 14);
  const recorded = (series: string, d: string) => db.attendance.filter((a) => a.series === series && a.date === d).length;
  return (
    <>
      <div className="sect"><div className="h-l">Record attendance</div><p className="small muted" style={{ marginTop: 6 }}>Open a meeting, mark everyone present in one tap, then change the exceptions.</p></div>
      <div className="rows">
        {past.map((m) => {
          const n = recorded(m.series, isoDate(new Date(m.start)));
          return (
            <Link key={m.id} href={`/meetings/${m.id}`}>
              <span className="planet" />
              <span className="k">{m.series}<br /><span className="muted">{fmt.dow(m.start)} {fmt.short(m.start)} · {fmt.time(m.start)}</span></span>
              <span className={n ? "v" : "tag"}>{n ? `${n}/${m.memberIds.length}` : "Record"}</span>
              <span className="go">→</span>
            </Link>
          );
        })}
      </div>
    </>
  );
}
