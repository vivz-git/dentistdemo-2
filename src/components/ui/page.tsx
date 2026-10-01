import { useId, type ReactNode } from "react";
import { DemoBadge } from "@/components/brand";

export const PAGE_CLS = "mx-auto grid max-w-[1600px] grid-cols-1 gap-5 px-4 py-5 sm:px-6 lg:px-8 lg:py-7";

/** Page title row. One headline per view; the Demo data badge is on every data screen. */
export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-[-0.02em]">{title}</h1>
        {description && <p className="mt-1 text-sm text-ink-2">{description}</p>}
      </div>
      <div className="flex items-center gap-2 text-xs text-ink-3">
        {actions}
        <DemoBadge />
      </div>
    </header>
  );
}

/** A ruled container with a title row. Structure inside comes from hairlines, not nested boxes. */
export function Panel({ title, caption, children, className = "" }: { title: string; caption?: ReactNode; children: ReactNode; className?: string }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className={`min-w-0 rounded-cf bg-surface shadow-[inset_0_0_0_1px_var(--rule)] ${className}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-rule px-4 py-2.5">
        <h2 id={id} className="text-sm font-semibold">
          {title}
        </h2>
        {caption && <p className="text-xs text-ink-3">{caption}</p>}
      </div>
      {children}
    </section>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex items-start gap-3 px-4 py-8 text-sm text-ink-2">
      <span aria-hidden="true" className="void mt-0.5 h-8 w-10 flex-none rounded-cf-sm" />
      <div>
        <p className="font-semibold text-ink">{title}</p>
        {children && <p className="mt-1">{children}</p>}
      </div>
    </div>
  );
}
