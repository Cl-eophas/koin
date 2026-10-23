"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Moon, Sun } from "lucide-react";

export type Theme = "dark" | "light";

export function applyTheme(t: Theme) {
  document.documentElement.setAttribute("data-theme", t);
  try {
    localStorage.setItem("yp_theme", t);
  } catch {
    // storage unavailable: the choice lasts for this visit only
  }
}

// Button that switches between dark and light.
export function ThemeToggle({ className = "" }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>("dark");
  useEffect(() => {
    setTheme(document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark");
  }, []);
  const next: Theme = theme === "dark" ? "light" : "dark";
  return (
    <button
      type="button"
      onClick={() => { applyTheme(next); setTheme(next); }}
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
      className={`flex items-center gap-2 rounded-lg border border-base-border px-2.5 py-1.5 text-xs font-bold text-ink hover:bg-ink/5 ${className}`}
    >
      {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
      <span>{theme === "dark" ? "Light" : "Dark"} mode</span>
    </button>
  );
}

// Floating toggle for pages that have no menu (sign in, registration, password pages).
const PUBLIC = ["/login", "/register", "/forgot-password", "/reset-password", "/verify-email", "/change-password", "/onboarding"];
export function PublicThemeToggle() {
  const path = usePathname();
  if (!PUBLIC.some((p) => path === p || path?.startsWith(p + "/"))) return null;
  return <div className="fixed right-3 top-3 z-[60]"><ThemeToggle /></div>;
}
