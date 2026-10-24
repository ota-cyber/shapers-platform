"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useApp } from "@/lib/store";
import { headline, narrative } from "@/lib/copy";
import { fmt, hoursLabel, addDays } from "@/lib/dates";
import { EmojiLines, LogHours, NextMeeting, useHeadline } from "@/components/blocks";
import { AttendanceRecord, Badges, PathCard, ProfileHead, TierChart, TierRules, TiersTable, WeekStrip } from "@/components/profile";
import { Img, Sheet, Tabs, Useful } from "@/components/ui";

type Tab = "updates" | "chart" | "meetings" | "settings";
const TABS: { id: Tab; label: string }[] = [
  { id: "updates", label: "Updates" },
  { id: "chart", label: "Chart" },
  { id: "meetings", label: "Meetings" },
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
  const { my, me, db } = useApp();
  const params = useSearchParams();
  const router = useRouter();
  const tab = (params.get("tab") as Tab) || "updates";
  const setTab = (t: Tab) => router.replace(`/you?tab=${t}`, { scroll: false });
  const s = db.sessions.find((x) => x.memberId === me.id);
  const line = useHeadline();

  const body = (
    <>
      {tab === "updates" && <Updates />}
      {tab === "chart" && (
        <>
          <TierChart s={my} />
          <div className="sect center">
            <div className="h-l">In Shapers, each tier asks something:</div>
          </div>
          <TiersTable current={me.tier} />
          <div style={{ padding: "26px var(--gutter)" }}><TierRules tier={me.tier} /></div>
        </>
      )}
      {tab === "meetings" && (
        <>
          <NextMeeting />
          <AttendanceRecord memberId={me.id} />
        </>
      )}
      {tab === "settings" && <Settings />}
    </>
  );

  return (
    <>
      <div className="page hide-d">
        <ProfileHead s={my} you />
        <Tabs items={TABS} value={tab} onChange={setTab} dot={s ? "chart" : undefined} />
        {tab === "updates" && <WeekStrip memberId={me.id} />}
        {body}
      </div>
      <div className="page hide-m">
        <h1 className="desk-headline">{line}</h1>
        <div className="desk-grid two">
          <div className="panel sticky">
            <PathCard s={my} href="/you?tab=chart" />
          </div>
          <div className="panel">
            <Tabs items={TABS} value={tab} onChange={setTab} dot={s ? "chart" : undefined} />
            {body}
          </div>
        </div>
      </div>
    </>
  );
}

function Updates() {
  const { my, me, db, today } = useApp();
  const [log, setLog] = useState(false);
  const clocked = db.sessions.some((x) => x.memberId === me.id);
  const [p1, p2, p3] = narrative(db, my);
  return (
    <>
      <section className="sect">
        <div className="h-l hide-d" style={{ marginBottom: 16 }}>{headline(my, clocked, today)}</div>
        <EmojiLines s={my} />
        <Img name="stone" className="float-img" />
        <div className="body" style={{ marginTop: 6 }}><p>{p1}</p><p>{p2}</p></div>
        <div style={{ marginTop: 18 }}><Useful /></div>
      </section>
      <section className="sect">
        <div className="label">Streak</div>
        <div className="h-l" style={{ marginTop: 10 }}>{my.streak ? `${my.streak} week${my.streak === 1 ? "" : "s"} at ${me.tier}` : "A fresh start"}</div>
        <p className="body" style={{ marginTop: 8 }}>
          {my.streak
            ? `Every week you reach ${my.target} h adds one. Pause weeks hold it where it is; they never break it.`
            : `Reach ${my.target} h this week and the count begins. Nobody is keeping score but you and the wall chart.`}
        </p>
        <Link href="/you?tab=chart" className="arrow" style={{ marginTop: 12 }}>Details →</Link>
      </section>
      <PathCard s={my} />
      <section className="sect">
        <div className="label">{my.nextRule ? "The long view" : "Core"}</div>
        <p className="h-m" style={{ marginTop: 10 }}>{p3}</p>
      </section>
      <Badges s={my} />
      <section className="sect">
        <div className="mono-lc muted">Today — {fmt.monthDay(today)}</div>
        <div className="between" style={{ marginTop: 6 }}>
          <div>
            <div className="h-m">Your hours, week by week</div>
            <p className="small faint">Six weeks of history, plus this one. {hoursLabel(my.avg4)} a week on average lately.</p>
          </div>
          <Link href="/you?tab=chart" className="go">→</Link>
        </div>
      </section>
      <div className="center" style={{ padding: "34px 0 40px" }}>
        <button className="btn" onClick={() => setLog(true)}>Log hours you forgot</button>
      </div>
      {log && <LogHours onClose={() => setLog(false)} />}
    </>
  );
}

function Settings() {
  const { me, member, prefs, setPrefs, reset, db, today, requestPause } = useApp();
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
        <Link href="/you?tab=chart"><span className="k">Tier rules</span><span className="go">→</span></Link>
        <Link href="/onboarding"><span className="k">Onboarding</span><span className="go">→</span></Link>
        <Link href="/ask"><span className="k">Ask a question</span><span className="go">→</span></Link>
      </div>
      <div className="group-h">Demo</div>
      <div className="rows">
        <label style={{ width: "100%" }}>
          <span className="k">View as</span>
          <select value={prefs.meId} onChange={(e) => setPrefs({ meId: e.target.value })} style={{ border: 0, background: "transparent", fontFamily: "var(--mono)", fontSize: 13, textAlign: "right" }}>
            {[...db.members].sort((a, b) => a.name.localeCompare(b.name)).map((m) => (
              <option key={m.id} value={m.id}>{m.name} · {m.tier}{m.admin ? " · admin" : ""}{m.onboarding ? " · new" : ""}</option>
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
