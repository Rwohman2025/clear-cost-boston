import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { MapPin, Navigation } from "lucide-react";
import type { Hospital } from "@/lib/models/types";

type LeafletMap = { remove: () => void; fitBounds: (bounds: unknown, options?: { padding?: [number, number]; maxZoom?: number }) => void; setView: (center: [number, number], zoom: number) => void };
type Leaflet = {
  map: (element: HTMLElement, options?: Record<string, unknown>) => LeafletMap;
  tileLayer: (url: string, options: Record<string, unknown>) => { addTo: (map: LeafletMap) => unknown };
  marker: (coordinates: [number, number], options?: Record<string, unknown>) => { addTo: (map: LeafletMap) => { bindPopup: (content: string) => unknown } };
  divIcon: (options: Record<string, unknown>) => unknown;
  featureGroup: (layers: unknown[]) => { getBounds: () => unknown };
};

declare global { interface Window { L?: Leaflet } }

const leafletCss = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
const leafletJs = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[character] ?? character));
}

function loadLeaflet(): Promise<Leaflet> {
  if (window.L) return Promise.resolve(window.L);
  const existing = document.querySelector<HTMLScriptElement>('script[data-clearcost-leaflet]');
  if (!document.querySelector(`link[href="${leafletCss}"]`)) {
    const stylesheet = document.createElement("link");
    stylesheet.rel = "stylesheet";
    stylesheet.href = leafletCss;
    document.head.appendChild(stylesheet);
  }
  return new Promise((resolve, reject) => {
    const script = existing ?? document.createElement("script");
    const finish = () => window.L ? resolve(window.L) : reject(new Error("Map library did not load."));
    if (existing) {
      existing.addEventListener("load", finish, { once: true });
      existing.addEventListener("error", () => reject(new Error("Map library did not load.")), { once: true });
      return;
    }
    script.src = leafletJs;
    script.async = true;
    script.dataset.clearcostLeaflet = "true";
    script.addEventListener("load", finish, { once: true });
    script.addEventListener("error", () => reject(new Error("Map library did not load.")), { once: true });
    document.head.appendChild(script);
  });
}

export function HospitalMap({ hospitals }: { hospitals: Hospital[] }) {
  const container = useRef<HTMLDivElement>(null);
  const [mapError, setMapError] = useState(false);
  const located = useMemo(() => hospitals.filter((hospital) => hospital.latitude != null && hospital.longitude != null), [hospitals]);
  const locationKey = located.map((hospital) => `${hospital.id}:${hospital.latitude}:${hospital.longitude}:${hospital.name}:${hospital.address}`).join("|");

  useEffect(() => {
    if (!container.current || !located.length) return;
    let active = true;
    let map: LeafletMap | undefined;
    loadLeaflet().then((L) => {
      if (!active || !container.current) return;
      map = L.map(container.current, { scrollWheelZoom: false, zoomControl: true });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors",
        maxZoom: 19,
      }).addTo(map);
      const markers = located.map((hospital, index) => {
        const icon = L.divIcon({
          className: "",
          html: `<span style="display:grid;width:32px;height:32px;place-items:center;border:2px solid white;border-radius:9999px 9999px 9999px 0;background:#7c2d3b;color:white;box-shadow:0 3px 10px rgb(0 0 0 / .28);font:700 12px system-ui;transform:rotate(-45deg)"><b style="transform:rotate(45deg)">${index + 1}</b></span>`,
          iconSize: [32, 32],
          iconAnchor: [16, 32],
          popupAnchor: [0, -32],
        });
        const marker = L.marker([hospital.latitude!, hospital.longitude!], { icon }).addTo(map!);
        marker.bindPopup(`<strong>${escapeHtml(hospital.name)}</strong><br/><span>${escapeHtml(hospital.address)}</span>`);
        return marker;
      });
      if (markers.length === 1) map.setView([located[0].latitude!, located[0].longitude!], 14);
      else map.fitBounds(L.featureGroup(markers).getBounds(), { padding: [42, 42], maxZoom: 14 });
    }).catch(() => active && setMapError(true));
    return () => { active = false; map?.remove(); };
  }, [locationKey]); // Rebuild only when the shown hospitals or their locations change.

  if (!located.length) return null;

  return (
    <section className="card-surface overflow-hidden">
      <div className="flex flex-col gap-1 border-b px-5 py-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-base font-semibold">Hospital map</h2>
          <p className="mt-1 text-sm text-muted-foreground">Choose a pin or a hospital to see its exact facility address.</p>
        </div>
        <span className="text-xs text-muted-foreground">Drag to explore · scroll is disabled</span>
      </div>
      <div className="grid lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="relative min-h-[22rem] bg-muted sm:min-h-[28rem]">
          <div ref={container} className="absolute inset-0" aria-label="Interactive map of hospitals with published pricing data" />
          {mapError && <div className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-muted-foreground">The map could not load. Each hospital’s exact address is still listed here.</div>}
        </div>
        <div className="divide-y border-t bg-card lg:max-h-[28rem] lg:overflow-y-auto lg:border-l lg:border-t-0">
          {located.map((hospital, index) => (
            <Link key={hospital.id} to="/hospitals/$hospitalId" params={{ hospitalId: hospital.id }} className="flex gap-3 px-4 py-3 transition-colors hover:bg-muted/60">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">{index + 1}</span>
              <span className="min-w-0">
                <span className="block font-medium leading-snug">{hospital.name}</span>
                <span className="mt-0.5 flex items-start gap-1 text-xs text-muted-foreground"><Navigation className="mt-0.5 h-3 w-3 shrink-0" />{hospital.address}</span>
              </span>
            </Link>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2 border-t px-5 py-3 text-xs text-muted-foreground"><MapPin className="h-3.5 w-3.5 text-primary" />Pin positions come from the street address saved with each upload.</div>
    </section>
  );
}
