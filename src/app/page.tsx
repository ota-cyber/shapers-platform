"use client";

import Link from "next/link";
import { useApp } from "@/lib/store";
import { elapsed, fmt, greeting, hoursLabel } from "@/lib/dates";
import { AdminToday, BuddyCard, LogHoursLink, NextMeeting, TopPerformers, useOnboarding } from "@/components/blocks";
import { ComingUp, DoMeet, OrgCards } from "@/components/home";
import { WeekStrip } from "@/components/profile";
import { Img, handle } from "@/components/ui";

export default function Home() {
  const { me, my, now, db, clockIn, clockOut } = useApp();
  const onboarding = useOnboarding();
  const session = db.sessions.find((s) => s.memberId === me.id);
  return (
    <div className="page home">
      {/* Co–Star's glance: statement, image, Do / Meet, one button */}
      <section className="glance">
        <h1 className="greet">
          {greeting(now)}, <Link href="/you">{handle(me)}</Link>. It&apos;s {fmt.weekday(now)}, {fmt.monthDay(now)}. Your week at a glance:
        </h1>
        <div className="orb"><Img name={onboarding ? "hands" : session ? "stopwatch" : "hourglass"} /></div>
        <DoMeet onboarding={onboarding} />
        {onboarding ? (
          <Link href="/onboarding" className="btn" style={{ marginTop: 34 }}>Continue onboarding</Link>
        ) : session ? (
          <button className="btn outline" style={{ marginTop: 34 }} onClick={clockOut}>Clock out · {elapsed(session.start, now)}</button>
        ) : (
          <button className="btn" style={{ marginTop: 34 }} onClick={clockIn}>Clock in</button>
        )}
        {!onboarding && <p className="mono-lc muted" style={{ marginTop: 12 }}>{hoursLabel(my.thisWeek)} of {my.target} h this week</p>}
        {!onboarding && me.tier === "Core" && <div style={{ marginTop: 10 }}><LogHoursLink /></div>}
      </section>

      <div className="home-week"><WeekStrip memberId={me.id} /></div>

      {onboarding && <div className="home-row"><div className="card flush"><BuddyCard /></div></div>}

      <div className="home-row two">
        <div className="card flush"><NextMeeting /></div>
        <div className="card flush"><ComingUp /></div>
      </div>

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
    </div>
  );
}
