"use client";

import { useApp } from "@/lib/store";
import { HoursCard } from "@/components/home";
import { PathCard, TierChart, TierRules, TiersTable } from "@/components/profile";

export default function HoursPage() {
  const { my, me } = useApp();
  return (
    <div className="page">
      <div className="home-head">
        <h1 className="page-title">Hours</h1>
        <p className="mono-lc muted">Office hours at Impact Hub, against your {me.tier} commitment of {my.target} h a week. Meetings are counted separately.</p>
      </div>
      <div className="desk-grid two-even">
        <div className="stack">
          <HoursCard />
          <div className="card flush"><PathCard s={my} /></div>
        </div>
        <div className="card flush">
          <div className="card-h pad" style={{ paddingTop: 18 }}><span className="label">Week by week</span></div>
          <TierChart s={my} />
        </div>
      </div>
      <h2 className="sect-title">Tiers</h2>
      <div className="desk-grid two-even">
        <div className="card flush"><TiersTable current={me.tier} /></div>
        <TierRules tier={me.tier} />
      </div>
    </div>
  );
}
