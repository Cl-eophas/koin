import clsx from "clsx";
import { ReactNode } from "react";

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={clsx("rounded-card border border-base-border bg-base-card p-5", className)}>
      {children}
    </div>
  );
}

export function StatCard({
  label,
  value,
  sub,
  tone = "default",
}: {
  label: string;
  value: string | number;
  sub?: string;
  tone?: "default" | "success" | "warning" | "danger";
}) {
  const dot: Record<string, string> = {
    default: "bg-gray-500",
    success: "bg-status-success",
    warning: "bg-status-warning",
    danger: "bg-status-danger",
  };
  return (
    <Card>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{label}</div>
      <div className="mt-2 text-3xl font-extrabold">{value}</div>
      {sub && (
        <div className="mt-2 flex items-center gap-1.5 text-xs text-gray-500">
          <span className={clsx("h-1.5 w-1.5 rounded-full", dot[tone])} />
          {sub}
        </div>
      )}
    </Card>
  );
}
