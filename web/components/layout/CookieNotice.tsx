"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

// Tells visitors which cookies koin uses. Shown once, then remembered on this device.
export function CookieNotice() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    try {
      setShow(localStorage.getItem("yp_cookie_notice") !== "seen");
    } catch {
      setShow(true);
    }
  }, []);
  if (!show) return null;
  return (
    <div className="fixed inset-x-3 bottom-3 z-[70] mx-auto max-w-xl rounded-xl border border-base-border bg-base-surface p-4 text-xs shadow-lg">
      <p className="text-gray-500">
        koin uses only the cookies needed to keep you signed in securely, and stores your theme and colour on this device. We do not use advertising or tracking cookies.{" "}
        <Link href="/privacy" className="font-bold text-accent">Privacy Policy</Link>
      </p>
      <div className="mt-3 flex justify-end">
        <button
          onClick={() => { try { localStorage.setItem("yp_cookie_notice", "seen"); } catch {} setShow(false); }}
          className="rounded-lg bg-accent px-4 py-2 font-bold text-black"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
