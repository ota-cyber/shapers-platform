"use client";

// Shown in backend mode when nobody is signed in, or when a Google account is
// not on the roster. Members sign in with Google; the demo people sign in with
// the demo password so anyone can try the platform.

const DEMO = [
  { id: "petra.jerman", label: "Petra", line: "GO! member, close to Impact" },
  { id: "lea.zorman", label: "Lea", line: "New, onboarding" },
  { id: "rok.golob", label: "Rok", line: "Impact, buddy of two new members" },
  { id: "ana.kovac", label: "Ana", line: "Admin" },
];

export function SignIn(props: {
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

        {props.notMemberEmail ? (
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
        <div style={{ display: "grid", gap: 8 }}>
          {DEMO.map((d) => (
            <button key={d.id} className="btn outline block" disabled={props.busy} onClick={() => props.onDemo(d.id)}
              style={{ display: "flex", justifyContent: "space-between", gap: 12, textAlign: "left" }}>
              <span>{d.label}</span>
              <span className="mono-lc" style={{ opacity: 0.7 }}>{d.line}</span>
            </button>
          ))}
        </div>
      </div>
    </main>
  );
}
