"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useApp } from "@/lib/store";
import { elapsed } from "@/lib/dates";

const NAV = [
  { href: "/", label: "Home" },
  { href: "/team", label: "Team" },
  { href: "/ask", label: "Ask" },
  { href: "/tasks", label: "Tasks" },
  { href: "/you", label: "You" },
];

const DEMO_PEOPLE = [
  { id: "petra.jerman", label: "Petra · GO!" },
  { id: "lea.zorman", label: "Lea · new" },
  { id: "rok.golob", label: "Rok · Impact" },
  { id: "ana.kovac", label: "Ana · admin" },
];

export function Wordmark() {
  return <span className="wordmark">Global — Shapers</span>;
}

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const { me, prefs, setPrefs, db, stillWorkingDue, stillWorking, clockOut, now } = useApp();
  const session = db.sessions.find((s) => s.memberId === me.id);
  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));

  return (
    <div className="app">
      <GridLines />
      <header className="deskbar">
        <Link href="/"><Wordmark /></Link>
        <nav>
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} aria-current={active(n.href) ? "page" : undefined}>{n.label}</Link>
          ))}
        </nav>
        <div className="who">
          {session && <span className="tag">On the clock {elapsed(session.start, now)}</span>}
          <span>Viewing as</span>
          <select value={prefs.meId} onChange={(e) => setPrefs({ meId: e.target.value })} aria-label="Demo: view as">
            {DEMO_PEOPLE.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            {!DEMO_PEOPLE.some((p) => p.id === prefs.meId) && <option value={prefs.meId}>{me.name}</option>}
          </select>
        </div>
      </header>

      <main>{children}</main>

      {stillWorkingDue && session && (
        <div className="toast" role="alert">
          <span aria-hidden>▲</span>
          <span className="grow">Still working? {elapsed(session.start, now)} on the clock</span>
          <button className="yes" onClick={stillWorking}>Yes</button>
          <button onClick={clockOut} aria-label="Clock out">✕</button>
        </div>
      )}

      <nav className="tabbar">
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} aria-current={active(n.href) ? "page" : undefined}>{n.label}</Link>
        ))}
      </nav>
    </div>
  );
}

/** The faint perspective line field from costarastrology.com, desktop only. */
function GridLines() {
  const lines = [];
  for (let i = -12; i <= 12; i++) lines.push(<line key={`r${i}`} x1={720} y1={-200} x2={720 + i * 260} y2={1200} />);
  for (let j = 0; j < 14; j++) {
    const y = 120 + Math.pow(j, 1.6) * 22;
    lines.push(<line key={`h${j}`} x1={0} y1={y} x2={1440} y2={y} />);
  }
  return (
    <svg className="gridlines hide-m" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <g stroke="#d6d6d6" strokeWidth="1">{lines}</g>
    </svg>
  );
}
