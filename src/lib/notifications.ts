// Push notification catalog. The backend sends these (docs/NOTIFICATIONS.md);
// the app uses this list for the per-type switches in Settings and the preview.
// Times are Europe/Ljubljana.

export type NotifyCategory = "hours" | "meetings" | "tasks" | "onboarding" | "admin";

export const CATEGORY_LABEL: Record<NotifyCategory, string> = {
  hours: "Hours",
  meetings: "Meetings",
  tasks: "Tasks",
  onboarding: "Onboarding and buddies",
  admin: "Admin",
};

export interface NotifyAction {
  id: string;
  title: string;
}

export interface NotifyKind {
  id: string;
  category: NotifyCategory;
  /** who gets it */
  to: string;
  /** when it fires */
  when: string;
  /** example, with placeholders filled in for the preview */
  title: string;
  body: string;
  /** relative time shown in the preview */
  ago: string;
  actions?: NotifyAction[];
  /** sent even in quiet hours: it only fires during something the person started */
  urgent?: boolean;
}

export const NOTIFICATIONS: NotifyKind[] = [
  // hours
  { id: "week-check", category: "hours", to: "Member", when: "Thursday 17:00, if under the weekly commitment", title: "20.5 h to keep GO! this week.", body: "One good afternoon at the Hub does it.", ago: "now" },
  { id: "still-working", category: "hours", to: "Member on the clock", when: "5 minutes before a one-hour block ends", title: "Still working?", body: "Tap Yes for another hour, or we clock you out at 16:00.", ago: "now", urgent: true, actions: [{ id: "still-yes", title: "Yes" }, { id: "clock-out", title: "Clock out" }] },
  { id: "auto-clock-out", category: "hours", to: "Member on the clock", when: "A block ended without an answer", title: "Clocked out at 16:00", body: "1 h logged on Confirm three speakers.", ago: "1 min ago", urgent: true },
  { id: "streak-risk", category: "hours", to: "Member with a streak of 2+ weeks", when: "Sunday 12:00, if the week isn't made", title: "Your 5-week streak ends tonight", body: "0.5 h to go to keep it.", ago: "Sun" },
  { id: "week-made", category: "hours", to: "Member", when: "When the week's hours reach the commitment", title: "Week made", body: "GO! kept. 6-week streak.", ago: "Fri" },
  { id: "pause-decided", category: "hours", to: "Member who asked for a pause", when: "An admin approves or declines it", title: "Pause approved", body: "3–16 Nov. Those weeks won't count against you.", ago: "Tue" },
  // meetings
  { id: "meeting-soon", category: "meetings", to: "Series members", when: "3 days and 1 day before a meeting", title: "Community in 2 days", body: "Mon 18:00, in person. Can't make it? Say so 72 h ahead.", ago: "Sat" },
  { id: "meeting-now", category: "meetings", to: "Series members", when: "When a meeting starts", title: "Shape Talks starts now", body: "Check in so your attendance is recorded.", ago: "now", urgent: true, actions: [{ id: "checkin-present", title: "I'm here" }, { id: "checkin-remote", title: "Remote" }] },
  { id: "meeting-missed", category: "meetings", to: "Series members not checked in", when: "15 minutes after a meeting starts", title: "Not checked in to Shape Talks", body: "Tap to check in, or tell us why you're away.", ago: "15 min ago", urgent: true },
  { id: "absence-task", category: "meetings", to: "GO! member", when: "An unexcused Community absence creates the follow-up task", title: "New task: read the Community minutes", body: "Due 9 Nov. A missed Community meeting means one general task within 14 days.", ago: "Mon" },
  // tasks
  { id: "task-assigned", category: "tasks", to: "Assignee", when: "Someone assigns or hands them a task", title: "Ana gave you a task", body: "Budget v1 · Summer School 2027 · due 13 Nov", ago: "2 h ago" },
  { id: "task-due", category: "tasks", to: "Assignee", when: "09:00 the day before the due date", title: "Due tomorrow: Confirm three speakers", body: "Shape Talks #14. Mark it done or move the date.", ago: "9:00" },
  { id: "task-late", category: "tasks", to: "Assignee", when: "09:00 the day after the due date, once", title: "Late: Partner letters of intent", body: "Was due 28 Oct. Move the date or hand it back.", ago: "9:00" },
  { id: "task-review", category: "tasks", to: "Project lead", when: "A task moves to Validation", title: "Petra sent a task to Validation", body: "Event page and sign-up form · Shape Talks #14", ago: "Wed" },
  // onboarding
  { id: "buddy-stalled", category: "onboarding", to: "Buddy", when: "A new member's onboarding hasn't moved in 7 days", title: "Lea hasn't moved in 7 days", body: "Ask how it's going and what's in the way.", ago: "Mon" },
  { id: "buddy-ready", category: "onboarding", to: "Buddy", when: "A new member finished all 11 steps", title: "Lea is ready to graduate", body: "Open her page and tap Graduate.", ago: "Thu" },
  { id: "graduation-proposed", category: "onboarding", to: "Admins", when: "A buddy proposes graduation", title: "Rok proposed graduating Lea", body: "Confirm on her page.", ago: "Thu" },
  { id: "graduated", category: "onboarding", to: "New member", when: "An admin confirms graduation", title: "You're a Shaper", body: "Onboarding done. Home is your everyday screen now.", ago: "Fri" },
  // admin
  { id: "approvals", category: "admin", to: "Admins", when: "09:00 daily, if anything is waiting", title: "3 approvals waiting", body: "Back-filled hours and pause requests.", ago: "9:00" },
  { id: "weekly-digest", category: "admin", to: "Admins", when: "Monday 09:00", title: "Last week at the institute", body: "14 of 22 made their hours · 2 dropping · 9 tasks done.", ago: "Mon" },
];

export const QUIET_HOURS = { from: "21:00", to: "08:00" };
export const MAX_PER_DAY = 4;
