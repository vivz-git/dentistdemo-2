"use client";

import { CheckIcon, XIcon } from "@phosphor-icons/react";
import type { Slot } from "@/lib/domain/types";
import { agoLabel, clock, relativeDay } from "@/lib/domain/time";
import type { Stage } from "@/lib/demo/selectors";
import { lookup } from "@/lib/demo/selectors";
import { useData, useNow } from "@/lib/demo/store";

/**
 * The recovery loop for the focused slot: cancelled, detected, matched, offered,
 * accepted, booked, recovered. This is the one-minute explanation of the product.
 */
export function LoopTracker({ slot, stages }: { slot: Slot; stages: Stage[] }) {
  const data = useData();
  const { nowTs, local } = useNow();
  const L = lookup(data);
  const chair = L.chair(slot.chairId);

  return (
    <section aria-label="Recovery loop for the selected slot" className="rounded-cf bg-surface shadow-[inset_0_0_0_1px_var(--rule)]">
      <p className="border-b border-rule px-4 py-2.5 text-sm">
        <span className="font-semibold">Recovery loop</span>
        <span className="text-ink-2">
          {" "}
          for {relativeDay(slot.date, local.date)} {clock(slot.startMin)}, {chair?.label}
        </span>
      </p>
      <ol className="flex overflow-x-auto px-2 py-3">
        {stages.map((st, i) => {
          const last = i === stages.length - 1;
          const recovery = st.key === "booked" || st.key === "counted";
          const node =
            st.state === "done"
              ? recovery
                ? "bg-restore text-d8"
                : "bg-ink text-d8"
              : st.state === "current"
                ? slot.status === "offering"
                  ? "bg-amber-wash text-amber-ink shadow-[inset_0_0_0_1.5px_var(--amber)]"
                  : "bg-surface text-ink shadow-[inset_0_0_0_1.5px_var(--ink)]"
                : st.state === "stopped"
                  ? "void-lost"
                  : "bg-panel-2 text-ink-3 shadow-[inset_0_0_0_1px_var(--rule-strong)]";
          return (
            <li key={st.key} className="relative min-w-[118px] flex-1 px-2" aria-current={st.state === "current" ? "step" : undefined}>
              {!last && (
                <span
                  aria-hidden="true"
                  className={`absolute left-[calc(0.5rem+22px)] right-[-0.5rem] top-[11px] h-px ${st.state === "done" && stages[i + 1].state === "done" ? "bg-ink" : "bg-rule-strong"}`}
                />
              )}
              <span className={`relative grid size-[22px] place-items-center rounded-cf-sm ${node}`}>
                {st.state === "done" ? (
                  <CheckIcon weight="bold" className="size-3" />
                ) : st.state === "stopped" ? (
                  <XIcon weight="bold" className="size-3" />
                ) : (
                  <span className="num text-[11px]">{i + 1}</span>
                )}
              </span>
              <p className={`mt-2 text-[13px] font-medium ${st.state === "pending" ? "text-ink-3" : "text-ink"}`}>{st.label}</p>
              <p className="truncate text-xs text-ink-3">
                {st.state === "current"
                  ? slot.status === "offering" && st.key === "accepted"
                    ? "Waiting for a reply"
                    : st.key === "offered"
                      ? "Waiting for staff approval"
                      : "Next"
                  : st.state === "stopped"
                    ? slot.status === "closed"
                      ? "Left empty"
                      : "Not filled in time"
                    : st.detail ?? ""}
              </p>
              {st.at && st.state === "done" && <p className="num text-[11px] text-ink-3">{agoLabel(st.at, nowTs)}</p>}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
