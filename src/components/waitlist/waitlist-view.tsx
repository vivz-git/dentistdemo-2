"use client";

import { Fragment, useState, useSyncExternalStore } from "react";
import { PlusIcon, ProhibitIcon } from "@phosphor-icons/react";
import type { Channel, Patient, TimeBand, WaitlistEntry, WaitlistStatus, Weekday } from "@/lib/domain/types";
import { BAND_LABEL, WEEKDAY_SHORT, agoLabel, shortDate } from "@/lib/domain/time";
import { summarisePreferences } from "@/lib/ai/assistant";
import { newId, upsertWaitlistEntry } from "@/lib/demo/actions";
import { channelName } from "@/lib/demo/seed";
import { lookup } from "@/lib/demo/selectors";
import { useData, useDemo, useNow } from "@/lib/demo/store";
import { Button } from "@/components/ui/button";
import { Chip, type ChipTone } from "@/components/ui/chip";
import { Check, Field, FormError, INPUT, Segmented, TEXTAREA } from "@/components/ui/form";
import { EmptyState, PAGE_CLS, PageHeader, Panel } from "@/components/ui/page";
import { ChannelIcon } from "@/components/today/candidates";
import { staffName } from "@/components/today/live-offers";

type View = "active" | "history";

const WEEK_ORDER: Weekday[] = [1, 2, 3, 4, 5, 6, 0];
const BANDS: TimeBand[] = ["morning", "afternoon", "evening"];

const STATUS: Record<WaitlistStatus, { tone: ChipTone; label: string }> = {
  waiting: { tone: "queued", label: "Waiting" },
  offered: { tone: "live", label: "Offer out" },
  paused: { tone: "settled", label: "Paused" },
  booked: { tone: "muted", label: "Closed" },
};

/** True from the md breakpoint up. Lets us mount one layout at a time, so a form never exists twice. */
function useWide() {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia("(min-width: 768px)");
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    () => window.matchMedia("(min-width: 768px)").matches,
    () => true,
  );
}

export function WaitlistView() {
  const wide = useWide();
  const data = useData();
  const { nowTs } = useNow();
  const [view, setView] = useState<View>("active");
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const L = lookup(data);

  const active = data.waitlist.filter((w) => w.status !== "booked").sort((a, b) => a.addedAt - b.addedAt);
  const history = data.waitlist.filter((w) => w.status === "booked").sort((a, b) => (b.lastContactAt ?? b.addedAt) - (a.lastContactAt ?? a.addedAt));
  const list = view === "active" ? active : history;
  const showPriority = data.clinic.settings.staffPriorityEnabled;

  const recoveredFor = (patientId: string) => data.appointments.some((a) => a.patientId === patientId && a.fromSlotId);

  return (
    <div className={PAGE_CLS}>
      <PageHeader
        title="Waitlist"
        description="Patients who asked for an earlier appointment. ChairFill ranks them against every freed slot; staff choose who gets an offer."
        actions={
          <Button variant="primary" onClick={() => setEditing("new")} disabled={editing === "new"}>
            <PlusIcon className="size-4" /> Add to waitlist
          </Button>
        }
      />

      {editing === "new" && (
        <Panel title="Add to the waitlist">
          <div className="px-4 py-4">
            <EntryForm key="new" entry={null} onDone={() => setEditing(null)} />
          </div>
        </Panel>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="Waitlist view" className="flex gap-1">
          {(
            [
              ["active", "Active", active.length],
              ["history", "Booked history", history.length],
            ] as const
          ).map(([v, label, n]) => (
            <button
              key={v}
              role="tab"
              aria-selected={view === v}
              onClick={() => {
                setView(v);
                setEditing(null);
              }}
              className={`flex h-9 items-center gap-2 rounded-cf px-3 text-sm transition-colors ${view === v ? "bg-ink text-d8" : "text-ink-2 hover:bg-panel-2 hover:text-ink"}`}
            >
              <span className="font-medium">{label}</span>
              <span className={`num text-xs ${view === v ? "text-d7" : "text-ink-3"}`}>{n}</span>
            </button>
          ))}
        </div>
        <p className="text-xs text-ink-3">Ordered by time on the list, longest first.{view === "history" ? " History shows who has already been booked or has left the list." : ""}</p>
      </div>

      <Panel title={view === "active" ? "Active waitlist" : "Booked history"} caption="Preferences are what the patient told the clinic. Demo data.">
        {list.length === 0 ? (
          <EmptyState title="No one here yet.">Add a patient to the waitlist and they will appear in the ranking for the next freed slot.</EmptyState>
        ) : (
          !wide ? (
          <ul className="divide-y divide-rule">
            {list.map((w) => {
              const patient = L.patient(w.patientId)!;
              const type = L.type(w.typeId)!;
              const st = w.status === "booked" && recoveredFor(w.patientId) ? { tone: "recovered" as const, label: "Booked" } : STATUS[w.status];
              const isEditing = editing === w.id;
              return (
                <li key={w.id} className={isEditing ? "bg-panel/70" : ""}>
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 px-4 py-3">
                    <p className="min-w-0 truncate text-sm font-semibold">{patient.name}</p>
                    <Chip tone={st.tone}>{st.label}</Chip>
                    <p className="col-span-2 text-xs text-ink-2">{summarisePreferences(w, data.clinic, type)}</p>
                    <p className="col-span-2 text-xs text-ink-3">
                      Available from {shortDate(w.availableFrom)}. Added {agoLabel(w.addedAt, nowTs)}.{" "}
                      {w.lastContactAt ? (
                        <>
                          Last contact <span className="num">{agoLabel(w.lastContactAt, nowTs)}</span>.
                        </>
                      ) : (
                        "Not contacted."
                      )}
                    </p>
                    <div className="col-span-2 mt-1 flex items-end justify-between gap-3">
                      <Consent patient={patient} />
                      {view === "active" && (
                        <Button size="sm" variant="secondary" onClick={() => setEditing(isEditing ? null : w.id)} aria-expanded={isEditing} aria-label={`${isEditing ? "Close" : "Edit"} ${patient.name}`}>
                          {isEditing ? "Close" : "Edit"}
                        </Button>
                      )}
                    </div>
                  </div>
                  {isEditing && (
                    <div className="border-t border-rule px-4 py-4">
                      <EntryForm key={w.id} entry={w} onDone={() => setEditing(null)} />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          ) : (
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[1040px] text-left text-sm">
              <caption className="sr-only">{view === "active" ? "Active waitlist entries" : "Waitlist entries that are closed or booked"}</caption>
              <thead>
                <tr className="border-b border-rule text-xs text-ink-3">
                  <th scope="col" className="px-4 py-2 font-normal">Patient</th>
                  <th scope="col" className="px-2 py-2 font-normal">Appointment type</th>
                  <th scope="col" className="px-2 py-2 font-normal">Preferred dentist</th>
                  <th scope="col" className="px-2 py-2 font-normal">Preferred days</th>
                  <th scope="col" className="px-2 py-2 font-normal">Preferred time</th>
                  <th scope="col" className="px-2 py-2 font-normal">Available from</th>
                  <th scope="col" className="px-2 py-2 font-normal">Status</th>
                  <th scope="col" className="px-2 py-2 font-normal">Last contact</th>
                  <th scope="col" className="px-4 py-2 font-normal">Consent and contact</th>
                </tr>
              </thead>
              <tbody>
                {list.map((w) => {
                  const patient = L.patient(w.patientId)!;
                  const type = L.type(w.typeId)!;
                  const provider = w.preferredProviderId ? L.provider(w.preferredProviderId) : undefined;
                  const st = w.status === "booked" && recoveredFor(w.patientId) ? { tone: "recovered" as const, label: "Booked" } : STATUS[w.status];
                  const isEditing = editing === w.id;
                  return (
                    <Fragment key={w.id}>
                      <tr className={`border-b border-rule align-top ${isEditing ? "bg-panel/70" : ""}`}>
                        <td className="px-4 py-3">
                          <p className="font-semibold">{patient.name}</p>
                          <p className="text-xs text-ink-3">Added {agoLabel(w.addedAt, nowTs)}</p>
                          {showPriority && w.staffPriority && <p className="mt-0.5 text-xs text-ink-2">Staff priority: {w.staffPriority.note}</p>}
                          {view === "active" && (
                            <Button size="sm" variant="secondary" className="mt-2" onClick={() => setEditing(isEditing ? null : w.id)} aria-expanded={isEditing} aria-label={`${isEditing ? "Close" : "Edit"} ${patient.name}`}>
                              {isEditing ? "Close" : "Edit"}
                            </Button>
                          )}
                        </td>
                        <td className="px-2 py-3">
                          <p>{type.name}</p>
                          <p className="num text-xs text-ink-3">{type.durationMin} min</p>
                        </td>
                        <td className="px-2 py-3 text-ink-2">{provider ? provider.shortName : "No preference"}</td>
                        <td className="px-2 py-3 text-ink-2">{w.preferredDays.length ? WEEK_ORDER.filter((d) => w.preferredDays.includes(d)).map((d) => WEEKDAY_SHORT[d]).join(", ") : "Any day"}</td>
                        <td className="px-2 py-3 text-ink-2">{w.preferredTimes.length ? BANDS.filter((b) => w.preferredTimes.includes(b)).map((b) => BAND_LABEL[b]).join(", ") : "Any time"}</td>
                        <td className="px-2 py-3 text-ink-2">{shortDate(w.availableFrom)}</td>
                        <td className="px-2 py-3">
                          <Chip tone={st.tone}>{st.label}</Chip>
                        </td>
                        <td className="px-2 py-3 text-ink-2">{w.lastContactAt ? <span className="num text-xs">{agoLabel(w.lastContactAt, nowTs)}</span> : "Not contacted"}</td>
                        <td className="px-4 py-3">
                          <Consent patient={patient} />
                        </td>
                      </tr>
                      {isEditing && (
                        <tr className="border-b border-rule bg-panel/70">
                          <td colSpan={9} className="px-4 py-4">
                            <div className="max-w-4xl">
                              <EntryForm key={w.id} entry={w} onDone={() => setEditing(null)} />
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          )
        )}
      </Panel>
    </div>
  );
}

/** Consent comes from the patient's record. Channel icons plus text, so it reads without colour. */
function Consent({ patient }: { patient: Patient }) {
  const channels = (["whatsapp", "sms", "email"] as Channel[]).filter((c) => patient.consent[c]);
  if (channels.length === 0) {
    return (
      <p className="flex items-center gap-1.5 text-xs text-ink-2">
        <ProhibitIcon className="size-3.5 flex-none text-ink-3" /> No consent on file. Call only.
      </p>
    );
  }
  const preferred = patient.consent[patient.preferredChannel] ? patient.preferredChannel : channels[0];
  return (
    <div>
      <p className="flex items-center gap-1.5 text-xs text-ink-2">
        {channels.map((c) => (
          <ChannelIcon key={c} channel={c} className="size-3.5 flex-none" />
        ))}
        <span>{channels.map(channelName).join(", ")}</span>
      </p>
      <p className="mt-0.5 text-xs text-ink-3">Prefers {channelName(preferred)}</p>
    </div>
  );
}

function EntryForm({ entry, onDone }: { entry: WaitlistEntry | null; onDone: () => void }) {
  const data = useData();
  const { local, nowTs } = useNow();
  const run = useDemo((s) => s.run);
  const L = lookup(data);
  const settings = data.clinic.settings;

  const [patientName, setPatientName] = useState(entry ? (L.patient(entry.patientId)?.name ?? "") : "");
  const [typeId, setTypeId] = useState(entry?.typeId ?? data.clinic.appointmentTypes[0].id);
  const [providerId, setProviderId] = useState(entry?.preferredProviderId ?? "");
  const [locationId, setLocationId] = useState(entry?.preferredLocationId ?? "");
  const [days, setDays] = useState<Weekday[]>(entry?.preferredDays ?? []);
  const [times, setTimes] = useState<TimeBand[]>(entry?.preferredTimes ?? []);
  const [availableFrom, setAvailableFrom] = useState(entry?.availableFrom ?? local.date);
  const [noticeHours, setNoticeHours] = useState(entry?.noticeHours ?? 4);
  const [status, setStatus] = useState<WaitlistStatus>(entry?.status ?? "waiting");
  const [notes, setNotes] = useState(entry?.patientNotes ?? "");
  const [priority, setPriority] = useState(Boolean(entry?.staffPriority));
  const [priorityNote, setPriorityNote] = useState(entry?.staffPriority?.note ?? "");
  const [error, setError] = useState<string | null>(null);

  const patient = data.patients.find((p) => p.name.toLowerCase() === patientName.trim().toLowerCase());
  const type = L.type(typeId)!;
  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const locked = entry?.status === "offered";

  function build(): WaitlistEntry | string {
    if (!patient) return "Choose a patient from the list. Patients come from the clinic's patient records.";
    if (!entry && data.waitlist.some((w) => w.patientId === patient.id && w.typeId === typeId && (w.status === "waiting" || w.status === "offered" || w.status === "paused"))) {
      return `${patient.name} is already on the waitlist for ${type.name.toLowerCase()}.`;
    }
    if (!Number.isFinite(noticeHours) || noticeHours < 0) return "Notice must be zero hours or more.";
    if (!availableFrom) return "Add the first date the patient can attend.";
    const showPriority = settings.staffPriorityEnabled;
    if (showPriority && priority && !priorityNote.trim()) return "Add a short administrative note for the staff priority.";
    return {
      id: entry?.id ?? newId("wl"),
      patientId: patient.id,
      typeId,
      preferredProviderId: providerId || null,
      preferredLocationId: locationId || null,
      preferredDays: WEEK_ORDER.filter((d) => days.includes(d)),
      preferredTimes: BANDS.filter((b) => times.includes(b)),
      availableFrom,
      noticeHours,
      status: locked ? entry!.status : status,
      addedAt: entry?.addedAt ?? nowTs,
      lastContactAt: entry?.lastContactAt ?? null,
      patientNotes: notes.trim(),
      staffPriority: showPriority ? (priority ? { setBy: staffName(), note: priorityNote.trim() } : undefined) : entry?.staffPriority,
    };
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const built = build();
    if (typeof built === "string") {
      setError(built);
      return;
    }
    const res = run((s) => upsertWaitlistEntry(s, built));
    if (res?.error) setError(res.error);
    else onDone();
  }

  const preview = patient ? summarisePreferences({ ...(entry ?? ({} as WaitlistEntry)), typeId, preferredProviderId: providerId || null, preferredLocationId: locationId || null, preferredDays: days, preferredTimes: times, noticeHours }, data.clinic, type) : null;
  const sortedPatients = [...data.patients].sort((a, b) => a.name.localeCompare(b.name));
  const listId = `patients-${entry?.id ?? "new"}`;

  return (
    <form onSubmit={submit} className="grid grid-cols-1 gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Patient" className="lg:col-span-2" hint={patient ? `Contact: ${patient.phone}` : "Start typing a name from the patient records."}>
          <input
            list={listId}
            value={patientName}
            onChange={(e) => {
              setPatientName(e.target.value);
              setError(null);
            }}
            disabled={Boolean(entry)}
            required
            autoComplete="off"
            className={INPUT}
          />
          <datalist id={listId}>
            {sortedPatients.map((p) => (
              <option key={p.id} value={p.name} />
            ))}
          </datalist>
        </Field>
        <Field label="Appointment type" className="lg:col-span-2">
          <select value={typeId} onChange={(e) => setTypeId(e.target.value)} className={INPUT}>
            {data.clinic.appointmentTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}, {t.durationMin} min
              </option>
            ))}
          </select>
        </Field>
        <Field label="Preferred dentist">
          <select value={providerId} onChange={(e) => setProviderId(e.target.value)} className={INPUT}>
            <option value="">No preference</option>
            {data.clinic.providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Preferred branch">
          <select value={locationId} onChange={(e) => setLocationId(e.target.value)} className={INPUT}>
            <option value="">Either branch</option>
            {data.clinic.locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Available from">
          <input type="date" value={availableFrom} onChange={(e) => setAvailableFrom(e.target.value)} className={INPUT} />
        </Field>
        <Field label="Notice needed (hours)">
          <input
            type="number"
            min={0}
            step={1}
            value={Number.isFinite(noticeHours) ? noticeHours : ""}
            onChange={(e) => setNoticeHours(e.target.value === "" ? NaN : Number(e.target.value))}
            className={`${INPUT} num`}
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <fieldset>
          <legend className="text-xs font-medium text-ink-2">Preferred days</legend>
          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1.5">
            {WEEK_ORDER.map((d) => (
              <Check key={d} checked={days.includes(d)} onChange={() => setDays(toggle(days, d))}>
                {WEEKDAY_SHORT[d]}
              </Check>
            ))}
          </div>
          <p className="mt-1 text-[11px] text-ink-3">Leave all unticked for any day.</p>
        </fieldset>
        <fieldset>
          <legend className="text-xs font-medium text-ink-2">Preferred time</legend>
          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1.5">
            {BANDS.map((b) => (
              <Check key={b} checked={times.includes(b)} onChange={() => setTimes(toggle(times, b))}>
                {BAND_LABEL[b]}
              </Check>
            ))}
          </div>
          <p className="mt-1 text-[11px] text-ink-3">Leave all unticked for any time.</p>
        </fieldset>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Notes from the patient (non-clinical)">
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={TEXTAREA} placeholder="For example: prefers WhatsApp, school run after 11 am" />
        </Field>
        {entry && !locked ? (
          <Segmented
            legend="Status"
            name={`status-${entry.id}`}
            value={status === "paused" ? "paused" : "waiting"}
            onChange={(v) => setStatus(v)}
            options={[
              { value: "waiting", label: "Waiting", sub: "Eligible for offers" },
              { value: "paused", label: "Paused", sub: "Skipped until resumed" },
            ]}
          />
        ) : (
          <p className="self-end text-xs text-ink-3">{locked ? "An offer is out for this patient, so the status cannot be changed until it resolves." : "New entries start as waiting."}</p>
        )}
      </div>

      {settings.staffPriorityEnabled && (
        <div className="grid grid-cols-1 gap-3 rounded-cf bg-surface p-3 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-start">
          <div>
            <Check checked={priority} onChange={setPriority}>
              Staff priority
            </Check>
            <p className="mt-1 max-w-[16rem] text-[11px] leading-relaxed text-ink-3">Set by qualified clinic staff. Counts only when the clinic uses it as the other factor in Settings.</p>
          </div>
          <Field label="Administrative note">
            <input value={priorityNote} onChange={(e) => setPriorityNote(e.target.value)} disabled={!priority} placeholder="For example: clinic lead asked for this patient to be seen first" className={INPUT} />
          </Field>
        </div>
      )}

      <p className="text-xs text-ink-2">
        <span className="font-medium text-ink">Stated preferences: </span>
        {preview ?? "Choose a patient to see the summary."}
        {preview ? "." : ""}
      </p>
      <p className="text-[11px] text-ink-3">Messaging consent is held on the patient&apos;s record and is not edited here. Offers only go to channels the patient has agreed to.</p>

      {error && <FormError>{error}</FormError>}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="primary">
          {entry ? "Save changes" : "Add to waitlist"}
        </Button>
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
