import clsx from "clsx";
import { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "danger" | "outline";

export function Button({
  variant = "primary",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none";
  const variants: Record<Variant, string> = {
    primary: "bg-accent text-black hover:bg-accent-hover",
    secondary: "bg-ink/10 text-ink hover:bg-ink/15",
    danger: "border border-status-danger/40 text-status-danger hover:bg-status-danger/10",
    outline: "border border-base-border text-ink hover:bg-base-hover",
  };
  return <button className={clsx(base, variants[variant], className)} {...props} />;
}
