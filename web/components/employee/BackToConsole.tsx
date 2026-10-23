"use client";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/lib/auth";

// Supervisors clock in on the same screen as staff; this link returns them to the console.
export function BackToConsole() {
  const { user } = useAuth();
  if (user?.role !== "supervisor") return null;
  return (
    <Link href="/supervisor" className="mb-3 flex items-center gap-2 text-xs font-bold text-purple-300">
      <ArrowLeft size={14} /> Back to supervisor console
    </Link>
  );
}
