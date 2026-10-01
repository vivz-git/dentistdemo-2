"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CaretLeftIcon, CaretRightIcon } from "@phosphor-icons/react";
import type { Appointment, CancellationSource, ISODate, Slot } from "@/lib/domain/types";
import { addDays, clock, durationLabel, relativeDay, shortDate, timeRange, weekStart, weekdayOf } from "@/lib/domain/time";
import { cancelAppointment, closeSlot, holdSlot, releaseSlot, rescheduleAppointment } from "@/lib/demo/actions";
import { lookup } from "@/lib/demo/selectors";
import { useData, useDemo, useNow } from "@/lib/demo/store";
import { Button } from "@/components/ui/button";
import { Chip, type ChipTone } from "@/components/ui/chip";
import { Field, FormError, INPUT } from "@/components/ui/form";
import { EmptyState, PAGE_CLS, PageHeader, Panel } from "@/components/ui/page";
import { staffName } from "@/components/today/live-offers";

type Row =
  | { kind: "appt"; id: string; date: ISODate; startMin: number; chairId: string; appt: Appointment }
  | { kind: "slot"; id: string; date: ISODate; startMin: number; chairId: string; slot: Slot };

type StatusFilter = "upcoming" | "schedule" | "booked" | "open" | "lost" | "cancelled" | "all";
type EditMode = "reschedule" | "cancel" | "reserve";

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "upcoming", label: "Booked and open time" },
  { value: "schedule", label: "Including completed" },
  { value: "booked", label: "Booked only" },
  { value: "open", label: "Open time only" },
  { value: "lost", label: "Lost or left empty" },
  { value: "cancelled", label: "Cancelled and no-shows" },
  { value: "all", label: "Everything" },
];

function inFilter(row: Row, f: StatusFilter): boolean {
  if (row.kind === "slot") {
    const s = row.slot.status;
    if (s === "filled") return false; // drawn as the recovered appointment instead
    if (f === "all") return true;
    if (f === "upcoming" || f === "schedule" || f === "open") return s === "open" || s === "offering" || s === "held";
    if (f === "lost") return s === "lost" || s === "closed";
    return false;
  }
  const s = row.appt.status;
  if (f === "all") return true;
  if (f === "schedule") return s === "booked" || s === "completed";
  if (f === "upcoming" || f === "booked") return s === "booked";
  if (f === "cancelled") return s === "cancelled" || s === "no_show";
  return false;
}

interface Look {
  swatch: string | null;
  tone: ChipTone;
  chip: string;
  title: string;
  sub: string;
}

const SOURCE_LABEL: Record<CancellationSource, string> = {
  patient_call: "by phone",
  patient_message: "by message",
  no_show: "no-show",
  clinic: "by the clinic",
};

export function AppointmentsView({ initialAppt }: { initialAppt?: string }) {
  const data = useData();
  const { local } = useNow();
  const router = useRouter();
  const run = useDemo((s) => s.run);
  const L = lookup(data);

  const target = initialAppt ? data.appointments.find((a) => a.id === initialAppt) : undefined;
  const [weekFrom, setWeekFrom] = useState<ISODate>(() => weekStart(target?.date ?? local.date));
  // One day at a time keeps the list scannable; "All week" is a click away.
  const dayForWeek = (week: ISODate): ISODate | "all" => {
    const days = [0, 1, 2, 3, 4, 5, 6].map((i) => addDays(week, i)).filter((d) => data.clinic.hours[weekdayOf(d)]);
    const actionable = (d: ISODate) =>
      data.appointments.some((a) => a.date === d && a.status === "booked") || data.slots.some((sl) => sl.date === d && (sl.status === "open" || sl.status === "offering" || sl.status === "held"));
    const from = days.filter((d) => d >= local.date);
    return (from.length ? from : days).find(actionable) ?? days[0] ?? "all";
  };
  const [day, setDay] = useState<ISODate | "all">(() => target?.date ?? dayForWeek(weekFrom));
  const [chair, setChair] = useState("all");
  const [status, setStatus] = useState<StatusFilter>(target && (target.status === "cancelled" || target.status === "no_show") ? "all" : "upcoming");
  const [editing, setEditing] = useState<{ id: string; mode: EditMode } | null>(target?.status === "booked" ? { id: target.id, mode: "reschedule" } : null);

  const targetId = target?.id;
  useEffect(() => {
    if (targetId) document.getElementById(`row-${targetId}`)?.scrollIntoView({ block: "center" });
  }, [targetId]);

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekFrom, i));
  const openDays = weekDays.filter((d) => data.clinic.hours[weekdayOf(d)]);
  const weekEnd = addDays(weekFrom, 6);

  const rows = useMemo(() => {
    const out: Row[] = [];
    for (const a of data.appointments) out.push({ kind: "appt", id: a.id, date: a.date, startMin: a.startMin, chairId: a.chairId, appt: a });
    for (const s of data.slots) out.push({ kind: "slot", id: s.id, date: s.date, startMin: s.startMin, chairId: s.chairId, slot: s });
    const chairOrder = new Map(data.clinic.chairs.map((c, i) => [c.id, i]));
    return out
      .filter((r) => r.date >= weekFrom && r.date <= weekEnd)
      .sort((a, b) => (a.date === b.date ? a.startMin - b.startMin || (chairOrder.get(a.chairId) ?? 0) - (chairOrder.get(b.chairId) ?? 0) : a.date < b.date ? -1 : 1));
  }, [data.appointments, data.slots, data.clinic.chairs, weekFrom, weekEnd]);

  const visible = rows.filter((r) => (day === "all" || r.date === day) && (chair === "all" || r.chairId === chair) && inFilter(r, status));
  const weekRows = rows.filter((r) => (chair === "all" || r.chairId === chair) && inFilter(r, status));
  const dayCount = (d: ISODate | "all") => (d === "all" ? weekRows.length : weekRows.filter((r) => r.date === d).length);

  function look(row: Row): Look {
    if (row.kind === "appt") {
      const a = row.appt;
      const patient = L.patient(a.patientId)?.name ?? "Patient";
      const type = L.type(a.typeId)?.name ?? "";
      if (a.status === "cancelled" || a.status === "no_show") {
        return {
          swatch: null,
          tone: "muted",
          chip: a.status === "no_show" ? "No-show" : "Cancelled",
          title: patient,
          sub: `${type}${a.cancellationSource && a.status === "cancelled" ? `, cancelled ${SOURCE_LABEL[a.cancellationSource]}` : ""}`,
        };
      }
      const recovered = Boolean(a.fromSlotId);
      return {
        swatch: recovered ? "bg-restore" : a.status === "completed" ? "bg-d6" : "bg-d4",
        tone: recovered ? "recovered" : a.status === "completed" ? "settled" : "queued",
        chip: recovered ? "Recovered" : a.status === "completed" ? "Completed" : "Booked",
        title: patient,
        sub: type,
      };
    }
    const s = row.slot;
    const src = L.appointment(s.sourceAppointmentId);
    const who = src ? L.patient(src.patientId)?.name : undefined;
    const origin = s.origin === "no_show" ? "No-show" : s.origin === "reschedule" ? "Moved" : s.origin === "released_gap" ? "Released gap" : "Cancelled";
    const title = who ? `${origin}: ${who}` : origin;
    const was = L.type(s.originalTypeId)?.name;
    const map: Record<Slot["status"], { swatch: string; tone: ChipTone; chip: string }> = {
      open: { swatch: "void", tone: "queued", chip: "Open" },
      offering: { swatch: "void-live", tone: "live", chip: "Offer out" },
      held: { swatch: "void-held", tone: "settled", chip: "Reserved" },
      lost: { swatch: "void-lost", tone: "muted", chip: "Lost" },
      closed: { swatch: "void-lost", tone: "muted", chip: "Left empty" },
      filled: { swatch: "restored", tone: "recovered", chip: "Filled" },
    };
    return { ...map[s.status], title, sub: s.heldNote ?? (was ? `Was ${was.toLowerCase()}` : "") };
  }

  const clearEditing = () => setEditing(null);
  const fill = (slot: Slot) => {
    useDemo.getState().selectSlot(slot.id, slot.date);
    router.push("/");
  };

  return (
    <div className={PAGE_CLS}>
      <PageHeader title="Appointments" description={`${data.clinic.name}, both branches. Cancel, move or fill chair-time from here.`} />

      <section aria-label="Filters" className="grid grid-cols-1 gap-3 lg:grid-cols-[auto_minmax(0,1fr)] lg:items-end">
        <div className="flex items-center gap-1">
          <Button size="sm" variant="secondary" aria-label="Previous week" onClick={() => { const w = addDays(weekFrom, -7); setWeekFrom(w); setDay(dayForWeek(w)); }}>
            <CaretLeftIcon className="size-3.5" />
          </Button>
          <p className="min-w-[10.5rem] px-2 text-center text-sm font-medium">
            {shortDate(weekFrom)} to {shortDate(weekEnd)}
          </p>
          <Button size="sm" variant="secondary" aria-label="Next week" onClick={() => { const w = addDays(weekFrom, 7); setWeekFrom(w); setDay(dayForWeek(w)); }}>
            <CaretRightIcon className="size-3.5" />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => { const w = weekStart(local.date); setWeekFrom(w); setDay(dayForWeek(w)); }}>
            This week
          </Button>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:max-w-xl lg:justify-self-end lg:w-full">
          <Field label="Chair">
            <select value={chair} onChange={(e) => setChair(e.target.value)} className={INPUT}>
              <option value="all">All chairs</option>
              {data.clinic.chairs.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}, {L.location(c.locationId)?.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Show">
            <select value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)} className={INPUT}>
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </section>

      <div role="tablist" aria-label="Day of the week" className="flex gap-1 overflow-x-auto pb-1">
        {(["all", ...openDays] as const).map((d) => {
          const active = day === d;
          const rel = d === "all" ? "All week" : relativeDay(d, local.date) === "today" ? "Today" : relativeDay(d, local.date) === "tomorrow" ? "Tomorrow" : shortDate(d);
          return (
            <button
              key={d}
              role="tab"
              aria-selected={active}
              onClick={() => setDay(d)}
              className={`flex h-9 shrink-0 items-center gap-2 rounded-cf px-3 text-sm transition-colors ${active ? "bg-ink text-d8" : "text-ink-2 hover:bg-panel-2 hover:text-ink"}`}
            >
              <span className="font-medium">{rel}</span>
              <span className={`num text-xs ${active ? "text-d7" : "text-ink-3"}`}>{dayCount(d)}</span>
            </button>
          );
        })}
      </div>

      <Panel title="Chair-time" caption={`${visible.length} row${visible.length === 1 ? "" : "s"}. Open time is listed beside the appointment that freed it.`}>
        <div className="hidden grid-cols-[minmax(170px,210px)_minmax(130px,170px)_minmax(0,1fr)_120px_minmax(210px,auto)] gap-x-4 border-b border-rule px-4 py-2 text-xs text-ink-3 md:grid">
          <span>Time</span>
          <span>Chair</span>
          <span>Patient and treatment</span>
          <span>Status</span>
          <span className="text-right">Actions</span>
        </div>
        {visible.length === 0 ? (
          <EmptyState title="Nothing matches these filters.">Try another week, chair or status. Cancelled appointments are under Cancelled and no-shows.</EmptyState>
        ) : (
          <ol>
            {visible.map((row, i) => {
              const showDay = i === 0 || visible[i - 1].date !== row.date;
              const lk = look(row);
              const chairRec = L.chair(row.chairId);
              const duration = row.kind === "appt" ? row.appt.durationMin : row.slot.durationMin;
              const isEditing = editing?.id === row.id;
              const isTarget = row.id === targetId;
              return (
                <li key={row.id} className={showDay ? "border-t border-rule first:border-t-0" : ""}>
                  {showDay && (
                    <p className="bg-panel/70 px-4 py-1.5 text-xs font-medium text-ink-2">
                      <span className="capitalize">{relativeDay(row.date, local.date)}</span>
                      {relativeDay(row.date, local.date) === shortDate(row.date) ? "" : `, ${shortDate(row.date)}`}
                    </p>
                  )}
                  <div
                    id={`row-${row.id}`}
                    className={`relative grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1.5 py-2.5 pl-5 pr-4 md:grid-cols-[minmax(170px,210px)_minmax(130px,170px)_minmax(0,1fr)_120px_minmax(210px,auto)] md:items-center ${
                      showDay ? "" : "border-t border-rule"
                    } ${isEditing || isTarget ? "bg-panel/70" : ""}`}
                  >
                    {lk.swatch && <span aria-hidden="true" className={`absolute inset-y-0 left-0 w-1 ${lk.swatch}`} />}
                    <div className="order-1 md:order-none">
                      <span className="num text-xs">{timeRange(row.startMin, duration)}</span>
                      <span className="num block text-[11px] text-ink-3">{durationLabel(duration)}</span>
                    </div>
                    <div className="order-4 col-span-2 min-w-0 text-sm md:order-none md:col-span-1">
                      <p className="truncate font-medium">{chairRec?.label}</p>
                      <p className="truncate text-xs text-ink-3">
                        {L.provider(row.kind === "appt" ? row.appt.providerId : row.slot.providerId)?.shortName}, {L.location(chairRec?.locationId ?? "")?.name}
                      </p>
                    </div>
                    <div className="order-3 col-span-2 min-w-0 md:order-none md:col-span-1">
                      <p className="truncate text-sm font-semibold">{lk.title}</p>
                      {lk.sub && <p className="truncate text-xs text-ink-2">{lk.sub}</p>}
                    </div>
                    <div className="order-2 justify-self-end md:order-none md:justify-self-start">
                      <Chip tone={lk.tone}>{lk.chip}</Chip>
                    </div>
                    <div className="order-5 col-span-2 flex flex-wrap gap-1 md:order-none md:col-span-1 md:justify-end">
                      <RowActions row={row} onEdit={(mode) => setEditing(isEditing && editing?.mode === mode ? null : { id: row.id, mode })} onFill={fill} />
                    </div>
                  </div>
                  {isEditing && editing && (
                    <div className="border-t border-rule bg-panel/70 px-4 py-4">
                      {row.kind === "appt" && editing.mode === "reschedule" && <RescheduleForm key={row.id} appt={row.appt} onDone={clearEditing} run={run} />}
                      {row.kind === "appt" && editing.mode === "cancel" && <CancelForm appt={row.appt} onDone={clearEditing} run={run} />}
                      {row.kind === "slot" && editing.mode === "reserve" && <ReserveForm slot={row.slot} onDone={clearEditing} run={run} />}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </Panel>
    </div>
  );
}

type Run = ReturnType<typeof useDemo.getState>["run"];

function RowActions({ row, onEdit, onFill }: { row: Row; onEdit: (m: EditMode) => void; onFill: (s: Slot) => void }) {
  const run = useDemo((s) => s.run);
  if (row.kind === "appt") {
    if (row.appt.status !== "booked") return null;
    return (
      <>
        <Button size="sm" variant="ghost" onClick={() => onEdit("reschedule")}>
          Reschedule
        </Button>
        <Button size="sm" variant="ghost" className="!text-danger hover:!bg-danger-wash" onClick={() => onEdit("cancel")}>
          Cancel
        </Button>
      </>
    );
  }
  const s = row.slot;
  if (s.status === "open") {
    return (
      <>
        <Button size="sm" variant="primary" onClick={() => onFill(s)}>
          Fill
        </Button>
        <Button size="sm" variant="ghost" onClick={() => onEdit("reserve")}>
          Reserve
        </Button>
        <Button size="sm" variant="ghost" onClick={() => run((st, now) => closeSlot(st, now, s.id, staffName()))}>
          Leave empty
        </Button>
      </>
    );
  }
  if (s.status === "offering") {
    return (
      <Button size="sm" onClick={() => onFill(s)}>
        See offers
      </Button>
    );
  }
  if (s.status === "held") {
    return (
      <>
        <Button size="sm" onClick={() => run((st, now) => releaseSlot(st, now, s.id, staffName()))}>
          Release
        </Button>
        <Button size="sm" variant="ghost" onClick={() => run((st, now) => closeSlot(st, now, s.id, staffName()))}>
          Leave empty
        </Button>
      </>
    );
  }
  if (s.status === "closed") {
    return (
      <Button size="sm" onClick={() => run((st, now) => releaseSlot(st, now, s.id, staffName()))}>
        Reopen
      </Button>
    );
  }
  return null;
}

function RescheduleForm({ appt, onDone, run }: { appt: Appointment; onDone: () => void; run: Run }) {
  const data = useData();
  const { local } = useNow();
  const L = lookup(data);
  const [date, setDate] = useState<ISODate>(appt.date);
  const [startMin, setStartMin] = useState(appt.startMin);
  const [chairId, setChairId] = useState(appt.chairId);
  const [error, setError] = useState<string | null>(null);

  const hours = data.clinic.hours[weekdayOf(date)];
  const times: number[] = [];
  if (hours) for (let m = hours.open; m + appt.durationMin <= hours.close; m += 15) times.push(m);
  const timeValue = times.includes(startMin) ? startMin : (times[0] ?? startMin);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (date === appt.date && timeValue === appt.startMin && chairId === appt.chairId) {
      setError("That is where it is booked now. Pick a different date, time or chair.");
      return;
    }
    const res = run((s, now) => rescheduleAppointment(s, now, appt.id, { date, startMin: timeValue, chairId }));
    if (res?.error) setError(res.error);
    else onDone();
  }

  return (
    <form onSubmit={submit} className="grid grid-cols-1 gap-4">
      <div>
        <h3 className="text-sm font-semibold">Move {L.patient(appt.patientId)?.name}</h3>
        <p className="mt-1 text-xs text-ink-2">
          {durationLabel(appt.durationMin)} for {L.type(appt.typeId)?.name.toLowerCase()}. The time left behind becomes open chair-time that ChairFill can fill.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label="Date">
          <input
            type="date"
            required
            min={local.date}
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              setError(null);
            }}
            className={INPUT}
          />
        </Field>
        <Field label="Start time">
          <select
            value={timeValue}
            disabled={times.length === 0}
            onChange={(e) => {
              setStartMin(Number(e.target.value));
              setError(null);
            }}
            className={INPUT}
          >
            {times.length === 0 && <option>Clinic closed</option>}
            {times.map((m) => (
              <option key={m} value={m}>
                {clock(m)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Chair">
          <select
            value={chairId}
            onChange={(e) => {
              setChairId(e.target.value);
              setError(null);
            }}
            className={INPUT}
          >
            {data.clinic.chairs.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}, {L.location(c.locationId)?.name}
              </option>
            ))}
          </select>
        </Field>
      </div>
      {!hours && <p className="text-xs text-ink-2">The clinic is closed on {shortDate(date)}. Pick another date.</p>}
      {error && <FormError>{error}</FormError>}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="primary" disabled={!hours || times.length === 0}>
          Move appointment
        </Button>
        <Button variant="ghost" onClick={onDone}>
          Keep as is
        </Button>
      </div>
    </form>
  );
}

function CancelForm({ appt, onDone, run }: { appt: Appointment; onDone: () => void; run: Run }) {
  const data = useData();
  const L = lookup(data);
  const [source, setSource] = useState<"patient_call" | "patient_message" | "clinic">("patient_call");
  const [note, setNote] = useState("");
  return (
    <div className="grid grid-cols-1 gap-4">
      <div>
        <h3 className="text-sm font-semibold">Cancel {L.patient(appt.patientId)?.name}&apos;s appointment</h3>
        <p className="mt-1 text-xs text-ink-2">ChairFill opens the freed time and ranks the waitlist for it straight away.</p>
      </div>
      <fieldset className="grid gap-1.5">
        <legend className="mb-1.5 text-xs font-medium text-ink-2">How did it come in?</legend>
        {(
          [
            ["patient_call", "Patient called"],
            ["patient_message", "Patient messaged"],
            ["clinic", "Clinic cancelled"],
          ] as const
        ).map(([v, label]) => (
          <label key={v} className="flex items-center gap-2 text-sm">
            <input type="radio" name={`src-${appt.id}`} checked={source === v} onChange={() => setSource(v)} className="accent-[var(--ink)]" />
            {label}
          </label>
        ))}
      </fieldset>
      <Field label="Note (optional, non-clinical)" className="sm:max-w-sm">
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="For example: travelling" className={INPUT} />
      </Field>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="danger"
          onClick={() => {
            const res = run((s, now) => cancelAppointment(s, now, appt.id, source, note.trim() || undefined));
            if (res && !res.error) onDone();
          }}
        >
          Cancel appointment
        </Button>
        <Button variant="ghost" onClick={onDone}>
          Keep appointment
        </Button>
      </div>
    </div>
  );
}

function ReserveForm({ slot, onDone, run }: { slot: Slot; onDone: () => void; run: Run }) {
  const [note, setNote] = useState("");
  return (
    <form
      className="grid grid-cols-1 gap-3 sm:max-w-md"
      onSubmit={(e) => {
        e.preventDefault();
        const res = run((s, now) => holdSlot(s, now, slot.id, note, staffName()));
        if (res && !res.error) onDone();
      }}
    >
      <Field label="Why reserve it?" hint="A reserved slot is not offered to the waitlist until you release it.">
        <input autoFocus value={note} onChange={(e) => setNote(e.target.value)} placeholder="For example: kept for a walk-in" className={INPUT} />
      </Field>
      <div className="flex gap-2">
        <Button type="submit" variant="primary">
          Reserve slot
        </Button>
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
