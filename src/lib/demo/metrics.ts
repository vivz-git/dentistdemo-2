import type { DemoState, ISODate, Slot, Timestamp } from "@/lib/domain/types";
import { MARKETS } from "@/lib/domain/markets";
import { addDays, localNow, minutesUntil, toTimestamp, weekStart } from "@/lib/domain/time";

/**
 * Recovery metrics. Definitions, so the numbers are explainable:
 *
 *   Open slot            Freed chair-time that has not started and is open, offering or held.
 *   Resolved slot        Filled, lost (start passed unfilled) or closed by staff.
 *   Fill rate            filled / (filled + lost). Staff-closed slots are excluded because
 *                        the clinic chose not to fill them.
 *   Recovered chair-time Booked minutes of appointments created from a slot.
 *   Est. production      Sum of the clinic-entered list price of those appointments.
 *                        An estimate, not collected revenue.
 *
 * Periods count events when they happen: cancellations by detection time, offers by
 * send time, fills and losses by resolution time. A slot filled today for tomorrow
 * counts as recovered today.
 */

export interface Period {
  from: ISODate; // inclusive, clinic-local
  to: ISODate; // inclusive
}

function bounds(p: Period, tz: string): [Timestamp, Timestamp] {
  return [toTimestamp(p.from, 0, tz), toTimestamp(addDays(p.to, 1), 0, tz)];
}

function within(ts: Timestamp | null | undefined, [a, b]: [Timestamp, Timestamp]) {
  return ts !== null && ts !== undefined && ts >= a && ts < b;
}

export function lastNDays(today: ISODate, n: number): Period {
  return { from: addDays(today, -(n - 1)), to: today };
}

export function thisWeek(today: ISODate): Period {
  const from = weekStart(today);
  return { from, to: addDays(from, 6) };
}

export const OPEN_STATUSES: Slot["status"][] = ["open", "offering", "held"];

export interface Summary {
  openToday: number;
  openWeek: number;
  openMinutesToday: number;
  waitlistSize: number;
  offersSent: number;
  offersAccepted: number;
  offersDeclined: number;
  offersExpired: number;
  liveOffers: number;
  filled: number;
  lost: number;
  closed: number;
  fillRate: number | null; // 0..1
  recoveredMinutes: number;
  recoveredProduction: number;
  lostMinutes: number;
  lostProduction: number;
  medianResponseMin: number | null;
}

function inPeriod(date: ISODate, p: Period) {
  return date >= p.from && date <= p.to;
}

export function summarise(s: DemoState, nowTs: Timestamp, period: Period): Summary {
  const tz = MARKETS[s.clinic.market].timeZone;
  const now = localNow(nowTs, tz);
  const week = thisWeek(now.date);
  const typeOf = (id?: string) => s.clinic.appointmentTypes.find((t) => t.id === id);

  const future = (sl: Slot) => OPEN_STATUSES.includes(sl.status) && minutesUntil(now, sl.date, sl.startMin) > 0;
  const openToday = s.slots.filter((sl) => sl.date === now.date && future(sl));
  const openWeek = s.slots.filter((sl) => inPeriod(sl.date, week) && future(sl));

  const range = bounds(period, tz);
  const resolved = s.slots.filter((sl) => within(sl.resolvedAt, range));
  const filled = resolved.filter((sl) => sl.status === "filled");
  const lost = resolved.filter((sl) => sl.status === "lost");
  const closed = resolved.filter((sl) => sl.status === "closed");

  let recoveredMinutes = 0;
  let recoveredProduction = 0;
  for (const sl of filled) {
    const appt = s.appointments.find((a) => a.id === sl.filledAppointmentId);
    if (!appt || appt.status === "cancelled" || appt.status === "no_show") continue;
    recoveredMinutes += appt.durationMin;
    recoveredProduction += typeOf(appt.typeId)?.estProduction ?? 0;
  }
  const lostMinutes = lost.reduce((m, sl) => m + sl.durationMin, 0);
  const lostProduction = lost.reduce((m, sl) => m + (typeOf(sl.originalTypeId)?.estProduction ?? 0), 0);

  const offers = s.offers.filter((o) => within(o.sentAt, range));
  const responded = offers
    .filter((o) => o.respondedAt !== null && (o.status === "accepted" || o.status === "declined"))
    .map((o) => (o.respondedAt! - o.sentAt!) / 60_000)
    .sort((a, b) => a - b);

  return {
    openToday: openToday.length,
    openWeek: openWeek.length,
    openMinutesToday: openToday.reduce((m, sl) => m + sl.durationMin, 0),
    waitlistSize: s.waitlist.filter((w) => w.status === "waiting" || w.status === "offered").length,
    offersSent: offers.length,
    offersAccepted: offers.filter((o) => o.status === "accepted").length,
    offersDeclined: offers.filter((o) => o.status === "declined").length,
    offersExpired: offers.filter((o) => o.status === "expired").length,
    liveOffers: s.offers.filter((o) => o.status === "sent" || o.status === "contact_requested").length,
    filled: filled.length,
    lost: lost.length,
    closed: closed.length,
    fillRate: filled.length + lost.length > 0 ? filled.length / (filled.length + lost.length) : null,
    recoveredMinutes,
    recoveredProduction,
    lostMinutes,
    lostProduction,
    medianResponseMin: responded.length ? responded[Math.floor(responded.length / 2)] : null,
  };
}

export interface DayPoint {
  date: ISODate;
  cancelled: number;
  filled: number;
  lost: number;
  closed: number;
  open: number;
  recoveredMinutes: number;
  recoveredProduction: number;
}

/** Per-day series for charts: cancellations by detection day, outcomes by resolution day. */
export function dailySeries(s: DemoState, period: Period): DayPoint[] {
  const tz = MARKETS[s.clinic.market].timeZone;
  const out: DayPoint[] = [];
  for (let d = period.from; d <= period.to; d = addDays(d, 1)) {
    const range = bounds({ from: d, to: d }, tz);
    const resolved = s.slots.filter((sl) => within(sl.resolvedAt, range));
    let recoveredMinutes = 0;
    let recoveredProduction = 0;
    for (const sl of resolved.filter((x) => x.status === "filled")) {
      const appt = s.appointments.find((a) => a.id === sl.filledAppointmentId);
      if (!appt) continue;
      recoveredMinutes += appt.durationMin;
      recoveredProduction += s.clinic.appointmentTypes.find((t) => t.id === appt.typeId)?.estProduction ?? 0;
    }
    out.push({
      date: d,
      cancelled: s.slots.filter((sl) => within(sl.detectedAt, range)).length,
      filled: resolved.filter((x) => x.status === "filled").length,
      lost: resolved.filter((x) => x.status === "lost").length,
      closed: resolved.filter((x) => x.status === "closed").length,
      open: s.slots.filter((sl) => sl.date === d && OPEN_STATUSES.includes(sl.status)).length,
      recoveredMinutes,
      recoveredProduction,
    });
  }
  return out;
}

/** Minutes between offer sent and patient reply, for a response-time histogram. */
export function responseTimes(s: DemoState, period: Period): { offerId: string; minutes: number; outcome: "accepted" | "declined" }[] {
  const range = bounds(period, MARKETS[s.clinic.market].timeZone);
  return s.offers
    .filter((o) => within(o.sentAt, range) && o.respondedAt && (o.status === "accepted" || o.status === "declined"))
    .map((o) => ({ offerId: o.id, minutes: Math.round((o.respondedAt! - o.sentAt!) / 60_000), outcome: o.status as "accepted" | "declined" }));
}

/**
 * Hypothetical before/after illustration. Fixed DEMO DATA from the product brief,
 * not a customer result and not derived from the synthetic book.
 */
export const BEFORE_AFTER_DEMO = {
  cancelled: 12,
  without: { recovered: 4, lost: 8 },
  with: { recovered: 9, lost: 3 },
} as const;
