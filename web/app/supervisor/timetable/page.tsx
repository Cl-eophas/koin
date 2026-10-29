"use client";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
import { PageHeader } from "@/components/layout/AdminChrome";
import { Button } from "@/components/ui/Button";
import { timetable, DAYS } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/components/ui/Toast";

const DAY_LABELS: Record<string, string> = { monday: "MON", tuesday: "TUE", wednesday: "WED", thursday: "THU", friday: "FRI", saturday: "SAT", sunday: "SUN" };

function mondayOf(d: Date) {
  const day = d.getDay();
  const diff = (day + 6) % 7;
  const m = new Date(d);
  m.setDate(d.getDate() - diff);
  return m.toISOString().slice(0, 10);
}

type Cell = { shift_id: string | null; is_off: boolean };
type Schedule = Record<string, Cell>;

export default function SupervisorTimetablePage() {
  const { demoMode } = useAuth();
  const { show } = useToast();
  const [weekStart, setWeekStart] = useState("");
  useEffect(() => { setWeekStart(mondayOf(new Date())); }, []);
  const [templates, setTemplates] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [schedules, setSchedules] = useState<Record<string, Schedule>>({});
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);

  async function load() {
    if (demoMode) return;
    try {
      const res: any = await timetable.week(weekStart || mondayOf(new Date()));
      setTemplates(res.templates || []);
      setStaff(res.staff || []);
      setSchedules(res.schedules || {});
      setDirty(false);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    }
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demoMode, weekStart]);

  function setCell(staffId: string, day: string, value: string) {
    setSchedules((prev) => {
      const next = { ...prev, [staffId]: { ...(prev[staffId] || {}) } };
      if (value === "off") next[staffId][day] = { shift_id: null, is_off: true };
      else if (value === "") next[staffId][day] = { shift_id: null, is_off: false };
      else next[staffId][day] = { shift_id: value, is_off: false };
      return next;
    });
    setDirty(true);
  }

  async function saveAll() {
    setSaving(true);
    try {
      if (demoMode) throw new Error("demo");
      const rows = staff.map((s) => ({ staff_id: s._id, schedule: schedules[s._id] || {} }));
      const res: any = await timetable.saveWeek({ week_start: weekStart, rows });
      show(res.message || "Saved", "success");
      setDirty(false);
      load();
    } catch (e: any) {
      show(demoMode ? "Demo mode — no backend connected." : e.message || "Could not save.", demoMode ? "info" : "error");
    } finally {
      setSaving(false);
    }
  }

  const templateById = useMemo(() => Object.fromEntries(templates.map((t) => [t._id, t])), [templates]);
  const weekLabel = useMemo(() => {
    const start = new Date(weekStart);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return `${start.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${end.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;
  }, [weekStart]);

  function shiftWeek(delta: number) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + delta * 7);
    setWeekStart(mondayOf(d));
  }

  return (
    <div>
      <PageHeader
        title="Weekly Timetable Builder"
        subtitle="Assign shifts per day using your branch's shift templates"
        actions={
          <>
            <button onClick={() => setTemplateModalOpen(true)} className="flex items-center gap-1.5 rounded-lg border border-base-border px-4 py-2.5 text-sm font-bold">
              <Plus size={14} /> Shift Templates
            </button>
            <Button onClick={saveAll} disabled={!dirty || saving}>{saving ? "Saving..." : "Save Timetable Changes"}</Button>
          </>
        }
      />

      {!demoMode && error && (
        <div className="mb-4 rounded-lg border border-status-danger/30 bg-status-danger/10 px-3 py-2 text-xs font-semibold text-status-danger">
          {error.includes("no branch") ? "Your account has no branch assigned yet." : error}
        </div>
      )}
      {demoMode && (
        <div className="mb-4 rounded-lg border border-status-warning/30 bg-status-warning/10 px-3 py-2 text-xs font-semibold text-status-warning">
          Demo mode — connect a backend to build real rosters.
        </div>
      )}

      <div className="mb-4 flex items-center gap-3">
        <button onClick={() => shiftWeek(-1)} className="rounded-lg border border-base-border p-2"><ChevronLeft size={16} /></button>
        <span className="text-sm font-bold">{weekLabel}</span>
        <button onClick={() => shiftWeek(1)} className="rounded-lg border border-base-border p-2"><ChevronRight size={16} /></button>
        {templates.length === 0 && !demoMode && (
          <span className="text-xs text-status-warning">No shift templates yet — add one to start building the roster.</span>
        )}
      </div>

      <div className="overflow-x-auto rounded-card border border-base-border bg-base-card">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-base-border text-[11px] uppercase text-gray-500">
              <th className="px-4 py-3">Staff</th>
              {DAYS.map((d) => <th key={d} className="px-4 py-3">{DAY_LABELS[d]}</th>)}
            </tr>
          </thead>
          <tbody>
            {staff.map((s) => (
              <tr key={s._id} className="border-b border-base-border last:border-0">
                <td className="whitespace-nowrap px-4 py-3 font-bold">{s.name}</td>
                {DAYS.map((d) => {
                  const cell = schedules[s._id]?.[d] || { shift_id: null, is_off: false };
                  const value = cell.is_off ? "off" : cell.shift_id || "";
                  return (
                    <td key={d} className="px-2 py-2">
                      <select
                        value={value}
                        onChange={(e) => setCell(s._id, d, e.target.value)}
                        className={`w-full rounded-lg border px-2 py-1.5 text-xs ${cell.is_off ? "border-gray-600 bg-ink/5 text-gray-500" : cell.shift_id ? "border-accent/40 bg-accent/10 text-accent" : "border-dashed border-status-danger/40 text-status-danger"}`}
                      >
                        <option value="">Unassigned</option>
                        <option value="off">Off Day</option>
                        {templates.map((t) => <option key={t._id} value={t._id}>{t.label} ({t.start_time}-{t.end_time})</option>)}
                      </select>
                    </td>
                  );
                })}
              </tr>
            ))}
            {staff.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-500">No approved staff in your branch yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {templateModalOpen && (
        <TemplatesModal templates={templates} onClose={() => setTemplateModalOpen(false)} onChanged={() => { load(); }} />
      )}
    </div>
  );
}

function TemplatesModal({ templates, onClose, onChanged }: { templates: any[]; onClose: () => void; onChanged: () => void }) {
  const { demoMode } = useAuth();
  const { show } = useToast();
  const [label, setLabel] = useState("");
  const [name, setName] = useState("");
  const [start, setStart] = useState("06:00");
  const [end, setEnd] = useState("14:00");
  const [saving, setSaving] = useState(false);

  async function create() {
    if (!label.trim()) return show("Label is required (e.g. MORNING).", "error");
    setSaving(true);
    try {
      if (demoMode) throw new Error("demo");
      await timetable.createTemplate({ label: label.trim(), name: name.trim(), start_time: start, end_time: end });
      show(`Template ${label.toUpperCase()} created`, "success");
      setLabel("");
      setName("");
      onChanged();
    } catch (e: any) {
      show(demoMode ? "Demo mode — no backend connected." : e.message || "Could not create template.", demoMode ? "info" : "error");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string, lab: string) {
    if (!confirm(`Delete template ${lab}? Any timetable cells using it will be cleared.`)) return;
    try {
      await timetable.deleteTemplate(id);
      show("Template deleted", "success");
      onChanged();
    } catch (e: any) {
      show(e.message || "Could not delete.", "error");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-base-border bg-base-surface p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-extrabold">Shift Templates</h2>
          <button onClick={onClose}><X size={20} className="text-gray-500" /></button>
        </div>

        <div className="mb-4 space-y-2">
          {templates.map((t) => (
            <div key={t._id} className="flex items-center justify-between rounded-lg bg-ink/5 px-3 py-2.5 text-sm">
              <span><b>{t.label}</b> {t.name && `— ${t.name}`} <span className="text-gray-500">{t.start_time}–{t.end_time}</span></span>
              <button onClick={() => remove(t._id, t.label)} className="text-xs font-bold text-status-danger">Delete</button>
            </div>
          ))}
          {templates.length === 0 && <div className="text-sm text-gray-500">No templates yet.</div>}
        </div>

        <div className="border-t border-base-border pt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label e.g. MORNING" className="rounded-xl border border-base-border bg-base-card px-3 py-2.5 text-sm" />
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name (optional)" className="rounded-xl border border-base-border bg-base-card px-3 py-2.5 text-sm" />
            <input type="time" value={start} onChange={(e) => setStart(e.target.value)} className="rounded-xl border border-base-border bg-base-card px-3 py-2.5 text-sm" />
            <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className="rounded-xl border border-base-border bg-base-card px-3 py-2.5 text-sm" />
          </div>
          <button onClick={create} disabled={saving} className="mt-3 w-full rounded-xl bg-accent py-2.5 text-sm font-bold text-black disabled:opacity-50">
            {saving ? "Adding..." : "Add Template"}
          </button>
        </div>
      </div>
    </div>
  );
}
