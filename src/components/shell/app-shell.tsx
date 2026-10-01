"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  SquaresFourIcon,
  CalendarBlankIcon,
  UsersThreeIcon,
  PaperPlaneTiltIcon,
  ChartBarIcon,
  GearSixIcon,
  SignOutIcon,
  FastForwardIcon,
  ArrowCounterClockwiseIcon,
  ListIcon,
  XIcon,
} from "@phosphor-icons/react";
import { Wordmark } from "@/components/brand";
import { readSession, useDemo, writeSession, type Session } from "@/lib/demo/store";
import { Toasts } from "./toasts";
import { PatientPhone } from "@/components/phone/patient-phone";

const NAV = [
  { href: "/", label: "Today", icon: SquaresFourIcon },
  { href: "/appointments", label: "Appointments", icon: CalendarBlankIcon },
  { href: "/waitlist", label: "Waitlist", icon: UsersThreeIcon },
  { href: "/campaigns", label: "Campaigns", icon: PaperPlaneTiltIcon },
  { href: "/analytics", label: "Analytics", icon: ChartBarIcon },
  { href: "/settings", label: "Settings", icon: GearSixIcon },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const init = useDemo((s) => s.init);
  const ready = useDemo((s) => s.data !== null);
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    const s = readSession();
    if (!s) {
      router.replace("/login");
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- session lives in localStorage, only readable after mount
    setSession(s);
    init();
  }, [init, router]);

  if (!session || !ready) return <ShellSkeleton />;

  return (
    <div className="min-h-[100dvh] lg:grid lg:grid-cols-[232px_minmax(0,1fr)]">
      <Rail session={session} />
      <div className="min-w-0">
        <MobileBar session={session} />
        <main className="min-w-0">{children}</main>
      </div>
      <PatientPhone />
      <Toasts />
    </div>
  );
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const path = usePathname();
  return (
    <nav aria-label="Main" className="grid gap-0.5">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = href === "/" ? path === "/" : path.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={`flex h-9 items-center gap-3 rounded-cf px-3 text-sm transition-colors ${
              active ? "bg-d2 font-medium text-d8" : "text-on-dark-2 hover:bg-mount-2 hover:text-on-dark"
            }`}
          >
            <Icon className="size-[18px]" weight={active ? "fill" : "regular"} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

function DemoControls() {
  const fastForward = useDemo((s) => s.fastForward);
  const reset = useDemo((s) => s.reset);
  const [confirming, setConfirming] = useState(false);
  return (
    <div className="grid gap-1.5">
      <p className="px-3 text-xs font-medium text-on-dark-2">Demo controls</p>
      <button
        type="button"
        onClick={() => fastForward(15)}
        className="flex h-8 items-center gap-3 rounded-cf px-3 text-left text-sm text-on-dark-2 transition-colors hover:bg-mount-2 hover:text-on-dark"
      >
        <FastForwardIcon className="size-4" /> Skip ahead 15 min
      </button>
      {confirming ? (
        <div className="flex items-center gap-1 px-1">
          <button
            type="button"
            onClick={() => {
              reset();
              setConfirming(false);
            }}
            className="h-8 flex-1 rounded-cf bg-d8 px-2 text-sm font-medium text-ink"
          >
            Reset demo
          </button>
          <button type="button" onClick={() => setConfirming(false)} className="h-8 rounded-cf px-2 text-sm text-on-dark-2 hover:text-on-dark">
            Keep
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="flex h-8 items-center gap-3 rounded-cf px-3 text-left text-sm text-on-dark-2 transition-colors hover:bg-mount-2 hover:text-on-dark"
        >
          <ArrowCounterClockwiseIcon className="size-4" /> Reset demo data
        </button>
      )}
    </div>
  );
}

function ClinicCard({ session }: { session: Session }) {
  const router = useRouter();
  const clinic = useDemo((s) => s.data!.clinic);
  return (
    <div className="border-t border-d2 pt-4">
      <p className="px-3 text-sm font-medium text-on-dark">{clinic.name}</p>
      <p className="px-3 text-xs text-on-dark-2">Fictional clinic, synthetic data</p>
      <div className="mt-3 flex items-center justify-between gap-2 px-3">
        <div className="min-w-0">
          <p className="truncate text-sm text-on-dark">{session.name}</p>
          <p className="text-xs text-on-dark-2">{session.role}</p>
        </div>
        <button
          type="button"
          aria-label="Sign out"
          onClick={() => {
            writeSession(null);
            router.replace("/login");
          }}
          className="grid size-8 place-items-center rounded-cf text-on-dark-2 hover:bg-mount-2 hover:text-on-dark"
        >
          <SignOutIcon className="size-4" />
        </button>
      </div>
    </div>
  );
}

function Rail({ session }: { session: Session }) {
  return (
    <aside className="on-mount sticky top-0 hidden h-[100dvh] flex-col gap-8 overflow-y-auto bg-mount px-3 py-5 lg:flex">
      <Link href="/" className="px-3 text-d8">
        <Wordmark />
      </Link>
      <NavLinks />
      <div className="mt-auto grid gap-5">
        <DemoControls />
        <ClinicCard session={session} />
      </div>
    </aside>
  );
}

function MobileBar({ session }: { session: Session }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <header className="on-mount sticky top-0 z-30 flex h-14 items-center justify-between bg-mount px-4 text-d8 lg:hidden">
        <Link href="/">
          <Wordmark />
        </Link>
        <button
          type="button"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="grid size-10 place-items-center rounded-cf hover:bg-mount-2"
        >
          {open ? <XIcon className="size-5" /> : <ListIcon className="size-5" />}
        </button>
      </header>
      {open && (
        <div className="on-mount fixed inset-x-0 bottom-0 top-14 z-30 flex flex-col gap-6 overflow-y-auto bg-mount px-3 py-4 lg:hidden">
          <NavLinks onNavigate={() => setOpen(false)} />
          <DemoControls />
          <ClinicCard session={session} />
        </div>
      )}
    </>
  );
}

function ShellSkeleton() {
  return (
    <div className="min-h-[100dvh] lg:grid lg:grid-cols-[232px_minmax(0,1fr)]" aria-busy="true" aria-label="Loading ChairFill">
      <div className="hidden bg-mount lg:block" />
      <div className="grid gap-4 p-6">
        <div className="h-8 w-64 animate-pulse rounded-cf bg-panel-2" />
        <div className="h-16 animate-pulse rounded-cf bg-panel-2" />
        <div className="h-[60vh] animate-pulse rounded-cf bg-panel-2" />
      </div>
    </div>
  );
}
