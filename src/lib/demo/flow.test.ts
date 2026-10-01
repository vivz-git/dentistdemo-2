import { describe, expect, it } from "vitest";
import { createSeed } from "./seed";
import {
  bookManually,
  cancelAppointment,
  holdSlot,
  launchCampaign,
  patientRespond,
  releaseSlot,
  tick,
  updateSettings,
} from "./actions";
import { summarise, lastNDays } from "./metrics";
import { matchSlot } from "@/lib/matching/engine";
import { guardDraft } from "@/lib/ai/assistant";
import { localNow } from "@/lib/domain/time";
import type { DemoState, Slot } from "@/lib/domain/types";

// Thursday 1 Oct 2026, 10:30 IST.
const NOW = Date.UTC(2026, 9, 1, 5, 0);
const TZ = "Asia/Kolkata";

function ctx(s: DemoState, nowTs = NOW) {
  return { clinic: s.clinic, patients: s.patients, appointments: s.appointments, offers: s.offers, now: localNow(nowTs, TZ), nowTs };
}

function heroSlot(s: DemoState): Slot {
  // The most recent cancellation that nobody has acted on yet.
  return [...s.slots].filter((sl) => sl.status === "open").sort((a, b) => b.detectedAt - a.detectedAt)[0];
}

describe("seed", () => {
  const s = createSeed(NOW);

  it("meets the demo data minimums", () => {
    expect(s.patients.length).toBeGreaterThanOrEqual(30);
    expect(s.appointments.length).toBeGreaterThanOrEqual(20);
    expect(s.waitlist.filter((w) => w.status !== "booked")).toHaveLength(15);
    expect(s.slots.some((sl) => sl.status === "filled")).toBe(true);
    expect(s.offers.some((o) => o.status === "declined")).toBe(true);
    expect(s.offers.some((o) => o.status === "expired")).toBe(true);
  });

  it("is deterministic for the same day", () => {
    const again = createSeed(NOW + 60_000);
    expect(again.patients.map((p) => p.name)).toEqual(s.patients.map((p) => p.name));
  });

  it("never double-books a chair", () => {
    const booked = s.appointments.filter((a) => a.status === "booked" || a.status === "completed");
    for (const a of booked) {
      const clash = booked.find(
        (b) => b.id !== a.id && b.chairId === a.chairId && b.date === a.date && a.startMin < b.startMin + b.durationMin && b.startMin < a.startMin + a.durationMin,
      );
      expect(clash, `${a.id} clashes with ${clash?.id}`).toBeUndefined();
    }
  });
});

describe("matching engine", () => {
  const s = createSeed(NOW);
  const slot = heroSlot(s);

  it("ranks the root-canal patient who asked for this dentist and day first", () => {
    const { ranked } = matchSlot(slot, s.waitlist, ctx(s));
    const top = ranked[0];
    expect(s.patients.find((p) => p.id === top.entry.patientId)?.name).toBe("Sneha Kulkarni");
    expect(top.score).toBeGreaterThanOrEqual(90);
    expect(top.factors.every((f) => f.reason.length > 0)).toBe(true);
  });

  it("explains exclusions instead of hiding them", () => {
    const { excluded } = matchSlot(slot, s.waitlist, ctx(s));
    const codes = new Set(excluded.map((e) => e.code));
    expect(codes.has("no_consent")).toBe(true);
    expect(codes.has("needs_more_notice")).toBe(true);
    expect(codes.has("provider_cannot_perform")).toBe(true);
  });

  it("scores sum to the weighted factors", () => {
    const { ranked } = matchSlot(slot, s.waitlist, ctx(s));
    for (const r of ranked) {
      const sum = r.factors.reduce((t, f) => t + f.points, 0);
      expect(Math.round(sum)).toBe(r.score);
    }
  });

  it("ignores staff priority unless the clinic enables it", () => {
    const withFlag = structuredClone(s);
    withFlag.clinic.settings.otherFactor = "staff_priority";
    const off = matchSlot(slot, withFlag.waitlist, ctx(withFlag)).ranked[0].factors.find((f) => f.key === "other")!;
    expect(off.weight).toBe(0);
  });
});

describe("fill flow", () => {
  it("cancel, launch, accept, book, and metrics update", () => {
    let s = createSeed(NOW);
    const before = summarise(s, NOW, lastNDays(localNow(NOW, TZ).date, 14));
    const slot = heroSlot(s);
    const { ranked } = matchSlot(slot, s.waitlist, ctx(s));

    const launched = launchCampaign(s, NOW, {
      slotId: slot.id,
      entryIds: ranked.slice(0, 2).map((r) => r.entry.id),
      mode: "simultaneous",
      offerWindowMin: 30,
      template: s.clinic.settings.messageTemplate,
      approvedBy: "Pooja (front desk)",
    });
    expect(launched.error).toBeUndefined();
    s = launched.state;
    const offers = s.offers.filter((o) => o.slotId === slot.id);
    expect(offers.every((o) => o.status === "sent")).toBe(true);
    // Not booked yet: no appointment exists for this slot.
    expect(s.appointments.some((a) => a.fromSlotId === slot.id)).toBe(false);

    const accepted = patientRespond(s, NOW + 5 * 60_000, offers[0].id, "accept");
    expect(accepted.error).toBeUndefined();
    s = accepted.state;
    const filledSlot = s.slots.find((x) => x.id === slot.id)!;
    expect(filledSlot.status).toBe("filled");
    expect(s.appointments.find((a) => a.id === filledSlot.filledAppointmentId)?.status).toBe("booked");
    expect(s.offers.find((o) => o.id === offers[1].id)?.status).toBe("superseded");

    // Recovery counts when it happens, so today's dashboard moves even for tomorrow's slot.
    const after = summarise(s, NOW + 5 * 60_000, lastNDays(localNow(NOW, TZ).date, 14));
    expect(after.recoveredMinutes).toBeGreaterThan(before.recoveredMinutes);
    expect(after.recoveredProduction).toBeGreaterThan(before.recoveredProduction);
    expect(after.filled).toBe(before.filled + 1);
  });

  it("does not book when the slot was taken first", () => {
    let s = createSeed(NOW);
    const slot = heroSlot(s);
    const { ranked } = matchSlot(slot, s.waitlist, ctx(s));
    s = launchCampaign(s, NOW, {
      slotId: slot.id,
      entryIds: ranked.slice(0, 2).map((r) => r.entry.id),
      mode: "simultaneous",
      offerWindowMin: 30,
      template: s.clinic.settings.messageTemplate,
      approvedBy: "Pooja",
    }).state;
    const [a, b] = s.offers.filter((o) => o.slotId === slot.id);
    s = patientRespond(s, NOW + 60_000, a.id, "accept").state;
    const late = patientRespond(s, NOW + 120_000, b.id, "accept");
    expect(late.error).toBeDefined();
    expect(late.state.appointments.filter((x) => x.fromSlotId === slot.id)).toHaveLength(1);
  });

  it("cascade sends the next patient after a decline, and expiry reopens the slot", () => {
    let s = createSeed(NOW);
    const slot = heroSlot(s);
    const { ranked } = matchSlot(slot, s.waitlist, ctx(s));
    s = launchCampaign(s, NOW, {
      slotId: slot.id,
      entryIds: ranked.slice(0, 2).map((r) => r.entry.id),
      mode: "cascade",
      offerWindowMin: 20,
      template: s.clinic.settings.messageTemplate,
      approvedBy: "Pooja",
    }).state;
    const [first, second] = s.offers.filter((o) => o.slotId === slot.id);
    expect(second.status).toBe("queued");
    s = patientRespond(s, NOW + 60_000, first.id, "decline").state;
    expect(s.offers.find((o) => o.id === second.id)?.status).toBe("sent");
    s = tick(s, NOW + 60 * 60_000);
    expect(s.offers.find((o) => o.id === second.id)?.status).toBe("expired");
    expect(s.slots.find((x) => x.id === slot.id)?.status).toBe("open");
  });

  it("requires staff confirmation when auto-book is off", () => {
    let s = updateSettings(createSeed(NOW), { autoBookOnAccept: false }).state;
    const slot = heroSlot(s);
    const { ranked } = matchSlot(slot, s.waitlist, ctx(s));
    s = launchCampaign(s, NOW, { slotId: slot.id, entryIds: [ranked[0].entry.id], mode: "simultaneous", offerWindowMin: 30, template: s.clinic.settings.messageTemplate, approvedBy: "Pooja" }).state;
    const offer = s.offers.find((o) => o.slotId === slot.id)!;
    s = patientRespond(s, NOW + 60_000, offer.id, "accept").state;
    expect(s.slots.find((x) => x.id === slot.id)?.status).toBe("held");
    expect(s.appointments.some((a) => a.fromSlotId === slot.id)).toBe(false);
  });

  it("cancelling an appointment opens a slot; reserve and release work", () => {
    let s = createSeed(NOW);
    const today = localNow(NOW, TZ).date;
    const appt = s.appointments.find((a) => a.status === "booked" && a.date > today)!;
    const res = cancelAppointment(s, NOW, appt.id, "patient_call");
    s = res.state;
    const slot = s.slots.find((sl) => sl.sourceAppointmentId === appt.id)!;
    expect(slot.status).toBe("open");
    s = holdSlot(s, NOW, slot.id, "", "Pooja").state;
    expect(s.slots.find((x) => x.id === slot.id)?.status).toBe("held");
    s = releaseSlot(s, NOW, slot.id, "Pooja").state;
    expect(s.slots.find((x) => x.id === slot.id)?.status).toBe("open");
  });

  it("manual booking fills a slot", () => {
    let s = createSeed(NOW);
    const slot = heroSlot(s);
    const { ranked } = matchSlot(slot, s.waitlist, ctx(s));
    s = bookManually(s, NOW, slot.id, ranked[0].entry.id, "Pooja").state;
    expect(s.slots.find((x) => x.id === slot.id)?.status).toBe("filled");
  });
});

describe("AI guardrails", () => {
  const s = createSeed(NOW);
  const slot = heroSlot(s);
  it("rejects clinical language and invented times", () => {
    expect(guardDraft("Hi Sneha, this is urgent, your infection may get worse. Come at 3 pm.", slot).ok).toBe(false);
    expect(guardDraft("Hi Sneha, a slot opened at 11:45 am tomorrow, would you like it?", slot).ok).toBe(false);
  });
  it("accepts a plain administrative offer", () => {
    expect(guardDraft("Hi Sneha, an earlier appointment is available tomorrow at 3 pm. Would you like us to reserve it?", slot).ok).toBe(true);
  });
});
