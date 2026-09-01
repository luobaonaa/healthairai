import { BusFront, ChevronDown, Crosshair, MapPin, Navigation, Route, X } from "lucide-react";
import React from "react";
import { formatNavigationDistance, type NavigationStep, type RouteNavigationProgress, type TravelMode } from "@/lib/environment";

type TransitDetails = { lineName: string | null; lineShortName: string | null; vehicleName: string | null; agencyName: string | null; headsign: string | null; departureStop: string | null; arrivalStop: string | null; departureTime: string | null; arrivalTime: string | null; stopCount: number | null };
type RouteInfo = { distanceMeters: number; durationSeconds: number; summary: string; steps: NavigationStep[]; transit: TransitDetails | null };

type RouteNavigationModeProps = {
  destinationName: string;
  mode: TravelMode;
  route: RouteInfo;
  progress: RouteNavigationProgress | null;
  onStop: () => void;
  onEditRoute: () => void;
};

export default function RouteNavigationMode({ destinationName, mode, route, progress, onStop, onEditRoute }: RouteNavigationModeProps) {
  const nextStep = route.steps[progress?.nextStepIndex ?? 0];
  const distance = progress ? formatNavigationDistance(progress.distanceToInstructionMeters) : "Menunggu GPS";
  const remaining = progress ? formatNavigationDistance(progress.remainingMeters) : formatNavigationDistance(route.distanceMeters);
  const transit = route.transit;
  return <section className="map-overlay route-navigation-mode" aria-label="Navigasi rute aktif">
    <div className="navigation-top"><span><Navigation size={17} /> Navigasi aktif</span><button type="button" onClick={onStop} aria-label="Tutup navigasi"><X size={16} /></button></div>
    <div className="navigation-maneuver"><span className="navigation-distance">{distance}</span><strong>{nextStep?.instruction ?? "Ikuti jalur menuju tujuan"}</strong><small>{remaining} tersisa menuju {destinationName}</small></div>
    <div className="navigation-progress"><span style={{ width: `${progress ? Math.max(4, Math.min(100, 100 - (progress.remainingMeters / Math.max(1, route.distanceMeters)) * 100)) : 4}%` }} /></div>
    {progress?.offRouteMeters && progress.offRouteMeters > 55 ? <p className="navigation-off-route"><Crosshair size={13} /> Anda sekitar {formatNavigationDistance(progress.offRouteMeters)} dari jalur. Kembali ke garis rute bila aman.</p> : <p className="navigation-status"><Route size={13} /> Sisa jarak diperbarui dari lokasi perangkat saat bergerak.</p>}
    {mode === "transit" && <div className="navigation-transit"><span><BusFront size={16} /> Transportasi umum</span>{transit ? <><strong>{transit.lineShortName || transit.lineName || transit.vehicleName || "Layanan transit"}{transit.headsign ? ` · arah ${transit.headsign}` : ""}</strong><p>{transit.departureStop ? `Naik di ${transit.departureStop}` : "Titik naik dari hasil rute"}{transit.arrivalStop ? ` · turun di ${transit.arrivalStop}` : ""}</p><small>{transit.stopCount ? `${transit.stopCount} pemberhentian` : "Jumlah pemberhentian belum tersedia"}{transit.departureTime ? ` · berangkat ${transit.departureTime}` : ""}</small></> : <><strong>TransJakarta, bus lokal, atau angkot</strong><p>Detail layanan tidak tersedia untuk rute ini.</p><small>Jadwal dan posisi kendaraan langsung operator belum terhubung.</small></>}</div>}
    <div className="navigation-actions"><button type="button" onClick={onEditRoute}><MapPin size={13} /> Ubah rute</button><button type="button" onClick={onStop}><ChevronDown size={13} /> Selesai</button></div>
  </section>;
}
