export type LiveEnvironmentalReading = {
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

export type AqiTrendPoint = { time: string; aqi: number; pm25: number };
export type RouteExposureSummary = { estimatedAqi: number; minimumAqi: number; maximumAqi: number; sampleCount: number; requestedSampleCount: number; coverage: number; source: "Open-Meteo"; method: "sampled-route-model" };

const weatherLabels: Record<number, string> = {
  0: "Cerah", 1: "Cerah berawan", 2: "Cerah berawan", 3: "Mendung", 45: "Berkabut", 48: "Berkabut",
  51: "Gerimis", 53: "Gerimis", 55: "Gerimis", 61: "Hujan ringan", 63: "Hujan", 65: "Hujan deras",
  80: "Hujan lokal", 81: "Hujan lokal", 82: "Hujan lokal", 95: "Badai petir",
};

const requestTimeoutMs = 8_000;
const requestAttempts = 2;

async function fetchOpenMeteo(url: URL, label: string): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= requestAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: "application/json", "User-Agent": "HealthAir/1.0" },
      });
      if (response.ok) return response;
      const retryable = response.status === 408 || response.status === 429 || response.status >= 500;
      const error = new Error(`${label} returned HTTP ${response.status}`);
      if (!retryable || attempt === requestAttempts) throw error;
      lastError = error;
    } catch (error) {
      lastError = error;
      if (attempt === requestAttempts) break;
    } finally {
      clearTimeout(timeout);
    }
    await new Promise(resolve => setTimeout(resolve, 250 * attempt));
  }
  throw lastError instanceof Error ? lastError : new Error(`${label} request failed`);
}

export function classifyAqi(aqi: number): LiveEnvironmentalReading["status"] {
  if (aqi <= 50) return "Baik";
  if (aqi <= 100) return "Sedang";
  return "Perlu perhatian";
}

export async function fetchLiveEnvironmentalReading(latitude: number, longitude: number): Promise<LiveEnvironmentalReading | null> {
  const weatherUrl = new URL("https://api.open-meteo.com/v1/forecast");
  weatherUrl.search = new URLSearchParams({ latitude: String(latitude), longitude: String(longitude), current: "temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m", timezone: "auto" }).toString();
  const airUrl = new URL("https://air-quality-api.open-meteo.com/v1/air-quality");
  airUrl.search = new URLSearchParams({ latitude: String(latitude), longitude: String(longitude), current: "us_aqi,pm2_5,pm10,ozone", timezone: "auto" }).toString();

  try {
    const [weatherResponse, airResponse] = await Promise.all([
      fetchOpenMeteo(weatherUrl, "Open-Meteo weather"),
      fetchOpenMeteo(airUrl, "Open-Meteo air quality"),
    ]);
    const weatherPayload = await weatherResponse.json() as { current?: { temperature_2m?: number; relative_humidity_2m?: number; weather_code?: number; wind_speed_10m?: number; time?: string; } };
    const airPayload = await airResponse.json() as { current?: { us_aqi?: number; pm2_5?: number; pm10?: number; ozone?: number; time?: string; } };
    const weather = weatherPayload.current;
    const air = airPayload.current;
    if (weather?.temperature_2m === undefined || weather.relative_humidity_2m === undefined || weather.wind_speed_10m === undefined || air?.us_aqi === undefined || air.pm2_5 === undefined || air.pm10 === undefined) return null;
    const aqi = Math.round(air.us_aqi);
    return {
      aqi,
      pm25: Math.round(air.pm2_5),
      pm10: Math.round(air.pm10),
      ozone: air.ozone === undefined ? null : Math.round(air.ozone),
      temperature: Math.round(weather.temperature_2m),
      humidity: Math.round(weather.relative_humidity_2m),
      wind: Math.round(weather.wind_speed_10m),
      weather: weatherLabels[weather.weather_code ?? 2] ?? "Kondisi berubah",
      status: classifyAqi(aqi),
      observedAt: air.time ?? weather.time ?? new Date().toISOString(),
      fetchedAt: new Date().toISOString(),
      source: "Open-Meteo",
      dataKind: "modeled-forecast",
      spatialResolutionKm: 45,
      attribution: "Open-Meteo · Copernicus Atmosphere Monitoring Service (CAMS)",
    };
  } catch (error) {
    console.warn("[Environment] Live data request failed", error);
    return null;
  }
}

export async function fetchAqiTrend(latitude: number, longitude: number): Promise<AqiTrendPoint[]> {
  const url = new URL("https://air-quality-api.open-meteo.com/v1/air-quality");
  url.search = new URLSearchParams({ latitude: String(latitude), longitude: String(longitude), hourly: "us_aqi,pm2_5", past_hours: "24", forecast_hours: "1", timezone: "auto" }).toString();
  try {
    const response = await fetchOpenMeteo(url, "Open-Meteo AQI trend");
    const payload = await response.json() as { hourly?: { time?: string[]; us_aqi?: Array<number | null>; pm2_5?: Array<number | null> } };
    const hourly = payload.hourly;
    if (!hourly?.time || !hourly.us_aqi || !hourly.pm2_5) return [];
    return hourly.time.map((time, index) => ({ time, aqi: Math.round(hourly.us_aqi?.[index] ?? NaN), pm25: Math.round(hourly.pm2_5?.[index] ?? NaN) })).filter(point => Number.isFinite(point.aqi) && Number.isFinite(point.pm25)).slice(-24);
  } catch (error) {
    console.warn("[Environment] AQI trend request failed", error);
    return [];
  }
}

export async function fetchRouteExposure(points: Array<{ latitude: number; longitude: number }>): Promise<RouteExposureSummary | null> {
  const readings = await Promise.all(points.map(point => fetchLiveEnvironmentalReading(point.latitude, point.longitude)));
  const available = readings.filter((reading): reading is LiveEnvironmentalReading => Boolean(reading));
  if (available.length === 0) return null;
  const values = available.map(reading => reading.aqi);
  return {
    estimatedAqi: Math.round(values.reduce((total, value) => total + value, 0) / values.length),
    minimumAqi: Math.min(...values),
    maximumAqi: Math.max(...values),
    sampleCount: available.length,
    requestedSampleCount: points.length,
    coverage: Math.round(available.length / points.length * 100),
    source: "Open-Meteo",
    method: "sampled-route-model",
  };
}
