"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, UploadCloud, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { endpoints, uploadLeaveDocument } from "@/lib/api";
import { useAuth } from "@/lib/auth";

const TYPES: { value: "annual" | "sick_full" | "sick_half"; label: string }[] = [
  { value: "annual", label: "Annual Leave" },
  { value: "sick_full", label: "Sick Leave (Full Pay)" },
  { value: "sick_half", label: "Sick Leave (Half Pay)" },
];

export default function RequestLeavePage() {
  const router = useRouter();
  const { demoMode } = useAuth();
  const [type, setType] = useState<"annual" | "sick_full" | "sick_half">("annual");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [reason, setReason] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isSick = type.startsWith("sick");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!start || !end) return setError("Start and end dates are required.");
    if (end < start) return setError("The end date must be on or after the start date.");
    if (reason.trim().length < 3) return setError("Give a short reason for the leave.");
    setSubmitting(true);
    try {
      if (!demoMode) {
        const res: any = await endpoints.requestLeave({ type, start_date: start, end_date: end, reason: reason.trim() });
        let leaveId: string | undefined = res?.data?._id;
        if (!leaveId && file) {
          // Fall back to the most recent request if the server didn't return its id.
          const h: any = await endpoints.leaveHistory();
          leaveId = (h.data || [])[0]?._id;
        }
        if (file && isSick && leaveId) await uploadLeaveDocument(leaveId, file);
      }
      router.push("/employee/leave");
    } catch (err: any) {
      setError(err.message || "Could not submit the request.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} aria-label="Back"><ArrowLeft size={22} /></button>
        <h1 className="text-2xl font-extrabold">Request Leave</h1>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-status-danger/30 bg-status-danger/10 px-3 py-2.5 text-sm text-status-danger">
          <AlertCircle size={16} className="mt-0.5 shrink-0" /> {error}
        </div>
      )}

      <form onSubmit={submit} className="space-y-5">
        <div>
          <label className="mb-1.5 block text-xs font-bold uppercase text-gray-500">Leave type</label>
          <select value={type} onChange={(e) => setType(e.target.value as typeof type)} className="w-full rounded-xl border border-base-border bg-base-card px-4 py-3 text-sm">
            {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase text-gray-500">From</label>
            <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="w-full rounded-xl border border-base-border bg-base-card px-4 py-3 text-sm" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase text-gray-500">To</label>
            <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="w-full rounded-xl border border-base-border bg-base-card px-4 py-3 text-sm" />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-bold uppercase text-gray-500">Reason</label>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={300} placeholder="e.g. Family wedding in Kisumu" className="w-full rounded-xl border border-base-border bg-base-card px-4 py-3 text-sm placeholder:text-gray-600" />
        </div>

        {isSick && (
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase text-gray-500">Medical note</label>
            <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-base-border py-6 text-center hover:border-accent/50">
              <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
              <UploadCloud size={20} className="text-accent" />
              <div className="text-sm font-semibold">{file ? file.name : "Attach a medical note (PDF, JPG or PNG)"}</div>
              <div className="text-xs text-gray-500">Sick leave may need a medical note before it is approved.</div>
            </label>
          </div>
        )}

        <Button type="submit" className="w-full" disabled={submitting}>{submitting ? "Sending..." : "Send request"}</Button>
      </form>
    </div>
  );
}
