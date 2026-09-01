import {
  makeRequest,
  type DirectionsResult,
  type TravelMode as DirectionsMode,
} from "./_core/map.js";

export type RoadRouteMode = "walk" | "motor" | "car" | "transit";

export type RoadRouteStep = {
  instruction: string;
  distanceMeters: number;
  durationSeconds: number;
  start: [number, number];
  end: [number, number];
  travelMode: string;
};

export type TransitRouteInfo = {
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
};

export type RoadRouteOption = {
  coordinates: Array<[number, number]>;
  distanceMeters: number;
  durationSeconds: number;
  summary: string;
  provider: "Google Maps" | "OpenStreetMap";
  steps: RoadRouteStep[];
  transit: TransitRouteInfo | null;
};

export type RoadRoute = RoadRouteOption & { options: RoadRouteOption[] };

type RoadRouteRequest = {
  originLatitude: number;
  originLongitude: number;
  destinationLatitude: number;
  destinationLongitude: number;
  mode: RoadRouteMode;
};

type OsrmStep = {
  distance: number;
  duration: number;
  name?: string;
  mode?: string;
  maneuver?: {
    type?: string;
    modifier?: string;
    location?: [number, number];
  };
};

type OsrmRoute = {
  distance: number;
  duration: number;
  geometry?: { coordinates?: Array<[number, number]> };
  legs?: Array<{ summary?: string; steps?: OsrmStep[] }>;
};

type OsrmResponse = {
  code?: string;
  routes?: OsrmRoute[];
};

const OSRM_TIMEOUT_MS = 10_000;

function toDirectionsMode(mode: RoadRouteMode): DirectionsMode {
  if (mode === "walk") return "walking";
  if (mode === "transit") return "transit";
  return "driving";
}

function osrmBaseUrl(mode: RoadRouteMode) {
  if (mode === "walk")
    return "https://routing.openstreetmap.de/routed-foot/route/v1/driving";
  return "https://routing.openstreetmap.de/routed-car/route/v1/driving";
}

function osrmTravelMode(mode: RoadRouteMode) {
  if (mode === "walk") return "WALKING";
  if (mode === "transit") return "TRANSIT_ESTIMATE";
  return "DRIVING";
}

function osrmInstruction(step: OsrmStep) {
  const road = step.name?.trim() ? ` ke ${step.name.trim()}` : "";
  const type = step.maneuver?.type ?? "continue";
  const modifier = step.maneuver?.modifier ?? "";
  if (type === "depart") return `Mulai perjalanan${road}`;
  if (type === "arrive") return "Tiba di tujuan";
  if (type === "roundabout" || type === "rotary")
    return `Masuki bundaran${road}`;
  if (type === "merge") return `Bergabung${road}`;
  if (type === "fork")
    return modifier.includes("left")
      ? `Ambil cabang kiri${road}`
      : `Ambil cabang kanan${road}`;
  if (modifier.includes("left")) return `Belok kiri${road}`;
  if (modifier.includes("right")) return `Belok kanan${road}`;
  if (modifier === "uturn") return `Putar balik${road}`;
  return `Lanjut lurus${road}`;
}

function toOsrmRouteOption(
  route: OsrmRoute,
  mode: RoadRouteMode
): RoadRouteOption | null {
  const coordinates = route.geometry?.coordinates ?? [];
  if (
    coordinates.length < 2 ||
    !Number.isFinite(route.distance) ||
    !Number.isFinite(route.duration)
  )
    return null;
  const rawSteps = route.legs?.flatMap(leg => leg.steps ?? []) ?? [];
  const routeEnd = coordinates[coordinates.length - 1];
  const steps = rawSteps.map((step, index) => {
    const start =
      step.maneuver?.location ??
      coordinates[Math.min(index, coordinates.length - 1)];
    const next = rawSteps[index + 1]?.maneuver?.location ?? routeEnd;
    return {
      instruction: osrmInstruction(step),
      distanceMeters: Math.round(step.distance),
      durationSeconds: Math.round(step.duration),
      start,
      end: next,
      travelMode: osrmTravelMode(mode),
    };
  });
  return {
    coordinates,
    distanceMeters: Math.round(route.distance),
    durationSeconds: Math.round(route.duration),
    summary:
      route.legs
        ?.map(leg => leg.summary)
        .filter(Boolean)
        .join(" · ") ||
      (mode === "transit" ? "Perkiraan rute darat" : "Rute OpenStreetMap"),
    provider: "OpenStreetMap",
    steps,
    transit: null,
  };
}

async function getOpenStreetMapRoute(
  input: RoadRouteRequest
): Promise<RoadRoute | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OSRM_TIMEOUT_MS);
  const coordinates = `${input.originLongitude},${input.originLatitude};${input.destinationLongitude},${input.destinationLatitude}`;
  const endpoint = new URL(`${osrmBaseUrl(input.mode)}/${coordinates}`);
  endpoint.search = new URLSearchParams({
    alternatives: "2",
    steps: "true",
    geometries: "geojson",
    overview: "full",
  }).toString();
  try {
    const response = await fetch(endpoint, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "HealthAir/1.0 local route planner",
      },
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as OsrmResponse;
    if (payload.code !== "Ok") return null;
    const options = (payload.routes ?? [])
      .map(route => toOsrmRouteOption(route, input.mode))
      .filter((route): route is RoadRouteOption => Boolean(route))
      .slice(0, 3);
    const selectedRoute = options[0];
    return selectedRoute ? { ...selectedRoute, options } : null;
  } catch (error) {
    console.warn("[Road routing] OpenStreetMap fallback unavailable", error);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export function decodeGooglePolyline(encoded: string): Array<[number, number]> {
  const coordinates: Array<[number, number]> = [];
  let index = 0;
  let latitude = 0;
  let longitude = 0;

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte: number;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index < encoded.length);
    latitude += result & 1 ? ~(result >> 1) : result >> 1;
    shift = 0;
    result = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index < encoded.length);
    longitude += result & 1 ? ~(result >> 1) : result >> 1;
    coordinates.push([longitude / 1e5, latitude / 1e5]);
  }

  return coordinates;
}

function cleanInstruction(instruction: string) {
  return (
    instruction
      .replace(/<[^>]*>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/\s+/g, " ")
      .trim() || "Lanjutkan mengikuti jalan"
  );
}

function toTransitInfo(
  steps: DirectionsResult["routes"][number]["legs"][number]["steps"]
): TransitRouteInfo | null {
  const transitStep = steps.find(step => step.transit_details)?.transit_details;
  if (!transitStep) return null;
  return {
    lineName: transitStep.line?.name ?? null,
    lineShortName: transitStep.line?.short_name ?? null,
    vehicleName:
      transitStep.line?.vehicle?.name ??
      transitStep.line?.vehicle?.type ??
      null,
    agencyName: transitStep.line?.agencies?.[0]?.name ?? null,
    headsign: transitStep.headsign ?? null,
    departureStop: transitStep.departure_stop?.name ?? null,
    arrivalStop: transitStep.arrival_stop?.name ?? null,
    departureTime: transitStep.departure_time?.text ?? null,
    arrivalTime: transitStep.arrival_time?.text ?? null,
    stopCount: transitStep.num_stops ?? null,
  };
}

function toRoadRouteOption(
  route: DirectionsResult["routes"][number]
): RoadRouteOption | null {
  const leg = route.legs[0];
  const encodedGeometry = route.overview_polyline?.points;
  if (!leg || !encodedGeometry) return null;
  const coordinates = decodeGooglePolyline(encodedGeometry);
  if (coordinates.length < 2) return null;
  return {
    coordinates,
    distanceMeters: leg.distance.value,
    durationSeconds: leg.duration.value,
    summary: route.summary || "Rute jalan",
    provider: "Google Maps",
    steps: leg.steps.map(step => ({
      instruction: cleanInstruction(step.html_instructions),
      distanceMeters: step.distance.value,
      durationSeconds: step.duration.value,
      start: [step.start_location.lng, step.start_location.lat],
      end: [step.end_location.lng, step.end_location.lat],
      travelMode: step.travel_mode,
    })),
    transit: toTransitInfo(leg.steps),
  };
}

export async function getRoadRoute(
  input: RoadRouteRequest
): Promise<RoadRoute | null> {
  try {
    const directions = await makeRequest<DirectionsResult>(
      "/maps/api/directions/json",
      {
        origin: `${input.originLatitude},${input.originLongitude}`,
        destination: `${input.destinationLatitude},${input.destinationLongitude}`,
        mode: toDirectionsMode(input.mode),
        alternatives: "true",
        region: "id",
        language: "id",
      }
    );
    if (directions.status === "OK") {
      const options = directions.routes
        .map(toRoadRouteOption)
        .filter((route): route is RoadRouteOption => Boolean(route))
        .slice(0, 3);
      const selectedRoute = options[0];
      if (selectedRoute) return { ...selectedRoute, options };
    }
  } catch (error) {
    console.warn(
      "[Road routing] Google Directions unavailable; trying OpenStreetMap",
      error
    );
  }
  return getOpenStreetMapRoute(input);
}
