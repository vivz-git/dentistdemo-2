import type { Appointment, Campaign, DemoState, Offer, Slot, Timestamp } from "@/lib/domain/types";
import { MARKETS } from "@/lib/domain/markets";
import { localNow, minutesUntil, type LocalNow } from "@/lib/domain/time";
import { matchSlot, type MatchOutput } from "@/lib/matching/engine";

export function lookup(s: DemoState) {
  return {
    patient: (id: string) => s.patients.find((p) => p.id === id),
    type: (id?: string) => s.clinic.appointmentTypes.find((t) => t.id === id),
    provider: (id: string) => s.clinic.providers.find((p) => p.id === id),
    chair: (id: string) => s.clinic.chairs.find((c) => c.id === id),
    location: (id: string) => s.clinic.locations.find((l) => l.id === id),
    appointment: (id?: string) => s.appointments.find((a) => a.id === id),
    entry: (id: string) => s.waitlist.find((w) => w.id === id),
  };
}

export function tzOf(s: DemoState) {
  return MARKETS[s.clinic.market].timeZone;
}

export function matchesFor(s: DemoState, slot: Slot, nowTs: Timestamp): MatchOutput {
  return matchSlot(slot, s.waitlist, {
    clinic: s.clinic,
    patients: s.patients,
    appointments: s.appointments,
    offers: s.offers,
    now: localNow(nowTs, tzOf(s)),
    nowTs,
  });
}

export function campaignFor(s: DemoState, slotId: string): Campaign | undefined {
  return [...s.campaigns].filter((c) => c.slotId === slotId).sort((a, b) => b.createdAt - a.createdAt)[0];
}

export function offersFor(s: DemoState, campaignId: string): Offer[] {
  return s.offers.filter((o) => o.campaignId === campaignId).sort((a, b) => a.rank - b.rank);
}

/** Slots that need a person: upcoming and open, offering or held. Soonest first. */
export function actionQueue(s: DemoState, now: LocalNow): Slot[] {
  return s.slots
    .filter((sl) => (sl.status === "open" || sl.status === "offering" || sl.status === "held") && minutesUntil(now, sl.date, sl.startMin) > 0)
    .sort((a, b) => (a.date === b.date ? a.startMin - b.startMin : a.date < b.date ? -1 : 1));
}

/** The slot to put in front of someone opening the app: the newest untouched cancellation. */
export function defaultFocus(s: DemoState, now: LocalNow): Slot | undefined {
  const queue = actionQueue(s, now);
  return [...queue].filter((sl) => sl.status === "open").sort((a, b) => b.detectedAt - a.detectedAt)[0] ?? queue[0];
}

export type StageState = "done" | "current" | "pending" | "stopped";
export interface Stage {
  key: "cancelled" | "detected" | "matched" | "offered" | "accepted" | "booked" | "counted";
  label: string;
  state: StageState;
  at?: Timestamp;
  detail?: string;
}

/** The recovery loop for one slot, in the order the brief defines. */
export function loopStages(s: DemoState, slot: Slot, matchCount: number): Stage[] {
  const L = lookup(s);
  const source = L.appointment(slot.sourceAppointmentId);
  const campaign = campaignFor(s, slot.id);
  const offers = campaign ? offersFor(s, campaign.id) : [];
  const sent = offers.filter((o) => o.sentAt !== null);
  const accepted = offers.find((o) => o.status === "accepted");
  const filledAppt = L.appointment(slot.filledAppointmentId);
  const stopped = slot.status === "lost" || slot.status === "closed";

  const stages: Stage[] = [
    {
      key: "cancelled",
      label: slot.origin === "no_show" ? "No-show" : slot.origin === "reschedule" ? "Moved" : "Cancelled",
      state: "done",
      at: source?.cancelledAt ?? slot.detectedAt,
      detail: source ? L.patient(source.patientId)?.name : undefined,
    },
    { key: "detected", label: "Slot detected", state: "done", at: slot.detectedAt, detail: `${slot.durationMin} min` },
    {
      key: "matched",
      label: "Matched",
      state: "done",
      detail: sent.length ? `${offers.length} approved` : `${matchCount} eligible`,
    },
    {
      key: "offered",
      label: "Offer sent",
      state: sent.length ? "done" : "pending",
      at: sent[0]?.sentAt ?? undefined,
      detail: sent.length ? `${sent.length} patient${sent.length === 1 ? "" : "s"}` : undefined,
    },
    {
      key: "accepted",
      label: "Accepted",
      state: accepted ? "done" : "pending",
      at: accepted?.respondedAt ?? undefined,
      detail: accepted ? L.patient(accepted.patientId)?.name : undefined,
    },
    {
      key: "booked",
      label: "Booked",
      state: slot.status === "filled" ? "done" : "pending",
      at: slot.status === "filled" ? slot.resolvedAt : undefined,
      detail: filledAppt ? L.type(filledAppt.typeId)?.name : undefined,
    },
    {
      key: "counted",
      label: "Recovered",
      state: slot.status === "filled" ? "done" : "pending",
      at: slot.status === "filled" ? slot.resolvedAt : undefined,
      detail: filledAppt ? `${filledAppt.durationMin} min` : undefined,
    },
  ];

  // The first pending stage is where the work is.
  const firstPending = stages.findIndex((st) => st.state === "pending");
  if (firstPending >= 0) stages[firstPending].state = stopped ? "stopped" : "current";
  if (stopped) for (let i = firstPending + 1; i < stages.length && firstPending >= 0; i++) stages[i].state = "pending";
  return stages;
}

export function appointmentsOn(s: DemoState, date: string): Appointment[] {
  return s.appointments.filter((a) => a.date === date && (a.status === "booked" || a.status === "completed"));
}
