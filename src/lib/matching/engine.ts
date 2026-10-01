import type {
  Appointment,
  AppointmentType,
  Clinic,
  MatchWeights,
  Offer,
  Patient,
  Slot,
  WaitlistEntry,
} from "@/lib/domain/types";
import {
  BAND_LABEL,
  WEEKDAY_SHORT,
  bandOf,
  diffDays,
  durationLabel,
  minutesUntil,
  weekdayOf,
  type LocalNow,
} from "@/lib/domain/time";

/**
 * Transparent waitlist matching.
 *
 * Two stages:
 *   1. Eligibility gates. Hard facts that make an offer impossible or improper
 *      (treatment does not fit, no consent, notice too short). Excluded patients
 *      are returned with the reason so staff can see why they are missing.
 *   2. Weighted factors. Each factor yields a 0..1 value and a plain-language
 *      reason. score = sum(weight * value) / sum(weights) * 100.
 *
 * The engine never considers clinical urgency. A staff-set priority can count
 * toward the "other" factor only when the clinic enables it in settings.
 */

export type FactorKey = keyof MatchWeights;

export const FACTOR_LABEL: Record<FactorKey, string> = {
  availability: "Availability",
  time: "Time preference",
  service: "Service match",
  dentist: "Dentist preference",
  location: "Location",
  other: "Other factor",
};

export type FactorFit = "full" | "partial" | "none";

export interface FactorResult {
  key: FactorKey;
  label: string;
  weight: number;
  value: number; // 0..1
  points: number; // weight-normalised contribution, 0..100 overall
  fit: FactorFit;
  reason: string;
}

export interface MatchResult {
  entry: WaitlistEntry;
  patient: Patient;
  type: AppointmentType;
  score: number; // 0..100, rounded
  factors: FactorResult[];
  /** One-line summary of the strongest reasons, for list rows. */
  headline: string;
}

export type ExclusionCode =
  | "not_waiting"
  | "already_offered"
  | "too_long"
  | "provider_cannot_perform"
  | "not_available_yet"
  | "needs_more_notice"
  | "no_consent"
  | "already_booked_that_day"
  | "offer_cap_reached";

export interface Exclusion {
  entry: WaitlistEntry;
  patient: Patient;
  code: ExclusionCode;
  reason: string;
}

export interface MatchContext {
  clinic: Clinic;
  patients: Patient[];
  appointments: Appointment[];
  offers: Offer[];
  now: LocalNow;
  nowTs: number;
}

export interface MatchOutput {
  ranked: MatchResult[];
  excluded: Exclusion[];
}

function fitOf(value: number): FactorFit {
  if (value >= 0.95) return "full";
  if (value > 0.05) return "partial";
  return "none";
}

export function eligibility(
  slot: Slot,
  entry: WaitlistEntry,
  type: AppointmentType,
  ctx: MatchContext,
): { code: ExclusionCode; reason: string } | null {
  const { clinic } = ctx;
  if (entry.status === "booked" || entry.status === "paused") {
    return { code: "not_waiting", reason: entry.status === "paused" ? "Paused on the waitlist" : "Already booked" };
  }

  const liveOffer = ctx.offers.find(
    (o) => o.waitlistEntryId === entry.id && (o.status === "sent" || o.status === "contact_requested"),
  );
  if (liveOffer && liveOffer.slotId !== slot.id) {
    return { code: "already_offered", reason: "Has a live offer for another slot" };
  }

  if (type.durationMin > slot.durationMin) {
    return {
      code: "too_long",
      reason: `${type.name} needs ${durationLabel(type.durationMin)}, slot is ${durationLabel(slot.durationMin)}`,
    };
  }

  const provider = clinic.providers.find((p) => p.id === slot.providerId);
  if (provider && !type.roles.includes(provider.role)) {
    return { code: "provider_cannot_perform", reason: `${type.name} is not on ${provider.shortName}'s list` };
  }

  if (diffDays(slot.date, entry.availableFrom) < 0) {
    return { code: "not_available_yet", reason: `Available from ${entry.availableFrom}` };
  }

  const leadMin = minutesUntil(ctx.now, slot.date, slot.startMin);
  if (leadMin < entry.noticeHours * 60) {
    return { code: "needs_more_notice", reason: `Needs ${entry.noticeHours} h notice` };
  }

  const patient = ctx.patients.find((p) => p.id === entry.patientId);
  const channelsOn = clinic.settings.channels;
  const consented =
    patient &&
    ((patient.consent.whatsapp && channelsOn.whatsapp) ||
      (patient.consent.sms && channelsOn.sms) ||
      (patient.consent.email && channelsOn.email));
  if (!consented) {
    return { code: "no_consent", reason: "No consent on an enabled channel" };
  }

  const clash = ctx.appointments.some(
    (a) => a.patientId === entry.patientId && a.date === slot.date && a.status === "booked",
  );
  if (clash) {
    return { code: "already_booked_that_day", reason: "Already has an appointment that day" };
  }

  const weekAgo = ctx.nowTs - 7 * 86_400_000;
  const recentOffers = ctx.offers.filter(
    (o) => o.waitlistEntryId === entry.id && o.sentAt !== null && o.sentAt >= weekAgo && o.slotId !== slot.id,
  ).length;
  if (recentOffers >= clinic.settings.maxOffersPerPatientPerWeek) {
    return { code: "offer_cap_reached", reason: `Already offered ${recentOffers} slots this week` };
  }

  return null;
}

export function scoreEntry(slot: Slot, entry: WaitlistEntry, type: AppointmentType, ctx: MatchContext): FactorResult[] {
  const { clinic } = ctx;
  const w = clinic.settings.weights;
  const factors: Omit<FactorResult, "points" | "label" | "fit">[] = [];

  // Availability: weekday against the days the patient said they can come.
  const wd = weekdayOf(slot.date);
  if (entry.preferredDays.length === 0) {
    factors.push({ key: "availability", weight: w.availability, value: 1, reason: "Any day works" });
  } else if (entry.preferredDays.includes(wd)) {
    factors.push({ key: "availability", weight: w.availability, value: 1, reason: `${WEEKDAY_SHORT[wd]} is a preferred day` });
  } else {
    factors.push({
      key: "availability",
      weight: w.availability,
      value: 0.3,
      reason: `Prefers ${entry.preferredDays.map((d) => WEEKDAY_SHORT[d]).join(", ")}`,
    });
  }

  // Time of day.
  const band = bandOf(slot.startMin);
  if (entry.preferredTimes.length === 0) {
    factors.push({ key: "time", weight: w.time, value: 1, reason: "Any time works" });
  } else if (entry.preferredTimes.includes(band)) {
    factors.push({ key: "time", weight: w.time, value: 1, reason: `${BAND_LABEL[band]} preferred` });
  } else {
    const order = ["morning", "afternoon", "evening"] as const;
    const adjacent = entry.preferredTimes.some((t) => Math.abs(order.indexOf(t) - order.indexOf(band)) === 1);
    factors.push({
      key: "time",
      weight: w.time,
      value: adjacent ? 0.4 : 0,
      reason: `Prefers ${entry.preferredTimes.map((t) => BAND_LABEL[t].toLowerCase()).join(" or ")}`,
    });
  }

  // Service: same treatment as the cancelled visit keeps the room set-up; otherwise
  // reward how much of the freed time the treatment actually uses.
  const utilisation = type.durationMin / slot.durationMin;
  const original = clinic.appointmentTypes.find((t) => t.id === slot.originalTypeId);
  if (original && original.id === type.id) {
    factors.push({ key: "service", weight: w.service, value: 1, reason: `Same treatment as the cancelled ${original.name.toLowerCase()}` });
  } else if (original && original.category === type.category) {
    factors.push({
      key: "service",
      weight: w.service,
      value: 0.7 + 0.3 * utilisation,
      reason: `Same category, uses ${type.durationMin} of ${slot.durationMin} min`,
    });
  } else {
    factors.push({
      key: "service",
      weight: w.service,
      value: 0.3 + 0.5 * utilisation,
      reason: `Uses ${type.durationMin} of ${slot.durationMin} min`,
    });
  }

  // Dentist.
  const provider = clinic.providers.find((p) => p.id === slot.providerId);
  if (!entry.preferredProviderId) {
    factors.push({ key: "dentist", weight: w.dentist, value: 0.7, reason: "No dentist preference" });
  } else if (entry.preferredProviderId === slot.providerId) {
    factors.push({ key: "dentist", weight: w.dentist, value: 1, reason: `Asked for ${provider?.shortName ?? "this dentist"}` });
  } else {
    const wanted = clinic.providers.find((p) => p.id === entry.preferredProviderId);
    factors.push({ key: "dentist", weight: w.dentist, value: 0, reason: `Asked for ${wanted?.shortName ?? "another dentist"}` });
  }

  // Location.
  const loc = clinic.locations.find((l) => l.id === slot.locationId);
  if (!entry.preferredLocationId) {
    factors.push({ key: "location", weight: w.location, value: 0.7, reason: "Either branch" });
  } else if (entry.preferredLocationId === slot.locationId) {
    factors.push({ key: "location", weight: w.location, value: 1, reason: `Prefers ${loc?.name ?? "this branch"}` });
  } else {
    const wanted = clinic.locations.find((l) => l.id === entry.preferredLocationId);
    factors.push({ key: "location", weight: w.location, value: 0, reason: `Prefers ${wanted?.name ?? "another branch"}` });
  }

  // Other (configurable).
  const other = clinic.settings.otherFactor;
  if (other === "waitlist_seniority") {
    const days = Math.max(0, Math.floor((ctx.nowTs - entry.addedAt) / 86_400_000));
    factors.push({
      key: "other",
      weight: w.other,
      value: Math.min(days / 30, 1),
      reason: `Waiting ${days} day${days === 1 ? "" : "s"}`,
    });
  } else if (other === "staff_priority" && clinic.settings.staffPriorityEnabled) {
    factors.push({
      key: "other",
      weight: w.other,
      value: entry.staffPriority ? 1 : 0,
      reason: entry.staffPriority ? `Staff priority: ${entry.staffPriority.note}` : "No staff priority",
    });
  } else {
    factors.push({ key: "other", weight: 0, value: 0, reason: "Not used" });
  }

  const total = factors.reduce((s, f) => s + f.weight, 0) || 1;
  return factors.map((f) => ({
    ...f,
    label: FACTOR_LABEL[f.key],
    points: (f.weight * f.value * 100) / total,
    fit: fitOf(f.value),
  }));
}

export function headlineFor(factors: FactorResult[]): string {
  return factors
    .filter((f) => f.fit === "full" && f.weight > 0)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 3)
    .map((f) => f.reason)
    .join(". ");
}

export function matchSlot(slot: Slot, waitlist: WaitlistEntry[], ctx: MatchContext): MatchOutput {
  const ranked: MatchResult[] = [];
  const excluded: Exclusion[] = [];

  for (const entry of waitlist) {
    const patient = ctx.patients.find((p) => p.id === entry.patientId);
    const type = ctx.clinic.appointmentTypes.find((t) => t.id === entry.typeId);
    if (!patient || !type) continue;

    const gate = eligibility(slot, entry, type, ctx);
    if (gate) {
      // Booked entries are noise in an exclusion list.
      if (gate.code !== "not_waiting" || entry.status === "paused") excluded.push({ entry, patient, ...gate });
      continue;
    }
    const factors = scoreEntry(slot, entry, type, ctx);
    const score = Math.round(factors.reduce((s, f) => s + f.points, 0));
    ranked.push({ entry, patient, type, score, factors, headline: headlineFor(factors) });
  }

  ranked.sort(
    (a, b) => b.score - a.score || a.entry.addedAt - b.entry.addedAt || a.patient.name.localeCompare(b.patient.name),
  );
  return { ranked, excluded };
}

/** Validate weights from settings: non-negative and not all zero. */
export function normaliseWeights(w: MatchWeights): MatchWeights {
  const clean = Object.fromEntries(
    Object.entries(w).map(([k, v]) => [k, Number.isFinite(v) && v > 0 ? Math.round(v) : 0]),
  ) as unknown as MatchWeights;
  const sum = Object.values(clean).reduce((s, v) => s + v, 0);
  return sum === 0 ? { ...DEFAULT_WEIGHTS } : clean;
}

export const DEFAULT_WEIGHTS: MatchWeights = {
  availability: 30,
  time: 25,
  service: 20,
  dentist: 10,
  location: 10,
  other: 5,
};
