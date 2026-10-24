"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/lib/store";
import { QUESTIONS, answer, type Answer, type Category } from "@/lib/ask";
import { hoursLabel } from "@/lib/dates";
import { Img } from "@/components/ui";

const CATS: { id: Category; label: string; img: string }[] = [
  { id: "hours", label: "Hours", img: "hourglass" },
  { id: "tasks", label: "Tasks", img: "pencil" },
  { id: "meetings", label: "Meetings", img: "chair" },
  { id: "tiers", label: "Tiers", img: "ladder" },
];

export default function AskPage() {
  const router = useRouter();
  const { db, me, my, today, now, logHours } = useApp();
  const [cat, setCat] = useState<Category>("hours");
  const [q, setQ] = useState("");
  const [asked, setAsked] = useState<{ q: string; a: Answer } | null>(null);
  const [vote, setVote] = useState(0);
  const [logged, setLogged] = useState<string | null>(null);

  const ask = (text: string) => {
    if (!text.trim()) return;
    setAsked({ q: text, a: answer(text, db, me, my, today, now) });
    setVote(0);
    setLogged(null);
    setQ("");
  };

  if (asked)
    return (
      <div className="void" style={{ paddingBottom: 120 }}>
        <div style={{ maxWidth: 620, margin: "0 auto", paddingTop: 22 }}>
          <div className="answer">
            <div className="cell up">You asked:<br />&ldquo;{asked.q}&rdquo;</div>
            <div className="split">
              <div className="cell" style={{ display: "grid", placeItems: "center", minHeight: 150 }}>
                <svg viewBox="0 0 120 80" width="120" aria-hidden>
                  <line x1="12" y1="62" x2="108" y2="16" stroke="#888" strokeWidth="0.8" />
                  <circle cx="12" cy="62" r="5" fill="#ccc" />
                  <circle cx="60" cy="39" r="11" fill="#9a9a9a" stroke="#ddd" />
                  <circle cx="108" cy="16" r="4" fill="#ccc" />
                </svg>
              </div>
              <div className="cell up" style={{ display: "grid", placeItems: "center" }}>{asked.a.context}</div>
            </div>
            <div className="cell" style={{ fontSize: 14 }}>
              {asked.a.text}
              {asked.a.action && !logged && (
                <div style={{ marginTop: 16 }}>
                  <button className="btn light" onClick={() => { const r = logHours(asked.a.action!.date, asked.a.action!.hours); setLogged(r === "logged" ? `${hoursLabel(asked.a.action!.hours)} logged.` : "Sent for approval."); }}>
                    Log {hoursLabel(asked.a.action.hours)}
                  </button>
                </div>
              )}
              {logged && <div style={{ marginTop: 14 }} className="up">✓ {logged}</div>}
            </div>
            <div className="cell">
              <div className="between">
                <span className="up">How was this answer?</span>
                <span className="row" style={{ gap: 16 }}>
                  <button onClick={() => setVote(1)} style={{ fontSize: 18, opacity: vote === -1 ? 0.3 : 1, filter: "grayscale(1) brightness(1.8)" }} aria-label="Good">👍</button>
                  <button onClick={() => setVote(-1)} style={{ fontSize: 18, opacity: vote === 1 ? 0.3 : 1, filter: "grayscale(1) brightness(1.8)" }} aria-label="Bad">👎</button>
                </span>
              </div>
              <div className="fine">Ask reads your hours, tasks, meetings and the tier rules. It doesn&apos;t decide anything. Leadership decides tiers; you decide how to spend your week.</div>
            </div>
          </div>
          <div className="center" style={{ marginTop: 34 }}>
            <button className="btn light" onClick={() => setAsked(null)}>Dismiss</button>
          </div>
        </div>
      </div>
    );

  return (
    <div className="void">
      <div className="vh">
        <button className="sq" onClick={() => router.push("/")} aria-label="Close">X</button>
        <span>Ask about your week</span>
        <span className="circ" title="Open tasks">{db.tasks.filter((t) => t.assigneeId === me.id && t.status !== "done").length}</span>
      </div>
      <div className="cats" role="tablist">
        {CATS.map((c) => (
          <button key={c.id} className="cat" role="tab" aria-selected={cat === c.id} onClick={() => setCat(c.id)}>
            <span className="ico"><Img name={c.img} /></span>
            {c.label}
          </button>
        ))}
      </div>
      <ul className="qs">
        {QUESTIONS[cat].map((x) => (
          <li key={x}><button onClick={() => ask(x)}>{x}</button></li>
        ))}
      </ul>
      <form className="ask" onSubmit={(e) => { e.preventDefault(); ask(q); }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask anything..." aria-label="Ask anything" />
        <button type="submit">Ask</button>
      </form>
    </div>
  );
}
