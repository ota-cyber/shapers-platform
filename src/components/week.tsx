"use client";

// The landing's week: Do / Meet lists, a week timeline with meetings and
// tasks, drag a Do task onto a day to schedule it, clock in to a task or to a
// meeting that is going on right now.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { useApp, attendanceOf } from "@/lib/store";
import { addDays, daysBetween, fmt, isoDate, weekStart } from "@/lib/dates";
import { myOpenTasks } from "@/lib/copy";
import { projectColor } from "@/lib/colors";
import { taskRights } from "@/lib/permissions";
import { ONBOARDING_STEPS } from "@/lib/seed";
import type { Meeting, Task } from "@/lib/types";
import { Sheet } from "./ui";
import { TaskSheet } from "./tasks/TaskSheet";

const day3 = (iso: string) => fmt.dow(iso).slice(0, 3).toLowerCase().replace(/^./, (c) => c.toUpperCase());

/** Wraps Do / Meet and the week so tasks can be dragged from one to the other. */
export function WeekPlanner({ onboarding, children }: { onboarding: boolean; children?: React.ReactNode }) {
  const { db, me } = useApp();
  const [dragging, setDragging] = useState<Task | null>(null);
  const [planning, setPlanning] = useState<{ id: string; day: string } | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
  );
  const onEnd = (e: DragEndEvent) => {
    setDragging(null);
    const t = db.tasks.find((x) => `do:${x.id}` === e.active.id);
    if (!t || !e.over || !taskRights(me, t).edit) return;
    // Dropping opens the task's dates first; nothing changes until Save.
    setPlanning({ id: t.id, day: String(e.over.id).replace("day:", "") });
  };
  return (
    <DndContext
      sensors={sensors}
      onDragStart={(e) => setDragging(db.tasks.find((x) => `do:${x.id}` === e.active.id) ?? null)}
      onDragEnd={onEnd}
      onDragCancel={() => setDragging(null)}
    >
      <DoMeet onboarding={onboarding} />
      {children}
      <WeekTimeline />
      <DragOverlay dropAnimation={null}>{dragging ? <TaskCard t={dragging} /> : null}</DragOverlay>
      {planning && <PlanSheet id={planning.id} day={planning.day} onClose={() => setPlanning(null)} />}
    </DndContext>
  );
}

function DoMeet({ onboarding }: { onboarding: boolean }) {
  const { me, db, now, today, onboardingDone } = useApp();
  const done = onboardingDone(me);
  const steps = onboarding ? ONBOARDING_STEPS.filter((s) => !done[s.id]).slice(0, 3) : [];
  const tasks = myOpenTasks(db, me.id).slice(0, 3 - steps.length);
  const weekEnd = addDays(weekStart(today), 6);
  const meets = db.meetings
    .filter((m) => m.memberIds.includes(me.id) && new Date(m.end) > now && isoDate(new Date(m.start)) <= weekEnd)
    .sort((a, b) => a.start.localeCompare(b.start));
  return (
    <div className="dodont big">
      <div>
        <div className="lbl">Do</div>
        <ul>
          {tasks.map((t) => <DraggableDo key={t.id} t={t} />)}
          {steps.map((s) => <li key={s.id}><Link href="/onboarding">{s.title}</Link></li>)}
          {!tasks.length && !steps.length && <li className="muted">Nothing pending</li>}
        </ul>
        {onboarding && tasks.length > 0 && <div className="next-meet">Drag a task onto a day to plan it</div>}
      </div>
      <div>
        <div className="lbl">Meet</div>
        <ul>
          {meets.map((m) => <li key={m.id}>{m.series}, {day3(m.start)} {fmt.time(m.start)}</li>)}
          {!meets.length && <li className="muted">Nothing left this week</li>}
        </ul>
      </div>
    </div>
  );
}

function DraggableDo({ t }: { t: Task }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `do:${t.id}` });
  return (
    <li ref={setNodeRef} {...listeners} {...attributes} className="do-drag" style={{ opacity: isDragging ? 0.3 : 1 }}>
      {t.title}
    </li>
  );
}

/** Opens after a task is dropped on a day: set its dates, then save. */
function PlanSheet({ id, day, onClose }: { id: string; day: string; onClose: () => void }) {
  const { db, setTaskDates } = useApp();
  const t = db.tasks.find((x) => x.id === id)!;
  const [start, setStart] = useState(day);
  const [due, setDue] = useState(t.due && t.due >= day ? t.due : day);
  const p = db.projects.find((x) => x.id === t.projectId)!;
  const len = daysBetween(start, due) + 1;
  return (
    <Sheet title="Plan task" onClose={onClose} left="Cancel">
      <section className="sect" style={{ background: projectColor(db.projects.map((x) => x.id), p.id) }}>
        <div className="mono-lc">{p.name}</div>
        <div className="h-l" style={{ marginTop: 6 }}>{t.title}</div>
      </section>
      <div className="pad stack" style={{ paddingTop: 20 }}>
        <div className="row">
          <div className="field grow"><label htmlFor="plan-start">Start</label><input id="plan-start" type="date" value={start} onChange={(e) => { setStart(e.target.value); if (e.target.value > due) setDue(e.target.value); }} /></div>
          <div className="field grow"><label htmlFor="plan-due">Due</label><input id="plan-due" type="date" value={due} min={start} onChange={(e) => setDue(e.target.value)} /></div>
        </div>
        <p className="small muted">{len > 0 ? `${len} day${len === 1 ? "" : "s"}` : "Due must be on or after the start."}{t.due ? ` · deadline was ${fmt.short(t.due)}` : ""}</p>
        <button className="btn block big" disabled={!start || !due || due < start} onClick={() => { setTaskDates(t.id, start, due); onClose(); }}>Save dates</button>
        <Link href={`/tasks?task=${t.id}`} className="link center" style={{ display: "block" }}>Open the full task</Link>
      </div>
    </Sheet>
  );
}

function TaskCard({ t }: { t: Task }) {
  const { db } = useApp();
  return (
    <div className="sticky lifted" style={{ background: projectColor(db.projects.map((p) => p.id), t.projectId) }}>
      <div className="st-title">{t.title}</div>
      <div className="st-meta"><span>{db.projects.find((p) => p.id === t.projectId)?.name}</span></div>
    </div>
  );
}

/** One week: meetings at their times, your tasks as bars across days. */
/** A member's week. Your own is interactive; someone else's is read-only (Team member page). */
export function WeekTimeline({ memberId }: { memberId?: string }) {
  const { db, me, today, now, liveMeetingId } = useApp();
  const router = useRouter();
  const who = memberId ?? me.id;
  const readonly = who !== me.id;
  const [offset, setOffset] = useState(0);
  const [open, setOpen] = useState<string | null>(null);
  const [openTask, setOpenTask] = useState<string | null>(null);
  const from = addDays(weekStart(today), offset * 7);
  const days = Array.from({ length: 7 }, (_, i) => addDays(from, i));
  const to = days[6];
  const ids = db.projects.map((p) => p.id);

  const meetings = db.meetings
    .filter((m) => m.memberIds.includes(who) && isoDate(new Date(m.start)) >= from && isoDate(new Date(m.start)) <= to)
    .sort((a, b) => a.start.localeCompare(b.start));
  const tasks = db.tasks
    .filter((t) => t.assigneeId === who && t.start && t.due && t.start <= to && t.due >= from)
    .sort((a, b) => a.start!.localeCompare(b.start!));

  return (
    <section className="wk">
      <div className="wk-head">
        <button className="btn-s" onClick={() => setOffset(offset - 1)} aria-label="Previous week">‹</button>
        <span className="mono-lc">{offset === 0 ? "This week" : offset === 1 ? "Next week" : offset === -1 ? "Last week" : ""} · {fmt.short(from)} – {fmt.short(to)}</span>
        <button className="btn-s" onClick={() => setOffset(offset + 1)} aria-label="Next week">›</button>
      </div>
      <div className="wk-scroll">
        <div className="wk-grid">
          <div className="wk-lab" />
          {days.map((d) => (
            <div key={d} className={`wk-day ${d === today ? "today" : ""}`}>
              <span className="dw">{d === today ? "TODAY" : fmt.dow(d)}</span>
              <span className="dn">{fmt.dayNum(d)}</span>
            </div>
          ))}

          <div className="wk-lab">Meetings</div>
          {days.map((d) => (
            <div key={d} className={`wk-cell ${d === today ? "today" : ""}`}>
              {meetings.filter((m) => isoDate(new Date(m.start)) === d).map((m) => {
                const live = !readonly && liveMeetingId === m.id;
                const state = attendanceOf(db, m.id, who);
                const past = new Date(m.end) < now;
                return (
                  <button key={m.id} className={`wk-meet ${live ? "live" : ""} ${past ? "past" : ""}`} onClick={() => (readonly ? router.push(`/meetings/${m.id}`) : setOpen(m.id))}>
                    <span className="t">{fmt.time(m.start)}</span>
                    <span className="n">{m.series}</span>
                    <span className="s">{live ? (state === "present" || state === "remote" ? "You're in" : "Check in now") : state ? state : past ? "" : ""}</span>
                  </button>
                );
              })}
            </div>
          ))}

          <div className="wk-lab">Tasks</div>
          <div className="wk-tasks" style={{ gridColumn: "2 / span 7", minHeight: Math.max(96, tasks.length * 34 + 16) }}>
            {days.map((d, i) => readonly ? <div key={d} className={`wk-drop ${d === today ? "today" : ""}`} style={{ left: `${(i / 7) * 100}%` }} /> : <DayDrop key={d} day={d} index={i} today={d === today} />)}
            {tasks.map((t, row) => {
              const s = t.start! < from ? from : t.start!;
              const e = t.due! > to ? to : t.due!;
              const col = daysBetween(from, s);
              const span = daysBetween(s, e) + 1;
              return (
                <button
                  key={t.id}
                  onClick={() => setOpenTask(t.id)}
                  className={`wk-bar ${t.status === "done" ? "is-done" : ""}`}
                  style={{ left: `calc(${(col / 7) * 100}% + 3px)`, width: `calc(${(span / 7) * 100}% - 6px)`, top: 8 + row * 34, background: projectColor(ids, t.projectId) }}
                >
                  {t.title}
                </button>
              );
            })}
            {!tasks.length && <span className="wk-empty">{readonly ? "No tasks planned this week." : "No tasks planned this week. Drag one from Do."}</span>}
          </div>
        </div>
      </div>
      {open && <MeetingSheet id={open} onClose={() => setOpen(null)} />}
      {openTask && <TaskSheet id={openTask} onClose={() => setOpenTask(null)} />}
    </section>
  );
}

function DayDrop({ day, index, today }: { day: string; index: number; today: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: `day:${day}` });
  return <div ref={setNodeRef} className={`wk-drop ${today ? "today" : ""} ${isOver ? "over" : ""}`} style={{ left: `${(index / 7) * 100}%` }} />;
}

/** A meeting from the calendar. Clock-in only while it is going on. */
export function MeetingSheet({ id, onClose }: { id: string; onClose: () => void }) {
  const { db, me, now, liveMeetingId, meetingClockIn, announceAbsence } = useApp();
  const m = db.meetings.find((x) => x.id === id) as Meeting;
  const [msg, setMsg] = useState<string | null>(null);
  const live = liveMeetingId === m.id;
  const past = new Date(m.end) < now;
  const state = attendanceOf(db, m.id, me.id);
  const absence = db.absences.find((a) => a.memberId === me.id && a.meetingId === m.id);
  return (
    <Sheet title={m.series} onClose={onClose}>
      <section className="sect center">
        <div className="h-l">{m.series} meeting</div>
        <div className="mono-lc muted" style={{ marginTop: 6 }}>{fmt.weekday(m.start)} {fmt.monthDay(m.start)} · {fmt.time(m.start)}–{fmt.time(m.end)}</div>
        <div className="small muted">{m.location} · from Google Calendar</div>
        <div style={{ marginTop: 22 }}>
          {live ? (
            state === "present" || state === "remote" ? (
              <p className="h-s">You&apos;re clocked in, {state === "remote" ? "remotely" : "in person"}. Meetings don&apos;t count as hours.</p>
            ) : (
              <div className="row" style={{ justifyContent: "center" }}>
                <button className="btn big" onClick={() => meetingClockIn(m.id, "present")}>I&apos;m here</button>
                <button className="btn big outline" onClick={() => meetingClockIn(m.id, "remote")}>Remote</button>
              </div>
            )
          ) : past ? (
            <p className="small">{state ? `Recorded: ${state}.` : "Nothing recorded for you yet."}</p>
          ) : (
            <>
              <p className="small">Check-in opens when the meeting starts.</p>
              {absence || msg ? (
                <p className="small" style={{ marginTop: 10 }}>{msg ?? (absence!.excused ? "Absence announced in time. It counts as excused." : "Absence announced late. It will count as unexcused.")}</p>
              ) : (
                <button className="link" style={{ marginTop: 14 }} onClick={() => setMsg(announceAbsence(m.id) ? "Absence announced in time. It counts as excused. Tell the team on Slack too." : `Less than ${m.series === "Community" ? 72 : 24} h before: this will count as unexcused.`)}>
                  I can&apos;t make it
                </button>
              )}
            </>
          )}
        </div>
      </section>
    </Sheet>
  );
}

/** Clock in: pick the task this hour is for. */
export function ClockInSheet({ onClose }: { onClose: () => void }) {
  const { db, me, clockIn } = useApp();
  const tasks = myOpenTasks(db, me.id);
  const [pick, setPick] = useState<string | null>(tasks[0]?.id ?? null);
  const ids = db.projects.map((p) => p.id);
  return (
    <Sheet title="Clock in" onClose={onClose}>
      <div className="pad" style={{ paddingTop: 22 }}>
        <div className="h-l center">What are you working on?</div>
        <div className="pick" role="radiogroup" style={{ marginTop: 18 }}>
          {tasks.map((t) => (
            <button key={t.id} role="radio" aria-checked={pick === t.id} className="pick-row" onClick={() => setPick(t.id)}>
              <span className="kb-chip" style={{ background: projectColor(ids, t.projectId) }} />
              <span className="grow">{t.title}<span className="mono-lc muted"> · {db.projects.find((p) => p.id === t.projectId)?.name}</span></span>
            </button>
          ))}
          <button role="radio" aria-checked={pick === null} className="pick-row" onClick={() => setPick(null)}>
            <span className="kb-chip" />
            <span className="grow">General office work</span>
          </button>
        </div>
        <div className="center" style={{ marginTop: 22, paddingBottom: 10 }}>
          <button className="btn big" onClick={() => { clockIn(pick); onClose(); }}>Clock in</button>
          <p className="small muted" style={{ marginTop: 10 }}>One-hour blocks. We&apos;ll ask &quot;still working?&quot; before each hour ends.</p>
        </div>
      </div>
    </Sheet>
  );
}
