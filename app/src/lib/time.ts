// Dates and times in the app's words. Times are data (the mono face, rule mono-is-data), so they stay short.
// With the mock, "now" runs on from the seed's moment, so the demo reads the same on any day.
import { NOW } from "../mock/seed";

const loaded = Date.now();
const usingMock = (import.meta.env?.VITE_FUME_API ?? "mock") === "mock";
export const now = () => (usingMock ? NOW + Date.now() - loaded : Date.now());

const DAY = 86_400_000;
const tz = "Europe/Oslo";
const timeFmt = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: tz });
// Round 12 (DLOAD-21): en-GB writes September "Sept"; the app writes "Sep" everywhere, as the charts do.
const sep = (f: Intl.DateTimeFormat) => ({ format: (t: number) => f.format(t).replace("Sept", "Sep") });
const dayFmt = sep(new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: tz }));
const weekdayFmt = sep(
  new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: tz }),
);
const dayKey = (t: number) => new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(t);
/** Round 13 (#37): today in Oslo on the demo's clock, as a DateField writes it ("2026-10-14"). */
export const todayKey = () => dayKey(now());

/** 14:26 today, "Yesterday", "12 Oct" before that. */
export function when(iso: string): string {
  const t = Date.parse(iso);
  const n = now();
  if (dayKey(t) === dayKey(n)) return timeFmt.format(t);
  if (dayKey(t) === dayKey(n - DAY)) return "Yesterday";
  return dayFmt.format(t);
}

/** "Today", "Yesterday" or "Earlier", for grouping lists (notifications). */
export function dayGroup(iso: string): "Today" | "Yesterday" | "Earlier" {
  const t = Date.parse(iso);
  const n = now();
  if (dayKey(t) === dayKey(n)) return "Today";
  if (dayKey(t) === dayKey(n - DAY)) return "Yesterday";
  return "Earlier";
}

/** A due date in words: "today", "tomorrow", "Fri 17 Oct". */
export function due(iso: string): string {
  const t = Date.parse(iso);
  const n = now();
  if (dayKey(t) === dayKey(n)) return "today";
  if (dayKey(t) === dayKey(n + DAY)) return "tomorrow";
  return weekdayFmt.format(t);
}

export const date = (iso: string) => dayFmt.format(Date.parse(iso));
export const time = (iso: string) => timeFmt.format(Date.parse(iso));

/** 38.4 MB */
export function bytes(n: number): string {
  if (n < 1_000) return `${n} B`;
  if (n < 1_000_000) return `${Math.round(n / 1_000)} KB`;
  return `${(n / 1_000_000).toFixed(1)} MB`;
}
