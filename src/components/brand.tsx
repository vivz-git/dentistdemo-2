/**
 * ChairFill mark: a film-mount window whose lower half is a filled block,
 * the void restored. Single geometric mark, no illustration.
 */
export function BrandMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <rect x="2.75" y="2.75" width="18.5" height="18.5" rx="3.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <rect x="6" y="12" width="12" height="6" rx="1" fill="#2fb39b" />
      <path d="M6 6.5h12M6 9h7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity=".55" />
    </svg>
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-semibold tracking-[-0.02em] ${className}`}>
      <BrandMark className="size-6" />
      <span>ChairFill</span>
    </span>
  );
}

/** Persistent label: every screen states that the data is synthetic. */
export function DemoBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-cf-sm border border-amber/60 bg-amber-wash px-1.5 py-0.5 text-[11px] font-medium text-amber-ink ${className}`}
    >
      Demo data
    </span>
  );
}
