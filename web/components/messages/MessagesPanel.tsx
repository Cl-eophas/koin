"use client";
import { useEffect, useRef, useState } from "react";
import { endpoints } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/components/ui/Toast";

const ROLE_LABEL: Record<string, string> = { admin: "Admin", general_supervisor: "General supervisor", supervisor: "Supervisor", staff: "Staff" };

// Two-way messages. The server decides who each person can reach; this list shows only those people.
export function MessagesPanel() {
  const { demoMode } = useAuth();
  const { show } = useToast();
  const [contacts, setContacts] = useState<any[]>([]);
  const [active, setActive] = useState<any | null>(null);
  const [thread, setThread] = useState<any[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  async function loadContacts() {
    if (demoMode) return;
    try {
      const r: any = await endpoints.messageContacts();
      setContacts(r.data || []);
    } catch (e: any) {
      show(e.message || "Could not load contacts.", "error");
    }
  }

  async function loadThread(c: any) {
    if (demoMode || !c) return;
    try {
      const r: any = await endpoints.messageThread(c._id);
      setThread(r.data?.messages || []);
    } catch (e: any) {
      show(e.message || "Could not load messages.", "error");
    }
  }

  useEffect(() => {
    loadContacts();
    const t = setInterval(loadContacts, 15000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demoMode]);

  useEffect(() => {
    if (!active) return;
    loadThread(active);
    const t = setInterval(() => loadThread(active), 8000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?._id, demoMode]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [thread.length]);

  async function send() {
    const body = text.trim();
    if (!body || !active) return;
    setSending(true);
    try {
      await endpoints.sendMessage(active._id, body);
      setText("");
      await loadThread(active);
      loadContacts();
    } catch (e: any) {
      show(e.message || "Could not send.", "error");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <div className="rounded-card border border-base-border bg-base-card md:col-span-1">
        <div className="border-b border-base-border px-4 py-3 text-xs font-bold uppercase text-gray-500">People you can message</div>
        <div className="max-h-[60vh] overflow-y-auto">
          {contacts.length === 0 && <div className="px-4 py-6 text-sm text-gray-500">No one to message yet.</div>}
          {contacts.map((c) => (
            <button
              key={c._id}
              onClick={() => setActive(c)}
              className={`flex w-full items-center justify-between gap-2 border-b border-base-border px-4 py-3 text-left last:border-0 hover:bg-ink/5 ${active?._id === c._id ? "bg-ink/10" : ""}`}
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold">{c.name}</span>
                <span className="block truncate text-xs text-gray-500">{ROLE_LABEL[c.role] || c.role}{c.branch ? ` · ${c.branch}` : ""}</span>
              </span>
              {c.unread > 0 && <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-bold text-black">{c.unread}</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="flex min-h-[60vh] flex-col rounded-card border border-base-border bg-base-card md:col-span-2">
        {!active ? (
          <div className="m-auto px-6 py-10 text-center text-sm text-gray-500">Choose someone on the left to start a conversation.</div>
        ) : (
          <>
            <div className="border-b border-base-border px-4 py-3">
              <div className="font-bold">{active.name}</div>
              <div className="text-xs text-gray-500">{ROLE_LABEL[active.role] || active.role}{active.branch ? ` · ${active.branch}` : ""}</div>
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto px-4 py-4">
              {thread.length === 0 && <div className="text-center text-sm text-gray-500">No messages yet. Say hello.</div>}
              {thread.map((m) => (
                <div key={m._id} className={`flex ${m.mine ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm ${m.mine ? "bg-accent text-black" : "bg-ink/10"}`}>
                    {m.body}
                    <div className={`mt-1 text-[10px] ${m.mine ? "text-black/60" : "text-gray-500"}`}>{new Date(m.at).toLocaleString([], { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" })}</div>
                  </div>
                </div>
              ))}
              <div ref={endRef} />
            </div>
            <div className="flex gap-2 border-t border-base-border p-3">
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                maxLength={1000}
                placeholder="Write a message"
                className="flex-1 rounded-xl border border-base-border bg-base-bg px-4 py-2.5 text-sm"
              />
              <button onClick={send} disabled={sending || !text.trim()} className="rounded-xl bg-accent px-4 py-2.5 text-sm font-bold text-black disabled:opacity-40">Send</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
