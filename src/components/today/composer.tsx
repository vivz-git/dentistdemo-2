"use client";

import { useMemo, useState } from "react";
import { ArrowLeftIcon, SparkleIcon, WarningIcon } from "@phosphor-icons/react";
import type { CampaignMode, Slot } from "@/lib/domain/types";
import type { MatchResult } from "@/lib/matching/engine";
import { TEMPLATE_TOKENS, draftOfferMessage, guardDraft } from "@/lib/ai/assistant";
import { inQuietHours, launchCampaign, pickChannel } from "@/lib/demo/actions";
import { DEFAULT_TEMPLATE } from "@/lib/demo/seed";
import { readSession, useData, useDemo, useNow } from "@/lib/demo/store";
import { clock } from "@/lib/domain/time";
import { Button } from "@/components/ui/button";
import { ChannelIcon } from "./candidates";

/** Staff review and approval. Nothing is sent until this form is submitted. */
export function Composer({ slot, chosen, onBack }: { slot: Slot; chosen: MatchResult[]; onBack: () => void }) {
  const data = useData();
  const { local } = useNow();
  const run = useDemo((s) => s.run);
  const settings = data.clinic.settings;
  const [mode, setMode] = useState<CampaignMode>(settings.defaultMode);
  const [windowMin, setWindowMin] = useState(settings.offerWindowMin);
  const [template, setTemplate] = useState(settings.messageTemplate);
  const [approver, setApprover] = useState(() => {
    const s = readSession();
    return s ? `${s.name.split(" ")[0]} (front desk)` : "";
  });

  const previews = useMemo(
    () =>
      chosen.map((r) => {
        const body = draftOfferMessage({ clinic: data.clinic, slot, patient: r.patient, type: r.type, today: local.date, template });
        return { r, body, guard: guardDraft(body, slot), channel: pickChannel(r.patient, settings.channels) };
      }),
    [chosen, data.clinic, slot, local.date, template, settings.channels],
  );
  const problems = [...new Set(previews.flatMap((p) => p.guard.problems))];
  const quiet = inQuietHours(local.minutes, settings.quietHours);
  const canSend = problems.length === 0 && approver.trim().length > 0 && chosen.length > 0;

  function send() {
    const res = run((s, now) =>
      launchCampaign(s, now, {
        slotId: slot.id,
        entryIds: chosen.map((c) => c.entry.id),
        mode,
        offerWindowMin: windowMin,
        template,
        approvedBy: approver,
      }),
    );
    if (res && !res.error) onBack();
  }

  return (
    <div className="px-5 py-4">
      <button type="button" onClick={onBack} className="mb-3 inline-flex items-center gap-1.5 text-xs font-medium text-ink-2 hover:text-ink">
        <ArrowLeftIcon className="size-3.5" /> Back to the ranked list
      </button>
      <h3 className="text-sm font-semibold">Review the offer</h3>
      <p className="mt-1 text-xs text-ink-2">
        {chosen.length} patient{chosen.length === 1 ? "" : "s"} selected. Messages are simulated; nothing reaches a real phone.
      </p>

      <fieldset className="mt-4">
        <legend className="text-xs font-medium text-ink-2">How to offer</legend>
        <div className="mt-1.5 grid grid-cols-2 gap-1 rounded-cf bg-panel-2 p-1">
          {(
            [
              ["simultaneous", "All at once", "First to accept gets it"],
              ["cascade", "One at a time", "In ranked order"],
            ] as const
          ).map(([value, label, sub]) => (
            <label
              key={value}
              className={`cursor-pointer rounded-[4px] px-3 py-2 text-xs transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ink ${
                mode === value ? "bg-surface shadow-[inset_0_0_0_1px_var(--rule-strong)]" : "text-ink-2 hover:text-ink"
              }`}
            >
              <input type="radio" name="mode" value={value} checked={mode === value} onChange={() => setMode(value)} className="sr-only" />
              <span className="block font-semibold">{label}</span>
              <span className="block text-ink-3">{sub}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <label className="mt-4 grid gap-1.5 text-xs font-medium text-ink-2">
        Reply window
        <select
          value={windowMin}
          onChange={(e) => setWindowMin(Number(e.target.value))}
          className="h-9 rounded-cf border border-rule-strong bg-surface px-2 text-sm text-ink"
        >
          {[15, 30, 45, 60, 90].map((m) => (
            <option key={m} value={m}>
              {m} minutes per patient
            </option>
          ))}
        </select>
      </label>

      <div className="mt-4">
        <div className="flex items-center justify-between">
          <label htmlFor="template" className="text-xs font-medium text-ink-2">
            Message
          </label>
          <button
            type="button"
            onClick={() => setTemplate(DEFAULT_TEMPLATE)}
            className="inline-flex items-center gap-1 text-xs font-medium text-ink-2 hover:text-ink"
          >
            <SparkleIcon className="size-3.5" /> Redraft with assistant
          </button>
        </div>
        <textarea
          id="template"
          value={template}
          onChange={(e) => setTemplate(e.target.value)}
          rows={4}
          className="mt-1.5 w-full resize-y rounded-cf border border-rule-strong bg-surface p-2.5 text-sm leading-relaxed outline-none focus:border-ink"
        />
        <p className="mt-1 text-[11px] leading-relaxed text-ink-3">
          Fields fill from the slot, never invented: {TEMPLATE_TOKENS.join(" ")}. The assistant drafts admin text only and every message is checked for clinical or
          urgency language before you can approve it.
        </p>
      </div>

      <div className="mt-4">
        <p className="text-xs font-medium text-ink-2">Preview</p>
        <ul className="mt-1.5 grid gap-2">
          {previews.map(({ r, body, channel }, i) => (
            <li key={r.entry.id} className="rounded-cf bg-panel p-3">
              <p className="flex items-center gap-2 text-xs font-medium">
                {channel && <ChannelIcon channel={channel} />}
                {r.patient.name}
                {mode === "cascade" && <span className="num ml-auto font-normal text-ink-3">{i === 0 ? "sent first" : `queued #${i + 1}`}</span>}
              </p>
              {i === 0 ? <p className="mt-1.5 text-sm leading-relaxed">{body}</p> : <p className="mt-1 text-xs text-ink-3">Same message, personalised.</p>}
            </li>
          ))}
        </ul>
      </div>

      {problems.length > 0 && (
        <ul role="alert" className="mt-3 grid gap-1 rounded-cf bg-danger-wash p-3 text-xs text-danger">
          {problems.map((p) => (
            <li key={p} className="flex gap-1.5">
              <WarningIcon className="mt-px size-3.5 flex-none" /> {p}
            </li>
          ))}
        </ul>
      )}
      {quiet && (
        <p className="mt-3 flex gap-1.5 rounded-cf bg-amber-wash p-3 text-xs text-amber-ink">
          <WarningIcon className="mt-px size-3.5 flex-none" />
          It is {clock(local.minutes)}, inside the clinic&apos;s quiet hours. In production these messages would wait until morning.
        </p>
      )}

      <label className="mt-4 grid gap-1.5 text-xs font-medium text-ink-2">
        Approved by
        <input
          value={approver}
          onChange={(e) => setApprover(e.target.value)}
          className="h-9 rounded-cf border border-rule-strong bg-surface px-2.5 text-sm text-ink outline-none focus:border-ink"
        />
      </label>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <Button variant="primary" onClick={send} disabled={!canSend}>
          Approve and send
        </Button>
        <Button variant="ghost" onClick={onBack}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
