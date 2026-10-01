"use client";

import { useEffect, useMemo } from "react";
import { DemoBadge } from "@/components/brand";
import { WEEKDAY_LONG, clock, shortDate } from "@/lib/domain/time";
import { defaultFocus, loopStages, matchesFor } from "@/lib/demo/selectors";
import { useData, useDemo, useNow } from "@/lib/demo/store";
import { DayBook, DaySwitcher, Legend, type Focus } from "./day-book";
import { FocusPanel } from "./slot-panel";
import { LoopTracker } from "./loop-tracker";
import { RecoveryStrip } from "./recovery-strip";

export function TodayView() {
  const data = useData();
  const { local, nowTs, market } = useNow();
  const selectedSlotId = useDemo((s) => s.selectedSlotId);
  const selectedDate = useDemo((s) => s.selectedDate);
  const selectSlot = useDemo((s) => s.selectSlot);
  const selectDate = useDemo((s) => s.selectDate);
  const freshNotice = useDemo((s) => s.freshNotice);

  const apptFocusId = useDemo((s) => s.apptFocusId);
  const focusAppointment = useDemo((s) => s.focusAppointment);

  // First visit: focus the newest untouched cancellation so the story starts there.
  useEffect(() => {
    if (selectedSlotId === null && selectedDate === null && apptFocusId === null) {
      const f = defaultFocus(data, local);
      if (f) selectSlot(f.id, f.date);
      else selectDate(local.date);
    }
  }, [data, local, selectedSlotId, selectedDate, apptFocusId, selectSlot, selectDate]);

  const date = selectedDate ?? local.date;
  // Focus lives in the store so other screens can deep-link to a slot.
  const focus: Focus = selectedSlotId ? { kind: "slot", id: selectedSlotId } : apptFocusId ? { kind: "appt", id: apptFocusId } : null;
  const slot = focus?.kind === "slot" ? data.slots.find((s) => s.id === focus.id) : undefined;
  const stages = useMemo(() => (slot ? loopStages(data, slot, matchesFor(data, slot, nowTs).ranked.length) : null), [data, slot, nowTs]);

  const setFocus = (f: Focus) => {
    if (f?.kind === "slot") selectSlot(f.id, data.slots.find((x) => x.id === f.id)?.date ?? date);
    else if (f?.kind === "appt") focusAppointment(f.id);
    else {
      selectSlot(null);
      focusAppointment(null);
    }
    // On narrow screens the panel sits above the book; bring it into view.
    if (f && window.matchMedia("(max-width: 1023px)").matches) {
      requestAnimationFrame(() => document.getElementById("focus-panel")?.scrollIntoView({ block: "start" }));
    }
  };

  return (
    <div className="mx-auto grid max-w-[1600px] grid-cols-1 gap-5 px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.02em]">Today</h1>
          <p className="mt-1 text-sm text-ink-2">
            {WEEKDAY_LONG[local.weekday]} {shortDate(local.date).slice(4)}, {clock(local.minutes)} {market.timeZoneLabel}. {data.clinic.name}, both branches.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-ink-3">
          {freshNotice && <span>{freshNotice}</span>}
          <DemoBadge />
        </div>
      </header>

      <RecoveryStrip />

      {slot && stages && <LoopTracker slot={slot} stages={stages} />}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_400px] xl:grid-cols-[minmax(0,1fr)_440px]">
        <section aria-label="Day book" className="grid min-w-0 grid-cols-1 content-start gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <DaySwitcher date={date} onChange={selectDate} />
          </div>
          <Legend />
          <DayBook date={date} focus={focus} onFocus={setFocus} />
        </section>

        <aside
          id="focus-panel"
          aria-label="Selected slot"
          className={`scroll-mt-16 overflow-hidden rounded-cf bg-surface shadow-[inset_0_0_0_1px_var(--rule)] lg:sticky lg:top-6 lg:max-h-[calc(100dvh-3rem)] lg:overflow-y-auto ${
            focus ? "max-lg:order-first" : "max-lg:hidden"
          }`}
        >
          <FocusPanel focus={focus} onFocus={setFocus} onClose={() => setFocus(null)} />
        </aside>
      </div>
    </div>
  );
}
