import type {
  ActivityEvent,
  Appointment,
  AppointmentType,
  Campaign,
  CancellationSource,
  Channel,
  Clinic,
  DayHours,
  DemoState,
  ISODate,
  MessageLog,
  Offer,
  Patient,
  Slot,
  TimeBand,
  Timestamp,
  WaitlistEntry,
  Weekday,
} from "@/lib/domain/types";
import { MARKETS } from "@/lib/domain/markets";
import { addDays, clock, localNow, relativeDay, toTimestamp, weekdayOf } from "@/lib/domain/time";
import { DEFAULT_WEIGHTS, matchSlot } from "@/lib/matching/engine";
import { draftOfferMessage } from "@/lib/ai/assistant";

/**
 * Synthetic demo data. Every person, phone number and email here is invented.
 * The book is generated relative to "now" in the clinic's time zone so the
 * scenario is always live: a cancellation that just came in, an offer awaiting
 * a reply, and two weeks of recovery history for analytics.
 */

export const SEED_VERSION = 4;
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

export const DEFAULT_TEMPLATE =
  "Hi {firstName}, an earlier appointment has become available at {clinic} {day} at {time} with {dentist} ({branch}). Would you like us to reserve it?";

const WEEKDAY_HOURS: DayHours = { open: 9 * 60, close: 19 * 60, breakStart: 13 * 60, breakEnd: 14 * 60 };
const SUNDAY_HOURS: DayHours = { open: 10 * 60, close: 14 * 60 };

function buildClinic(): Clinic {
  return {
    id: "clinic-demo",
    name: "Tulsi Dental Studio",
    city: "Bengaluru",
    market: "IN",
    locations: [
      { id: "loc-ind", name: "Indiranagar", area: "100 Feet Road" },
      { id: "loc-hsr", name: "HSR Layout", area: "27th Main" },
    ],
    providers: [
      { id: "pr-rao", name: "Dr. Ananya Rao", shortName: "Dr. Rao", role: "general", roleLabel: "General dentist", locationIds: ["loc-ind"] },
      { id: "pr-shetty", name: "Dr. Vikram Shetty", shortName: "Dr. Shetty", role: "endodontist", roleLabel: "Endodontist", locationIds: ["loc-ind", "loc-hsr"] },
      { id: "pr-pillai", name: "Meera Pillai", shortName: "Meera (hygiene)", role: "hygienist", roleLabel: "Dental hygienist", locationIds: ["loc-ind"] },
      { id: "pr-qureshi", name: "Dr. Farah Qureshi", shortName: "Dr. Qureshi", role: "prosthodontist", roleLabel: "Prosthodontist", locationIds: ["loc-hsr"] },
    ],
    chairs: [
      { id: "ch-1", label: "Chair 1", locationId: "loc-ind", providerId: "pr-rao" },
      { id: "ch-2", label: "Chair 2", locationId: "loc-ind", providerId: "pr-shetty" },
      { id: "ch-3", label: "Hygiene bay", locationId: "loc-ind", providerId: "pr-pillai" },
      { id: "ch-4", label: "Chair 4", locationId: "loc-hsr", providerId: "pr-qureshi" },
    ],
    appointmentTypes: [
      { id: "t-checkup", name: "Check-up and consultation", category: "consult", durationMin: 30, estProduction: 800, roles: ["general", "endodontist", "prosthodontist"] },
      { id: "t-scaling", name: "Scaling and polishing", category: "preventive", durationMin: 45, estProduction: 1800, roles: ["hygienist", "general"] },
      { id: "t-filling", name: "Composite filling", category: "restorative", durationMin: 45, estProduction: 3200, roles: ["general", "prosthodontist"] },
      { id: "t-rct", name: "Root canal session", category: "endodontic", durationMin: 60, estProduction: 6500, roles: ["endodontist", "general"] },
      { id: "t-crown", name: "Crown preparation", category: "prosthetic", durationMin: 60, estProduction: 9000, roles: ["prosthodontist", "general"] },
      { id: "t-whitening", name: "Teeth whitening", category: "cosmetic", durationMin: 60, estProduction: 7500, roles: ["prosthodontist", "general"] },
      { id: "t-extraction", name: "Simple extraction", category: "restorative", durationMin: 30, estProduction: 2200, roles: ["general", "endodontist"] },
      { id: "t-aligner", name: "Aligner review", category: "prosthetic", durationMin: 30, estProduction: 1500, roles: ["prosthodontist", "general"] },
    ],
    hours: [SUNDAY_HOURS, WEEKDAY_HOURS, WEEKDAY_HOURS, WEEKDAY_HOURS, WEEKDAY_HOURS, WEEKDAY_HOURS, WEEKDAY_HOURS],
    settings: {
      weights: { ...DEFAULT_WEIGHTS },
      otherFactor: "waitlist_seniority",
      staffPriorityEnabled: false,
      minNoticeMin: 120,
      offerWindowMin: 45,
      defaultMode: "simultaneous",
      defaultBatchSize: 3,
      autoBookOnAccept: true,
      maxOffersPerPatientPerWeek: 3,
      cancellationPolicy:
        "Please give at least 24 hours' notice to cancel or move an appointment so we can offer the time to another patient.",
      channels: { whatsapp: true, sms: true, email: true },
      quietHours: { start: 21 * 60, end: 8 * 60 },
      messageTemplate: DEFAULT_TEMPLATE,
    },
  };
}

const CHAIR_POOLS: Record<string, string[]> = {
  "ch-1": ["t-checkup", "t-filling", "t-filling", "t-extraction", "t-crown", "t-checkup"],
  "ch-2": ["t-rct", "t-rct", "t-checkup", "t-extraction", "t-rct"],
  "ch-3": ["t-scaling"],
  "ch-4": ["t-crown", "t-whitening", "t-aligner", "t-checkup", "t-filling", "t-aligner"],
};

const FIRST = [
  "Aarav", "Diya", "Kabir", "Saanvi", "Rohit", "Nandini", "Suresh", "Divya", "Abhishek", "Shreya",
  "Joseph", "Maria", "Tenzin", "Bhavna", "Manoj", "Ritu", "Venkatesh", "Gurpreet", "Siddharth", "Pooja",
  "Naveen", "Swati", "Arvind", "Lavanya", "Mohammed", "Ayesha", "Prakash", "Keerthi", "Sameer", "Neha",
  "Ramesh", "Sunita", "Varun", "Anushka", "Kiran", "Rekha", "Yash", "Mitali", "Gautam", "Sana",
];
const LAST = [
  "Rao", "Iyer", "Sharma", "Menon", "Reddy", "Nair", "Gupta", "Kulkarni", "Shetty", "Chatterjee",
  "Das", "Fernandes", "D'Souza", "Patel", "Joshi", "Hegde", "Pillai", "Bhat", "Gowda", "Mathew",
  "Ansari", "Krishnan", "Saxena", "Agarwal",
];

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Ids {
  next(prefix: string): string;
}
function idFactory(): Ids {
  const counters: Record<string, number> = {};
  return {
    next(prefix) {
      counters[prefix] = (counters[prefix] ?? 0) + 1;
      return `${prefix}-${String(counters[prefix]).padStart(3, "0")}`;
    },
  };
}

function phoneFor(i: number): string {
  const tail = String(1000 + ((i * 7919) % 9000));
  const head = ["98", "97", "99", "90", "88", "70"][i % 6];
  return `+91 ${head}xxx x${tail}`;
}

function emailFor(first: string, last: string): string {
  return `${first}.${last}`.toLowerCase().replace(/[^a-z.]/g, "") + "@example.com";
}

interface PatientSpec {
  first: string;
  last: string;
  language?: Patient["language"];
  consent?: Partial<Pick<Patient["consent"], "whatsapp" | "sms" | "email">>;
  channel?: Channel;
}

function makePatient(ids: Ids, i: number, spec: PatientSpec, today: ISODate): Patient {
  const consent = { whatsapp: true, sms: true, email: false, ...spec.consent };
  return {
    id: ids.next("pt"),
    name: `${spec.first} ${spec.last}`,
    firstName: spec.first,
    phone: phoneFor(i),
    email: emailFor(spec.first, spec.last),
    language: spec.language ?? "English",
    consent: { ...consent, recordedAt: addDays(today, -40 - (i % 90)) },
    preferredChannel: spec.channel ?? (consent.whatsapp ? "whatsapp" : consent.sms ? "sms" : "email"),
  };
}

interface Pin {
  key: string;
  chairId: string;
  date: ISODate;
  startMin: number;
  typeId: string;
  patientId: string;
}

export function createSeed(nowTs: Timestamp): DemoState {
  const clinic = buildClinic();
  const market = MARKETS[clinic.market];
  const tz = market.timeZone;
  const now = localNow(nowTs, tz);
  const today = now.date;
  const rng = mulberry32(Number(today.replace(/-/g, "")));
  const ids = idFactory();
  const ts = (date: ISODate, min: number) => toTimestamp(date, min, tz);
  const typeById = (id: string) => clinic.appointmentTypes.find((t) => t.id === id)!;
  const hoursOf = (date: ISODate) => clinic.hours[weekdayOf(date)];
  const pick = <T,>(arr: T[]): T => arr[Math.floor(rng() * arr.length)];
  const between = (a: number, b: number) => a + Math.floor(rng() * (b - a + 1));

  // ---------------------------------------------------------------- scenario dates
  const nextOpenDay = (from: ISODate, minClose: number): ISODate => {
    for (let i = 1; i < 10; i++) {
      const d = addDays(from, i);
      const h = hoursOf(d);
      if (h && h.close >= minClose) return d;
    }
    return addDays(from, 1);
  };
  const heroDate = nextOpenDay(today, 16 * 60);
  const heroWd = weekdayOf(heroDate);
  const secondDate = nextOpenDay(heroDate, 11 * 60);
  const heldDate = nextOpenDay(secondDate, 18 * 60);

  // Live campaign: later today when there is room, otherwise on the hero day morning.
  let liveDate = heroDate;
  let liveStart = 11 * 60;
  const todayHours = hoursOf(today);
  if (todayHours) {
    let s = Math.ceil((now.minutes + 150) / 15) * 15;
    if (todayHours.breakStart && s + 45 > todayHours.breakStart && s < (todayHours.breakEnd ?? 0)) s = todayHours.breakEnd!;
    if (s >= todayHours.open && s + 45 <= todayHours.close) {
      liveDate = today;
      liveStart = s;
    }
  }

  // ---------------------------------------------------------------- patients
  const patients: Patient[] = [];
  let pi = 0;
  const add = (spec: PatientSpec) => {
    const p = makePatient(ids, pi++, spec, today);
    patients.push(p);
    return p;
  };

  const wl = {
    sneha: add({ first: "Sneha", last: "Kulkarni", language: "Kannada" }),
    arjun: add({ first: "Arjun", last: "Iyer", consent: { email: true } }),
    kavya: add({ first: "Kavya", last: "Menon" }),
    farhan: add({ first: "Farhan", last: "Siddiqui", language: "Hindi" }),
    lakshmi: add({ first: "Lakshmi", last: "Venkatesh", language: "Tamil", consent: { whatsapp: false }, channel: "sms" }),
    rohan: add({ first: "Rohan", last: "Das" }),
    priya: add({ first: "Priya", last: "Nair", consent: { email: true } }),
    imran: add({ first: "Imran", last: "Khan", consent: { whatsapp: false, sms: false, email: false }, channel: "sms" }),
    ishita: add({ first: "Ishita", last: "Banerjee", consent: { email: true }, channel: "email" }),
    karthik: add({ first: "Karthik", last: "Reddy", language: "Kannada" }),
    zoya: add({ first: "Zoya", last: "Fernandes" }),
    harpreet: add({ first: "Harpreet", last: "Singh", language: "Hindi" }),
    deepa: add({ first: "Deepa", last: "Hegde", language: "Kannada" }),
    tanvi: add({ first: "Tanvi", last: "Shah" }),
    anjali: add({ first: "Anjali", last: "Gupta", language: "Hindi" }),
  };
  const scenario = {
    rahul: add({ first: "Rahul", last: "Mehta" }),
    aditya: add({ first: "Aditya", last: "Kapoor" }),
    meenakshi: add({ first: "Meenakshi", last: "Sundaram", language: "Tamil" }),
    vivek: add({ first: "Vivek", last: "Malhotra" }),
    ritu: add({ first: "Ritu", last: "Saxena", language: "Hindi" }),
  };

  const taken = new Set(patients.map((p) => p.name));
  const pool: Patient[] = [];
  while (pool.length < 120) {
    const first = pick(FIRST);
    const last = pick(LAST);
    const name = `${first} ${last}`;
    if (taken.has(name)) continue;
    taken.add(name);
    const r = rng();
    pool.push(
      add({
        first,
        last,
        language: r < 0.15 ? "Hindi" : r < 0.3 ? "Kannada" : r < 0.38 ? "Tamil" : "English",
        consent: { whatsapp: r > 0.08, sms: r > 0.2, email: r > 0.6 },
      }),
    );
  }

  // ---------------------------------------------------------------- book
  const firstDay = addDays(today, -13);
  const lastDay = [addDays(today, 6), heldDate].sort().at(-1)!;
  const pins: Pin[] = [
    { key: "hero", chairId: "ch-2", date: heroDate, startMin: 15 * 60, typeId: "t-rct", patientId: scenario.rahul.id },
    { key: "live", chairId: "ch-1", date: liveDate, startMin: liveStart, typeId: "t-filling", patientId: scenario.aditya.id },
    { key: "second", chairId: "ch-3", date: secondDate, startMin: 10 * 60, typeId: "t-scaling", patientId: scenario.meenakshi.id },
    { key: "held", chairId: "ch-4", date: heldDate, startMin: 17 * 60, typeId: "t-crown", patientId: scenario.vivek.id },
  ];
  if (todayHours) {
    pins.push({ key: "recovered", chairId: "ch-4", date: today, startMin: todayHours.open + 60, typeId: "t-crown", patientId: pool[0].id });
  }

  const appointments: Appointment[] = [];
  const pinned: Record<string, Appointment> = {};
  const busy = new Map<string, Set<string>>(); // date -> patient ids

  const isPast = (date: ISODate, endMin: number) => date < today || (date === today && endMin <= now.minutes);

  for (let date = firstDay; date <= lastDay; date = addDays(date, 1)) {
    const h = hoursOf(date);
    if (!h) continue;
    const dayBusy = busy.get(date) ?? new Set<string>();
    busy.set(date, dayBusy);
    for (const chair of clinic.chairs) {
      if (weekdayOf(date) === 0 && chair.locationId === "loc-hsr") continue; // HSR closed Sundays
      const chairPins = pins.filter((p) => p.chairId === chair.id && p.date === date);
      let cursor = h.open;
      while (cursor < h.close) {
        if (h.breakStart !== undefined && cursor >= h.breakStart && cursor < h.breakEnd!) {
          cursor = h.breakEnd!;
          continue;
        }
        const pin = chairPins.find((p) => p.startMin === cursor);
        if (pin) {
          const t = typeById(pin.typeId);
          const appt = makeAppt(pin.patientId, t, chair.id, date, cursor);
          pinned[pin.key] = appt;
          appointments.push(appt);
          dayBusy.add(pin.patientId);
          cursor += t.durationMin;
          continue;
        }
        const limit = Math.min(
          h.breakStart !== undefined && cursor < h.breakStart ? h.breakStart : h.close,
          ...chairPins.filter((p) => p.startMin > cursor).map((p) => p.startMin),
        );
        if (rng() < 0.07) {
          cursor += 15; // natural gap in the book
          continue;
        }
        const fits = CHAIR_POOLS[chair.id].map(typeById).filter((t) => cursor + t.durationMin <= limit);
        if (fits.length === 0) {
          cursor += 15;
          continue;
        }
        const t = pick(fits);
        let patient = pick(pool);
        for (let tries = 0; dayBusy.has(patient.id) && tries < 10; tries++) patient = pick(pool);
        dayBusy.add(patient.id);
        appointments.push(makeAppt(patient.id, t, chair.id, date, cursor));
        cursor += t.durationMin;
      }
    }
  }

  function makeAppt(patientId: string, t: AppointmentType, chairId: string, date: ISODate, startMin: number): Appointment {
    const chair = clinic.chairs.find((c) => c.id === chairId)!;
    return {
      id: ids.next("ap"),
      patientId,
      typeId: t.id,
      providerId: chair.providerId,
      chairId,
      locationId: chair.locationId,
      date,
      startMin,
      durationMin: t.durationMin,
      status: isPast(date, startMin + t.durationMin) ? "completed" : "booked",
      createdAt: ts(date, startMin) - between(3, 30) * DAY,
    };
  }

  // ---------------------------------------------------------------- state collections
  const slots: Slot[] = [];
  const campaigns: Campaign[] = [];
  const offers: Offer[] = [];
  const messages: MessageLog[] = [];
  const activity: ActivityEvent[] = [];
  const waitlist: WaitlistEntry[] = [];

  const log = (e: Omit<ActivityEvent, "id">) => activity.push({ id: ids.next("ev"), ...e });
  const msg = (m: Omit<MessageLog, "id" | "provider">) =>
    messages.push({
      id: ids.next("msg"),
      provider: m.direction === "system" ? "ChairFill" : `Simulated ${m.channel === "whatsapp" ? "WhatsApp" : m.channel === "sms" ? "SMS" : "email"}`,
      ...m,
    });
  const patientName = (id: string) => patients.find((p) => p.id === id)!.name;
  const chairLabel = (id: string) => clinic.chairs.find((c) => c.id === id)!.label;

  function cancel(appt: Appointment, at: Timestamp, source: CancellationSource, note?: string): Slot {
    appt.status = source === "no_show" ? "no_show" : "cancelled";
    appt.cancelledAt = at;
    appt.cancellationSource = source;
    appt.cancellationNote = note;
    const slot: Slot = {
      id: ids.next("sl"),
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
      detectedAt: at + 4000,
    };
    slots.push(slot);
    const when = `${relativeDay(appt.date, localNow(at, tz).date)} ${clock(appt.startMin)}`;
    log({
      at,
      kind: "cancellation",
      slotId: slot.id,
      text:
        source === "no_show"
          ? `${patientName(appt.patientId)} did not attend ${clock(appt.startMin)}, ${chairLabel(appt.chairId)}`
          : `${patientName(appt.patientId)} cancelled ${when}, ${chairLabel(appt.chairId)}`,
    });
    if (source !== "no_show") {
      log({ at: at + 4000, kind: "slot_detected", slotId: slot.id, text: `ChairFill opened ${appt.durationMin} min on ${chairLabel(appt.chairId)}` });
    }
    return slot;
  }

  function sendOffer(
    campaign: Campaign,
    slot: Slot,
    entry: WaitlistEntry,
    rank: number,
    score: number,
    sentAt: Timestamp,
  ): Offer {
    const patient = patients.find((p) => p.id === entry.patientId)!;
    const channel: Channel = patient.consent[patient.preferredChannel]
      ? patient.preferredChannel
      : patient.consent.whatsapp
        ? "whatsapp"
        : "sms";
    const body = draftOfferMessage({
      clinic,
      slot,
      patient,
      type: typeById(entry.typeId),
      today: localNow(sentAt, tz).date,
      template: clinic.settings.messageTemplate,
    });
    const offer: Offer = {
      id: ids.next("of"),
      campaignId: campaign.id,
      slotId: slot.id,
      waitlistEntryId: entry.id,
      patientId: patient.id,
      channel,
      body,
      score,
      rank,
      status: "sent",
      sentAt,
      expiresAt: sentAt + campaign.offerWindowMin * MIN,
      respondedAt: null,
    };
    offers.push(offer);
    campaign.offerIds.push(offer.id);
    entry.lastContactAt = sentAt;
    msg({ patientId: patient.id, offerId: offer.id, channel, direction: "outbound", body, at: sentAt });
    log({ at: sentAt, kind: "offer_sent", slotId: slot.id, offerId: offer.id, text: `Offer sent to ${patient.name} by ${channelName(channel)}` });
    return offer;
  }

  function respond(offer: Offer, slot: Slot, outcome: "accepted" | "declined" | "expired", at: Timestamp) {
    const patient = patients.find((p) => p.id === offer.patientId)!;
    offer.status = outcome;
    if (outcome === "expired") {
      offer.respondedAt = null;
      log({ at, kind: "offer_expired", slotId: slot.id, offerId: offer.id, text: `Offer to ${patient.name} expired with no reply` });
      return;
    }
    offer.respondedAt = at;
    msg({ patientId: patient.id, offerId: offer.id, channel: offer.channel, direction: "inbound", body: outcome === "accepted" ? "Accept" : "Decline", at });
    log({
      at,
      kind: outcome === "accepted" ? "offer_accepted" : "offer_declined",
      slotId: slot.id,
      offerId: offer.id,
      text: `${patient.name} ${outcome === "accepted" ? "accepted" : "declined"} the offer`,
    });
  }

  function fill(slot: Slot, entry: WaitlistEntry, offer: Offer | null, at: Timestamp): Appointment {
    const t = typeById(entry.typeId);
    const appt: Appointment = {
      id: ids.next("ap"),
      patientId: entry.patientId,
      typeId: t.id,
      providerId: slot.providerId,
      chairId: slot.chairId,
      locationId: slot.locationId,
      date: slot.date,
      startMin: slot.startMin,
      durationMin: t.durationMin,
      status: isPast(slot.date, slot.startMin + t.durationMin) ? "completed" : "booked",
      createdAt: at,
      fromSlotId: slot.id,
    };
    appointments.push(appt);
    slot.status = "filled";
    slot.resolvedAt = at;
    slot.filledAppointmentId = appt.id;
    entry.status = "booked";
    if (offer) {
      msg({
        patientId: entry.patientId,
        offerId: offer.id,
        channel: offer.channel,
        direction: "outbound",
        body: `Booked: ${t.name}, ${relativeDay(slot.date, localNow(at, tz).date)} at ${clock(slot.startMin)} with ${clinic.providers.find((p) => p.id === slot.providerId)!.name}. Reply here if you need to change it.`,
        at: at + 2000,
      });
    }
    log({ at: at + 1000, kind: "slot_filled", slotId: slot.id, text: `${chairLabel(slot.chairId)} filled with ${patientName(entry.patientId)}, ${t.name.toLowerCase()}` });
    return appt;
  }

  function historicEntry(patient: Patient, typeId: string, addedAt: Timestamp): WaitlistEntry {
    const e: WaitlistEntry = {
      id: ids.next("wl"),
      patientId: patient.id,
      typeId,
      preferredProviderId: null,
      preferredLocationId: null,
      preferredDays: [],
      preferredTimes: [],
      availableFrom: localNow(addedAt, tz).date,
      noticeHours: 2,
      status: "waiting",
      addedAt,
      lastContactAt: null,
      patientNotes: "",
    };
    waitlist.push(e);
    return e;
  }

  // ---------------------------------------------------------------- history (past 13 days)
  const pinnedIds = new Set(Object.values(pinned).map((a) => a.id));
  const historyPool = pool.slice(40); // patients who joined and left the waitlist
  let hp = 0;
  for (let date = firstDay; date < today; date = addDays(date, 1)) {
    const dayAppts = appointments.filter((a) => a.date === date && a.status === "completed" && !pinnedIds.has(a.id));
    if (dayAppts.length === 0) continue;
    const count = between(1, 3);
    for (let i = 0; i < count; i++) {
      const appt = dayAppts.splice(Math.floor(rng() * dayAppts.length), 1)[0];
      if (!appt) break;
      const startTs = ts(appt.date, appt.startMin);
      if (rng() < 0.12) {
        const slot = cancel(appt, startTs + 20 * MIN, "no_show");
        slot.status = "lost";
        slot.resolvedAt = startTs + 20 * MIN;
        log({ at: slot.resolvedAt, kind: "slot_lost", slotId: slot.id, text: `${appt.durationMin} min on ${chairLabel(appt.chairId)} went unused` });
        continue;
      }
      const lead = between(3, 30) * HOUR;
      const source: CancellationSource = rng() < 0.55 ? "patient_message" : "patient_call";
      const slot = cancel(appt, startTs - lead, source);
      const roll = rng();
      if (roll < 0.14) {
        slot.status = "closed";
        slot.resolvedAt = slot.detectedAt + between(5, 40) * MIN;
        log({ at: slot.resolvedAt, kind: "slot_closed", slotId: slot.id, text: `Staff left ${chairLabel(slot.chairId)} open (provider schedule change)` });
        continue;
      }
      const provider = clinic.providers.find((p) => p.id === slot.providerId)!;
      const candidates = clinic.appointmentTypes.filter((t) => t.roles.includes(provider.role) && t.durationMin <= slot.durationMin);
      const campaign: Campaign = {
        id: ids.next("cp"),
        slotId: slot.id,
        mode: "simultaneous",
        offerWindowMin: 45,
        approvedBy: rng() < 0.5 ? "Pooja (front desk)" : "Naveen (front desk)",
        createdAt: slot.detectedAt + between(3, 35) * MIN,
        status: "live",
        offerIds: [],
      };
      campaigns.push(campaign);
      slot.status = "offering";
      log({ at: campaign.createdAt, kind: "campaign_launched", slotId: slot.id, text: `${campaign.approvedBy} approved a fill campaign` });
      const n = between(1, 3);
      const entries = Array.from({ length: n }, () => {
        const patient = historyPool[hp++ % historyPool.length];
        return historicEntry(patient, pick(candidates).id, campaign.createdAt - between(4, 40) * DAY);
      });
      const sent = entries.map((e, rank) => sendOffer(campaign, slot, e, rank + 1, between(62, 96) - rank * 6, campaign.createdAt));
      const fills = roll < 0.78;
      sent.forEach((o, idx) => {
        const isWinner = fills && idx === sent.length - 1;
        if (isWinner) return;
        const declines = rng() < 0.6;
        respond(o, slot, declines ? "declined" : "expired", declines ? o.sentAt! + between(3, 40) * MIN : o.expiresAt!);
        entries[idx].status = "waiting";
      });
      if (fills) {
        const winner = sent[sent.length - 1];
        const acceptAt = winner.sentAt! + between(2, 38) * MIN;
        respond(winner, slot, "accepted", acceptAt);
        fill(slot, entries[entries.length - 1], winner, acceptAt + 3000);
        campaign.status = "filled";
        // A waitlister who said no stays on the list but is history now.
        entries.slice(0, -1).forEach((e) => (e.status = "booked"));
      } else {
        campaign.status = "exhausted";
        slot.status = "lost";
        slot.resolvedAt = startTs;
        entries.forEach((e) => (e.status = "booked"));
        log({ at: startTs, kind: "slot_lost", slotId: slot.id, text: `${slot.durationMin} min on ${chairLabel(slot.chairId)} went unused` });
      }
    }
  }
  // History entries are not part of the active list.
  for (const e of waitlist) e.status = "booked";

  // ---------------------------------------------------------------- active waitlist (15)
  const daysAgo = (d: number) => nowTs - d * DAY - between(0, 600) * MIN;
  const wd = (offset: number) => ((heroWd + offset + 7) % 7) as Weekday;
  const active = (
    patient: Patient,
    typeId: string,
    o: Partial<WaitlistEntry> & { days?: Weekday[]; times?: TimeBand[]; added: number },
  ): WaitlistEntry => {
    const e: WaitlistEntry = {
      id: ids.next("wl"),
      patientId: patient.id,
      typeId,
      preferredProviderId: o.preferredProviderId ?? null,
      preferredLocationId: o.preferredLocationId ?? null,
      preferredDays: o.days ?? [],
      preferredTimes: o.times ?? [],
      availableFrom: o.availableFrom ?? addDays(today, -o.added),
      noticeHours: o.noticeHours ?? 4,
      status: o.status ?? "waiting",
      addedAt: daysAgo(o.added),
      lastContactAt: o.lastContactAt ?? null,
      patientNotes: o.patientNotes ?? "",
      staffPriority: o.staffPriority,
    };
    waitlist.push(e);
    return e;
  };

  const W = {
    sneha: active(wl.sneha, "t-rct", { preferredProviderId: "pr-shetty", preferredLocationId: "loc-ind", days: [wd(0), wd(2)], times: ["afternoon", "evening"], noticeHours: 4, added: 19, patientNotes: "Works nearby, can leave office at short notice. Prefers WhatsApp." }),
    arjun: active(wl.arjun, "t-rct", { days: [], times: ["afternoon"], noticeHours: 12, added: 9, patientNotes: "Second sitting of an ongoing treatment." }),
    kavya: active(wl.kavya, "t-filling", { preferredProviderId: "pr-rao", preferredLocationId: "loc-ind", days: [], times: ["afternoon", "evening"], noticeHours: 2, added: 6 }),
    farhan: active(wl.farhan, "t-checkup", { preferredProviderId: "pr-rao", preferredLocationId: "loc-ind", days: [], times: ["morning", "afternoon"], noticeHours: 6, added: 12, patientNotes: "Prefers Hindi on calls." }),
    lakshmi: active(wl.lakshmi, "t-extraction", { preferredLocationId: "loc-ind", days: [wd(1), wd(3)], times: ["afternoon"], noticeHours: 8, added: 4, patientNotes: "SMS only, no WhatsApp." }),
    rohan: active(wl.rohan, "t-rct", { preferredProviderId: "pr-shetty", preferredLocationId: "loc-hsr", days: [wd(0)], times: ["evening"], noticeHours: 6, added: 15 }),
    priya: active(wl.priya, "t-rct", { preferredProviderId: "pr-shetty", days: [], times: ["afternoon"], noticeHours: 48, added: 8, patientNotes: "Needs two days to arrange childcare." }),
    imran: active(wl.imran, "t-rct", { days: [], times: [], noticeHours: 4, added: 22, patientNotes: "Withdrew messaging consent. Call only." }),
    ishita: active(wl.ishita, "t-whitening", { preferredProviderId: "pr-qureshi", preferredLocationId: "loc-hsr", days: [6, 0], times: ["morning"], noticeHours: 24, added: 11, patientNotes: "Email preferred." }),
    karthik: active(wl.karthik, "t-scaling", { preferredLocationId: "loc-ind", days: [], times: ["morning"], noticeHours: 12, added: 7 }),
    zoya: active(wl.zoya, "t-scaling", { preferredProviderId: "pr-pillai", preferredLocationId: "loc-ind", days: [], times: ["morning"], noticeHours: 4, added: 16, patientNotes: "Before 11 am only, school run after." }),
    harpreet: active(wl.harpreet, "t-aligner", { preferredProviderId: "pr-qureshi", preferredLocationId: "loc-hsr", days: [], times: ["evening"], noticeHours: 6, added: 3 }),
    deepa: active(wl.deepa, "t-checkup", { days: [], times: [], noticeHours: 2, added: 5, patientNotes: "Flexible, lives 10 minutes from Indiranagar." }),
    tanvi: active(wl.tanvi, "t-filling", { preferredProviderId: "pr-rao", preferredLocationId: "loc-ind", days: [], times: ["afternoon", "evening"], noticeHours: 2, added: 10 }),
    anjali: active(wl.anjali, "t-rct", { preferredProviderId: "pr-shetty", days: [], times: ["morning"], noticeHours: 24, added: 14, status: "paused", patientNotes: "Travelling, paused until she calls back." }),
  };

  // ---------------------------------------------------------------- recovered earlier (today's restored block)
  if (pinned.recovered) {
    const appt = pinned.recovered;
    const cancelAt = ts(addDays(today, -1), 18 * 60 + 40);
    const slot = cancel(appt, cancelAt, "patient_call", "Called to say she is unwell");
    const campaign: Campaign = {
      id: ids.next("cp"),
      slotId: slot.id,
      mode: "simultaneous",
      offerWindowMin: 45,
      approvedBy: "Pooja (front desk)",
      createdAt: cancelAt + 6 * MIN,
      status: "filled",
      offerIds: [],
    };
    campaigns.push(campaign);
    log({ at: campaign.createdAt, kind: "campaign_launched", slotId: slot.id, text: "Pooja (front desk) approved a fill campaign" });
    const entry = historicEntry(scenario.ritu, "t-crown", nowTs - 21 * DAY);
    const o = sendOffer(campaign, slot, entry, 1, 91, campaign.createdAt);
    respond(o, slot, "accepted", o.sentAt! + 11 * MIN);
    fill(slot, entry, o, o.sentAt! + 11 * MIN + 3000);
  }

  // ---------------------------------------------------------------- held slot
  {
    const appt = pinned.held;
    const slot = cancel(appt, nowTs - 26 * HOUR, "patient_call", "Moving to next month");
    slot.status = "held";
    slot.heldNote = "Held for Dr. Qureshi's crown re-cement, patient confirming by phone";
    log({ at: nowTs - 25 * HOUR, kind: "slot_held", slotId: slot.id, text: `Naveen (front desk) held ${chairLabel(slot.chairId)}, ${clock(slot.startMin)}` });
  }

  // ---------------------------------------------------------------- second open slot (3 h ago, nothing sent yet)
  {
    const appt = pinned.second;
    cancel(appt, nowTs - 3 * HOUR - 12 * MIN, "patient_call", "Exams this week");
    msg({ patientId: appt.patientId, channel: "sms", direction: "system", body: "Cancellation logged by phone (Pooja, front desk).", at: nowTs - 3 * HOUR - 12 * MIN });
  }

  // ---------------------------------------------------------------- live campaign, one reply pending
  {
    const appt = pinned.live;
    const cancelAt = nowTs - 52 * MIN;
    const slot = cancel(appt, cancelAt, "patient_call", "Stuck at work");
    const campaign: Campaign = {
      id: ids.next("cp"),
      slotId: slot.id,
      mode: "simultaneous",
      offerWindowMin: 45,
      approvedBy: "Pooja (front desk)",
      createdAt: nowTs - 16 * MIN,
      status: "live",
      offerIds: [],
    };
    campaigns.push(campaign);
    slot.status = "offering";
    log({ at: campaign.createdAt, kind: "campaign_launched", slotId: slot.id, text: "Pooja (front desk) approved a fill campaign" });
    const sentAt = campaign.createdAt;
    const { ranked } = matchSlot(slot, [W.kavya, W.tanvi], {
      clinic,
      patients,
      appointments,
      offers,
      now: localNow(sentAt, tz),
      nowTs: sentAt,
    });
    const scoreOf = (e: WaitlistEntry) => ranked.find((r) => r.entry.id === e.id)?.score ?? 0;
    sendOffer(campaign, slot, W.kavya, 1, scoreOf(W.kavya), sentAt);
    const ot = sendOffer(campaign, slot, W.tanvi, 2, scoreOf(W.tanvi), sentAt);
    W.kavya.status = "offered";
    respond(ot, slot, "declined", nowTs - 9 * MIN);
    msg({ patientId: wl.tanvi.id, offerId: ot.id, channel: ot.channel, direction: "outbound", body: "No problem, Tanvi. You stay on our waitlist and we will message you about the next opening.", at: nowTs - 9 * MIN + 2000 });
  }

  // ---------------------------------------------------------------- hero: just cancelled, waiting for staff
  {
    const appt = pinned.hero;
    const at = nowTs - 12 * MIN;
    msg({
      patientId: appt.patientId,
      channel: "whatsapp",
      direction: "inbound",
      body: `Hi, I have to travel for work ${relativeDay(appt.date, today)}. Please cancel my ${clock(appt.startMin)} appointment, sorry for the short notice.`,
      at: at - 30_000,
    });
    cancel(appt, at, "patient_message", "Travelling for work");
  }

  activity.sort((a, b) => a.at - b.at);
  messages.sort((a, b) => a.at - b.at);

  return {
    version: SEED_VERSION,
    seededAt: nowTs,
    clockOffsetMin: 0,
    clinic,
    patients,
    appointments,
    slots,
    waitlist,
    campaigns,
    offers,
    messages,
    activity,
  };
}

export function channelName(c: Channel): string {
  return c === "whatsapp" ? "WhatsApp" : c === "sms" ? "SMS" : "email";
}
