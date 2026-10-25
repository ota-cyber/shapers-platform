# Frontend (branch `UI`)

> **Backend builders: read [PERMISSIONS.md](PERMISSIONS.md) first.** GO! and Impact members may only edit tasks assigned to them; Core members and admins can edit every task. Admin is a separate role, unrelated to tier. The backend must enforce this.

Next.js 15 (App Router) + TypeScript, plain CSS. The store (`src/lib/store.tsx`) runs on Supabase when `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set (`src/lib/backend.ts` loads the `Db` shape and sends each action as an RPC; the database enforces the rules), and on a client-side demo seed otherwise. In backend mode every visitor starts on the sign-in page (`src/components/SignIn.tsx`): Continue with Google, or the demo as Petra, Lea, Rok or Ana. A Google account on the roster signs in as that member; anyone else becomes a join request that an admin approves in Team → Approvals, after which they are a GO! member who onboards. **A new member's every sign-in plays the onboarding from its first screen until they finish it** (once per sign-in per tab; existing members never get it automatically). **Demo rule: Lea (`ALWAYS_ONBOARD` in `src/lib/store.tsx`) gets the onboarding on every sign-in and every load, from screen one, even if she finished it; the database keeps her account in onboarding (`keep_demo_onboarding` trigger).** Petra doesn't get it. Finishing the onboarding screens gives a new member a starter history (4 weeks of hours, Community meetings, 3 tasks). Log out is at the bottom of You → Settings. "View as" signs in as that member with the demo password, and a refused action shows the database's message at the bottom of the screen.

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
| Onboarding, Find Friends, notifications | Onboarding mirroring the two onboarding meetings |

Tokens live at the top of `src/app/globals.css`. Fonts: Instrument Serif, Hanken Grotesk, DM Mono (free stand-ins for Co–Star's licensed Romana, Akkurat, Akkurat Mono). Images in `public/img` are generated halftones.

## Where things are

| File | What |
|---|---|
| `src/lib/types.ts` | **The contract.** Shapes the backend should return. |
| `src/lib/tiers.ts` | Tier rules as data + standing (streak, readiness, moving up / dropping), badges. |
| `src/lib/store.tsx` | Client store. Each action below is one backend call. Persists to localStorage. |
| `src/lib/seed.ts` | Sandbox data + seeds the sandbox lacks (projects, tasks, join dates, buddies, two onboarding members). |
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
| `importRoster` | `POST /members/import` | admin; existing members keep their tier, skip onboarding, get the 3 setup steps; skip emails already on file |
| `completeSetup` | `PATCH /members/:id/setup` | self only; "first hour" is derived, not stored |
| `proposeGraduation` | `POST /members/:id/graduation` | the member's buddy only, and only when every onboarding step is done |
| `resolveGraduation` | `PATCH /members/:id/graduation` | admin; confirm sets `onboarding` to null, "not yet" clears the proposal |

## Onboarding system

Two ways in, one way out:

- **New cohort member:** admin adds them (Team → Quick add). Their home is the 11-step onboarding checklist mirroring the two onboarding meetings.
- **Existing member (deploy day):** admin pastes the roster (Team → Quick add → Import the roster: `name, email, tier, in tier since`). They keep their tier and get 3 setup steps on home: check tier and hours, pick projects, clock the first hour.
- **Stall nudge:** no onboarding step ticked for 7 days (`STALL_DAYS`) shows the buddy a card on home and on the member page; admins see the count. In-app only, never Slack.
- **Finishing:** when every step is done, the buddy taps "End onboarding"; an admin confirms in Approvals (or on the member page). Then home switches to everyday mode.

Sign-in is not built yet: the demo uses View as.

Meetings are read from Google Calendar only. Nothing is written to Slack.

## Demo switches (You → Settings → Demo)

- **View as**: Petra (GO!, close to Impact), Lea (new, onboarding, stalled 10 days), Rok (Impact, buddy of Lea and Mia; Mia is ready to finish onboarding), Ana (admin), Zala / Nejc (existing members still on setup). Also in the desktop top bar.
- **Pretend my next meeting is live**: shows meeting clock-in outside meeting times.
- **Reset demo data**.
