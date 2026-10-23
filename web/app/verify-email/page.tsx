"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { endpoints } from "@/lib/api";

function VerifyInner() {
  const params = useSearchParams();
  const uid = params.get("uid") || "";
  const token = params.get("token") || "";
  const [state, setState] = useState<"working" | "ok" | "error">("working");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!uid || !token) {
      setState("error");
      setMessage("This verification link is incomplete. Request a new one below.");
      return;
    }
    endpoints
      .verifyEmail(uid, token)
      .then((res: any) => { setState("ok"); setMessage(res.message); })
      .catch((e: any) => { setState("error"); setMessage(e.message || "This link is invalid or has expired."); });
  }, [uid, token]);

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm rounded-2xl border border-base-border bg-base-card p-6 text-center">
        <h1 className="text-xl font-extrabold">Email verification</h1>
        <p className={`mt-4 text-sm ${state === "ok" ? "text-status-success" : state === "error" ? "text-status-danger" : "text-gray-400"}`}>
          {state === "working" ? "Verifying your address…" : message}
        </p>
        <Link href="/login" className="mt-6 block text-sm font-bold text-accent">Go to sign in</Link>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return <Suspense fallback={null}><VerifyInner /></Suspense>;
}
