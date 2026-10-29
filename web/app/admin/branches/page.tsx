"use client";
import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Search, MapPin, List, X, Loader2 } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/AdminChrome";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/Button";
import { branches as demoBranches } from "@/lib/demoAdmin";
import { admin } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/components/ui/Toast";
import type { MapBranch } from "@/components/admin/BranchesMap";
import { inKenya } from "@/components/admin/BranchesMap";

// Leaflet touches the DOM at import time — load the map client-side only.
const BranchesMap = dynamic(() => import("@/components/admin/BranchesMap").then((m) => m.BranchesMap), {
  ssr: false,
  loading: () => <div className="flex h-[420px] items-center justify-center rounded-card border border-base-border bg-base-card text-sm text-gray-500">Loading map…</div>,
});

interface GeoResult { display_name: string; lat: number; lon: number }

function normalizeLive(rows: any[]): MapBranch[] {
  return rows.map((b) => ({
    id: b._id,
    name: b.name,
    lat: b.branchLocation?.lat ?? b.latitude,
    lng: b.branchLocation?.lng ?? b.longitude,
    address: b.branchLocation?.address ?? b.address,
    staffCount: b.staffCount,
    status: b.is_active === false ? "Inactive" : "Operational",
    radiusMeters: b.radius_meters ?? b.clockInRadius,
  }));
}
function normalizeDemo(): MapBranch[] {
  return [];
}

export default function BranchesPage() {
  const { demoMode } = useAuth();
  const { show } = useToast();
  const [view, setView] = useState<"list" | "map">("map");
  const [liveRows, setLiveRows] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState<false | "create" | string>(false); // string = editing branch id
  const [bulkOpen, setBulkOpen] = useState(false);

  async function load() {
    if (demoMode) return;
    try {
      const res: any = await admin.branches();
      setLiveRows(res.data);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    }
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demoMode]);

  const mapBranches: MapBranch[] = liveRows ? normalizeLive(liveRows) : normalizeDemo();
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return mapBranches;
    return mapBranches.filter((b) => b.name.toLowerCase().includes(q) || b.address?.toLowerCase().includes(q));
  }, [mapBranches, query]);

  async function deactivate(id: string, name: string) {
    if (!confirm(`Deactivate ${name}? Staff assigned here will need reassignment.`)) return;
    try {
      if (demoMode) throw new Error("demo");
      await admin.deleteBranch(id);
      show(`${name} deactivated`, "success");
      load();
    } catch (e: any) {
      show(demoMode ? "Demo mode — no backend connected." : e.message, demoMode ? "info" : "error");
    }
  }

  const editingBranch = typeof formOpen === "string" ? liveRows?.find((b) => b._id === formOpen) : null;

  return (
    <div>
      <PageHeader
        title="Branches & Operational Hubs"
        subtitle="Real-time geo-fencing status, staff distribution, and branch health across Kenya"
        actions={
          <>
            <div className="flex rounded-lg border border-base-border p-1">
              <button onClick={() => setView("map")} className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-bold ${view === "map" ? "bg-ink/10" : "text-gray-500"}`}>
                <MapPin size={14} /> Map
              </button>
              <button onClick={() => setView("list")} className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-bold ${view === "list" ? "bg-ink/10" : "text-gray-500"}`}>
                <List size={14} /> List
              </button>
            </div>
            <button onClick={() => setBulkOpen(true)} disabled={demoMode} title="Move several staff between branches at once" className="rounded-lg border border-accent/40 px-4 py-2.5 text-sm font-bold text-accent disabled:opacity-40">
              Transfer Staff
            </button>
            {selectedId && <Link href={`/admin/branches/${selectedId}`} className="rounded-lg border border-accent/40 px-4 py-2.5 text-sm font-bold text-accent">Open branch workspace</Link>}
            <button onClick={() => setFormOpen("create")} className="rounded-lg bg-accent px-4 py-2.5 text-sm font-bold text-black">
              Create New Branch
            </button>
          </>
        }
      />

      {!demoMode && error && (
        <div className="mb-4 rounded-lg border border-status-danger/30 bg-status-danger/10 px-3 py-2 text-xs font-semibold text-status-danger">{error}</div>
      )}
      {demoMode && (
        <div className="mb-4 rounded-lg border border-status-warning/30 bg-status-warning/10 px-3 py-2 text-xs font-semibold text-status-warning">
          Demo mode — showing sample Kenyan branches. Connect a backend to create/edit real ones.
        </div>
      )}

      <div className="mb-4 flex items-center gap-2 rounded-xl border border-base-border bg-base-card px-3 py-2.5">
        <Search size={16} className="text-gray-500" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search branches by name or address…"
          className="w-full bg-transparent text-sm outline-none placeholder:text-gray-600"
        />
        {query && (
          <button onClick={() => setQuery("")} className="text-gray-500">
            <X size={14} />
          </button>
        )}
        <span className="whitespace-nowrap text-xs text-gray-600">{filtered.length} of {mapBranches.length}</span>
      </div>

      {view === "map" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          <div className="col-span-2">
            <BranchesMap branches={filtered} selectedId={selectedId} onSelect={setSelectedId} height={520} />
          </div>
          <div className="max-h-[520px] space-y-3 overflow-y-auto pr-1">
            {filtered.map((b) => (
              <button
                key={b.id}
                onClick={() => setSelectedId(b.id)}
                className={`block w-full rounded-card border p-4 text-left ${selectedId === b.id ? "border-accent bg-accent/5" : "border-base-border bg-base-card hover:border-accent/40"}`}
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-bold">{b.name}</h3>
                  <StatusBadge label={b.status || "Operational"} />
                </div>
                <p className="mt-1 text-xs text-gray-500">{b.address}</p>
                <div className="mt-2 flex items-center justify-between text-xs">
                  <span className="font-bold text-accent">{b.staffCount ?? "—"} staff assigned</span>
                  <span className="flex gap-2">
                    {!demoMode && (
                      <>
                        <span onClick={(e) => { e.stopPropagation(); setFormOpen(b.id); }} className="cursor-pointer font-bold text-gray-400 hover:text-ink">Edit</span>
                        <span onClick={(e) => { e.stopPropagation(); deactivate(b.id, b.name); }} className="cursor-pointer font-bold text-status-danger">Deactivate</span>
                      </>
                    )}
                  </span>
                </div>
              </button>
            ))}
            {filtered.length === 0 && <div className="p-4 text-sm text-gray-500">No branches match &ldquo;{query}&rdquo;.</div>}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filtered.map((b) => (
            <div key={b.id} className="rounded-card border border-base-border bg-base-card p-5">
              <div className="flex items-center justify-between">
                <h3 className="font-bold">{b.name}</h3>
                <StatusBadge label={b.status || "Operational"} />
              </div>
              <p className="mt-2 text-sm text-gray-500">{b.address}</p>
              <div className="mt-4 flex items-center justify-between border-t border-base-border pt-3">
                <span className="text-sm font-bold text-accent">{b.staffCount ?? "—"} staff assigned</span>
                {!demoMode && (
                  <div className="flex gap-3 text-xs">
                    <button onClick={() => setFormOpen(b.id)} className="font-bold text-gray-400 hover:text-ink">Edit</button>
                    <button onClick={() => deactivate(b.id, b.name)} className="font-bold text-status-danger">Deactivate</button>
                  </div>
                )}
              </div>
            </div>
          ))}
          {filtered.length === 0 && <div className="col-span-2 p-6 text-center text-sm text-gray-500">No branches match &ldquo;{query}&rdquo;.</div>}
        </div>
      )}

      {bulkOpen && liveRows && (
        <BulkTransferModal branches={liveRows} onClose={() => setBulkOpen(false)} onDone={() => { setBulkOpen(false); load(); }} />
      )}

      {formOpen && (
        <BranchFormModal
          mode={formOpen === "create" ? "create" : "edit"}
          branch={editingBranch}
          onClose={() => setFormOpen(false)}
          onSaved={() => { setFormOpen(false); load(); }}
        />
      )}
    </div>
  );
}

function BranchFormModal({
  mode,
  branch,
  onClose,
  onSaved,
}: {
  mode: "create" | "edit";
  branch: any;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { demoMode } = useAuth();
  const { show } = useToast();
  const [name, setName] = useState(branch?.name || "");
  const [address, setAddress] = useState(branch?.branchLocation?.address || branch?.address || "");
  const [lat, setLat] = useState<number | null>(branch?.branchLocation?.lat ?? branch?.latitude ?? null);
  const [lng, setLng] = useState<number | null>(branch?.branchLocation?.lng ?? branch?.longitude ?? null);
  const [shiftStart, setShiftStart] = useState(branch?.default_shift_start_time || "08:00");
  const [windowMin, setWindowMin] = useState(branch?.clock_in_window_minutes ?? 60);
  const [radius, setRadius] = useState<number>(branch?.radius_meters ?? branch?.clockInRadius ?? 1000);
  const [autoOut, setAutoOut] = useState<string>(branch?.auto_clockout_hours === null || branch?.auto_clockout_hours === undefined ? "" : String(branch.auto_clockout_hours));
  const [searchQ, setSearchQ] = useState("");
  const [results, setResults] = useState<GeoResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);

  // Debounced Kenya-scoped geosearch (backend proxies OpenStreetMap Nominatim, countrycodes=ke)
  useEffect(() => {
    if (demoMode || searchQ.trim().length < 3) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res: any = await admin.geoSearch(searchQ.trim());
        setResults(res.data || []);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 450);
    return () => clearTimeout(t);
  }, [searchQ, demoMode]);

  function pickResult(r: GeoResult) {
    setAddress(r.display_name);
    setLat(r.lat);
    setLng(r.lon);
    setResults([]);
    setSearchQ("");
  }

  async function save() {
    if (!name.trim()) return show("Branch name is required.", "error");
    if (lat === null || lng === null) return show("Search and pick a location on the map first.", "error");
    setSaving(true);
    try {
      if (demoMode) {
        show("Demo mode — connect a backend to actually save branches.", "info");
        onSaved();
        return;
      }
      if (!Number.isFinite(radius) || radius < 50 || radius > 10000) return show("Geofence radius must be 50–10,000 metres.", "error");
      const payload = { name: name.trim(), branchLocation: { lat, lng, address }, default_shift_start_time: shiftStart, clock_in_window_minutes: Number(windowMin), radius_meters: Math.round(radius), auto_clockout_hours: autoOut === "" ? null : Number(autoOut) };
      if (mode === "create") {
        await admin.createBranch(payload);
        show(`${name} created`, "success");
      } else {
        await admin.updateBranch(branch._id, payload);
        show(`${name} updated`, "success");
      }
      onSaved();
    } catch (e: any) {
      show(e.message || "Could not save branch.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-base-border bg-base-surface p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-extrabold">{mode === "create" ? "Create New Branch" : `Edit ${branch?.name}`}</h2>
          <button onClick={onClose}><X size={20} className="text-gray-500" /></button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase text-gray-500">Branch Name *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Kitengela Branch" className="w-full rounded-xl border border-base-border bg-base-card px-4 py-3 text-sm" />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase text-gray-500">Find location in Kenya *</label>
            <div className="relative">
              <div className="flex items-center gap-2 rounded-xl border border-base-border bg-base-card px-3 py-2.5">
                <Search size={14} className="text-gray-500" />
                <input
                  value={searchQ}
                  onChange={(e) => setSearchQ(e.target.value)}
                  placeholder="Search a town, street or landmark…"
                  className="w-full bg-transparent text-sm outline-none placeholder:text-gray-600"
                />
                {searching && <Loader2 size={14} className="animate-spin text-gray-500" />}
              </div>
              {results.length > 0 && (
                <div className="absolute z-10 mt-1 w-full rounded-xl border border-base-border bg-base-surface shadow-xl">
                  {results.map((r, i) => (
                    <button key={i} onClick={() => pickResult(r)} className="block w-full border-b border-base-border px-4 py-2.5 text-left text-sm last:border-0 hover:bg-ink/5">
                      {r.display_name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {address && <p className="mt-1.5 text-xs text-gray-500">Selected: {address}</p>}
            {demoMode && <p className="mt-1.5 text-xs text-status-warning">Demo mode — geosearch needs a live backend.</p>}
          </div>

          {lat !== null && lng !== null && !inKenya(lat, lng) && (
            <p className="text-xs font-semibold text-status-danger">This point is outside Kenya. Check the location before saving.</p>
          )}
          <p className="text-xs text-gray-500">Click the map to place the branch, or search above. The circle is the clock-in geofence.</p>
          <BranchesMap
            branches={[]}
            pendingPin={lat !== null && lng !== null ? { lat, lng, label: name || address, radius } : null}
            onMapClick={async (la, lo) => {
              setLat(la);
              setLng(lo);
              setResults([]);
              setAddress(`${la.toFixed(5)}, ${lo.toFixed(5)}`);
              if (demoMode) return;
              try {
                const r: any = await admin.geoReverse(la, lo);
                const found = r.data?.display_name || r.data?.address?.road || r.data?.name;
                if (found) setAddress(String(found));
              } catch {
                // keep the coordinates as the address
              }
            }}
            height={240}
          />

          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase text-gray-500">Automatic clock-out after (hours)</label>
            <input type="number" min={0} max={24} value={autoOut} placeholder="Blank = system default" onChange={(e) => setAutoOut(e.target.value)} className="w-full rounded-xl border border-base-border bg-base-card px-4 py-2.5 text-sm" />
            <p className="mt-1 text-xs text-gray-500">Staff still clocked in after this long are clocked out automatically. 0 turns it off for this branch.</p>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase text-gray-500">Geofence radius (metres)</label>
            <div className="flex items-center gap-3">
              <input type="range" min={50} max={2000} step={10} value={Math.min(radius, 2000)} onChange={(e) => setRadius(Number(e.target.value))} className="flex-1 accent-accent" />
              <input type="number" min={50} max={10000} value={radius} onChange={(e) => setRadius(Number(e.target.value))} className="w-28 rounded-xl border border-base-border bg-base-card px-3 py-2 text-sm" />
            </div>
            <p className="mt-1 text-xs text-gray-500">Staff must be within this distance of the branch to clock in (GPS accuracy is added on top).</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase text-gray-500">Default Shift Start</label>
              <input type="time" value={shiftStart} onChange={(e) => setShiftStart(e.target.value)} className="w-full rounded-xl border border-base-border bg-base-card px-4 py-3 text-sm" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase text-gray-500">Clock-in Grace Window (min)</label>
              <input type="number" value={windowMin} onChange={(e) => setWindowMin(Number(e.target.value))} className="w-full rounded-xl border border-base-border bg-base-card px-4 py-3 text-sm" />
            </div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <button onClick={onClose} className="rounded-xl bg-ink/10 py-3 text-sm font-bold">Cancel</button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving..." : mode === "create" ? "Create Branch" : "Save Changes"}</Button>
        </div>
      </div>
    </div>
  );
}

function BulkTransferModal({ branches, onClose, onDone }: { branches: any[]; onClose: () => void; onDone: () => void }) {
  const { show } = useToast();
  const active = branches.filter((b) => b.is_active !== false);
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [people, setPeople] = useState<any[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setPeople([]);
    setPicked([]);
    if (!fromId) return;
    setLoading(true);
    admin
      .branch(fromId)
      .then((res: any) => setPeople((res.data?.staff || []).filter((u: any) => ["staff", "supervisor"].includes(u.role))))
      .catch((e) => show(e.message || "Could not load that branch's staff.", "error"))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromId]);

  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const allPicked = people.length > 0 && picked.length === people.length;
  const toName = active.find((b) => b._id === toId)?.name;

  async function submit() {
    if (!picked.length) return show("Select at least one person.", "error");
    if (!toId) return show("Pick a destination branch.", "error");
    if (!confirm(`Move ${picked.length} people to ${toName}? This is audit-logged.`)) return;
    setSaving(true);
    try {
      const res: any = await admin.transferUsers(picked, toId);
      show(res.message || "Transferred", "success");
      onDone();
    } catch (e: any) {
      show(e.message || "Transfer failed.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-base-border bg-base-surface p-6">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-lg font-extrabold">Transfer Staff Between Branches</h2>
          <button onClick={onClose}><X size={20} className="text-gray-500" /></button>
        </div>
        <p className="mb-4 text-xs text-gray-500">For several people at once (e.g. closing a branch). For one person, use Transfer in the Staff directory.</p>

        <div className="mb-4 grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase text-gray-500">From</label>
            <select value={fromId} onChange={(e) => setFromId(e.target.value)} className="w-full rounded-xl border border-base-border bg-base-card px-3 py-2.5 text-sm">
              <option value="">Select…</option>
              {active.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase text-gray-500">To</label>
            <select value={toId} onChange={(e) => setToId(e.target.value)} className="w-full rounded-xl border border-base-border bg-base-card px-3 py-2.5 text-sm">
              <option value="">Select…</option>
              {active.filter((b) => b._id !== fromId).map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
            </select>
          </div>
        </div>

        {fromId && (
          <div className="mb-4 rounded-xl border border-base-border">
            <label className="flex items-center gap-2 border-b border-base-border px-3 py-2 text-xs font-bold uppercase text-gray-500">
              <input type="checkbox" className="accent-accent" checked={allPicked} onChange={() => setPicked(allPicked ? [] : people.map((p) => p._id))} />
              {loading ? "Loading…" : `Select all (${people.length})`}
            </label>
            <div className="max-h-56 overflow-y-auto">
              {people.map((u) => (
                <label key={u._id} className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-ink/5">
                  <input type="checkbox" className="accent-accent" checked={picked.includes(u._id)} onChange={() => toggle(u._id)} />
                  <span className="flex-1">{u.name}</span>
                  <span className="text-[10px] uppercase text-gray-500">{u.role}</span>
                </label>
              ))}
              {!loading && people.length === 0 && <div className="px-3 py-4 text-center text-sm text-gray-500">No active staff or supervisors in this branch.</div>}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <button onClick={onClose} className="rounded-xl bg-ink/10 py-3 text-sm font-bold">Cancel</button>
          <Button onClick={submit} disabled={saving || !picked.length}>{saving ? "Moving..." : `Transfer ${picked.length || ""}`.trim()}</Button>
        </div>
      </div>
    </div>
  );
}
