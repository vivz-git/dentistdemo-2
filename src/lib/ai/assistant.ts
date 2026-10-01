import type { AppointmentType, Clinic, Patient, Slot, WaitlistEntry } from "@/lib/domain/types";
import { BAND_LABEL, WEEKDAY_SHORT, clock, relativeDay } from "@/lib/domain/time";

/**
 * Assistive text helpers. In the demo these are deterministic templates so the
 * app runs without any model credentials. A production LLM implementation must
 * keep the same contract:
 *
 *   MAY   draft offer messages, summarise stated preferences, categorise requests.
 *   MUST NOT diagnose, give treatment advice, rank by clinical urgency, or state
 *            any date, time, dentist or price that is not in the input it was given.
 *
 * Every draft passes `guardDraft` before staff see it, and staff approve every send.
 */

export interface DraftInput {
  clinic: Clinic;
  slot: Slot;
  patient: Patient;
  type: AppointmentType;
  today: string;
  template: string;
}

export const TEMPLATE_TOKENS = ["{firstName}", "{clinic}", "{day}", "{time}", "{dentist}", "{branch}", "{treatment}"] as const;

export function draftOfferMessage({ clinic, slot, patient, type, today, template }: DraftInput): string {
  const provider = clinic.providers.find((p) => p.id === slot.providerId);
  const branch = clinic.locations.find((l) => l.id === slot.locationId);
  const values: Record<string, string> = {
    "{firstName}": patient.firstName,
    "{clinic}": clinic.name,
    "{day}": relativeDay(slot.date, today),
    "{time}": clock(slot.startMin),
    "{dentist}": provider?.name ?? "your dentist",
    "{branch}": branch?.name ?? "",
    "{treatment}": type.name.toLowerCase(),
  };
  return TEMPLATE_TOKENS.reduce((body, token) => body.split(token).join(values[token]), template);
}

/** Phrases a draft must never contain. Kept small and explicit on purpose. */
const CLINICAL_PATTERNS = [
  /\bdiagnos/i,
  /\burgent(ly)?\b/i,
  /\bemergency\b/i,
  /\binfection\b/i,
  /\byou (should|must|need to) (take|use|apply)\b/i,
  /\bpainkiller|antibiotic|ibuprofen|paracetamol\b/i,
  /\bworse\b/i,
];

export interface GuardResult {
  ok: boolean;
  problems: string[];
}

/**
 * Checks a draft before it can be approved. Rejects clinical language and any
 * clock time that is not the slot's own time (no invented availability).
 */
export function guardDraft(body: string, slot: Slot): GuardResult {
  const problems: string[] = [];
  for (const p of CLINICAL_PATTERNS) {
    if (p.test(body)) problems.push("Contains clinical or urgency language. Offers must stay administrative.");
  }
  const times = body.match(/\b\d{1,2}(:\d{2})?\s?(am|pm)\b/gi) ?? [];
  const allowed = clock(slot.startMin).toLowerCase();
  for (const t of times) {
    if (t.toLowerCase().replace(/\s/g, "") !== allowed.replace(/\s/g, "")) {
      problems.push(`Mentions ${t}, which is not this slot's time (${clock(slot.startMin)}).`);
    }
  }
  if (body.trim().length < 20) problems.push("Message is too short to be clear.");
  if (body.length > 640) problems.push("Message is longer than 640 characters.");
  return { ok: problems.length === 0, problems: [...new Set(problems)] };
}

/** Plain summary of what the patient told the clinic. No inference beyond stated facts. */
export function summarisePreferences(entry: WaitlistEntry, clinic: Clinic, type: AppointmentType): string {
  const parts: string[] = [type.name];
  if (entry.preferredDays.length) parts.push(entry.preferredDays.map((d) => WEEKDAY_SHORT[d]).join("/"));
  else parts.push("any day");
  if (entry.preferredTimes.length) parts.push(entry.preferredTimes.map((t) => BAND_LABEL[t].toLowerCase()).join(" or "));
  else parts.push("any time");
  const dr = clinic.providers.find((p) => p.id === entry.preferredProviderId);
  if (dr) parts.push(`with ${dr.shortName}`);
  const loc = clinic.locations.find((l) => l.id === entry.preferredLocationId);
  if (loc) parts.push(`at ${loc.name}`);
  parts.push(`${entry.noticeHours} h notice`);
  return parts.join(", ");
}

export type RequestCategory = "reschedule" | "cancel" | "earlier_slot" | "billing" | "other";

/** Categorise an inbound free-text request for routing. Never interprets symptoms. */
export function categoriseRequest(text: string): RequestCategory {
  const t = text.toLowerCase();
  if (/(earlier|sooner|any slot|waitlist|wait list)/.test(t)) return "earlier_slot";
  if (/(cancel|can't make|cannot make|won't make)/.test(t)) return "cancel";
  if (/(reschedule|move|change (the )?(time|date)|another day)/.test(t)) return "reschedule";
  if (/(bill|invoice|payment|insurance|cost|price)/.test(t)) return "billing";
  return "other";
}
