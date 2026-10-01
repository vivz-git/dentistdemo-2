"use client";

import { useState } from "react";
import { CaretDownIcon, ChatCircleTextIcon, EnvelopeSimpleIcon, WhatsappLogoIcon, ProhibitIcon } from "@phosphor-icons/react";
import type { Channel } from "@/lib/domain/types";
import type { Exclusion, FactorResult, MatchResult } from "@/lib/matching/engine";
import { durationLabel } from "@/lib/domain/time";
import { summarisePreferences } from "@/lib/ai/assistant";
import { pickChannel } from "@/lib/demo/actions";
import { useData } from "@/lib/demo/store";
import { Button } from "@/components/ui/button";

export function ChannelIcon({ channel, className = "size-3.5" }: { channel: Channel; className?: string }) {
  const Icon = channel === "whatsapp" ? WhatsappLogoIcon : channel === "sms" ? ChatCircleTextIcon : EnvelopeSimpleIcon;
  return <Icon className={className} aria-label={channel === "whatsapp" ? "WhatsApp" : channel === "sms" ? "SMS" : "Email"} />;
}

/** Six density cells, one per factor. Darker means a stronger fit, like denser film. */
function FitCells({ factors }: { factors: FactorResult[] }) {
  const used = factors.filter((f) => f.weight > 0);
  return (
    <span className="flex gap-[3px]" aria-hidden="true">
      {used.map((f) => (
        <span
          key={f.key}
          className={`h-3 w-2 rounded-[1px] ${f.fit === "full" ? "bg-ink" : f.fit === "partial" ? "bg-d4" : "bg-surface shadow-[inset_0_0_0_1px_var(--rule-strong)]"}`}
        />
      ))}
    </span>
  );
}

export function CandidateList({
  ranked,
  excluded,
  selected,
  onToggle,
  onBookDirect,
}: {
  ranked: MatchResult[];
  excluded: Exclusion[];
  selected: string[];
  onToggle: (entryId: string) => void;
  onBookDirect: (entryId: string) => void;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const [showExcluded, setShowExcluded] = useState(false);
  const data = useData();

  if (ranked.length === 0) {
    return (
      <div className="px-5 py-6 text-sm text-ink-2">
        <p className="font-medium text-ink">No eligible waitlist patients for this slot.</p>
        <p className="mt-1">Reserve it for a walk-in or phone booking, or add patients to the waitlist. Patients who were excluded are listed below with the reason.</p>
        {excluded.length > 0 && <ExcludedList excluded={excluded} />}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-baseline justify-between px-5 pb-2 pt-4">
        <h3 className="text-sm font-semibold">Ranked waitlist</h3>
        <p className="text-xs text-ink-3">{ranked.length} eligible. You choose who gets the offer.</p>
      </div>
      <ol className="divide-y divide-rule border-y border-rule">
        {ranked.map((r, i) => {
          const isOpen = open === r.entry.id;
          const isSelected = selected.includes(r.entry.id);
          const channel = pickChannel(r.patient, data.clinic.settings.channels);
          return (
            <li key={r.entry.id} className={isSelected ? "bg-panel/70" : ""}>
              <div className="flex items-start gap-3 px-5 py-3">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => onToggle(r.entry.id)}
                  aria-label={`Include ${r.patient.name} in the offer`}
                  className="mt-1 size-4 flex-none accent-[var(--ink)]"
                />
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : r.entry.id)}
                  aria-expanded={isOpen}
                  className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto] gap-x-3 text-left"
                >
                  <span className="min-w-0">
                    <span className="flex items-center gap-2">
                      <span className="num text-xs text-ink-3">{i + 1}</span>
                      <span className="truncate text-sm font-semibold">{r.patient.name}</span>
                      {channel && <ChannelIcon channel={channel} className="size-3.5 flex-none text-ink-3" />}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-ink-2">
                      {r.type.name}, {durationLabel(r.type.durationMin)}
                    </span>
                    <span className="mt-1 block text-xs text-ink-3">{r.headline || "Partial fit on every factor"}</span>
                  </span>
                  <span className="flex flex-col items-end gap-1.5">
                    <span className="num text-xl font-medium leading-none">{r.score}</span>
                    <FitCells factors={r.factors} />
                    <CaretDownIcon className={`size-3.5 text-ink-3 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                  </span>
                </button>
              </div>
              {isOpen && (
                <div className="px-5 pb-4 pl-12">
                  <table className="w-full text-xs">
                    <caption className="sr-only">Score breakdown for {r.patient.name}</caption>
                    <thead>
                      <tr className="text-left text-ink-3">
                        <th className="pb-1 font-normal">Factor</th>
                        <th className="pb-1 text-right font-normal">Weight</th>
                        <th className="pb-1 text-right font-normal">Points</th>
                      </tr>
                    </thead>
                    <tbody>
                      {r.factors.map((f) => (
                        <tr key={f.key} className="align-top">
                          <td className="py-1 pr-2">
                            <span className="flex items-center gap-1.5 font-medium text-ink">
                              <span
                                aria-hidden="true"
                                className={`size-2 rounded-[1px] ${f.fit === "full" ? "bg-ink" : f.fit === "partial" ? "bg-d4" : "shadow-[inset_0_0_0_1px_var(--rule-strong)]"}`}
                              />
                              {f.label}
                            </span>
                            <span className="block pl-3.5 text-ink-2">{f.reason}</span>
                          </td>
                          <td className="num py-1 text-right text-ink-2">{f.weight}%</td>
                          <td className="num py-1 text-right">{f.points.toFixed(1)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-rule">
                        <td className="pt-1.5 font-medium">Match score</td>
                        <td />
                        <td className="num pt-1.5 text-right font-medium">{r.score}</td>
                      </tr>
                    </tfoot>
                  </table>
                  <p className="mt-3 text-xs text-ink-2">
                    <span className="font-medium text-ink">Stated preferences: </span>
                    {summarisePreferences(r.entry, data.clinic, r.type)}.
                    {r.entry.patientNotes && <> {r.entry.patientNotes}</>}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" variant="secondary" onClick={() => onBookDirect(r.entry.id)}>
                      Book directly
                    </Button>
                    <span className="self-center text-xs text-ink-3">For when the patient is on the phone now.</span>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ol>
      {excluded.length > 0 && (
        <div className="px-5 py-3">
          <button
            type="button"
            onClick={() => setShowExcluded((v) => !v)}
            aria-expanded={showExcluded}
            className="flex items-center gap-1.5 text-xs font-medium text-ink-2 hover:text-ink"
          >
            <CaretDownIcon className={`size-3 transition-transform ${showExcluded ? "rotate-180" : ""}`} />
            {excluded.length} not eligible for this slot
          </button>
          {showExcluded && <ExcludedList excluded={excluded} />}
        </div>
      )}
    </div>
  );
}

function ExcludedList({ excluded }: { excluded: Exclusion[] }) {
  return (
    <ul className="mt-2 grid gap-1.5">
      {excluded.map((x) => (
        <li key={x.entry.id} className="flex items-start gap-2 text-xs">
          <ProhibitIcon className="mt-px size-3.5 flex-none text-ink-3" />
          <span>
            <span className="font-medium text-ink">{x.patient.name}</span>
            <span className="text-ink-2">: {x.reason}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
