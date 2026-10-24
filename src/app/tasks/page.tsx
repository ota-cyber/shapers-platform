"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useApp } from "@/lib/store";
import { addDays, fmt } from "@/lib/dates";
import type { Priority, Task, TaskStatus } from "@/lib/types";
import { Img, Sheet, first } from "@/components/ui";

const COLS: { id: TaskStatus; title: string; cls: string }[] = [
  { id: "todo", title: "To do", cls: "" },
  { id: "doing", title: "Doing", cls: "hatch" },
  { id: "done", title: "Done", cls: "grey" },
];
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
  const [scope, setScope] = useState<"mine" | "all">("mine");
  const [project, setProject] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const openId = params.get("task");
  const setOpen = (id: string | null) => router.replace(id ? `/tasks?task=${id}` : "/tasks", { scroll: false });

  const list = db.tasks.filter((t) => (scope === "mine" ? t.assigneeId === me.id : true) && (!project || t.projectId === project));
  const sorted = (s: TaskStatus) =>
    list
      .filter((t) => t.status === s)
      .sort((a, b) => (s === "done" ? (b.doneAt ?? "").localeCompare(a.doneAt ?? "") : (a.due ?? "9999").localeCompare(b.due ?? "9999")));
  const open = list.filter((t) => t.status !== "done").length;
  const proj = db.projects.find((p) => p.id === project);

  return (
    <div className="page">
      <div className="panel-d">
        <section className="sect center">
          <div className="mono-lc muted">{scope === "mine" ? "Your tasks, every project" : "Every project, one board"}</div>
          <div className="h-xl" style={{ marginTop: 8 }}>
            {proj ? proj.name : scope === "mine" ? (open === 1 ? "One thing with your name on it." : open ? `${open} things with your name on them.` : "Nothing with your name on it. Yet.") : `${open} open across ${db.projects.length} projects.`}
          </div>
          {proj && <p className="small muted" style={{ marginTop: 6 }}>{proj.description} Lead: {db.members.find((m) => m.id === proj.leadId)?.name}.</p>}
          <div className="toggle" style={{ marginTop: 18 }} role="tablist">
            <button role="tab" aria-selected={scope === "mine"} onClick={() => setScope("mine")}>Mine</button>
            <span className="sep">|</span>
            <button role="tab" aria-selected={scope === "all"} onClick={() => setScope("all")}>All</button>
          </div>
        </section>
        <div className="chips">
          <button aria-pressed={!project} onClick={() => setProject(null)}>All projects</button>
          {db.projects.map((p) => (
            <button key={p.id} aria-pressed={project === p.id} onClick={() => setProject(p.id)}>{p.name}</button>
          ))}
        </div>
        <div className="board">
          {COLS.map((c) => (
            <div key={c.id} className={`box ${c.cls}`}>
              <div className="bh">{c.title} · {sorted(c.id).length}</div>
              <div className="bb" style={{ padding: "4px 14px" }}>
                {sorted(c.id).map((t) => <TaskRow key={t.id} t={t} today={today} onOpen={() => setOpen(t.id)} showWho={scope === "all"} />)}
                {!sorted(c.id).length && <div className="ci muted center" style={{ padding: "14px 0" }}>Nothing here</div>}
              </div>
            </div>
          ))}
        </div>
        <div className="center" style={{ padding: "8px 0 40px" }}>
          <button className="btn" onClick={() => setAdding(true)}>New task</button>
        </div>
      </div>
      {openId && <TaskSheet id={openId} onClose={() => setOpen(null)} />}
      {adding && <NewTask onClose={() => setAdding(false)} defaultProject={project ?? db.projects[0].id} />}
    </div>
  );
}

function TaskRow({ t, today, onOpen, showWho }: { t: Task; today: string; onOpen: () => void; showWho: boolean }) {
  const { db, member } = useApp();
  const p = db.projects.find((x) => x.id === t.projectId);
  const who = member(t.assigneeId);
  const late = t.status !== "done" && t.due && t.due < today;
  return (
    <button className={`task ${t.status === "done" ? "done" : ""}`} onClick={onOpen}>
      <div className="tt">{t.title}</div>
      <div className="meta">
        <span>{p?.name}</span>
        {t.status === "done" && t.doneAt ? <span>Done {fmt.short(t.doneAt)}</span> : t.due && <span className={late ? "hi" : ""}>{late ? "Late · " : "Due "}{fmt.short(t.due)}</span>}
        {t.priority === "high" && t.status !== "done" && <span className="hi">● High</span>}
        {showWho && <span>{who ? first(who) : "Unassigned"}</span>}
      </div>
    </button>
  );
}

function TaskSheet({ id, onClose }: { id: string; onClose: () => void }) {
  const { db, me, member, updateTask, now } = useApp();
  const t = db.tasks.find((x) => x.id === id);
  const [handover, setHandover] = useState(false);
  if (!t) return null;
  const p = db.projects.find((x) => x.id === t.projectId)!;
  const who = member(t.assigneeId);
  const canEdit = me.admin || t.assigneeId === me.id || p.leadId === me.id || !t.assigneeId;
  return (
    <Sheet title={p.name} onClose={onClose} left="‹ Back">
      <section className="sect">
        <div className="h-l">{t.title}</div>
        <p className="body" style={{ marginTop: 8 }}>{t.notes || p.description}</p>
        <Img name={t.status === "done" ? "dove" : "pencil"} className="float-img" />
      </section>
      <div className="label m pad" style={{ paddingBottom: 10 }}>Details</div>
      <div className="rows">
        <div><span className="k">Status</span>
          {(["todo", "doing", "done"] as TaskStatus[]).map((s) => (
            <button key={s} className={`btn-s ${t.status === s ? "on" : ""}`} disabled={!canEdit} onClick={() => updateTask(t.id, { status: s }, s === "done" ? "marked done" : `moved to ${s}`)}>{s === "todo" ? "To do" : s}</button>
          ))}
        </div>
        <div><span className="k">Priority</span>
          {(["low", "normal", "high"] as Priority[]).map((s) => (
            <button key={s} className={`btn-s ${t.priority === s ? "on" : ""}`} disabled={!canEdit} onClick={() => updateTask(t.id, { priority: s }, `priority ${s}`)}>{PRI[s]}</button>
          ))}
        </div>
        <div><span className="k">Due</span>
          <input type="date" value={t.due ?? ""} disabled={!canEdit} onChange={(e) => updateTask(t.id, { due: e.target.value || null }, `due ${e.target.value || "cleared"}`)} style={{ border: "1px solid var(--line-strong)", height: 32, padding: "0 8px", fontFamily: "var(--mono)", fontSize: 12, background: "var(--paper)" }} />
        </div>
        <div><span className="k">With</span><span className="v">{who ? who.name : "Nobody yet"}</span>
          {canEdit && <button className="btn-s" onClick={() => setHandover(!handover)}>{who ? "Hand over" : "Assign"}</button>}
          {!who && <button className="btn-s on" onClick={() => updateTask(t.id, { assigneeId: me.id }, "picked up")}>Take it</button>}
        </div>
        {handover && (
          <div>
            <select autoFocus defaultValue="" onChange={(e) => { if (e.target.value) { updateTask(t.id, { assigneeId: e.target.value }, `handed to ${member(e.target.value)?.name}`); setHandover(false); } }} style={{ flex: 1, height: 36, border: "1px solid var(--line-strong)", background: "var(--paper)", padding: "0 8px" }}>
              <option value="">Choose someone…</option>
              {db.members.filter((m) => m.id !== t.assigneeId).sort((a, b) => a.name.localeCompare(b.name)).map((m) => <option key={m.id} value={m.id}>{m.name} · {m.tier}</option>)}
            </select>
          </div>
        )}
      </div>
      {t.status !== "done" && canEdit && (
        <div className="center" style={{ padding: "26px 0 6px" }}>
          <button className="btn" onClick={() => { updateTask(t.id, { status: "done" }, "marked done"); onClose(); }}>Mark it done</button>
        </div>
      )}
      <div className="label m pad" style={{ paddingTop: 26, paddingBottom: 10 }}>History</div>
      <div className="rows">
        {[...t.history].reverse().map((h, i) => (
          <div key={i}><span className="k">{h.what}</span><span className="v muted">{member(h.by)?.name.split(" ")[0] ?? h.by} · {fmt.short(h.at.slice(0, 10))}</span></div>
        ))}
      </div>
      <p className="small muted pad" style={{ paddingTop: 12 }}>Nothing is lost when a card moves. {fmt.time(now)}</p>
    </Sheet>
  );
}

function NewTask({ onClose, defaultProject }: { onClose: () => void; defaultProject: string }) {
  const { db, me, today, addTask } = useApp();
  const [title, setTitle] = useState("");
  const [projectId, setProjectId] = useState(defaultProject);
  const [assigneeId, setAssignee] = useState<string>(me.id);
  const [due, setDue] = useState(addDays(today, 7));
  const [priority, setPriority] = useState<Priority>("normal");
  return (
    <Sheet title="New task" onClose={onClose}>
      <div className="pad stack" style={{ paddingTop: 22 }}>
        <div className="h-l center">Small enough to finish this week.</div>
        <div className="field"><label>Task</label><input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Confirm the venue" /></div>
        <div className="field"><label>Project</label><select value={projectId} onChange={(e) => setProjectId(e.target.value)}>{db.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
        <div className="row">
          <div className="field grow"><label>Who</label>
            <select value={assigneeId} onChange={(e) => setAssignee(e.target.value)}>
              <option value="">Nobody yet</option>
              {[...db.members].sort((a, b) => a.name.localeCompare(b.name)).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div className="field grow"><label>Due</label><input type="date" value={due} onChange={(e) => setDue(e.target.value)} /></div>
        </div>
        <div className="row" style={{ justifyContent: "center" }}>
          {(["low", "normal", "high"] as Priority[]).map((p) => <button key={p} className={`btn-s ${priority === p ? "on" : ""}`} onClick={() => setPriority(p)}>{PRI[p]}</button>)}
        </div>
        <button className="btn block" disabled={!title} onClick={() => { addTask({ title, projectId, assigneeId: assigneeId || null, due: due || null, priority }); onClose(); }}>Add task</button>
      </div>
    </Sheet>
  );
}
