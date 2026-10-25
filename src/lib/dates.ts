export const TZ = "Europe/Ljubljana";

const DAY = 86_400_000;

/** ISO date (YYYY-MM-DD) of a moment, as seen in Ljubljana. */
export function isoDate(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d);
}

export function parseDate(iso: string): Date {
  return new Date(iso + "T12:00:00Z");
}

export function addDays(iso: string, n: number): string {
  return new Date(parseDate(iso).getTime() + n * DAY).toISOString().slice(0, 10);
}

/** Monday of the week containing the given ISO date. */
export function weekStart(iso: string): string {
  const dow = (parseDate(iso).getUTCDay() + 6) % 7;
  return addDays(iso, -dow);
}

export function daysBetween(a: string, b: string): number {
  return Math.round((parseDate(b).getTime() - parseDate(a).getTime()) / DAY);
}

const f = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-GB", { timeZone: TZ, ...opts });

export const fmt = {
  weekday: (d: Date | string) => f({ weekday: "long" }).format(toDate(d)),
  dow: (d: Date | string) => f({ weekday: "short" }).format(toDate(d)).toUpperCase(),
  dayNum: (d: Date | string) => f({ day: "numeric" }).format(toDate(d)),
  monthDay: (d: Date | string) => f({ month: "long", day: "numeric" }).format(toDate(d)),
  short: (d: Date | string) => f({ day: "numeric", month: "short" }).format(toDate(d)),
  time: (d: Date | string) => f({ hour: "2-digit", minute: "2-digit", hour12: false }).format(toDate(d)),
  hour: (d: Date) => Number(f({ hour: "numeric", hour12: false }).format(d)),
};

function toDate(d: Date | string): Date {
  if (d instanceof Date) return d;
  return d.length === 10 ? parseDate(d) : new Date(d);
}

export function greeting(now: Date): string {
  const h = fmt.hour(now);
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export function hoursLabel(h: number): string {
  const r = Math.round(h * 10) / 10;
  return `${r % 1 === 0 ? r.toFixed(0) : r.toFixed(1)} h`;
}

export function elapsed(fromIso: string, now: Date): string {
  const mins = Math.max(0, Math.floor((now.getTime() - new Date(fromIso).getTime()) / 60000));
  return `${Math.floor(mins / 60)}:${String(mins % 60).padStart(2, "0")}`;
}
