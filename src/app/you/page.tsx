"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useApp } from "@/lib/store";
import { fmt, addDays } from "@/lib/dates";
import { useHeadline } from "@/components/blocks";
import { ProfileGrid, ProfileHead } from "@/components/profile";
import { Sheet, Tabs } from "@/components/ui";

type Tab = "overview" | "settings";
const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "settings", label: "Settings" },
];

export default function YouPage() {
  return (
    <Suspense>
      <You />
    </Suspense>
  );
}

function You() {
  const { my } = useApp();
  const params = useSearchParams();
  const router = useRouter();
  const tab = (params.get("tab") as Tab) === "settings" ? "settings" : "overview";
  const setTab = (t: Tab) => router.replace(`/you?tab=${t}`, { scroll: false });
  const line = useHeadline();
  return (
    <div className="page">
      <ProfileHead s={my} you />
      <Tabs items={TABS} value={tab} onChange={setTab} />
      {tab === "overview" ? (
        <>
          <section className="sect"><h1 className="h-xl">{line}</h1></section>
          <ProfileGrid s={my} />
        </>
      ) : (
        <Settings />
      )}
    </div>
  );
}

function Settings() {
  const { me, member, prefs, setPrefs, reset, db, today, requestPause, setupDone } = useApp();
  const buddy = member(me.buddyId);
  const [pause, setPause] = useState(false);
  const [resetting, setResetting] = useState(false);
  const mine = db.pauses.filter((p) => p.memberId === me.id);
  return (
    <>
      <div className="group-h">Membership</div>
      <div className="rows">
        <div><span className="k">Tier</span><span className="v">{me.tier}</span></div>
        <div><span className="k">Weekly commitment</span><span className="v">{me.weeklyHours} h</span></div>
        <div><span className="k">In tier since</span><span className="v">{fmt.short(me.tierSince)} {me.tierSince.slice(0, 4)}</span></div>
        <div><span className="k">Buddy</span><span className="v">{buddy ? buddy.name : "—"}</span></div>
        <div><span className="k">Meeting series</span><span className="v">{me.series.length}</span></div>
      </div>
      <div className="group-h">Pause</div>
      <div className="rows">
        {mine.map((p) => (
          <div key={p.id}><span className="k">{fmt.short(p.from)} – {fmt.short(p.to)}</span><span className="v">{p.status}</span></div>
        ))}
        <button onClick={() => setPause(true)} style={{ width: "100%" }}><span className="k" style={{ textAlign: "left" }}>Request a pause</span><span className="go">→</span></button>
      </div>
      <div className="group-h">Support</div>
      <div className="rows">
        <Link href="/you"><span className="k">Tier rules</span><span className="go">→</span></Link>
        <Link href="/onboarding"><span className="k">Onboarding</span><span className="go">→</span></Link>
      </div>
      <div className="group-h">Demo</div>
      <div className="rows">
        <label style={{ width: "100%" }}>
          <span className="k">View as</span>
          <select value={prefs.meId} onChange={(e) => setPrefs({ meId: e.target.value })} style={{ border: 0, background: "transparent", fontFamily: "var(--mono)", fontSize: 13, textAlign: "right" }}>
            {[...db.members].sort((a, b) => a.name.localeCompare(b.name)).map((m) => (
              <option key={m.id} value={m.id}>{m.name} · {m.tier}{m.admin ? " · admin" : ""}{m.onboarding ? " · new" : Object.values(setupDone(m) ?? {}).some((v) => !v) ? " · setting up" : ""}</option>
            ))}
          </select>
        </label>
        <button onClick={() => setPrefs({ liveMeeting: !prefs.liveMeeting })} style={{ width: "100%" }}>
          <span className="k" style={{ textAlign: "left" }}>Pretend my next meeting is live</span>
          <span className="v">{prefs.liveMeeting ? "On" : "Off"}</span>
        </button>
        {resetting ? (
          <div>
            <span className="k">Reset all demo data?</span>
            <button className="btn-s on" onClick={() => { reset(); setResetting(false); }}>Reset</button>
            <button className="btn-s" onClick={() => setResetting(false)}>Cancel</button>
          </div>
        ) : (
          <button onClick={() => setResetting(true)} style={{ width: "100%" }}>
            <span className="k" style={{ textAlign: "left" }}>Reset demo data</span><span className="go">→</span>
          </button>
        )}
      </div>
      <div style={{ height: 40 }} />
      {pause && <PauseSheet onClose={() => setPause(false)} onSave={(f, t, r) => { requestPause(f, t, r); setPause(false); }} today={today} tier={me.tier} />}
    </>
  );
}

function PauseSheet({ onClose, onSave, today, tier }: { onClose: () => void; onSave: (f: string, t: string, r: string) => void; today: string; tier: string }) {
  const [from, setFrom] = useState(addDays(today, 7));
  const [to, setTo] = useState(addDays(today, 20));
  const [reason, setReason] = useState("");
  return (
    <Sheet title="Request a pause" onClose={onClose}>
      <div className="pad stack" style={{ paddingTop: 22 }}>
        <div className="h-l center">Take the time. Keep the streak.</div>
        <p className="small center">
          {tier === "GO!" ? "GO! pauses are short and agreed with your buddy." : tier === "Impact" ? "Impact members can pause up to 6 weeks a year, announced in advance." : "Talk to leadership about longer breaks."} Pause weeks never count as falling behind.
        </p>
        <div className="row">
          <div className="field grow"><label>From</label><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div className="field grow"><label>To</label><input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        </div>
        <div className="field"><label>Why</label><textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Exam period" /></div>
        <button className="btn block" disabled={!from || !to || to < from} onClick={() => onSave(from, to, reason)}>Send request</button>
      </div>
    </Sheet>
  );
}
