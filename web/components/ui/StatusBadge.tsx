import clsx from "clsx";

type Tone = "success" | "warning" | "danger" | "info" | "neutral";

const TONE_MAP: Record<string, Tone> = {
  "on time": "success",
  ontime: "success",
  active: "success",
  "active on duty": "success",
  approved: "success",
  verified: "success",
  stable: "success",
  ok: "success",
  good: "success",
  excellent: "success",
  operational: "success",
  "stable compliance": "success",
  late: "warning",
  pending: "warning",
  "pending audit": "warning",
  "pending review": "warning",
  "pending sign": "warning",
  warning: "warning",
  fair: "warning",
  "replacement pending": "warning",
  understaffed: "warning",
  "not clocked in": "neutral",
  absent: "danger",
  rejected: "danger",
  critical: "danger",
  alert: "danger",
  worn: "danger",
  expired: "danger",
  "risk detected": "danger",
  "forced clock-out": "neutral",
  inactive: "neutral",
};

export function StatusBadge({ label, tone }: { label: string; tone?: Tone }) {
  const resolved = tone || TONE_MAP[label.trim().toLowerCase()] || "neutral";
  const cls: Record<Tone, string> = {
    success: "bg-status-success/15 text-status-success border-status-success/30",
    warning: "bg-status-warning/15 text-status-warning border-status-warning/30",
    danger: "bg-status-danger/15 text-status-danger border-status-danger/30",
    info: "bg-status-info/15 text-status-info border-status-info/30",
    neutral: "bg-ink/10 text-gray-300 border-ink/10",
  };
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-md border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide whitespace-nowrap",
        cls[resolved]
      )}
    >
      {label}
    </span>
  );
}
