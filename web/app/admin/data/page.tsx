"use client";
import { useEffect, useState } from "react";
import { PageHeader, TableShell } from "@/components/layout/AdminChrome";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { admin, fetchAuthed } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/components/ui/Toast";

const fmtBytes = (n?: number | null) => {
  if (n === null || n === undefined) return "not measured";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
};
const daysAgoIso = (d: number) => new Date(Date.now() - d * 86400000).toISOString().slice(0, 10);

const CATEGORY_OPTIONS = [
  { key: "notifications_read", label: "Read notifications" },
  { key: "security_events_resolved", label: "Resolved security events" },
  { key: "attendance_reports", label: "Saved attendance reports" },
  { key: "closed_staff_requests", label: "Closed staff requests" },
  { key: "closed_branch_moves", label: "Closed branch move requests" },
  { key: "audit_logs", label: "Audit log (compliance)" },
  { key: "attendance_records", label: "Attendance records (payroll data)" },
  { key: "orphan_files", label: "Unused uploaded files" },
];

export default function DataStoragePage() {
  const { demoMode } = useAuth();
  const { show } = useToast();
  const [usage, setUsage] = useState<any>(null);
  const [category, setCategory] = useState("notifications_read");
  const [before, setBefore] = useState(daysAgoIso(180));
  const [preview, setPreview] = useState<any>(null);
  const [exportToken, setExportToken] = useState<string | null>(null);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);

  const isFiles = category === "orphan_files";
  const phrase = preview?.phrase || "DELETE";
  const pct = usage?.storage?.percent ?? null;

  async function loadUsage() {
    if (demoMode) return;
    try {
      const r: any = await admin.dataUsage();
      setUsage(r.data);
    } catch (e: any) {
      show(e.message || "Could not load storage usage.", "error");
    }
  }
  useEffect(() => {
    loadUsage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demoMode]);

  function resetSelection() {
    setPreview(null);
    setExportToken(null);
    setTyped("");
  }

  async function runPreview() {
    setBusy(true);
    resetSelection();
    try {
      const r: any = await admin.dataPreview(category, isFiles ? undefined : before);
      setPreview(r.data);
    } catch (e: any) {
      show(e.message || "Could not preview.", "error");
    } finally {
      setBusy(false);
    }
  }

  // Step 1: download a copy of exactly what will be deleted. Deleting is only possible after this.
  async function downloadCopy() {
    setBusy(true);
    try {
      const qs = new URLSearchParams({ category, ...(isFiles ? {} : { before }) }).toString();
      const res = await fetchAuthed(`/admin/data/export?${qs}`);
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.message || "The copy did not download. Nothing was deleted.");
      }
      const token = res.headers.get("X-Export-Token");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `koin-export-${category}-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setExportToken(token);
      show("Copy downloaded. Keep it safe, then you can delete the records.", "success");
    } catch (e: any) {
      setExportToken(null);
      show(e.message || "The copy did not download.", "error");
    } finally {
      setBusy(false);
    }
  }

  // Step 2: delete, only with the copy downloaded for this exact selection.
  async function purge() {
    if (!preview || !exportToken) return;
    if (!confirm(`Delete ${preview.count} record(s)? The copy you downloaded is then the only copy.`)) return;
    setBusy(true);
    try {
      const r: any = await admin.dataPurge(category, typed.trim(), isFiles ? undefined : before, exportToken);
      show(r.message || "Removed", "success");
      resetSelection();
      loadUsage();
    } catch (e: any) {
      show(e.message || "Could not delete.", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader title="Data & Storage" subtitle="The database has limited space. Download old records, then delete them to free space. Every deletion is recorded in the audit log." />

      {demoMode && <div className="mb-4 rounded-lg border border-status-warning/30 bg-status-warning/10 px-3 py-2 text-xs font-semibold text-status-warning">Connect the backend to see real storage.</div>}

      {pct !== null && (
        <div className="mb-6 rounded-card border border-base-border bg-base-card p-5">
          <div className="flex items-baseline justify-between">
            <h3 className="font-bold">Database storage</h3>
            <span className="text-sm font-bold">{pct}% used</span>
          </div>
          <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-ink/10">
            <div className={`h-full rounded-full ${pct >= 85 ? "bg-status-danger" : pct >= 70 ? "bg-status-warning" : "bg-accent"}`} style={{ width: `${Math.min(100, pct)}%` }} />
          </div>
          <p className="mt-2 text-xs text-gray-500">
            {fmtBytes(usage.storage.used_bytes)} of {fmtBytes(usage.storage.limit_bytes)} used.{" "}
            {pct >= 85 ? "Almost full. Download and delete old records now." : pct >= 70 ? "Getting full. Plan an export soon." : "Plenty of space."}
          </p>
        </div>
      )}

      {usage && (
        <>
          <TableShell headers={["Store", "Records", "Size", "What it holds"]}>
            {usage.stores.map((s: any) => (
              <tr key={s.key} className="border-b border-base-border last:border-0">
                <td className="px-4 py-3 font-bold">{s.label}</td>
                <td className="px-4 py-3">{s.count.toLocaleString()}</td>
                <td className="px-4 py-3 text-gray-400">{s.size_measured ? fmtBytes(s.bytes) : "not measured"}</td>
                <td className="px-4 py-3 text-xs text-gray-500">{s.note}</td>
              </tr>
            ))}
            <tr className="border-b border-base-border last:border-0">
              <td className="px-4 py-3 font-bold">Uploaded documents</td>
              <td className="px-4 py-3">{usage.uploads.count.toLocaleString()} files</td>
              <td className="px-4 py-3 text-gray-400">{fmtBytes(usage.uploads.bytes)}</td>
              <td className="px-4 py-3 text-xs text-gray-500">ID scans, KRA certificates and medical notes. {usage.uploads.unused_count} file(s) are no longer used by anyone.</td>
            </tr>
          </TableShell>
        </>
      )}

      <div className="mt-6 rounded-card border border-base-border bg-base-card p-5">
        <h3 className="font-bold">Free up space</h3>
        <p className="mb-4 mt-1 text-xs text-gray-500">
          Three steps: preview, download a copy, then delete. Records newer than 30 days can&apos;t be removed, and attendance records need to be at least a year old.
        </p>

        <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase text-gray-500">What to delete</label>
            <select value={category} onChange={(e) => { setCategory(e.target.value); resetSelection(); }} className="w-full rounded-xl border border-base-border bg-base-bg px-4 py-2.5 text-sm">
              {CATEGORY_OPTIONS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
          </div>
          {!isFiles && (
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase text-gray-500">Delete records dated before</label>
              <input type="date" value={before} max={daysAgoIso(30)} onChange={(e) => { setBefore(e.target.value); resetSelection(); }} className="w-full rounded-xl border border-base-border bg-base-bg px-4 py-2.5 text-sm" />
            </div>
          )}
        </div>

        {category === "attendance_records" && (
          <p className="mb-4 rounded-lg border border-status-danger/30 bg-status-danger/10 px-3 py-2 text-xs font-semibold text-status-danger">
            Attendance records are used for pay and reports. Keep the downloaded copy safe before deleting.
          </p>
        )}

        <button onClick={runPreview} disabled={busy || demoMode} className="rounded-lg bg-ink/10 px-4 py-2.5 text-sm font-bold disabled:opacity-40">1. Preview</button>

        {preview && (
          <div className="mt-5 space-y-3 rounded-xl border border-base-border bg-base-bg p-4">
            <div className="flex flex-wrap items-center gap-3">
              <StatusBadge label={`${preview.count.toLocaleString()} record(s) would be deleted`} tone={preview.count ? "warning" : "success"} />
              {!isFiles && <span className="text-xs text-gray-500">before {before}</span>}
            </div>
            {preview.note && <p className="text-xs text-gray-500">{preview.note}</p>}

            {preview.count > 0 && (
              <>
                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <button onClick={downloadCopy} disabled={busy} className="rounded-lg bg-accent px-4 py-2.5 text-sm font-bold text-black disabled:opacity-40">
                    2. Download a copy
                  </button>
                  {exportToken ? <StatusBadge label="Copy downloaded" tone="success" /> : <span className="text-xs text-gray-500">You must download the copy before deleting.</span>}
                </div>

                <label className="block pt-2 text-xs font-bold uppercase text-gray-500">
                  3. Type <span className="text-status-danger">{phrase}</span> to delete
                </label>
                <input value={typed} onChange={(e) => setTyped(e.target.value)} disabled={!exportToken} placeholder={phrase} className="w-full rounded-xl border border-base-border bg-base-card px-4 py-2.5 text-sm disabled:opacity-40" />
                <button
                  onClick={purge}
                  disabled={busy || !exportToken || typed.trim() !== phrase}
                  className="rounded-lg bg-status-danger px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40"
                >
                  Delete {preview.count.toLocaleString()} record(s)
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
