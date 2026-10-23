"use client";
import { ReactNode, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { ThemeToggle } from "@/components/layout/ThemeToggle";

// Responsive frame for the admin, supervisor and general supervisor consoles.
// Desktop: the sidebar sits beside the page. Phone and tablet: a top bar opens the
// sidebar as a drawer, and the drawer closes after a link is opened.
export function ConsoleShell({ sidebar, children, title }: { sidebar: ReactNode; children: ReactNode; title: string }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <div className="min-h-screen bg-base-bg md:flex">
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-base-border bg-base-surface px-4 py-3 md:hidden">
        <button onClick={() => setOpen(true)} aria-label="Open menu" className="rounded-lg border border-base-border p-2">
          <Menu size={18} />
        </button>
        <span className="text-sm font-extrabold">{title}</span>
        <ThemeToggle />
      </div>

      <div className="hidden md:block md:shrink-0">{sidebar}</div>

      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/70" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw] overflow-y-auto bg-base-surface shadow-2xl">
            <button onClick={() => setOpen(false)} aria-label="Close menu" className="absolute right-3 top-3 z-10 rounded-lg border border-base-border p-1.5">
              <X size={16} />
            </button>
            {sidebar}
          </div>
        </div>
      )}

      <main className="min-w-0 flex-1 overflow-x-hidden px-4 py-5 md:px-8 md:py-7">{children}</main>
    </div>
  );
}
