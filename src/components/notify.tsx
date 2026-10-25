"use client";

// Notifications in Settings: turn them on, switch types off, preview every one.

import { useEffect, useState } from "react";
import { useApp, DEFAULT_NOTIFY } from "@/lib/store";
import { CATEGORY_LABEL, MAX_PER_DAY, NOTIFICATIONS, QUIET_HOURS, type NotifyCategory, type NotifyKind } from "@/lib/notifications";
import { enablePush, pushState, testNotification, updatePushCategories, type PushState } from "@/lib/push";
import { Sheet } from "./ui";

const STATE_LINE: Record<PushState, string> = {
  unsupported: "This browser can't show notifications here. They work on the live app in Chrome, Edge, Firefox and Safari.",
  "needs-home-screen": "On iPhone, add Shapers to your Home Screen first (Share → Add to Home Screen), then open it from there and turn notifications on.",
  default: "Off. Turn them on to get reminders for your hours, meetings and tasks.",
  granted: "On for this device.",
  denied: "Blocked. Allow notifications for this site in your browser settings, then come back.",
};

/** Which categories a person can get. */
function categoriesFor(admin: boolean): NotifyCategory[] {
  return admin ? ["hours", "meetings", "tasks", "onboarding", "admin"] : ["hours", "meetings", "tasks", "onboarding"];
}

export function TurnOnButton({ label = "Turn on notifications" }: { label?: string }) {
  const { prefs } = useApp();
  const [state, setState] = useState<PushState>("unsupported");
  useEffect(() => setState(pushState()), []);
  if (state === "granted") return <p className="small muted">Notifications are on.</p>;
  return (
    <>
      <button className="btn outline" onClick={async () => setState(await enablePush(prefs.notify ?? DEFAULT_NOTIFY))} disabled={state === "denied"}>
        {label}
      </button>
      {state !== "default" && <p className="small muted" style={{ marginTop: 8 }}>{STATE_LINE[state]}</p>}
    </>
  );
}

export function NotifySettings() {
  const { me, prefs, setPrefs } = useApp();
  const [state, setState] = useState<PushState>("unsupported");
  const [preview, setPreview] = useState(false);
  const [tested, setTested] = useState<string | null>(null);
  useEffect(() => setState(pushState()), []);
  const notify = prefs.notify ?? DEFAULT_NOTIFY;
  const toggle = (c: NotifyCategory) => {
    const next = { ...notify, [c]: !notify[c] };
    setPrefs({ notify: next });
    void updatePushCategories(next);
  };
  return (
    <>
      <div className="group-h">Notifications</div>
      <div className="rows">
        <div style={{ flexWrap: "wrap" }}>
          <span className="k" style={{ textTransform: "none" }}>{STATE_LINE[state]}</span>
          {state !== "granted" && (
            <button className="btn-s on" disabled={state === "denied"} onClick={async () => setState(await enablePush(notify))}>Turn on</button>
          )}
          {state === "granted" && (
            <button className="btn-s" onClick={async () => setTested((await testNotification("Still working?", "Tap Yes for another hour, or we clock you out.")) ? "Sent." : "Couldn't send.")}>
              {tested ?? "Send a test"}
            </button>
          )}
        </div>
        {categoriesFor(me.admin).map((c) => (
          <button key={c} style={{ width: "100%" }} onClick={() => toggle(c)} aria-pressed={notify[c]}>
            <span className="k" style={{ textAlign: "left" }}>{CATEGORY_LABEL[c]}</span>
            <span className={`btn-s ${notify[c] ? "on" : ""}`}>{notify[c] ? "On" : "Off"}</span>
          </button>
        ))}
        <button style={{ width: "100%" }} onClick={() => setPreview(true)}>
          <span className="k" style={{ textAlign: "left" }}>See every notification</span>
          <span className="go">→</span>
        </button>
      </div>
      <p className="small muted pad" style={{ paddingTop: 10 }}>
        Quiet from {QUIET_HOURS.from} to {QUIET_HOURS.to}, at most {MAX_PER_DAY} a day. Clock-in and meeting check-in reminders still come through.
      </p>
      {preview && <NotifyPreview onClose={() => setPreview(false)} admin={me.admin} />}
    </>
  );
}

function NotifyPreview({ onClose, admin }: { onClose: () => void; admin: boolean }) {
  const cats = categoriesFor(admin);
  return (
    <Sheet title="Notifications" onClose={onClose}>
      <div className="pad" style={{ paddingTop: 18, paddingBottom: 24 }}>
        {cats.map((c) => (
          <section key={c} style={{ marginBottom: 22 }}>
            <div className="label m" style={{ marginBottom: 10 }}>{CATEGORY_LABEL[c]}</div>
            <div className="ntf-list">
              {NOTIFICATIONS.filter((n) => n.category === c).map((n) => <NotifyCard key={n.id} n={n} />)}
            </div>
          </section>
        ))}
      </div>
    </Sheet>
  );
}

export function NotifyCard({ n }: { n: NotifyKind }) {
  return (
    <div className="ntf">
      <div className="ntf-icon" aria-hidden><img src="/icon-192.png" alt="" onError={(e) => ((e.target as HTMLImageElement).style.display = "none")} /></div>
      <div className="grow" style={{ minWidth: 0 }}>
        <div className="ntf-top"><b>{n.title}</b><span>{n.ago}</span></div>
        <div className="ntf-body">{n.body}</div>
        {n.actions && (
          <div className="ntf-actions">{n.actions.map((a) => <span key={a.id}>{a.title}</span>)}</div>
        )}
        <div className="ntf-when">{n.to} · {n.when}</div>
      </div>
    </div>
  );
}
