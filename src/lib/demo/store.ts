"use client";

import { create } from "zustand";
import type { DemoState, ISODate, Timestamp } from "@/lib/domain/types";
import { MARKETS } from "@/lib/domain/markets";
import { localNow } from "@/lib/domain/time";
import { SEED_VERSION, createSeed } from "./seed";
import { tick, type ActionResult } from "./actions";

/**
 * Client store for the demo. The only persistence is localStorage, behind
 * `DemoRepository`; a Supabase implementation can replace it without touching UI.
 */

export interface DemoRepository {
  load(): DemoState | null;
  save(state: DemoState): void;
  clear(): void;
}

const KEY = `chairfill.demo.v${SEED_VERSION}`;

export const localRepository: DemoRepository = {
  load() {
    try {
      const raw = window.localStorage.getItem(KEY);
      return raw ? (JSON.parse(raw) as DemoState) : null;
    } catch {
      return null;
    }
  },
  save(state) {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      // Storage full or blocked (private mode). The demo keeps working in memory.
    }
  },
  clear() {
    try {
      window.localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
  },
};

export type ToastTone = "info" | "success" | "error";
export interface Toast {
  id: number;
  text: string;
  tone: ToastTone;
}

interface DemoStore {
  data: DemoState | null;
  nowTs: Timestamp;
  toasts: Toast[];
  freshNotice: string | null;
  selectedSlotId: string | null;
  selectedDate: ISODate | null;
  apptFocusId: string | null;
  phoneOfferId: string | null;

  init(): void;
  run(action: (s: DemoState, nowTs: Timestamp) => ActionResult): ActionResult | null;
  fastForward(minutes: number): void;
  reset(): void;
  toast(text: string, tone?: ToastTone): void;
  dismiss(id: number): void;
  selectSlot(id: string | null, date?: ISODate): void;
  focusAppointment(id: string | null): void;
  selectDate(date: ISODate): void;
  openPhone(offerId: string | null): void;
}

let timer: ReturnType<typeof setInterval> | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let toastSeq = 0;

function clockNow(data: DemoState | null): Timestamp {
  return Date.now() + (data?.clockOffsetMin ?? 0) * 60_000;
}

function dayOf(ts: Timestamp, data: DemoState) {
  return localNow(ts, MARKETS[data.clinic.market].timeZone).date;
}

export const useDemo = create<DemoStore>()((set, get) => ({
  data: null,
  nowTs: 0,
  toasts: [],
  freshNotice: null,
  selectedSlotId: null,
  selectedDate: null,
  apptFocusId: null,
  phoneOfferId: null,

  init() {
    if (get().data) return;
    let data = localRepository.load();
    let freshNotice: string | null = null;
    const realNow = Date.now();
    // Re-seed when missing, outdated, or from a previous day, so the scenario is always live.
    if (!data || data.version !== SEED_VERSION || dayOf(data.seededAt, data) !== dayOf(realNow, data)) {
      if (data) freshNotice = "Demo data refreshed for today.";
      data = createSeed(realNow);
      localRepository.save(data);
    }
    const nowTs = clockNow(data);
    data = tick(data, nowTs);
    set({ data, nowTs, freshNotice });

    if (timer) clearInterval(timer);
    timer = setInterval(() => {
      const { data: d } = get();
      if (!d) return;
      const ts = clockNow(d);
      const next = tick(d, ts);
      set({ nowTs: ts, ...(next !== d ? { data: next } : {}) });
    }, 15_000);

    useDemo.subscribe((st, prev) => {
      if (st.data && st.data !== prev.data) {
        if (saveTimer) clearTimeout(saveTimer);
        const snapshot = st.data;
        saveTimer = setTimeout(() => localRepository.save(snapshot), 300);
      }
    });
  },

  run(action) {
    const { data } = get();
    if (!data) return null;
    const nowTs = clockNow(data);
    const result = action(data, nowTs);
    if (result.error) {
      get().toast(result.error, "error");
      return result;
    }
    set({ data: result.state, nowTs });
    if (result.notice) get().toast(result.notice, "success");
    return result;
  },

  fastForward(minutes) {
    const { data } = get();
    if (!data) return;
    const shifted = { ...data, clockOffsetMin: data.clockOffsetMin + minutes };
    const nowTs = clockNow(shifted);
    set({ data: tick(shifted, nowTs), nowTs });
    get().toast(`Demo clock moved forward ${minutes} min.`, "info");
  },

  reset() {
    localRepository.clear();
    const data = createSeed(Date.now());
    localRepository.save(data);
    set({ data, nowTs: clockNow(data), selectedSlotId: null, selectedDate: null, apptFocusId: null, phoneOfferId: null });
    get().toast("Demo reset to the starting scenario.", "info");
  },

  toast(text, tone = "info") {
    const id = ++toastSeq;
    set((st) => ({ toasts: [...st.toasts.slice(-2), { id, text, tone }] }));
    setTimeout(() => get().dismiss(id), tone === "error" ? 7000 : 4500);
  },

  dismiss(id) {
    set((st) => ({ toasts: st.toasts.filter((t) => t.id !== id) }));
  },

  selectSlot(id, date) {
    set((st) => ({ selectedSlotId: id, apptFocusId: null, selectedDate: date ?? st.selectedDate }));
  },

  focusAppointment(id) {
    set({ apptFocusId: id, selectedSlotId: null });
  },

  selectDate(date) {
    set({ selectedDate: date });
  },

  openPhone(offerId) {
    set({ phoneOfferId: offerId });
  },
}));

/** Selector helpers. */
export function useData(): DemoState {
  const data = useDemo((s) => s.data);
  if (!data) throw new Error("useData called before the demo store was hydrated");
  return data;
}

export function useNow() {
  const nowTs = useDemo((s) => s.nowTs);
  const data = useData();
  return { nowTs, local: localNow(nowTs, MARKETS[data.clinic.market].timeZone), market: MARKETS[data.clinic.market] };
}

// ---------------------------------------------------------------- demo session

export interface Session {
  name: string;
  role: string;
  email: string;
}

const SESSION_KEY = "chairfill.session";

export function readSession(): Session | null {
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export function writeSession(s: Session | null) {
  try {
    if (s) window.localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    else window.localStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

export const DEMO_LOGIN = {
  email: "frontdesk@tulsi.demo",
  password: "chairfill-demo",
  name: "Pooja Nanda",
  role: "Front desk",
} as const;
