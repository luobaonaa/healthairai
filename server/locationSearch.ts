export type LocationSuggestion = {
  name: string;
  caption: string;
  latitude: number;
  longitude: number;
};

type OpenMeteoGeocodingPayload = {
  results?: Array<{ name: string; admin1?: string; country?: string; latitude: number; longitude: number }>;
};

type NominatimPayload = Array<{ name?: string; display_name: string; lat: string; lon: string }>;
type NominatimReversePayload = { name?: string; display_name?: string; address?: { amenity?: string; building?: string; city?: string; city_district?: string; county?: string; neighbourhood?: string; suburb?: string; town?: string; village?: string } };

function normalizeOpenMeteo(payload: OpenMeteoGeocodingPayload): LocationSuggestion[] {
  return (payload.results ?? []).map(result => ({
    name: result.name,
    caption: [result.admin1, result.country].filter(Boolean).join(", ") || "Hasil pencarian lokasi",
    latitude: result.latitude,
    longitude: result.longitude,
  }));
}

async function searchNominatim(trimmed: string): Promise<LocationSuggestion[]> {
  const fallbackUrl = new URL("https://nominatim.openstreetmap.org/search");
  fallbackUrl.search = new URLSearchParams({ q: trimmed, format: "jsonv2", limit: "6", "accept-language": "id" }).toString();
  try {
    const fallbackResponse = await fetch(fallbackUrl, { headers: { "User-Agent": "HealthAir location search" } });
    if (!fallbackResponse.ok) return [];
    const fallbackPayload = await fallbackResponse.json() as NominatimPayload;
    return fallbackPayload
      .map(result => ({ name: result.name || result.display_name.split(",")[0] || "Lokasi", caption: result.display_name, latitude: Number(result.lat), longitude: Number(result.lon) }))
      .filter(result => Number.isFinite(result.latitude) && Number.isFinite(result.longitude));
  } catch (error) {
    console.warn("[Location search] OpenStreetMap fallback request failed", error);
    return [];
  }
}

export async function searchLocationSuggestions(query: string): Promise<LocationSuggestion[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.search = new URLSearchParams({ name: trimmed, count: "6", language: "id", format: "json" }).toString();
  try {
    const response = await fetch(url);
    if (!response.ok) return searchNominatim(trimmed);
    const payload = await response.json() as OpenMeteoGeocodingPayload;
    const openMeteoResults = normalizeOpenMeteo(payload);
    if (openMeteoResults.length > 0) return openMeteoResults;
    return searchNominatim(trimmed);
  } catch (error) {
    console.warn("[Location search] Open-Meteo geocoding request failed", error);
    return searchNominatim(trimmed);
  }
}

export async function reverseLocationSuggestion(latitude: number, longitude: number): Promise<LocationSuggestion | null> {
  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.search = new URLSearchParams({ lat: String(latitude), lon: String(longitude), format: "jsonv2", zoom: "18", "accept-language": "id" }).toString();
  try {
    const response = await fetch(url, { headers: { "User-Agent": "HealthAir location search" } });
    if (!response.ok) return null;
    const payload = await response.json() as NominatimReversePayload;
    const address = payload.address;
    const name = payload.name || address?.amenity || address?.building || address?.neighbourhood || address?.suburb || address?.city_district || address?.city || address?.town || address?.village || address?.county;
    if (!name) return null;
    return { name, caption: payload.display_name || name, latitude, longitude };
  } catch (error) {
    console.warn("[Location search] Reverse geocoding request failed", error);
    return null;
  }
}
