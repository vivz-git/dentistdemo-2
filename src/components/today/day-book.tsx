"use client";

import { motion, useReducedMotion } from "motion/react";
import { useMemo, type CSSProperties } from "react";
import type { Appointment, ISODate, Slot } from "@/lib/domain/types";
import { addDays, clock, clock24, diffDays, minutesUntil, relativeDay, shortDate, weekdayOf } from "@/lib/domain/time";
import { actionQueue, lookup } from "@/lib/demo/selectors";
import { useData, useNow } from "@/lib/demo/store";

const ROW = 15; // px per 15 minutes, matches .book-grid --row

export type Focus = { kind: "slot"; id: string } | { kind: "appt"; id: string } | null;

const SLOT_CLASS: Record<Slot["status"], string> = {
  open: "void",
  offering: "void-live pulse-amber",
  held: "void-held",
  lost: "void-lost",
  closed: "void-lost",
  filled: "void",
};

const SLOT_LABEL: Record<Slot["status"], string> = {
  open: "Open",
  offering: "Offer out",
  held: "Reserved",
  lost: "Lost",
  closed: "Left empty",
  filled: "Filled",
};

export function DaySwitcher({ date, onChange }: { date: ISODate; onChange: (d: ISODate) => void }) {
  const data = useData();
  const { local } = useNow();
  const queue = useMemo(() => actionQueue(data, local), [data, local]);
  const days = Array.from({ length: 7 }, (_, i) => addDays(local.date, i)).filter((d) => data.clinic.hours[weekdayOf(d)]);
  return (
    <div role="tablist" aria-label="Day" className="flex gap-1 overflow-x-auto pb-1">
      {days.map((d) => {
        const n = queue.filter((s) => s.date === d).length;
        const active = d === date;
        const rel = relativeDay(d, local.date);
        return (
          <button
            key={d}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(d)}
            className={`flex h-9 shrink-0 items-center gap-2 rounded-cf px-3 text-sm transition-colors ${
              active ? "bg-ink text-d8" : "text-ink-2 hover:bg-panel-2 hover:text-ink"
            }`}
          >
            <span className="font-medium">{rel === "today" ? "Today" : rel === "tomorrow" ? "Tomorrow" : shortDate(d)}</span>
            {n > 0 && (
              <span className={`num inline-flex items-center gap-1 text-xs ${active ? "text-d7" : "text-ink-2"}`} aria-label={`${n} open`}>
                <span aria-hidden="true" className={`void swatch !h-2.5 !w-2.5 ${active ? "ring-1 ring-d5" : ""}`} />
                {n}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function Legend() {
  const items: [string, string][] = [
    ["film", "Booked"],
    ["film-past", "Completed"],
    ["void", "Open"],
    ["void-live", "Offer out"],
    ["void-held", "Reserved"],
    ["restored", "Recovered by ChairFill"],
    ["void-lost", "Lost or left empty"],
  ];
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-ink-2" aria-label="Legend">
      {items.map(([cls, label]) => (
        <li key={label} className="flex items-center gap-1.5">
          <span aria-hidden="true" className={`swatch ${cls}`} />
          {label}
        </li>
      ))}
    </ul>
  );
}

export function DayBook({ date, focus, onFocus }: { date: ISODate; focus: Focus; onFocus: (f: Focus) => void }) {
  const data = useData();
  const { local, nowTs } = useNow();
  const L = lookup(data);
  const hours = data.clinic.hours[weekdayOf(date)];

  const chairs = data.clinic.chairs.filter((c) => !(weekdayOf(date) === 0 && c.locationId === "loc-hsr"));
  const groups = data.clinic.locations
    .map((loc) => ({ loc, chairs: chairs.filter((c) => c.locationId === loc.id) }))
    .filter((g) => g.chairs.length);

  if (!hours) {
    return <p className="rounded-cf bg-surface p-8 text-center text-sm text-ink-2">The clinic is closed on {shortDate(date)}.</p>;
  }

  const span = hours.close - hours.open;
  const height = (span / 15) * ROW;
  const y = (min: number) => ((min - hours.open) / 15) * ROW;
  const hourMarks = Array.from({ length: Math.floor(span / 60) + 1 }, (_, i) => hours.open + i * 60);
  const isToday = date === local.date;
  const nowY = isToday && local.minutes >= hours.open && local.minutes <= hours.close ? y(local.minutes) : null;
  const dimOthers = focus !== null;

  return (
    <div className="overflow-x-auto rounded-cf bg-surface shadow-[inset_0_0_0_1px_var(--rule)]">
      <div className="min-w-[640px]">
        {/* chair header */}
        <div className="sticky top-0 z-10 grid border-b border-rule bg-surface" style={{ gridTemplateColumns: `56px repeat(${chairs.length}, minmax(140px, 1fr))` }}>
          <div />
          {groups.map((g) => (
            <div key={g.loc.id} className="border-l border-rule px-3 pt-2 text-xs font-medium text-ink-3" style={{ gridColumn: `span ${g.chairs.length}` }}>
              {g.loc.name}
            </div>
          ))}
          <div />
          {chairs.map((c) => (
            <div key={c.id} className="border-l border-rule px-3 pb-2 pt-0.5">
              <p className="text-sm font-semibold">{c.label}</p>
              <p className="truncate text-xs text-ink-2">{L.provider(c.providerId)?.shortName}</p>
            </div>
          ))}
        </div>

        {/* grid body */}
        <div className="relative grid" style={{ gridTemplateColumns: `56px repeat(${chairs.length}, minmax(140px, 1fr))` }}>
          <div className="relative" style={{ height }}>
            {hourMarks.map((m) => (
              <span key={m} className={`num absolute right-2 text-[11px] text-ink-3 ${m === hours.open ? "" : "-translate-y-1/2"}`} style={{ top: y(m) }}>
                {clock24(m)}
              </span>
            ))}
          </div>
          {chairs.map((c) => (
            <ChairColumn
              key={c.id}
              chairId={c.id}
              date={date}
              height={height}
              y={y}
              hours={hours}
              focus={focus}
              dimOthers={dimOthers}
              onFocus={onFocus}
              nowTs={nowTs}
            />
          ))}
          {nowY !== null && (
            <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 z-[5] flex items-center" style={{ top: nowY }}>
              <span className="num w-[56px] pr-1 text-right text-[10px] font-semibold text-ink">{clock24(local.minutes)}</span>
              <span className="h-[1.5px] flex-1 bg-ink" />
            </div>
          )}
        </div>

        {/* running minutes per chair: booked against capacity */}
        <ColumnFooters date={date} chairs={chairs.map((c) => c.id)} capacity={span - ((hours.breakEnd ?? 0) - (hours.breakStart ?? 0))} />
      </div>
    </div>
  );
}

function ChairColumn({
  chairId,
  date,
  height,
  y,
  hours,
  focus,
  dimOthers,
  onFocus,
  nowTs,
}: {
  chairId: string;
  date: ISODate;
  height: number;
  y: (m: number) => number;
  hours: NonNullable<ReturnType<typeof useData>["clinic"]["hours"][number]>;
  focus: Focus;
  dimOthers: boolean;
  onFocus: (f: Focus) => void;
  nowTs: number;
}) {
  const data = useData();
  const L = lookup(data);
  const appts = data.appointments.filter((a) => a.chairId === chairId && a.date === date && (a.status === "booked" || a.status === "completed"));
  // Filled slots are drawn as their restored appointment; all other slot states draw the void.
  const slots = data.slots.filter((s) => s.chairId === chairId && s.date === date && s.status !== "filled");
  const filledSlots = data.slots.filter((s) => s.chairId === chairId && s.date === date && s.status === "filled");

  return (
    <div className="book-grid relative border-l border-rule" style={{ height }}>
      {hours.breakStart !== undefined && (
        <div
          className="absolute inset-x-0 flex items-center justify-center bg-panel-2 text-[11px] text-ink-3"
          style={{ top: y(hours.breakStart), height: y(hours.breakEnd!) - y(hours.breakStart) }}
        >
          Lunch
        </div>
      )}

      {/* Under each restored block, keep the void it filled, so the fill reads as a restoration. */}
      {filledSlots.map((s) => (
        <div key={`under-${s.id}`} aria-hidden="true" className="void absolute inset-x-1 rounded-cf-sm" style={{ top: y(s.startMin) + 1, height: (s.durationMin / 15) * ROW - 2 }} />
      ))}

      {appts.map((a) => (
        <ApptBlock
          key={a.id}
          appt={a}
          top={y(a.startMin)}
          selected={(focus?.kind === "appt" && focus.id === a.id) || (focus?.kind === "slot" && a.fromSlotId === focus.id)}
          dim={dimOthers}
          onFocus={onFocus}
          patientName={L.patient(a.patientId)?.name ?? "Patient"}
          typeName={L.type(a.typeId)?.name ?? ""}
          nowTs={nowTs}
        />
      ))}

      {slots.map((s) => {
        const selected = focus?.kind === "slot" && focus.id === s.id;
        const h = (s.durationMin / 15) * ROW - 2;
        const src = L.appointment(s.sourceAppointmentId);
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => onFocus({ kind: "slot", id: s.id })}
            aria-pressed={selected}
            aria-label={`${SLOT_LABEL[s.status]} chair-time, ${clock(s.startMin)}, ${s.durationMin} minutes`}
            className={`${SLOT_CLASS[s.status]} absolute inset-x-1 overflow-hidden rounded-cf-sm px-2 py-1 text-left transition-[opacity,transform] duration-200 ${
              selected ? "z-[4] ring-2 ring-ink ring-offset-2 ring-offset-surface" : dimOthers ? "opacity-60 hover:opacity-100" : "hover:brightness-125"
            }`}
            style={{ top: y(s.startMin) + 1, height: h }}
          >
            <span className="flex items-baseline justify-between gap-2 text-xs font-semibold">
              <span>{SLOT_LABEL[s.status]}</span>
              <span className="num font-normal opacity-80">{s.durationMin} min</span>
            </span>
            {h >= 40 && (
              <span className="block truncate text-[11px] opacity-80">
                {s.origin === "no_show" ? "No-show" : s.origin === "reschedule" ? "Moved" : "Cancelled"}
                {src ? `: ${L.patient(src.patientId)?.firstName}` : ""}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function ApptBlock({
  appt,
  top,
  selected,
  dim,
  onFocus,
  patientName,
  typeName,
  nowTs,
}: {
  appt: Appointment;
  top: number;
  selected: boolean;
  dim: boolean;
  onFocus: (f: Focus) => void;
  patientName: string;
  typeName: string;
  nowTs: number;
}) {
  const reduce = useReducedMotion();
  const recovered = Boolean(appt.fromSlotId);
  const cls = recovered ? "restored" : appt.status === "completed" ? "film-past" : "film";
  const h = (appt.durationMin / 15) * ROW - 2;
  // A booking made moments ago rises into its void like film being exposed.
  const fresh = recovered && nowTs - appt.createdAt < 10_000;
  const style: CSSProperties = { top: top + 1, height: h };
  return (
    <motion.button
      type="button"
      onClick={() => onFocus(recovered && appt.fromSlotId ? { kind: "slot", id: appt.fromSlotId } : { kind: "appt", id: appt.id })}
      aria-pressed={selected}
      aria-label={`${patientName}, ${typeName}, ${clock(appt.startMin)}${recovered ? ", recovered by ChairFill" : ""}`}
      initial={fresh && !reduce ? { clipPath: "inset(100% 0 0 0)" } : false}
      animate={{ clipPath: "inset(0% 0 0 0)" }}
      transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
      title={`${patientName}, ${typeName}`}
      className={`${cls} absolute inset-x-1 overflow-hidden rounded-cf-sm py-1 pl-2.5 pr-2 text-left transition-opacity duration-200 ${
        selected ? "z-[4] ring-2 ring-ink ring-offset-2 ring-offset-surface" : dim ? "opacity-60 hover:opacity-100" : "hover:shadow-lift"
      }`}
      style={style}
    >
      <span className="block truncate text-xs font-semibold leading-4">{patientName}</span>
      {h >= 40 && <span className="block truncate text-[11px] leading-4 text-ink-2">{typeName}</span>}
      {recovered && h >= 40 && <span className="block truncate text-[11px] font-medium text-restore">Recovered</span>}
    </motion.button>
  );
}

function ColumnFooters({ date, chairs, capacity }: { date: ISODate; chairs: string[]; capacity: number }) {
  const data = useData();
  const { local } = useNow();
  return (
    <div className="grid border-t border-rule bg-panel/60" style={{ gridTemplateColumns: `56px repeat(${chairs.length}, minmax(140px, 1fr))` }}>
      <div className="px-2 py-2 text-[11px] text-ink-3">min</div>
      {chairs.map((id) => {
        const booked = data.appointments
          .filter((a) => a.chairId === id && a.date === date && (a.status === "booked" || a.status === "completed"))
          .reduce((m, a) => m + a.durationMin, 0);
        const open = data.slots
          .filter((s) => s.chairId === id && s.date === date && (s.status === "open" || s.status === "offering" || s.status === "held"))
          .filter((s) => minutesUntil(local, s.date, s.startMin) > 0 || diffDays(s.date, local.date) > 0)
          .reduce((m, s) => m + s.durationMin, 0);
        const lost = data.slots.filter((s) => s.chairId === id && s.date === date && (s.status === "lost" || s.status === "closed")).reduce((m, s) => m + s.durationMin, 0);
        return (
          <div key={id} className="border-l border-rule px-3 py-2 text-right">
            <p className="num text-xs text-ink">
              {booked} <span className="text-ink-3">/ {capacity}</span>
            </p>
            <p className="num text-[11px] text-ink-3">
              {open ? `${open} open` : ""}
              {open && lost ? ", " : ""}
              {lost ? `${lost} lost` : ""}
              {!open && !lost ? "booked" : ""}
            </p>
          </div>
        );
      })}
    </div>
  );
}
