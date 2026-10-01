"use client";

import { motion, useReducedMotion } from "motion/react";
import { useMemo } from "react";
import { useData, useNow } from "@/lib/demo/store";
import { lastNDays, summarise } from "@/lib/demo/metrics";
import { moneyCompact } from "@/lib/domain/markets";
import { durationLabel } from "@/lib/domain/time";

/**
 * The calibration strip along the top of the viewbox: tabular readouts, not cards.
 * Flow metrics cover the last 7 days and count events when they happen.
 */
export function RecoveryStrip() {
  const data = useData();
  const { nowTs, local, market } = useNow();
  const m = useMemo(() => summarise(data, nowTs, lastNDays(local.date, 7)), [data, nowTs, local.date]);

  return (
    <section aria-labelledby="strip-title" className="rounded-cf bg-surface shadow-[inset_0_0_0_1px_var(--rule)]">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-rule px-4 py-2.5">
        <h2 id="strip-title" className="text-sm font-semibold">
          Chair-time recovery
        </h2>
        <p className="text-xs text-ink-3">
          Flow figures: last 7 days. Money is an estimate from clinic list prices. All figures are demo data.
        </p>
      </div>
      <dl className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8">
        <Readout label="Open today" value={String(m.openToday)} sub={m.openMinutesToday ? durationLabel(m.openMinutesToday) : "none left"} tone={m.openToday ? "void" : undefined} />
        <Readout label="Open this week" value={String(m.openWeek)} sub="upcoming slots" tone={m.openWeek ? "void" : undefined} />
        <Readout label="Waitlist" value={String(m.waitlistSize)} sub="waiting or offered" />
        <Readout label="Offers sent" value={String(m.offersSent)} sub={m.liveOffers ? `${m.liveOffers} awaiting reply` : "none awaiting"} subTone={m.liveOffers ? "amber" : undefined} />
        <Readout label="Accepted" value={String(m.offersAccepted)} sub={`${m.offersDeclined} declined, ${m.offersExpired} lapsed`} />
        <Readout label="Fill rate" value={m.fillRate === null ? "n/a" : `${Math.round(m.fillRate * 100)}%`} sub={`${m.filled} filled, ${m.lost} lost`} />
        <Readout label="Recovered" value={`${(m.recoveredMinutes / 60).toFixed(1)} h`} sub={`chair-hours, ${m.filled} slots`} tone="restore" />
        <Readout label="Est. production" value={moneyCompact(market, m.recoveredProduction)} sub="recovered, estimate" tone="restore" />
      </dl>
    </section>
  );
}

export function Readout({ label, value, sub, tone, subTone }: { label: string; value: string; sub: string; tone?: "void" | "amber" | "restore"; subTone?: "amber" }) {
  const reduce = useReducedMotion();
  const valueColor = tone === "restore" ? "text-restore" : tone === "amber" ? "text-amber-ink" : "text-ink";
  return (
    <div className="relative border-b border-r border-rule px-4 py-3 [&:nth-child(2n)]:border-r-0 sm:[&:nth-child(2n)]:border-r sm:[&:nth-child(4n)]:border-r-0 xl:border-b-0 xl:[&:nth-child(4n)]:border-r xl:last:border-r-0">
      {tone === "void" && <span aria-hidden="true" className="void absolute inset-y-0 left-0 w-1" />}
      {tone === "amber" && <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-amber" />}
      <dt className="truncate text-xs text-ink-2">{label}</dt>
      <dd className="mt-1">
        <motion.span
          key={value}
          initial={reduce ? false : { opacity: 0.25, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className={`num block text-[1.375rem] font-medium leading-none ${valueColor}`}
        >
          {value}
        </motion.span>
        <span className={`mt-1.5 block truncate text-xs ${subTone === "amber" ? "text-amber-ink" : "text-ink-3"}`}>{sub}</span>
      </dd>
    </div>
  );
}
