"use client";

import Link from "next/link";
import { useState } from "react";
import { useApp } from "@/lib/store";
import { addDays, fmt, hoursLabel, weekStart } from "@/lib/dates";
import { TIERS, attendanceFor, badges, type Standing } from "@/lib/tiers";
import type { AttendanceState } from "@/lib/types";
import { Avatar, Img, Signs, handle } from "./ui";

export function ProfileHead({ s, you }: { s: Standing; you?: boolean }) {
  const m = s.member;
  return (
    <div className="phead">
      <Avatar m={m} />
      <div className="grow">
        <div>
          <span className="name">{you ? "You" : m.name.split(" ")[0]}</span>
          <span className="handle">{handle(m)}</span>
        </div>
        <Signs s={s} />
      </div>
    </div>
  );
}

export function WeekStrip({ memberId }: { memberId: string }) {
  const { today, db } = useApp();
  const [sel, setSel] = useState(today);
  const ws = weekStart(today);
  const days = Array.from({ length: 7 }, (_, i) => addDays(ws, i));
  const meetingsOn = (d: string) => db.meetings.filter((m) => m.memberIds.includes(memberId) && m.start.slice(0, 10) === d);
  const selMeetings = meetingsOn(sel);
  return (
    <>
      <div className="week">
        {days.map((d) => (
          <button key={d} className={`${d === today ? "today" : ""} ${d === sel ? "sel" : ""}`} onClick={() => setSel(d)}>
            <span className="dw">{d === today ? "TODAY" : fmt.dow(d)}</span>
            <span className="dn">{fmt.dayNum(d)}</span>
            <span className="h">{meetingsOn(d).length ? "•" : ""}</span>
          </button>
        ))}
      </div>
      {sel !== today || selMeetings.length ? (
        <div className="notice">
          {selMeetings.length
            ? selMeetings.map((m) => `${m.series} ${fmt.time(m.start)}`).join(" · ")
            : `Nothing on the calendar ${sel === today ? "today" : "on " + fmt.weekday(sel)}.`}
        </div>
      ) : null}
    </>
  );
}

const face = (ok: boolean | null) => (ok === null ? ":|" : ok ? ":)" : ":(");

export function PathCard({ s, href, hidePace }: { s: Standing; href?: string; hidePace?: boolean }) {
  const { db, today } = useApp();
  const m = s.member;
  if (!s.nextRule)
    return (
      <section className="sect">
        <div className="label">Path</div>
        <div className="h-l" style={{ marginTop: 10 }}>Core is the top of the ladder.</div>
        <p className="body" style={{ marginTop: 8 }}>Your hours set the pace for everyone below. {hoursLabel(s.avg4)} a week, on average, lately.</p>
      </section>
    );
  const months = Math.min(6, s.monthsInTier);
  const counted = s.weeks.filter((w) => !w.current && !w.paused);
  // Finished tasks weigh more than hours: show them against the hours clocked.
  const doneTasks = db.tasks.filter((t) => t.assigneeId === m.id && t.status === "done");
  const recent = doneTasks.filter((t) => t.doneAt && t.doneAt >= addDays(today, -28)).length;
  const clocked = s.weeks.reduce((sum, w) => sum + w.hours, 0);
  const kept = counted.filter((w) => w.kept).length;
  return (
    <section className="sect">
      <div className="label">Path</div>
      <div className="h-l" style={{ marginTop: 10 }}>Your way to {s.nextRule.id}</div>
      <ul className="compat" style={{ marginTop: 12 }}>
        <li className={recent > 0 ? "" : "bad"}>
          <span className="face bar">{face(recent > 0)}</span>
          <div className="grow">
            <div className="t">Tasks finished</div>
            <div className="s">{doneTasks.length} done in {hoursLabel(clocked)} clocked · {recent} in the last 4 weeks</div>
          </div>
        </li>
        {m.tier === "GO!" ? (
          <li className={s.readiness.time ? "" : ""}>
            <span className="face">{face(s.readiness.time)}</span>
            <div className="grow">
              <div className="t">Time in GO!</div>
              <div className="s">Month {Math.max(1, Math.ceil(months))} of 6 · since {fmt.short(m.tierSince)}</div>
            </div>
          </li>
        ) : (
          <li>
            <span className="face">{face(null)}</span>
            <div className="grow"><div className="t">Recognition</div><div className="s">Core is by leadership recognition, not a clock</div></div>
          </li>
        )}
        <li className={s.readiness.hours ? "" : "bad"}>
          <span className="face bar">{face(s.readiness.hours)}</span>
          <div className="grow"><div className="t">Hours, week after week</div><div className="s">{kept} of {counted.length} weeks at {s.target} h · avg {hoursLabel(s.avg4)}</div></div>
        </li>
        <li className={s.readiness.attendance ? "" : "bad"}>
          <span className="face bar">{face(s.readiness.attendance)}</span>
          <div className="grow"><div className="t">Showing up</div><div className="s">{Math.round(s.attendanceRate * 100)}% attended · {s.attendance.unexcused} unexcused</div></div>
        </li>
        {!hidePace && (
          <li>
            <span className="face">{face(s.toNextPace === 0)}</span>
            <div className="grow"><div className="t">{s.nextRule.id} pace this week</div><div className="s">{s.toNextPace === 0 ? "You're there" : `${hoursLabel(s.toNextPace!)} to ${s.nextRule.weeklyHours} h`}</div></div>
          </li>
        )}
      </ul>
      <p className="small muted" style={{ marginTop: 12 }}>Leadership decides promotions. This shows readiness, not a promise.</p>
      {href && <Link href={href} className="arrow" style={{ marginTop: 12 }}>Details →</Link>}
    </section>
  );
}

export function TierChart({ s }: { s: Standing }) {
  const [mode, setMode] = useState<"table" | "circle">("table");
  return (
    <section style={{ padding: "22px 0" }}>
      <div className="toggle" role="tablist">
        <button role="tab" aria-selected={mode === "table"} onClick={() => setMode("table")}>Table</button>
        <span className="sep">|</span>
        <button role="tab" aria-selected={mode === "circle"} onClick={() => setMode("circle")}>Circle</button>
      </div>
      <div style={{ marginTop: 20 }}>{mode === "table" ? <WeeksTable s={s} /> : <WeeksWheel s={s} />}</div>
    </section>
  );
}

function WeeksTable({ s }: { s: Standing }) {
  const rows = [...s.weeks].reverse();
  return (
    <div style={{ display: "grid", gridTemplateColumns: "22px 1fr 22px", gap: 6, padding: "0 6px" }}>
      <div className="side-label" style={{ alignSelf: "start", paddingTop: 8 }}>WEEKS</div>
      <div className="ctable">
        {rows.map((w) => {
          const cls = w.current ? "cur" : w.kept ? "kept" : "miss";
          const state = w.current ? (w.kept ? "made · in progress" : "in progress") : w.paused ? "paused" : w.kept ? "kept " + s.member.tier : "under";
          return [
            <div key={w.weekStart + "a"} className={cls}>{fmt.short(w.weekStart)}</div>,
            <div key={w.weekStart + "b"} className={cls}>{w.kept ? "⊙" : w.paused ? "॥" : "○"}&nbsp; {state}</div>,
            <div key={w.weekStart + "c"} className={cls}>{Math.round(w.hours * 10) / 10}</div>,
          ];
        })}
      </div>
      <div className="side-label" style={{ alignSelf: "end", paddingBottom: 8 }}>HOURS</div>
    </div>
  );
}

function WeeksWheel({ s }: { s: Standing }) {
  const weeks = s.weeks;
  const n = weeks.length;
  const max = Math.max(s.target * 1.6, ...weeks.map((w) => w.hours));
  const R0 = 46, R1 = 118, RING = 138;
  const r = (h: number) => R0 + (Math.min(h, max) / max) * (R1 - R0);
  const ang = (i: number) => (i / n) * Math.PI * 2 - Math.PI / 2;
  const pt = (a: number, rad: number) => [150 + Math.cos(a) * rad, 150 + Math.sin(a) * rad];
  return (
    <svg viewBox="0 0 300 300" style={{ width: "100%", maxWidth: 380, margin: "0 auto", display: "block" }} role="img" aria-label="Weekly hours wheel">
      <circle cx="150" cy="150" r={RING + 12} fill="#141414" />
      <circle cx="150" cy="150" r={RING - 8} fill="#fbfbfb" />
      <circle cx="150" cy="150" r={R1} fill="none" stroke="#e0e0e0" />
      <circle cx="150" cy="150" r={r(s.target)} fill="none" stroke="#141414" strokeDasharray="3 3" />
      {s.nextRule && s.nextRule.weeklyHours <= max && <circle cx="150" cy="150" r={r(s.nextRule.weeklyHours)} fill="none" stroke="#999" strokeDasharray="1 3" />}
      <circle cx="150" cy="150" r={R0 - 6} fill="none" stroke="#e0e0e0" />
      {weeks.map((w, i) => {
        const a = ang(i);
        const [x1, y1] = pt(a, R0);
        const [x2, y2] = pt(a, r(w.hours));
        const [lx, ly] = pt(a, RING + 2);
        const raw = (a * 180) / Math.PI + 90;
        const deg = raw > 90 && raw < 270 ? raw + 180 : raw;
        return (
          <g key={w.weekStart}>
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={w.kept ? "#141414" : "#9a9a9a"} strokeWidth={w.current ? 1 : 1.2} strokeDasharray={w.current ? "2 2" : undefined} />
            <circle cx={x2} cy={y2} r={3.2} fill={w.kept ? "#141414" : "#fbfbfb"} stroke="#141414" />
            <text x={lx} y={ly} fill="#fbfbfb" fontSize="7.5" fontFamily="var(--mono)" letterSpacing="1" textAnchor="middle" dominantBaseline="middle" transform={`rotate(${deg} ${lx} ${ly})`}>
              {fmt.short(w.weekStart).toUpperCase()}
            </text>
          </g>
        );
      })}
      <text x="150" y="146" textAnchor="middle" fontFamily="var(--serif)" fontSize="26" fill="#141414">{s.streak}</text>
      <text x="150" y="162" textAnchor="middle" fontFamily="var(--mono)" fontSize="6.5" letterSpacing="1.2" fill="#666">WEEK STREAK</text>
      <text x="150" y={150 - r(s.target) - 4} textAnchor="middle" fontFamily="var(--mono)" fontSize="6" letterSpacing="1" fill="#141414">{s.target} H</text>
    </svg>
  );
}

const TIER_ICON = ["planet w", "planet", "planet d"];

export function TiersTable({ current }: { current?: string }) {
  return (
    <div className="ptable">
      {TIERS.map((t, i) => (
        <div key={t.id} style={current === t.id ? { background: "#efefef" } : undefined}>
          <div className="a"><span className={TIER_ICON[i]} />{t.id}</div>
          <div className="b">
            <span>{t.presence}{current === t.id && <span className="tag" style={{ marginLeft: 8 }}>You</span>}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export function TierRules({ tier }: { tier: string }) {
  const t = TIERS.find((x) => x.id === tier)!;
  return (
    <div className="blackcard">
      <div className="glyph">{t.glyph}</div>
      <div className="bh">{t.name}<br />{t.presence}<br />Notice period: {t.notice}</div>
      <p>{t.who}</p>
      <p><b style={{ fontWeight: 500 }}>Community meetings.</b> {t.community}</p>
      {t.absence !== "Not defined" && <p><b style={{ fontWeight: 500 }}>Absences.</b> {t.absence}</p>}
      {t.consequence !== "Not defined" && <p><b style={{ fontWeight: 500 }}>If you miss one.</b> {t.consequence}</p>}
      <p><b style={{ fontWeight: 500 }}>Pauses.</b> {t.pause} Pause weeks never count as falling behind and never break a streak.</p>
    </div>
  );
}

const STATE_LABEL: Record<AttendanceState, string> = { present: "Present", remote: "Remote", excused: "Missed · excused", unexcused: "Missed · unexcused" };

export function AttendanceRecord({ memberId }: { memberId: string }) {
  const { db } = useApp();
  const rows = attendanceFor(db, memberId);
  const by = (st: AttendanceState) => rows.filter((r) => r.state === st);
  const seriesCount = (list: typeof rows) => {
    const c: Record<string, number> = {};
    list.forEach((r) => (c[r.series] = (c[r.series] ?? 0) + 1));
    return Object.entries(c).map(([k, v]) => `${k} × ${v}`);
  };
  return (
    <div className="stack" style={{ padding: "22px var(--gutter)" }}>
      <div className="label center">Your record, all six series</div>
      <p className="small center" style={{ marginTop: 4 }}>Meetings come from the Google Calendar. Meetings never count as hours.</p>
      <div className="box">
        <div className="bh">Present · {by("present").length}</div>
        <div className="bb">{seriesCount(by("present")).map((x) => <div key={x} className="ci">{x}</div>)}{!by("present").length && <div className="ci muted">Not yet</div>}</div>
      </div>
      <div className="box hatch">
        <div className="bh">Remote · {by("remote").length}</div>
        <div className="bb">{seriesCount(by("remote")).map((x) => <div key={x} className="ci">{x}</div>)}{!by("remote").length && <div className="ci muted">None</div>}</div>
      </div>
      <div className="box grey">
        <div className="bh">Missed · {by("excused").length + by("unexcused").length}</div>
        <div className="bb">
          <div className="ci">{by("excused").length} excused</div>
          <div className="ci">{by("unexcused").length} unexcused</div>
        </div>
      </div>
      <div className="rows" style={{ marginTop: 22, marginLeft: "calc(var(--gutter) * -1)", marginRight: "calc(var(--gutter) * -1)" }}>
        {rows.slice(0, 12).map((r) => (
          <div key={r.series + r.date}>
            <span className="k">{r.series} · {fmt.short(r.date)}</span>
            <span className="v" style={r.state === "unexcused" ? { background: "var(--dark)", color: "#fff", padding: "2px 6px" } : undefined}>{STATE_LABEL[r.state]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Badges({ s }: { s: Standing }) {
  const { db } = useApp();
  const list = badges(db, s);
  return (
    <section className="sect">
      <div className="label">Badges · {list.filter((b) => b.earned).length} of {list.length}</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 18, marginTop: 18 }}>
        {list.map((b) => (
          <div key={b.id} className="center" style={{ opacity: b.earned ? 1 : 0.3 }}>
            <Img name={b.image} className="" alt="" />
            <div className="h-s" style={{ marginTop: 6 }}>{b.name}</div>
            <div className="small muted">{b.earned ? b.line : "Not yet"}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

export { Img };
