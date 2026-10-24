"use client";

import Link from "next/link";
import { useApp } from "@/lib/store";
import { fmt, isoDate } from "@/lib/dates";
import { MeetingsCard } from "@/components/home";
import { NextMeeting } from "@/components/blocks";
import { AttendanceRecord } from "@/components/profile";

export default function MeetingsPage() {
  const { db, me, now, today } = useApp();
  const mine = me.admin ? db.meetings : db.meetings.filter((m) => m.memberIds.includes(me.id));
  const past = mine.filter((m) => isoDate(new Date(m.start)) <= today).sort((a, b) => b.start.localeCompare(a.start)).slice(0, 12);
  const next = mine.filter((m) => new Date(m.start) > now).sort((a, b) => a.start.localeCompare(b.start)).slice(0, 8);
  const recorded = (id: string) => {
    const m = db.meetings.find((x) => x.id === id)!;
    const d = isoDate(new Date(m.start));
    return db.attendance.filter((a) => a.series === m.series && a.date === d).length;
  };
  const Row = ({ id, past: isPast }: { id: string; past?: boolean }) => {
    const m = db.meetings.find((x) => x.id === id)!;
    const n = recorded(m.id);
    return (
      <Link href={`/meetings/${m.id}`}>
        <span className="planet" />
        <span className="k">{m.series}<br /><span className="muted">{fmt.dow(m.start)} {fmt.short(m.start)} · {fmt.time(m.start)}</span></span>
        {me.admin && isPast && <span className={n ? "v" : "tag"}>{n ? `${n}/${m.memberIds.length}` : "Record"}</span>}
        <span className="go">→</span>
      </Link>
    );
  };
  return (
    <div className="page">
      <div className="home-head">
        <h1 className="page-title">Meetings</h1>
        <p className="mono-lc muted">Six series, read from Google Calendar. Clock in when a meeting starts; it never counts as hours.</p>
      </div>
      <div className="desk-grid two-even">
        <div className="stack">
          <MeetingsCard />
          <div className="card flush"><NextMeeting /></div>
          <div className="card flush"><AttendanceRecord memberId={me.id} /></div>
        </div>
        <div className="stack">
          <div className="card flush">
            <div className="group-h">Coming up</div>
            <div className="rows">{next.map((m) => <Row key={m.id} id={m.id} />)}</div>
          </div>
          <div className="card flush">
            <div className="group-h">{me.admin ? "Recent · record attendance" : "Recent"}</div>
            <div className="rows">{past.map((m) => <Row key={m.id} id={m.id} past />)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
