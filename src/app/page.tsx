"use client";

import Link from "next/link";
import { useApp } from "@/lib/store";
import { AdminToday, EmojiLines, Glance, NextMeeting, TeamFeed, WeekInSpace } from "@/components/blocks";
import { PathCard, ProfileHead, WeekStrip } from "@/components/profile";
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

      {/* desktop: the website's three-phone row, as three panels */}
      <div className="page hide-m">
        <div className="desk-grid three">
          <div className="panel">
            <ProfileHead s={my} />
            <WeekStrip memberId={me.id} />
            <div className="sect"><EmojiLines s={my} /></div>
            <PathCard s={my} />
          </div>
          <div className="panel">
            <div className="mhead" style={{ position: "static" }}><span /><Wordmark /><span /></div>
            <Glance />
            <NextMeeting />
          </div>
          <div className="stack">
            {me.admin && <div className="panel"><AdminToday /></div>}
            <div className="panel"><WeekInSpace s={my} /></div>
            <div className="panel"><TeamFeed /></div>
          </div>
        </div>
        <div className="center" style={{ marginTop: 40 }}>
          <Link href="/you?tab=chart" className="link">Your path through the tiers</Link>
        </div>
      </div>
    </>
  );
}
