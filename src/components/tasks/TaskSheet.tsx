"use client";

// The task window: opens over the Tasks page and over the landing calendar.

import { useApp, STATUS_LABEL } from "@/lib/store";
import { fmt } from "@/lib/dates";
import { initials, projectColor } from "@/lib/colors";
import type { Priority, TaskSize, TaskStatus } from "@/lib/types";
import { canManageTasks, taskRights } from "@/lib/permissions";
import { SIZE_LABEL, TASK_POINTS } from "@/lib/score";
import { COLUMNS } from "./Board";
import { Sheet } from "../ui";

const PRI: Record<Priority, string> = { high: "High", normal: "Normal", low: "Low" };

export function TaskSheet({ id, onClose }: { id: string; onClose: () => void }) {
  const { db, me, member, updateTask, moveTask, setTaskDates, unscheduleTask } = useApp();
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
        <div><span className="k">Size</span>
          {(["S", "M", "L"] as TaskSize[]).map((z) => (
            <button key={z} className={`btn-s ${(t.size ?? "M") === z ? "on" : ""}`} disabled={!canManageTasks(me)} title={`${TASK_POINTS[z]} pt`} onClick={() => updateTask(t.id, { size: z }, `size ${SIZE_LABEL[z].toLowerCase()}`)}>{SIZE_LABEL[z]}</button>
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
      {canEdit && (t.start || t.due) && (
        <div className="center" style={{ padding: "22px var(--gutter) 0" }}>
          <button className="btn outline" onClick={() => { unscheduleTask(t.id); onClose(); }}>Remove from calendar</button>
        </div>
      )}
      <div className="label m pad" style={{ paddingTop: 22, paddingBottom: 10 }}>History</div>
      <div className="rows">
        {[...t.history].reverse().map((h, i) => (
          <div key={i}><span className="k">{h.what}</span><span className="v muted">{member(h.by) ? initials(member(h.by)!.name) : h.by} · {fmt.short(h.at.slice(0, 10))}</span></div>
        ))}
      </div>
    </Sheet>
  );
}

