"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/lib/store";
import { ONBOARDING_STEPS } from "@/lib/seed";
import type { OnboardingStepId } from "@/lib/types";
import { TierRules, TiersTable } from "@/components/profile";
import { Avatar, Img, Modal, Signs, first, handle } from "@/components/ui";

import Link from "next/link";
import { SCREENS, firstOpenScreen, flowDone, type Screen } from "@/lib/onboarding";
import { nextMeeting } from "@/lib/copy";
import { fmt } from "@/lib/dates";

export default function Onboarding() {
  const router = useRouter();
  const { me, db, member, standingOf, onboardingDone, completeStep, joinProject, clockIn } = useApp();
  const done = onboardingDone(me);
  // Existing members (onboarding null) get a read-only refresher: nothing is marked.
  const refresher = me.onboarding === null;
  const [i, setI] = useState(() => (refresher ? 0 : firstOpenScreen(done)));
  const [picked, setPicked] = useState<string[]>([]);
  const [finished, setFinished] = useState(false);
  const [replay, setReplay] = useState(false);
  const screen: Screen = SCREENS[i];
  const next = () => (i < SCREENS.length - 1 ? setI(i + 1) : setFinished(true));
  const mark = (...ids: OnboardingStepId[]) => !refresher && ids.forEach((id) => completeStep(me.id, id));
  const buddy = member(me.buddyId);

  const top = (
    <div className="mhead" style={{ background: "transparent", borderBottom: 0 }}>
      <button className="side mono" onClick={() => router.push("/")} style={{ color: screen === "project" ? "#ddd" : "var(--text)" }}>Close</button>
      <span className="mono-lc" style={{ textAlign: "center", color: screen === "project" ? "#eee" : "var(--ink)" }}>Step {i + 1} of {SCREENS.length}</span>
      <button className="side mono" onClick={next} style={{ color: screen === "project" ? "#ddd" : "var(--text)" }}>Skip</button>
    </div>
  );

  const Frame = ({ label, title, img, children, cta, onCta, alt = "Not right now" }: { label: string; title: string; img?: string; children?: React.ReactNode; cta: string; onCta: () => void; alt?: string | null }) => (
    <div className="page narrow" style={{ minHeight: "calc(100vh - 140px)" }}>
      {top}
      <div className="glance" style={{ paddingTop: 40 }}>
        <div className="mono-lc">{label}</div>
        <h1 className="h-l" style={{ marginTop: 10, maxWidth: 380, marginLeft: "auto", marginRight: "auto" }}>{title}</h1>
        {img && <Img name={img} className="hero-img" alt="" />}
        <div style={{ textAlign: "left" }}>{children}</div>
        <button className="btn" style={{ marginTop: 30, minWidth: 210 }} onClick={onCta}>{cta}</button>
        {alt && <div style={{ marginTop: 18 }}><button className="link" onClick={next}>{alt}</button></div>}
      </div>
    </div>
  );

  // Screens done: "Continue onboarding" shows what's left instead of replaying them.
  if (!refresher && flowDone(done) && !replay) return <WhatsLeft onReplay={() => { setI(0); setReplay(true); }} />;

  if (finished && refresher)
    return (
      <div className="page narrow">
        <Modal title="That's the tour." body="Nothing changed on your profile. Come back any time from You → Settings." action="Go home" onClose={() => router.push("/")} />
      </div>
    );

  if (finished)
    return (
      <div className="page narrow">
        <Modal title="You're a Shaper." body={`${Object.values(onboardingDone(me)).filter(Boolean).length} of ${ONBOARDING_STEPS.length} steps done. The rest happen on their own: your first task, your first meeting. Home is where your week lives now.`} action="Go home" onClose={() => router.push("/")} />
      </div>
    );

  if (screen === "welcome")
    return (
      <Frame label="Welcome" title={`${first(me)}, you're in. Here's how Shapers works.`} img="hands" cta="Continue" onCta={next} alt={null}>
        <p className="body center" style={{ maxWidth: 360, margin: "0 auto" }}>
          Seven short steps, mirroring your two onboarding meetings. When they&apos;re done, this becomes your home screen: your hours, your tasks, your meetings, and how close you are to the next tier.
        </p>
      </Frame>
    );

  if (screen === "rules")
    return (
      <Frame label="Meeting one" title="The rules everyone keeps." img="book" cta="I've read them" onCta={() => { mark("values"); next(); }}>
        <ul className="compat" style={{ maxWidth: 400, margin: "0 auto" }}>
          <li><span className="face">⊙</span><div><div className="t">Hours are office hours</div><div className="s">Clock in at Impact Hub. One tap, one-hour blocks.</div></div></li>
          <li><span className="face">☽</span><div><div className="t">Meetings are separate</div><div className="s">They never count toward your hours. When a meeting starts, open it in your calendar and tap &quot;I&apos;m here&quot; (or &quot;Remote&quot;) so your attendance is recorded.</div></div></li>
          <li><span className="face">↑</span><div><div className="t">Absences are announced</div><div className="s">On Slack: 72 h before Community, 24 h before a project meeting.</div></div></li>
          <li><span className="face">॥</span><div><div className="t">Pauses are allowed</div><div className="s">Pause weeks never count against you or your streak.</div></div></li>
        </ul>
      </Frame>
    );

  if (screen === "tiers")
    return (
      <div className="page narrow">
        {top}
        <div className="glance" style={{ paddingTop: 30, paddingBottom: 10 }}>
          <div className="mono-lc">Tiers</div>
          <h1 className="h-l" style={{ marginTop: 10 }}>Three tiers. You start at GO!</h1>
          <p className="small" style={{ marginTop: 10 }}>Each one asks a little more and trusts you a little more.</p>
        </div>
        <TiersTable current={me.tier} />
        <div style={{ padding: "22px var(--gutter)" }}><TierRules tier={me.tier} /></div>
        <p className="small center pad">After six months in GO!, leadership looks at your hours, attendance and initiative. Your home screen will show where you stand.</p>
        <div className="center" style={{ padding: "26px 0 40px" }}><button className="btn" onClick={() => { mark("tiers"); next(); }}>Got it</button></div>
      </div>
    );

  if (screen === "tools") {
    const tools: { id: OnboardingStepId; t: string }[] = [
      { id: "contract", t: "Sign your contract" },
      { id: "email", t: "Get your Shapers email" },
      { id: "slack", t: "Join Slack" },
      { id: "calendar", t: "Subscribe to the calendar" },
    ];
    return (
      <div className="page narrow">
        {top}
        <div className="glance" style={{ paddingTop: 30 }}>
          <div className="mono-lc">Meeting two</div>
          <h1 className="h-l" style={{ marginTop: 10 }}>Your tools, in one list.</h1>
          <Img name="key" className="float-img" />
        </div>
        <div className="rows">
          {tools.map((x) => (
            <button key={x.id} style={{ width: "100%" }} onClick={() => completeStep(me.id, x.id, !done[x.id])}>
              <span className="k" style={{ textAlign: "left", textDecoration: done[x.id] ? "line-through" : undefined, color: done[x.id] ? "var(--muted)" : undefined }}>{x.t}</span>
              <span className={`btn-s ${done[x.id] ? "on" : ""}`}>{done[x.id] ? "Done" : "Mark"}</span>
            </button>
          ))}
        </div>
        <p className="small muted pad" style={{ paddingTop: 12 }}>We never post to Slack or change your calendar. We only read the calendar to know your meetings.</p>
        <div className="center" style={{ padding: "26px 0 40px" }}><button className="btn" onClick={next}>Continue</button></div>
      </div>
    );
  }

  if (screen === "buddy")
    return (
      <Frame label="Your buddy" title={buddy ? `Meet ${first(buddy)}. Twenty minutes, every week.` : "Your buddy is on the way."} cta={buddy ? "We've met" : "Continue"} onCta={() => { if (buddy) mark("buddy"); next(); }}>
        {buddy && (
          <div style={{ border: "1px solid var(--line-strong)", background: "var(--paper)", marginTop: 26 }}>
            <div className="phead">
              <Avatar m={buddy} />
              <div className="grow">
                <div><span className="name">{first(buddy)}</span><span className="handle">{handle(buddy)}</span></div>
                <Signs s={standingOf(buddy.id)} />
              </div>
            </div>
            <p className="small pad" style={{ paddingBottom: 18 }}>
              {first(buddy)} is {buddy.tier} and works on {buddy.series.filter((s) => s !== "Community").join(" and ") || "Community"}. Ask them anything: where things are, who does what, whether an idea is good. They&apos;ll see how your first weeks are going and check in.
            </p>
          </div>
        )}
      </Frame>
    );

  if (screen === "project")
    return (
      <div className="void" style={{ background: "radial-gradient(ellipse at 30% 20%, #3a3a3a, #121212 60%)", minHeight: "100vh" }}>
        {top}
        <div style={{ maxWidth: 520, margin: "0 auto", padding: "40px var(--gutter) 140px" }}>
          <h1 className="h-l" style={{ color: "#fff" }}>Pick the projects you want to join.</h1>
          <p className="small" style={{ color: "#ddd", marginTop: 6 }}>Choose all that apply. The project lead will assign you your first task.</p>
          <div className="choices" style={{ marginTop: 22 }}>
            {db.projects.filter((p) => p.series === "Community" || me.series.includes(p.series)).concat(db.projects.filter((p) => !me.series.includes(p.series) && p.series !== "Community")).map((p) => (
              <button key={p.id} className="choice" aria-pressed={picked.includes(p.id)} onClick={() => setPicked(picked.includes(p.id) ? picked.filter((x) => x !== p.id) : [...picked, p.id])}>
                {p.name}
              </button>
            ))}
          </div>
          <button className="btn light block" style={{ marginTop: 26 }} disabled={!picked.length} onClick={() => { picked.forEach((id) => joinProject(me.id, id)); next(); }}>Continue</button>
        </div>
      </div>
    );

  return (
    <Frame
      label="Your first hour"
      title="Clock in. Every hour counts toward your week."
      cta={refresher || done["first-hour"] || db.sessions.some((x) => x.memberId === me.id) ? "Finish" : "Clock in now"}
      onCta={() => {
        if (!refresher && !done["first-hour"] && !db.sessions.some((x) => x.memberId === me.id)) clockIn(null);
        setFinished(true);
      }}
    >
      <div style={{ position: "relative", margin: "28px auto 0", maxWidth: 300, height: 250, background: "linear-gradient(#141414, #141414 70%, rgba(20,20,20,0))", borderRadius: "28px 28px 0 0", padding: "40px 12px 0" }}>
        {[
          ["now", "Your week at a glance", `${standingOf(me.id).toKeep ? `${standingOf(me.id).toKeep} h to keep GO! this week.` : "Your week is made."}`],
          ["Yesterday", "Still working?", "Tap yes for another hour, or we clock you out."],
          ["Mon", "Community in 2 days", "In person. Can't make it? Say so 72 h ahead."],
        ].map(([when, t, b], k) => (
          <div key={k} style={{ background: "#fff", borderRadius: 10, padding: "10px 12px", margin: k === 0 ? "0 -26px 10px" : "0 0 8px", display: "flex", gap: 10, textAlign: "left", boxShadow: "0 2px 8px rgba(0,0,0,.15)" }}>
            <span className="planet d" style={{ width: k === 0 ? 34 : 26, height: k === 0 ? 34 : 26 }} />
            <div className="grow" style={{ fontSize: k === 0 ? 13 : 11.5, lineHeight: 1.35 }}>
              <div className="between"><b style={{ fontWeight: 500 }}>{t}</b><span className="muted" style={{ fontSize: 10 }}>{when}</span></div>
              {b}
            </div>
          </div>
        ))}
      </div>
    </Frame>
  );
}

/** After the screens: the steps that only real activity completes, and who ends onboarding. */
function WhatsLeft({ onReplay }: { onReplay: () => void }) {
  const { me, db, now, member, onboardingDone } = useApp();
  const done = onboardingDone(me);
  const buddy = member(me.buddyId);
  const meet = nextMeeting(db, me.id, now);
  const wanted = (me.wantsProjects ?? []).map((id) => db.projects.find((p) => p.id === id)).filter(Boolean);
  const leads = wanted.map((p) => member(p!.leadId)?.name.split(" ")[0]).filter(Boolean);
  const items: { id: OnboardingStepId; title: string; line: string; href?: string }[] = [
    { id: "first-hour", title: "Clock your first hour", line: "Use Clock in on Home when you're at the Hub.", href: "/" },
    { id: "project", title: "Get your first task", line: wanted.length ? `You picked ${wanted.map((p) => p!.name).join(", ")}. ${leads.join(" or ")} will assign you a task.` : "Your project lead assigns it. Ask your buddy who to talk to." },
    { id: "first-task", title: "Finish your first task", line: "Anything assigned to you. Small is fine.", href: "/tasks" },
    { id: "first-meeting", title: "Attend your first meeting", line: meet ? `Next: ${meet.series}, ${fmt.weekday(meet.start)} ${fmt.short(meet.start)} at ${fmt.time(meet.start)}. Check in when it starts.` : "Check in when your next meeting starts." },
  ];
  const left = items.filter((x) => !done[x.id]).length;
  return (
    <div className="page narrow">
      <div className="glance" style={{ paddingTop: 40 }}>
        <div className="mono-lc">Onboarding</div>
        <h1 className="h-l" style={{ marginTop: 10 }}>{left ? `${left} thing${left === 1 ? "" : "s"} left, all done by doing.` : "Everything's done."}</h1>
        <p className="small" style={{ marginTop: 10 }}>
          {me.graduation
            ? `${member(me.graduation.proposedBy)?.name.split(" ")[0] ?? "Your buddy"} proposed graduating you. An admin confirms, then home becomes your everyday screen.`
            : left
              ? `When these are done, ${buddy ? buddy.name.split(" ")[0] : "your buddy"} can graduate you and an admin confirms.`
              : `${buddy ? buddy.name.split(" ")[0] : "Your buddy"} can now graduate you; an admin confirms.`}
        </p>
      </div>
      <div className="rows">
        {items.map((x) => {
          const body = (
            <>
              <span className="k" style={{ textDecoration: done[x.id] ? "line-through" : undefined, color: done[x.id] ? "var(--muted)" : undefined }}>
                {x.title}
                {!done[x.id] && <><br /><span className="muted" style={{ textTransform: "none" }}>{x.line}</span></>}
              </span>
              <span className="v">{done[x.id] ? "Done" : ""}</span>
            </>
          );
          return x.href && !done[x.id] ? <Link key={x.id} href={x.href}>{body}</Link> : <div key={x.id}>{body}</div>;
        })}
      </div>
      <div className="center" style={{ padding: "26px 0 40px" }}>
        <button className="link" onClick={onReplay}>Go through the screens again</button>
      </div>
    </div>
  );
}
