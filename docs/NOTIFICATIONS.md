# Notifications (Web Push)

The app sends phone and desktop notifications with standard Web Push. There's no native app and no third-party push service. The frontend half is built (branch `UI`). This doc is the spec for the backend half.

- Catalog (texts, who gets each, the trigger): `src/lib/notifications.ts`. Settings → Notifications → "See every notification" previews them.
- Browser side: `src/lib/push.ts` handles permission and subscribing; `public/sw.js` is the service worker that shows the notification and handles taps.
- iPhone: Web Push works only after the app is added to the Home Screen (iOS 16.4+). `public/manifest.webmanifest` and the `appleWebApp` metadata make that possible, and the app tells iPhone users to do it first.

## What the frontend already calls

| RPC | Args | Does |
|---|---|---|
| `save_push_subscription` | `p_subscription jsonb` (`PushSubscription.toJSON()`: `endpoint`, `keys.p256dh`, `keys.auth`), `p_categories jsonb` (`{"hours":true,"meetings":true,"tasks":true,"onboarding":true,"admin":false}`) | Upsert on `endpoint` for `current_member_id()`. Called on enable and on every category switch. |
| `delete_push_subscription` | `p_endpoint text` | Delete the caller's row with that endpoint. |

## Tables

```sql
create table public.push_subscriptions (
  endpoint   text primary key,
  member_id  uuid not null references members(id) on delete cascade,
  p256dh     text not null,
  auth       text not null,
  categories jsonb not null default '{"hours":true,"meetings":true,"tasks":true,"onboarding":true,"admin":true}',
  created_at timestamptz not null default now()
);
-- RLS on; members see/delete only their own rows; inserts only through the RPC.

create table public.notification_log (
  member_id uuid not null references members(id) on delete cascade,
  kind      text not null,          -- catalog id, e.g. 'task-due'
  ref       text not null default '', -- what it is about: task id, meeting id, ISO week
  sent_at   timestamptz not null default now(),
  primary key (member_id, kind, ref)
);
```

`notification_log` dedupes the sends: insert first with `on conflict do nothing`, and send only if the row was new. It also feeds the daily cap.

## Sender

An Edge Function `send-notifications`, run every 5 minutes by `pg_cron` + `pg_net`:

1. Collect due notifications: a SQL function `due_notifications(now)` returns `(member_id, kind, ref, title, body, url, data, urgent)`. One query per kind, following the triggers below.
2. Filter:
   - drop the kind's category if the subscription switched it off;
   - drop non-urgent kinds in quiet hours, 21:00–08:00 Europe/Ljubljana;
   - drop non-urgent kinds once the member has had 4 that day.
3. Insert into `notification_log`, then send to each of the member's subscriptions with `npm:web-push`.
4. A `404` or `410` from the push service means the subscription is gone: delete the row.

Event kinds (`task-assigned`, `task-review`, `graduation-proposed`, `graduated`, `pause-decided`) can also run on the same cron, through `task_events` and the other tables since the last run. A 5-minute delay is fine; no triggers needed.

## Payload (what `sw.js` reads)

```json
{
  "kind": "still-working",
  "title": "Still working?",
  "body": "Tap Yes for another hour, or we clock you out at 16:00.",
  "url": "/",
  "tag": "still-working",
  "actions": [{ "action": "still-yes", "title": "Yes" }, { "action": "clock-out", "title": "Clock out" }],
  "data": { "meetingId": "…", "taskId": "…" }
}
```

`tag` replaces an older notification with the same tag. Use the kind plus ref (e.g. `meeting-soon:<id>`) so a reminder updates in place instead of stacking.

Tapping a notification opens `url`. Tapping a button opens `url?n=<action>&meeting=<id>&task=<id>`, and the app runs the action (`src/components/Shell.tsx`):

| `n` | App does |
|---|---|
| `still-yes` | `stillWorking()`: one more hour |
| `clock-out` | `clockOut()` |
| `checkin-present` / `checkin-remote` | `meetingClockIn(meeting, …)` |

Action buttons show on Chrome/Edge (desktop and Android). Safari and iOS show the body only, and a tap opens the app.

## Catalog and triggers

| id | Category | To | Fires | Urgent |
|---|---|---|---|---|
| `week-check` | hours | member, not paused | Thu 17:00 if the week's hours < tier commitment. Title: "{n} h to keep {tier} this week." | |
| `still-working` | hours | member with an open session | 5 min before the 1-hour block ends | yes |
| `auto-clock-out` | hours | same | the block ended without an answer and the session was closed | yes |
| `streak-risk` | hours | member with a streak ≥ 2 | Sun 12:00 if the week isn't made | |
| `week-made` | hours | member | the week's hours first reach the commitment (once per ISO week) | |
| `pause-decided` | hours | the requester | an admin resolves a pause | |
| `meeting-soon` | meetings | series members | 3 days (Community: the 72 h notice limit) and 1 day before | |
| `meeting-now` | meetings | series members | at the meeting's start; buttons I'm here / Remote | yes |
| `meeting-missed` | meetings | series members with no attendance row | 15 min after start | yes |
| `absence-task` | meetings | GO! member | the unexcused-Community consequence task is created | |
| `task-assigned` | tasks | assignee | assignee set or changed by someone else | |
| `task-due` | tasks | assignee | 09:00 the day before `due`, task not done | |
| `task-late` | tasks | assignee | 09:00 the day after `due`, task not done; once | |
| `task-review` | tasks | project lead | a task moves to Validation | |
| `buddy-stalled` | onboarding | buddy | no onboarding progress for 7 days | |
| `buddy-ready` | onboarding | buddy | every onboarding step done | |
| `graduation-proposed` | onboarding | admins | buddy proposes graduation | |
| `graduated` | onboarding | the new member | admin confirms | |
| `approvals` | admin | admins | 09:00 daily if backfills or pauses are waiting | |
| `weekly-digest` | admin | admins | Mon 09:00: made hours / dropping / tasks done | |

Admin-category kinds go only to members with `is_admin`, whatever their tier.

## Keys

Generate once: `npx web-push generate-vapid-keys`.

| Name | Where |
|---|---|
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | frontend (Vercel) |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | Edge Function secrets |
| `VAPID_SUBJECT` | Edge Function secret, e.g. `mailto:` + the institute's address |

Without `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, the app still asks permission and "Send a test" works locally, but no subscription is made.
