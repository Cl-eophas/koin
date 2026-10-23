"use client";
import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { endpoints } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await endpoints.forgotPassword(email.trim());
      setSent(true);
    } catch (err: any) {
      setError(err.message || "Could not send reset instructions.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <h1 className="text-xl font-extrabold">Reset your password</h1>
        <p className="mt-1 text-sm text-gray-500">
          Enter your registered email and we&apos;ll send you secure instructions to recover your credential.
        </p>

        {sent ? (
          <div className="mt-6 rounded-xl border border-status-success/30 bg-status-success/10 p-4 text-sm text-status-success">
            If an account exists for {email || "that email"}, reset instructions have been sent. The link expires
            in 1 hour.
          </div>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-4">
            {error && (
              <div className="rounded-lg border border-status-danger/30 bg-status-danger/10 px-3 py-2.5 text-sm text-status-danger">{error}</div>
            )}
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase text-gray-500">Work Email</label>
              <input
                placeholder="john.doe@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-base-border bg-base-card px-4 py-3 text-sm placeholder:text-gray-600"
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Sending..." : "Send Recovery Instructions"}
            </Button>
          </form>
        )}

        <Link href="/login" className="mt-4 block text-center text-sm font-bold text-gray-500">
          Cancel and return to Sign In
        </Link>
      </div>
    </div>
  );
}
