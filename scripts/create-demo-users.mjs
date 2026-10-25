#!/usr/bin/env node
// Creates a sign-in for every sandbox member so the demo can log in as anyone.
// Uses the Supabase Auth admin API directly; no npm install needed (Node 18+).
//
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... DEMO_PASSWORD=... node scripts/create-demo-users.mjs
//
// Members are linked to their sign-in by email (trigger link_auth_user).
// Safe to run twice: existing users are skipped.

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const password = process.env.DEMO_PASSWORD;
if (!url || !key || !password) {
  console.error("Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and DEMO_PASSWORD.");
  process.exit(1);
}
const headers = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };

const res = await fetch(`${url}/rest/v1/members?select=email,name&order=name`, { headers });
if (!res.ok) throw new Error(`Reading members failed: ${res.status} ${await res.text()}`);
const members = await res.json();

let created = 0;
for (const m of members) {
  const r = await fetch(`${url}/auth/v1/admin/users`, {
    method: "POST",
    headers,
    body: JSON.stringify({ email: m.email, password, email_confirm: true, user_metadata: { name: m.name } }),
  });
  if (r.ok) created++;
  else if (r.status !== 422) throw new Error(`${m.email}: ${r.status} ${await r.text()}`);
}
console.log(`${created} sign-ins created, ${members.length - created} already existed.`);
