import {
  getMapLibre,
  MapView,
  type MapCenter,
  type MapLibreInstance,
  type MapLibreMarker,
} from "@/components/Map";
import {
  getLowExposureRoute,
  getRouteNavigationProgress,
  type LocationSelection,
  type RouteNavigationProgress,
  type TravelMode,
} from "@/lib/environment";
import React, { useEffect, useRef, useState } from "react";

export type RouteQuality = {
  distanceKm: number;
  estimatedAqi: number;
  estimatedMinutes: number;
  mode: TravelMode;
  alternativeCount: number;
  selectedIndex: number;
  label: string;
};
export type LocationErrorReason = "unsupported" | "denied" | "unavailable";

type EnvironmentalMapProps = {
  locateRequest: number;
  focusLocation: LocationSelection;
  routeOrigin?: LocationSelection;
  routeDestination: LocationSelection | null;
  routeMode?: TravelMode;
  roadRoute?: {
    coordinates: Array<[number, number]>;
    distanceMeters: number;
    durationSeconds: number;
    summary: string;
    provider: "Google Maps" | "OpenStreetMap";
    steps?: Array<{
      instruction: string;
      distanceMeters: number;
      durationSeconds: number;
      start: [number, number];
      end: [number, number];
      travelMode: string;
    }>;
  } | null;
  roadRouteLoading?: boolean;
  navigationActive?: boolean;
  onNavigationProgress?: (progress: RouteNavigationProgress | null) => void;
  routeRequest: number;
  routeActive: boolean;
  recommendedPlaces: LocationSelection[];
  onLocationSelected: (location: LocationSelection) => void;
  onMapLocationSelected: (location: LocationSelection) => void;
  onLocationRequesting: () => void;
  onLocationError: (reason: LocationErrorReason) => void;
  onRouteStatus: (status: "ready" | "error") => void;
  onRouteQuality: (quality: RouteQuality | null) => void;
};

type OpenMeteoSearch = {
  results?: Array<{
    name: string;
    admin1?: string;
    country?: string;
    latitude: number;
    longitude: number;
  }>;
};

function markerElement(kind: "user" | "place") {
  const marker = document.createElement("div");
  marker.className = kind === "user" ? "map-user-marker" : "map-place-marker";
  if (kind === "place")
    marker.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 21s6-5.2 6-11a6 6 0 1 0-12 0c0 5.8 6 11 6 11Z"/><circle cx="12" cy="10" r="2"/></svg>';
  return marker;
}

function mapCenter(location: LocationSelection): MapCenter {
  return { lat: location.lat, lng: location.lng };
}

export default function EnvironmentalMap({
  locateRequest,
  focusLocation,
  routeOrigin,
  routeDestination,
  routeMode = "walk",
  roadRoute,
  roadRouteLoading = false,
  navigationActive = false,
  onNavigationProgress,
  routeRequest,
  routeActive,
  recommendedPlaces,
  onLocationSelected,
  onMapLocationSelected,
  onLocationRequesting,
  onLocationError,
  onRouteStatus,
  onRouteQuality,
}: EnvironmentalMapProps) {
  const mapRef = useRef<MapLibreInstance | null>(null);
  const selectedMarkerRef = useRef<MapLibreMarker | null>(null);
  const navigationMarkerRef = useRef<MapLibreMarker | null>(null);
  const recommendedMarkerRefs = useRef<MapLibreMarker[]>([]);
  const [mapReady, setMapReady] = useState(false);

  const selectLocation = (location: LocationSelection, pan = true) => {
    const map = mapRef.current;
    const mapLibre = getMapLibre();
    if (map && mapLibre) {
      if (pan)
        map.flyTo({
          center: [location.lng, location.lat],
          zoom: Math.max(map.getZoom(), 13),
          essential: true,
        });
      selectedMarkerRef.current?.remove();
      selectedMarkerRef.current = new mapLibre.Marker({
        element: markerElement(location.kind === "place" ? "place" : "user"),
      })
        .setLngLat([location.lng, location.lat])
        .addTo(map);
    }
    onLocationSelected(location);
  };

  useEffect(() => {
    const map = mapRef.current;
    const mapLibre = getMapLibre();
    if (!map || !mapLibre || !mapReady) return;
    recommendedMarkerRefs.current.forEach(marker => marker.remove());
    recommendedMarkerRefs.current = recommendedPlaces.map(place => {
      const marker = new mapLibre.Marker({ element: markerElement("place") })
        .setLngLat([place.lng, place.lat])
        .addTo(map);
      const element = marker.getElement();
      element.tabIndex = 0;
      element.setAttribute("role", "button");
      element.setAttribute("aria-label", `Pilih ${place.name} pada peta`);
      element.addEventListener("click", () => selectLocation(place));
      element.addEventListener("keydown", event => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          selectLocation(place);
        }
      });
      return marker;
    });
    // Marker replacement is only needed when the location list changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, recommendedPlaces]);

  useEffect(() => {
    if (locateRequest === 0) return;
    if (!navigator.geolocation) {
      onLocationError("unsupported");
      return;
    }
    onLocationRequesting();
    navigator.geolocation.getCurrentPosition(
      position =>
        selectLocation({
          name: "Lokasi saya",
          caption: "Lokasi perangkat saat ini",
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          kind: "user",
        }),
      error =>
        onLocationError(
          error.code === error.PERMISSION_DENIED ? "denied" : "unavailable"
        ),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 120000 }
    );
    // Geolocation is only run after the user's explicit request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locateRequest, mapReady]);

  useEffect(() => {
    if (!mapReady) return;
    selectLocation(focusLocation, false);
    // A selected location is the source of truth for the marker and the live environmental query.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusLocation.lat, focusLocation.lng, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    const mapLibre = getMapLibre();
    if (!navigationActive || !roadRoute || !map || !mapLibre || !mapReady) {
      navigationMarkerRef.current?.remove();
      navigationMarkerRef.current = null;
      onNavigationProgress?.(null);
      return;
    }
    if (!navigator.geolocation) {
      onLocationError("unsupported");
      return;
    }
    onLocationRequesting();
    const watchId = navigator.geolocation.watchPosition(
      position => {
        const current: [number, number] = [
          position.coords.longitude,
          position.coords.latitude,
        ];
        if (!navigationMarkerRef.current)
          navigationMarkerRef.current = new mapLibre.Marker({
            element: markerElement("user"),
          })
            .setLngLat(current)
            .addTo(map);
        else navigationMarkerRef.current.setLngLat(current);
        map.flyTo({
          center: current,
          zoom: Math.max(map.getZoom(), 16.5),
          essential: true,
        });
        onNavigationProgress?.(
          getRouteNavigationProgress(
            roadRoute.coordinates,
            roadRoute.steps ?? [],
            current
          )
        );
      },
      error =>
        onLocationError(
          error.code === error.PERMISSION_DENIED ? "denied" : "unavailable"
        ),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );
    return () => {
      navigator.geolocation.clearWatch(watchId);
      navigationMarkerRef.current?.remove();
      navigationMarkerRef.current = null;
    };
  }, [
    mapReady,
    navigationActive,
    onLocationError,
    onLocationRequesting,
    onNavigationProgress,
    roadRoute,
  ]);

  useEffect(() => {
    const map = mapRef.current;
    const sourceId = "healthair-low-exposure-route";
    const casingId = "healthair-low-exposure-route-casing";
    const layerId = "healthair-low-exposure-route-line";
    const removeRoute = () => {
      if (!map) return;
      try {
        if (map.getLayer?.(layerId)) map.removeLayer?.(layerId);
        if (map.getLayer?.(casingId)) map.removeLayer?.(casingId);
        if (map.getSource?.(sourceId)) map.removeSource?.(sourceId);
      } catch {
        // MapLibre may have been removed before React runs an effect cleanup.
      }
    };
    if (
      !routeActive ||
      !routeDestination ||
      routeRequest === 0 ||
      !map ||
      !mapReady
    ) {
      removeRoute();
      return;
    }
    if (roadRouteLoading) return removeRoute;
    if (!roadRoute || roadRoute.coordinates.length < 2) {
      removeRoute();
      onRouteQuality(null);
      onRouteStatus("error");
      return;
    }
    const origin = routeOrigin ?? focusLocation;
    const estimate = getLowExposureRoute(origin, routeDestination, routeMode);
    const routeFeature = {
      type: "Feature" as const,
      properties: {},
      geometry: {
        type: "LineString" as const,
        coordinates: roadRoute.coordinates,
      },
    };
    try {
      const existingSource = map.getSource?.(sourceId);
      if (existingSource?.setData) existingSource.setData(routeFeature);
      else if (map.addSource && map.addLayer) {
        map.addSource(sourceId, { type: "geojson", data: routeFeature });
        map.addLayer({
          id: casingId,
          type: "line",
          source: sourceId,
          layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            "line-color": "#ffffff",
            "line-width": 10,
            "line-opacity": 0.96,
          },
        });
        map.addLayer({
          id: layerId,
          type: "line",
          source: sourceId,
          layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            "line-color": "#087e99",
            "line-width": 6,
            "line-opacity": 0.96,
          },
        });
      }
      const bounds = roadRoute.coordinates.reduce(
        ([minLng, minLat, maxLng, maxLat], [lng, lat]) => [
          Math.min(minLng, lng),
          Math.min(minLat, lat),
          Math.max(maxLng, lng),
          Math.max(maxLat, lat),
        ],
        [Infinity, Infinity, -Infinity, -Infinity]
      );
      map.flyTo({
        center: [(bounds[0] + bounds[2]) / 2, (bounds[1] + bounds[3]) / 2],
        zoom: Math.max(map.getZoom(), 14.5),
        essential: true,
      });
      const distanceKm = Math.round(roadRoute.distanceMeters / 100) / 10;
      const estimatedMinutes = Math.max(
        1,
        Math.round(roadRoute.durationSeconds / 60)
      );
      onRouteQuality({
        distanceKm,
        estimatedAqi: estimate.estimatedExposureAqi,
        estimatedMinutes,
        mode: routeMode,
        alternativeCount: 1,
        selectedIndex: 0,
        label: `${roadRoute.summary} · ${estimate.exposureLabel.toLowerCase()} · sekitar ${estimatedMinutes} menit.`,
      });
      onRouteStatus("ready");
    } catch {
      onRouteQuality(null);
      onRouteStatus("error");
    }
    return removeRoute;
  }, [
    focusLocation,
    mapReady,
    onRouteQuality,
    onRouteStatus,
    roadRoute,
    roadRouteLoading,
    routeActive,
    routeDestination,
    routeMode,
    routeOrigin,
    routeRequest,
  ]);

  return (
    <div
      className={`explorer-map-stage ${mapReady ? "is-ready" : ""}`}
      role="region"
      aria-label="Memuat peta lingkungan"
      aria-description="Gunakan pencarian atau tombol lokasi sebagai alternatif keyboard."
      aria-busy={!mapReady}
    >
      <MapView
        className="explorer-map"
        initialCenter={mapCenter(focusLocation)}
        initialZoom={12}
        onMapReady={map => {
          mapRef.current = map;
          setMapReady(true);
          const mapLibre = getMapLibre();
          if (!mapLibre) return;
          const marker = new mapLibre.Marker({
            element: markerElement(
              focusLocation.kind === "place" ? "place" : "user"
            ),
          }) as MapLibreMarker;
          marker.setLngLat([focusLocation.lng, focusLocation.lat]).addTo(map);
          map.on("click", event => {
            const clicked = event as { lngLat?: { lat: number; lng: number } };
            if (clicked.lngLat)
              onMapLocationSelected({
                name: "Memuat nama tempat…",
                caption: "Mencari nama area pada peta",
                lat: clicked.lngLat.lat,
                lng: clicked.lngLat.lng,
                kind: "search",
              });
          });
        }}
      />
      <div className="map-entry-curtain" aria-hidden="true">
        <span className="map-entry-ring" />
        <span>Menyiapkan peta lingkungan</span>
      </div>
    </div>
  );
}
