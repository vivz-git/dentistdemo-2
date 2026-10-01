"use client";

import { useMemo, useState } from "react";
import { WEEKDAY_SHORT, weekdayOf } from "@/lib/domain/time";
import { moneyCompact } from "@/lib/domain/markets";
import { BEFORE_AFTER_DEMO, dailySeries, lastNDays, responseTimes, summarise } from "@/lib/demo/metrics";
import { useData, useNow } from "@/lib/demo/store";
import { PAGE_CLS, PageHeader, Panel } from "@/components/ui/page";
import { Readout } from "@/components/today/recovery-strip";
import { ChartPanel, ColumnChart, type Column, type Series } from "./charts";

type Days = 7 | 14;

const OPENED: Series[] = [{ key: "opened", label: "Slots opened", kind: "solid", color: "var(--d3)" }];
const OUTCOMES: Series[] = [
  { key: "filled", label: "Recovered", kind: "solid", color: "var(--restore)" },
  { key: "lost", label: "Lost, start time passed", kind: "lost" },
  { key: "closed", label: "Left empty by staff", kind: "solid", color: "var(--d5)" },
];
const HOURS: Series[] = [{ key: "hours", label: "Recovered chair-hours", kind: "solid", color: "var(--restore)" }];
const MONEY: Series[] = [{ key: "money", label: "Estimated production", kind: "solid", color: "var(--restore)" }];
const REPLIES: Series[] = [
  { key: "accepted", label: "Accepted", kind: "solid", color: "var(--restore)" },
  { key: "declined", label: "Declined", kind: "solid", color: "var(--d4)" },
];

const BUCKETS = [
  { label: "Under 5", test: (m: number) => m < 5 },
  { label: "5 to 15", test: (m: number) => m >= 5 && m < 15 },
  { label: "15 to 30", test: (m: number) => m >= 15 && m < 30 },
  { label: "30 to 45", test: (m: number) => m >= 30 && m < 45 },
  { label: "45 plus", test: (m: number) => m >= 45 },
];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const int = (v: number) => String(Math.round(v));
const hours1 = (v: number) => `${Number.isInteger(v) ? v : v.toFixed(1)} h`;

export function AnalyticsView() {
  const data = useData();
  const { nowTs, local, market } = useNow();
  const [days, setDays] = useState<Days>(14);

  const period = useMemo(() => lastNDays(local.date, days), [local.date, days]);
  const summary = useMemo(() => summarise(data, nowTs, period), [data, nowTs, period]);
  const series = useMemo(() => dailySeries(data, period), [data, period]);
  const replies = useMemo(() => responseTimes(data, period), [data, period]);

  const dayCols = (pick: (p: (typeof series)[number]) => number[]): Column[] =>
    series.map((p, i) => {
      const wd = weekdayOf(p.date);
      const dom = Number(p.date.slice(8));
      const isToday = p.date === local.date;
      const monthStart = i === 0 || dom === 1;
      const sub = isToday ? "today" : monthStart ? MONTHS[Number(p.date.slice(5, 7)) - 1] : WEEKDAY_SHORT[wd];
      return { label: String(dom), sub, keepSub: isToday || monthStart, title: `${WEEKDAY_SHORT[wd]} ${Number(p.date.slice(8))}${p.date === local.date ? " (today so far)" : ""}`, values: pick(p) };
    });

  const opened = dayCols((p) => [p.cancelled]);
  const outcomes = dayCols((p) => [p.filled, p.lost, p.closed]);
  const chairHours = dayCols((p) => [p.recoveredMinutes / 60]);
  const production = dayCols((p) => [p.recoveredProduction]);
  const reply = BUCKETS.map<Column>((b) => ({
    label: b.label,
    title: `${b.label} minutes to reply`,
    values: [replies.filter((r) => r.outcome === "accepted" && b.test(r.minutes)).length, replies.filter((r) => r.outcome === "declined" && b.test(r.minutes)).length],
  }));

  const slotsOpened = series.reduce((s, p) => s + p.cancelled, 0);
  const tableOf = (cols: Column[], head: string[], fmt: (v: number) => string) => ({
    head: ["Day", ...head],
    rows: cols.map((c) => [c.title, ...c.values.map(fmt)]),
  });
  const money = (v: number) => moneyCompact(market, v);
  const periodLabel = `last ${days} days`;

  return (
    <div className={PAGE_CLS}>
      <PageHeader
        title="Analytics"
        description={`Chair-time recovery for ${data.clinic.name}. Events count on the day they happen, so a slot filled today for tomorrow counts today.`}
      />

      <div role="tablist" aria-label="Period" className="flex gap-1">
        {([7, 14] as const).map((d) => (
          <button
            key={d}
            role="tab"
            aria-selected={days === d}
            onClick={() => setDays(d)}
            className={`flex h-9 items-center rounded-cf px-3 text-sm font-medium transition-colors ${days === d ? "bg-ink text-d8" : "text-ink-2 hover:bg-panel-2 hover:text-ink"}`}
          >
            Last {d} days
          </button>
        ))}
      </div>

      <section aria-labelledby="an-strip" className="rounded-cf bg-surface shadow-[inset_0_0_0_1px_var(--rule)]">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-rule px-4 py-2.5">
          <h2 id="an-strip" className="text-sm font-semibold">
            {`Totals, ${periodLabel}`}
          </h2>
          <p className="text-xs text-ink-3">Money is an estimate from clinic list prices. All figures are demo data.</p>
        </div>
        <dl className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8">
          <Readout label="Slots opened" value={String(slotsOpened)} sub="all causes" />
          <Readout label="Offers sent" value={String(summary.offersSent)} sub={summary.liveOffers ? `${summary.liveOffers} awaiting reply` : "none awaiting reply"} subTone={summary.liveOffers ? "amber" : undefined} />
          <Readout label="Accepted" value={String(summary.offersAccepted)} sub={`${summary.offersDeclined} declined`} />
          <Readout label="Median reply" value={summary.medianResponseMin === null ? "n/a" : `${Math.round(summary.medianResponseMin)} min`} sub="to answer an offer" />
          <Readout label="Fill rate" value={summary.fillRate === null ? "n/a" : `${Math.round(summary.fillRate * 100)}%`} sub={`${summary.filled} filled, ${summary.lost} lost`} />
          <Readout label="Recovered" value={`${(summary.recoveredMinutes / 60).toFixed(1)} h`} sub={`chair-hours, ${summary.filled} slots`} tone="restore" />
          <Readout label="Est. production" value={money(summary.recoveredProduction)} sub="recovered, estimate" tone="restore" />
          <Readout label="Est. lost production" value={money(summary.lostProduction)} sub="estimate" />
        </dl>
      </section>

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
        <ChartPanel
          title="Slots opened by day"
          caption={`${periodLabel}, demo data`}
          series={OPENED}
          table={tableOf(opened, ["Slots opened"], int)}
        >
          <ColumnChart title="Slots opened by day" series={OPENED} columns={opened} format={int} unit="slots" />
        </ChartPanel>

        <ChartPanel
          title="What became of the freed time"
          caption={`${periodLabel}, by day resolved, demo data`}
          series={OUTCOMES}
          table={tableOf(outcomes, ["Recovered", "Lost", "Left empty"], int)}
        >
          <ColumnChart title="Slots recovered, lost or left empty by day" series={OUTCOMES} columns={outcomes} format={int} unit="slots" />
        </ChartPanel>

        <ChartPanel
          title="Recovered chair-hours by day"
          caption={`${periodLabel}, demo data`}
          series={HOURS}
          table={tableOf(chairHours, ["Chair-hours"], (v) => v.toFixed(2))}
        >
          <ColumnChart title="Recovered chair-hours by day" series={HOURS} columns={chairHours} format={hours1} unit="hours" />
        </ChartPanel>

        <ChartPanel
          title="Estimated recovered production by day"
          caption={`Estimate from clinic list prices, ${periodLabel}, demo data`}
          series={MONEY}
          table={tableOf(production, ["Estimate"], money)}
        >
          <ColumnChart title="Estimated recovered production by day" series={MONEY} columns={production} format={money} unit="estimate" />
        </ChartPanel>

        <ChartPanel
          title="How fast patients reply"
          caption={`${periodLabel}, offers answered, demo data`}
          series={REPLIES}
          table={{ head: ["Minutes to reply", "Accepted", "Declined"], rows: reply.map((c) => [c.label, ...c.values.map(int)]) }}
          summary={
            replies.length === 0
              ? "No offers were answered in this period."
              : `${replies.length} answered offer${replies.length === 1 ? "" : "s"}. Offers that lapsed with no reply are not counted here.`
          }
        >
          <ColumnChart title="Offers answered by minutes to reply" series={REPLIES} columns={reply} format={int} unit="offers" height={200} />
        </ChartPanel>
      </div>

      <BeforeAfter />
    </div>
  );
}

/** Twelve cells per row, one per cancelled slot. Fixed illustration, not derived from the book. */
function BeforeAfter() {
  const { cancelled, without, with: withCf } = BEFORE_AFTER_DEMO;
  const rows = [
    { key: "without", label: "Without ChairFill", recovered: without.recovered, lost: without.lost, recoveredClass: "bg-d7 border border-dashed border-d4" },
    { key: "with", label: "With ChairFill", recovered: withCf.recovered, lost: withCf.lost, recoveredClass: "bg-restore-wash border border-dashed border-restore" },
  ];
  return (
    <Panel title="Hypothetical before and after" caption="Hypothetical demo data, not a customer result.">
      <div className="max-w-3xl px-4 pb-3 pt-4">
        <p className="text-sm text-ink-2">
          Imagine a clinic with <span className="num">{cancelled}</span> cancelled slots. Each cell below is one slot.
        </p>
        <div className="mt-4 grid gap-4">
          {rows.map((r) => (
            <div key={r.key}>
              <p className="flex items-baseline justify-between gap-3 text-sm">
                <span className="font-semibold">{r.label}</span>
                <span className="text-xs text-ink-2">
                  <span className="num">{r.recovered}</span> of <span className="num">{cancelled}</span> recovered
                </span>
              </p>
              <div className="mt-1.5 flex gap-[3px]" role="img" aria-label={`${r.label}: ${r.recovered} of ${cancelled} slots recovered, ${r.lost} lost`}>
                {Array.from({ length: cancelled }, (_, i) => (
                  <span key={i} className={`h-6 min-w-0 flex-1 rounded-[2px] ${i < r.recovered ? r.recoveredClass : "void-lost opacity-50"}`} />
                ))}
              </div>
            </div>
          ))}
        </div>
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-ink-2" aria-label="Legend">
          <li className="flex items-center gap-1.5">
            <span aria-hidden="true" className="swatch border border-dashed border-d4 bg-d7" /> Recovered by staff alone
          </li>
          <li className="flex items-center gap-1.5">
            <span aria-hidden="true" className="swatch border border-dashed border-restore bg-restore-wash" /> Recovered with ChairFill
          </li>
          <li className="flex items-center gap-1.5">
            <span aria-hidden="true" className="swatch void-lost opacity-50" /> Lost
          </li>
        </ul>
        <p className="mt-3 text-xs text-ink-3">
          In this illustration, <span className="num">{withCf.recovered - without.recovered}</span> more of the <span className="num">{cancelled}</span> slots are recovered. The figures come from the product brief and are not measured from the demo book above.
        </p>
      </div>
    </Panel>
  );
}
