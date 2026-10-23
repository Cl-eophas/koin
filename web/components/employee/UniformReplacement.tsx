"use client";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { endpoints } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/components/ui/Toast";

const ITEMS = ["Hi-Vis Vest", "Branded Jacket", "Safety Boots", "Peak Cap", "Security Softshell", "Other"];

export function UniformReplacement() {
  const { demoMode } = useAuth();
  const { show } = useToast();
  const [open, setOpen] = useState(false);
  const [item, setItem] = useState(ITEMS[0]);
  const [size, setSize] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (reason.trim().length < 5) return show("Say briefly why you need a replacement.", "error");
    setSaving(true);
    try {
      const r: any = await endpoints.uniformReplacement({ item, size: size.trim() || undefined, reason: reason.trim() });
      show(r.message || "Request sent", "success");
      setOpen(false);
      setReason("");
      setSize("");
    } catch (e: any) {
      show(e.message || "Could not send the request.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-2">
      <button onClick={() => setOpen(true)} disabled={demoMode} className="w-full rounded-xl border-2 border-accent py-3 font-bold text-accent disabled:opacity-40">
        Request a replacement
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center">
          <div className="w-full max-w-md rounded-t-3xl border border-base-border bg-base-surface p-5 sm:rounded-2xl">
            <h2 className="mb-1 text-lg font-extrabold">Request a replacement</h2>
            <p className="mb-4 text-xs text-gray-500">Your supervisor and the admin are told. Keep it short.</p>
            <label className="mb-1.5 block text-xs font-bold uppercase text-gray-500">Item</label>
            <select value={item} onChange={(e) => setItem(e.target.value)} className="mb-3 w-full rounded-xl border border-base-border bg-base-card px-4 py-3 text-sm">
              {ITEMS.map((i) => <option key={i} value={i}>{i}</option>)}
            </select>
            <label className="mb-1.5 block text-xs font-bold uppercase text-gray-500">Size (optional)</label>
            <input value={size} onChange={(e) => setSize(e.target.value)} placeholder="e.g. L or UK 10" className="mb-3 w-full rounded-xl border border-base-border bg-base-card px-4 py-3 text-sm" />
            <label className="mb-1.5 block text-xs font-bold uppercase text-gray-500">Reason</label>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={300} placeholder="e.g. Vest torn during the night shift" className="mb-4 w-full rounded-xl border border-base-border bg-base-card px-4 py-3 text-sm placeholder:text-gray-600" />
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setOpen(false)} className="rounded-xl bg-ink/10 py-3 text-sm font-bold">Cancel</button>
              <Button onClick={submit} disabled={saving}>{saving ? "Sending..." : "Send"}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
