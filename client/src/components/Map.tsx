import { AlertTriangle, RefreshCw } from "lucide-react";
import React from "react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export type MapCenter = { lat: number; lng: number };
export type MapLibreMarker = {
  setLngLat: (position: [number, number]) => MapLibreMarker;
  addTo: (map: MapLibreInstance) => MapLibreMarker;
  remove: () => void;
  getElement: () => HTMLElement;
};
export type MapLibreInstance = {
  addControl: (control: unknown, position?: "top-right" | "top-left" | "bottom-right" | "bottom-left") => void;
  addLayer?: (layer: unknown) => void;
  addSource?: (id: string, source: unknown) => void;
  on: (event: string, handler: (event: unknown) => void) => void;
  off: (event: string, handler: (event: unknown) => void) => void;
  getLayer?: (id: string) => unknown;
  getSource?: (id: string) => { setData?: (data: unknown) => void } | undefined;
  fitBounds?: (bounds: [[number, number], [number, number]], options?: { padding?: { top: number; right: number; bottom: number; left: number }; maxZoom?: number; duration?: number }) => void;
  remove: () => void;
  removeLayer?: (id: string) => void;
  removeSource?: (id: string) => void;
  getZoom: () => number;
  flyTo: (options: { center: [number, number]; zoom?: number; essential?: boolean }) => void;
};

type MapLibreGlobal = {
  Map: new (options: Record<string, unknown>) => MapLibreInstance;
  Marker: new (options?: { element?: HTMLElement }) => MapLibreMarker;
  NavigationControl: new (options?: { showCompass?: boolean }) => unknown;
  FullscreenControl: new () => unknown;
};

declare global {
  interface Window { maplibregl?: MapLibreGlobal; }
}

type MapViewProps = {
  className?: string;
  initialCenter?: MapCenter;
  initialZoom?: number;
  onMapReady?: (map: MapLibreInstance) => void;
  onMapError?: (error: Error) => void;
};

const OPEN_FREE_MAP_STYLE = "https://tiles.openfreemap.org/styles/liberty";
const MAPLIBRE_SCRIPT_ID = "healthair-maplibre-sdk";
let mapLibrePromise: Promise<MapLibreGlobal> | null = null;

export function getMapLibre() {
  return window.maplibregl;
}

function loadMapLibre() {
  if (window.maplibregl) return Promise.resolve(window.maplibregl);
  if (mapLibrePromise) return mapLibrePromise;
  mapLibrePromise = new Promise<MapLibreGlobal>((resolve, reject) => {
    const script = document.createElement("script");
    script.id = MAPLIBRE_SCRIPT_ID;
    script.src = "https://unpkg.com/maplibre-gl@5.12.0/dist/maplibre-gl.js";
    script.async = true;
    script.onload = () => window.maplibregl ? resolve(window.maplibregl) : reject(new Error("MapLibre dimuat tanpa API peta"));
    script.onerror = () => reject(new Error("MapLibre tidak dapat dimuat"));
    document.head.appendChild(script);
  });
  return mapLibrePromise;
}

export function MapView({ className, initialCenter = { lat: -6.175392, lng: 106.827153 }, initialZoom = 12, onMapReady, onMapError }: MapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const onMapReadyRef = useRef(onMapReady);
  const onMapErrorRef = useRef(onMapError);
  const [loadError, setLoadError] = useState<Error | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => { onMapReadyRef.current = onMapReady; }, [onMapReady]);
  useEffect(() => { onMapErrorRef.current = onMapError; }, [onMapError]);

  useEffect(() => {
    if (!mapContainer.current) return;
    let map: MapLibreInstance | null = null;
    let active = true;
    setLoadError(null);

    const initialize = async () => {
      try {
        const mapLibre = await loadMapLibre();
        if (!active || !mapContainer.current) return;
        map = new mapLibre.Map({
          container: mapContainer.current,
          style: OPEN_FREE_MAP_STYLE,
          center: [initialCenter.lng, initialCenter.lat],
          zoom: initialZoom,
          dragRotate: false,
          touchPitch: false,
        });
        map.addControl(new mapLibre.NavigationControl({ showCompass: false }), "top-right");
        if (document.fullscreenEnabled) map.addControl(new mapLibre.FullscreenControl(), "top-right");
        const handleLoad = () => map && onMapReadyRef.current?.(map);
        const handleError = (event: unknown) => {
          const source = typeof event === "object" && event && "error" in event ? event.error : null;
          const message = typeof source === "object" && source && "message" in source && typeof source.message === "string" ? source.message : "Peta interaktif tidak dapat dimuat";
          if (!active || /signal is aborted|aborterror|aborted without reason/i.test(message)) return;
          const error = new Error(message);
          setLoadError(error);
          onMapErrorRef.current?.(error);
        };
        map.on("load", handleLoad);
        map.on("error", handleError);
      } catch (error) {
        if (!active) return;
        const resolved = error instanceof Error ? error : new Error("Peta interaktif tidak dapat dimuat");
        setLoadError(resolved);
        onMapErrorRef.current?.(resolved);
      }
    };

    void initialize();
    return () => { active = false; map?.remove(); };
  }, [initialCenter.lat, initialCenter.lng, initialZoom, retryKey]);

  return <div className={cn("relative h-[500px] w-full overflow-hidden", className)}><div ref={mapContainer} className="h-full w-full" />{loadError && <div className="absolute inset-0 z-20 grid place-items-center bg-slate-950/10 p-5" role="alert"><div className="w-full max-w-sm rounded-2xl border border-white/70 bg-white/95 p-5 text-center text-slate-700 shadow-2xl backdrop-blur-sm"><span className="mx-auto grid h-11 w-11 place-items-center rounded-xl bg-sky-100 text-sky-700"><AlertTriangle size={21} /></span><h2 className="mt-3 text-base font-extrabold tracking-tight">Peta belum tersedia</h2><p className="mt-1.5 text-xs leading-5 text-slate-500">Koneksi ke layanan peta belum berhasil. Anda masih dapat memilih lokasi melalui pencarian setelah layanan kembali tersedia.</p><button type="button" className="mt-4 inline-flex min-h-9 items-center gap-2 rounded-full bg-sky-600 px-4 text-xs font-extrabold text-white transition hover:bg-sky-700 active:scale-[.97]" onClick={() => setRetryKey(value => value + 1)}><RefreshCw size={14} /> Coba lagi</button></div></div>}</div>;
}
