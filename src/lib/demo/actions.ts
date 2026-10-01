import type {
  ActivityEvent,
  Appointment,
  CampaignMode,
  CancellationSource,
  Channel,
  ClinicSettings,
  DemoState,
  ISODate,
  MessageLog,
  Offer,
  Patient,
  Slot,
  Timestamp,
  WaitlistEntry,
} from "@/lib/domain/types";
import { MARKETS } from "@/lib/domain/markets";
import { clock, localNow, minutesUntil, relativeDay, toTimestamp } from "@/lib/domain/time";
import { draftOfferMessage, guardDraft } from "@/lib/ai/assistant";
import { matchSlot, normaliseWeights } from "@/lib/matching/engine";
import { simulatedProviders } from "@/lib/providers/simulated";
import { channelName } from "./seed";

/**
 * Pure state transitions for the demo. Each takes the current state and returns
 * a new one (never mutating the input), plus an optional error or notice for the UI.
 * In production these become server mutations behind the same names.
 */

export interface ActionResult {
  state: DemoState;
  error?: string;
  notice?: string;
}

const MIN = 60_000;

function clone(s: DemoState): DemoState {
  return structuredClone(s);
}

function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function tz(s: DemoState) {
  return MARKETS[s.clinic.market].timeZone;
}

function log(s: DemoState, e: Omit<ActivityEvent, "id">) {
  s.activity.push({ id: uid("ev"), ...e });
}

function message(s: DemoState, m: Omit<MessageLog, "id" | "provider">) {
  const provider = m.direction === "system" ? "ChairFill" : simulatedProviders[m.channel].name;
  s.messages.push({ id: uid("msg"), provider, ...m });
}

function patientOf(s: DemoState, id: string): Patient {
  return s.patients.find((p) => p.id === id)!;
}

function chairLabel(s: DemoState, id: string) {
  return s.clinic.chairs.find((c) => c.id === id)?.label ?? "Chair";
}

function fail(s: DemoState, error: string): ActionResult {
  return { state: s, error };
}

export function pickChannel(patient: Patient, enabled: Record<Channel, boolean>): Channel | null {
  const order: Channel[] = [patient.preferredChannel, "whatsapp", "sms", "email"];
  return order.find((c) => patient.consent[c] && enabled[c]) ?? null;
}

export function inQuietHours(minutes: number, quiet: { start: number; end: number }): boolean {
  return quiet.start > quiet.end ? minutes >= quiet.start || minutes < quiet.end : minutes >= quiet.start && minutes < quiet.end;
}

function slotStartTs(s: DemoState, slot: Slot): Timestamp {
  return toTimestamp(slot.date, slot.startMin, tz(s));
}

// ------------------------------------------------------------------ appointments

export function cancelAppointment(
  prev: DemoState,
  nowTs: Timestamp,
  appointmentId: string,
  source: CancellationSource,
  note?: string,
): ActionResult {
  const s = clone(prev);
  const appt = s.appointments.find((a) => a.id === appointmentId);
  if (!appt) return fail(prev, "Appointment not found.");
  if (appt.status !== "booked") return fail(prev, "Only booked appointments can be cancelled.");

  appt.status = source === "no_show" ? "no_show" : "cancelled";
  appt.cancelledAt = nowTs;
  appt.cancellationSource = source;
  appt.cancellationNote = note;

  const slot: Slot = {
    id: uid("sl"),
    date: appt.date,
    startMin: appt.startMin,
    durationMin: appt.durationMin,
    chairId: appt.chairId,
    providerId: appt.providerId,
    locationId: appt.locationId,
    origin: source === "no_show" ? "no_show" : "cancellation",
    sourceAppointmentId: appt.id,
    originalTypeId: appt.typeId,
    status: "open",
    detectedAt: nowTs + 1,
  };
  s.slots.push(slot);
  const today = localNow(nowTs, tz(s)).date;
  const name = patientOf(s, appt.patientId).name;
  log(s, {
    at: nowTs,
    kind: "cancellation",
    slotId: slot.id,
    text: `${name} cancelled ${relativeDay(appt.date, today)} ${clock(appt.startMin)}, ${chairLabel(s, appt.chairId)}`,
  });
  log(s, { at: nowTs + 1, kind: "slot_detected", slotId: slot.id, text: `ChairFill opened ${appt.durationMin} min on ${chairLabel(s, appt.chairId)}` });
  return { state: s, notice: `Slot opened: ${relativeDay(appt.date, today)} ${clock(appt.startMin)}, ${chairLabel(s, appt.chairId)}` };
}

function overlaps(a: { date: ISODate; startMin: number; durationMin: number; chairId: string }, b: Appointment) {
  return a.chairId === b.chairId && a.date === b.date && a.startMin < b.startMin + b.durationMin && b.startMin < a.startMin + a.durationMin;
}

export function rescheduleAppointment(
  prev: DemoState,
  nowTs: Timestamp,
  appointmentId: string,
  to: { date: ISODate; startMin: number; chairId: string },
): ActionResult {
  const s = clone(prev);
  const appt = s.appointments.find((a) => a.id === appointmentId);
  if (!appt || appt.status !== "booked") return fail(prev, "Only booked appointments can be moved.");
  const target = { ...to, durationMin: appt.durationMin };
  const now = localNow(nowTs, tz(s));
  if (minutesUntil(now, to.date, to.startMin) < 0) return fail(prev, "That time has already passed.");
  const h = s.clinic.hours[new Date(`${to.date}T00:00:00Z`).getUTCDay()];
  if (!h || to.startMin < h.open || to.startMin + appt.durationMin > h.close) return fail(prev, "Outside opening hours.");
  if (h.breakStart !== undefined && to.startMin < h.breakEnd! && to.startMin + appt.durationMin > h.breakStart) {
    return fail(prev, "Overlaps the lunch break.");
  }
  const clash = s.appointments.find((b) => b.id !== appt.id && b.status === "booked" && overlaps(target, b));
  if (clash) return fail(prev, `Clashes with ${patientOf(s, clash.patientId).name} at ${clock(clash.startMin)}.`);
  const openThere = s.slots.find(
    (sl) => (sl.status === "open" || sl.status === "offering") && sl.chairId === to.chairId && sl.date === to.date && sl.startMin < to.startMin + appt.durationMin && to.startMin < sl.startMin + sl.durationMin,
  );
  if (openThere?.status === "offering") return fail(prev, "That time has a live fill campaign. Stop it first.");

  const chair = s.clinic.chairs.find((c) => c.id === to.chairId)!;
  const freed: Slot = {
    id: uid("sl"),
    date: appt.date,
    startMin: appt.startMin,
    durationMin: appt.durationMin,
    chairId: appt.chairId,
    providerId: appt.providerId,
    locationId: appt.locationId,
    origin: "reschedule",
    sourceAppointmentId: appt.id,
    originalTypeId: appt.typeId,
    status: minutesUntil(now, appt.date, appt.startMin) > 0 ? "open" : "lost",
    detectedAt: nowTs + 1,
  };
  s.slots.push(freed);
  if (openThere) {
    openThere.status = "closed";
    openThere.resolvedAt = nowTs;
  }
  const from = `${relativeDay(appt.date, now.date)} ${clock(appt.startMin)}`;
  Object.assign(appt, { date: to.date, startMin: to.startMin, chairId: chair.id, providerId: chair.providerId, locationId: chair.locationId });
  log(s, {
    at: nowTs,
    kind: "rescheduled",
    slotId: freed.id,
    text: `${patientOf(s, appt.patientId).name} moved from ${from} to ${relativeDay(to.date, now.date)} ${clock(to.startMin)}`,
  });
  log(s, { at: nowTs + 1, kind: "slot_detected", slotId: freed.id, text: `ChairFill opened ${freed.durationMin} min on ${chairLabel(s, freed.chairId)}` });
  return { state: s, notice: "Appointment moved. The old time is now an open slot." };
}

// ------------------------------------------------------------------ slot controls

export function holdSlot(prev: DemoState, nowTs: Timestamp, slotId: string, note: string, by: string): ActionResult {
  const s = clone(prev);
  const slot = s.slots.find((x) => x.id === slotId);
  if (!slot || slot.status !== "open") return fail(prev, "Only open slots can be reserved.");
  slot.status = "held";
  slot.heldNote = note.trim() || `Reserved by ${by}`;
  log(s, { at: nowTs, kind: "slot_held", slotId, text: `${by} reserved ${chairLabel(s, slot.chairId)}, ${clock(slot.startMin)}` });
  return { state: s, notice: "Slot reserved. It will not be offered until released." };
}

export function releaseSlot(prev: DemoState, nowTs: Timestamp, slotId: string, by: string): ActionResult {
  const s = clone(prev);
  const slot = s.slots.find((x) => x.id === slotId);
  if (!slot || (slot.status !== "held" && slot.status !== "closed")) return fail(prev, "Only reserved or closed slots can be released.");
  if (minutesUntil(localNow(nowTs, tz(s)), slot.date, slot.startMin) <= 0) return fail(prev, "This slot has already started.");
  slot.status = "open";
  slot.heldNote = undefined;
  slot.resolvedAt = undefined;
  log(s, { at: nowTs, kind: "slot_released", slotId, text: `${by} released ${chairLabel(s, slot.chairId)}, ${clock(slot.startMin)} for filling` });
  return { state: s, notice: "Slot released and open for filling." };
}

export function closeSlot(prev: DemoState, nowTs: Timestamp, slotId: string, by: string): ActionResult {
  const s = clone(prev);
  const slot = s.slots.find((x) => x.id === slotId);
  if (!slot || (slot.status !== "open" && slot.status !== "held")) return fail(prev, "Only open or reserved slots can be left empty.");
  slot.status = "closed";
  slot.resolvedAt = nowTs;
  log(s, { at: nowTs, kind: "slot_closed", slotId, text: `${by} chose to leave ${chairLabel(s, slot.chairId)}, ${clock(slot.startMin)} empty` });
  return { state: s };
}

// ------------------------------------------------------------------ campaigns

export interface LaunchInput {
  slotId: string;
  /** Waitlist entry ids in the order staff approved them. */
  entryIds: string[];
  mode: CampaignMode;
  offerWindowMin: number;
  template: string;
  approvedBy: string;
}

export function launchCampaign(prev: DemoState, nowTs: Timestamp, input: LaunchInput): ActionResult {
  const s = clone(prev);
  const slot = s.slots.find((x) => x.id === input.slotId);
  if (!slot) return fail(prev, "Slot not found.");
  if (slot.status !== "open") return fail(prev, "This slot is not open for a campaign.");
  if (input.entryIds.length === 0) return fail(prev, "Select at least one patient.");
  if (!input.approvedBy.trim()) return fail(prev, "Add the name of the staff member approving this campaign.");

  const now = localNow(nowTs, tz(s));
  const lead = minutesUntil(now, slot.date, slot.startMin);
  if (lead < s.clinic.settings.minNoticeMin) {
    return fail(prev, `Starts in ${Math.max(lead, 0)} min, below the clinic's ${s.clinic.settings.minNoticeMin} min minimum notice.`);
  }

  // Re-run eligibility at send time: preferences or other offers may have changed.
  const { ranked } = matchSlot(
    slot,
    s.waitlist.filter((w) => input.entryIds.includes(w.id)),
    { clinic: s.clinic, patients: s.patients, appointments: s.appointments, offers: s.offers, now, nowTs },
  );
  const byId = new Map(ranked.map((r) => [r.entry.id, r]));
  const approved = input.entryIds.map((id) => byId.get(id)).filter((r) => r !== undefined);
  if (approved.length === 0) return fail(prev, "None of the selected patients are still eligible.");

  const campaign = {
    id: uid("cp"),
    slotId: slot.id,
    mode: input.mode,
    offerWindowMin: input.offerWindowMin,
    approvedBy: input.approvedBy.trim(),
    createdAt: nowTs,
    status: "live" as const,
    offerIds: [] as string[],
  };

  for (const [i, r] of approved.entries()) {
    const channel = pickChannel(r.patient, s.clinic.settings.channels);
    if (!channel) continue;
    const body = draftOfferMessage({ clinic: s.clinic, slot, patient: r.patient, type: r.type, today: now.date, template: input.template });
    const guard = guardDraft(body, slot);
    if (!guard.ok) return fail(prev, guard.problems[0]);
    const offer: Offer = {
      id: uid("of"),
      campaignId: campaign.id,
      slotId: slot.id,
      waitlistEntryId: r.entry.id,
      patientId: r.patient.id,
      channel,
      body,
      score: r.score,
      rank: i + 1,
      status: "queued",
      sentAt: null,
      expiresAt: null,
      respondedAt: null,
    };
    s.offers.push(offer);
    campaign.offerIds.push(offer.id);
  }
  if (campaign.offerIds.length === 0) return fail(prev, "No selected patient can be reached on an enabled channel.");

  s.campaigns.push(campaign);
  slot.status = "offering";
  log(s, { at: nowTs, kind: "campaign_launched", slotId: slot.id, text: `${campaign.approvedBy} approved a fill campaign for ${campaign.offerIds.length} patient${campaign.offerIds.length === 1 ? "" : "s"}` });

  const toSend = input.mode === "simultaneous" ? campaign.offerIds : campaign.offerIds.slice(0, 1);
  for (const id of toSend) dispatch(s, nowTs, s.offers.find((o) => o.id === id)!, campaign.offerWindowMin);

  return {
    state: s,
    notice: `Simulated offer sent to ${toSend.length} patient${toSend.length === 1 ? "" : "s"}. No real messages leave the demo.`,
  };
}

function dispatch(s: DemoState, nowTs: Timestamp, offer: Offer, windowMin: number) {
  offer.status = "sent";
  offer.sentAt = nowTs;
  offer.expiresAt = nowTs + windowMin * MIN;
  const entry = s.waitlist.find((w) => w.id === offer.waitlistEntryId)!;
  entry.status = "offered";
  entry.lastContactAt = nowTs;
  message(s, { patientId: offer.patientId, offerId: offer.id, channel: offer.channel, direction: "outbound", body: offer.body, at: nowTs });
  log(s, { at: nowTs, kind: "offer_sent", slotId: offer.slotId, offerId: offer.id, text: `Offer sent to ${patientOf(s, offer.patientId).name} by ${channelName(offer.channel)} (simulated)` });
}

export function stopCampaign(prev: DemoState, nowTs: Timestamp, campaignId: string, by: string): ActionResult {
  const s = clone(prev);
  const c = s.campaigns.find((x) => x.id === campaignId);
  if (!c || c.status !== "live") return fail(prev, "Campaign is not live.");
  c.status = "stopped";
  for (const o of s.offers.filter((x) => x.campaignId === c.id)) {
    if (o.status === "sent" || o.status === "contact_requested" || o.status === "queued") {
      const wasSent = o.status !== "queued";
      o.status = "superseded";
      const entry = s.waitlist.find((w) => w.id === o.waitlistEntryId);
      if (entry && entry.status === "offered") entry.status = "waiting";
      if (wasSent) {
        message(s, { patientId: o.patientId, offerId: o.id, channel: o.channel, direction: "outbound", body: "This appointment is no longer available. You stay on our waitlist.", at: nowTs });
      }
    }
  }
  const slot = s.slots.find((x) => x.id === c.slotId)!;
  if (slot.status === "offering") slot.status = "open";
  log(s, { at: nowTs, kind: "slot_released", slotId: slot.id, text: `${by} stopped the campaign. Slot is open again.` });
  return { state: s };
}

/** Called after an offer closes without acceptance. Sends the next in cascade, or reopens the slot. */
function advanceCampaign(s: DemoState, nowTs: Timestamp, campaignId: string) {
  const c = s.campaigns.find((x) => x.id === campaignId)!;
  if (c.status !== "live") return;
  const mine = s.offers.filter((o) => o.campaignId === c.id);
  const live = mine.some((o) => o.status === "sent" || o.status === "contact_requested");
  if (live) return;
  const next = mine.find((o) => o.status === "queued");
  const slot = s.slots.find((x) => x.id === c.slotId)!;
  const lead = minutesUntil(localNow(nowTs, tz(s)), slot.date, slot.startMin);
  if (next && lead > 0) {
    dispatch(s, nowTs, next, c.offerWindowMin);
    return;
  }
  c.status = "exhausted";
  for (const o of mine.filter((x) => x.status === "queued")) o.status = "superseded";
  if (slot.status === "offering") {
    slot.status = lead > 0 ? "open" : "lost";
    if (slot.status === "lost") slot.resolvedAt = nowTs;
  }
  log(s, { at: nowTs, kind: "slot_released", slotId: slot.id, text: `No one accepted ${chairLabel(s, slot.chairId)}, ${clock(slot.startMin)}. The slot is open for another campaign.` });
}

// ------------------------------------------------------------------ patient replies (simulated)

export type ReplyIntent = "accept" | "decline" | "contact";

export function patientRespond(prev: DemoState, nowTs: Timestamp, offerId: string, intent: ReplyIntent): ActionResult {
  const s = clone(prev);
  const offer = s.offers.find((o) => o.id === offerId);
  if (!offer) return fail(prev, "Offer not found.");
  if (offer.status !== "sent" && offer.status !== "contact_requested") return fail(prev, "This offer is closed.");
  if (offer.expiresAt !== null && nowTs > offer.expiresAt) return fail(prev, "This offer has expired.");
  const patient = patientOf(s, offer.patientId);
  const slot = s.slots.find((x) => x.id === offer.slotId)!;
  const entry = s.waitlist.find((w) => w.id === offer.waitlistEntryId)!;
  const inbound = { accept: "Accept", decline: "Decline", contact: "Contact clinic" }[intent];
  message(s, { patientId: patient.id, offerId, channel: offer.channel, direction: "inbound", body: inbound, at: nowTs });

  if (intent === "contact") {
    offer.status = "contact_requested";
    message(s, { patientId: patient.id, offerId, channel: offer.channel, direction: "outbound", body: `Thanks ${patient.firstName}, the front desk will call you shortly. The slot is not reserved yet.`, at: nowTs + 1000 });
    log(s, { at: nowTs, kind: "contact_requested", slotId: slot.id, offerId, text: `${patient.name} asked the clinic to call` });
    return { state: s, notice: `${patient.name} asked for a call back.` };
  }

  if (intent === "decline") {
    offer.status = "declined";
    offer.respondedAt = nowTs;
    entry.status = "waiting";
    message(s, { patientId: patient.id, offerId, channel: offer.channel, direction: "outbound", body: `No problem, ${patient.firstName}. You stay on our waitlist and we will message you about the next opening.`, at: nowTs + 1000 });
    log(s, { at: nowTs, kind: "offer_declined", slotId: slot.id, offerId, text: `${patient.name} declined the offer` });
    advanceCampaign(s, nowTs, offer.campaignId);
    return { state: s, notice: `${patient.name} declined.` };
  }

  // Accept. The slot may already be gone: never claim a booking that did not happen.
  if (slot.status !== "offering") {
    offer.status = "superseded";
    offer.respondedAt = nowTs;
    entry.status = "waiting";
    message(s, { patientId: patient.id, offerId, channel: offer.channel, direction: "outbound", body: `Sorry ${patient.firstName}, this slot has just been taken. You stay on our waitlist.`, at: nowTs + 1000 });
    return { state: s, notice: "Slot was already taken. The patient was told, and nothing was booked." };
  }
  offer.status = "accepted";
  offer.respondedAt = nowTs;
  log(s, { at: nowTs, kind: "offer_accepted", slotId: slot.id, offerId, text: `${patient.name} accepted the offer` });

  if (!s.clinic.settings.autoBookOnAccept) {
    slot.status = "held";
    slot.heldNote = `Accepted by ${patient.name}. Awaiting staff confirmation.`;
    message(s, { patientId: patient.id, offerId, channel: offer.channel, direction: "outbound", body: `Thanks ${patient.firstName}. We are holding this time and will confirm shortly. It is not booked yet.`, at: nowTs + 1000 });
    supersedeOthers(s, nowTs, offer);
    return { state: s, notice: `${patient.name} accepted. Confirm the booking to complete it.` };
  }
  return book(s, nowTs, offer, "ChairFill (auto-book on accept)");
}

function supersedeOthers(s: DemoState, nowTs: Timestamp, winner: Offer) {
  for (const o of s.offers.filter((x) => x.campaignId === winner.campaignId && x.id !== winner.id)) {
    if (o.status === "sent" || o.status === "contact_requested") {
      message(s, { patientId: o.patientId, offerId: o.id, channel: o.channel, direction: "outbound", body: `Thanks for your patience, ${patientOf(s, o.patientId).firstName}. This slot has now been filled. You stay on our waitlist.`, at: nowTs + 1500 });
      const e = s.waitlist.find((w) => w.id === o.waitlistEntryId);
      if (e && e.status === "offered") e.status = "waiting";
    }
    if (o.status === "sent" || o.status === "contact_requested" || o.status === "queued") o.status = "superseded";
  }
}

function book(s: DemoState, nowTs: Timestamp, offer: Offer, by: string): ActionResult {
  const slot = s.slots.find((x) => x.id === offer.slotId)!;
  const entry = s.waitlist.find((w) => w.id === offer.waitlistEntryId)!;
  const result = bookIntoSlot(s, nowTs, slot, entry, by);
  if (result.error) return { state: s, error: result.error };
  const type = s.clinic.appointmentTypes.find((t) => t.id === entry.typeId)!;
  const provider = s.clinic.providers.find((p) => p.id === slot.providerId)!;
  const today = localNow(nowTs, tz(s)).date;
  message(s, {
    patientId: entry.patientId,
    offerId: offer.id,
    channel: offer.channel,
    direction: "outbound",
    body: `Booked: ${type.name}, ${relativeDay(slot.date, today)} at ${clock(slot.startMin)} with ${provider.name}. Reply here if you need to change it.`,
    at: nowTs + 2000,
  });
  supersedeOthers(s, nowTs, offer);
  const c = s.campaigns.find((x) => x.id === offer.campaignId);
  if (c) c.status = "filled";
  return { state: s, notice: `Booked ${patientOf(s, entry.patientId).name} into ${chairLabel(s, slot.chairId)}, ${clock(slot.startMin)}.` };
}

/** Creates the appointment. The only place a recovered booking comes into existence. */
function bookIntoSlot(s: DemoState, nowTs: Timestamp, slot: Slot, entry: WaitlistEntry, by: string): { error?: string; appointment?: Appointment } {
  const type = s.clinic.appointmentTypes.find((t) => t.id === entry.typeId)!;
  if (type.durationMin > slot.durationMin) return { error: "Treatment does not fit this slot." };
  const target = { date: slot.date, startMin: slot.startMin, durationMin: type.durationMin, chairId: slot.chairId };
  if (s.appointments.some((a) => a.status === "booked" && overlaps(target, a))) return { error: "The chair is no longer free at this time." };
  const appt: Appointment = {
    id: uid("ap"),
    patientId: entry.patientId,
    typeId: type.id,
    providerId: slot.providerId,
    chairId: slot.chairId,
    locationId: slot.locationId,
    date: slot.date,
    startMin: slot.startMin,
    durationMin: type.durationMin,
    status: "booked",
    createdAt: nowTs,
    fromSlotId: slot.id,
  };
  s.appointments.push(appt);
  slot.status = "filled";
  slot.resolvedAt = nowTs;
  slot.filledAppointmentId = appt.id;
  slot.heldNote = undefined;
  entry.status = "booked";
  log(s, { at: nowTs + 1, kind: "slot_filled", slotId: slot.id, text: `${chairLabel(s, slot.chairId)} filled with ${patientOf(s, entry.patientId).name}, ${type.name.toLowerCase()} (${by})` });
  return { appointment: appt };
}

export function confirmAcceptedOffer(prev: DemoState, nowTs: Timestamp, offerId: string, by: string): ActionResult {
  const s = clone(prev);
  const offer = s.offers.find((o) => o.id === offerId);
  if (!offer || offer.status !== "accepted") return fail(prev, "No accepted offer to confirm.");
  const slot = s.slots.find((x) => x.id === offer.slotId)!;
  if (slot.status !== "held") return fail(prev, "Slot is not awaiting confirmation.");
  return book(s, nowTs, offer, by);
}

/** Staff booked someone directly (for example on the phone). Still a recovered slot. */
export function bookManually(prev: DemoState, nowTs: Timestamp, slotId: string, entryId: string, by: string): ActionResult {
  const s = clone(prev);
  const slot = s.slots.find((x) => x.id === slotId);
  const entry = s.waitlist.find((w) => w.id === entryId);
  if (!slot || !entry) return fail(prev, "Slot or patient not found.");
  if (slot.status !== "open" && slot.status !== "held" && slot.status !== "offering") return fail(prev, "Slot is not available.");
  const live = s.campaigns.find((c) => c.slotId === slot.id && c.status === "live");
  const result = bookIntoSlot(s, nowTs, slot, entry, by);
  if (result.error) return fail(prev, result.error);
  if (live) {
    live.status = "filled";
    const fake = { campaignId: live.id, id: "__manual__" } as Offer;
    supersedeOthers(s, nowTs, fake);
    const own = s.offers.find((o) => o.campaignId === live.id && o.waitlistEntryId === entry.id);
    if (own) {
      own.status = "accepted";
      own.respondedAt = own.respondedAt ?? nowTs;
    }
  }
  log(s, { at: nowTs, kind: "manual_booking", slotId: slot.id, text: `${by} booked ${patientOf(s, entry.patientId).name} directly` });
  return { state: s, notice: `Booked ${patientOf(s, entry.patientId).name}.` };
}

// ------------------------------------------------------------------ clock

/** Expires offers, cascades campaigns, marks past slots lost and appointments completed. */
export function tick(prev: DemoState, nowTs: Timestamp): DemoState {
  const now = localNow(nowTs, tz(prev));
  let changed = false;
  const s = clone(prev);

  for (const o of s.offers) {
    if ((o.status === "sent" || o.status === "contact_requested") && o.expiresAt !== null && nowTs > o.expiresAt) {
      o.status = "expired";
      changed = true;
      const e = s.waitlist.find((w) => w.id === o.waitlistEntryId);
      if (e && e.status === "offered") e.status = "waiting";
      log(s, { at: o.expiresAt, kind: "offer_expired", slotId: o.slotId, offerId: o.id, text: `Offer to ${patientOf(s, o.patientId).name} expired with no reply` });
      advanceCampaign(s, nowTs, o.campaignId);
    }
  }
  for (const sl of s.slots) {
    if ((sl.status === "open" || sl.status === "offering") && minutesUntil(now, sl.date, sl.startMin) <= 0) {
      sl.status = "lost";
      sl.resolvedAt = slotStartTs(s, sl);
      changed = true;
      for (const c of s.campaigns.filter((c) => c.slotId === sl.id && c.status === "live")) c.status = "exhausted";
      log(s, { at: sl.resolvedAt, kind: "slot_lost", slotId: sl.id, text: `${sl.durationMin} min on ${chairLabel(s, sl.chairId)} went unused` });
    }
  }
  for (const a of s.appointments) {
    if (a.status === "booked" && minutesUntil(now, a.date, a.startMin + a.durationMin) <= 0) {
      a.status = "completed";
      changed = true;
    }
  }
  return changed ? s : prev;
}

// ------------------------------------------------------------------ settings and waitlist

export function updateSettings(prev: DemoState, patch: Partial<ClinicSettings>): ActionResult {
  const s = clone(prev);
  const next = { ...s.clinic.settings, ...patch };
  next.weights = normaliseWeights(next.weights);
  if (next.minNoticeMin < 0 || next.offerWindowMin < 5) return fail(prev, "Notice and offer window must be positive (window at least 5 min).");
  s.clinic.settings = next;
  return { state: s, notice: "Settings saved." };
}

export function updateClinic(prev: DemoState, patch: Partial<Pick<DemoState["clinic"], "hours" | "appointmentTypes" | "name">>): ActionResult {
  const s = clone(prev);
  Object.assign(s.clinic, patch);
  return { state: s, notice: "Clinic details saved." };
}

export function upsertWaitlistEntry(prev: DemoState, entry: WaitlistEntry): ActionResult {
  const s = clone(prev);
  const i = s.waitlist.findIndex((w) => w.id === entry.id);
  if (i >= 0) s.waitlist[i] = entry;
  else s.waitlist.push(entry);
  return { state: s, notice: i >= 0 ? "Waitlist entry updated." : "Added to the waitlist." };
}

export function newId(prefix: string) {
  return uid(prefix);
}
