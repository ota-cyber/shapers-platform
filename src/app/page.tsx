"use client";

import Link from "next/link";
import { useApp } from "@/lib/store";
import { fmt, greeting } from "@/lib/dates";
import { AdminToday, BuddyCard, TopPerformers, useOnboarding } from "@/components/blocks";
import { HoursCard, MeetingsCard, OrgCards, TasksCard } from "@/components/home";
import { WeekStrip } from "@/components/profile";
import { handle } from "@/components/ui";

export default function Home() {
  const { me, now } = useApp();
  const onboarding = useOnboarding();
  return (
    <div className="page home">
      <h1 className="greet">
        {greeting(now)}, <Link href="/you">{handle(me)}</Link>. It&apos;s {fmt.weekday(now)}, {fmt.monthDay(now)}. Your week at a glance:
      </h1>

      <div className="home-week"><WeekStrip memberId={me.id} /></div>

      {onboarding && (
        <div className="home-row onboard">
          <div className="card">
            <div className="card-h"><span className="label">Your first weeks</span></div>
            <p className="h-m">Finish onboarding and this page fills with your hours, meetings and tasks.</p>
            <div className="card-actions"><Link href="/onboarding" className="btn">Continue onboarding</Link></div>
          </div>
          <div className="card"><BuddyCard /></div>
        </div>
      )}

      <div className="cards">
        <HoursCard />
        <MeetingsCard />
        <TasksCard />
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
