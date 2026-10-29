import { PageHeader } from "@/components/layout/AdminChrome";

export default function TimetablePage() {
  return (
    <div>
      <PageHeader
        title="Weekly Shift Scheduler"
        subtitle="Interactive roster drafting, branch allocation grids, and compliance limit tracking"
        actions={
          <>
            <button className="rounded-lg border border-base-border px-4 py-2.5 text-sm font-bold">Save as Template</button>
            <button className="rounded-lg bg-accent px-4 py-2.5 text-sm font-bold text-black">Apply to Live Week</button>
          </>
        }
      />

      <div className="mb-4 flex items-center gap-4 text-sm">
        <span className="text-gray-500">
          ACTIVE BRANCH FILTER: <b className="text-ink">—</b>
        </span>
        <span className="text-gray-500">
          ROSTER PERIOD: <b className="text-ink">—</b>
        </span>
      </div>

      <div className="grid grid-cols-7 gap-3">
        {([] as any[]).map((d: any) => (
          <div key={d.day} className="rounded-card border border-base-border bg-base-card p-3">
            <div className="mb-2 text-xs font-bold text-gray-400">
              {d.day} <span className="text-gray-600">{d.date}</span>
            </div>
            <div className="space-y-2">
              {d.shifts.length === 0 && <div className="text-xs text-gray-600">No shifts</div>}
              {([] as any[]).map((s: any, i: number) => (
                <div key={i} className="rounded-lg bg-ink/5 p-2 text-xs">
                  <div className="font-bold text-accent">{s.label}</div>
                  <div className="mt-0.5 text-gray-400">{s.time}</div>
                  <div className="mt-0.5 font-semibold">{s.who}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
