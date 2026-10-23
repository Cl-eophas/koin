"use client";
import { useState } from "react";
import { Download } from "lucide-react";
import { fetchAuthed } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { Card } from "@/components/ui/Card";

// Lets a person keep a copy of their own records (attendance, leave, pay, messages).
export function MyRecords() {
  const { show } = useToast();
  const [busy, setBusy] = useState(false);
  async function download() {
    setBusy(true);
    try {
      const res = await fetchAuthed("/profile/my-records");
      if (!res.ok) throw new Error("Could not prepare your records. Try again.");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `my-records-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e: any) {
      show(e.message || "Could not download.", "error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card className="mb-5 flex items-center justify-between gap-3">
      <div>
        <div className="text-sm font-bold">My records</div>
        <div className="text-xs text-gray-500">Keep a copy of your attendance, leave, pay and messages.</div>
      </div>
      <button onClick={download} disabled={busy} className="flex items-center gap-2 rounded-lg border border-base-border px-3 py-2 text-xs font-bold disabled:opacity-40">
        <Download size={14} /> {busy ? "Preparing…" : "Download"}
      </button>
    </Card>
  );
}
