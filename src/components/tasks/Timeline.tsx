"use client";

// Notion/Jira-style timeline. Drag a bar to move it, drag either end to
// change its dates, drag across an empty row to schedule an undated task.

import { useRef, useState } from "react";
import { useApp } from "@/lib/store";
import { addDays, daysBetween, fmt, weekStart } from "@/lib/dates";
import { projectColor } from "@/lib/colors";
import type { Task } from "@/lib/types";

const DAYS = 56;

type Drag = { id: string; mode: "move" | "start" | "end" | "create"; x0: number; start: string; due: string; moved: boolean };

export function Timeline({ tasks, onOpen }: { tasks: Task[]; onOpen: (id: string) => void }) {
  const { db, today, setTaskDates } = useApp();
  const from = addDays(weekStart(today), -14);
  const days = Array.from({ length: DAYS }, (_, i) => addDays(from, i));
  const [dw, setDw] = useState(26);
  const [drag, setDrag] = useState<Drag | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const ids = db.projects.map((p) => p.id);

  const groups = db.projects
    .map((p) => ({ p, tasks: tasks.filter((t) => t.projectId === p.id).sort((a, b) => (a.start ?? "9").localeCompare(b.start ?? "9")) }))
    .filter((g) => g.tasks.length);

  const dayAt = (clientX: number) => {
    const r = trackRef.current!.getBoundingClientRect();
    return addDays(from, Math.max(0, Math.min(DAYS - 1, Math.floor((clientX - r.left) / dw))));
  };

  const begin = (e: React.PointerEvent, t: Task, mode: Drag["mode"]) => {
    e.stopPropagation();
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}
    const s = t.start ?? dayAt(e.clientX);
    setDrag({ id: t.id, mode, x0: e.clientX, start: s, due: t.due ?? s, moved: false });
  };

  const move = (e: React.PointerEvent) => {
    if (!drag) return;
    const t = tasks.find((x) => x.id === drag.id)!;
    const d = Math.round((e.clientX - drag.x0) / dw);
    const s0 = t.start ?? drag.start;
    const e0 = t.due ?? drag.start;
    let start = s0, due = e0;
    if (drag.mode === "move") { start = addDays(s0, d); due = addDays(e0, d); }
    if (drag.mode === "start") { start = addDays(s0, d); if (start > due) start = due; }
    if (drag.mode === "end") { due = addDays(e0, d); if (due < start) due = start; }
    if (drag.mode === "create") { const a = drag.start, b = addDays(drag.start, d); start = a < b ? a : b; due = a < b ? b : a; }
    setDrag({ ...drag, start, due, moved: drag.moved || d !== 0 });
  };

  const end = () => {
    if (!drag) return;
    if (drag.moved || drag.mode === "create") setTaskDates(drag.id, drag.start, drag.due);
    else onOpen(drag.id);
    setDrag(null);
  };

  const span = (t: Task) => (drag?.id === t.id ? { start: drag.start, due: drag.due } : t.start && t.due ? { start: t.start, due: t.due } : null);

  return (
    <div className="tl-wrap">
      <div className="tl-zoom">
        <span className="label m">Zoom</span>
        <button className="btn-s" onClick={() => setDw(Math.max(14, dw - 6))} aria-label="Zoom out">−</button>
        <button className="btn-s" onClick={() => setDw(Math.min(44, dw + 6))} aria-label="Zoom in">+</button>
      </div>
      <div className="tl-scroll">
        <div className="tl" style={{ ["--dw" as string]: `${dw}px`, ["--days" as string]: DAYS }} onPointerMove={move} onPointerUp={end} onPointerCancel={() => setDrag(null)}>
          <div className="tl-head">
            <div className="tl-label tl-corner" />
            <div className="tl-track" ref={trackRef}>
              {days.map((d) => (
                <div key={d} className={`tl-day ${d === today ? "today" : ""} ${[0, 6].includes(new Date(d + "T12:00:00Z").getUTCDay()) ? "wknd" : ""}`}>
                  {d === weekStart(d) && <span className="tl-week">{fmt.short(d)}</span>}
                  <span className="tl-dn">{fmt.dayNum(d)}</span>
                </div>
              ))}
            </div>
          </div>
          {groups.map(({ p, tasks: ts }) => (
            <div key={p.id} className="tl-group">
              <div className="tl-row tl-group-h">
                <div className="tl-label"><span className="kb-chip" style={{ background: projectColor(ids, p.id) }} />{p.name}</div>
                <div className="tl-track tl-grid" />
              </div>
              {ts.map((t) => {
                const s = span(t);
                const left = s ? daysBetween(from, s.start) * dw : 0;
                const width = s ? (daysBetween(s.start, s.due) + 1) * dw : 0;
                return (
                  <div key={t.id} className="tl-row">
                    <button className="tl-label tl-task" onClick={() => onOpen(t.id)}>{t.title}</button>
                    <div
                      className="tl-track tl-grid"
                      onPointerDown={(e) => !s && begin(e, t, "create")}
                      title={s ? undefined : "Drag to schedule"}
                    >
                      {s ? (
                        <div
                          className={`tl-bar ${t.status === "done" ? "is-done" : ""} ${drag?.id === t.id ? "dragging" : ""}`}
                          style={{ left, width, background: projectColor(ids, t.projectId) }}
                          onPointerDown={(e) => begin(e, t, "move")}
                        >
                          <span className="tl-h tl-h-l" onPointerDown={(e) => begin(e, t, "start")} />
                          <span className="tl-bar-t">{t.title}</span>
                          <span className="tl-h tl-h-r" onPointerDown={(e) => begin(e, t, "end")} />
                        </div>
                      ) : (
                        <span className="tl-hint">Drag here to schedule</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
          <div className="tl-now" style={{ left: `calc(var(--tl-label) + ${daysBetween(from, today) * dw + dw / 2}px)` }} />
        </div>
      </div>
    </div>
  );
}
