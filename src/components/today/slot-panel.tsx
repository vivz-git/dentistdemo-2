"use client";

import { useMemo, useState } from "react";
import { CaretDownIcon, XIcon } from "@phosphor-icons/react";
import type { Slot } from "@/lib/domain/types";
import { agoLabel, clock, relativeDay, timeRange } from "@/lib/domain/time";
import { money } from "@/lib/domain/markets";
import { bookManually, cancelAppointment, closeSlot, holdSlot, releaseSlot } from "@/lib/demo/actions";
import { campaignFor, lookup, matchesFor } from "@/lib/demo/selectors";
import { useData, useDemo, useNow } from "@/lib/demo/store";
import { Button } from "@/components/ui/button";
import { CandidateList } from "./candidates";
import { Composer } from "./composer";
import { LiveOffers, staffName } from "./live-offers";
import type { Focus } from "./day-book";

const BAND: Record<Slot["status"], { cls: string; label: string }> = {
  open: { cls: "void", label: "Open chair-time" },
  offering: { cls: "void-live", label: "Offer out, waiting for a reply" },
  held: { cls: "void-held", label: "Reserved" },
  filled: { cls: "restored", label: "Filled by ChairFill" },
  lost: { cls: "void-lost", label: "Lost, not filled in time" },
  closed: { cls: "void-lost", label: "Left empty by staff" },
};

export function FocusPanel({ focus, onFocus, onClose }: { focus: Focus; onFocus: (f: Focus) => void; onClose: () => void }) {
  const data = useData();
  if (!focus) return <EmptyPanel />;
  if (focus.kind === "appt") {
    const appt = data.appointments.find((a) => a.id === focus.id);
    return appt ? <ApptPanel apptId={appt.id} onFocus={onFocus} onClose={onClose} /> : <EmptyPanel />;
  }
  const slot = data.slots.find((s) => s.id === focus.id);
  return slot ? <SlotPanel key={slot.id} slot={slot} onClose={onClose} /> : <EmptyPanel />;
}

function EmptyPanel() {
  return (
    <div className="grid gap-4 p-6 text-sm text-ink-2">
      <div aria-hidden="true" className="void h-20 rounded-cf-sm" />
      <p className="font-semibold text-ink">Select open chair-time in the book.</p>
      <p>Dark, hatched blocks are time that a cancellation freed up. Select one to see who on the waitlist fits it and why, then send an offer.</p>
      <p>Select a booked appointment to cancel it and watch ChairFill open the slot.</p>
    </div>
  );
}

function PanelHeader({ slot, onClose }: { slot: Slot; onClose: () => void }) {
  const data = useData();
  const { local } = useNow();
  const L = lookup(data);
  const band = BAND[slot.status];
  const dark = slot.status !== "filled";
  return (
    <div className={`${band.cls} relative px-5 pb-5 pt-4`}>
      <div className="flex items-start justify-between gap-3">
        <p className={`text-xs font-medium ${dark ? "text-on-dark-2" : "text-restore"}`}>{band.label}</p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close panel"
          className={`-mr-2 -mt-1 grid size-8 place-items-center rounded-cf ${dark ? "text-on-dark-2 hover:bg-d2 hover:text-d8" : "text-ink-2 hover:bg-panel-2"}`}
        >
          <XIcon className="size-4" />
        </button>
      </div>
      <p className={`mt-1 text-2xl font-semibold tracking-[-0.02em] ${dark ? "text-d8" : "text-ink"}`}>
        <span className="capitalize">{relativeDay(slot.date, local.date)}</span>, {timeRange(slot.startMin, slot.durationMin)}
      </p>
      <p className={`mt-1 text-sm ${dark ? "text-on-dark" : "text-ink-2"}`}>
        {L.chair(slot.chairId)?.label}, {L.provider(slot.providerId)?.name}, {L.location(slot.locationId)?.name}
      </p>
    </div>
  );
}

function SlotFacts({ slot }: { slot: Slot }) {
  const data = useData();
  const { nowTs, market } = useNow();
  const L = lookup(data);
  const src = L.appointment(slot.sourceAppointmentId);
  const original = L.type(slot.originalTypeId);
  const sourceLabel = {
    patient_call: "by phone",
    patient_message: "by message",
    no_show: "no-show",
    clinic: "by the clinic",
  } as const;
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 border-b border-rule px-5 py-4 text-sm">
      {src && (
        <>
          <dt className="text-ink-2">{slot.origin === "reschedule" ? "Moved" : slot.origin === "no_show" ? "No-show" : "Cancelled"}</dt>
          <dd>
            {L.patient(src.patientId)?.name}
            {src.cancellationSource && slot.origin !== "reschedule" ? `, ${sourceLabel[src.cancellationSource]}` : ""}
            <span className="text-ink-3"> {agoLabel(src.cancelledAt ?? slot.detectedAt, nowTs)}</span>
            {src.cancellationNote && <span className="block text-xs text-ink-3">&ldquo;{src.cancellationNote}&rdquo;</span>}
          </dd>
        </>
      )}
      {original && (
        <>
          <dt className="text-ink-2">Was booked for</dt>
          <dd>{original.name}</dd>
          <dt className="text-ink-2">At risk</dt>
          <dd>
            <span className="num">{money(market, original.estProduction)}</span> <span className="text-xs text-ink-3">estimate, demo price list</span>
          </dd>
        </>
      )}
      {slot.heldNote && (
        <>
          <dt className="text-ink-2">Note</dt>
          <dd>{slot.heldNote}</dd>
        </>
      )}
    </dl>
  );
}

function SlotPanel({ slot, onClose }: { slot: Slot; onClose: () => void }) {
  const data = useData();
  const { nowTs } = useNow();
  const run = useDemo((s) => s.run);
  const settings = data.clinic.settings;
  const { ranked, excluded } = useMemo(() => matchesFor(data, slot, nowTs), [data, slot, nowTs]);
  const [selected, setSelected] = useState<string[]>(() => ranked.slice(0, settings.defaultBatchSize).map((r) => r.entry.id));
  const [stage, setStage] = useState<"list" | "compose">("list");
  const [holdNote, setHoldNote] = useState("");
  const [holding, setHolding] = useState(false);
  const campaign = campaignFor(data, slot.id);
  const chosen = ranked.filter((r) => selected.includes(r.entry.id));

  const toggle = (id: string) => setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  return (
    <div className="flex min-h-full flex-col">
      <PanelHeader slot={slot} onClose={onClose} />
      <SlotFacts slot={slot} />

      {slot.status === "open" && stage === "list" && (
        <>
          <CandidateList
            ranked={ranked}
            excluded={excluded}
            selected={selected}
            onToggle={toggle}
            onBookDirect={(entryId) => run((s, now) => bookManually(s, now, slot.id, entryId, staffName()))}
          />
          <div className="sticky bottom-0 mt-auto grid gap-3 border-t border-rule bg-surface px-5 py-4">
            <Button variant="primary" disabled={chosen.length === 0} onClick={() => setStage("compose")}>
              {chosen.length === 0 ? "Select patients to offer" : `Review offer for ${chosen.length} patient${chosen.length === 1 ? "" : "s"}`}
            </Button>
            {holding ? (
              <div className="grid gap-2">
                <label className="grid gap-1 text-xs font-medium text-ink-2">
                  Why reserve it?
                  <input
                    autoFocus
                    value={holdNote}
                    onChange={(e) => setHoldNote(e.target.value)}
                    placeholder="For example: kept for a walk-in"
                    className="h-9 rounded-cf border border-rule-strong bg-surface px-2.5 text-sm text-ink outline-none placeholder:text-ink-3 focus:border-ink"
                  />
                </label>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => {
                      run((s, now) => holdSlot(s, now, slot.id, holdNote, staffName()));
                      setHolding(false);
                    }}
                  >
                    Reserve slot
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setHolding(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => setHolding(true)}>
                  Reserve
                </Button>
                <Button size="sm" variant="ghost" onClick={() => run((s, now) => closeSlot(s, now, slot.id, staffName()))}>
                  Leave empty
                </Button>
              </div>
            )}
          </div>
        </>
      )}

      {slot.status === "open" && stage === "compose" && <Composer slot={slot} chosen={chosen} onBack={() => setStage("list")} />}

      {(slot.status === "offering" || (slot.status === "held" && campaign?.status === "live")) && campaign && <LiveOffers slot={slot} campaign={campaign} />}

      {slot.status === "held" && campaign?.status !== "live" && (
        <div className="grid gap-3 px-5 py-4">
          <p className="text-sm text-ink-2">Reserved slots are not offered to the waitlist. Release it when you want ChairFill to fill it.</p>
          <div className="flex gap-2">
            <Button variant="primary" onClick={() => run((s, now) => releaseSlot(s, now, slot.id, staffName()))}>
              Release for filling
            </Button>
            <Button variant="ghost" onClick={() => run((s, now) => closeSlot(s, now, slot.id, staffName()))}>
              Leave empty
            </Button>
          </div>
        </div>
      )}

      {slot.status === "filled" && <FilledSummary slot={slot} />}

      {slot.status === "closed" && (
        <div className="grid gap-3 px-5 py-4 text-sm text-ink-2">
          <p>Staff chose not to fill this time. It does not count against the fill rate.</p>
          <div>
            <Button size="sm" onClick={() => run((s, now) => releaseSlot(s, now, slot.id, staffName()))}>
              Reopen for filling
            </Button>
          </div>
        </div>
      )}

      {slot.status === "lost" && (
        <p className="px-5 py-4 text-sm text-ink-2">The start time passed before anyone accepted. This time counts as lost chair-time.</p>
      )}

      <SlotHistory slotId={slot.id} />
    </div>
  );
}

function FilledSummary({ slot }: { slot: Slot }) {
  const data = useData();
  const { market } = useNow();
  const openPhone = useDemo((s) => s.openPhone);
  const L = lookup(data);
  const appt = L.appointment(slot.filledAppointmentId);
  if (!appt) return null;
  const type = L.type(appt.typeId)!;
  const offer = data.offers.find((o) => o.slotId === slot.id && o.status === "accepted");
  return (
    <div className="px-5 py-4">
      <p className="text-sm">
        Booked <span className="font-semibold">{L.patient(appt.patientId)?.name}</span> for {type.name.toLowerCase()}, {clock(appt.startMin)}.
      </p>
      <dl className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-cf bg-rule">
        <div className="bg-restore-wash px-4 py-3">
          <dt className="text-xs text-restore">Chair-time recovered</dt>
          <dd className="num mt-1 text-xl font-medium text-restore">{appt.durationMin} min</dd>
        </div>
        <div className="bg-restore-wash px-4 py-3">
          <dt className="text-xs text-restore">Est. production</dt>
          <dd className="num mt-1 text-xl font-medium text-restore">{money(market, type.estProduction)}</dd>
          <dd className="text-[11px] text-restore">Estimate, demo data</dd>
        </div>
      </dl>
      {slot.durationMin > appt.durationMin && (
        <p className="mt-3 text-xs text-ink-3">The treatment uses {appt.durationMin} of the {slot.durationMin} freed minutes.</p>
      )}
      {offer && (
        <Button size="sm" variant="ghost" className="mt-3 -ml-3" onClick={() => openPhone(offer.id)}>
          View the message thread
        </Button>
      )}
    </div>
  );
}

function SlotHistory({ slotId }: { slotId: string }) {
  const data = useData();
  const { nowTs } = useNow();
  const [open, setOpen] = useState(false);
  const events = data.activity.filter((e) => e.slotId === slotId).sort((a, b) => b.at - a.at);
  if (events.length === 0) return null;
  return (
    <div className="border-t border-rule px-5 py-3">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex items-center gap-1.5 text-xs font-medium text-ink-2 hover:text-ink">
        <CaretDownIcon className={`size-3 transition-transform ${open ? "rotate-180" : ""}`} />
        Activity for this slot ({events.length})
      </button>
      {open && (
        <ol className="mt-2 grid gap-1.5">
          {events.map((e) => (
            <li key={e.id} className="grid grid-cols-[72px_1fr] gap-2 text-xs">
              <span className="num text-ink-3">{agoLabel(e.at, nowTs)}</span>
              <span className="text-ink-2">{e.text}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function ApptPanel({ apptId, onFocus, onClose }: { apptId: string; onFocus: (f: Focus) => void; onClose: () => void }) {
  const data = useData();
  const { local } = useNow();
  const run = useDemo((s) => s.run);
  const L = lookup(data);
  const appt = L.appointment(apptId)!;
  const [source, setSource] = useState<"patient_call" | "patient_message" | "clinic">("patient_call");
  const [note, setNote] = useState("");
  const patient = L.patient(appt.patientId)!;
  const type = L.type(appt.typeId)!;
  const canCancel = appt.status === "booked";

  function cancel() {
    const res = run((s, now) => cancelAppointment(s, now, appt.id, source, note.trim() || undefined));
    if (res && !res.error) {
      const slot = res.state.slots.find((sl) => sl.sourceAppointmentId === appt.id && sl.status === "open");
      if (slot) onFocus({ kind: "slot", id: slot.id });
    }
  }

  return (
    <div>
      <div className="film relative px-5 pb-5 pt-4">
        <div className="flex items-start justify-between">
          <p className="text-xs font-medium text-ink-2">{appt.status === "completed" ? "Completed appointment" : "Booked appointment"}</p>
          <button type="button" onClick={onClose} aria-label="Close panel" className="-mr-2 -mt-1 grid size-8 place-items-center rounded-cf text-ink-2 hover:bg-panel-2">
            <XIcon className="size-4" />
          </button>
        </div>
        <p className="mt-1 text-2xl font-semibold tracking-[-0.02em]">{patient.name}</p>
        <p className="mt-1 text-sm text-ink-2">
          {type.name}, <span className="capitalize">{relativeDay(appt.date, local.date)}</span> {timeRange(appt.startMin, appt.durationMin)}
        </p>
        <p className="text-sm text-ink-2">
          {L.chair(appt.chairId)?.label}, {L.provider(appt.providerId)?.name}
        </p>
      </div>
      {canCancel ? (
        <div className="grid gap-4 border-t border-rule px-5 py-4">
          <div>
            <h3 className="text-sm font-semibold">Record a cancellation</h3>
            <p className="mt-1 text-xs text-ink-2">ChairFill opens the freed time and ranks the waitlist for it straight away.</p>
          </div>
          <fieldset className="grid gap-1.5">
            <legend className="mb-1.5 text-xs font-medium text-ink-2">How did it come in?</legend>
            {(
              [
                ["patient_call", "Patient called"],
                ["patient_message", "Patient messaged"],
                ["clinic", "Clinic cancelled"],
              ] as const
            ).map(([v, label]) => (
              <label key={v} className="flex items-center gap-2 text-sm">
                <input type="radio" name="src" checked={source === v} onChange={() => setSource(v)} className="accent-[var(--ink)]" />
                {label}
              </label>
            ))}
          </fieldset>
          <label className="grid gap-1.5 text-xs font-medium text-ink-2">
            Note (optional, non-clinical)
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="For example: travelling"
              className="h-9 rounded-cf border border-rule-strong bg-surface px-2.5 text-sm text-ink outline-none placeholder:text-ink-3 focus:border-ink"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button variant="danger" onClick={cancel}>
              Cancel appointment
            </Button>
            <a href={`/appointments?appt=${appt.id}`} className="inline-flex h-10 items-center rounded-cf px-3 text-sm font-medium text-ink-2 hover:bg-panel-2 hover:text-ink">
              Reschedule
            </a>
          </div>
        </div>
      ) : (
        <p className="border-t border-rule px-5 py-4 text-sm text-ink-2">This appointment has already happened.</p>
      )}
    </div>
  );
}
