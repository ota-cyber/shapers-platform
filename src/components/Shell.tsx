"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { useApp } from "@/lib/store";
import { elapsed, hoursLabel } from "@/lib/dates";
import { Avatar, Meter, handle } from "./ui";
import { PathCard } from "./profile";

const NAV = [
  { href: "/", label: "Home" },
  { href: "/tasks", label: "Tasks" },
  { href: "/team", label: "Team", admin: true },
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

/** Side menu on desktop; on mobile the same menu opens from the hamburger. */
export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const { me, my, prefs, setPrefs, db, stillWorkingDue, stillWorking, clockOut, now } = useApp();
  const [open, setOpen] = useState(false);
  const session = db.sessions.find((s) => s.memberId === me.id);
  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));
  const close = () => setOpen(false);

  return (
    <div className="app">
      <header className="mbar">
        <button className="burger" onClick={() => setOpen(true)} aria-label="Open menu" aria-expanded={open}>
          <span /><span /><span />
        </button>
        <Link href="/" onClick={close}><Wordmark /></Link>
        <span />
      </header>

      {open && <div className="scrim" onClick={close} aria-hidden />}
      <aside className={`sidebar ${open ? "open" : ""}`} aria-label="Menu">
        <div className="side-top hide-d">
          <button className="side-close" onClick={close} aria-label="Close menu">✕</button>
        </div>
        <div className="side-me">
          <Link href="/you" onClick={close} className="side-id" aria-label="Open your profile">
            <Avatar m={me} size="m" />
            <span>
              <span className="side-name">{me.name}</span>
              <span className="side-handle">{handle(me)} · {me.tier}</span>
            </span>
          </Link>
          <div className="side-prog">
            <div className="label m">This week</div>
            <div className="sp-num"><span className="serif">{hoursLabel(my.thisWeek).replace(" h", "")}</span> / {my.target} h</div>
            <Meter value={my.thisWeek} max={Math.max(my.target, my.thisWeek)} mark={my.target} />
            <div className="sp-line">↑ {my.streak}-week streak{my.toKeep > 0 ? ` · ${hoursLabel(my.toKeep)} to go` : " · week made"}</div>
            <div className="side-path"><PathCard s={my} hidePace /></div>
          </div>
        </div>
        <nav className="side-nav">
          {NAV.filter((n) => !n.admin || me.admin || me.tier === "Core").map((n) => (
            <Link key={n.href} href={n.href} onClick={close} aria-current={active(n.href) ? "page" : undefined}>{n.label}</Link>
          ))}
        </nav>
        <div className="side-foot">
          {session && <span className="tag">On the clock {elapsed(session.start, now)}</span>}
          <label className="label m" htmlFor="view-as">Viewing as</label>
          <select id="view-as" value={prefs.meId} onChange={(e) => { setPrefs({ meId: e.target.value }); close(); }}>
            {DEMO_PEOPLE.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            {!DEMO_PEOPLE.some((p) => p.id === prefs.meId) && <option value={prefs.meId}>{me.name}</option>}
          </select>
        </div>
      </aside>

      <main>{children}</main>

      {stillWorkingDue && session && (
        <div className="toast" role="alert">
          <span aria-hidden>▲</span>
          <span className="grow">Still working? {elapsed(session.start, now)} on the clock</span>
          <button className="yes" onClick={stillWorking}>Yes</button>
          <button onClick={clockOut} aria-label="Clock out">✕</button>
        </div>
      )}
    </div>
  );
}
