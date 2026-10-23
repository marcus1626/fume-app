// Days in the content calendar. A day is its Oslo date as "YYYY-MM-DD" (the brand's and Fume's time zone), so a
// post at 23:30 in Oslo sits on the day the brand sees. Arithmetic runs on noon UTC of that date, which never
// crosses a day whatever the offset.

export type Day = string;

const TZ = "Europe/Oslo";
const DAY_MS = 86_400_000;
const keyFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ });
const partsFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: TZ,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

const noon = (d: Day) => {
  const [y, m, n] = d.split("-").map(Number) as [number, number, number];
  return Date.UTC(y, m - 1, n, 12);
};
const fromNoon = (t: number): Day => new Date(t).toISOString().slice(0, 10);

/** The Oslo day of an instant. */
export const dayOf = (t: number | string): Day => keyFmt.format(typeof t === "string" ? Date.parse(t) : t);
export const isDay = (s: string | null): s is Day =>
  Boolean(s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(noon(s)));
export const addDays = (d: Day, n: number): Day => fromNoon(noon(d) + n * DAY_MS);
/** Monday 0 … Sunday 6. */
export const weekday = (d: Day) => (new Date(noon(d)).getUTCDay() + 6) % 7;
export const startOfWeek = (d: Day): Day => addDays(d, -weekday(d));
export const startOfMonth = (d: Day): Day => `${d.slice(0, 8)}01`;
export function addMonths(d: Day, n: number): Day {
  const t = new Date(noon(startOfMonth(d)));
  return fromNoon(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + n, 1, 12));
}
export const endOfMonth = (d: Day): Day => addDays(addMonths(d, 1), -1);
export const between = (a: Day, b: Day) => Math.round((noon(b) - noon(a)) / DAY_MS);
export const sameMonth = (a: Day, b: Day) => a.slice(0, 7) === b.slice(0, 7);

/** Oslo's offset from UTC at an instant, in ms. */
function offset(t: number): number {
  const p = Object.fromEntries(partsFmt.formatToParts(t).map((x) => [x.type, x.value]));
  const asUtc = Date.UTC(+p.year!, +p.month! - 1, +p.day!, +p.hour!, +p.minute!, +p.second!);
  return asUtc - Math.floor(t / 1000) * 1000;
}

/** The instant of a wall time in Oslo: "2026-10-17" at "09:00". */
export function instant(d: Day, hhmm = "00:00"): string {
  const [y, m, n] = d.split("-").map(Number) as [number, number, number];
  const [hh, mm] = hhmm.split(":").map(Number) as [number, number];
  const wall = Date.UTC(y, m - 1, n, hh || 0, mm || 0);
  let t = wall - offset(wall);
  t = wall - offset(t);
  return new Date(t).toISOString();
}

/** "18:00", Oslo time. */
export const clock = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: TZ }).format(
    Date.parse(iso),
  );

const at = (d: Day) => new Date(noon(d));
export const monthTitle = (d: Day) =>
  new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(at(d));
export const dayTitle = (d: Day) =>
  new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(at(d));
export const dayShort = (d: Day) =>
  new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(at(d));
export const dateShort = (d: Day) =>
  new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(at(d));
export const weekdayShort = (d: Day) =>
  new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: "UTC" }).format(at(d));
export const dayNumber = (d: Day) => String(Number(d.slice(8, 10)));

/** "12 – 18 Oct 2026", or across months "28 Sep – 4 Oct 2026". */
export function weekTitle(start: Day): string {
  const end = addDays(start, 6);
  const year = end.slice(0, 4);
  return sameMonth(start, end)
    ? `${dayNumber(start)} – ${dateShort(end)} ${year}`
    : `${dateShort(start)} – ${dateShort(end)} ${year}`;
}
