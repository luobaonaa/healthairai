import {
  Bike,
  BusFront,
  CarFront,
  Clock3,
  Footprints,
  MapPin,
  Navigation,
  Route,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import React, { useMemo } from "react";
import {
  getLowExposureRoute,
  travelModeOptions,
  type LocationSelection,
  type TravelMode,
} from "@/lib/environment";

const modeIcons: Record<TravelMode, typeof Footprints> = {
  walk: Footprints,
  motor: Bike,
  car: CarFront,
  transit: BusFront,
};

type RoutePlannerProps = {
  origin: LocationSelection;
  destination: LocationSelection;
  candidates: LocationSelection[];
  mode: TravelMode;
  roadRoute?: {
    distanceMeters: number;
    durationSeconds: number;
    summary: string;
    provider: "Google Maps" | "OpenStreetMap";
    options?: Array<{
      distanceMeters: number;
      durationSeconds: number;
      summary: string;
    }>;
    transit?: {
      lineName: string | null;
      lineShortName: string | null;
      vehicleName: string | null;
      agencyName: string | null;
      headsign: string | null;
      departureStop: string | null;
      arrivalStop: string | null;
      departureTime: string | null;
      arrivalTime: string | null;
      stopCount: number | null;
    } | null;
  } | null;
  isRoadRouteLoading?: boolean;
  routeExposure?: {
    estimatedAqi: number;
    minimumAqi: number;
    maximumAqi: number;
    sampleCount: number;
    requestedSampleCount: number;
    coverage: number;
    source: "Open-Meteo";
    method: "sampled-route-model";
  } | null;
  isRouteExposureLoading?: boolean;
  selectedRouteOption: number;
  isSelfRoute: boolean;
  destinationSearch: string;
  destinationSuggestions: LocationSelection[];
  isDestinationSearching?: boolean;
  onOriginChange: (location: LocationSelection) => void;
  onDestinationChange: (location: LocationSelection) => void;
  onDestinationSearchChange: (value: string) => void;
  onDestinationSuggestionSelect: (location: LocationSelection) => void;
  onModeChange: (mode: TravelMode) => void;
  onRouteOptionSelect: (index: number) => void;
  onSelfRoute: () => void;
  onStartNavigation: () => void;
  onClose: () => void;
};

export default function RoutePlanner({
  origin,
  destination,
  candidates,
  mode,
  roadRoute,
  isRoadRouteLoading = false,
  routeExposure,
  isRouteExposureLoading = false,
  selectedRouteOption,
  isSelfRoute,
  destinationSearch,
  destinationSuggestions,
  isDestinationSearching = false,
  onOriginChange,
  onDestinationChange,
  onDestinationSearchChange,
  onDestinationSuggestionSelect,
  onModeChange,
  onRouteOptionSelect,
  onSelfRoute,
  onStartNavigation,
  onClose,
}: RoutePlannerProps) {
  const route = useMemo(
    () => getLowExposureRoute(origin, destination, mode),
    [destination, mode, origin]
  );
  const selectLocation = (value: string) =>
    candidates.find(item => `${item.lat},${item.lng}` === value);
  const distanceLabel = roadRoute
    ? `${(roadRoute.distanceMeters / 1000).toFixed(1).replace(".", ",")} km`
    : route.distanceLabel;
  const travelMinutes = roadRoute
    ? Math.max(1, Math.round(roadRoute.durationSeconds / 60))
    : route.estimatedMinutes;
  const exposureAqi = routeExposure?.estimatedAqi ?? route.estimatedExposureAqi;

  return (
    <section
      className="map-overlay route-planner map-glass"
      aria-label="Perencana rute udara lebih aman"
    >
      <div className="route-navigation-top">
        <span>
          <Navigation size={15} /> Rute udara lebih aman
        </span>
        <button onClick={onClose} aria-label="Tutup rute">
          <X size={14} />
        </button>
      </div>
      <p className="route-planner-intro">
        Pilih dua lokasi, lalu HealthAir menyeimbangkan jarak dengan estimasi
        paparan udara.
      </p>
      <div className="route-location-selectors">
        <label>
          <span>
            <MapPin size={12} /> Mulai dari
          </span>
          <select
            aria-label="Pilih lokasi awal rute"
            value={`${origin.lat},${origin.lng}`}
            onChange={event => {
              const next = selectLocation(event.target.value);
              if (next) onOriginChange(next);
            }}
          >
            {candidates.map(item => (
              <option
                key={`origin-${item.lat}-${item.lng}`}
                value={`${item.lat},${item.lng}`}
              >
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label className="route-destination-field">
          <span>
            <MapPin size={12} /> Menuju
          </span>
          <div className="route-destination-input">
            <Search size={13} />
            <input
              aria-label="Ketik tujuan rute"
              value={destinationSearch}
              onChange={event => onDestinationSearchChange(event.target.value)}
              onKeyDown={event => {
                if (event.key === "Enter" && destinationSuggestions[0]) {
                  event.preventDefault();
                  onDestinationSuggestionSelect(destinationSuggestions[0]);
                }
              }}
              placeholder={destination.name}
            />
          </div>
          {destinationSearch.trim() && (
            <div
              className="route-destination-suggestions"
              role="listbox"
              aria-label="Saran tujuan rute"
            >
              {isDestinationSearching ? (
                <p>Mencari tujuan…</p>
              ) : destinationSuggestions.length ? (
                destinationSuggestions.map(item => (
                  <button
                    key={`${item.name}-${item.lat}-${item.lng}`}
                    type="button"
                    role="option"
                    onClick={() => onDestinationSuggestionSelect(item)}
                  >
                    <MapPin size={12} />
                    <span>
                      <strong>{item.name}</strong>
                      <small>{item.caption}</small>
                    </span>
                  </button>
                ))
              ) : (
                <p>Lokasi tidak ditemukan. Coba nama area atau tempat lain.</p>
              )}
            </div>
          )}
          {!destinationSearch.trim() && (
            <small className="route-destination-current">
              Tujuan aktif: {destination.name}
            </small>
          )}
        </label>
      </div>
      <div className="route-mode-grid" aria-label="Pilih moda perjalanan">
        {travelModeOptions.map(option => {
          const Icon = modeIcons[option.id];
          return (
            <button
              key={option.id}
              className={mode === option.id ? "active" : ""}
              type="button"
              onClick={() => onModeChange(option.id)}
            >
              <Icon size={15} />
              <span>{option.label}</span>
            </button>
          );
        })}
      </div>
      <div className="route-choice-grid" aria-label="Pilih jalur rute">
        {(roadRoute?.options ?? []).slice(0, 2).map((option, index) => (
          <button
            type="button"
            className={
              !isSelfRoute && selectedRouteOption === index ? "active" : ""
            }
            key={`${option.summary}-${index}`}
            onClick={() => onRouteOptionSelect(index)}
          >
            <Route size={13} />
            <span>
              <strong>
                {index === 0 ? "Rute rekomendasi" : "Rute alternatif"}
              </strong>
              <small>
                {(option.distanceMeters / 1000).toFixed(1).replace(".", ",")} km
                · ±{Math.max(1, Math.round(option.durationSeconds / 60))} mnt
              </small>
            </span>
          </button>
        ))}
        <button
          type="button"
          className={isSelfRoute ? "active" : ""}
          onClick={onSelfRoute}
        >
          <SlidersHorizontal size={13} />
          <span>
            <strong>Pilih rute sendiri</strong>
            <small>Atur titik dan moda di atas</small>
          </span>
        </button>
      </div>
      {isSelfRoute && (
        <p className="route-self-route-note">
          Susun rute sendiri dengan mengganti titik awal, tujuan, dan moda.
          Jalur yang ditampilkan tetap mengikuti jalan yang tersedia.
        </p>
      )}
      <div className="route-estimate-card">
        <div>
          <span className="route-estimate-kicker">
            <Route size={12} />{" "}
            {roadRoute
              ? "RUTE JALAN"
              : isRoadRouteLoading
                ? "MENYIAPKAN RUTE JALAN"
                : "RUTE TIDAK TERSEDIA"}
          </span>
          <strong>
            {origin.name} ke {destination.name}
          </strong>
          <p>
            {roadRoute
              ? isRouteExposureLoading
                ? `Mengikuti ${roadRoute.summary}. Mengambil sampel kualitas udara sepanjang ruas…`
                : routeExposure
                  ? `${routeExposure.sampleCount} titik di sepanjang ${roadRoute.summary} telah dianalisis dengan cakupan ${routeExposure.coverage}%.`
                  : `Mengikuti ${roadRoute.summary}. ${route.exposureLabel} masih memakai estimasi titik awal dan tujuan.`
              : isRoadRouteLoading
                ? "Mencari jalur yang mengikuti ruas jalan pada peta…"
                : "Jalur jalan belum tersedia. Coba pilih ulang titik atau moda perjalanan."}
          </p>
        </div>
        <div className="route-estimate-stats">
          <span>
            <Route size={13} /> {distanceLabel}
          </span>
          <span>
            <Clock3 size={13} /> ±{travelMinutes} menit
          </span>
          <span>
            <Navigation size={13} />{" "}
            {routeExposure
              ? `AQI rute ${exposureAqi} (${routeExposure.minimumAqi}–${routeExposure.maximumAqi})`
              : `Est. AQI ${exposureAqi}`}
          </span>
        </div>
      </div>
      {mode === "transit" && (
        <div className="route-transit-info">
          <span>
            <BusFront size={14} /> Informasi TransJakarta / angkot
          </span>
          {roadRoute?.transit ? (
            <>
              <strong>
                {roadRoute.transit.lineShortName ||
                  roadRoute.transit.lineName ||
                  roadRoute.transit.vehicleName ||
                  "Layanan transit"}
                {roadRoute.transit.headsign
                  ? ` · arah ${roadRoute.transit.headsign}`
                  : ""}
              </strong>
              <small>
                {roadRoute.transit.departureStop
                  ? `Naik di ${roadRoute.transit.departureStop}`
                  : "Titik naik tersedia di rute"}
                {roadRoute.transit.arrivalStop
                  ? ` · turun di ${roadRoute.transit.arrivalStop}`
                  : ""}
              </small>
            </>
          ) : (
            <small>
              Detail TransJakarta, bus lokal, atau angkot belum tersedia untuk
              rute ini. Jadwal dan posisi kendaraan langsung operator belum
              terhubung.
            </small>
          )}
        </div>
      )}
      <p className="route-disclaimer">
        {roadRoute
          ? routeExposure
            ? `Paparan dihitung dari ${routeExposure.sampleCount} sampel model di sepanjang geometri jalan ${roadRoute.provider}; bukan sensor pada setiap ruas dan dapat berbeda dari kondisi lapangan.`
            : `Sampel rute belum tersedia; estimasi sementara memakai titik awal dan tujuan. Geometri jalan dari ${roadRoute.provider}.`
          : "Tidak ada garis lurus pengganti: peta hanya akan menggambar rute setelah jalur jalan tersedia."}
      </p>
      <button
        type="button"
        className="route-start-navigation"
        disabled={!roadRoute || isRoadRouteLoading}
        onClick={onStartNavigation}
      >
        <Navigation size={14} /> Mulai navigasi
      </button>
    </section>
  );
}
