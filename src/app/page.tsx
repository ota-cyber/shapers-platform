"use client";

import { useApp } from "@/lib/store";
import { AdminToday, BuddyCard, Glance, NextMeeting, TeamFeed, TopPerformers, WeekInSpace, useOnboarding } from "@/components/blocks";
import { TheEnd } from "@/components/ui";

export default function Home() {
  const { my, me } = useApp();
  const onboarding = useOnboarding();
  return (
    <>
      {/* mobile: one column, Co–Star's home order */}
      <div className="page hide-d">
        <Glance />
        <div className="rule" />
        {onboarding && <BuddyCard />}
        {me.admin && <TopPerformers />}
        <AdminToday />
        <WeekInSpace s={my} />
        <NextMeeting />
        <TeamFeed />
        <TheEnd line={me.tier === "Core" ? "See how the institute is doing" : `See your path to ${my.nextRule?.id ?? "Core"}`} href={me.tier === "Core" && me.admin ? "/team?view=overview" : "/you?tab=chart"} />
      </div>

      {/* desktop: the glance is the page; admins and new members get one more row */}
      <div className="page hide-m">
        <Glance desk />
        {onboarding && <div className="home-row"><div className="panel"><BuddyCard /></div></div>}
        {me.admin && (
          <div className="home-row desk-grid two-even">
            <div className="panel"><TopPerformers /></div>
            <div className="panel"><AdminToday /></div>
          </div>
        )}
      </div>
    </>
  );
}
