"use client";
import { useEffect, useRef, useState } from "react";
import type L from "leaflet";

export interface MapBranch {
  id: string;
  name: string;
  lat: number;
  lng: number;
  address?: string;
  staffCount?: number;
  status?: string;
  radiusMeters?: number;
}

// Kenya: used to centre the map and to catch pins placed outside the country.
export const KENYA_BOUNDS = { south: -4.8, north: 5.1, west: 33.9, east: 41.95 };
export const inKenya = (lat: number, lng: number) =>
  lat >= KENYA_BOUNDS.south && lat <= KENYA_BOUNDS.north && lng >= KENYA_BOUNDS.west && lng <= KENYA_BOUNDS.east;
const KENYA_CENTER: [number, number] = [0.2, 37.9];

function colorFor(status?: string) {
  if (!status) return "#F6C90E";
  const s = status.toLowerCase();
  if (s.includes("inactive")) return "#6b7280";
  if (s.includes("critical") || s.includes("understaffed")) return "#EF4444";
  if (s.includes("alert") || s.includes("late")) return "#F59E0B";
  return "#22C55E";
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function BranchesMap({
  branches,
  selectedId,
  onSelect,
  height = 420,
  pendingPin,
  onMapClick,
}: {
  branches: MapBranch[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  height?: number;
  pendingPin?: { lat: number; lng: number; label?: string; radius?: number } | null;
  onMapClick?: (lat: number, lng: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const LRef = useRef<typeof L | null>(null);
  const layersRef = useRef<Record<string, { marker: L.Marker; circle: L.Circle }>>({});
  const pendingRef = useRef<{ marker: L.Marker; circle: L.Circle } | null>(null);
  const clickRef = useRef(onMapClick);
  const selectRef = useRef(onSelect);
  const [ready, setReady] = useState(false);

  useEffect(() => { clickRef.current = onMapClick; }, [onMapClick]);
  useEffect(() => { selectRef.current = onSelect; }, [onSelect]);

  // Create the map once, in the browser only.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!containerRef.current || mapRef.current) return;
      const mod = await import("leaflet");
      if (cancelled || !containerRef.current) return;
      const Lm = mod.default;
      LRef.current = Lm;
      const map = Lm.map(containerRef.current, { center: KENYA_CENTER, zoom: 6, scrollWheelZoom: true });
      Lm.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);
      map.on("click", (e: L.LeafletMouseEvent) => clickRef.current?.(e.latlng.lat, e.latlng.lng));
      mapRef.current = map;
      setReady(true);
    })();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      layersRef.current = {};
      pendingRef.current = null;
    };
  }, []);

  // Branches: a dot at the branch and a circle showing its real geofence radius.
  useEffect(() => {
    const map = mapRef.current;
    const Lm = LRef.current;
    if (!ready || !map || !Lm) return;
    const seen = new Set(branches.map((b) => b.id));
    for (const id of Object.keys(layersRef.current)) {
      if (!seen.has(id)) {
        layersRef.current[id].marker.remove();
        layersRef.current[id].circle.remove();
        delete layersRef.current[id];
      }
    }
    for (const b of branches) {
      const isSel = b.id === selectedId;
      const color = colorFor(b.status);
      const radius = b.radiusMeters || 1000;
      const dot = Lm.divIcon({
        className: "",
        html: `<div style="width:${isSel ? 18 : 12}px;height:${isSel ? 18 : 12}px;border-radius:9999px;background:${color};border:2px solid #0A0A0A"></div>`,
        iconSize: [isSel ? 18 : 12, isSel ? 18 : 12],
        iconAnchor: [isSel ? 9 : 6, isSel ? 9 : 6],
      });
      const popup = `<strong>${escapeHtml(b.name)}</strong><br/>${b.address ? `<span style="color:#888">${escapeHtml(b.address)}</span><br/>` : ""}Geofence: ${radius} m${b.staffCount !== undefined ? `<br/>${b.staffCount} staff` : ""}`;
      let entry = layersRef.current[b.id];
      if (!entry) {
        const marker = Lm.marker([b.lat, b.lng], { icon: dot }).addTo(map);
        const circle = Lm.circle([b.lat, b.lng], { radius, color, weight: 1.5, fillColor: color, fillOpacity: isSel ? 0.18 : 0.08 }).addTo(map);
        marker.on("click", () => selectRef.current?.(b.id));
        entry = { marker, circle };
        layersRef.current[b.id] = entry;
      } else {
        entry.marker.setLatLng([b.lat, b.lng]).setIcon(dot);
        entry.circle.setLatLng([b.lat, b.lng]).setRadius(radius).setStyle({ color, fillColor: color, fillOpacity: isSel ? 0.18 : 0.08 });
      }
      entry.marker.bindPopup(popup);
    }
    if (branches.length && !selectedId) {
      const bounds = Lm.latLngBounds(branches.map((b) => [b.lat, b.lng] as [number, number]));
      map.fitBounds(bounds.pad(0.3), { maxZoom: 9 });
    }
  }, [ready, branches, selectedId]);

  // Fly to the selected branch.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !selectedId) return;
    const b = branches.find((x) => x.id === selectedId);
    if (b) map.flyTo([b.lat, b.lng], Math.max(map.getZoom(), 13), { duration: 0.6 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, selectedId]);

  // Branch being created or edited: a pin plus its radius, redrawn when the radius changes.
  useEffect(() => {
    const map = mapRef.current;
    const Lm = LRef.current;
    if (!ready || !map || !Lm) return;
    if (pendingRef.current) {
      pendingRef.current.marker.remove();
      pendingRef.current.circle.remove();
      pendingRef.current = null;
    }
    if (pendingPin) {
      const dot = Lm.divIcon({
        className: "",
        html: `<div style="width:18px;height:18px;border-radius:9999px;background:#F6C90E;border:2px solid #0A0A0A"></div>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      });
      const marker = Lm.marker([pendingPin.lat, pendingPin.lng], { icon: dot }).addTo(map);
      const circle = Lm.circle([pendingPin.lat, pendingPin.lng], {
        radius: pendingPin.radius || 1000, color: "#F6C90E", weight: 2, fillColor: "#F6C90E", fillOpacity: 0.12,
      }).addTo(map);
      if (pendingPin.label) marker.bindPopup(escapeHtml(pendingPin.label));
      pendingRef.current = { marker, circle };
      map.flyTo([pendingPin.lat, pendingPin.lng], Math.max(map.getZoom(), 14), { duration: 0.5 });
    }
  }, [ready, pendingPin?.lat, pendingPin?.lng, pendingPin?.radius, pendingPin?.label]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      ref={containerRef}
      style={{ height, width: "100%", borderRadius: 14, cursor: onMapClick ? "crosshair" : undefined }}
      className="z-0 overflow-hidden border border-base-border bg-base-card"
    />
  );
}
