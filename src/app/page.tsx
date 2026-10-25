"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/lib/store";
import { fmt, greeting, hoursLabel } from "@/lib/dates";
import { AdminToday, BuddyCard, BuddyNudges, LogHoursLink, SetupCard, TopPerformers, useOnboarding } from "@/components/blocks";
import { OrgCards } from "@/components/home";
import { ClockInSheet, WeekPlanner } from "@/components/week";
import { handle } from "@/components/ui";
import { flowDone } from "@/lib/onboarding";

export default function Home() {
  const { me, my, now, db, setupDone, stalledDays, onboardingDone, removeHour } = useApp();
  const setup = setupDone(me);
  const settingUp = !!setup && !Object.values(setup).every(Boolean);
  const nudges = db.members.some((m) => m.buddyId === me.id && m.onboarding !== null && (stalledDays(m) !== null || (!m.graduation && Object.values(onboardingDone(m)).every(Boolean))));
  const onboarding = useOnboarding();
  const [picking, setPicking] = useState(false);
  const router = useRouter();
  // A new member's first visit (nothing done yet) goes straight into onboarding.
  const fresh = me.onboarding !== null && !Object.values(onboardingDone(me)).some(Boolean);
  useEffect(() => {
    if (fresh) router.replace("/onboarding");
  }, [fresh, router]);
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
            {onboarding && <Link href="/onboarding" className="btn big" style={{ marginBottom: flowDone(onboardingDone(me)) ? 12 : 0 }}>Continue onboarding</Link>}
            {onboarding && !flowDone(onboardingDone(me)) ? null : session ? (
              <>
                <button className="btn big outline" disabled>Clocked in · 1 h counted</button>
                <p className="mono-lc muted" style={{ marginTop: 10 }}>
                  {sessionTask ? sessionTask.title : "General office work"} until {new Date(session.blockEnd).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Ljubljana" })}. Still here after that? Clock in again.
                </p>
                <button className="mono-lc muted" onClick={removeHour} style={{ marginTop: 6, background: "none", border: 0, padding: 0, textDecoration: "underline", cursor: "pointer" }}>
                  Pressed by mistake? Remove this hour
                </button>
              </>
            ) : (
              <>
                <button className={`btn big ${onboarding ? "outline" : ""}`} onClick={() => setPicking(true)}>Clock in</button>
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
