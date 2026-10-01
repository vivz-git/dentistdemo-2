"use client";

import { DeviceMobileIcon } from "@phosphor-icons/react";
import type { Campaign, Offer, Slot } from "@/lib/domain/types";
import { agoLabel, untilLabel } from "@/lib/domain/time";
import { bookManually, confirmAcceptedOffer, stopCampaign } from "@/lib/demo/actions";
import { lookup, offersFor } from "@/lib/demo/selectors";
import { readSession, useData, useDemo, useNow } from "@/lib/demo/store";
import { Button } from "@/components/ui/button";
import { ChannelIcon } from "./candidates";

const STATUS: Record<Offer["status"], { label: string; cls: string }> = {
  sent: { label: "Awaiting reply", cls: "bg-amber-wash text-amber-ink shadow-[inset_0_0_0_1px_var(--amber)]" },
  contact_requested: { label: "Asked for a call", cls: "bg-amber-wash text-amber-ink shadow-[inset_0_0_0_1px_var(--amber)]" },
  accepted: { label: "Accepted", cls: "bg-restore-wash text-restore shadow-[inset_0_0_0_1px_var(--restore)]" },
  declined: { label: "Declined", cls: "bg-panel-2 text-ink-2" },
  expired: { label: "No reply, expired", cls: "bg-panel-2 text-ink-2" },
  superseded: { label: "Closed", cls: "bg-panel-2 text-ink-3" },
  queued: { label: "Queued", cls: "bg-surface text-ink-2 shadow-[inset_0_0_0_1px_var(--rule-strong)]" },
};

export function staffName() {
  const s = readSession();
  return s ? `${s.name.split(" ")[0]} (front desk)` : "Front desk";
}

export function OfferStatusChip({ status }: { status: Offer["status"] }) {
  const st = STATUS[status];
  return <span className={`inline-flex h-5 items-center rounded-cf-sm px-1.5 text-[11px] font-medium ${st.cls}`}>{st.label}</span>;
}

export function LiveOffers({ slot, campaign }: { slot: Slot; campaign: Campaign }) {
  const data = useData();
  const { nowTs } = useNow();
  const run = useDemo((s) => s.run);
  const openPhone = useDemo((s) => s.openPhone);
  const L = lookup(data);
  const offers = offersFor(data, campaign.id);
  const live = offers.some((o) => o.status === "sent" || o.status === "contact_requested");
  const awaitingConfirm = slot.status === "held" ? offers.find((o) => o.status === "accepted") : undefined;

  return (
    <div className="py-4">
      <div className="px-5">
        <h3 className="text-sm font-semibold">{awaitingConfirm ? "Accepted, waiting for your confirmation" : "Fill campaign"}</h3>
        <p className="mt-1 text-xs text-ink-2">
          Approved by {campaign.approvedBy} {agoLabel(campaign.createdAt, nowTs)}. {campaign.mode === "simultaneous" ? "All at once" : "One at a time"},{" "}
          {campaign.offerWindowMin} min to reply.
        </p>
      </div>

      {live && (
        <p className="mx-5 mt-3 flex items-start gap-2 rounded-cf bg-amber-wash p-3 text-xs text-amber-ink">
          <DeviceMobileIcon className="mt-px size-4 flex-none" />
          <span>
            <span className="font-semibold">Play the patient.</span> Open a patient&apos;s simulated phone and tap Accept, Decline or Contact clinic. Nothing is booked
            until a patient accepts.
          </span>
        </p>
      )}

      <ol className="mt-3 divide-y divide-rule border-y border-rule">
        {offers.map((o) => {
          const p = L.patient(o.patientId)!;
          const isLive = o.status === "sent" || o.status === "contact_requested";
          return (
            <li key={o.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-5 py-3">
              <span className="num w-4 text-xs text-ink-3">{o.rank}</span>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <span className="truncate">{p.name}</span>
                  <ChannelIcon channel={o.channel} className="size-3.5 flex-none text-ink-3" />
                  <span className="num text-xs font-normal text-ink-3">{o.score}</span>
                </p>
                <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-ink-3">
                  <OfferStatusChip status={o.status} />
                  {isLive && o.expiresAt && <span className="num">expires in {untilLabel(o.expiresAt, nowTs)}</span>}
                  {o.respondedAt && o.sentAt && <span className="num">replied in {Math.max(1, Math.round((o.respondedAt - o.sentAt) / 60000))} min</span>}
                </p>
              </div>
              <div className="flex gap-1.5">
                {(isLive || o.status === "accepted" || o.status === "declined") && (
                  <Button size="sm" variant={isLive ? "primary" : "ghost"} onClick={() => openPhone(o.id)}>
                    <DeviceMobileIcon className="size-3.5" /> {isLive ? "Open phone" : "Thread"}
                  </Button>
                )}
                {o.status === "contact_requested" && (
                  <Button size="sm" onClick={() => run((s, now) => bookManually(s, now, slot.id, o.waitlistEntryId, staffName()))}>
                    Book after call
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      <div className="flex flex-wrap gap-2 px-5 pt-4">
        {awaitingConfirm && (
          <Button variant="primary" onClick={() => run((s, now) => confirmAcceptedOffer(s, now, awaitingConfirm.id, staffName()))}>
            Confirm booking
          </Button>
        )}
        {campaign.status === "live" && !awaitingConfirm && (
          <Button variant="ghost" onClick={() => run((s, now) => stopCampaign(s, now, campaign.id, staffName()))}>
            Stop campaign
          </Button>
        )}
      </div>
    </div>
  );
}
