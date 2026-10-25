"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useApp, STATUS_LABEL } from "@/lib/store";
import { addDays } from "@/lib/dates";
import { projectColor } from "@/lib/colors";
import type { Priority, TaskSize, TaskStatus } from "@/lib/types";
import { Board, COLUMNS, type Lane, type LaneMode } from "@/components/tasks/Board";
import { Timeline } from "@/components/tasks/Timeline";
import { TaskSheet } from "@/components/tasks/TaskSheet";
import { Sheet } from "@/components/ui";
import { useOnboarding } from "@/components/blocks";
import { canAssignOthers, canManageTasks } from "@/lib/permissions";
import { SIZE_LABEL } from "@/lib/score";

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
  const onboarding = useOnboarding();
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
          {onboarding && <p className="mono-lc muted">{open} open · {late} late · drag a note to move it</p>}
        </div>
        <div className="tasks-controls">
          {view === "board" && <Toggle value={mode} onChange={setMode} items={[["project", "By project"], ["person", "By person"], ["none", "No lanes"]]} />}
          <Toggle value={view} onChange={setView} items={[["board", "Board"], ["timeline", "Timeline"]]} />
          <Toggle value={scope} onChange={setScope} items={[["all", "Everyone"], ["mine", "Mine"]]} />
          <button className="btn hide-m" onClick={() => setAdding(true)}>New task</button>
        </div>
      </div>

      {view === "board" ? (
        <Board tasks={tasks} lanes={lanes} mode={mode} onOpen={setOpen} defaultProject={db.projects[0].id} />
      ) : (
        <Timeline tasks={tasks} onOpen={setOpen} />
      )}

      <button className="fab hide-d" onClick={() => setAdding(true)} aria-label="New task">+</button>

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

function NewTask({ onClose }: { onClose: () => void }) {
  const { db, me, today, addTask } = useApp();
  const [title, setTitle] = useState("");
  const [projectId, setProjectId] = useState(db.projects[0].id);
  const [assigneeId, setAssignee] = useState<string>(me.id);
  const [status, setStatus] = useState<TaskStatus>("todo");
  const [due, setDue] = useState(addDays(today, 7));
  const [priority, setPriority] = useState<Priority>("normal");
  const [size, setSize] = useState<TaskSize>("M");
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
        <div className="row" style={{ justifyContent: "center", flexWrap: "wrap" }}>
          {(["low", "normal", "high"] as Priority[]).map((p) => <button key={p} className={`btn-s ${priority === p ? "on" : ""}`} onClick={() => setPriority(p)}>{PRI[p]}</button>)}
          {canManageTasks(me) && <span className="muted">·</span>}
          {canManageTasks(me) && (["S", "M", "L"] as TaskSize[]).map((z) => <button key={z} className={`btn-s ${size === z ? "on" : ""}`} onClick={() => setSize(z)}>{SIZE_LABEL[z]}</button>)}
        </div>
        <button className="btn block" disabled={!title} onClick={() => { addTask({ title, projectId, assigneeId: canAssignOthers(me) ? assigneeId || null : me.id, due: due || null, priority, status, start: today, size: canManageTasks(me) ? size : "M" }); onClose(); }}>Add task</button>
      </div>
    </Sheet>
  );
}
