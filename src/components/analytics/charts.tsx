"use client";

import { useCallback, useId, useRef, useState, type ReactNode } from "react";
import { Panel } from "@/components/ui/page";

/**
 * Hand-built SVG charts on the book grid's armature: hairline gridlines, mono 11px
 * axis labels, density-ramp series plus restore teal and amber only. Marks follow the
 * dataviz specs: columns at most 24px with a 4px rounded data end, a 2px surface gap
 * between stacked segments, one axis, a legend for two or more series, a tooltip on
 * hover and focus, and a table view for every chart.
 */

export interface Series {
  key: string;
  label: string;
  /** solid uses `color`; "lost" and "void" reuse the film-state hatches. */
  kind: "solid" | "lost" | "void";
  color?: string;
}

export interface Column {
  /** Primary axis label, for example the day number. */
  label: string;
  /** Optional second axis line, for example the weekday. */
  sub?: string;
  /** Show the second line even when columns are narrow (month starts, today). */
  keepSub?: boolean;
  /** Full name shown in the tooltip. */
  title: string;
  values: number[];
}

const PAD = { left: 52, right: 8, top: 22, bottom: 38 };
const GAP = 2;

function niceStep(max: number, ticks: number): number {
  const raw = Math.max(max, 1e-9) / ticks;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const f = raw / pow;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * pow;
}

function barPath(x: number, y: number, w: number, h: number, roundTop: boolean): string {
  if (!roundTop) return `M${x},${y}h${w}v${h}h${-w}z`;
  const r = Math.min(4, h, w / 2);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

export function SeriesSwatch({ s }: { s: Series }) {
  if (s.kind === "lost") return <span aria-hidden="true" className="swatch void-lost" />;
  if (s.kind === "void") return <span aria-hidden="true" className="swatch void" />;
  return <span aria-hidden="true" className="swatch" style={{ backgroundColor: s.color }} />;
}

export function ColumnChart({
  series,
  columns,
  format,
  height = 220,
  unit,
  title,
}: {
  series: Series[];
  columns: Column[];
  format: (v: number) => string;
  height?: number;
  /** Axis caption, for example "slots". */
  unit: string;
  title: string;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState<number | null>(null);
  const observer = useRef<ResizeObserver | null>(null);

  const measure = useCallback((el: HTMLDivElement | null) => {
    observer.current?.disconnect();
    if (!el) return;
    setWidth(el.clientWidth);
    observer.current = new ResizeObserver(() => setWidth(el.clientWidth));
    observer.current.observe(el);
  }, []);

  const totals = columns.map((c) => c.values.reduce((s, v) => s + v, 0));
  const maxTotal = Math.max(0, ...totals);
  const step = niceStep(maxTotal || 4, 4);
  const yMax = Math.max(step * Math.ceil(maxTotal / step), step * 2);
  const ticks = Array.from({ length: Math.round(yMax / step) + 1 }, (_, i) => i * step);

  const plotW = Math.max(width - PAD.left - PAD.right, 10);
  const plotH = height - PAD.top - PAD.bottom;
  const band = plotW / Math.max(columns.length, 1);
  const thick = Math.min(24, Math.max(band * 0.58, 4));
  const base = PAD.top + plotH;
  const y = (v: number) => base - (v / yMax) * plotH;
  const showSub = band >= 34;
  const labelEvery = band >= 30 ? 1 : band >= 15 ? 2 : 3;
  const tallest = totals.indexOf(maxTotal);

  const fillOf = (s: Series) => (s.kind === "solid" ? s.color : `url(#${uid}-${s.kind})`);

  const tipLeft = hover === null ? 0 : Math.min(Math.max(PAD.left + band * hover + band / 2, 90), Math.max(width - 90, 90));

  return (
    <div ref={measure} className="relative w-full" style={{ height }}>
      {width > 0 && (
        <svg width={width} height={height} role="group" aria-label={title} className="block overflow-visible">
          <defs>
            <pattern id={`${uid}-lost`} width="6" height="6" patternUnits="userSpaceOnUse">
              <rect width="6" height="6" fill="var(--d0)" />
              <path d="M0,6L6,0M0,0L6,6" stroke="var(--d6)" strokeOpacity="0.4" strokeWidth="1" />
            </pattern>
            <pattern id={`${uid}-void`} width="6" height="6" patternUnits="userSpaceOnUse">
              <rect width="6" height="6" fill="var(--d1)" />
              <path d="M0,6L6,0" stroke="var(--d7)" strokeOpacity="0.45" strokeWidth="1" />
            </pattern>
          </defs>

          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={PAD.left + plotW} y1={y(t)} y2={y(t)} stroke={t === 0 ? "var(--rule-strong)" : "var(--rule)"} strokeWidth="1" />
              <text x={PAD.left - 8} y={y(t)} textAnchor="end" dominantBaseline="central" className="num" fontSize="11" fill="var(--ink-3)">
                {format(t)}
              </text>
            </g>
          ))}
          <text x={PAD.left - 8} y={PAD.top - 12} textAnchor="end" fontSize="11" fill="var(--ink-3)">
            {unit}
          </text>

          {hover !== null && <rect x={PAD.left + band * hover} y={PAD.top} width={band} height={plotH} fill="var(--panel-2)" />}

          {columns.map((c, i) => {
            const cx = PAD.left + band * i + band / 2;
            let cum = 0;
            const lastIdx = c.values.reduce((acc, v, k) => (v > 0 ? k : acc), -1);
            return (
              <g key={i}>
                {c.values.map((v, k) => {
                  if (v <= 0) return null;
                  const bottom = y(cum) - (cum > 0 ? GAP / 2 : 0);
                  cum += v;
                  const top = y(cum) + (k < lastIdx ? GAP / 2 : 0);
                  const h = Math.max(bottom - top, 1);
                  return <path key={k} d={barPath(cx - thick / 2, bottom - h, thick, h, k === lastIdx)} style={{ fill: fillOf(series[k]) }} />;
                })}
                {i % labelEvery === 0 && (
                  <text x={cx} y={base + 15} textAnchor="middle" className="num" fontSize="11" fill="var(--ink-2)">
                    {c.label}
                  </text>
                )}
                {c.sub && (c.keepSub || (showSub && i % labelEvery === 0)) && (
                  <text x={cx} y={base + 28} textAnchor="middle" fontSize="10" fill="var(--ink-3)">
                    {c.sub}
                  </text>
                )}
                {i === tallest && maxTotal > 0 && (
                  <text x={cx} y={y(totals[i]) - 6} textAnchor="middle" className="num" fontSize="11" fontWeight="500" fill="var(--ink)">
                    {format(totals[i])}
                  </text>
                )}
                <rect
                  x={PAD.left + band * i}
                  y={PAD.top}
                  width={band}
                  height={plotH + PAD.bottom - 4}
                  fill="transparent"
                  tabIndex={0}
                  aria-label={`${c.title}: ${c.values.map((v, k) => `${series[k].label} ${format(v)}`).join(", ")}`}
                  onPointerEnter={() => setHover(i)}
                  onPointerLeave={() => setHover(null)}
                  onFocus={() => setHover(i)}
                  onBlur={() => setHover(null)}
                  style={{ outline: "none" }}
                />
              </g>
            );
          })}
        </svg>
      )}

      {hover !== null && columns[hover] && (
        <div
          role="status"
          className="pointer-events-none absolute z-10 w-44 -translate-x-1/2 rounded-cf bg-ink p-2.5 text-d8 shadow-lift"
          style={{ left: tipLeft, top: 0 }}
        >
          <p className="text-[11px] text-on-dark-2">{columns[hover].title}</p>
          <ul className="mt-1 grid gap-0.5">
            {columns[hover].values.map((v, k) => (
              <li key={series[k].key} className="flex items-center gap-2 text-xs">
                <span aria-hidden="true" className="h-0.5 w-3 flex-none rounded-full" style={{ background: series[k].kind === "solid" ? series[k].color : "var(--d7)" }} />
                <span className="num font-medium">{format(v)}</span>
                <span className="truncate text-on-dark-2">{series[k].label}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export interface TableData {
  head: string[];
  rows: string[][];
}

/** A chart in a ruled panel: legend for two or more series, provenance caption, table view. */
export function ChartPanel({
  title,
  caption,
  series,
  table,
  summary,
  children,
}: {
  title: string;
  caption: ReactNode;
  series: Series[];
  table: TableData;
  summary?: ReactNode;
  children: ReactNode;
}) {
  const [showTable, setShowTable] = useState(false);
  const tableId = useId();
  return (
    <Panel title={title} caption={caption}>
      <div className="px-4 pb-3 pt-4">
        {summary && <p className="mb-3 text-sm text-ink-2">{summary}</p>}
        {children}
        {series.length > 1 && (
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-ink-2" aria-label="Legend">
            {series.map((s) => (
              <li key={s.key} className="flex items-center gap-1.5">
                <SeriesSwatch s={s} />
                {s.label}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="border-t border-rule">
        <button
          type="button"
          onClick={() => setShowTable((v) => !v)}
          aria-expanded={showTable}
          aria-controls={tableId}
          className="px-4 py-2 text-xs font-medium text-ink-2 hover:text-ink"
        >
          {showTable ? "Hide table" : "View as table"}
        </button>
        {showTable && (
          <div id={tableId} className="relative max-h-72 overflow-auto px-4 pb-3">
            <table className="w-full text-xs">
              <caption className="sr-only">{title}</caption>
              <thead>
                <tr className="text-ink-3">
                  {table.head.map((h, i) => (
                    <th key={h} scope="col" className={`py-1 font-normal ${i === 0 ? "text-left" : "text-right"}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows.map((r) => (
                  <tr key={r[0]} className="border-t border-rule">
                    {r.map((cell, i) => (
                      <td key={i} className={`py-1 ${i === 0 ? "text-left text-ink-2" : "num text-right"}`}>
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Panel>
  );
}
