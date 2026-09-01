import { startLogin } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import EnvironmentalMap, {
  type RouteQuality,
} from "@/components/EnvironmentalMap";
import ExploreSectionNav from "@/components/ExploreSectionNav";
import HealthAirLogo from "@/components/HealthAirLogo";
import HealthAirChatAvatar from "@/components/HealthAirChatAvatar";
import RouteNavigationMode from "@/components/RouteNavigationMode";
import RoutePlanner from "@/components/RoutePlanner";
import { AIChatBox, type Message as AIMessage } from "@/components/AIChatBox";
import { trpc } from "@/lib/trpc";
import {
  buildPreferenceUpdate,
  chooseHealthierLocation,
  getAirRiskWarning,
  getAqiCategory,
  getDataFreshness,
  getEnvironmentalInsight,
  getEnvironmentalReading,
  getLowExposureRoute,
  getPm25Category,
  getRouteGuidance,
  getSurroundingConditions,
  nearbyPlaces,
  profileLabels,
  sampleRouteCoordinates,
  selectSavedLocation,
  updateRecentLocations,
  type EnvironmentalProfile,
  type LocationSelection,
  type RouteNavigationProgress,
  type TravelMode,
} from "@/lib/environment";
import {
  notificationSupport,
  showImmediateAirAlert,
  subscribeToBackgroundAlerts,
  unsubscribeFromBackgroundAlerts,
} from "@/lib/pushNotifications";
import {
  Activity,
  AlertTriangle,
  ArrowLeftRight,
  ArrowUpRight,
  Bell,
  Bookmark,
  Check,
  ChevronDown,
  CircleHelp,
  CloudSun,
  Crosshair,
  Download,
  Droplets,
  Leaf,
  LogOut,
  MapPin,
  Menu,
  MousePointer2,
  Navigation,
  RefreshCw,
  Search,
  Share2,
  ShieldCheck,
  Sparkles,
  Trash2,
  WifiOff,
  Wind,
  X,
} from "lucide-react";
import React from "react";
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";

const defaultLocation: LocationSelection = {
  name: "Cengkareng",
  caption: "Jakarta Barat",
  lat: -6.1425,
  lng: 106.7337,
  kind: "user",
};
const profiles = Object.keys(profileLabels) as EnvironmentalProfile[];
const searchHistoryStorageKey = "healthair-search-history-v1";
const lastReadingStorageKey = "healthair-last-reading-v1";
const defaultSearchHistory = [
  defaultLocation,
  nearbyPlaces[0],
  nearbyPlaces[1],
];

function statusClass(status: string) {
  return status === "Baik"
    ? "good"
    : status === "Sedang"
      ? "moderate"
      : "attention";
}

function isSameRouteLocation(
  first: LocationSelection,
  second: LocationSelection
) {
  return first.lat === second.lat && first.lng === second.lng;
}

function getInitialSearchHistory() {
  try {
    const stored = window.localStorage.getItem(searchHistoryStorageKey);
    if (!stored) return defaultSearchHistory;
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed)
      ? (parsed as LocationSelection[])
      : defaultSearchHistory;
  } catch {
    return defaultSearchHistory;
  }
}

type CachedLiveReading = {
  aqi: number;
  pm25: number;
  pm10: number;
  ozone: number | null;
  temperature: number;
  humidity: number;
  wind: number;
  weather: string;
  status: "Baik" | "Sedang" | "Perlu perhatian";
  observedAt: string;
  fetchedAt: string;
  source: "Open-Meteo";
  dataKind: "modeled-forecast";
  spatialResolutionKm: number;
  attribution: string;
};

function readCachedLiveReading(
  location: LocationSelection
): CachedLiveReading | null {
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(lastReadingStorageKey) ?? "null"
    ) as {
      latitude?: number;
      longitude?: number;
      data?: CachedLiveReading;
    } | null;
    return parsed?.data &&
      parsed.latitude === location.lat &&
      parsed.longitude === location.lng
      ? parsed.data
      : null;
  } catch {
    return null;
  }
}

export default function Explorer() {
  const [, setLocation] = useLocation();
  const startLogin = () => setLocation("/login");
  const { user, isAuthenticated, loading, logout } = useAuth();
  const [selectedLocation, setSelectedLocation] =
    useState<LocationSelection>(defaultLocation);
  const [profile, setProfile] = useState<EnvironmentalProfile>("General");
  const [showProfile, setShowProfile] = useState(false);
  const [showPermission, setShowPermission] = useState(
    () => !new URLSearchParams(window.location.search).has("preview")
  );
  const [locationNotice, setLocationNotice] = useState(false);
  const [locationStatus, setLocationStatus] = useState<
    "idle" | "requesting" | "unsupported" | "denied" | "unavailable"
  >("idle");
  const [locateRequest, setLocateRequest] = useState(0);
  const [query, setQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchHistory, setSearchHistory] = useState<LocationSelection[]>(
    getInitialSearchHistory
  );
  const [saved, setSaved] = useState(false);
  const [routeOrigin, setRouteOrigin] =
    useState<LocationSelection>(defaultLocation);
  const [routeDestination, setRouteDestination] =
    useState<LocationSelection | null>(() =>
      new URLSearchParams(window.location.search).has("route")
        ? nearbyPlaces[0]
        : null
    );
  const [routeMode, setRouteMode] = useState<TravelMode>("walk");
  const [routeDestinationSearch, setRouteDestinationSearch] = useState("");
  const [debouncedRouteDestinationSearch, setDebouncedRouteDestinationSearch] =
    useState("");
  const [routeRequest, setRouteRequest] = useState(() =>
    new URLSearchParams(window.location.search).has("route") ? 1 : 0
  );
  const [routeStatus, setRouteStatus] = useState<"idle" | "ready" | "error">(
    "idle"
  );
  const [routeQuality, setRouteQuality] = useState<RouteQuality | null>(null);
  const [routeFocused, setRouteFocused] = useState(() =>
    new URLSearchParams(window.location.search).has("route")
  );
  const [selectedRouteOption, setSelectedRouteOption] = useState(0);
  const [isSelfRoute, setIsSelfRoute] = useState(false);
  const [navigationActive, setNavigationActive] = useState(false);
  const [navigationProgress, setNavigationProgress] =
    useState<RouteNavigationProgress | null>(null);
  const [, setShowDashboardControls] = useState(false);
  const [showAssistant, setShowAssistant] = useState(
    () => new URLSearchParams(window.location.search).get("assistant") === "1"
  );
  useEffect(() => {
    const openPuffy = () => setShowAssistant(true);
    window.addEventListener("healthair-open-puffy", openPuffy);
    return () => window.removeEventListener("healthair-open-puffy", openPuffy);
  }, []);
  const [assistantMessages, setAssistantMessages] = useState<AIMessage[]>([]);
  const [dismissedRiskKey, setDismissedRiskKey] = useState<string | null>(null);
  const [dismissedFavoriteAlert, setDismissedFavoriteAlert] = useState<
    number | null
  >(null);
  const [shareNotice, setShareNotice] = useState<string | null>(null);
  const [locationPanelHidden, setLocationPanelHidden] = useState(false);
  const [placesPanelHidden, setPlacesPanelHidden] = useState(false);
  const [showCompare, setShowCompare] = useState(() =>
    new URLSearchParams(window.location.search).has("compare")
  );
  const [compareLocation, setCompareLocation] = useState<LocationSelection>(
    nearbyPlaces[0]
  );
  const [rationaleOpen, setRationaleOpen] = useState<string | null>(null);
  const [showMapOnboarding, setShowMapOnboarding] = useState(() => {
    try {
      return (
        window.localStorage.getItem("healthair-map-onboarding-v1") !== "seen"
      );
    } catch {
      return false;
    }
  });
  const [loadingStage, setLoadingStage] = useState<
    "mapping" | "analyzing" | "ready"
  >("mapping");
  const [manualRefreshing, setManualRefreshing] = useState(true);
  const [lastKnownLive, setLastKnownLive] = useState<CachedLiveReading | null>(
    () => readCachedLiveReading(defaultLocation)
  );
  const [notificationNotice, setNotificationNotice] = useState<string | null>(
    null
  );
  const [privacyNotice, setPrivacyNotice] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const preferencesQuery = trpc.environmental.preferences.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const savedLocationsQuery = trpc.environmental.savedLocations.useQuery(
    undefined,
    { enabled: isAuthenticated }
  );
  const favoriteAlertsQuery = trpc.environmental.favoriteAlerts.useQuery(
    undefined,
    {
      enabled: isAuthenticated,
      refetchInterval: 300000,
      refetchOnWindowFocus: true,
      retry: 1,
    }
  );
  const liveCoordinates = useMemo(
    () => ({ latitude: selectedLocation.lat, longitude: selectedLocation.lng }),
    [selectedLocation.lat, selectedLocation.lng]
  );
  const liveQuery = trpc.environmental.live.useQuery(liveCoordinates, {
    refetchInterval: 300000,
    refetchOnWindowFocus: true,
    retry: 2,
  });
  const pushConfigQuery = trpc.environmental.pushConfig.useQuery();
  const exportDataQuery = trpc.environmental.exportMyData.useQuery(undefined, {
    enabled: false,
  });
  const roadRouteInput = useMemo(
    () => ({
      originLatitude: routeOrigin.lat,
      originLongitude: routeOrigin.lng,
      destinationLatitude: routeDestination?.lat ?? routeOrigin.lat,
      destinationLongitude: routeDestination?.lng ?? routeOrigin.lng,
      mode: routeMode,
    }),
    [
      routeDestination?.lat,
      routeDestination?.lng,
      routeMode,
      routeOrigin.lat,
      routeOrigin.lng,
    ]
  );
  const roadRouteEnabled =
    routeFocused &&
    Boolean(routeDestination) &&
    !isSameRouteLocation(routeOrigin, routeDestination ?? routeOrigin);
  const roadRouteQuery = trpc.environmental.roadRoute.useQuery(roadRouteInput, {
    enabled: roadRouteEnabled,
    staleTime: 60000,
    retry: 1,
  });
  const reverseLocation = trpc.environmental.reverseLocation.useMutation();
  const locationSearchQuery = trpc.environmental.searchLocations.useQuery(
    { query: debouncedSearch || " " },
    {
      enabled: searchFocused && debouncedSearch.length > 0,
      staleTime: 60000,
      retry: 1,
    }
  );
  const routeDestinationSearchQuery =
    trpc.environmental.searchLocations.useQuery(
      { query: debouncedRouteDestinationSearch || " " },
      {
        enabled: routeFocused && debouncedRouteDestinationSearch.length > 0,
        staleTime: 60000,
        retry: 1,
      }
    );
  const updatePreferences = trpc.environmental.savePreferences.useMutation({
    onSuccess: () => preferencesQuery.refetch(),
  });
  const subscribePush = trpc.environmental.subscribePush.useMutation();
  const unsubscribePush = trpc.environmental.unsubscribePush.useMutation();
  const clearEnvironmentalData =
    trpc.environmental.clearMyEnvironmentalData.useMutation({
      onSuccess: () => {
        setSearchHistory([]);
        setLastKnownLive(null);
        window.localStorage.removeItem(searchHistoryStorageKey);
        window.localStorage.removeItem(lastReadingStorageKey);
        preferencesQuery.refetch();
        savedLocationsQuery.refetch();
        setPrivacyNotice(
          "Riwayat lokal, favorit, preferensi, dan langganan alert telah dihapus."
        );
      },
    });
  const saveLocation = trpc.environmental.saveLocation.useMutation();
  const removeFavorite = trpc.environmental.removeLocation.useMutation({
    onSuccess: () => savedLocationsQuery.refetch(),
  });
  const assistantChat = trpc.ai.chat.useMutation({
    retry: 1,
    retryDelay: 500,
    onSuccess: result =>
      setAssistantMessages(current => [
        ...current,
        { role: "assistant", content: result.answer },
      ]),
    onError: error =>
      console.error("HealthAir AI request failed", error.message),
  });
  const liveData = liveQuery.data ?? lastKnownLive;
  const usingLastKnownData = !liveQuery.data && Boolean(lastKnownLive);
  const estimatedReading = useMemo(
    () => getEnvironmentalReading(selectedLocation),
    [selectedLocation]
  );
  const reading = useMemo(() => {
    const live = liveData;
    if (!live) return estimatedReading;
    const score = Math.max(
      25,
      Math.min(
        96,
        Math.round(100 - live.aqi * 0.47 - live.pm25 * 0.42 + live.wind * 0.9)
      )
    );
    return {
      ...estimatedReading,
      aqi: live.aqi,
      pm25: live.pm25,
      temperature: live.temperature,
      humidity: live.humidity,
      wind: live.wind,
      weather: live.weather,
      status: live.status,
      score,
      trend:
        live.aqi <= 50
          ? ("Membaik" as const)
          : live.aqi <= 75
            ? ("Stabil" as const)
            : ("Perlu dipantau" as const),
    };
  }, [estimatedReading, liveData]);
  const isRefreshing = manualRefreshing || liveQuery.isFetching;
  const showMetricSkeleton = isRefreshing;
  const favorites = savedLocationsQuery.data ?? [];
  const selectedIsFavorite = favorites.some(
    item =>
      item.latitude === selectedLocation.lat &&
      item.longitude === selectedLocation.lng
  );
  const lastUpdatedLabel = useMemo(() => {
    const observedAt = liveData?.observedAt;
    if (!observedAt) return null;
    const timestamp = new Date(observedAt);
    if (Number.isNaN(timestamp.getTime())) return null;
    return new Intl.DateTimeFormat("id-ID", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(timestamp);
  }, [liveData?.observedAt]);
  const dataFreshness = useMemo(
    () => getDataFreshness(liveData?.fetchedAt, usingLastKnownData),
    [liveData?.fetchedAt, usingLastKnownData]
  );
  const aqiCategory = useMemo(() => getAqiCategory(reading.aqi), [reading.aqi]);
  const pm25Category = useMemo(
    () => getPm25Category(reading.pm25),
    [reading.pm25]
  );
  const airRiskWarning = useMemo(
    () => (liveData ? getAirRiskWarning(reading) : null),
    [liveData, reading]
  );
  const airRiskKey = `${selectedLocation.lat},${selectedLocation.lng}:${reading.aqi}:${reading.pm25}`;
  const insight = useMemo(
    () => getEnvironmentalInsight(reading, profile),
    [reading, profile]
  );
  const surroundingConditions = useMemo(
    () => getSurroundingConditions(selectedLocation),
    [selectedLocation]
  );
  const routeGuidance = useMemo(
    () =>
      routeDestination
        ? getLowExposureRoute(routeOrigin, routeDestination, routeMode)
        : null,
    [routeDestination, routeMode, routeOrigin]
  );
  const comparisonReading = useMemo(
    () => getEnvironmentalReading(compareLocation),
    [compareLocation]
  );
  const recommendedWithGuidance = useMemo(
    () =>
      nearbyPlaces
        .map(place => ({
          place,
          reading: getEnvironmentalReading(place),
          route: getRouteGuidance(selectedLocation, place),
        }))
        .sort((a, b) => b.route.routePriority - a.route.routePriority),
    [selectedLocation]
  );
  const routeCandidates = useMemo(
    () =>
      [routeOrigin, routeDestination, selectedLocation, ...nearbyPlaces]
        .filter((item): item is LocationSelection => Boolean(item))
        .filter(
          (item, index, all) =>
            all.findIndex(candidate => isSameRouteLocation(candidate, item)) ===
            index
        ),
    [routeDestination, routeOrigin, selectedLocation]
  );
  const activeRoadRoute = useMemo(() => {
    const resolved = roadRouteQuery.data;
    if (!resolved) return null;
    const option = resolved.options?.[selectedRouteOption];
    return option
      ? {
          ...resolved,
          ...option,
          steps: option.steps ?? resolved.steps,
          transit: option.transit ?? resolved.transit,
        }
      : resolved;
  }, [roadRouteQuery.data, selectedRouteOption]);
  const routeSamplePoints = useMemo(
    () => sampleRouteCoordinates(activeRoadRoute?.coordinates ?? [], 8),
    [activeRoadRoute?.coordinates]
  );
  const routeExposureInput = useMemo(
    () => ({
      points:
        routeSamplePoints.length >= 2
          ? routeSamplePoints
          : [
              { latitude: routeOrigin.lat, longitude: routeOrigin.lng },
              {
                latitude: routeDestination?.lat ?? routeOrigin.lat,
                longitude: routeDestination?.lng ?? routeOrigin.lng,
              },
            ],
    }),
    [
      routeDestination?.lat,
      routeDestination?.lng,
      routeOrigin.lat,
      routeOrigin.lng,
      routeSamplePoints,
    ]
  );
  const routeExposureQuery = trpc.environmental.routeExposure.useQuery(
    routeExposureInput,
    {
      enabled: routeFocused && routeSamplePoints.length >= 2,
      staleTime: 300000,
      retry: 1,
    }
  );
  const findDistinctRouteCandidate = (location: LocationSelection) =>
    routeCandidates.find(
      candidate => !isSameRouteLocation(candidate, location)
    );
  const handleRouteOriginChange = (location: LocationSelection) => {
    setRouteOrigin(location);
    setNavigationActive(false);
    setSelectedRouteOption(0);
    setIsSelfRoute(true);
    if (routeDestination && isSameRouteLocation(location, routeDestination)) {
      const alternativeDestination = findDistinctRouteCandidate(location);
      if (alternativeDestination) setRouteDestination(alternativeDestination);
    }
    setRouteRequest(value => value + 1);
  };
  const handleRouteDestinationChange = (location: LocationSelection) => {
    setNavigationActive(false);
    setSelectedRouteOption(0);
    setIsSelfRoute(true);
    if (isSameRouteLocation(location, routeOrigin)) {
      const alternativeDestination = findDistinctRouteCandidate(routeOrigin);
      if (alternativeDestination) setRouteDestination(alternativeDestination);
    } else {
      setRouteDestination(location);
    }
    setRouteRequest(value => value + 1);
  };

  useEffect(() => {
    const initial = window.setTimeout(() => setLoadingStage("analyzing"), 650);
    const ready = window.setTimeout(() => {
      setLoadingStage("ready");
      setManualRefreshing(false);
    }, 1500);
    return () => {
      window.clearTimeout(initial);
      window.clearTimeout(ready);
    };
  }, []);

  useEffect(() => {
    const updateConnection = () => setIsOnline(navigator.onLine);
    window.addEventListener("online", updateConnection);
    window.addEventListener("offline", updateConnection);
    return () => {
      window.removeEventListener("online", updateConnection);
      window.removeEventListener("offline", updateConnection);
    };
  }, []);

  useEffect(() => {
    setManualRefreshing(true);
    const timer = window.setTimeout(() => setManualRefreshing(false), 1050);
    return () => window.clearTimeout(timer);
  }, [selectedLocation.lat, selectedLocation.lng, profile]);

  useEffect(() => {
    const timer = window.setTimeout(
      () => setDebouncedSearch(query.trim()),
      250
    );
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const timer = window.setTimeout(
      () => setDebouncedRouteDestinationSearch(routeDestinationSearch.trim()),
      250
    );
    return () => window.clearTimeout(timer);
  }, [routeDestinationSearch]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        searchHistoryStorageKey,
        JSON.stringify(searchHistory)
      );
    } catch {
      /* Persistence is optional when storage is unavailable. */
    }
  }, [searchHistory]);

  useEffect(() => {
    setLastKnownLive(readCachedLiveReading(selectedLocation));
  }, [selectedLocation.lat, selectedLocation.lng]);

  useEffect(() => {
    if (!liveQuery.data) return;
    setLastKnownLive(liveQuery.data);
    try {
      window.localStorage.setItem(
        lastReadingStorageKey,
        JSON.stringify({
          latitude: selectedLocation.lat,
          longitude: selectedLocation.lng,
          data: liveQuery.data,
        })
      );
    } catch {
      /* Offline fallback is optional when storage is unavailable. */
    }
  }, [liveQuery.data, selectedLocation.lat, selectedLocation.lng]);

  useEffect(() => {
    if (preferencesQuery.data?.profileType)
      setProfile(preferencesQuery.data.profileType as EnvironmentalProfile);
  }, [preferencesQuery.data?.profileType]);

  const handleLocationSelected = (location: LocationSelection) => {
    setSelectedLocation(location);
    setRouteOrigin(location);
    setSaved(false);
    setLocationNotice(false);
    setLocationStatus("idle");
    if (location.kind === "search" || location.kind === "place") {
      setSearchHistory(current => updateRecentLocations(current, location));
    }
  };
  const handleMapLocationSelected = (location: LocationSelection) => {
    handleLocationSelected(location);
    reverseLocation.mutate(
      { latitude: location.lat, longitude: location.lng },
      {
        onSuccess: result => {
          if (result)
            handleLocationSelected({
              name: result.name,
              caption: result.caption,
              lat: result.latitude,
              lng: result.longitude,
              kind: "search",
            });
        },
      }
    );
  };

  const updateProfile = (nextProfile: EnvironmentalProfile) => {
    setProfile(nextProfile);
    if (isAuthenticated)
      updatePreferences.mutate(
        buildPreferenceUpdate(
          nextProfile,
          preferencesQuery.data?.notificationPreference ?? false
        )
      );
  };

  const updateNotificationPreference = async (value: boolean) => {
    if (!isAuthenticated) return startLogin();
    setNotificationNotice(null);
    if (!value) {
      const endpoint = await unsubscribeFromBackgroundAlerts().catch(
        () => null
      );
      if (endpoint)
        await unsubscribePush.mutateAsync({ endpoint }).catch(() => undefined);
      updatePreferences.mutate(buildPreferenceUpdate(profile, false));
      setNotificationNotice("Peringatan kualitas udara dinonaktifkan.");
      return;
    }
    updatePreferences.mutate(buildPreferenceUpdate(profile, true));
    const config = pushConfigQuery.data;
    if (!notificationSupport()) {
      setNotificationNotice(
        "Alert dalam aplikasi aktif, tetapi browser ini belum mendukung Web Push."
      );
      return;
    }
    if (!config?.enabled || !config.publicKey) {
      setNotificationNotice(
        "Alert dalam aplikasi aktif. Web Push belum dikonfigurasi pada server."
      );
      return;
    }
    try {
      const subscription = await subscribeToBackgroundAlerts(config.publicKey);
      await subscribePush.mutateAsync(subscription);
      setNotificationNotice(
        "Alert latar belakang aktif, termasuk saat HealthAir tidak sedang dibuka."
      );
    } catch (error) {
      setNotificationNotice(
        error instanceof Error
          ? error.message
          : "Notifikasi latar belakang belum dapat diaktifkan."
      );
    }
  };

  const requestLocation = () => {
    setShowPermission(false);
    if (!navigator.geolocation) {
      setLocationStatus("unsupported");
      setLocationNotice(true);
      return;
    }
    setLocationStatus("requesting");
    setLocationNotice(true);
    setLocateRequest(value => value + 1);
  };
  const refreshEnvironmentalData = () => {
    setManualRefreshing(true);
    liveQuery
      .refetch()
      .finally(() => window.setTimeout(() => setManualRefreshing(false), 350));
  };
  const dismissMapOnboarding = () => {
    try {
      window.localStorage.setItem("healthair-map-onboarding-v1", "seen");
    } catch {
      /* Storage may be unavailable in private contexts. */
    }
    setShowMapOnboarding(false);
  };

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = query.trim();
    if (trimmed && visibleSuggestions[0])
      chooseSearchSuggestion(visibleSuggestions[0]);
  };

  const chooseSearchSuggestion = (location: LocationSelection) => {
    setQuery(location.name);
    setSearchFocused(false);
    handleLocationSelected(location);
  };
  const removeHistoryItem = (location: LocationSelection) =>
    setSearchHistory(current =>
      current.filter(
        item => item.lat !== location.lat || item.lng !== location.lng
      )
    );
  const clearSearchHistory = () => setSearchHistory([]);
  const exportMyData = async () => {
    const result = await exportDataQuery.refetch();
    if (!result.data)
      return setPrivacyNotice("Data belum dapat diekspor. Coba lagi.");
    const blob = new Blob([JSON.stringify(result.data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `healthair-data-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setPrivacyNotice("Salinan data HealthAir berhasil disiapkan.");
  };
  const clearMyData = async () => {
    if (
      !window.confirm(
        "Hapus riwayat, favorit, preferensi, dan langganan alert? Akun Anda tetap aktif."
      )
    )
      return;
    await unsubscribeFromBackgroundAlerts().catch(() => null);
    clearEnvironmentalData.mutate();
  };
  const removeFavoriteLocation = (id: number) => removeFavorite.mutate({ id });
  const saveCurrentLocation = () => {
    if (!isAuthenticated) return startLogin();
    saveLocation.mutate(
      {
        label: selectedLocation.name,
        address: selectedLocation.caption,
        latitude: selectedLocation.lat,
        longitude: selectedLocation.lng,
      },
      {
        onSuccess: () => {
          setSaved(true);
          savedLocationsQuery.refetch();
        },
      }
    );
  };
  const comparisonWinner = chooseHealthierLocation(
    selectedLocation,
    compareLocation
  );
  const activeFavoriteAlert = favoriteAlertsQuery.data?.find(
    alert => alert.id !== dismissedFavoriteAlert
  );
  useEffect(() => {
    if (!activeFavoriteAlert || !preferencesQuery.data?.notificationPreference)
      return;
    const alertKey = `${activeFavoriteAlert.id}:${activeFavoriteAlert.aqi}`;
    if (
      window.sessionStorage.getItem("healthair-last-visible-alert") === alertKey
    )
      return;
    window.sessionStorage.setItem("healthair-last-visible-alert", alertKey);
    showImmediateAirAlert(
      `${activeFavoriteAlert.label} perlu diperhatikan`,
      `AQI ${activeFavoriteAlert.aqi} · ${activeFavoriteAlert.status}. Periksa kondisi sebelum beraktivitas.`,
      `healthair-${activeFavoriteAlert.id}`
    ).catch(() => undefined);
  }, [activeFavoriteAlert, preferencesQuery.data?.notificationPreference]);
  const visibleSuggestions = query.trim()
    ? (locationSearchQuery.data ?? []).map(item => ({
        name: item.name,
        caption: item.caption,
        lat: item.latitude,
        lng: item.longitude,
        kind: "search" as const,
      }))
    : searchHistory;
  const routeDestinationSuggestions = useMemo(
    () =>
      (routeDestinationSearchQuery.data ?? [])
        .map(item => ({
          name: item.name,
          caption: item.caption,
          lat: item.latitude,
          lng: item.longitude,
          kind: "search" as const,
        }))
        .filter(item => !isSameRouteLocation(item, routeOrigin)),
    [routeDestinationSearchQuery.data, routeOrigin]
  );
  const shareEnvironmentalSummary = async () => {
    const summary = `${selectedLocation.name} · AQI ${reading.aqi} (${aqiCategory.label}) · PM2.5 ${reading.pm25} µg/m³. Cek kondisi udara di HealthAir AI.`;
    const canShare = typeof navigator.share === "function";
    try {
      if (canShare) {
        await navigator.share({
          title: `Kualitas udara ${selectedLocation.name}`,
          text: summary,
          url: window.location.href,
        });
        setShareNotice("Ringkasan siap dibagikan.");
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(summary);
        setShareNotice("Ringkasan kualitas udara disalin.");
      } else {
        setShareNotice("Browser ini belum mendukung berbagi otomatis.");
      }
    } catch {
      /* The native sharing dialog may be dismissed without an error state. */
    }
  };
  const sendAssistantMessage = (content: string) => {
    const nextMessages: AIMessage[] = [
      ...assistantMessages,
      { role: "user", content },
    ];
    setAssistantMessages(nextMessages);
    assistantChat.mutate({
      messages: nextMessages.slice(-10).map(message => ({
        role:
          message.role === "assistant"
            ? ("assistant" as const)
            : ("user" as const),
        content: message.content,
      })),
      context: {
        location: `${selectedLocation.name}, ${selectedLocation.caption}`,
        latitude: selectedLocation.lat,
        longitude: selectedLocation.lng,
        profile: profileLabels[profile],
        aqi: reading.aqi,
        pm25: reading.pm25,
        pm10: liveData?.pm10 ?? Math.round(reading.pm25 * 1.35),
        ozone: liveData?.ozone ?? null,
        temperature: reading.temperature,
        humidity: reading.humidity,
        wind: reading.wind,
        weather: reading.weather,
        status: reading.status,
        source: liveData?.source ?? "perkiraan HealthAir",
        ...(liveData?.observedAt ? { observedAt: liveData.observedAt } : {}),
      },
    });
  };

  return (
    <main
      className={`explorer ${showCompare ? "is-comparing" : ""} ${routeFocused ? "route-focused" : ""} ${navigationActive ? "is-navigating" : ""}`}
    >
      <a className="skip-link" href="#environment-summary">
        Lewati peta ke ringkasan kondisi
      </a>
      <EnvironmentalMap
        locateRequest={locateRequest}
        focusLocation={selectedLocation}
        routeOrigin={routeOrigin}
        routeDestination={routeDestination}
        routeMode={routeMode}
        roadRoute={activeRoadRoute}
        roadRouteLoading={roadRouteQuery.isFetching}
        navigationActive={navigationActive}
        onNavigationProgress={setNavigationProgress}
        routeRequest={routeRequest}
        routeActive={routeFocused}
        recommendedPlaces={nearbyPlaces}
        onLocationSelected={handleLocationSelected}
        onMapLocationSelected={handleMapLocationSelected}
        onLocationRequesting={() => {
          setLocationStatus("requesting");
          setLocationNotice(true);
        }}
        onLocationError={reason => {
          setShowPermission(false);
          setLocationStatus(reason);
          setLocationNotice(true);
        }}
        onRouteStatus={setRouteStatus}
        onRouteQuality={setRouteQuality}
      />

      {loadingStage !== "ready" && (
        <div className="environment-loader" aria-live="polite">
          <div className="loader-orb">
            <span className="loader-core" />
            <span className="loader-ripple one" />
            <span className="loader-ripple two" />
          </div>
          <div>
            <strong>
              {loadingStage === "mapping"
                ? "Memetakan udara di sekitar Anda..."
                : "Menganalisis cuaca, AQI, dan arah angin..."}
            </strong>
            <small>HealthAir AI sedang menyusun kondisi lingkungan lokal</small>
          </div>
        </div>
      )}

      <div className="map-overlay explorer-topbar">
        <Link href="/" className="map-brand map-glass">
          <span className="brand-mark">
            <HealthAirLogo />
          </span>
          HealthAir AI
        </Link>
        <div className="search-wrap">
          <form className="map-search map-glass" onSubmit={submitSearch}>
            <Search size={17} />
            <input
              value={query}
              onChange={event => setQuery(event.target.value)}
              onFocus={() => setSearchFocused(true)}
              placeholder="Cari lokasi, taman, atau area..."
              aria-label="Cari lokasi"
            />
            <button aria-label="Cari lokasi" type="submit">
              <ArrowUpRight size={16} />
            </button>
          </form>
          {searchFocused && (
            <div className="search-popover search-popover-front map-glass">
              <div className="search-popover-title">
                <span>
                  {query.trim()
                    ? "Rekomendasi lokasi"
                    : "Riwayat pencarian terbaru"}
                </span>
                <button
                  className="search-popover-close"
                  type="button"
                  aria-label={
                    query.trim()
                      ? "Tutup rekomendasi lokasi"
                      : "Tutup riwayat pencarian"
                  }
                  onMouseDown={event => event.preventDefault()}
                  onClick={() => setSearchFocused(false)}
                >
                  <X size={13} />
                </button>
              </div>
              {locationSearchQuery.isFetching && query.trim() ? (
                <p>Mencari lokasi…</p>
              ) : query.trim() ? (
                visibleSuggestions.length > 0 ? (
                  visibleSuggestions.map(item => (
                    <button
                      key={`${item.name}-${item.lat}`}
                      onMouseDown={event => event.preventDefault()}
                      onClick={() => chooseSearchSuggestion(item)}
                    >
                      <MapPin size={13} />
                      <span>
                        <strong>{item.name}</strong>
                        <small>{item.caption}</small>
                      </span>
                      <ArrowUpRight size={12} />
                    </button>
                  ))
                ) : (
                  <p>
                    Tidak ada lokasi yang cocok. Coba ketik nama kota, area,
                    atau taman lain.
                  </p>
                )
              ) : (
                <>
                  {favorites.length > 0 && (
                    <div className="search-favorite-section">
                      <div className="search-favorite-heading">
                        <Bookmark size={11} />
                        <span>Lokasi favorit</span>
                      </div>
                      {favorites.slice(0, 3).map(item => (
                        <button
                          key={item.id}
                          className="search-favorite-select"
                          type="button"
                          aria-label={`Buka favorit ${item.label}`}
                          onMouseDown={event => event.preventDefault()}
                          onClick={() =>
                            chooseSearchSuggestion(selectSavedLocation(item))
                          }
                        >
                          <Bookmark size={12} />
                          <span>
                            <strong>{item.label}</strong>
                            <small>{item.address}</small>
                          </span>
                          <ArrowUpRight size={12} />
                        </button>
                      ))}
                    </div>
                  )}
                  {searchHistory.length > 0 ? (
                    <>
                      <div className="search-history-list">
                        {searchHistory.map(item => (
                          <div
                            key={`${item.name}-${item.lat}`}
                            className="search-history-row"
                          >
                            <button
                              className="search-history-select"
                              onMouseDown={event => event.preventDefault()}
                              onClick={() => chooseSearchSuggestion(item)}
                            >
                              <MapPin size={13} />
                              <span>
                                <strong>{item.name}</strong>
                                <small>{item.caption}</small>
                              </span>
                              <ArrowUpRight size={12} />
                            </button>
                            <button
                              className="search-history-remove"
                              type="button"
                              aria-label={`Hapus ${item.name} dari riwayat`}
                              onMouseDown={event => event.preventDefault()}
                              onClick={() => removeHistoryItem(item)}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        ))}
                      </div>
                      <button
                        className="search-history-clear"
                        type="button"
                        onMouseDown={event => event.preventDefault()}
                        onClick={clearSearchHistory}
                      >
                        <Trash2 size={13} /> Hapus Semua
                      </button>
                    </>
                  ) : (
                    <p>Belum ada riwayat pencarian.</p>
                  )}
                </>
              )}
            </div>
          )}
        </div>
        <div className="map-profile">
          <button
            className={`map-icon-button assistant-toggle ${showAssistant ? "active" : ""}`}
            onClick={() => setShowAssistant(value => !value)}
            aria-label={showAssistant ? "Tutup asisten AI" : "Buka asisten AI"}
          >
            <Sparkles size={17} />
          </button>
          <button
            className="map-icon-button"
            onClick={refreshEnvironmentalData}
            aria-label="Perbarui data lingkungan"
          >
            <RefreshCw size={17} className={isRefreshing ? "refreshing" : ""} />
          </button>
          <button
            className="map-avatar map-glass"
            onClick={() => setShowProfile(value => !value)}
            aria-label="Buka profil lingkungan"
          >
            <span className="avatar-disc">
              {isAuthenticated ? (
                user?.name?.slice(0, 1).toUpperCase() || "A"
              ) : (
                <Menu size={16} />
              )}
            </span>
            <span>{isAuthenticated ? user?.name || "Profil" : "Profil"}</span>
            <ChevronDown size={13} />
          </button>
        </div>
      </div>

      <div className="map-overlay map-section-nav">
        <ExploreSectionNav compact />
      </div>
      {locationNotice && (
        <div className="map-disclaimer" role="status">
          {locationStatus === "requesting"
            ? "Meminta izin lokasi dari browser… Pilih Izinkan untuk memperbarui peta."
            : locationStatus === "denied"
              ? "Izin lokasi ditolak. Aktifkan izin lokasi untuk situs ini melalui ikon gembok di browser, atau cari lokasi secara manual."
              : locationStatus === "unsupported"
                ? "Browser ini tidak mendukung lokasi. Cari kota atau wilayah secara manual untuk melihat kondisi lingkungan."
                : "Lokasi belum dapat diperoleh. Pastikan GPS atau layanan lokasi aktif, lalu coba lagi atau cari lokasi secara manual."}{" "}
          {locationStatus !== "requesting" &&
            locationStatus !== "unsupported" && (
              <button className="text-action" onClick={requestLocation}>
                Coba aktifkan lagi
              </button>
            )}
        </div>
      )}
      {(!isOnline || usingLastKnownData) && (
        <div className="map-overlay offline-data-banner" role="status">
          <WifiOff size={14} />
          <span>
            <strong>
              {isOnline ? "Menampilkan data terakhir" : "Anda sedang offline"}
            </strong>
            <small>
              {liveData
                ? `${dataFreshness.label}. Angka ini bukan kondisi real-time.`
                : "Data lingkungan belum tersedia di perangkat ini."}
            </small>
          </span>
        </div>
      )}

      {airRiskWarning && dismissedRiskKey !== airRiskKey && (
        <section
          className={`map-overlay air-risk-alert puffy-proactive-alert risk-${airRiskWarning.severity}`}
          role="alert"
          aria-label="Peringatan proaktif Puffy"
        >
          <span className="puffy-alert-avatar" aria-hidden="true">
            <HealthAirChatAvatar />
          </span>
          <div>
            <small>Puffy mengingatkan</small>
            <strong>{airRiskWarning.title}</strong>
            <p>{airRiskWarning.message}</p>
            <button onClick={() => setShowAssistant(true)}>Tanya Puffy</button>
          </div>
          <button
            className="air-risk-close"
            onClick={() => setDismissedRiskKey(airRiskKey)}
            aria-label="Tutup peringatan kualitas udara"
          >
            <X size={15} />
          </button>
        </section>
      )}
      {activeFavoriteAlert && (
        <section className="map-overlay favorite-air-alert" role="alert">
          <span>
            <Bell size={16} />
          </span>
          <div>
            <strong>{activeFavoriteAlert.label} perlu diperhatikan</strong>
            <p>
              AQI {activeFavoriteAlert.aqi} · {activeFavoriteAlert.status}.
              Periksa kondisi favorit ini sebelum beraktivitas.
            </p>
            <button
              onClick={() =>
                handleLocationSelected({
                  name: activeFavoriteAlert.label,
                  caption: activeFavoriteAlert.address,
                  lat: activeFavoriteAlert.latitude,
                  lng: activeFavoriteAlert.longitude,
                  kind: "place",
                })
              }
            >
              Lihat lokasi
            </button>
          </div>
          <button
            className="air-risk-close"
            onClick={() => setDismissedFavoriteAlert(activeFavoriteAlert.id)}
            aria-label={`Tutup peringatan favorit ${activeFavoriteAlert.label}`}
          >
            <X size={15} />
          </button>
        </section>
      )}

      {showAssistant && (
        <section
          className="map-overlay air-assistant-panel map-glass"
          aria-label="Asisten AI HealthAir"
        >
          <div className="air-assistant-header">
            <span>
              <span className="air-assistant-logo"><HealthAirChatAvatar /></span>
              <span>
                <strong>Puffy</strong>
                <small>Asisten HealthAir · paham konteks peta</small>
              </span>
            </span>
            <button
              onClick={() => setShowAssistant(false)}
              aria-label="Tutup asisten AI"
            >
              <X size={15} />
            </button>
          </div>
          <AIChatBox
            messages={assistantMessages}
            onSendMessage={sendAssistantMessage}
            isLoading={assistantChat.isPending}
            height="calc(100% - 54px)"
            className="air-assistant-chat"
            placeholder="Tanya apa saja..."
            emptyStateMessage="Tanya Puffy tentang apa saja, termasuk kondisi udara dan lokasi."
            suggestedPrompts={[
              "Apa arti AQI saat ini?",
              "Ceritakan fakta menarik tentang Jakarta",
              "Bantu susun agenda hari ini",
            ]}
          />
        </section>
      )}

      <section
        id="environment-summary"
        tabIndex={-1}
        className={`map-overlay location-card map-glass ${locationPanelHidden ? "is-hidden" : "panel-enter-left"}`}
        aria-label={`Ringkasan lokasi ${selectedLocation.name}`}
      >
        <div className="card-kicker">
          <Navigation size={11} />{" "}
          <span data-testid="selected-location-label">
            {selectedLocation.name}
          </span>
          <button
            className="card-refresh"
            onClick={refreshEnvironmentalData}
            aria-label="Perbarui kondisi lokasi"
          >
            <RefreshCw size={11} />
          </button>
        </div>
        <button
          className="panel-hide-control panel-hide-side"
          onClick={() => setLocationPanelHidden(true)}
          aria-label="Sembunyikan panel lokasi"
        >
          <ChevronDown size={14} />
        </button>
        <h2>{selectedLocation.name}</h2>
        <p className="place-caption">{selectedLocation.caption}</p>
        <div className="status-line">
          {liveData ? (
            <>
              <span className={`status-badge category-${aqiCategory.tone}`}>
                <span className="small-dot" /> {aqiCategory.label}
              </span>
              <span className="mini-trend">
                <ArrowUpRight /> {reading.trend}
              </span>
              <span
                className={`live-pill ${usingLastKnownData ? "is-cached" : ""}`}
              >
                <span />{" "}
                {usingLastKnownData ? "Data terakhir" : "Model terbaru"}
              </span>
            </>
          ) : (
            <span className="status-badge">
              <span className="small-dot" /> Data lingkungan belum tersedia
            </span>
          )}
        </div>
        <div
          className={`metric-grid ${showMetricSkeleton ? "is-loading" : ""}`}
          aria-busy={showMetricSkeleton}
        >
          <div
            className={`metric ${liveData ? `metric-${aqiCategory.tone}` : ""}`}
          >
            <span>AQI</span>
            {showMetricSkeleton ? (
              <i
                className="metric-skeleton metric-skeleton-value"
                aria-label="Memuat data AQI"
              />
            ) : (
              <strong key={`aqi-${selectedLocation.name}`}>
                {liveData ? reading.aqi : "—"}
              </strong>
            )}
            <small>
              {liveData ? aqiCategory.label : "Belum ada pembacaan"}
            </small>
          </div>
          <div
            className={`metric ${liveData ? `metric-${pm25Category.tone}` : ""}`}
          >
            <span>PM2.5</span>
            {showMetricSkeleton ? (
              <i
                className="metric-skeleton metric-skeleton-value"
                aria-label="Memuat data PM2.5"
              />
            ) : (
              <strong key={`pm-${selectedLocation.name}`}>
                {liveData ? reading.pm25 : "—"}
              </strong>
            )}
            <small>
              {liveData
                ? `${pm25Category.label} · μg/m³`
                : "Belum ada pembacaan"}
            </small>
          </div>
          <div className="metric">
            <span>Suhu</span>
            {showMetricSkeleton ? (
              <i
                className="metric-skeleton metric-skeleton-value"
                aria-label="Memuat data suhu"
              />
            ) : (
              <strong key={`temp-${selectedLocation.name}`}>
                {liveData ? `${reading.temperature}°` : "—"}
              </strong>
            )}
            <small>{liveData ? reading.weather : "Belum ada pembacaan"}</small>
          </div>
        </div>
        <div className="weather-strip">
          {liveData ? (
            <>
              <span>
                <Droplets size={12} /> {reading.humidity}% lembap
              </span>
              <span>
                <Wind size={12} /> {reading.wind} km/jam
              </span>
              <span>
                <CloudSun size={12} /> {reading.weather}
              </span>
              <span>
                <Activity size={12} /> PM10 {liveData.pm10}
              </span>
            </>
          ) : (
            <span>
              <CloudSun size={12} /> Cuaca belum tersedia
            </span>
          )}
        </div>
        <div
          className={`data-freshness freshness-${dataFreshness.state}`}
          aria-live="polite"
          data-testid="environmental-freshness"
        >
          <RefreshCw size={12} className={isRefreshing ? "refreshing" : ""} />
          <span>
            <strong>
              {liveData
                ? `${usingLastKnownData ? "Data tersimpan" : "Model kualitas udara"} · ${liveData.source}`
                : "Data lingkungan tidak tersedia"}
            </strong>
            <small>
              {liveData
                ? `Diperbarui: ${dataFreshness.label}${lastUpdatedLabel ? ` · waktu model ${lastUpdatedLabel}` : ""}`
                : "Tidak menampilkan angka perkiraan sebagai pembacaan nyata"}
            </small>
          </span>
        </div>
        <div className="insight-box">
          {isRefreshing ? (
            <div className="analysis-loading">
              <span>MENGAMBIL DATA TERBARU</span>
              <p>
                <i>✓</i> Kualitas udara <i>✓</i> Cuaca <i>✓</i> Pola angin
              </p>
            </div>
          ) : (
            <>
              <div className="insight-head">
                <Sparkles size={12} /> Insight adaptif
              </div>
              <p>
                {liveData
                  ? insight
                  : "Insight belum ditampilkan karena data lingkungan tidak tersedia. Perbarui data atau pilih kembali lokasi."}
              </p>
            </>
          )}
        </div>
        {liveData && (
          <details className="data-provenance">
            <summary>
              <ShieldCheck size={12} /> Tentang akurasi data
            </summary>
            <p>
              Nilai kualitas udara adalah keluaran model, bukan sensor tepat di
              titik Anda. Resolusi global sekitar{" "}
              {liveData.spatialResolutionKm ?? 45} km; kondisi jalan setempat
              dapat berbeda.
            </p>
            <a
              href="https://open-meteo.com/en/docs/air-quality-api"
              target="_blank"
              rel="noreferrer"
            >
              {liveData.attribution ??
                "Open-Meteo · Copernicus Atmosphere Monitoring Service (CAMS)"}
            </a>
          </details>
        )}
        <div className="card-actions">
          <button className="text-action" onClick={saveCurrentLocation}>
            {saved || selectedIsFavorite
              ? "Favorit tersimpan"
              : "Simpan favorit"}{" "}
            <Bookmark size={11} />
          </button>
          <button
            className="text-action muted"
            onClick={() => {
              setShowCompare(true);
              setCompareLocation(
                recommendedWithGuidance[0]?.place ?? nearbyPlaces[0]
              );
            }}
          >
            <ArrowLeftRight size={11} /> Bandingkan
          </button>
          <button
            className="text-action muted"
            onClick={shareEnvironmentalSummary}
          >
            <Share2 size={11} /> Bagikan
          </button>
        </div>
        {shareNotice && (
          <p className="share-notice" role="status">
            {shareNotice}
          </p>
        )}
      </section>
      {locationPanelHidden && !routeFocused && (
        <button
          className="map-overlay panel-restore location-panel-restore"
          onClick={() => setLocationPanelHidden(false)}
          aria-label={`Tampilkan panel ${selectedLocation.name}`}
        >
          <ChevronDown size={15} />
          <span>{selectedLocation.name}</span>
        </button>
      )}

      {!routeFocused && (
        <>
          <section
            className={`map-overlay places-panel map-glass ${placesPanelHidden ? "is-hidden" : "panel-enter-bottom"}`}
            aria-label="Rekomendasi tempat lebih sesuai"
          >
            <div className="places-panel-top">
              <div>
                <h3>Tempat yang lebih sesuai</h3>
                <p>Diurutkan dari jarak, udara, ruang hijau, dan sirkulasi.</p>
              </div>
              <span className="places-panel-actions">
                <Leaf size={16} color="#55a69e" />
                <button
                  className="panel-hide-control panel-hide-bottom"
                  onClick={() => setPlacesPanelHidden(true)}
                  aria-label="Sembunyikan rekomendasi tempat"
                >
                  <ChevronDown size={14} />
                </button>
              </span>
            </div>
            <div className="places-scroll">
              {recommendedWithGuidance.map(
                ({ place, reading: placeReading, route }) => (
                  <article
                    key={place.name}
                    className={`place-card ${routeDestination?.name === place.name ? "selected" : ""}`}
                  >
                    <button
                      className="place-select"
                      onClick={() => {
                        setRouteDestination(place);
                        setRouteStatus("idle");
                        setRouteQuality(null);
                      }}
                    >
                      <span className="place-card-head">
                        <strong>{place.name}</strong>
                        <span className="score">{placeReading.score}</span>
                      </span>
                      <p>
                        {route.distanceLabel} · {route.pollutionLabel}
                      </p>
                      <span className="place-factors">
                        <span>AQI {placeReading.aqi}</span>
                        <span>{placeReading.temperature}°C</span>
                      </span>
                    </button>
                    <button
                      className="place-rationale-toggle"
                      onClick={() =>
                        setRationaleOpen(current =>
                          current === place.name ? null : place.name
                        )
                      }
                      aria-expanded={rationaleOpen === place.name}
                    >
                      <CircleHelp size={11} /> Mengapa dipilih?
                      <ChevronDown size={11} />
                    </button>
                    {rationaleOpen === place.name && (
                      <p className="place-rationale">
                        <strong>{route.qualifier}</strong>
                        {route.pollutionLabel} dengan jarak sekitar{" "}
                        {route.distanceLabel} dari lokasi Anda.
                      </p>
                    )}
                  </article>
                )
              )}
            </div>
            {routeDestination && routeGuidance && (
              <div
                className={`route-callout ${routeStatus === "error" ? "route-error" : ""}`}
              >
                <span>
                  <Navigation size={14} />
                  <span>
                    <strong>
                      Rute {routeGuidance.modeLabel.toLowerCase()} ·{" "}
                      {routeGuidance.distanceLabel}
                    </strong>
                    <small>
                      {routeGuidance.exposureLabel} · estimasi ±
                      {routeGuidance.estimatedMinutes} menit. Pilih titik awal,
                      tujuan, dan moda sebelum membuka rute.
                    </small>
                  </span>
                </span>
                <button
                  className="button button-primary button-small"
                  onClick={() => {
                    setRouteFocused(true);
                    setShowDashboardControls(false);
                    setRouteRequest(value => value + 1);
                  }}
                >
                  Atur rute
                </button>
              </div>
            )}
          </section>
          {placesPanelHidden && (
            <button
              className="map-overlay panel-restore places-panel-restore"
              onClick={() => setPlacesPanelHidden(false)}
              aria-label="Tampilkan rekomendasi tempat"
            >
              <ChevronDown size={15} />
              <span>Tempat yang lebih sesuai</span>
            </button>
          )}
        </>
      )}

      {routeFocused && routeDestination && !navigationActive && (
        <RoutePlanner
          origin={routeOrigin}
          destination={routeDestination}
          candidates={routeCandidates}
          mode={routeMode}
          roadRoute={activeRoadRoute}
          isRoadRouteLoading={roadRouteQuery.isFetching}
          routeExposure={routeExposureQuery.data}
          isRouteExposureLoading={routeExposureQuery.isFetching}
          selectedRouteOption={selectedRouteOption}
          isSelfRoute={isSelfRoute}
          destinationSearch={routeDestinationSearch}
          destinationSuggestions={routeDestinationSuggestions}
          isDestinationSearching={routeDestinationSearchQuery.isFetching}
          onOriginChange={handleRouteOriginChange}
          onDestinationChange={handleRouteDestinationChange}
          onDestinationSearchChange={setRouteDestinationSearch}
          onDestinationSuggestionSelect={location => {
            setRouteDestinationSearch("");
            handleRouteDestinationChange(location);
          }}
          onModeChange={mode => {
            setNavigationActive(false);
            setIsSelfRoute(true);
            setSelectedRouteOption(0);
            setRouteMode(mode);
            setRouteRequest(value => value + 1);
          }}
          onRouteOptionSelect={index => {
            setNavigationActive(false);
            setIsSelfRoute(false);
            setSelectedRouteOption(index);
            setRouteRequest(value => value + 1);
          }}
          onSelfRoute={() => {
            setNavigationActive(false);
            setIsSelfRoute(true);
          }}
          onStartNavigation={() => {
            if (activeRoadRoute) setNavigationActive(true);
          }}
          onClose={() => {
            setNavigationActive(false);
            setRouteFocused(false);
          }}
        />
      )}
      {navigationActive && activeRoadRoute && routeDestination && (
        <RouteNavigationMode
          destinationName={routeDestination.name}
          mode={routeMode}
          route={activeRoadRoute}
          progress={navigationProgress}
          onStop={() => {
            setNavigationActive(false);
            setNavigationProgress(null);
          }}
          onEditRoute={() => setNavigationActive(false)}
        />
      )}

      <div className="map-overlay map-current-control map-glass">
        <button onClick={requestLocation} aria-label="Gunakan lokasi saya">
          <Crosshair size={18} />
        </button>
        <span>Gunakan lokasi saya</span>
      </div>

      {showCompare && (
        <section
          className="map-overlay comparison-panel map-glass"
          aria-label="Bandingkan dua lokasi"
        >
          <div className="comparison-top">
            <span>
              <ArrowLeftRight size={14} /> Bandingkan lokasi
            </span>
            <button onClick={() => setShowCompare(false)}>
              <X size={14} />
            </button>
          </div>
          <div className="comparison-grid">
            <article>
              <small>Lokasi awal</small>
              <strong>{selectedLocation.name}</strong>
              <b>{reading.score}</b>
              <span>
                AQI {reading.aqi} · PM2.5 {reading.pm25}
              </span>
            </article>
            <article>
              <small>Pilihan pembanding</small>
              <select
                value={compareLocation.name}
                onChange={event =>
                  setCompareLocation(
                    nearbyPlaces.find(
                      item => item.name === event.target.value
                    ) ?? nearbyPlaces[0]
                  )
                }
              >
                {nearbyPlaces.map(item => (
                  <option key={item.name} value={item.name}>
                    {item.name}
                  </option>
                ))}
              </select>
              <b>{comparisonReading.score}</b>
              <span>
                AQI {comparisonReading.aqi} · PM2.5 {comparisonReading.pm25}
              </span>
            </article>
          </div>
          <div className="comparison-verdict">
            <Check size={14} />
            <span>
              <strong>
                {comparisonWinner.name} lebih sesuai untuk aktivitas ringan.
              </strong>
              <small>
                {comparisonWinner.name === selectedLocation.name
                  ? "Kondisi lokasi saat ini masih lebih menguntungkan."
                  : "Udara dan ruang hijau di lokasi pembanding terlihat lebih mendukung."}
              </small>
            </span>
          </div>
        </section>
      )}

      {showProfile && (
        <section
          className="map-overlay profile-card map-glass"
          aria-label="Profil lingkungan saya"
        >
          <div className="profile-card-top">
            <div>
              <div className="card-kicker">
                <Bell size={11} /> Profil lingkungan saya
              </div>
              <h3>
                {isAuthenticated ? "Pengaturan personal" : "Atur konteks Anda"}
              </h3>
            </div>
            <button
              onClick={() => setShowProfile(false)}
              aria-label="Tutup profil"
            >
              <X size={14} />
            </button>
          </div>
          <p>
            Pilihan ini membantu menyusun interpretasi lingkungan, bukan
            diagnosis kesehatan.
          </p>
          <div className="profile-options">
            {profiles.map(item => (
              <button
                key={item}
                className={`profile-option ${profile === item ? "active" : ""}`}
                onClick={() => updateProfile(item)}
              >
                <span className="option-radio" />
                {profileLabels[item]}
              </button>
            ))}
          </div>
          {isAuthenticated ? (
            <>
              <label className="notification-setting">
                <span>
                  <Bell size={13} />
                  <span>
                    <strong>Peringatan kualitas udara</strong>
                    <small>
                      Web Push saat situs tertutup, plus alert di dalam
                      aplikasi.
                    </small>
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={
                    preferencesQuery.data?.notificationPreference ?? false
                  }
                  onChange={event =>
                    void updateNotificationPreference(event.target.checked)
                  }
                />
              </label>
              {notificationNotice && (
                <p className="settings-notice" role="status">
                  {notificationNotice}
                </p>
              )}
              <div className="saved-location-list">
                <div>
                  <span>Lokasi favorit</span>
                  <small>{favorites.length} lokasi</small>
                </div>
                {favorites.length ? (
                  favorites.slice(0, 5).map(item => (
                    <div key={item.id} className="saved-location-row">
                      <button
                        className="saved-location-select"
                        onClick={() => {
                          handleLocationSelected(selectSavedLocation(item));
                          setShowProfile(false);
                        }}
                        aria-label={`Buka favorit ${item.label}`}
                      >
                        <MapPin size={12} />
                        <span>
                          {item.label}
                          <small>{item.address}</small>
                        </span>
                        <ArrowUpRight size={11} />
                      </button>
                      <button
                        className="saved-location-remove"
                        type="button"
                        onClick={() => removeFavoriteLocation(item.id)}
                        aria-label={`Hapus favorit ${item.label}`}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))
                ) : (
                  <p>
                    Belum ada favorit. Gunakan tombol “Simpan favorit” pada
                    detail peta.
                  </p>
                )}
              </div>
              <div className="privacy-controls">
                <div>
                  <ShieldCheck size={13} />
                  <span>
                    <strong>Privasi & data Anda</strong>
                    <small>
                      Ekspor salinan atau bersihkan data lingkungan tanpa
                      menghapus akun.
                    </small>
                  </span>
                </div>
                <span>
                  <button type="button" onClick={() => void exportMyData()}>
                    <Download size={12} /> Ekspor
                  </button>
                  <button
                    type="button"
                    className="danger"
                    onClick={() => void clearMyData()}
                    disabled={clearEnvironmentalData.isPending}
                  >
                    <Trash2 size={12} /> Bersihkan
                  </button>
                </span>
                {privacyNotice && <p role="status">{privacyNotice}</p>}
              </div>
            </>
          ) : (
            <button
              className="button button-primary profile-login"
              onClick={startLogin}
            >
              Masuk untuk menyimpan favorit
            </button>
          )}
          <div className="profile-card-footer">
            {isAuthenticated ? (
              <button onClick={() => logout().then(() => setLocation("/"))}>
                <LogOut
                  size={11}
                  style={{ display: "inline", marginRight: 4 }}
                />
                Keluar
              </button>
            ) : (
              <span />
            )}
            <button onClick={() => setShowProfile(false)}>Tutup</button>
          </div>
        </section>
      )}

      {showPermission && !loading && (
        <div className="location-modal">
          <span className="permission-ripple" />
          <section className="permission-dialog">
            <div className="permission-icon">
              <Crosshair size={21} />
            </div>
            <h2>Izinkan akses lokasi?</h2>
            <p>
              HealthAir AI menggunakan lokasi Anda untuk menampilkan kondisi
              cuaca, kualitas udara, dan lingkungan di sekitar Anda.
            </p>
            <div className="permission-actions">
              <button
                className="button button-ghost"
                onClick={() => {
                  setShowPermission(false);
                  setLocationNotice(true);
                }}
              >
                Nanti
              </button>
              <button
                className="button button-primary"
                onClick={requestLocation}
              >
                Izinkan lokasi
              </button>
            </div>
          </section>
        </div>
      )}
      {showMapOnboarding && !showPermission && (
        <section
          className="map-overlay map-onboarding map-glass"
          aria-label="Panduan peta untuk pengguna baru"
        >
          <div className="map-onboarding-head">
            <span>
              <Sparkles size={14} /> Mulai dari peta
            </span>
            <button
              onClick={dismissMapOnboarding}
              aria-label="Tutup panduan peta"
            >
              <X size={14} />
            </button>
          </div>
          <p>Tiga cara cepat membaca lingkungan di sekitar Anda.</p>
          <div className="map-onboarding-steps">
            <span>
              <Search size={13} />
              <b>Cari</b>
              <small>kota atau taman</small>
            </span>
            <span>
              <MousePointer2 size={13} />
              <b>Klik</b>
              <small>titik pada peta</small>
            </span>
            <span>
              <Crosshair size={13} />
              <b>Izinkan</b>
              <small>lokasi perangkat</small>
            </span>
          </div>
          <button
            className="button button-primary button-small"
            onClick={dismissMapOnboarding}
          >
            Mulai jelajah <ArrowUpRight size={13} />
          </button>
        </section>
      )}
    </main>
  );
}
