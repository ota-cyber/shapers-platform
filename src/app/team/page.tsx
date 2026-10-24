"use client";

import Link from "next/link";
import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useApp, type RosterRow } from "@/lib/store";
import { fmt, hoursLabel } from "@/lib/dates";
import { TIERS, type Standing } from "@/lib/tiers";
import type { Member, Series, TierId } from "@/lib/types";
import { ONBOARDING_STEPS, SETUP_STEPS } from "@/lib/seed";
import { RecordMeetings } from "@/components/home";
import { Avatar, Img, Meter, Sheet, Signs, first, handle } from "@/components/ui";

type View = "everyone" | "up" | "dropping" | "new" | "approvals" | "meetings" | "overview";

export default function TeamPage() {
  return (
    <Suspense>
      <Team />
    </Suspense>
  );
}

function Team() {
  const { me } = useApp();
  const params = useSearchParams();
  const router = useRouter();
  const view = (params.get("view") as View) || "everyone";
  const setView = (v: View) => router.replace(`/team?view=${v}`, { scroll: false });
  const views: { id: View; label: string }[] = me.admin
    ? [
        { id: "everyone", label: "Everyone" },
        { id: "overview", label: "Overview" },
        { id: "up", label: "Moving up" },
        { id: "dropping", label: "Dropping" },
        { id: "new", label: "New" },
        { id: "approvals", label: "Approvals" },
        { id: "meetings", label: "Meetings" },
      ]
    : [
        { id: "everyone", label: "Everyone" },
        { id: "new", label: "New" },
      ];

  const chips = (
    <div className="chips">
      {views.map((v) => (
        <button key={v.id} aria-pressed={view === v.id} onClick={() => setView(v.id)}>{v.label}</button>
      ))}
    </div>
  );

  const content =
    view === "overview" ? <Overview /> :
    view === "approvals" ? <Approvals /> :
    view === "meetings" ? <RecordMeetings /> :
    <People view={view} />;

  return (
    <>
      <div className="page hide-d">
        {chips}
        {content}
      </div>
      <div className="page hide-m">
        <div className="desk-grid two">
          <div className="panel sticky" style={{ maxHeight: "calc(100vh - 130px)", overflow: "auto" }}>
            <People view="everyone" compact />
          </div>
          <div className="panel">
            {chips}
            {view === "everyone" ? <>{me.admin && <QuickAdd />}<Overview /></> : content}
          </div>
        </div>
      </div>
    </>
  );
}

function People({ view, compact }: { view: View; compact?: boolean }) {
  const { db, me, standingOf, onboardingDone, setupDone, stalledDays } = useApp();
  const [q, setQ] = useState("");
  const all = useMemo(() => db.members.map((m) => standingOf(m.id)), [db, standingOf]);
  const match = (s: Standing) => !q || s.member.name.toLowerCase().includes(q.toLowerCase());
  const newbies = all.filter((s) => s.member.onboarding !== null && match(s));
  const settingUp = all.filter((s) => { const d = setupDone(s.member); return d && !Object.values(d).every(Boolean) && match(s); });

  if (view === "up" || view === "dropping") {
    const list = all.filter((s) => s.flag === (view === "up" ? "moving-up" : "dropping"));
    return (
      <>
        <div className="sect">
          <div className="h-l">{view === "up" ? "Showing the pattern of the next tier." : "Under their hours lately."}</div>
          <p className="small muted" style={{ marginTop: 8 }}>
            {view === "up"
              ? "Hours kept at least 80% of weeks, no unexcused absences, and either within a month of their 6 GO! months or already working at the next tier's pace. Promotion stays your call."
              : "Two weeks in a row under target, or a four-week average under 75%. Pause weeks don't count. Their buddy gets the same nudge."}
          </p>
        </div>
        {list.map((s) => <PersonRow key={s.member.id} s={s} reason={view === "up" ? `${s.monthsInTier.toFixed(1)} months in ${s.member.tier} · avg ${hoursLabel(s.avg4)}` : `avg ${hoursLabel(s.avg4)} of ${s.target} · ${s.trend}`} />)}
        {!list.length && <div className="empty">Nobody right now.</div>}
      </>
    );
  }

  if (view === "new") {
    return (
      <>
        <div className="sect"><div className="h-l">Onboarding</div><p className="small muted" style={{ marginTop: 6 }}>New members, how far along they are, and who their buddy is.</p></div>
        {newbies.map((s) => {
          const done = onboardingDone(s.member);
          const n = Object.values(done).filter(Boolean).length;
          const buddy = db.members.find((m) => m.id === s.member.buddyId);
          return (
            <Link key={s.member.id} href={`/team/${s.member.id}`} className="person">
              <span className="reddot"><Avatar m={s.member} size="m" /></span>
              <div className="grow">
                <div><span className="nm">{s.member.name}</span><span className="hd">{handle(s.member)}</span></div>
                <div className="signs s"><span>⊙ {n}/{ONBOARDING_STEPS.length} steps</span><span>☽ buddy {buddy ? first(buddy) : "—"}</span><span>↑ day {Math.max(1, Math.round((Date.now() - new Date(s.member.joined).getTime()) / 864e5))}</span></div>
                <div style={{ marginTop: 8 }}><Meter value={n} max={ONBOARDING_STEPS.length} /></div>
                {s.member.graduation ? <div className="small" style={{ marginTop: 6 }}>Buddy proposed ending onboarding. Waiting for an admin.</div>
                  : stalledDays(s.member) !== null && <div className="small" style={{ marginTop: 6 }}>No progress in {stalledDays(s.member)} days. Their buddy has the nudge.</div>}
              </div>
              <span className="go">→</span>
            </Link>
          );
        })}
        {!newbies.length && <div className="empty">No one is onboarding.</div>}
        {settingUp.length > 0 && (
          <>
            <div className="sect"><div className="h-l">Setting up</div><p className="small muted" style={{ marginTop: 6 }}>Members who were here before the app, on their three setup steps.</p></div>
            {settingUp.map((s) => {
              const n = Object.values(setupDone(s.member)!).filter(Boolean).length;
              return <PersonRow key={s.member.id} s={s} reason={`${n} of ${SETUP_STEPS.length} setup steps`} dot />;
            })}
          </>
        )}
      </>
    );
  }

  const rest = all.filter((s) => match(s) && (compact || s.member.onboarding === null)).sort((a, b) => a.member.name.localeCompare(b.member.name));
  let last = "";
  return (
    <>
      <div className="search"><span className="muted">⌕</span><input placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      {me.admin && !compact && <QuickAdd />}
      {!compact && newbies.length > 0 && (
        <>
          <div className="label pad" style={{ textTransform: "none", letterSpacing: 0, fontFamily: "var(--mono)" }}>New</div>
          <div style={{ marginTop: 6, borderTop: "1px solid var(--line)" }}>
            {newbies.map((s) => <PersonRow key={s.member.id} s={s} dot />)}
          </div>
        </>
      )}
      <div className="label pad" style={{ textTransform: "none", letterSpacing: 0, fontFamily: "var(--mono)", paddingTop: 26 }}>{compact ? "Everyone" : "Your team"}</div>
      {rest.map((s) => {
        const L = s.member.name[0];
        const head = L !== last ? ((last = L), <div key={"h" + L} className="letter">{L}</div>) : null;
        return [head, <PersonRow key={s.member.id} s={s} dot={s.member.onboarding !== null} />];
      })}

    </>
  );
}

/** Admins: add a cohort member, start a project, or bring in everyone from before the app. */
function QuickAdd() {
  const [adding, setAdding] = useState<"member" | "project" | "roster" | null>(null);
  return (
    <>
      <div className="label pad" style={{ textTransform: "none", letterSpacing: 0, fontFamily: "var(--mono)" }}>Quick add</div>
      <div className="quick">
        <div className="q"><div className="ring"><Img name="key" /></div>Add a new member<div><button className="btn-s" onClick={() => setAdding("member")}>Add</button></div></div>
        <div className="q"><div className="ring"><Img name="book" /></div>Start a project<div><button className="btn-s" onClick={() => setAdding("project")}>Add</button></div></div>
        <div className="q"><div className="ring"><Img name="hands" /></div>Import the roster<div><button className="btn-s" onClick={() => setAdding("roster")}>Import</button></div></div>
      </div>
      {adding === "member" && <AddMember onClose={() => setAdding(null)} />}
      {adding === "project" && <AddProject onClose={() => setAdding(null)} />}
      {adding === "roster" && <ImportRoster onClose={() => setAdding(null)} />}
    </>
  );
}

function PersonRow({ s, reason, dot }: { s: Standing; reason?: string; dot?: boolean }) {
  return (
    <Link href={`/team/${s.member.id}`} className="person">
      <span className={dot ? "reddot" : ""}><Avatar m={s.member} size="s" /></span>
      <div className="grow">
        <div><span className="nm">{s.member.name}</span><span className="hd">{handle(s.member)}</span></div>
        <Signs s={s} small />
        {reason && <div className="small muted" style={{ marginTop: 2 }}>{reason}</div>}
      </div>
      <span className="go">→</span>
    </Link>
  );
}

const SERIES: Series[] = ["Community", "Summer School", "Grants", "Shape Talks", "Shapers Tech", "Shapers Voice"];

function AddMember({ onClose }: { onClose: () => void }) {
  const { db, addMember } = useApp();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [buddy, setBuddy] = useState("");
  const [series, setSeries] = useState<Series[]>([]);
  const [done, setDone] = useState(false);
  if (done)
    return (
      <Sheet title="New member" onClose={onClose}>
        <div className="glance">
          <div className="h-l">{name.split(" ")[0]} is in.</div>
          <p className="small" style={{ marginTop: 10 }}>They start as GO!, the six-month clock starts today, and their first login opens onboarding.</p>
          <button className="btn" style={{ marginTop: 24 }} onClick={onClose}>Got it</button>
        </div>
      </Sheet>
    );
  return (
    <Sheet title="Add a new member" onClose={onClose}>
      <div className="pad stack" style={{ paddingTop: 22 }}>
        <div className="h-l center">One step. The rest is onboarding.</div>
        <div className="field"><label>Name</label><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name Surname" /></div>
        <div className="field"><label>Email</label><input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@sandbox.example" /></div>
        <div className="field">
          <label>Buddy</label>
          <select value={buddy} onChange={(e) => setBuddy(e.target.value)}>
            <option value="">Choose later</option>
            {db.members.filter((m) => m.tier !== "GO!").map((m) => <option key={m.id} value={m.id}>{m.name} · {m.tier}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Meeting series (Community is for everyone)</label>
          <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
            {SERIES.slice(1).map((s) => (
              <button key={s} className={`btn-s ${series.includes(s) ? "on" : ""}`} onClick={() => setSeries(series.includes(s) ? series.filter((x) => x !== s) : [...series, s])}>{s}</button>
            ))}
          </div>
        </div>
        <button className="btn block" disabled={!name || !email.includes("@")} onClick={() => { addMember({ name, email, buddyId: buddy || null, series }); setDone(true); }}>Add as GO!</button>
      </div>
    </Sheet>
  );
}

const TIER_IDS: TierId[] = ["GO!", "Impact", "Core"];

/** One member per line: name, email, tier, and optionally the date they reached that tier. */
function parseRoster(text: string): { rows: RosterRow[]; bad: number } {
  const rows: RosterRow[] = [];
  let bad = 0;
  for (const line of text.split("\n").map((l) => l.trim()).filter(Boolean)) {
    const [name, email, tierRaw, since] = line.split(/[,;\t]/).map((x) => x.trim());
    const tier = TIER_IDS.find((t) => t.toLowerCase() === (tierRaw ?? "").toLowerCase().replace(/^go$/, "go!"));
    if (!name || !email?.includes("@") || !tier || (since && !/^\d{4}-\d{2}-\d{2}$/.test(since))) bad++;
    else rows.push({ name, email, tier, tierSince: since || undefined });
  }
  return { rows, bad };
}

function ImportRoster({ onClose }: { onClose: () => void }) {
  const { importRoster } = useApp();
  const [text, setText] = useState("");
  const [result, setResult] = useState<{ added: number; skipped: number } | null>(null);
  const { rows, bad } = parseRoster(text);
  if (result)
    return (
      <Sheet title="Import the roster" onClose={onClose}>
        <div className="glance">
          <div className="h-l">{result.added} member{result.added === 1 ? "" : "s"} in.</div>
          <p className="small" style={{ marginTop: 10 }}>
            {result.skipped ? `${result.skipped} were already here and were left as they are. ` : ""}Each new one gets three setup steps on their home screen: check their tier, pick their projects, clock their first hour. Find them under New.
          </p>
          <button className="btn" style={{ marginTop: 24 }} onClick={onClose}>Got it</button>
        </div>
      </Sheet>
    );
  return (
    <Sheet title="Import the roster" onClose={onClose}>
      <div className="pad stack" style={{ paddingTop: 22 }}>
        <div className="h-l center">Everyone who was here before the app.</div>
        <p className="small muted center">They keep their tier and skip onboarding. New cohort members are added one by one instead.</p>
        <div className="field">
          <label>One per line: name, email, tier, in tier since (optional)</label>
          <textarea rows={8} value={text} onChange={(e) => setText(e.target.value)} placeholder={"Maja Horvat, maja@sandbox.example, Core, 2024-06-01\nRok Golob, rok@sandbox.example, Impact"} style={{ fontFamily: "var(--mono)", fontSize: 13, height: 180 }} />
        </div>
        <p className="small muted">{rows.length} ready{bad ? ` · ${bad} line${bad === 1 ? "" : "s"} can't be read (tier must be GO!, Impact or Core; date as YYYY-MM-DD)` : ""}</p>
        <button className="btn block" disabled={!rows.length || bad > 0} onClick={() => setResult(importRoster(rows))}>Import {rows.length || ""}</button>
      </div>
    </Sheet>
  );
}

function AddProject({ onClose }: { onClose: () => void }) {
  const { db, me, addProject } = useApp();
  const [name, setName] = useState("");
  const [series, setSeries] = useState<Series>("Community");
  const [lead, setLead] = useState(me.id);
  const [desc, setDesc] = useState("");
  return (
    <Sheet title="Start a project" onClose={onClose}>
      <div className="pad stack" style={{ paddingTop: 22 }}>
        <div className="h-l center">Name it. Give it a lead. Done.</div>
        <div className="field"><label>Project name</label><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Shape Talks #15" /></div>
        <div className="row">
          <div className="field grow"><label>Series</label><select value={series} onChange={(e) => setSeries(e.target.value as Series)}>{SERIES.map((s) => <option key={s}>{s}</option>)}</select></div>
          <div className="field grow"><label>Lead</label><select value={lead} onChange={(e) => setLead(e.target.value)}>{db.members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></div>
        </div>
        <div className="field"><label>One line about it</label><input value={desc} onChange={(e) => setDesc(e.target.value)} /></div>
        <button className="btn block" disabled={!name} onClick={() => { addProject({ name, series, leadId: lead, description: desc }); onClose(); }}>Create project</button>
      </div>
    </Sheet>
  );
}

function Approvals() {
  const { db, member, resolveBackfill, resolvePause, resolveGraduation } = useApp();
  const back = db.backfills.filter((b) => b.status === "pending");
  const pauses = db.pauses.filter((p) => p.status === "requested");
  const grads = db.members.filter((m) => m.graduation);
  return (
    <>
      <div className="sect"><div className="h-l">Waiting for you</div><p className="small muted" style={{ marginTop: 6 }}>Hours older than a day, pause requests, and buddies ending onboarding. Everything else is trusted by default.</p></div>
      <div className="group-h">Hours back-filled</div>
      <div className="rows">
        {back.map((b) => (
          <div key={b.id} style={{ alignItems: "flex-start" }}>
            <div className="grow">
              <div className="k">{member(b.memberId)?.name} · {hoursLabel(b.hours)} on {fmt.short(b.date)}</div>
              {b.note && <div className="small muted">{b.note}</div>}
            </div>
            <button className="btn-s on" onClick={() => resolveBackfill(b.id, true)}>Approve</button>
            <button className="btn-s" onClick={() => resolveBackfill(b.id, false)}>Decline</button>
          </div>
        ))}
        {!back.length && <div><span className="k muted">Nothing pending</span></div>}
      </div>
      <div className="group-h">Pauses</div>
      <div className="rows">
        {pauses.map((p) => (
          <div key={p.id}>
            <div className="grow">
              <div className="k">{member(p.memberId)?.name} · {fmt.short(p.from)}–{fmt.short(p.to)}</div>
              {p.reason && <div className="small muted">{p.reason}</div>}
            </div>
            <button className="btn-s on" onClick={() => resolvePause(p.id, true)}>Approve</button>
            <button className="btn-s" onClick={() => resolvePause(p.id, false)}>Decline</button>
          </div>
        ))}
        {!pauses.length && <div><span className="k muted">Nothing pending</span></div>}
      </div>
      <div className="group-h">Onboarding finished</div>
      <div className="rows">
        {grads.map((m) => (
          <div key={m.id}>
            <div className="grow">
              <div className="k">{m.name}</div>
              <div className="small muted">Proposed by {member(m.graduation!.proposedBy)?.name ?? "their buddy"} on {fmt.short(m.graduation!.at)}</div>
            </div>
            <button className="btn-s on" onClick={() => resolveGraduation(m.id, true)}>Confirm</button>
            <button className="btn-s" onClick={() => resolveGraduation(m.id, false)}>Not yet</button>
          </div>
        ))}
        {!grads.length && <div><span className="k muted">Nothing pending</span></div>}
      </div>
    </>
  );
}

function Overview() {
  const { db, standingOf, today } = useApp();
  const all = db.members.map((m) => standingOf(m.id));
  const weeks = Array.from(new Set(db.hours.map((h) => h.weekStart))).sort().slice(-6);
  const series = Array.from(new Set(db.meetings.map((m) => m.series)));
  const att = (sr: string) => {
    const rows = db.attendance.filter((a) => a.series === sr);
    const ok = rows.filter((a) => a.state === "present" || a.state === "remote").length;
    return { pct: rows.length ? ok / rows.length : 0, un: rows.filter((a) => a.state === "unexcused").length, n: rows.length };
  };
  const finished = (m: Member) => db.tasks.filter((t) => t.assigneeId === m.id && t.status === "done").length;
  const kept = all.filter((s) => s.toKeep === 0).length;
  return (
    <>
      <section className="sect center">
        <div className="mono-lc muted">Week of {fmt.short(weeks[weeks.length - 1] ?? today)}</div>
        <div className="h-xl" style={{ marginTop: 10 }}>{kept} of {all.length} have made their week so far. {kept / all.length >= 0.6 ? "The institute is in good shape." : "Sunday decides the rest."}</div>
      </section>

      <section className="sect">
        <div className="label m" style={{ marginBottom: 12 }}>Tiers</div>
        <div className="ptable" style={{ margin: "0 calc(var(--gutter) * -1)" }}>
          {TIERS.map((t, i) => {
            const ms = all.filter((s) => s.member.tier === t.id);
            const ok = ms.filter((s) => s.toKeep === 0).length;
            return (
              <div key={t.id}>
                <div className="a"><span className={["planet w", "planet", "planet d"][i]} />{t.id} · {ms.length}</div>
                <div className="b" style={{ flexDirection: "column", alignItems: "stretch", gap: 6 }}>
                  <span className="small">{ok} of {ms.length} at {t.weeklyHours} h this week</span>
                  <Meter value={ok} max={Math.max(1, ms.length)} />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="sect">
        <div className="label m" style={{ marginBottom: 12 }}>Hours by tier, average per member</div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                <th className="mono" style={{ textAlign: "left", padding: "6px 4px", fontWeight: 400 }}>Week</th>
                {TIERS.map((t) => <th key={t.id} className="mono" style={{ textAlign: "right", padding: "6px 4px", fontWeight: 400 }}>{t.id}</th>)}
              </tr>
            </thead>
            <tbody>
              {weeks.map((w) => (
                <tr key={w} style={{ borderTop: "1px solid var(--line)" }}>
                  <td className="mono-lc" style={{ padding: "8px 4px" }}>{fmt.short(w)}</td>
                  {TIERS.map((t) => {
                    const ids = db.members.filter((m) => m.tier === t.id).map((m) => m.id);
                    const rows = db.hours.filter((h) => h.weekStart === w && ids.includes(h.memberId));
                    const avg = rows.length ? rows.reduce((s, h) => s + h.hours, 0) / rows.length : 0;
                    return (
                      <td key={t.id} style={{ textAlign: "right", padding: "8px 4px" }}>
                        <span className="serif" style={{ fontSize: 19, color: avg >= t.weeklyHours ? "var(--ink)" : "var(--muted)" }}>{avg.toFixed(1)}</span>
                        <span className="muted small"> /{t.weeklyHours}</span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="sect">
        <div className="label m" style={{ marginBottom: 12 }}>Attendance by series</div>
        <div className="ptable" style={{ margin: "0 calc(var(--gutter) * -1)" }}>
          {series.map((sr) => {
            const a = att(sr);
            return (
              <div key={sr}>
                <div className="a"><span className="planet" />{sr}</div>
                <div className="b" style={{ flexDirection: "column", alignItems: "stretch", gap: 6 }}>
                  <span className="small">{Math.round(a.pct * 100)}% attended · {a.un} unexcused</span>
                  <Meter value={a.pct} max={1} />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="sect">
        <div className="label m" style={{ marginBottom: 6 }}>Everyone, this week</div>
        <div className="rows" style={{ margin: "0 calc(var(--gutter) * -1)" }}>
          {[...all].sort((a, b) => a.thisWeek / a.target - b.thisWeek / b.target).map((s) => (
            <Link key={s.member.id} href={`/team/${s.member.id}`}>
              <span className="k" style={{ flex: "0 0 38%" }}>{s.member.name}<br /><span className="muted">{s.member.tier} · {s.streak}-wk streak · {finished(s.member)} tasks done</span></span>
              <span className="grow"><Meter value={s.thisWeek} max={Math.max(s.target, s.thisWeek)} mark={s.target} /></span>
              <span className="v" style={{ minWidth: 70 }}>{hoursLabel(s.thisWeek)}/{s.target}</span>
              {s.flag && <span className="tag">{s.flag === "moving-up" ? "↑" : "↓"}</span>}
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
