"use client";

// The Miro wall as a board: lanes (projects or people) × columns (statuses).
// Sticky notes are dragged between cells; a drop changes status and lane.

import { useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useApp, STATUS_LABEL } from "@/lib/store";
import { fmt } from "@/lib/dates";
import { initials, projectColor } from "@/lib/colors";
import type { Task, TaskStatus } from "@/lib/types";
import { canCreateTasks, taskRights } from "@/lib/permissions";

export const COLUMNS: TaskStatus[] = ["idea", "todo", "doing", "review", "done"];

export type LaneMode = "project" | "person" | "none";

export interface Lane {
  key: string;
  label: string;
  color?: string;
  sub?: string;
}

interface Props {
  tasks: Task[];
  lanes: Lane[];
  mode: LaneMode;
  onOpen: (id: string) => void;
  defaultProject: string;
}

export function Board({ tasks, lanes, mode, onOpen, defaultProject }: Props) {
  const { moveTask, me } = useApp();
  const [active, setActive] = useState<Task | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor),
  );

  const laneOf = (t: Task) => (mode === "project" ? t.projectId : mode === "person" ? (t.assigneeId ?? "_none") : "_all");

  const onStart = (e: DragStartEvent) => setActive(tasks.find((t) => t.id === e.active.id) ?? null);
  const onEnd = (e: DragEndEvent) => {
    setActive(null);
    if (!e.over) return;
    const t = tasks.find((x) => x.id === e.active.id);
    if (!t) return;
    const rights = taskRights(me, t);
    if (!rights.edit) return;
    const [lane, status] = String(e.over.id).split("|") as [string, TaskStatus];
    const to: Parameters<typeof moveTask>[1] = { status };
    // Members can only change status; dropping into another lane keeps owner and project.
    if (mode === "project" && rights.move) to.projectId = lane;
    if (mode === "person" && rights.reassign) to.assigneeId = lane === "_none" ? null : lane;
    moveTask(t.id, to);
  };

  return (
    <DndContext sensors={sensors} onDragStart={onStart} onDragEnd={onEnd} onDragCancel={() => setActive(null)}>
      <div className="kb-scroll">
        <div className={`kb ${mode === "none" ? "no-lanes" : ""}`}>
          {mode !== "none" && <div className="kb-corner" />}
          {COLUMNS.map((c) => (
            <div key={c} className={`kb-col-h kb-${c}`}>
              {STATUS_LABEL[c]} <span className="muted">· {tasks.filter((t) => t.status === c).length}</span>
            </div>
          ))}
          {lanes.map((l) => (
            <Row key={l.key} lane={l} mode={mode}>
              {COLUMNS.map((c) => (
                <Cell
                  key={c}
                  id={`${l.key}|${c}`}
                  status={c}
                  lane={l}
                  mode={mode}
                  defaultProject={defaultProject}
                  meId={me.id}
                  tasks={tasks.filter((t) => t.status === c && laneOf(t) === l.key)}
                  onOpen={onOpen}
                  activeId={active?.id}
                />
              ))}
            </Row>
          ))}
        </div>
      </div>
      <DragOverlay dropAnimation={null}>{active ? <Sticky t={active} lifted /> : null}</DragOverlay>
    </DndContext>
  );
}

function Row({ lane, mode, children }: { lane: Lane; mode: LaneMode; children: React.ReactNode }) {
  return (
    <>
      {mode !== "none" && (
        <div className="kb-lane">
          {lane.color && <span className="kb-chip" style={{ background: lane.color }} />}
          <span>
            <span className="kb-lane-name">{lane.label}</span>
            {lane.sub && <span className="kb-lane-sub">{lane.sub}</span>}
          </span>
        </div>
      )}
      {children}
    </>
  );
}

function Cell(props: {
  id: string;
  status: TaskStatus;
  lane: Lane;
  mode: LaneMode;
  tasks: Task[];
  onOpen: (id: string) => void;
  activeId?: string;
  defaultProject: string;
  meId: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: props.id });
  const { addTask, today, me } = useApp();
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const create = () => {
    if (title.trim()) {
      addTask({
        title: title.trim(),
        status: props.status,
        projectId: props.mode === "project" ? props.lane.key : props.defaultProject,
        assigneeId: props.mode === "person" ? (props.lane.key === "_none" ? null : props.lane.key) : props.meId,
        priority: "normal",
        start: today,
        due: null,
      });
    }
    setTitle("");
    setAdding(false);
  };
  return (
    <div ref={setNodeRef} className={`kb-cell kb-${props.status} ${isOver ? "over" : ""}`}>
      {props.tasks.map((t) => (
        <DraggableSticky key={t.id} t={t} onOpen={props.onOpen} hidden={props.activeId === t.id} />
      ))}
      {adding ? (
        <textarea
          className="sticky sticky-new"
          autoFocus
          value={title}
          placeholder="New task…"
          onChange={(e) => setTitle(e.target.value)}
          onBlur={create}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              create();
            }
            if (e.key === "Escape") {
              setTitle("");
              setAdding(false);
            }
          }}
        />
      ) : canCreateTasks(me) && (
        <button className="kb-add" onClick={() => setAdding(true)} aria-label={`Add a task to ${STATUS_LABEL[props.status]}`}>+</button>
      )}
    </div>
  );
}

function DraggableSticky({ t, onOpen, hidden }: { t: Task; onOpen: (id: string) => void; hidden: boolean }) {
  const { me } = useApp();
  const locked = !taskRights(me, t).edit;
  const { attributes, listeners, setNodeRef } = useDraggable({ id: t.id, disabled: locked });
  return (
    <div ref={setNodeRef} {...listeners} {...attributes} style={{ opacity: hidden ? 0.25 : 1 }} onClick={() => onOpen(t.id)}>
      <Sticky t={t} locked={locked} />
    </div>
  );
}

export function Sticky({ t, lifted, locked }: { t: Task; lifted?: boolean; locked?: boolean }) {
  const { db, member, today } = useApp();
  const ids = db.projects.map((p) => p.id);
  const who = member(t.assigneeId);
  const late = t.status !== "done" && t.due && t.due < today;
  return (
    <div className={`sticky ${lifted ? "lifted" : ""} ${locked ? "locked" : ""} ${t.status === "done" ? "is-done" : ""}`} style={{ background: projectColor(ids, t.projectId) }}>
      <div className="st-title">{t.title}</div>
      <div className="st-meta">
        <span className={late ? "late" : ""}>{t.due ? (late ? "Late " : "") + fmt.short(t.due) : ""}{t.priority === "high" && t.status !== "done" ? " ●" : ""}</span>
        <span className="st-who" title={who?.name ?? "Unassigned"}>{who ? initials(who.name) : "?"}</span>
      </div>
    </div>
  );
}
