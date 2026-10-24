"use client";

import { useApp } from "@/lib/store";
import { AdminToday, Glance, NextMeeting, TeamFeed, WeekInSpace } from "@/components/blocks";
import { TheEnd } from "@/components/ui";
import { Wordmark } from "@/components/Shell";

export default function Home() {
  const { my, me } = useApp();
  return (
    <>
      <header className="mhead hide-d"><span /><Wordmark /><span /></header>

      {/* mobile: one column, Co–Star's home order */}
      <div className="page hide-d">
        <Glance />
        <div className="rule" />
        <AdminToday />
        <WeekInSpace s={my} />
        <NextMeeting />
        <TeamFeed />
        <TheEnd line={me.tier === "Core" ? "See how the institute is doing" : `See your path to ${my.nextRule?.id ?? "Core"}`} href={me.tier === "Core" && me.admin ? "/team?view=overview" : "/you?tab=chart"} />
      </div>

      {/* desktop: the glance is the whole page */}
      <div className="page hide-m">
        <Glance desk />
      </div>
    </>
  );
}
