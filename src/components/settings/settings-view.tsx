"use client";

import { useMemo, useState } from "react";
import type { AppointmentType, CampaignMode, ClinicSettings, DayHours, DemoState, OtherFactor, Weekday } from "@/lib/domain/types";
import { WEEKDAY_LONG, clock } from "@/lib/domain/time";
import { draftOfferMessage, guardDraft, TEMPLATE_TOKENS } from "@/lib/ai/assistant";
import { channelName, DEFAULT_TEMPLATE } from "@/lib/demo/seed";
import { updateClinic, updateSettings } from "@/lib/demo/actions";
import { FACTOR_LABEL, normaliseWeights, type FactorKey } from "@/lib/matching/engine";
import { lookup } from "@/lib/demo/selectors";
import { useData, useDemo, useNow } from "@/lib/demo/store";
import { Button } from "@/components/ui/button";
import { Check, Field, FormError, INPUT, Segmented, TEXTAREA } from "@/components/ui/form";
import { PAGE_CLS, PageHeader, Panel } from "@/components/ui/page";

interface Draft {
  settings: ClinicSettings;
  hours: (DayHours | null)[];
  types: AppointmentType[];
}

const fromData = (d: DemoState): Draft => structuredClone({ settings: d.clinic.settings, hours: d.clinic.hours, types: d.clinic.appointmentTypes });

const WEEK_ORDER: Weekday[] = [1, 2, 3, 4, 5, 6, 0];
const FACTORS = Object.keys(FACTOR_LABEL) as FactorKey[];
const CHANNELS = ["whatsapp", "sms", "email"] as const;

const hhmm = (m: number) => (Number.isFinite(m) ? `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}` : "");
const parseTime = (s: string) => {
  const [h, m] = s.split(":").map(Number);
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : NaN;
};
const numValue = (n: number) => (Number.isFinite(n) ? n : "");
const parseNum = (s: string) => (s === "" ? NaN : Number(s));

function TimeInput({ label, value, onChange, disabled }: { label: string; value: number; onChange: (m: number) => void; disabled?: boolean }) {
  return (
    <input type="time" step={900} aria-label={label} value={hhmm(value)} disabled={disabled} onChange={(e) => onChange(parseTime(e.target.value))} className={`${INPUT} num !w-[9.25rem] !px-2`} />
  );
}

function validate(d: Draft, templateProblems: string[]): string | null {
  for (const wd of WEEK_ORDER) {
    const h = d.hours[wd];
    if (!h) continue;
    const name = WEEKDAY_LONG[wd];
    if (!Number.isFinite(h.open) || !Number.isFinite(h.close) || h.close <= h.open) return `${name}: closing time must be after opening time.`;
    if (h.breakStart !== undefined) {
      if (!Number.isFinite(h.breakStart) || !Number.isFinite(h.breakEnd) || h.breakEnd! <= h.breakStart) return `${name}: lunch must end after it starts.`;
      if (h.breakStart < h.open || h.breakEnd! > h.close) return `${name}: lunch must fall inside opening hours.`;
    }
  }
  if (!d.hours.some(Boolean)) return "Keep at least one day open.";
  for (const t of d.types) {
    if (!t.name.trim()) return "Every appointment type needs a name.";
    if (!Number.isFinite(t.durationMin) || t.durationMin < 5) return `${t.name}: duration must be at least 5 minutes.`;
    if (!Number.isFinite(t.estProduction) || t.estProduction < 0) return `${t.name}: list price must be zero or more.`;
  }
  const s = d.settings;
  if (!Number.isFinite(s.defaultBatchSize) || s.defaultBatchSize < 1) return "Batch size must be at least 1.";
  if (!Number.isFinite(s.maxOffersPerPatientPerWeek) || s.maxOffersPerPatientPerWeek < 1) return "Max offers per patient per week must be at least 1.";
  if (!Number.isFinite(s.minNoticeMin) || s.minNoticeMin < 0) return "Minimum notice cannot be negative.";
  if (!Number.isFinite(s.offerWindowMin) || s.offerWindowMin < 5) return "Offer window must be at least 5 minutes.";
  if (!CHANNELS.some((c) => s.channels[c])) return "Turn on at least one channel, or no offer can be sent.";
  if (s.otherFactor === "staff_priority" && !s.staffPriorityEnabled) return "Staff priority is chosen as the other factor but is not enabled.";
  if (templateProblems.length) return `Message template: ${templateProblems[0]}`;
  return null;
}

export function SettingsView() {
  const data = useData();
  const { local, market } = useNow();
  const run = useDemo((s) => s.run);
  const L = lookup(data);

  const [draft, setDraft] = useState<Draft>(() => fromData(data));
  const [error, setError] = useState<string | null>(null);

  const saved = useMemo(() => fromData(data), [data]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const clinicDirty = JSON.stringify({ h: draft.hours, t: draft.types }) !== JSON.stringify({ h: saved.hours, t: saved.types });

  const edit = (fn: (d: Draft) => void) => {
    setDraft((prev) => {
      const next = structuredClone(prev);
      fn(next);
      return next;
    });
    setError(null);
  };
  const setS = <K extends keyof ClinicSettings>(key: K, value: ClinicSettings[K]) => edit((d) => void (d.settings[key] = value));

  // Template check: render against a real slot, then run the same guard staff see before sending.
  const sample = useMemo(() => {
    const slot = data.slots.find((s) => s.status === "open" || s.status === "offering") ?? data.slots[0];
    const entry = data.waitlist.find((w) => w.status === "waiting") ?? data.waitlist[0];
    if (!slot || !entry) return null;
    const patient = data.patients.find((p) => p.id === entry.patientId);
    const type = data.clinic.appointmentTypes.find((t) => t.id === entry.typeId);
    return patient && type ? { slot, patient, type } : null;
  }, [data]);
  const preview = sample ? draftOfferMessage({ clinic: data.clinic, ...sample, today: local.date, template: draft.settings.messageTemplate }) : "";
  const guard = sample ? guardDraft(preview, sample.slot) : { ok: true, problems: [] as string[] };

  const weights = draft.settings.weights;
  const clean = normaliseWeights(weights);
  const total = FACTORS.reduce((s, k) => s + clean[k], 0);
  const allZero = FACTORS.every((k) => !(weights[k] > 0));

  function save() {
    const problem = validate(draft, guard.problems);
    if (problem) {
      setError(problem);
      return;
    }
    const res = run((s) => updateSettings(s, draft.settings));
    if (res?.error) {
      setError(res.error);
      return;
    }
    if (clinicDirty) run((s) => updateClinic(s, { hours: draft.hours, appointmentTypes: draft.types }));
    setDraft(fromData(useDemo.getState().data!));
  }

  return (
    <div className={PAGE_CLS}>
      <PageHeader title="Settings" description={`How ${data.clinic.name} is set up, who ChairFill may offer slots to, and how matches are scored.`} />

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-2">
        <div className="grid grid-cols-1 gap-5">
          <Panel title="Opening hours" caption="Clinic time, India Standard Time">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-rule px-4 py-2">
              <Button
                size="sm"
                variant="ghost"
                disabled={!draft.hours[1]}
                onClick={() =>
                  edit((d) => {
                    for (const wd of [2, 3, 4, 5, 6] as Weekday[]) d.hours[wd] = d.hours[1] ? structuredClone(d.hours[1]) : null;
                  })
                }
              >
                Copy Monday to Tuesday to Saturday
              </Button>
              <span className="text-xs text-ink-3">Then change any day that differs.</span>
            </div>
            <ul className="divide-y divide-rule">
              {WEEK_ORDER.map((wd) => {
                const h = draft.hours[wd];
                return (
                  <li key={wd} className="grid grid-cols-1 gap-x-4 gap-y-2 px-4 py-3 sm:grid-cols-[6.5rem_minmax(0,1fr)] sm:items-center">
                    <Check
                      checked={Boolean(h)}
                      onChange={(on) => edit((d) => void (d.hours[wd] = on ? { open: 9 * 60, close: 18 * 60 } : null))}
                    >
                      <span className="font-medium">{WEEKDAY_LONG[wd]}</span>
                    </Check>
                    {h ? (
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                        <span className="flex flex-wrap items-center gap-2 text-xs text-ink-2">
                          <TimeInput label={`${WEEKDAY_LONG[wd]} opens`} value={h.open} onChange={(m) => edit((d) => void (d.hours[wd]!.open = m))} />
                          to
                          <TimeInput label={`${WEEKDAY_LONG[wd]} closes`} value={h.close} onChange={(m) => edit((d) => void (d.hours[wd]!.close = m))} />
                        </span>
                        <span className="flex flex-wrap items-center gap-2 text-xs text-ink-2">
                          <Check
                            checked={h.breakStart !== undefined}
                            onChange={(on) =>
                              edit((d) => {
                                const hh = d.hours[wd]!;
                                if (on) {
                                  hh.breakStart = 13 * 60;
                                  hh.breakEnd = 14 * 60;
                                } else {
                                  delete hh.breakStart;
                                  delete hh.breakEnd;
                                }
                              })
                            }
                          >
                            <span className="text-xs">Lunch</span>
                          </Check>
                          {h.breakStart !== undefined && (
                            <>
                              <TimeInput label={`${WEEKDAY_LONG[wd]} lunch starts`} value={h.breakStart} onChange={(m) => edit((d) => void (d.hours[wd]!.breakStart = m))} />
                              to
                              <TimeInput label={`${WEEKDAY_LONG[wd]} lunch ends`} value={h.breakEnd!} onChange={(m) => edit((d) => void (d.hours[wd]!.breakEnd = m))} />
                            </>
                          )}
                        </span>
                      </div>
                    ) : (
                      <p className="text-xs text-ink-3">Closed</p>
                    )}
                  </li>
                );
              })}
            </ul>
            <p className="border-t border-rule px-4 py-2.5 text-xs text-ink-3">Changing hours does not move existing appointments. HSR Layout stays closed on Sundays in the demo book.</p>
          </Panel>

          <Panel title="Appointment types" caption={`Duration and list price (${market.currency}). Prices are only used for estimates.`}>
            <div className="hidden grid-cols-[minmax(0,1fr)_7rem_8rem] gap-x-3 border-b border-rule px-4 py-2 text-xs text-ink-3 sm:grid">
              <span>Treatment</span>
              <span>Duration (min)</span>
              <span>List price</span>
            </div>
            <ul className="divide-y divide-rule">
              {draft.types.map((t, i) => (
                <li key={t.id} className="grid grid-cols-2 gap-x-3 gap-y-2 px-4 py-2.5 sm:grid-cols-[minmax(0,1fr)_7rem_8rem] sm:items-center">
                  <input aria-label={`Name of ${t.name}`} value={t.name} onChange={(e) => edit((d) => void (d.types[i].name = e.target.value))} className={`${INPUT} col-span-2 sm:col-span-1`} />
                  <label className="grid gap-1 text-[11px] text-ink-3 sm:block">
                    <span className="sm:sr-only">Duration (min)</span>
                    <input
                      aria-label={`Duration of ${t.name} in minutes`}
                      type="number"
                      min={5}
                      step={5}
                      value={numValue(t.durationMin)}
                      onChange={(e) => edit((d) => void (d.types[i].durationMin = parseNum(e.target.value)))}
                      className={`${INPUT} num`}
                    />
                  </label>
                  <label className="grid gap-1 text-[11px] text-ink-3 sm:block">
                    <span className="sm:sr-only">List price ({market.currency})</span>
                    <input
                      aria-label={`List price of ${t.name}`}
                      type="number"
                      min={0}
                      step={100}
                      value={numValue(t.estProduction)}
                      onChange={(e) => edit((d) => void (d.types[i].estProduction = parseNum(e.target.value)))}
                      className={`${INPUT} num`}
                    />
                  </label>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Dentists and chairs" caption="Read only in the demo">
            <ul className="divide-y divide-rule">
              {data.clinic.providers.map((p) => (
                <li key={p.id} className="grid grid-cols-1 gap-x-4 px-4 py-2.5 text-sm sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                  <p>
                    <span className="font-medium">{p.name}</span>
                    <span className="block text-xs text-ink-3">{p.roleLabel}</span>
                  </p>
                  <p className="text-xs text-ink-2">
                    {data.clinic.chairs.filter((c) => c.providerId === p.id).map((c) => `${c.label}, ${L.location(c.locationId)?.name}`).join("; ") || "No default chair"}
                    <span className="block text-ink-3">Works at {p.locationIds.map((id) => L.location(id)?.name).join(" and ")}</span>
                  </p>
                </li>
              ))}
            </ul>
            <p className="border-t border-rule px-4 py-2.5 text-xs text-ink-3">
              Patients state a dentist preference on the waitlist. It is scored by the Dentist weight in the match weights, and an offer never goes to a dentist whose role cannot perform the treatment.
            </p>
          </Panel>

          <Panel title="Cancellation policy">
            <div className="px-4 py-4">
              <Field label="Policy text" hint="Shown to staff when recording a cancellation. Not sent to patients in the demo.">
                <textarea rows={3} value={draft.settings.cancellationPolicy} onChange={(e) => setS("cancellationPolicy", e.target.value)} className={TEXTAREA} />
              </Field>
            </div>
          </Panel>
        </div>

        <div className="grid grid-cols-1 gap-5">
          <Panel title="Waitlist rules">
            <div className="grid grid-cols-1 items-start gap-4 px-4 py-4 sm:grid-cols-3">
              <Field label="Patients per offer batch" hint="How many top matches are pre-selected.">
                <input type="number" min={1} step={1} value={numValue(draft.settings.defaultBatchSize)} onChange={(e) => setS("defaultBatchSize", parseNum(e.target.value))} className={`${INPUT} num`} />
              </Field>
              <Field label="Max offers a week" hint="Per patient. Stops one person being messaged repeatedly.">
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={numValue(draft.settings.maxOffersPerPatientPerWeek)}
                  onChange={(e) => setS("maxOffersPerPatientPerWeek", parseNum(e.target.value))}
                  className={`${INPUT} num`}
                />
              </Field>
              <Field label="Minimum notice (minutes)" hint="Slots starting sooner are not offered.">
                <input type="number" min={0} step={15} value={numValue(draft.settings.minNoticeMin)} onChange={(e) => setS("minNoticeMin", parseNum(e.target.value))} className={`${INPUT} num`} />
              </Field>
            </div>
            <div className="border-t border-rule px-4 py-4">
              <Segmented<CampaignMode>
                legend="Default way to offer"
                name="mode"
                value={draft.settings.defaultMode}
                onChange={(v) => setS("defaultMode", v)}
                options={[
                  { value: "simultaneous", label: "All at once", sub: "First to accept gets it" },
                  { value: "cascade", label: "One at a time", sub: "In ranked order" },
                ]}
              />
            </div>
          </Panel>

          <Panel title="Match weights" caption="Relative numbers. They need not add up to 100.">
            <div className="grid grid-cols-1 gap-4 px-4 py-4 sm:grid-cols-2">
              {FACTORS.map((k) => (
                <Field key={k} label={FACTOR_LABEL[k]} hint={total > 0 ? <><span className="num">{Math.round((clean[k] / total) * 100)}%</span> of the score</> : "No share"}>
                  <input
                    type="number"
                    min={0}
                    step={5}
                    value={numValue(weights[k])}
                    onChange={(e) => edit((d) => void (d.settings.weights[k] = parseNum(e.target.value)))}
                    className={`${INPUT} num`}
                  />
                </Field>
              ))}
            </div>
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-t border-rule px-4 py-2.5 text-sm">
              <span className="font-medium">Total weight</span>
              <span className="num" aria-live="polite">
                {total}
              </span>
            </div>
            {allZero && <p className="border-t border-rule bg-amber-wash px-4 py-2.5 text-xs text-amber-ink">Every weight is zero, so the default weights will be restored when you save.</p>}
            <div className="border-t border-rule px-4 py-4">
              <Segmented<OtherFactor>
                legend="What the other factor counts"
                name="other"
                value={draft.settings.otherFactor}
                onChange={(v) => setS("otherFactor", v)}
                options={[
                  { value: "waitlist_seniority", label: "Time on the list", sub: "Up to 30 days" },
                  { value: "staff_priority", label: "Staff priority", sub: draft.settings.staffPriorityEnabled ? "Set by staff" : "Enable below first", disabled: !draft.settings.staffPriorityEnabled },
                  { value: "none", label: "Not used", sub: "Weight ignored" },
                ]}
              />
              <p className="mt-2 text-[11px] text-ink-3">ChairFill never ranks by clinical urgency. Every score shows its factors on Today.</p>
            </div>
          </Panel>

          <Panel title="Staff priority">
            <div className="grid gap-3 px-4 py-4">
              <Check
                checked={draft.settings.staffPriorityEnabled}
                onChange={(on) =>
                  edit((d) => {
                    d.settings.staffPriorityEnabled = on;
                    if (!on && d.settings.otherFactor === "staff_priority") d.settings.otherFactor = "waitlist_seniority";
                  })
                }
              >
                Allow staff to set a priority on waitlist entries
              </Check>
              <p className="text-xs leading-relaxed text-ink-2">
                This must be switched on by qualified clinic staff. Priority is an administrative flag a person sets and explains in a note. ChairFill does not decide who is more urgent, and the
                priority only counts when it is chosen as the other factor above.
              </p>
            </div>
          </Panel>

          <Panel title="Channels and quiet hours">
            <div className="grid gap-4 px-4 py-4">
              <fieldset>
                <legend className="text-xs font-medium text-ink-2">Channels offers may use</legend>
                <div className="mt-1.5 flex flex-wrap gap-x-5 gap-y-1.5">
                  {CHANNELS.map((c) => (
                    <Check key={c} checked={draft.settings.channels[c]} onChange={(on) => edit((d) => void (d.settings.channels[c] = on))}>
                      {channelName(c)}
                    </Check>
                  ))}
                </div>
                <p className="mt-1.5 text-[11px] text-ink-3">
                  An offer only goes to a channel the patient has agreed to. Rules to meet in production for {market.label}: {market.messagingRules}. Messages in this demo are simulated.
                </p>
              </fieldset>
              <div>
                <p className="text-xs font-medium text-ink-2">Quiet hours</p>
                <p className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-ink-2">
                  No offers between
                  <TimeInput label="Quiet hours start" value={draft.settings.quietHours.start} onChange={(m) => edit((d) => void (d.settings.quietHours.start = m))} />
                  and
                  <TimeInput label="Quiet hours end" value={draft.settings.quietHours.end} onChange={(m) => edit((d) => void (d.settings.quietHours.end = m))} />
                </p>
                <p className="mt-1 text-[11px] text-ink-3">Staff see a warning in the composer inside this window. A production build would hold the message until morning.</p>
              </div>
            </div>
          </Panel>

          <Panel title="Offers">
            <div className="grid gap-4 px-4 py-4">
              <Field label="Offer window (minutes to reply)" hint="At least 5. After this the offer lapses and the next patient is asked, in one-at-a-time mode.">
                <input type="number" min={5} step={5} value={numValue(draft.settings.offerWindowMin)} onChange={(e) => setS("offerWindowMin", parseNum(e.target.value))} className={`${INPUT} num sm:!w-32`} />
              </Field>
              <Segmented<"auto" | "confirm">
                legend="When a patient accepts"
                name="autobook"
                value={draft.settings.autoBookOnAccept ? "auto" : "confirm"}
                onChange={(v) => setS("autoBookOnAccept", v === "auto")}
                options={[
                  { value: "auto", label: "Book straight away", sub: "The slot fills on accept" },
                  { value: "confirm", label: "Staff confirm first", sub: "Slot is held until you confirm" },
                ]}
              />
              <div>
                <div className="flex items-center justify-between gap-3">
                  <label htmlFor="template" className="text-xs font-medium text-ink-2">
                    Message template
                  </label>
                  <button type="button" onClick={() => setS("messageTemplate", DEFAULT_TEMPLATE)} className="text-xs font-medium text-ink-2 hover:text-ink">
                    Restore default
                  </button>
                </div>
                <textarea id="template" rows={4} value={draft.settings.messageTemplate} onChange={(e) => setS("messageTemplate", e.target.value)} className={`${TEXTAREA} mt-1.5`} />
                <p className="mt-1 text-[11px] leading-relaxed text-ink-3">Fields fill from the slot: {TEMPLATE_TOKENS.join(" ")}. Staff approve every message before it is sent.</p>
                {sample && (
                  <div className="mt-3 rounded-cf bg-panel p-3">
                    <p className="text-xs font-medium text-ink-2">
                      Preview for {sample.patient.name}, {clock(sample.slot.startMin)} slot
                    </p>
                    <p className="mt-1.5 text-sm leading-relaxed">{preview}</p>
                  </div>
                )}
                {!guard.ok && (
                  <ul role="alert" className="mt-3 grid gap-1 rounded-cf bg-danger-wash p-3 text-xs text-danger">
                    {guard.problems.map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                )}
                {guard.ok && <p className="mt-2 text-xs text-ink-3">Passes the check for clinical language and invented times.</p>}
              </div>
            </div>
          </Panel>
        </div>
      </div>

      <div className="sticky bottom-0 z-20 -mx-4 grid gap-2 border-t border-rule bg-surface px-4 py-3 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        {error && <FormError>{error}</FormError>}
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="primary" onClick={save} disabled={!dirty}>
            Save settings
          </Button>
          <Button
            variant="ghost"
            disabled={!dirty}
            onClick={() => {
              setDraft(fromData(data));
              setError(null);
            }}
          >
            Discard changes
          </Button>
          <span className="text-xs text-ink-3" aria-live="polite">
            {dirty ? "You have unsaved changes." : "All changes saved."}
          </span>
        </div>
      </div>
    </div>
  );
}
