import type { ReactNode } from "react";

export type ChipTone = "live" | "recovered" | "settled" | "muted" | "queued";

/** Status chips from the design system: always a text label, never colour alone. */
const TONE: Record<ChipTone, string> = {
  live: "bg-amber-wash text-amber-ink shadow-[inset_0_0_0_1px_var(--amber)]",
  recovered: "bg-restore-wash text-restore shadow-[inset_0_0_0_1px_var(--restore)]",
  settled: "bg-panel-2 text-ink-2",
  muted: "bg-panel-2 text-ink-3",
  queued: "bg-surface text-ink-2 shadow-[inset_0_0_0_1px_var(--rule-strong)]",
};

export function Chip({ tone, children }: { tone: ChipTone; children: ReactNode }) {
  return <span className={`inline-flex h-5 items-center whitespace-nowrap rounded-cf-sm px-1.5 text-[11px] font-medium ${TONE[tone]}`}>{children}</span>;
}
