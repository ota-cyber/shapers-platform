"use client";

// Shown in backend mode when nobody is signed in, or when a Google account is
// not on the roster. Members sign in with Google; the demo people sign in with
// the demo password so anyone can try the platform.

import { Img } from "@/components/ui";

// Names and avatars match the members table (supabase/seed.sql).
const DEMO = [
  { id: "petra.jerman", label: "Petra Jerman", avatar: "dove", line: "GO! member, close to Impact" },
  { id: "lea.zorman", label: "Lea Zorman", avatar: "sprout", line: "New, onboarding" },
  { id: "rok.golob", label: "Rok Golob", avatar: "key", line: "Impact, buddy of two new members" },
  { id: "ana.kovac", label: "Ana Petrič", avatar: "bust", line: "Admin" },
];

export function SignIn(props: {
  /** Signed in, onboarding, but no buddy yet: blocked until an admin assigns one. */
  waitingForBuddy?: string;
  notMemberEmail: string | null;
  busy: boolean;
  error: string | null;
  onGoogle: () => void;
  onDemo: (id: string) => void;
  onSignOut: () => void;
  onRetry: () => void;
}) {
  return (
    <main style={{ minHeight: "100vh", background: "var(--bg)", display: "grid", placeItems: "center", padding: "40px var(--gutter, 16px)" }}>
      <div style={{ width: "100%", maxWidth: 420 }}>
        <div className="wordmark" style={{ marginBottom: 36 }}>Global — Shapers</div>

        {props.waitingForBuddy ? (
          <>
            <h1 className="serif" style={{ fontSize: 38, lineHeight: 1.1, margin: "0 0 14px" }}>Your buddy is being assigned</h1>
            <p className="mono-lc" style={{ color: "var(--muted)", margin: "0 0 28px" }}>
              Welcome, {props.waitingForBuddy.split(" ")[0]}. Every new Shaper starts with a buddy. An admin is pairing you with
              one now; you can start as soon as that&apos;s done.
            </p>
            <div style={{ display: "grid", gap: 8 }}>
              <button className="btn block" onClick={props.onRetry} disabled={props.busy}>Check again</button>
              <button className="btn outline block" onClick={props.onSignOut} disabled={props.busy}>Log out</button>
            </div>
          </>
        ) : props.notMemberEmail ? (
          <>
            <h1 className="serif" style={{ fontSize: 38, lineHeight: 1.1, margin: "0 0 14px" }}>Your request is in</h1>
            <p className="mono-lc" style={{ color: "var(--muted)", margin: "0 0 28px" }}>
              {props.notMemberEmail} is waiting for an admin to approve it. Once approved you join as a Shapers GO! member and
              start with onboarding.
            </p>
            <div style={{ display: "grid", gap: 8 }}>
              <button className="btn block" onClick={props.onRetry} disabled={props.busy}>Check again</button>
              <button className="btn outline block" onClick={props.onSignOut} disabled={props.busy}>Use another account</button>
            </div>
          </>
        ) : (
          <>
            <h1 className="serif" style={{ fontSize: 38, lineHeight: 1.1, margin: "0 0 14px" }}>Your week at Shapers</h1>
            <p className="mono-lc" style={{ color: "var(--muted)", margin: "0 0 28px" }}>
              Tasks, hours and meetings in one place. Sign in with your Shapers Google account.
            </p>
            <button className="btn block" onClick={props.onGoogle} disabled={props.busy}>Continue with Google</button>
          </>
        )}

        {props.error && <p className="mono-lc" style={{ color: "var(--ink)", marginTop: 16 }}>{props.error}</p>}

        <div className="mono" style={{ color: "var(--muted)", margin: "44px 0 12px" }}>Or try the demo as</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {DEMO.map((d) => (
            <button key={d.id} disabled={props.busy} onClick={() => props.onDemo(d.id)}
              style={{ display: "grid", justifyItems: "center", alignContent: "start", gap: 10, padding: "20px 12px 18px", border: "1px solid var(--line-strong)", background: "var(--paper)", textAlign: "center", cursor: "pointer" }}>
              <span className="avatar" style={{ width: 96, height: 96 }}><Img name={d.avatar} alt="" /></span>
              <span className="serif" style={{ fontSize: 20, lineHeight: 1.15 }}>{d.label}</span>
              <span className="mono-lc" style={{ color: "var(--muted)" }}>{d.line}</span>
            </button>
          ))}
        </div>
      </div>
    </main>
  );
}
