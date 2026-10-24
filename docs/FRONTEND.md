# Frontend (branch `UI`)

Next.js 15 (App Router) + TypeScript, plain CSS. No backend yet: every screen runs on a client-side store seeded from the hackathon sandbox. The backend replaces the store's data and actions; the screens don't change.

```bash
npm install
npm run dev        # http://localhost:3000
```

## Design

Co–Star's design language with Shapers content. Mobile is the Co–Star app (bottom tab bar), desktop is the Co–Star website (top nav, perspective line field, panels side by side). Breakpoint: 1000 px.

| Co–Star | Shapers |
|---|---|
| Home, "Today at a glance", Do / Don't | Home: your week at a glance, Clock in |
| "What it looks like in space" | Your hours vs your tier vs the next tier |
| You: Updates / Chart / Saved / Settings | You: Updates / Chart (weeks table + wheel) / Meetings / Settings |
| ⊙ Sun ☽ Moon ↑ Rising | ⊙ tier ☽ hours this week ↑ streak |
| Friends, friend profile, compatibility | Team, member profile, "how it's going" |
| Harmony / In flux / Challenges | To do / Doing / Done, and Present / Remote / Missed |
| The Void | Ask (answers from your own data) |
| Onboarding, Find Friends, notifications | Onboarding mirroring the two onboarding meetings |

Tokens live at the top of `src/app/globals.css`. Fonts: Instrument Serif, Hanken Grotesk, DM Mono (free stand-ins for Co–Star's licensed Romana, Akkurat, Akkurat Mono). Images in `public/img` are generated halftones.

## Where things are

| File | What |
|---|---|
| `src/lib/types.ts` | **The contract.** Shapes the backend should return. |
| `src/lib/tiers.ts` | Tier rules as data + standing (streak, readiness, moving up / dropping), badges. |
| `src/lib/store.tsx` | Client store. Each action below is one backend call. Persists to localStorage. |
| `src/lib/seed.ts` | Sandbox data + seeds the sandbox lacks (projects, tasks, join dates, buddies, two onboarding members). |
| `src/lib/ask.ts` | Rule-based answers for Ask. Swap for the agent, keep `{ context, text, action? }`. |
| `src/data/sandbox.json` | Roster, hours, attendance, calendar, converted from the sandbox package. |

## Actions the backend needs

| Store action | Endpoint idea | Rule to enforce server-side |
|---|---|---|
| `clockIn`, `stillWorking`, `clockOut` | `POST /sessions`, `PATCH /sessions/:id` | 1-hour blocks; no answer to "still working?" closes at block end |
| `logHours(date, h)` | `POST /hours` | today/yesterday only; older → backfill request |
| `resolveBackfill` | `PATCH /backfills/:id` | admin only |
| `updateTask`, `addTask`, `addProject` | `/tasks`, `/projects` | append to task history on every change |
| `meetingClockIn` | `POST /attendance` | open from 15 min before start to end |
| `recordAttendance` | `PUT /meetings/:id/attendance/:member` | admin; GO! unexcused at Community → consequence task (14 days) |
| `announceAbsence` | `POST /absences` | excused if ≥72 h (Community) / ≥24 h (project) before |
| `completeStep`, `joinProject` | `/onboarding` | first hour / task / meeting are derived, not stored |
| `requestPause`, `resolvePause` | `/pauses` | approved pause weeks don't break streaks |
| `setTier`, `addMember` | `/members` | admin; tier change restarts the time-in-tier clock |

Meetings are read from Google Calendar only. Nothing is written to Slack.

## Demo switches (You → Settings → Demo)

- **View as**: Petra (GO!, close to Impact), Lea (new, onboarding), Rok (Impact, buddy), Ana (admin). Also in the desktop top bar.
- **Pretend my next meeting is live**: shows meeting clock-in outside meeting times.
- **Reset demo data**.
