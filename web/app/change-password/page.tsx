"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { endpoints } from "@/lib/api";
import { setToken } from "@/lib/api";

export default function ChangePasswordPage() {
  const router = useRouter();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (next.length < 8) return setError("New password must be at least 8 characters.");
    if (next !== confirm) return setError("Passwords do not match.");
    setLoading(true);
    try {
      await endpoints.changePassword(current, next);
      // Backend revokes all sessions on password change — force a fresh login.
      setToken(null);
      router.push("/login");
    } catch (e: any) {
      setError(e.message || "Could not change password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <h1 className="text-xl font-extrabold">Update your credentials</h1>
        <p className="mt-1 text-sm text-gray-500">
          Your organization requires a password change before you can continue.
        </p>

        {error && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-status-danger/30 bg-status-danger/10 px-3 py-2.5 text-sm text-status-danger">
            <AlertCircle size={16} className="mt-0.5 shrink-0" /> {error}
          </div>
        )}

        <form onSubmit={submit} className="mt-4 space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase text-gray-500">Current Password</label>
            <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} className="w-full rounded-xl border border-base-border bg-base-card px-4 py-3 text-sm" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase text-gray-500">New Password</label>
            <input type="password" value={next} onChange={(e) => setNext(e.target.value)} className="w-full rounded-xl border border-base-border bg-base-card px-4 py-3 text-sm" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase text-gray-500">Confirm New Password</label>
            <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="w-full rounded-xl border border-base-border bg-base-card px-4 py-3 text-sm" />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Updating..." : "Update & Proceed to App"}
          </Button>
        </form>
      </div>
    </div>
  );
}
