// Domain types. This file is the contract between the UI and the backend:
// the backend returns these shapes, the UI renders them.

export type TierId = "GO!" | "Impact" | "Core";

export type AttendanceState = "present" | "remote" | "excused" | "unexcused";

export type Series =
  | "Community"
  | "Summer School"
  | "Grants"
  | "Shape Talks"
  | "Shapers Tech"
  | "Shapers Voice";

export type OnboardingStepId =
  | "values"
  | "tiers"
  | "contract"
  | "email"
  | "slack"
  | "calendar"
  | "buddy"
  | "project"
  | "first-hour"
  | "first-task"
  | "first-meeting";

export interface Member {
  id: string;
  name: string;
  email: string;
  tier: TierId;
  weeklyHours: number;
  admin: boolean;
  series: Series[];
  joined: string; // ISO date
  tierSince: string; // ISO date, starts the time-in-tier clock
  buddyId: string | null;
  avatar: string; // image key in /public/img
  /** null once onboarding is finished (or for members who joined before the platform) */
  onboarding: Partial<Record<OnboardingStepId, boolean>> | null;
  seeded?: boolean; // demo-only member, not in the sandbox roster
}

/** Weekly total, the shape of the sandbox hours sheet. Sessions roll up into it. */
export interface WeekHours {
  memberId: string;
  weekStart: string; // Monday, ISO date
  hours: number;
}

/** A running work clock-in: 1-hour blocks, "still working?" extends by another hour. */
export interface Session {
  memberId: string;
  start: string; // ISO datetime
  blockEnd: string; // ISO datetime
}

export interface Meeting {
  id: string;
  series: Series;
  start: string;
  end: string;
  location: string;
  memberIds: string[];
}

export interface Attendance {
  memberId: string;
  series: Series;
  date: string; // ISO date of the meeting
  state: AttendanceState;
}

export interface Project {
  id: string;
  name: string;
  series: Series;
  leadId: string;
  description: string;
}

/** Columns of the team's Miro board: Idea lane, Priority lane, In progress, Validation, Done. */
export type TaskStatus = "idea" | "todo" | "doing" | "review" | "done";
export type Priority = "low" | "normal" | "high";

export interface TaskEvent {
  at: string;
  by: string;
  what: string;
}

export interface Task {
  id: string;
  projectId: string;
  title: string;
  notes: string;
  assigneeId: string | null;
  status: TaskStatus;
  priority: Priority;
  start: string | null; // timeline bar start
  due: string | null; // timeline bar end
  doneAt: string | null;
  history: TaskEvent[];
}

export interface Pause {
  id: string;
  memberId: string;
  from: string;
  to: string;
  reason: string;
  status: "requested" | "approved";
}

/** Hours logged for a day older than yesterday need an admin's approval. */
export interface BackfillRequest {
  id: string;
  memberId: string;
  date: string;
  hours: number;
  note: string;
  status: "pending" | "approved" | "declined";
}

export interface AbsenceNotice {
  memberId: string;
  meetingId: string;
  at: string;
  excused: boolean; // given in time per the tier rules
}

export interface Db {
  members: Member[];
  hours: WeekHours[];
  attendance: Attendance[];
  meetings: Meeting[];
  projects: Project[];
  tasks: Task[];
  sessions: Session[];
  pauses: Pause[];
  backfills: BackfillRequest[];
  absences: AbsenceNotice[];
}
