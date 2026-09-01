import { describe, expect, it } from "vitest";
import { buildPreferenceUpdate, chooseHealthierLocation, estimateRouteExposure, formatNavigationDistance, getAirRiskWarning, getAqiCategory, getDataFreshness, getEnvironmentalInsight, getLowExposureRoute, getPm25Category, getRouteGuidance, getRouteNavigationProgress, getSurroundingConditions, sampleRouteCoordinates, selectSavedLocation, updateRecentLocations, type LocationSelection } from "./environment";

const origin: LocationSelection = { name: "Cengkareng", caption: "Jakarta Barat", lat: -6.1425, lng: 106.7337 };
const park: LocationSelection = { name: "Taman Kota", caption: "Ruang hijau", lat: -6.1483, lng: 106.7368, kind: "place" };

describe("environmental exploration helpers", () => {
  it("provides a distance and pollution context for a candidate route", () => {
    const guidance = getRouteGuidance(origin, park);
    expect(guidance.distanceKm).toBeGreaterThan(0);
    expect(guidance.pollutionLabel).toMatch(/Paparan polusi/);
    expect(guidance.temperature).toBeGreaterThan(0);
  });

  it("offers bounded lower-exposure estimates for each available travel mode", () => {
    const walking = getLowExposureRoute(origin, park, "walk");
    const car = getLowExposureRoute(origin, park, "car");
    const transit = getLowExposureRoute(origin, park, "transit");
    expect(walking.estimatedMinutes).toBeGreaterThan(car.estimatedMinutes);
    expect(car.estimatedExposureAqi).toBeLessThan(walking.estimatedExposureAqi);
    expect(transit.modeLabel).toBe("Transportasi umum");
    expect(transit.disclaimer).toContain("estimasi");
  });

  it("tracks remaining route distance and the next maneuver from a device position", () => {
    const progress = getRouteNavigationProgress([[106.7, -6.1], [106.701, -6.1], [106.702, -6.1]], [{ instruction: "Belok kanan", distanceMeters: 110, durationSeconds: 60, start: [106.7, -6.1], end: [106.701, -6.1], travelMode: "WALKING" }, { instruction: "Lanjut lurus", distanceMeters: 110, durationSeconds: 60, start: [106.701, -6.1], end: [106.702, -6.1], travelMode: "WALKING" }], [106.7006, -6.1]);
    expect(progress?.remainingMeters).toBeLessThan(180);
    expect(progress?.nextStepIndex).toBe(0);
    expect(formatNavigationDistance(180)).toBe("180 m");
  });

  it("generates three nearby condition zones around the active location", () => {
    const zones = getSurroundingConditions(origin);
    expect(zones).toHaveLength(3);
    expect(zones.every(zone => zone.reading.aqi > 0)).toBe(true);
  });

  it("keeps selected searches at the front of recent location history without duplicates", () => {
    const history = updateRecentLocations([origin, park], park);
    expect(history).toHaveLength(2);
    expect(history[0]?.name).toBe("Taman Kota");
  });

  it("chooses the location with the better environmental score for comparison", () => {
    expect(chooseHealthierLocation(origin, park).name).toBe("Taman Kota");
  });

  it("returns a bounded estimated exposure score for an available route geometry", () => {
    const exposure = estimateRouteExposure([{ lat: -6.1425, lng: 106.7337 }, { lat: -6.146, lng: 106.735 }], 58);
    expect(exposure).toBeGreaterThanOrEqual(1);
    expect(exposure).toBeLessThanOrEqual(300);
  });

  it("samples the whole route including both endpoints", () => {
    const coordinates = Array.from({ length: 30 }, (_, index) => [106 + index / 100, -6 - index / 100] as [number, number]);
    const points = sampleRouteCoordinates(coordinates, 8);
    expect(points).toHaveLength(8);
    expect(points[0]).toEqual({ longitude: 106, latitude: -6 });
    expect(points.at(-1)).toEqual({ longitude: 106.29, latitude: -6.29 });
  });

  it("marks cached or old environmental data as stale", () => {
    const now = new Date("2026-08-31T10:00:00.000Z").getTime();
    expect(getDataFreshness("2026-08-31T09:58:00.000Z", false, now).state).toBe("fresh");
    expect(getDataFreshness("2026-08-31T09:20:00.000Z", false, now).state).toBe("stale");
    expect(getDataFreshness("2026-08-31T09:58:00.000Z", true, now).state).toBe("stale");
  });

  it("creates the exact preference payload used by the notification toggle", () => {
    expect(buildPreferenceUpdate("Outdoor Activity", true)).toEqual({ profileType: "Outdoor Activity", notificationPreference: true });
  });

  it("converts a saved-location row into the location selected by the map workflow", () => {
    expect(selectSavedLocation({ label: "Rumah", address: "Jakarta Barat", latitude: -6.14, longitude: 106.73 })).toMatchObject({ name: "Rumah", caption: "Jakarta Barat", kind: "place" });
  });

  it("maps AQI and PM2.5 into consistent color-coded public-health categories", () => {
    expect(getAqiCategory(42)).toMatchObject({ label: "Baik", tone: "good" });
    expect(getAqiCategory(180)).toMatchObject({ label: "Tidak sehat", tone: "unhealthy" });
    expect(getPm25Category(40)).toMatchObject({ tone: "sensitive" });
    expect(getPm25Category(240)).toMatchObject({ label: "Berbahaya", tone: "hazardous" });
  });

  it("returns a clear smoke-safety warning when AQI or PM2.5 is dangerous", () => {
    const warning = getAirRiskWarning({ aqi: 320, pm25: 240 });
    expect(warning).toMatchObject({ severity: "hazardous", title: "Peringatan kondisi udara berbahaya" });
    expect(warning?.message).toContain("Hindari aktivitas luar ruang");
  });

  it("does not describe AQI 165 as controlled in the adaptive insight", () => {
    const insight = getEnvironmentalInsight({ aqi: 165, pm25: 72, temperature: 30, humidity: 68, wind: 8, weather: "Berkabut", status: "Perlu perhatian", trend: "Perlu dipantau", score: 28 }, "General");
    expect(insight).toContain("Kondisi udara tidak sehat");
    expect(insight).toContain("Kurangi aktivitas luar ruang");
    expect(insight).not.toContain("cukup terkendali");
  });
});
