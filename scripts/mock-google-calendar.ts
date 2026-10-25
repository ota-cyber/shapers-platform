// Test double for the Google Calendar events API, serving sandbox/meetings.ics.
// Lets you test the sync-calendar function without a Google API key:
//   deno run --allow-net --allow-read scripts/mock-google-calendar.ts
// then serve the function with GOOGLE_CALENDAR_API_BASE=http://host.docker.internal:8787

const ics = (await Deno.readTextFile(new URL("../sandbox/meetings.ics", import.meta.url)))
  .replace(/\r\n/g, "\n")
  .replace(/\n[ \t]/g, "");

const toIso = (v: string) => `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}T${v.slice(9, 11)}:${v.slice(11, 13)}:${v.slice(13, 15)}Z`;

const items = [...ics.matchAll(/BEGIN:VEVENT\n([\s\S]*?)\nEND:VEVENT/g)].map(([, block], i) => {
  const f = Object.fromEntries(block.split("\n").map((l) => [l.slice(0, l.indexOf(":")).split(";")[0], l.slice(l.indexOf(":") + 1)]));
  return {
    id: `mock${i}`,
    iCalUID: f.UID,
    status: "confirmed",
    summary: f.SUMMARY,
    description: f.DESCRIPTION.replaceAll("\\n", "\n").replaceAll("\\,", ","),
    location: f.LOCATION?.replaceAll("\\,", ","),
    start: { dateTime: toIso(f.DTSTART) },
    end: { dateTime: toIso(f.DTEND) },
  };
});

Deno.serve({ port: 8787 }, (req) => {
  const url = new URL(req.url);
  if (!url.searchParams.get("key")) return new Response("missing key", { status: 403 });
  return Response.json({ items });
});
