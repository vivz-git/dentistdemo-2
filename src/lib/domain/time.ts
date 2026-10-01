import type { ISODate, TimeBand, Timestamp, Weekday } from "./types";

/** Clinic-local calendar position for an instant. */
export interface LocalNow {
  date: ISODate;
  minutes: number;
  weekday: Weekday;
}

const partsCache = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string) {
  let f = partsCache.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
    partsCache.set(timeZone, f);
  }
  return f;
}

export function localNow(ts: Timestamp, timeZone: string): LocalNow {
  const parts = Object.fromEntries(formatter(timeZone).formatToParts(new Date(ts)).map((p) => [p.type, p.value]));
  const date = `${parts.year}-${parts.month}-${parts.day}`;
  return { date, minutes: Number(parts.hour) * 60 + Number(parts.minute), weekday: weekdayOf(date) };
}

/** Epoch ms for a clinic-local calendar position. Two passes settle DST edges. */
export function toTimestamp(date: ISODate, minutes: number, timeZone: string): Timestamp {
  const [y, m, d] = date.split("-").map(Number);
  const target = Date.UTC(y, m - 1, d, 0, minutes);
  let guess = target;
  for (let i = 0; i < 2; i++) {
    const seen = localNow(guess, timeZone);
    const [sy, sm, sd] = seen.date.split("-").map(Number);
    const seenUtc = Date.UTC(sy, sm - 1, sd, 0, seen.minutes);
    guess += target - seenUtc;
  }
  return guess;
}

/** Day arithmetic on calendar dates, independent of any time zone. */
export function addDays(date: ISODate, days: number): ISODate {
  const [y, m, d] = date.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return t.toISOString().slice(0, 10);
}

export function weekdayOf(date: ISODate): Weekday {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay() as Weekday;
}

export function diffDays(a: ISODate, b: ISODate): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  return Math.round((Date.UTC(ay, am - 1, ad) - Date.UTC(by, bm - 1, bd)) / 86_400_000);
}

/** Monday of the week containing `date`. */
export function weekStart(date: ISODate): ISODate {
  const wd = weekdayOf(date);
  return addDays(date, wd === 0 ? -6 : 1 - wd);
}

/**
 * Minutes from `now` until a clinic-local slot starts. Negative when it has started.
 * Computed on calendar values so it is immune to the viewer's time zone.
 */
export function minutesUntil(now: LocalNow, date: ISODate, startMin: number): number {
  return diffDays(date, now.date) * 1440 + (startMin - now.minutes);
}

export function bandOf(startMin: number): TimeBand {
  if (startMin < 12 * 60) return "morning";
  if (startMin < 16 * 60) return "afternoon";
  return "evening";
}

export const BAND_LABEL: Record<TimeBand, string> = {
  morning: "Morning",
  afternoon: "Afternoon",
  evening: "Evening",
};

export const BAND_RANGE: Record<TimeBand, string> = {
  morning: "9 am to 12 pm",
  afternoon: "12 to 4 pm",
  evening: "4 to 8 pm",
};

export const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
export const WEEKDAY_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function clock(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  const suffix = h >= 12 ? "pm" : "am";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${h12} ${suffix}` : `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
}

/** 24h tabular clock for grids: 09:00 */
export function clock24(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

export function timeRange(startMin: number, durationMin: number): string {
  return `${clock(startMin)} to ${clock(startMin + durationMin)}`;
}

export function shortDate(date: ISODate): string {
  const [, m, d] = date.split("-").map(Number);
  return `${WEEKDAY_SHORT[weekdayOf(date)]} ${d} ${MONTH_SHORT[m - 1]}`;
}

/** "today", "tomorrow", "yesterday" or "Thu 3 Oct". */
export function relativeDay(date: ISODate, today: ISODate): string {
  const d = diffDays(date, today);
  if (d === 0) return "today";
  if (d === 1) return "tomorrow";
  if (d === -1) return "yesterday";
  return shortDate(date);
}

export function durationLabel(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

export function agoLabel(from: Timestamp, now: Timestamp): string {
  const s = Math.max(0, Math.round((now - from) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return `${d} d ago`;
}

export function untilLabel(to: Timestamp, now: Timestamp): string {
  const m = Math.round((to - now) / 60000);
  if (m <= 0) return "now";
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return `${h} h ${m % 60} min`;
}
