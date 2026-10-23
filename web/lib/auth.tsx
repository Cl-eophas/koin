"use client";
import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AuthUser, Role } from "@/types";
import { endpoints, getToken, setToken, setSessionHint, hasSessionHint, silentRefresh } from "@/lib/api";

interface LoginResult {
  ok: boolean;
  message?: string;
  code?: string;
  forcePasswordReset?: boolean;
}

interface AuthCtx {
  user: AuthUser | null;
  loading: boolean;
  demoMode: boolean;
  login: (identifier: string, password: string) => Promise<LoginResult>;
  logout: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

const ROLE_HOME: Record<Role, string> = {
  staff: "/employee",
  supervisor: "/supervisor",
  general_supervisor: "/general-supervisor",
  admin: "/admin",
};

// Only used if the backend can't be reached at all, so the UI stays browsable.
const DEMO_USER: AuthUser = {
  _id: "demo-john-doe",
  fullName: "John Doe",
  email: "john.doe@koin.com",
  staffId: "YPP-20938",
  role: "staff",
  roleLabel: "Logistics Staff",
  branchName: "Carrefour Westgate",
};

function toUser(d: any): AuthUser {
  return {
    _id: d._id || d.id,
    fullName: d.name,
    email: d.email,
    staffId: d.staffId,
    role: d.role,
    branch_id: d.branch_id?._id || d.branch_id,
    branchName: d.branch_id?.name || d.branch,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [demoMode, setDemoMode] = useState(false);
  const router = useRouter();

  useEffect(() => {
    (async () => {
      // No access token after a reload: restore the session from the refresh cookie.
      if (!getToken()) {
        if (!hasSessionHint()) {
          setLoading(false);
          return;
        }
        const restored = await silentRefresh();
        if (!restored) {
          setSessionHint(false);
          setLoading(false);
          return;
        }
      }
      try {
        const res: any = await endpoints.me();
        setUser(toUser(res.data));
      } catch {
        setToken(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function login(identifier: string, password: string): Promise<LoginResult> {
    try {
      const res: any = await endpoints.login(identifier, password);
      const d = res.data;
      setToken(res.access_token);
      setSessionHint(true);
      const role: Role = d.role;
      setUser(toUser(d));
      setDemoMode(false);
      router.push(ROLE_HOME[role] || "/employee");
      return { ok: true, forcePasswordReset: Boolean(d.force_password_reset) };
    } catch (e: any) {
      if (e?.status === undefined) {
        // Backend unreachable: fall back to demo mode.
        setUser(DEMO_USER);
        setDemoMode(true);
        router.push("/employee");
        return { ok: true };
      }
      return { ok: false, message: e.message, code: e.code };
    }
  }

  async function logout() {
    try {
      await endpoints.logout();
    } catch {}
    setToken(null);
    setUser(null);
    setDemoMode(false);
    router.push("/login");
  }

  return <Ctx.Provider value={{ user, loading, demoMode, login, logout }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
