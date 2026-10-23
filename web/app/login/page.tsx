"use client";
import { GoogleSignIn } from "@/components/auth/GoogleSignIn";
import { useState } from "react";
import { BrandName } from "@/components/layout/Brand";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/lib/auth";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const result = await login(identifier, password);
    setLoading(false);
    if (!result.ok) {
      setError(result.message || "Login failed.");
      return;
    }
    if (result.forcePasswordReset) {
      router.push("/change-password");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center justify-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent font-extrabold text-black">
            Y
          </div>
          <span className="text-lg font-extrabold"><BrandName /></span>
        </div>

        <h1 className="text-center text-2xl font-extrabold">Welcome back</h1>
        <p className="mt-1 text-center text-sm text-gray-500">Enter your credentials to access your hub</p>

        <GoogleSignIn />

        <div className="my-5 flex items-center gap-3 text-[11px] font-bold text-gray-600">
          <span className="h-px flex-1 bg-base-border" /> OR USE EMAIL <span className="h-px flex-1 bg-base-border" />
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-status-danger/30 bg-status-danger/10 px-3 py-2.5 text-sm text-status-danger">
              <AlertCircle size={16} className="mt-0.5 shrink-0" /> {error}
            </div>
          )}
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase text-gray-500">Work Email or Staff ID</label>
            <input
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="you@yourcompany.com or YP/0001"
              className="w-full rounded-xl border border-base-border bg-base-card px-4 py-3 text-sm placeholder:text-gray-600"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase text-gray-500">Password</label>
            <div className="flex items-center rounded-xl border border-base-border bg-base-card px-4 py-3">
              <input
                type={show ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="flex-1 bg-transparent text-sm outline-none"
              />
              <button type="button" onClick={() => setShow((s) => !s)} className="text-gray-500">
                {show ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs">
            <label className="flex items-center gap-2 text-gray-500">
              <input type="checkbox" className="accent-accent" /> Remember me
            </label>
            <Link href="/forgot-password" className="font-bold text-accent">
              Forgot password?
            </Link>
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Signing in..." : "Sign In"}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-500">
          Don&apos;t have an account?{" "}
          <Link href="/register" className="font-bold text-accent">
            Request sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
