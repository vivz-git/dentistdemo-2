"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CaretDownIcon, DeviceMobileIcon } from "@phosphor-icons/react";
import type { Campaign, CampaignStatus, Offer, Slot } from "@/lib/domain/types";
import { agoLabel, relativeDay, timeRange, untilLabel } from "@/lib/domain/time";
import { lookup, offersFor } from "@/lib/demo/selectors";
import { useData, useDemo, useNow } from "@/lib/demo/store";
import { Button } from "@/components/ui/button";
import { Chip, type ChipTone } from "@/components/ui/chip";
import { EmptyState, PAGE_CLS, PageHeader, Panel } from "@/components/ui/page";
import { ChannelIcon } from "@/components/today/candidates";
import { OfferStatusChip } from "@/components/today/live-offers";

type Filter = "all" | "live" | "filled" | "unfilled";

const CAMPAIGN_STATUS: Record<CampaignStatus, { tone: ChipTone; label: string }> = {
  live: { tone: "live", label: "Live, awaiting replies" },
  filled: { tone: "recovered", label: "Filled" },
  exhausted: { tone: "settled", label: "Not filled" },
  stopped: { tone: "muted", label: "Stopped by staff" },
};

const SLOT_SWATCH: Record<Slot["status"], string> = {
  open: "void",
  offering: "void-live",
  held: "void-held",
  filled: "restored",
  lost: "void-lost",
  closed: "void-lost",
};

const ACTIVITY_PAGE = 30;

export function CampaignsView() {
  const data = useData();
  const { nowTs, local } = useNow();
  const [filter, setFilter] = useState<Filter>("all");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [activityCount, setActivityCount] = useState(ACTIVITY_PAGE);

  const campaigns = useMemo(() => [...data.campaigns].sort((a, b) => b.createdAt - a.createdAt), [data.campaigns]);
  const counts = {
    all: campaigns.length,
    live: campaigns.filter((c) => c.status === "live").length,
    filled: campaigns.filter((c) => c.status === "filled").length,
    unfilled: campaigns.filter((c) => c.status === "exhausted" || c.status === "stopped").length,
  };
  const shown = campaigns.filter((c) => (filter === "all" ? true : filter === "unfilled" ? c.status === "exhausted" || c.status === "stopped" : c.status === filter));
  // The newest few and anything live start open; older history stays collapsed.
  const isOpen = (c: Campaign, i: number) => expanded[c.id] ?? (c.status === "live" || i < 3);

  const activity = useMemo(() => [...data.activity].sort((a, b) => b.at - a.at), [data.activity]);

  return (
    <div className={PAGE_CLS}>
      <PageHeader title="Campaigns" description="Every fill campaign staff approved, who was asked, and how they answered. Messages are simulated." />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="grid min-w-0 grid-cols-1 content-start gap-3">
          <div role="tablist" aria-label="Campaign status" className="flex gap-1 overflow-x-auto pb-1">
            {(
              [
                ["all", "All"],
                ["live", "Live"],
                ["filled", "Filled"],
                ["unfilled", "Not filled"],
              ] as const
            ).map(([v, label]) => (
              <button
                key={v}
                role="tab"
                aria-selected={filter === v}
                onClick={() => setFilter(v)}
                className={`flex h-9 shrink-0 items-center gap-2 rounded-cf px-3 text-sm transition-colors ${filter === v ? "bg-ink text-d8" : "text-ink-2 hover:bg-panel-2 hover:text-ink"}`}
              >
                <span className="font-medium">{label}</span>
                <span className={`num text-xs ${filter === v ? "text-d7" : "text-ink-3"}`}>{counts[v]}</span>
              </button>
            ))}
          </div>

          <Panel title="Fill campaigns" caption="Newest first. Response time is from send to the patient's reply.">
            {shown.length === 0 ? (
              <EmptyState title="No campaigns here.">Approve an offer from Today and it will appear in this list.</EmptyState>
            ) : (
              <ol>
                {shown.map((c, i) => (
                  <CampaignRow
                    key={c.id}
                    campaign={c}
                    open={isOpen(c, i)}
                    onToggle={() => setExpanded((cur) => ({ ...cur, [c.id]: !isOpen(c, i) }))}
                    first={i === 0}
                  />
                ))}
              </ol>
            )}
          </Panel>
        </div>

        <Panel title="Activity" caption="Everything ChairFill and staff did, newest first." className="xl:sticky xl:top-6 xl:self-start">
          {activity.length === 0 ? (
            <EmptyState title="No activity yet." />
          ) : (
            <>
              <ol className="max-h-[70dvh] divide-y divide-rule overflow-y-auto">
                {activity.slice(0, activityCount).map((e) => (
                  <li key={e.id} className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-x-3 px-4 py-2.5 text-xs">
                    <span className="num text-ink-3">{agoLabel(e.at, nowTs)}</span>
                    <span className="text-ink-2">
                      {e.text}
                      {e.slotId && <SlotRef slotId={e.slotId} today={local.date} />}
                    </span>
                  </li>
                ))}
              </ol>
              {activity.length > activityCount && (
                <div className="border-t border-rule px-4 py-2.5">
                  <Button size="sm" variant="ghost" onClick={() => setActivityCount((n) => n + ACTIVITY_PAGE)}>
                    Show {Math.min(ACTIVITY_PAGE, activity.length - activityCount)} more
                  </Button>
                </div>
              )}
            </>
          )}
        </Panel>
      </div>
    </div>
  );
}

function SlotRef({ slotId, today }: { slotId: string; today: string }) {
  const data = useData();
  const slot = data.slots.find((s) => s.id === slotId);
  if (!slot) return null;
  return (
    <span className="block text-[11px] text-ink-3">
      <span className="capitalize">{relativeDay(slot.date, today)}</span>, {timeRange(slot.startMin, slot.durationMin)}
    </span>
  );
}

function CampaignRow({ campaign: c, open, onToggle, first }: { campaign: Campaign; open: boolean; onToggle: () => void; first: boolean }) {
  const data = useData();
  const { nowTs, local } = useNow();
  const router = useRouter();
  const L = lookup(data);
  const slot = data.slots.find((s) => s.id === c.slotId);
  const offers = offersFor(data, c.id);
  const st = CAMPAIGN_STATUS[c.status];
  const replies = offers.filter((o) => o.respondedAt && o.sentAt).map((o) => Math.max(1, Math.round((o.respondedAt! - o.sentAt!) / 60_000)));
  const fastest = replies.length ? Math.min(...replies) : null;
  const regionId = `campaign-${c.id}`;
  const accepted = offers.find((o) => o.status === "accepted");
  const awaiting = offers.filter((o) => o.status === "sent" || o.status === "contact_requested").length;
  const outcome =
    c.status === "live"
      ? awaiting
        ? `${awaiting} awaiting reply`
        : "Waiting for staff"
      : accepted
        ? `Filled by ${L.patient(accepted.patientId)?.name}`
        : `${offers.filter((o) => o.status === "declined").length} declined, ${offers.filter((o) => o.status === "expired").length} no reply`;

  return (
    <li className={first ? "" : "border-t border-rule"}>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 px-4 py-3">
        <div className="flex min-w-0 flex-1 basis-[18rem] items-start gap-2.5">
          <span aria-hidden="true" className={`swatch mt-1 ${slot ? SLOT_SWATCH[slot.status] : ""}`} />
          <div className="min-w-0">
            <p className="text-sm font-semibold">
              {slot ? (
                <>
                  <span className="capitalize">{relativeDay(slot.date, local.date)}</span>, <span className="num font-normal">{timeRange(slot.startMin, slot.durationMin)}</span>
                </>
              ) : (
                "Slot no longer in the book"
              )}
            </p>
            <p className="text-xs text-ink-2">
              {slot ? `${L.chair(slot.chairId)?.label}, ${L.provider(slot.providerId)?.shortName}, ${L.location(slot.locationId)?.name}` : ""}
            </p>
            <p className={`mt-1 text-xs font-medium ${c.status === "live" ? "text-amber-ink" : c.status === "filled" ? "text-restore" : "text-ink-2"}`}>{outcome}</p>
            <p className="text-xs text-ink-3">
              Approved by {c.approvedBy}, {agoLabel(c.createdAt, nowTs)}. {c.mode === "simultaneous" ? "All at once" : "One at a time"}, <span className="num">{c.offerWindowMin}</span> min to reply
              {fastest !== null && (
                <>
                  . First reply in <span className="num">{fastest}</span> min
                </>
              )}
              .
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Chip tone={st.tone}>{st.label}</Chip>
          {slot && c.status === "live" && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                useDemo.getState().selectSlot(slot.id, slot.date);
                router.push("/");
              }}
            >
              Open on Today
            </Button>
          )}
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={open}
            aria-controls={regionId}
            className="inline-flex h-8 items-center gap-1.5 rounded-cf px-2 text-xs font-medium text-ink-2 hover:bg-panel-2 hover:text-ink"
          >
            <span className="num">{offers.length}</span> {offers.length === 1 ? "offer" : "offers"}
            <CaretDownIcon className={`size-3 transition-transform ${open ? "rotate-180" : ""}`} />
          </button>
        </div>
      </div>
      {open && (
        <ol id={regionId} className="divide-y divide-rule border-t border-rule bg-panel/50">
          {offers.map((o) => (
            <OfferRow key={o.id} offer={o} nowTs={nowTs} />
          ))}
        </ol>
      )}
    </li>
  );
}

function responseLabel(o: Offer, nowTs: number): string {
  if (o.respondedAt && o.sentAt) return `Replied in ${Math.max(1, Math.round((o.respondedAt - o.sentAt) / 60_000))} min`;
  if ((o.status === "sent" || o.status === "contact_requested") && o.expiresAt) return `Expires in ${untilLabel(o.expiresAt, nowTs)}`;
  if (o.status === "expired") return "No reply";
  if (o.status === "queued") return "Not sent yet";
  return "No reply";
}

function OfferRow({ offer: o, nowTs }: { offer: Offer; nowTs: number }) {
  const data = useData();
  const openPhone = useDemo((s) => s.openPhone);
  const patient = lookup(data).patient(o.patientId);
  const live = o.status === "sent" || o.status === "contact_requested";
  const hasThread = live || o.status === "accepted" || o.status === "declined";
  return (
    <li className="grid grid-cols-[1.25rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 py-2.5 pl-4 pr-4 sm:pl-9">
      <span className="num text-xs text-ink-3">{o.rank}</span>
      <div className="min-w-0">
        <p className="flex items-center gap-2 text-sm font-medium">
          <span className="truncate">{patient?.name}</span>
          <ChannelIcon channel={o.channel} className="size-3.5 flex-none text-ink-3" />
          <span className="num text-xs font-normal text-ink-3">{o.score}</span>
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-ink-3">
          <OfferStatusChip status={o.status} />
          <span className="num">{responseLabel(o, nowTs)}</span>
        </p>
      </div>
      {hasThread ? (
        <Button size="sm" variant={live ? "primary" : "ghost"} onClick={() => openPhone(o.id)}>
          <DeviceMobileIcon className="size-3.5" /> {live ? "Open phone" : "Thread"}
        </Button>
      ) : (
        <span />
      )}
    </li>
  );
}
