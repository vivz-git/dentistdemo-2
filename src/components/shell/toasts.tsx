"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { CheckIcon, InfoIcon, WarningIcon, XIcon } from "@phosphor-icons/react";
import { useDemo } from "@/lib/demo/store";

export function Toasts() {
  const toasts = useDemo((s) => s.toasts);
  const dismiss = useDemo((s) => s.dismiss);
  const reduce = useReducedMotion();
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed bottom-4 left-1/2 z-50 grid w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 gap-2 lg:left-auto lg:right-6 lg:translate-x-0"
    >
      <AnimatePresence initial={false}>
        {toasts.map((t) => {
          const Icon = t.tone === "success" ? CheckIcon : t.tone === "error" ? WarningIcon : InfoIcon;
          return (
            <motion.div
              key={t.id}
              layout={!reduce}
              initial={reduce ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              role={t.tone === "error" ? "alert" : "status"}
              className={`pointer-events-auto flex items-start gap-3 rounded-cf px-4 py-3 text-sm shadow-lift ${
                t.tone === "error" ? "bg-danger text-d8" : "bg-ink text-d8"
              }`}
            >
              <Icon weight="bold" className={`mt-0.5 size-4 flex-none ${t.tone === "success" ? "text-restore-bright" : ""}`} />
              <p className="flex-1">{t.text}</p>
              <button type="button" aria-label="Dismiss" onClick={() => dismiss(t.id)} className="-m-1 p-1 opacity-70 hover:opacity-100">
                <XIcon className="size-3.5" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
