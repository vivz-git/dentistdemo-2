import type { ReactNode } from "react";

export const INPUT =
  "h-9 w-full rounded-cf border border-rule-strong bg-surface px-2.5 text-sm text-ink outline-none placeholder:text-ink-3 focus:border-ink disabled:bg-panel-2 disabled:text-ink-3";

export const TEXTAREA =
  "w-full resize-y rounded-cf border border-rule-strong bg-surface p-2.5 text-sm leading-relaxed text-ink outline-none placeholder:text-ink-3 focus:border-ink";

/** Label above the control, 12px 500 ink-2, as the design system specifies for in-panel fields. */
export function Field({ label, hint, children, className = "" }: { label: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={`grid min-w-0 content-start gap-1.5 text-xs font-medium text-ink-2 ${className}`}>
      {label}
      {children}
      {hint && <span className="text-[11px] font-normal leading-relaxed text-ink-3">{hint}</span>}
    </label>
  );
}

export function FormError({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="rounded-cf bg-danger-wash p-3 text-xs text-danger">
      {children}
    </p>
  );
}

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  sub?: string;
  disabled?: boolean;
}

/** A trough holding two to four options; the chosen option is a surface tile with a stroke. */
export function Segmented<T extends string>({
  legend,
  name,
  value,
  onChange,
  options,
}: {
  legend: string;
  name: string;
  value: T;
  onChange: (v: T) => void;
  options: SegmentedOption<T>[];
}) {
  return (
    <fieldset className="min-w-0">
      <legend className="text-xs font-medium text-ink-2">{legend}</legend>
      <div className="mt-1.5 grid gap-1 rounded-cf bg-panel-2 p-1" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
        {options.map((o) => (
          <label
            key={o.value}
            className={`rounded-[4px] px-3 py-2 text-xs transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ink ${
              o.disabled ? "cursor-not-allowed text-ink-3" : "cursor-pointer"
            } ${value === o.value ? "bg-surface shadow-[inset_0_0_0_1px_var(--rule-strong)]" : o.disabled ? "" : "text-ink-2 hover:text-ink"}`}
          >
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={value === o.value}
              disabled={o.disabled}
              onChange={() => onChange(o.value)}
              className="sr-only"
            />
            <span className="block font-semibold">{o.label}</span>
            {o.sub && <span className="block text-ink-3">{o.sub}</span>}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** A native checkbox with an ink accent and a label beside it. */
export function Check({
  checked,
  onChange,
  children,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <label className={`flex items-center gap-2 text-sm ${disabled ? "text-ink-3" : "text-ink"}`}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="size-4 accent-[var(--ink)]" />
      {children}
    </label>
  );
}
