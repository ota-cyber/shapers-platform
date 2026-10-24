"use client";

import { useEffect, useState } from "react";
import type { Member } from "@/lib/types";
import type { Standing } from "@/lib/tiers";
import { hoursLabel } from "@/lib/dates";

export function Img({ name, alt = "", className }: { name: string; alt?: string; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={`/img/${name}.webp`} alt={alt} className={className} loading="lazy" />;
}

export function Avatar({ m, size }: { m: Member; size?: "s" | "m" }) {
  return (
    <span className={`avatar ${size ?? ""}`} title={m.name}>
      <Img name={m.avatar} />
    </span>
  );
}

export const handle = (m: Member) => "@" + m.id.split(".")[0];
export const first = (m: Member) => m.name.split(" ")[0];

/** Co–Star's "⊙ Sun ☽ Moon ↑ Rising" line, as tier · this week · streak. */
export function Signs({ s, small }: { s: Standing; small?: boolean }) {
  return (
    <div className={`signs ${small ? "s" : ""}`}>
      <span>⊙ {s.member.tier}</span>
      <span>☽ {hoursLabel(s.thisWeek).replace(" h", "")}/{s.target} h</span>
      <span>↑ {s.streak}-wk streak</span>
    </div>
  );
}

export function Tabs<T extends string>({ items, value, onChange, dot }: { items: { id: T; label: string }[]; value: T; onChange: (v: T) => void; dot?: T }) {
  return (
    <div className="tabs" role="tablist">
      {items.map((i) => (
        <button key={i.id} role="tab" aria-selected={value === i.id} className={dot === i.id ? "dot" : ""} onClick={() => onChange(i.id)}>
          {i.label}
        </button>
      ))}
    </div>
  );
}

export function Sheet({ title, onClose, children, left = "Close" }: { title: string; onClose: () => void; children: React.ReactNode; left?: string }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={title}>
        <div className="sh">
          <button onClick={onClose}>{left}</button>
          <span className="t">{title}</span>
          <span />
        </div>
        {children}
      </div>
    </div>
  );
}

export function Modal({ title, body, action, onClose }: { title: string; body: string; action: string; onClose: () => void }) {
  return (
    <div className="overlay mid" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog">
        <div className="h-l">{title}</div>
        <p className="small" style={{ marginTop: 12 }}>{body}</p>
        <button className="btn block" style={{ marginTop: 22 }} onClick={onClose}>{action}</button>
      </div>
    </div>
  );
}

export function Useful() {
  return (
    <div className="useful">
      <span>Was this useful?</span>
      <ThumbButtons />
    </div>
  );
}

function ThumbButtons() {
  const [v, setV] = useState<0 | 1 | -1>(0);
  return (
    <>
      <button className={v === 1 ? "on" : ""} onClick={() => setV(1)} aria-label="Useful">👍</button>
      <button className={v === -1 ? "on" : ""} onClick={() => setV(-1)} aria-label="Not useful">👎</button>
    </>
  );
}

export function Meter({ value, max, mark }: { value: number; max: number; mark?: number }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div className="meter" aria-label={`${value} of ${max}`}>
      <i style={{ width: pct + "%" }} />
      {mark !== undefined && <b style={{ left: Math.min(100, (mark / max) * 100) + "%" }} />}
    </div>
  );
}

export function TheEnd({ line, href }: { line: string; href: string }) {
  return (
    <div className="the-end">
      <div className="dust" />
      <div className="h-l">The end</div>
      <a className="link" href={href} style={{ display: "inline-block", marginTop: 18 }}>{line}</a>
    </div>
  );
}
