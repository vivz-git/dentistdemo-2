import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

const VARIANT: Record<Variant, string> = {
  primary: "bg-ink text-d8 hover:bg-d2 disabled:bg-d5 disabled:text-d7",
  secondary: "bg-surface text-ink shadow-[inset_0_0_0_1px_var(--rule-strong)] hover:bg-d7 disabled:text-ink-3",
  ghost: "text-ink-2 hover:bg-panel-2 hover:text-ink disabled:text-ink-3",
  danger: "text-danger shadow-[inset_0_0_0_1px_var(--rule-strong)] bg-surface hover:bg-danger-wash disabled:text-ink-3",
};

const SIZE: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px] gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
};

export function Button({
  variant = "secondary",
  size = "md",
  className = "",
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return (
    <button
      type={type}
      className={`inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-cf font-medium transition-[background-color,color,transform] duration-150 active:translate-y-px disabled:cursor-not-allowed disabled:active:translate-y-0 ${VARIANT[variant]} ${SIZE[size]} ${className}`}
      {...props}
    />
  );
}
