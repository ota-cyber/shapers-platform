#!/usr/bin/env python3
"""Build supabase/seed.sql from the hackathon sandbox package in sandbox/.

Standard library only. The generated seed.sql is committed, so rebuilding the
database never needs Python; run this again only if the sandbox files change.

    python3 scripts/build_seed.py

Imported as-is: roster, weekly hours, attendance, meetings (.ics).
Demo data the sandbox lacks (join dates, buddies, three new members, setup
members, projects, tasks, one back-fill request) mirrors the frontend's
src/lib/seed.ts on the UI branch, so the screens and the database tell the
same stories.
"""

import datetime as dt
import re
import uuid
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SANDBOX = ROOT / "sandbox"
OUT = ROOT / "supabase" / "seed.sql"
NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
ID_NS = uuid.UUID("5b1c1f5e-7a52-4d0c-9a8e-3c0de5a9e001")
DOMAIN = "sandbox.example"

SERIES_IDS = {
    "Community": "community",
    "Summer School": "summer-school",
    "Grants": "grants",
    "Shape Talks": "shape-talks",
    "Shapers Tech": "shapers-tech",
    "Shapers Voice": "shapers-voice",
}
TIERS = {"GO!": "go", "Impact": "impact", "Core": "core"}
AVATARS = ["bust", "stone", "apple", "moon", "dove", "hands", "compass", "sprout", "book", "key"]

# ---------------------------------------------------------------- demo data (from the UI seed)

TIER_SINCE = {
    "ana.kovac": "2023-09-01", "luka.novak": "2024-01-15", "maja.horvat": "2024-06-01",
    "ziga.krajnc": "2025-11-01", "nina.zupan": "2025-09-15", "jan.potocnik": "2026-01-10",
    "eva.vidmar": "2025-06-01", "matic.kos": "2026-03-01", "sara.mlakar": "2026-02-01",
    "rok.golob": "2025-10-01", "zala.turk": "2026-06-01", "nejc.kralj": "2026-07-01",
    "tjasa.bozic": "2026-09-01", "aljaz.hribar": "2026-05-15", "petra.jerman": "2026-04-27",
    "blaz.bizjak": "2026-06-15", "katja.lesjak": "2026-08-01", "urban.petek": "2026-09-01",
    "neza.oblak": "2026-05-01", "filip.rozman": "2026-07-15",
}

BUDDY = {
    "zala.turk": "rok.golob", "nejc.kralj": "nina.zupan", "tjasa.bozic": "luka.novak",
    "aljaz.hribar": "ziga.krajnc", "petra.jerman": "jan.potocnik", "blaz.bizjak": "maja.horvat",
    "katja.lesjak": "eva.vidmar", "urban.petek": "sara.mlakar", "neza.oblak": "rok.golob",
    "filip.rozman": "ana.kovac", "lea.zorman": "rok.golob", "tim.vrhovnik": "eva.vidmar",
    "mia.kranjc": "rok.golob",
}

ALL_STEPS = ["values", "tiers", "contract", "email", "slack", "calendar", "buddy", "project",
             "first-hour", "first-task", "first-meeting"]

# New members, onboarding now. progress = date of their latest ticked step.
NEW_MEMBERS = [
    # stalled: his buddy Marko gets the nudge
    {"handle": "lea.zorman", "name": "Vid Kovač", "series": ["Shapers Tech"], "joined": "2026-10-12",
     "avatar": "vid-kovac", "steps": ["values", "tiers", "contract", "email", "slack", "buddy", "first-hour"],
     "progress": "2026-10-14"},
    {"handle": "tim.vrhovnik", "name": "Tim Vrhovnik", "series": ["Grants"], "joined": "2026-10-19",
     "avatar": "key", "steps": ["values", "tiers"], "progress": "2026-10-21"},
    # every step done: his buddy Marko can propose ending onboarding
    {"handle": "mia.kranjc", "name": "Nik Slobodjanac", "series": ["Shape Talks"], "joined": "2026-09-28",
     "avatar": "nik-slobodjanac", "steps": ALL_STEPS, "progress": "2026-10-22"},
]

# Display-name changes to the sandbox roster (emails stay, so calendar and attendance still match).
NAME_OVERRIDES = {"ana.kovac": "Jure Kovač", "rok.golob": "Marko Grad", "petra.jerman": "Sofia Manzou"}

# Statue portraits for the demo people (public/img); everyone else gets an object.
AVATAR_OVERRIDES = {"ana.kovac": "jure-kovac", "rok.golob": "marko-grad", "petra.jerman": "sofia-manzou"}

# Members who joined before the platform and are still on their setup steps.
SETUP = {"zala.turk": ["confirm-tier"], "nejc.kralj": []}

PROJECTS = [
    ("summer-school", "Summer School 2027", "Summer School", "luka.novak", "Programme, venue and mentors for next summer's school."),
    ("erasmus", "Erasmus+ KA2 application", "Grants", "ana.kovac", "Partnership application, due before the EU deadline."),
    ("mol-grant", "City of Ljubljana grant", "Grants", "jan.potocnik", "Youth programme call from the municipality."),
    ("talks-14", "Shape Talks #14", "Shape Talks", "eva.vidmar", "November evening of talks at Impact Hub."),
    ("speakers", "Speaker pipeline", "Shape Talks", "matic.kos", "A standing list of speakers for the next three events."),
    ("website", "Website rebuild", "Shapers Tech", "rok.golob", "New site with events, projects and a join form."),
    ("platform", "Coordination platform", "Shapers Tech", "maja.horvat", "This app: tasks, hours, attendance and tiers in one place."),
    ("podcast", "Podcast season 2", "Shapers Voice", "ziga.krajnc", "Eight episodes with alumni and partners."),
    ("newsletter", "Newsletter and Instagram", "Shapers Voice", "sara.mlakar", "Monthly newsletter and a weekly post rhythm."),
    ("community-night", "Community night", "Community", "ana.kovac", "December gathering for members, alumni and friends."),
]
COLORS = ["#f59e0b", "#10b981", "#14b8a6", "#8b5cf6", "#a855f7", "#3b82f6", "#6366f1", "#ec4899", "#f43f5e", "#f97316"]

# [project, title, assignee, status, priority, due, doneAt]
TASKS = [
    ("summer-school", "Shortlist three venues", "luka.novak", "doing", "high", "2026-10-30", None),
    ("summer-school", "Draft the mentor call", "tjasa.bozic", "todo", "normal", "2026-11-06", None),
    ("summer-school", "Collect last year's feedback", "aljaz.hribar", "done", "normal", "2026-10-16", "2026-10-15"),
    ("summer-school", "Budget v1", "blaz.bizjak", "todo", "normal", "2026-11-13", None),
    ("erasmus", "Partner letters of intent", "ana.kovac", "doing", "high", "2026-10-28", None),
    ("erasmus", "Write the impact section", "katja.lesjak", "todo", "high", "2026-11-02", None),
    ("erasmus", "Budget table in the EU template", "filip.rozman", "review", "normal", "2026-11-04", None),
    ("erasmus", "Read the programme guide", "tim.vrhovnik", "todo", "normal", "2026-10-31", None),
    ("mol-grant", "Check eligibility criteria", "jan.potocnik", "done", "normal", "2026-10-10", "2026-10-09"),
    ("mol-grant", "Activity plan for 2027", "eva.vidmar", "todo", "normal", "2026-11-10", None),
    ("talks-14", "Confirm three speakers", "petra.jerman", "doing", "high", "2026-10-29", None),
    ("talks-14", "Book Impact Hub event room", "eva.vidmar", "done", "normal", "2026-10-20", "2026-10-19"),
    ("talks-14", "Event page and sign-up form", "petra.jerman", "todo", "normal", "2026-11-03", None),
    ("talks-14", "Speaker brief template", "petra.jerman", "done", "low", "2026-10-17", "2026-10-16"),
    ("speakers", "List 20 possible speakers", "matic.kos", "todo", "normal", "2026-11-07", None),
    ("speakers", "Outreach email draft", "jan.potocnik", "idea", "low", None, None),
    ("website", "Wireframes for the events page", "rok.golob", "review", "normal", "2026-10-30", None),
    ("website", "Collect project photos", "zala.turk", "todo", "normal", "2026-11-05", None),
    ("website", "Set up hosting", "nejc.kralj", "done", "normal", "2026-10-14", "2026-10-13"),
    ("website", "Write the About page", "lea.zorman", "todo", "normal", "2026-11-04", None),
    ("platform", "Import the roster", "maja.horvat", "done", "high", "2026-10-24", "2026-10-24"),
    ("platform", "Calendar connection", "nina.zupan", "doing", "high", "2026-10-25", None),
    ("platform", "Onboarding checklist copy", "urban.petek", "todo", "normal", "2026-10-31", None),
    ("podcast", "Record episode 1", "ziga.krajnc", "doing", "high", "2026-10-29", None),
    ("podcast", "Guest list for episodes 2–8", "neza.oblak", "todo", "normal", "2026-11-05", None),
    ("podcast", "Cover art", "sara.mlakar", "done", "low", "2026-10-12", "2026-10-11"),
    ("newsletter", "October newsletter", "sara.mlakar", "doing", "normal", "2026-10-31", None),
    ("newsletter", "Post: Shape Talks #14 teaser", "neza.oblak", "todo", "normal", "2026-10-27", None),
    ("community-night", "Pick a date", "ana.kovac", "done", "normal", "2026-10-15", "2026-10-14"),
    ("community-night", "Invite alumni", "luka.novak", "todo", "normal", "2026-11-14", None),
    ("community-night", "Catering quotes", None, "idea", "low", "2026-11-20", None),
    ("summer-school", "Partner with a hostel for housing", None, "idea", "normal", None, None),
    ("newsletter", "Monthly alumni spotlight", None, "idea", "low", None, None),
    ("talks-14", "Ask a sponsor for drinks", "eva.vidmar", "review", "low", "2026-10-26", None),
]

# Lea's hours (not in the sandbox) and Urban's pending back-fill.
EXTRA_HOURS = [("lea.zorman", "2026-10-12", 2.0), ("lea.zorman", "2026-10-19", 1.5)]
BACKFILLS = [("urban.petek", "2026-10-20", 2.0, "Forgot to clock in at the hub on Tuesday.")]


# ---------------------------------------------------------------- helpers

def sid(*parts):
    return str(uuid.uuid5(ID_NS, "/".join(parts)))


def mid(handle):
    return sid("member", f"{handle}@{DOMAIN}")


def q(v):
    if v is None:
        return "null"
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, (int, float)):
        return str(v)
    return "'" + str(v).replace("'", "''") + "'"


def d(s):
    return dt.date.fromisoformat(s)


def read_xlsx(path):
    """First sheet as a list of dicts keyed by the header row."""
    z = zipfile.ZipFile(path)
    shared = []
    if "xl/sharedStrings.xml" in z.namelist():
        for si in ET.fromstring(z.read("xl/sharedStrings.xml")).findall("m:si", NS):
            shared.append("".join(t.text or "" for t in si.iter(f"{{{NS['m']}}}t")))
    rows = []
    for r in ET.fromstring(z.read("xl/worksheets/sheet1.xml")).iter(f"{{{NS['m']}}}row"):
        row = {}
        for c in r.findall("m:c", NS):
            col = re.match(r"[A-Z]+", c.get("r")).group()
            v, t = c.find("m:v", NS), c.get("t")
            if t == "inlineStr":
                val = "".join(x.text or "" for x in c.iter(f"{{{NS['m']}}}t"))
            elif v is None:
                val = None
            elif t == "s":
                val = shared[int(v.text)]
            else:
                val = v.text
            row[col] = val
        rows.append(row)
    cols = sorted({k for r in rows for k in r}, key=lambda s: (len(s), s))
    header = [rows[0].get(c) for c in cols]
    return [{h: r.get(c) for h, c in zip(header, cols)} for r in rows[1:]]


def excel_date(v):
    return dt.date(1899, 12, 30) + dt.timedelta(days=int(float(v)))


def read_ics(path):
    text = path.read_text(encoding="utf-8").replace("\r\n", "\n")
    text = re.sub(r"\n[ \t]", "", text)  # unfold continuation lines
    events = []
    for block in re.findall(r"BEGIN:VEVENT\n(.*?)\nEND:VEVENT", text, re.S):
        ev = {}
        for line in block.split("\n"):
            key, _, val = line.partition(":")
            ev[key.split(";")[0]] = val.replace("\\n", "\n").replace("\\,", ",")
        events.append(ev)
    return events


def ics_time(v):
    return dt.datetime.strptime(v, "%Y%m%dT%H%M%SZ").replace(tzinfo=dt.timezone.utc)


def local_date(ts):
    # Europe/Ljubljana is UTC+2 until 2026-10-25 01:00 UTC, UTC+1 after; meetings are evenings.
    offset = 2 if ts < dt.datetime(2026, 10, 25, 1, tzinfo=dt.timezone.utc) else 1
    return (ts + dt.timedelta(hours=offset)).date()


def values(rows):
    return ",\n".join("  (" + ", ".join(q(v) for v in r) + ")" for r in rows)


# ---------------------------------------------------------------- build

def main():
    out = ["-- Generated by scripts/build_seed.py. Do not edit by hand.", "begin;", ""]
    out.append("-- Sandbox hours start the week of 2026-09-14; check-in open any time for the live demo")
    out.append("update public.app_settings set tracking_since = '2026-09-14', check_in_any_time = true;")
    out.append("")

    # ------------------------------------------------------------ members
    roster = read_xlsx(SANDBOX / "roster.xlsx")
    members = []
    for i, r in enumerate(roster):
        handle = r["email"].split("@")[0]
        since = TIER_SINCE.get(handle, "2026-01-01")
        members.append({
            "id": mid(handle), "handle": handle, "name": NAME_OVERRIDES.get(handle, r["name"]), "email": r["email"],
            "tier": TIERS[r["tier"]], "admin": r["admin"] == "yes",
            "series": [s.strip() for s in r["series"].split(";") if s.strip() != "Community"],
            "joined": since, "since": since, "avatar": AVATAR_OVERRIDES.get(handle, AVATARS[i % len(AVATARS)]),
            "onboarding": False, "setup": handle in SETUP,
        })
    for n in NEW_MEMBERS:
        members.append({
            "id": mid(n["handle"]), "handle": n["handle"], "name": n["name"], "email": f"{n['handle']}@{DOMAIN}",
            "tier": "go", "admin": False, "series": n["series"], "joined": n["joined"], "since": n["joined"],
            "avatar": n["avatar"], "onboarding": True, "setup": False,
        })
    by_handle = {m["handle"]: m for m in members}
    by_email = {m["email"]: m for m in members}

    out.append("-- Members: sandbox roster + three new members onboarding (demo)")
    out.append("insert into public.members (id, name, email, tier, is_admin, joined_on, tier_since, avatar, "
               "onboarding_active, needs_setup) values")
    out.append(values([(m["id"], m["name"], m["email"], m["tier"], m["admin"], m["joined"], m["since"],
                        m["avatar"], m["onboarding"], m["setup"]) for m in members]) + ";")
    for handle, buddy in BUDDY.items():
        out.append(f"update public.members set buddy_id = {q(mid(buddy))} where id = {q(mid(handle))};")
    out.append("")
    out.append("insert into public.series_members (series_id, member_id) values")
    out.append(values([(SERIES_IDS[s], m["id"]) for m in members for s in m["series"]]) + ";")
    out.append("")

    # ------------------------------------------------------------ onboarding and setup
    ob = []
    for n in NEW_MEMBERS:
        last = d(n["progress"])
        steps = n["steps"]
        for i, step in enumerate(steps):
            day = last - dt.timedelta(days=len(steps) - 1 - i) if len(steps) > 1 else last
            day = max(day, d(n["joined"]))
            ob.append((mid(n["handle"]), step, f"{day.isoformat()}T16:00:00+00:00"))
    out.append("-- Onboarding progress of the new members")
    out.append("insert into public.member_onboarding (member_id, step_key, completed_at) values")
    out.append(values(ob) + ";")
    setup_rows = [(mid(h), s) for h, steps in SETUP.items() for s in steps]
    if setup_rows:
        out.append("insert into public.member_setup (member_id, step_key) values")
        out.append(values(setup_rows) + ";")
    out.append("")

    # ------------------------------------------------------------ meetings
    meetings = {}
    rows = []
    for ev in read_ics(SANDBOX / "meetings.ics"):
        series = re.search(r"Series: (.+)", ev["DESCRIPTION"]).group(1).strip()
        start, end = ics_time(ev["DTSTART"]), ics_time(ev["DTEND"])
        m_id = sid("meeting", ev["UID"])
        meetings[(SERIES_IDS[series], local_date(start))] = (m_id, start)
        rows.append((m_id, ev["UID"], SERIES_IDS[series], ev["SUMMARY"], start.isoformat(), end.isoformat(),
                     ev.get("LOCATION"), ev["DESCRIPTION"]))
    out.append("-- Meetings (sandbox meetings.ics; the Calendar sync updates the same rows by iCal UID)")
    out.append("insert into public.meetings (id, ical_uid, series_id, title, starts_at, ends_at, location, description) values")
    out.append(values(rows) + ";")
    out.append("")

    # ------------------------------------------------------------ attendance
    att = []
    for r in read_xlsx(SANDBOX / "attendance-flat.xlsx"):
        key = (SERIES_IDS[r["series"]], excel_date(r["date"]))
        if key not in meetings:
            raise SystemExit(f"attendance row did not match a meeting: {key}")
        m_id, start = meetings[key]
        att.append((m_id, by_email[r["email"]]["id"], r["state"], "import", (start + dt.timedelta(minutes=5)).isoformat()))
    out.append("-- Attendance (sandbox, imported history)")
    out.append("insert into public.attendance (meeting_id, member_id, state, source, recorded_at) values")
    out.append(values(att) + ";")
    out.append("")

    # ------------------------------------------------------------ hours
    hours = [(by_email[r["email"]]["id"], excel_date(r["week_start"]).isoformat(), float(r["hours"]))
             for r in read_xlsx(SANDBOX / "hours.xlsx")]
    hours += [(mid(h), w, x) for h, w, x in EXTRA_HOURS]
    out.append("-- Hours (sandbox weekly totals)")
    out.append("insert into public.imported_week_hours (member_id, week_start, hours) values")
    out.append(values(hours) + ";")
    out.append("-- A back-filled entry waiting for an admin")
    for h, day, x, note in BACKFILLS:
        start = f"{day}T07:00:00+00:00"
        end = (dt.datetime.fromisoformat(start) + dt.timedelta(hours=x)).isoformat()
        out.append("insert into public.work_sessions (member_id, started_at, planned_end, ended_at, source, status, note, created_at) "
                   f"values ({q(mid(h))}, {q(start)}, {q(end)}, {q(end)}, 'manual', 'pending', {q(note)}, '2026-10-23T10:00:00+00:00');")
    out.append("")

    # ------------------------------------------------------------ projects and tasks
    proj = {}
    prow, pm = [], []
    for (key, name, series, lead, desc), color in zip(PROJECTS, COLORS):
        p_id = sid("project", key)
        proj[key] = (p_id, lead)
        prow.append((p_id, name, desc, SERIES_IDS[series], color, mid(lead), mid(lead), "2026-09-07T08:00:00+00:00"))
        pm.append((p_id, mid(lead)))
    out.append("-- Projects and tasks (demo)")
    out.append("insert into public.projects (id, name, description, series_id, color, lead_id, created_by, created_at) values")
    out.append(values(prow) + ";")
    out.append("insert into public.project_members (project_id, member_id) values")
    out.append(values(pm) + "\non conflict do nothing;")
    trow = []
    for i, (pkey, title, assignee, status, priority, due, done_at) in enumerate(TASKS):
        size = "L" if priority == "high" else "S" if priority == "low" else ("L" if i % 3 == 0 else "M")
        start = (d(due) - dt.timedelta(days=4 + (i % 4) * 3)).isoformat() if due else None
        p_id, lead = proj[pkey]
        trow.append((sid("task", pkey, title), p_id, title, mid(assignee) if assignee else None, status, priority,
                     size, start, due, mid(lead), "2026-10-05T09:00:00+00:00",
                     f"{done_at}T15:00:00+00:00" if done_at else None, i))
    out.append("insert into public.tasks (id, project_id, title, assignee_id, status, priority, size, starts_on, due_on, "
               "created_by, created_at, completed_at, sort_order) values")
    out.append(values(trow) + ";")
    out.append("")
    out.append("commit;")
    OUT.write_text("\n".join(out) + "\n", encoding="utf-8")
    print(f"wrote {OUT.relative_to(ROOT)}: {len(members)} members, {len(rows)} meetings, {len(att)} attendance rows, "
          f"{len(hours)} hour rows, {len(PROJECTS)} projects, {len(trow)} tasks")


if __name__ == "__main__":
    main()
