"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { LockIcon, ArrowRightIcon } from "@phosphor-icons/react";
import { Wordmark } from "@/components/brand";
import { DEMO_LOGIN, writeSession } from "@/lib/demo/store";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState<string>(DEMO_LOGIN.email);
  const [password, setPassword] = useState<string>(DEMO_LOGIN.password);
  const [error, setError] = useState<string | null>(null);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (email.trim().toLowerCase() !== DEMO_LOGIN.email || password !== DEMO_LOGIN.password) {
      setError("Use the demo credentials shown below. This demo has no real accounts.");
      return;
    }
    writeSession({ name: DEMO_LOGIN.name, role: DEMO_LOGIN.role, email: DEMO_LOGIN.email });
    router.replace("/");
  }

  return (
    <main className="grid min-h-[100dvh] lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <section className="on-mount relative hidden flex-col justify-between overflow-hidden bg-mount p-10 text-on-dark lg:flex">
        <Wordmark className="text-lg text-d8" />
        <div className="max-w-md">
          <p className="text-[2.5rem] font-semibold leading-[1.05] tracking-[-0.03em] text-d8">
            Fill cancelled dental appointments before the chair goes empty.
          </p>
          <MiniBook />
        </div>
        <p className="text-sm text-on-dark-2">Synthetic demo. No real patients, no real messages.</p>
      </section>

      <section className="flex flex-col justify-center px-4 py-12 sm:px-10">
        <div className="mx-auto w-full max-w-sm">
          <Wordmark className="mb-10 text-lg lg:hidden" />
          <h1 className="text-2xl font-semibold tracking-[-0.02em]">Sign in to the demo clinic</h1>
          <p className="mt-2 text-sm text-ink-2">Tulsi Dental Studio, Bengaluru. A fictional clinic with generated data.</p>

          <form onSubmit={submit} className="mt-8 grid gap-5" noValidate>
            <label className="grid gap-2 text-sm font-medium">
              Email
              <input
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11 rounded-cf border border-rule-strong bg-surface px-3 text-base font-normal outline-none transition focus:border-ink"
              />
            </label>
            <label className="grid gap-2 text-sm font-medium">
              Password
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11 rounded-cf border border-rule-strong bg-surface px-3 text-base font-normal outline-none transition focus:border-ink"
              />
            </label>
            {error && (
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            )}
            <button
              type="submit"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-cf bg-ink px-4 text-sm font-semibold text-d8 transition hover:bg-d2 active:translate-y-px"
            >
              Sign in <ArrowRightIcon weight="bold" className="size-4" />
            </button>
          </form>

          <div className="mt-8 rounded-cf border border-rule bg-panel-2 p-4 text-sm">
            <p className="flex items-center gap-2 font-medium">
              <LockIcon className="size-4" /> Demo credentials
            </p>
            <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-ink-2">
              <dt>Email</dt>
              <dd className="num text-ink">{DEMO_LOGIN.email}</dd>
              <dt>Password</dt>
              <dd className="num text-ink">{DEMO_LOGIN.password}</dd>
            </dl>
            <p className="mt-3 text-xs text-ink-3">Sign-in is simulated in the browser. It is not real authentication.</p>
          </div>
        </div>
      </section>
    </main>
  );
}

/** A static four-chair strip in the book's own grammar: bright booked film, one void, one restoration. */
function MiniBook() {
  const cols: ("film" | "void" | "restored")[][] = [
    ["film", "film", "void", "film"],
    ["film", "restored", "film", "film"],
    ["film", "film", "film", "void"],
    ["restored", "film", "film", "film"],
  ];
  return (
    <div aria-hidden="true" className="mt-10 grid grid-cols-4 gap-2">
      {cols.map((col, i) => (
        <div key={i} className="grid gap-1.5">
          {col.map((k, j) => (
            <div
              key={j}
              className={`h-9 rounded-cf-sm ${k === "void" ? "void" : k === "restored" ? "restored" : "bg-d6/90"}`}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
