"use client";
import { Suspense, useState } from "react";
import { BrandName } from "@/components/layout/Brand";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { endpoints } from "@/lib/api";

function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const uid = params.get("uid") || "";
  const token = params.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const checks = [
    { label: "Minimum 8 characters", ok: password.length >= 8 },
    { label: "At least 1 numeric character", ok: /\d/.test(password) },
    { label: "At least 1 uppercase letter", ok: /[A-Z]/.test(password) },
    { label: "At least 1 lowercase letter", ok: /[a-z]/.test(password) },
  ];
  const strength = checks.filter((c) => c.ok).length;
  const strengthLabel = strength <= 1 ? "Weak" : strength <= 3 ? "Good" : "Strong";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!uid || !token) return setError("This reset link is missing required information.");
    if (password !== confirm) return setError("Passwords do not match.");
    if (checks.some((c) => !c.ok)) return setError("Password doesn't meet the requirements below.");
    setLoading(true);
    try {
      await endpoints.resetPassword(uid, token, password);
      setDone(true);
      setTimeout(() => router.push("/login"), 2000);
    } catch (err: any) {
      setError(err.message || "This reset link is invalid or has expired.");
    } finally {
      setLoading(false);
    }
  }

  if (!uid || !token) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="w-full max-w-sm text-center">
          <h1 className="text-xl font-extrabold">Invalid reset link</h1>
          <p className="mt-2 text-sm text-gray-500">This link is missing information. Request a new one.</p>
          <Link href="/forgot-password" className="mt-4 inline-block font-bold text-accent">Request a new link</Link>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="w-full max-w-sm rounded-xl border border-status-success/30 bg-status-success/10 p-6 text-center text-sm text-status-success">
          Password reset. Redirecting you to sign in…
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <h1 className="text-xl font-extrabold">Create new password</h1>
        <p className="mt-1 text-sm text-gray-500">Choose a strong, unique password to secure your <BrandName /> account.</p>

        {error && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-status-danger/30 bg-status-danger/10 px-3 py-2.5 text-sm text-status-danger">
            <AlertCircle size={16} className="mt-0.5 shrink-0" /> {error}
          </div>
        )}

        <form onSubmit={submit} className="mt-4 space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase text-gray-500">New Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-xl border border-base-border bg-base-card px-4 py-3 text-sm" />
            {password && (
              <div className="mt-1.5 flex items-center gap-2">
                <div className="flex h-1 flex-1 gap-1">
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className={`flex-1 rounded-full ${i < strength ? "bg-accent" : "bg-ink/10"}`} />
                  ))}
                </div>
                <span className="text-xs text-gray-500">{strengthLabel}</span>
              </div>
            )}
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase text-gray-500">Confirm New Password</label>
            <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="w-full rounded-xl border border-base-border bg-base-card px-4 py-3 text-sm" />
          </div>

          <div className="space-y-1.5 text-xs text-gray-500">
            {checks.map((c) => (
              <div key={c.label} className={`flex items-center gap-2 ${c.ok ? "text-status-success" : ""}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${c.ok ? "bg-status-success" : "bg-gray-600"}`} /> {c.label}
              </div>
            ))}
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Updating..." : "Change Password & Login"}
          </Button>
        </form>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}
