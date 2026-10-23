"use client";
import { useState } from "react";
import { BrandName } from "@/components/layout/Brand";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { endpoints } from "@/lib/api";

export default function RegisterPage() {
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ fullName: "", email: "", phone: "", password: "" });
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (form.password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setLoading(true);
    try {
      await endpoints.signup(form);
      setSubmitted(true);
    } catch (err: any) {
      setError(err.message || "Registration failed.");
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="w-full max-w-sm rounded-2xl border border-base-border bg-base-card p-6 text-center">
          <span className="mx-auto mb-4 inline-block rounded-md bg-status-warning/15 px-3 py-1 text-[11px] font-bold uppercase text-status-warning">
            Pending Verification
          </span>
          <h1 className="text-xl font-extrabold">Your account is pending review</h1>
          <p className="mt-3 text-sm text-gray-400">
            Thank you for registering at <BrandName />. An organization administrator must authorize your profile before
            you can gain access.
          </p>
          <div className="mt-6 grid grid-cols-2 gap-3">
            <button className="rounded-xl bg-ink/10 py-3 text-sm font-bold">Refresh Status</button>
            <button className="rounded-xl bg-ink/10 py-3 text-sm font-bold">Contact Admin</button>
          </div>
          <Link href="/login" className="mt-4 block text-xs font-bold text-gray-500">
            Sign out of this intent
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <h1 className="text-xl font-extrabold">Request Account Registration</h1>
        <p className="mt-1 text-sm text-gray-500">
          Your request will be submitted to the organization admin for approval.
        </p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase text-gray-500">Full Name</label>
            <input
              placeholder="e.g. John Doe"
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              className="w-full rounded-xl border border-base-border bg-base-card px-4 py-3 text-sm placeholder:text-gray-600"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase text-gray-500">Work Email</label>
            <input
              placeholder="e.g. john.doe@company.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full rounded-xl border border-base-border bg-base-card px-4 py-3 text-sm placeholder:text-gray-600"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase text-gray-500">Phone Number</label>
            <input
              placeholder="e.g. +44 7911 123456"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="w-full rounded-xl border border-base-border bg-base-card px-4 py-3 text-sm placeholder:text-gray-600"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase text-gray-500">Password</label>
            <input
              type="password"
              placeholder="At least 8 characters"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="w-full rounded-xl border border-base-border bg-base-card px-4 py-3 text-sm placeholder:text-gray-600"
            />
          </div>

          {error && (
            <div className="rounded-lg border border-status-danger/30 bg-status-danger/10 px-3 py-2.5 text-sm text-status-danger">
              {error}
            </div>
          )}

          <p className="text-xs text-gray-600">
            Admin verification is mandatory. Access is restricted until an operations manager approves this profile.
          </p>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Submitting..." : "Submit Registration Request"}
          </Button>
        </form>

        <Link href="/login" className="mt-4 block text-center text-sm font-bold text-gray-500">
          Back to Sign In
        </Link>
      </div>
    </div>
  );
}
