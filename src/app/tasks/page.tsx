"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useApp, STATUS_LABEL } from "@/lib/store";
import { addDays, fmt } from "@/lib/dates";
import { initials, projectColor } from "@/lib/colors";
import type { Priority, TaskStatus } from "@/lib/types";
import { Board, COLUMNS, type Lane, type LaneMode } from "@/components/tasks/Board";
import { Timeline } from "@/components/tasks/Timeline";
import { Sheet } from "@/components/ui";
import { canAssignOthers, taskRights } from "@/lib/permissions";

const PRI: Record<Priority, string> = { high: "High", normal: "Normal", low: "Low" };

export default function TasksPage() {
  return (
    <Suspense>
      <Tasks />
    </Suspense>
  );
}

function Tasks() {
  const { db, me, today } = useApp();
  const params = useSearchParams();
  const router = useRouter();
  const [view, setView] = useState<"board" | "timeline">("board");
  const [scope, setScope] = useState<"mine" | "all">("all");
  const [mode, setMode] = useState<LaneMode>("project");
  const [adding, setAdding] = useState(false);
  const openId = params.get("task");
  const setOpen = (id: string | null) => router.replace(id ? `/tasks?task=${id}` : "/tasks", { scroll: false });

  const tasks = db.tasks.filter((t) => scope === "all" || t.assigneeId === me.id);
  const ids = db.projects.map((p) => p.id);
  const lanes: Lane[] =
    mode === "project"
      ? db.projects
          .filter((p) => scope === "all" || tasks.some((t) => t.projectId === p.id))
          .map((p) => ({ key: p.id, label: p.name, color: projectColor(ids, p.id), sub: db.members.find((m) => m.id === p.leadId)?.name.split(" ")[0] }))
      : mode === "person"
        ? [
            ...[...db.members]
              .filter((m) => tasks.some((t) => t.assigneeId === m.id))
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((m) => ({ key: m.id, label: m.name, sub: m.tier })),
            ...(scope === "all" ? [{ key: "_none", label: "Unassigned" }] : []),
          ]
        : [{ key: "_all", label: "All" }];

  const open = tasks.filter((t) => t.status !== "done").length;
  const late = tasks.filter((t) => t.status !== "done" && t.due && t.due < today).length;

  return (
    <div className="page wide">
      <div className="tasks-head">
        <div>
          <h1 className="page-title">Tasks</h1>
          <p className="mono-lc muted">{open} open · {late} late · drag a note to move it</p>
        </div>
        <div className="tasks-controls">
          <Toggle value={view} onChange={setView} items={[["board", "Board"], ["timeline", "Timeline"]]} />
          <Toggle value={scope} onChange={setScope} items={[["all", "Everyone"], ["mine", "Mine"]]} />
          {view === "board" && <Toggle value={mode} onChange={setMode} items={[["project", "By project"], ["person", "By person"], ["none", "No lanes"]]} />}
          <button className="btn" onClick={() => setAdding(true)}>New task</button>
        </div>
      </div>

      {view === "board" ? (
        <Board tasks={tasks} lanes={lanes} mode={mode} onOpen={setOpen} defaultProject={db.projects[0].id} />
      ) : (
        <Timeline tasks={tasks} onOpen={setOpen} />
      )}

      {openId && <TaskSheet id={openId} onClose={() => setOpen(null)} />}
      {adding && <NewTask onClose={() => setAdding(false)} />}
    </div>
  );
}

function Toggle<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: [T, string][] }) {
  return (
    <div className="seg" role="tablist">
      {items.map(([v, l]) => (
        <button key={v} role="tab" aria-selected={value === v} onClick={() => onChange(v)}>{l}</button>
      ))}
    </div>
  );
}

function TaskSheet({ id, onClose }: { id: string; onClose: () => void }) {
  const { db, me, member, updateTask, moveTask, setTaskDates } = useApp();
  const t = db.tasks.find((x) => x.id === id);
  if (!t) return null;
  const p = db.projects.find((x) => x.id === t.projectId)!;
  const rights = taskRights(me, t);
  const canEdit = rights.edit;
  const field = { border: "1px solid var(--line-strong)", height: 32, padding: "0 8px", fontFamily: "var(--mono)", fontSize: 12, background: "var(--paper)" } as const;
  return (
    <Sheet title={p.name} onClose={onClose} left="‹ Back">
      <section className="sect" style={{ background: projectColor(db.projects.map((x) => x.id), p.id) }}>
        <div className="h-l">{t.title}</div>
        <p className="small" style={{ marginTop: 6 }}>{t.notes || p.description}</p>
      </section>
      <div className="rows">
        <div style={{ flexWrap: "wrap" }}><span className="k">Status</span>
          {COLUMNS.map((s: TaskStatus) => (
            <button key={s} className={`btn-s ${t.status === s ? "on" : ""}`} disabled={!canEdit} onClick={() => moveTask(t.id, { status: s })}>{STATUS_LABEL[s]}</button>
          ))}
        </div>
        <div><span className="k">Priority</span>
          {(["low", "normal", "high"] as Priority[]).map((s) => (
            <button key={s} className={`btn-s ${t.priority === s ? "on" : ""}`} disabled={!canEdit} onClick={() => updateTask(t.id, { priority: s }, `priority ${s}`)}>{PRI[s]}</button>
          ))}
        </div>
        <div><span className="k">Dates</span>
          <input type="date" value={t.start ?? ""} disabled={!canEdit} style={field} onChange={(e) => e.target.value && setTaskDates(t.id, e.target.value, t.due && t.due >= e.target.value ? t.due : e.target.value)} aria-label="Start" />
          <span className="muted">→</span>
          <input type="date" value={t.due ?? ""} disabled={!canEdit} style={field} onChange={(e) => e.target.value && setTaskDates(t.id, t.start && t.start <= e.target.value ? t.start : e.target.value, e.target.value)} aria-label="Due" />
        </div>
        <div><span className="k">Project</span>
          <select value={t.projectId} disabled={!rights.move} style={field} onChange={(e) => moveTask(t.id, { projectId: e.target.value })}>
            {db.projects.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
        </div>
        <div><span className="k">With</span>
          <select value={t.assigneeId ?? ""} disabled={!rights.reassign} style={field} onChange={(e) => moveTask(t.id, { assigneeId: e.target.value || null })}>
            <option value="">Nobody yet</option>
            {[...db.members].sort((a, b) => a.name.localeCompare(b.name)).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>

        </div>
      </div>
      <div className="pad" style={{ paddingTop: 18 }}>
        <div className="field">
          <label htmlFor="task-notes">Notes</label>
          <textarea id="task-notes" key={t.id} defaultValue={t.notes} disabled={!canEdit} placeholder={canEdit ? "Details, links, what's left…" : "Only the person this is assigned to can add notes."} onBlur={(e) => e.target.value !== t.notes && updateTask(t.id, { notes: e.target.value }, "notes updated")} />
        </div>
        {!canEdit && <p className="small muted" style={{ marginTop: 8 }}>{t.assigneeId ? "This task is assigned to someone else. You can see it, but only they and Core members can change it." : "Not assigned yet. A Core member assigns it before anyone works on it."}</p>}
      </div>
      <div className="label m pad" style={{ paddingTop: 22, paddingBottom: 10 }}>History</div>
      <div className="rows">
        {[...t.history].reverse().map((h, i) => (
          <div key={i}><span className="k">{h.what}</span><span className="v muted">{member(h.by) ? initials(member(h.by)!.name) : h.by} · {fmt.short(h.at.slice(0, 10))}</span></div>
        ))}
      </div>
    </Sheet>
  );
}

function NewTask({ onClose }: { onClose: () => void }) {
  const { db, me, today, addTask } = useApp();
  const [title, setTitle] = useState("");
  const [projectId, setProjectId] = useState(db.projects[0].id);
  const [assigneeId, setAssignee] = useState<string>(me.id);
  const [status, setStatus] = useState<TaskStatus>("todo");
  const [due, setDue] = useState(addDays(today, 7));
  const [priority, setPriority] = useState<Priority>("normal");
  return (
    <Sheet title="New task" onClose={onClose}>
      <div className="pad stack" style={{ paddingTop: 22 }}>
        <div className="field"><label htmlFor="nt-title">Task</label><input id="nt-title" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Confirm the venue" /></div>
        <div className="row">
          <div className="field grow"><label htmlFor="nt-project">Project</label><select id="nt-project" value={projectId} onChange={(e) => setProjectId(e.target.value)}>{db.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
          <div className="field grow"><label htmlFor="nt-status">Column</label><select id="nt-status" value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)}>{COLUMNS.map((c) => <option key={c} value={c}>{STATUS_LABEL[c]}</option>)}</select></div>
        </div>
        <div className="row">
          <div className="field grow"><label htmlFor="nt-who">Who</label>
            {canAssignOthers(me) ? (
              <select id="nt-who" value={assigneeId} onChange={(e) => setAssignee(e.target.value)}>
                <option value="">Nobody yet</option>
                {[...db.members].sort((a, b) => a.name.localeCompare(b.name)).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            ) : (
              <input id="nt-who" value={`${me.name} (you)`} disabled />
            )}
          </div>
          <div className="field grow"><label htmlFor="nt-due">Due</label><input id="nt-due" type="date" value={due} onChange={(e) => setDue(e.target.value)} /></div>
        </div>
        <div className="row" style={{ justifyContent: "center" }}>
          {(["low", "normal", "high"] as Priority[]).map((p) => <button key={p} className={`btn-s ${priority === p ? "on" : ""}`} onClick={() => setPriority(p)}>{PRI[p]}</button>)}
        </div>
        <button className="btn block" disabled={!title} onClick={() => { addTask({ title, projectId, assigneeId: canAssignOthers(me) ? assigneeId || null : me.id, due: due || null, priority, status, start: today }); onClose(); }}>Add task</button>
      </div>
    </Sheet>
  );
}
