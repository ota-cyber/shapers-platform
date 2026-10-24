"use client";

import Link from "next/link";
import { useState } from "react";
import { useApp } from "@/lib/store";
import { elapsed, fmt, greeting, hoursLabel } from "@/lib/dates";
import { AdminToday, BuddyCard, BuddyNudges, LogHoursLink, SetupCard, TopPerformers, useOnboarding } from "@/components/blocks";
import { OrgCards } from "@/components/home";
import { ClockInSheet, WeekPlanner } from "@/components/week";
import { handle } from "@/components/ui";
import { flowDone } from "@/lib/onboarding";

export default function Home() {
  const { me, my, now, db, clockOut, setupDone, stalledDays, onboardingDone } = useApp();
  const setup = setupDone(me);
  const settingUp = !!setup && !Object.values(setup).every(Boolean);
  const nudges = db.members.some((m) => m.buddyId === me.id && m.onboarding !== null && (stalledDays(m) !== null || (!m.graduation && Object.values(onboardingDone(m)).every(Boolean))));
  const onboarding = useOnboarding();
  const [picking, setPicking] = useState(false);
  const session = db.sessions.find((s) => s.memberId === me.id);
  const sessionTask = session?.taskId ? db.tasks.find((t) => t.id === session.taskId) : null;
  return (
    <div className="page home">
      <section className="glance">
        <h1 className="greet">
          {greeting(now)}, <Link href="/you">{handle(me)}</Link>. It&apos;s {fmt.weekday(now)}, {fmt.monthDay(now)}. Your week at a glance:
        </h1>
        <WeekPlanner onboarding={onboarding}>
          <div className="clock">
            {onboarding && !flowDone(onboardingDone(me)) ? (
              <Link href="/onboarding" className="btn big">Continue onboarding</Link>
            ) : session ? (
              <>
                <button className="btn big outline" onClick={clockOut}>Clock out · {elapsed(session.start, now)}</button>
                <p className="mono-lc muted" style={{ marginTop: 10 }}>On the clock for {sessionTask ? sessionTask.title : "general office work"}</p>
              </>
            ) : (
              <>
                <button className="btn big" onClick={() => setPicking(true)}>Clock in</button>
                <p className="mono-lc muted" style={{ marginTop: 10 }}>{hoursLabel(my.thisWeek)} of {my.target} h this week</p>
              </>
            )}
            {!onboarding && me.tier === "Core" && <div style={{ marginTop: 8 }}><LogHoursLink /></div>}
          </div>
        </WeekPlanner>
      </section>

      {onboarding && <div className="home-row"><div className="card flush"><BuddyCard /></div></div>}
      {settingUp && <div className="home-row"><div className="card"><SetupCard /></div></div>}
      {nudges && <div className="home-row"><div className="card"><BuddyNudges /></div></div>}

      {me.admin && (
        <>
          <h2 className="sect-title">The institute</h2>
          <OrgCards />
          <div className="home-row two">
            <div className="card flush"><TopPerformers /></div>
            <div className="card flush"><AdminToday /></div>
          </div>
        </>
      )}
      {picking && <ClockInSheet onClose={() => setPicking(false)} />}
    </div>
  );
}
