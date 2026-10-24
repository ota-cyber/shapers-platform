// Reads meetings from Google Calendar (read only) and upserts them into public.meetings.
// Rows are matched by iCal UID, the same key the .ics seed uses, so imported
// history and later syncs never duplicate a meeting.
//
// Call: POST /functions/v1/sync-calendar with an admin's access token
//       (or the service role key, e.g. from a cron job).
// Env:  GOOGLE_CALENDAR_ID, GOOGLE_API_KEY (calendar must be public),
//       optional GOOGLE_CALENDAR_API_BASE (tests), SUPABASE_URL / keys (provided by Supabase).

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const CALENDAR_ID = Deno.env.get("GOOGLE_CALENDAR_ID");
const API_KEY = Deno.env.get("GOOGLE_API_KEY");
const GOOGLE_BASE = Deno.env.get("GOOGLE_CALENDAR_API_BASE") ?? "https://www.googleapis.com/calendar/v3";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

type GoogleEvent = {
  id: string;
  iCalUID: string;
  status?: string;
  summary?: string;
  description?: string;
  location?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
};

async function isAdmin(authHeader: string | null): Promise<boolean> {
  if (!authHeader) return false;
  const token = authHeader.replace(/^Bearer /, "");
  if (token === SERVICE_KEY) return true;
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/is_admin`, {
    method: "POST",
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: "{}",
  });
  return r.ok && (await r.json()) === true;
}

async function fetchEvents(): Promise<GoogleEvent[]> {
  const events: GoogleEvent[] = [];
  let pageToken = "";
  do {
    const params = new URLSearchParams({
      key: API_KEY!,
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "2500",
      showDeleted: "false",
    });
    if (pageToken) params.set("pageToken", pageToken);
    const r = await fetch(`${GOOGLE_BASE}/calendars/${encodeURIComponent(CALENDAR_ID!)}/events?${params}`);
    if (!r.ok) throw new Error(`Google Calendar ${r.status}: ${await r.text()}`);
    const page = await r.json();
    events.push(...(page.items ?? []));
    pageToken = page.nextPageToken ?? "";
  } while (pageToken);
  return events;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (!CALENDAR_ID || !API_KEY) return json({ error: "GOOGLE_CALENDAR_ID and GOOGLE_API_KEY are not set" }, 500);
  if (!(await isAdmin(req.headers.get("Authorization")))) return json({ error: "Admins only" }, 403);

  const db = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" };
  const series: { id: string; name: string }[] = await (await fetch(`${SUPABASE_URL}/rest/v1/series?select=id,name`, { headers: db })).json();
  const byName = new Map(series.map((s) => [s.name.toLowerCase(), s.id]));

  const rows = [];
  const skipped: string[] = [];
  for (const ev of await fetchEvents()) {
    if (ev.status === "cancelled" || !ev.start?.dateTime || !ev.end?.dateTime) continue;
    // Series from the description ("Series: Grants"), else from the title ("Grants meeting").
    const fromDescription = ev.description?.match(/Series:\s*([^\n<]+)/)?.[1]?.trim();
    const fromTitle = ev.summary?.replace(/\s+meeting$/i, "").trim();
    const seriesId = byName.get((fromDescription ?? "").toLowerCase()) ?? byName.get((fromTitle ?? "").toLowerCase());
    if (!seriesId) {
      skipped.push(ev.summary ?? ev.id);
      continue;
    }
    rows.push({
      ical_uid: ev.iCalUID,
      gcal_event_id: ev.id,
      series_id: seriesId,
      title: ev.summary ?? "Meeting",
      starts_at: ev.start.dateTime,
      ends_at: ev.end.dateTime,
      location: ev.location ?? null,
      description: ev.description ?? null,
      synced_at: new Date().toISOString(),
    });
  }

  if (rows.length) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/meetings?on_conflict=ical_uid`, {
      method: "POST",
      headers: { ...db, Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(rows),
    });
    if (!r.ok) return json({ error: `Saving meetings failed: ${await r.text()}` }, 500);
  }
  return json({ synced: rows.length, skipped });
});
