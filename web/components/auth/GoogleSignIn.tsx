"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

const MESSAGES: Record<string, string> = {
  pending: "Your account is waiting for admin approval.",
  rejected: "Your registration was not approved. Contact admin if you think this is a mistake.",
  norole: "Your account is approved but has no role yet. Contact admin.",
  failed: "Google sign-in did not complete. Please try again.",
};

// Sign in with Google. The name and email come from the Google account.
export function GoogleSignIn() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    api("/auth/google/status", { auth: false })
      .then((r: any) => setEnabled(Boolean(r?.data?.enabled)))
      .catch(() => setEnabled(false));
    const code = new URLSearchParams(window.location.search).get("google");
    if (code) setMessage(MESSAGES[code] || MESSAGES.failed);
  }, []);

  return (
    <div className="mt-6">
      {message && <div className="mb-3 rounded-lg border border-status-warning/30 bg-status-warning/10 px-3 py-2 text-xs font-semibold text-status-warning">{message}</div>}
      <button
        type="button"
        disabled={enabled === false}
        onClick={() => { window.location.href = "/api/auth/google"; }}
        className="w-full rounded-xl border border-base-border py-3 text-sm font-bold hover:bg-base-hover disabled:opacity-40"
      >
        Continue with Google
      </button>
      {enabled === false && <p className="mt-2 text-center text-[11px] text-gray-500">Google sign-in is not set up on the server yet. Use email and password.</p>}
    </div>
  );
}
