"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";
import { PhoneIcon, XIcon } from "@phosphor-icons/react";
import { patientRespond, type ReplyIntent } from "@/lib/demo/actions";
import { useDemo } from "@/lib/demo/store";
import { lookup } from "@/lib/demo/selectors";
import { MARKETS } from "@/lib/domain/markets";
import { clock, localNow, untilLabel } from "@/lib/domain/time";
import { channelName } from "@/lib/demo/seed";
import { ChannelIcon } from "@/components/today/candidates";

/**
 * The patient's side of the conversation, simulated in the browser. Staff use it
 * to play the patient during a demo. It never sends anything anywhere.
 */
export function PatientPhone() {
  const offerId = useDemo((s) => s.phoneOfferId);
  const data = useDemo((s) => s.data);
  const nowTs = useDemo((s) => s.nowTs);
  const run = useDemo((s) => s.run);
  const close = useDemo((s) => s.openPhone);
  const reduce = useReducedMotion();
  const end = useRef<HTMLDivElement>(null);

  const offer = data && offerId ? data.offers.find((o) => o.id === offerId) : undefined;
  const thread = data && offer ? data.messages.filter((m) => m.patientId === offer.patientId).sort((a, b) => a.at - b.at) : [];

  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [thread.length, offerId]);

  useEffect(() => {
    if (!offerId) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [offerId, close]);

  const L = data ? lookup(data) : null;
  const patient = offer && L ? L.patient(offer.patientId) : undefined;
  const live = offer && (offer.status === "sent" || offer.status === "contact_requested") && (offer.expiresAt === null || nowTs <= offer.expiresAt);
  const tz = data ? MARKETS[data.clinic.market].timeZone : "UTC";

  const reply = (intent: ReplyIntent) => offer && run((s, now) => patientRespond(s, now, offer.id, intent));

  return (
    <AnimatePresence>
      {offer && patient && data && (
        <motion.section
          role="dialog"
          aria-label={`Simulated phone for ${patient.name}`}
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: 24 }}
          transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          className="fixed inset-x-0 bottom-0 z-50 flex max-h-[85dvh] flex-col overflow-hidden rounded-t-[14px] bg-mount text-on-dark shadow-lift sm:inset-x-auto sm:bottom-6 sm:right-6 sm:h-[600px] sm:w-[360px] sm:rounded-[18px] sm:ring-1 sm:ring-d3"
        >
          <header className="flex items-center gap-3 border-b border-d2 px-4 py-3">
            <div className="grid size-9 place-items-center rounded-full bg-d2 text-sm font-semibold text-d8">{data.clinic.name.slice(0, 1)}</div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-d8">{data.clinic.name}</p>
              <p className="flex items-center gap-1.5 text-xs text-on-dark-2">
                <ChannelIcon channel={offer.channel} className="size-3" /> {channelName(offer.channel)} on {patient.name}&apos;s phone
              </p>
            </div>
            <button type="button" onClick={() => close(null)} aria-label="Close phone" className="grid size-8 place-items-center rounded-cf text-on-dark-2 hover:bg-d2 hover:text-d8">
              <XIcon className="size-4" />
            </button>
          </header>

          <p className="bg-amber px-4 py-1.5 text-center text-[11px] font-semibold text-d0">Simulated patient phone. Nothing is sent to a real device.</p>

          <div className="flex-1 overflow-y-auto px-3 py-4">
            <ol className="grid gap-2">
              {thread.map((m) => {
                const fromPatient = m.direction === "inbound";
                const system = m.direction === "system";
                if (system) {
                  return (
                    <li key={m.id} className="mx-auto max-w-[85%] text-center text-[11px] text-on-dark-2">
                      {m.body}
                    </li>
                  );
                }
                const isActive = m.offerId === offer.id;
                return (
                  <li key={m.id} className={`flex ${fromPatient ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[82%] rounded-[12px] px-3 py-2 text-sm leading-relaxed ${
                        fromPatient ? "rounded-br-[4px] bg-restore text-d8" : `rounded-bl-[4px] bg-d2 text-d8 ${isActive ? "" : "opacity-80"}`
                      }`}
                    >
                      <p>{m.body}</p>
                      <p className="num mt-1 text-right text-[10px] opacity-70">{clock(localNow(m.at, tz).minutes)}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
            <div ref={end} />
          </div>

          <footer className="border-t border-d2 p-3">
            {live ? (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => reply("accept")}
                    className="h-11 rounded-[10px] bg-restore-bright text-sm font-semibold text-d0 transition hover:brightness-110 active:translate-y-px"
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    onClick={() => reply("decline")}
                    className="h-11 rounded-[10px] bg-d2 text-sm font-semibold text-d8 transition hover:bg-d3 active:translate-y-px"
                  >
                    Decline
                  </button>
                  <button
                    type="button"
                    onClick={() => reply("contact")}
                    disabled={offer.status === "contact_requested"}
                    className="col-span-2 inline-flex h-10 items-center justify-center gap-2 rounded-[10px] text-sm font-medium text-on-dark ring-1 ring-d3 transition hover:bg-d2 disabled:opacity-50"
                  >
                    <PhoneIcon className="size-4" /> {offer.status === "contact_requested" ? "Call requested" : "Contact clinic"}
                  </button>
                </div>
                {offer.expiresAt && <p className="num mt-2 text-center text-[11px] text-on-dark-2">Offer open for {untilLabel(offer.expiresAt, nowTs)}</p>}
              </>
            ) : (
              <p className="py-2 text-center text-xs text-on-dark-2">This offer is closed. Replies are only possible while an offer is open.</p>
            )}
          </footer>
        </motion.section>
      )}
    </AnimatePresence>
  );
}
