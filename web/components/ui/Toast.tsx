"use client";
import { createContext, useCallback, useContext, useState, ReactNode } from "react";
import { CheckCircle2, XCircle, Info } from "lucide-react";

type ToastKind = "success" | "error" | "info";
interface ToastItem { id: number; message: string; kind: ToastKind }

const Ctx = createContext<{ show: (message: string, kind?: ToastKind) => void } | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const show = useCallback((message: string, kind: ToastKind = "success") => {
    const id = Date.now() + Math.random();
    setItems((prev) => [...prev, { id, message, kind }]);
    setTimeout(() => setItems((prev) => prev.filter((i) => i.id !== id)), 4000);
  }, []);

  const ICONS: Record<ToastKind, any> = { success: CheckCircle2, error: XCircle, info: Info };
  const COLORS: Record<ToastKind, string> = {
    success: "border-status-success/40 bg-status-success/10 text-status-success",
    error: "border-status-danger/40 bg-status-danger/10 text-status-danger",
    info: "border-status-info/40 bg-status-info/10 text-status-info",
  };

  return (
    <Ctx.Provider value={{ show }}>
      {children}
      <div className="fixed bottom-5 left-1/2 z-[100] flex -translate-x-1/2 flex-col gap-2">
        {items.map((t) => {
          const Icon = ICONS[t.kind];
          return (
            <div key={t.id} className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold shadow-lg backdrop-blur ${COLORS[t.kind]}`}>
              <Icon size={16} className="shrink-0" /> {t.message}
            </div>
          );
        })}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
