"use client";
import { useEffect, useState } from "react";
import { Bell, MapPin, Navigation, LogOut, AlertCircle, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { demoDashboard } from "@/lib/demoData";
import { mapDashboard } from "@/lib/mappers";
import { endpoints } from "@/lib/api";
import { useAuth } from "@/lib/auth";

type ClockState = "idle" | "locating" | "gps" | "active";

function getPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("Geolocation not supported by this browser."));
    navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 15000 });
  });
}

export default function EmployeeHome() {
  const { demoMode } = useAuth();
  const [live, setLive] = useState<ReturnType<typeof mapDashboard> | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [state, setState] = useState<ClockState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [now, setNow] = useState(new Date());
  const [precheck, setPrecheck] = useState<{ distance: number; effectiveRadius: number; withinRange: boolean } | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);

  const data = live || demoDashboard;

  async function loadDashboard() {
    if (demoMode) return;
    try {
      const res: any = await endpoints.staffDashboard();
      setLive(mapDashboard(res.data));
      setFetchError(null);
    } catch (e: any) {
      setFetchError(e.message);
    }
  }

  useEffect(() => {
    loadDashboard();
    const t = setInterval(() => setNow(new Date()), 1000 * 30);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demoMode]);

  useEffect(() => {
    if (state !== "active") return;
    const t = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [state]);

  async function openClockIn() {
    setGpsError(null);
    setState("locating");
    try {
      const pos = await getPosition();
      const c = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy };
      setCoords(c);
      if (demoMode) {
        setPrecheck({ distance: 42, effectiveRadius: 150, withinRange: true });
        setState("gps");
        return;
      }
      const res: any = await endpoints.clockInPrecheck(c.lat, c.lng, c.accuracy);
      setPrecheck(res.data);
      setState("gps");
    } catch (e: any) {
      setGpsError(e.message || "Could not read your location.");
      setState("idle");
    }
  }

  async function confirmClockIn() {
    if (!coords) return;
    if (demoMode) {
      setState("active");
      setElapsed(0);
      return;
    }
    try {
      await endpoints.clockIn(coords.lat, coords.lng, coords.accuracy);
      setState("active");
      setElapsed(0);
      loadDashboard();
    } catch (e: any) {
      setGpsError(e.message || "Clock-in failed.");
    }
  }

  async function clockOut() {
    if (demoMode) {
      setState("idle");
      return;
    }
    try {
      const pos = await getPosition();
      await endpoints.clockOut(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy);
      setState("idle");
      loadDashboard();
    } catch (e: any) {
      setGpsError(e.message || "Clock-out failed.");
    }
  }

  const hh = String(Math.floor(elapsed / 3600)).padStart(2, "0");
  const mm = String(Math.floor((elapsed % 3600) / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");
  const shiftPct = Math.min(100, Math.round((elapsed / (8 * 3600)) * 100)) || 65;
  const clockedIn = state === "active" || (live?.shift.clockedIn && state === "idle");

  return (
    <div className="space-y-6">
      {demoMode && (
        <div className="rounded-lg border border-status-warning/30 bg-status-warning/10 px-3 py-2 text-xs font-semibold text-status-warning">
          Demo mode — no backend reachable. Showing sample data; actions don&apos;t persist.
        </div>
      )}
      {!demoMode && fetchError && (
        <div className="rounded-lg border border-status-danger/30 bg-status-danger/10 px-3 py-2 text-xs font-semibold text-status-danger">
          Couldn&apos;t load your dashboard: {fetchError}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-500/20 text-sm font-bold text-blue-300">
            {data.user.initials}
          </div>
          <div>
            <div className="font-bold">{data.user.fullName}</div>
            <span className="mt-0.5 inline-block rounded-md bg-blue-500/15 px-2 py-0.5 text-[10px] font-bold uppercase text-blue-300">
              {data.user.roleLabel}
            </span>
          </div>
        </div>
        {clockedIn ? (
          <span className="rounded-md bg-status-success/15 px-3 py-1.5 text-xs font-bold text-status-success">
            ACTIVE ON DUTY
          </span>
        ) : (
          <button className="flex h-10 w-10 items-center justify-center rounded-full border border-base-border">
            <Bell size={18} />
          </button>
        )}
      </div>

      {!clockedIn ? (
        <>
          <div className="text-center">
            <div className="text-6xl font-extrabold tracking-tight">
              {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </div>
            <div className="mt-2 text-gray-500">
              {now.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric", year: "numeric" })}
            </div>
          </div>

          <Card>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-semibold">
                <MapPin size={16} className="text-gray-400" />
                {data.branch.name}
              </div>
              {data.branch.zone && (
                <span className="rounded-md border border-base-border px-2 py-0.5 text-[11px] text-gray-400">{data.branch.zone}</span>
              )}
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-base-border pt-4">
              <div>
                <div className="text-[11px] uppercase text-gray-500">Today&apos;s Shift</div>
                <div className="font-bold">{data.shift.start} – {data.shift.end}</div>
              </div>
              <span className="rounded-md bg-ink/10 px-2.5 py-1 text-[11px] font-bold text-gray-300">NOT CLOCKED IN</span>
            </div>
          </Card>

          {gpsError && (
            <div className="flex items-start gap-2 rounded-lg border border-status-danger/30 bg-status-danger/10 px-3 py-2.5 text-sm text-status-danger">
              <AlertCircle size={16} className="mt-0.5 shrink-0" /> {gpsError}
            </div>
          )}

          <button
            onClick={openClockIn}
            disabled={state === "locating"}
            className="w-full rounded-2xl bg-accent px-6 py-6 text-center text-black shadow-lg shadow-accent/20 disabled:opacity-70"
          >
            <div className="flex items-center justify-center gap-2 text-xl font-extrabold">
              {state === "locating" ? <Loader2 size={20} className="animate-spin" /> : <Navigation size={20} />}
              {state === "locating" ? "READING GPS..." : "SWIPE TO CLOCK IN"}
            </div>
            <div className="mt-1 text-xs font-semibold opacity-80">GPS Verified Required • Hub Boundary</div>
          </button>

          <div>
            <div className="mb-3 text-xs font-bold uppercase tracking-wide text-gray-500">Overview This Month</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Card>
                <div className="text-[11px] uppercase text-gray-500">Days Worked</div>
                <div className="mt-1 text-2xl font-extrabold">{data.week.daysWorked ?? data.week.hoursWorked}</div>
                <div className="mt-1 text-xs text-gray-500">This calendar month</div>
              </Card>
              <Card>
                <div className="text-[11px] uppercase text-gray-500">Target Hours</div>
                <div className="mt-1 text-2xl font-extrabold">{data.week.targetHours} hrs</div>
                <div className="mt-1 text-xs text-gray-500">Weekly target</div>
              </Card>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="text-center">
            <div className="font-mono text-5xl font-extrabold tracking-tight text-status-success">
              {hh}:{mm}:{ss}
            </div>
            <div className="mt-2 text-gray-500">Clocked In at {data.shift.start}</div>
          </div>

          <Card>
            <div className="flex items-center gap-2 rounded-lg bg-status-success/10 px-3 py-2 text-xs font-bold text-status-success">
              <span className="h-2 w-2 rounded-full bg-status-success" /> GPS VERIFIED
            </div>
            <div className="mt-4 flex items-center gap-2 font-semibold">
              <MapPin size={16} className="text-status-success" />
              {data.branch.name}
            </div>
            <div className="mt-4 border-t border-base-border pt-4">
              <div className="mb-1.5 flex justify-between text-xs text-gray-500">
                <span>SHIFT PROGRESS</span>
                <span>{shiftPct}% Complete</span>
              </div>
              <div className="h-2 rounded-full bg-ink/10">
                <div className="h-2 rounded-full bg-status-success" style={{ width: `${shiftPct}%` }} />
              </div>
            </div>
          </Card>

          {gpsError && (
            <div className="flex items-start gap-2 rounded-lg border border-status-danger/30 bg-status-danger/10 px-3 py-2.5 text-sm text-status-danger">
              <AlertCircle size={16} className="mt-0.5 shrink-0" /> {gpsError}
            </div>
          )}

          <button
            onClick={clockOut}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-status-danger py-5 text-lg font-extrabold text-status-danger"
          >
            <LogOut size={20} /> CLOCK OUT
          </button>
        </>
      )}

      {/* GPS verification modal */}
      {state === "gps" && (
        <div className="fixed inset-0 z-40 flex items-end bg-black/70">
          <div className="w-full rounded-t-3xl border-t border-base-border bg-base-surface p-6">
            <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-gray-700" />
            <h2 className="text-xl font-extrabold">GPS Location Verification</h2>
            <p className="mt-2 text-sm text-gray-400">
              {precheck?.withinRange
                ? "You are inside the geofence perimeter for your scheduled branch."
                : "You appear to be outside your branch's geofence perimeter."}
            </p>
            <div className={`mt-4 flex h-40 items-center justify-center rounded-xl border bg-black ${precheck?.withinRange ? "border-accent/40" : "border-status-danger/40"}`}>
              <div className={`h-20 w-20 animate-pulse rounded-full border-2 border-dashed ${precheck?.withinRange ? "border-accent" : "border-status-danger"}`} />
            </div>
            <div className="mt-4 space-y-2 border-t border-base-border pt-4 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">DISTANCE FROM BRANCH</span>
                <span className={`font-bold ${precheck?.withinRange ? "text-accent" : "text-status-danger"}`}>{precheck?.distance ?? "—"}m</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">ALLOWED RADIUS</span>
                <span className="font-bold">{precheck?.effectiveRadius ?? "—"}m</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">YOUR COORDINATES</span>
                <span className="font-bold">{coords ? `${coords.lat.toFixed(4)}°, ${coords.lng.toFixed(4)}°` : "—"}</span>
              </div>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button onClick={() => setState("idle")} className="rounded-xl bg-ink/10 py-3 font-bold text-ink">
                CANCEL
              </button>
              <button
                onClick={confirmClockIn}
                disabled={precheck ? !precheck.withinRange : false}
                className="rounded-xl bg-accent py-3 font-bold text-black disabled:opacity-40"
              >
                CONFIRM CLOCK IN
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
