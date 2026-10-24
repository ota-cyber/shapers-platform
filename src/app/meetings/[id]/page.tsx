"use client";

import { useParams, useRouter } from "next/navigation";
import { useApp, attendanceOf } from "@/lib/store";
import { fmt, isoDate } from "@/lib/dates";
import type { AttendanceState } from "@/lib/types";
import { Avatar, Img, handle } from "@/components/ui";

const STATES: { id: AttendanceState; short: string }[] = [
  { id: "present", short: "Here" },
  { id: "remote", short: "Remote" },
  { id: "excused", short: "Excused" },
  { id: "unexcused", short: "Absent" },
];

export default function MeetingPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { db, me, today, member, recordAttendance, meetingClockIn, liveMeetingId } = useApp();
  const m = db.meetings.find((x) => x.id === id);
  if (!m) return <div className="empty">No such meeting.</div>;
  const started = isoDate(new Date(m.start)) <= today || liveMeetingId === m.id;
  const people = m.memberIds.map((i) => member(i)).filter(Boolean).sort((a, b) => a!.name.localeCompare(b!.name));
  const states = people.map((p) => attendanceOf(db, m.id, p!.id));
  const count = (s: AttendanceState) => states.filter((x) => x === s).length;
  const mine = attendanceOf(db, m.id, me.id);
  const notices = db.absences.filter((a) => a.meetingId === m.id);

  return (
    <div className="page narrow">
      <div className="panel-d">
        <div className="mhead" style={{ position: "static" }}>
          <button className="side" onClick={() => router.back()} aria-label="Back" style={{ fontSize: 22 }}>‹</button>
          <span className="mono-lc" style={{ textAlign: "center", color: "var(--ink)" }}>{m.series}</span>
          <span />
        </div>
        <section className="sect center">
          <Img name="chair" className="float-img" />
          <div className="h-l" style={{ marginTop: 6 }}>{m.series} meeting</div>
          <div className="mono-lc muted" style={{ marginTop: 6 }}>{fmt.weekday(m.start)} {fmt.monthDay(m.start)} · {fmt.time(m.start)}–{fmt.time(m.end)}</div>
          <div className="small muted">{m.location} · read from Google Calendar</div>
          {m.memberIds.includes(me.id) && started && !me.admin && (
            mine === "present" || mine === "remote" ? (
              <p className="h-s" style={{ marginTop: 18 }}>You clocked in {mine === "remote" ? "remotely" : "in person"}.</p>
            ) : (
              <div className="row" style={{ justifyContent: "center", marginTop: 18 }}>
                <button className="btn" onClick={() => meetingClockIn(m.id, "present")}>I&apos;m here</button>
                <button className="btn outline" onClick={() => meetingClockIn(m.id, "remote")}>Remote</button>
              </div>
            )
          )}
        </section>

        {me.admin && (
          <>
            <section className="sect center">
              <div className="h-l">{count("present") + count("remote")} of {people.length} were there.</div>
              <p className="small muted" style={{ marginTop: 6 }}>
                {count("excused")} excused · {count("unexcused")} absent · {states.filter((s) => !s).length} not recorded
              </p>
              {started && (
                <button className="btn" style={{ marginTop: 16 }} onClick={() => people.forEach((p, i) => !states[i] && recordAttendance(m.id, p!.id, "present"))}>
                  Mark the rest present
                </button>
              )}
              {!started && <p className="small" style={{ marginTop: 12 }}>Recording opens when the meeting starts.</p>}
            </section>
            <div>
              {people.map((p, i) => {
                const notice = notices.find((n) => n.memberId === p!.id);
                return (
                  <div key={p!.id} className="person" style={{ flexWrap: "wrap" }}>
                    <Avatar m={p!} size="s" />
                    <div className="grow">
                      <div><span className="nm">{p!.name}</span><span className="hd">{handle(p!)}</span></div>
                      <div className="signs s"><span>⊙ {p!.tier}</span>{notice && <span>✎ notice {notice.excused ? "in time" : "late"}</span>}</div>
                    </div>
                    <div className="row" style={{ gap: 6 }}>
                      {STATES.map((st) => (
                        <button key={st.id} className={`btn-s ${states[i] === st.id ? "on" : ""}`} disabled={!started} onClick={() => recordAttendance(m.id, p!.id, st.id)}>{st.short}</button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            {m.series === "Community" && <p className="small muted pad" style={{ padding: "16px var(--gutter) 30px" }}>A GO! member marked absent from Community gets a task: read the minutes and pick up one general task within 14 days.</p>}
          </>
        )}

        {!me.admin && (
          <div className="rows">
            {people.map((p, i) => (
              <div key={p!.id}><span className="k">{p!.name}</span><span className="v">{p!.id === me.id ? (states[i] ?? "—") : ""}</span></div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
