import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMocks = vi.hoisted(() => ({
  getUserPreferences: vi.fn(),
  getSavedLocations: vi.fn(),
  removeUserLocation: vi.fn(),
  saveFeedbackMessage: vi.fn(),
  saveUserLocation: vi.fn(),
  saveUserPreferences: vi.fn(),
}));

vi.mock("./db", () => dbMocks);

vi.mock("./liveEnvironment", () => ({ fetchAqiTrend: vi.fn(), fetchLiveEnvironmentalReading: vi.fn() }));

import { appRouter } from "./routers";
import { fetchLiveEnvironmentalReading } from "./liveEnvironment";
import type { TrpcContext } from "./_core/context";

function createContext(): TrpcContext {
  return {
    user: { id: 8, openId: "healthair-user", email: "user@example.com", name: "Map User", loginMethod: "manus", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

describe("environmental persistence procedures", () => {
  beforeEach(() => vi.clearAllMocks());

  it("saves an authenticated user's environmental profile preference", async () => {
    dbMocks.saveUserPreferences.mockResolvedValue({ userId: 8, profileType: "Outdoor Activity", notificationPreference: false });
    const result = await appRouter.createCaller(createContext()).environmental.savePreferences({ profileType: "Outdoor Activity", notificationPreference: false });
    expect(dbMocks.saveUserPreferences).toHaveBeenCalledWith(8, { profileType: "Outdoor Activity", notificationPreference: false });
    expect(result).toMatchObject({ profileType: "Outdoor Activity" });
  });

  it("saves a selected map location for the authenticated user", async () => {
    dbMocks.saveUserLocation.mockResolvedValue({ saved: true });
    const input = { label: "Taman Kota", address: "Jakarta Barat", latitude: -6.1483, longitude: 106.7368 };
    await expect(appRouter.createCaller(createContext()).environmental.saveLocation(input)).resolves.toEqual({ saved: true });
    expect(dbMocks.saveUserLocation).toHaveBeenCalledWith(8, input);
  });

  it("removes only the authenticated user's favorite location", async () => {
    dbMocks.removeUserLocation.mockResolvedValue({ removed: true });
    await expect(appRouter.createCaller(createContext()).environmental.removeLocation({ id: 14 })).resolves.toEqual({ removed: true });
    expect(dbMocks.removeUserLocation).toHaveBeenCalledWith(8, 14);
  });

  it("returns only unhealthy favorites as visual alert candidates", async () => {
    dbMocks.getSavedLocations.mockResolvedValue([{ id: 5, label: "Rumah", address: "Jakarta Barat", latitude: -6.14, longitude: 106.73 }, { id: 7, label: "Kantor", address: "Jakarta Pusat", latitude: -6.17, longitude: 106.82 }]);
    vi.mocked(fetchLiveEnvironmentalReading).mockResolvedValueOnce({ aqi: 146, pm25: 72, pm10: 90, ozone: null, temperature: 30, humidity: 64, wind: 8, weather: "Berkabut", status: "Perlu perhatian", observedAt: "2026-08-24T08:00", source: "Open-Meteo" }).mockResolvedValueOnce({ aqi: 62, pm25: 28, pm10: 33, ozone: null, temperature: 30, humidity: 64, wind: 8, weather: "Cerah", status: "Sedang", observedAt: "2026-08-24T08:00", source: "Open-Meteo" });
    const alerts = await appRouter.createCaller(createContext()).environmental.favoriteAlerts();
    expect(alerts).toEqual([expect.objectContaining({ id: 5, label: "Rumah", aqi: 146 })]);
  });

  it("persists feedback from an authenticated user", async () => {
    dbMocks.saveFeedbackMessage.mockResolvedValue({ submitted: true });
    await expect(appRouter.createCaller(createContext()).feedback.submit({ message: "Tolong tambahkan ringkasan tren malam hari." })).resolves.toEqual({ submitted: true });
    expect(dbMocks.saveFeedbackMessage).toHaveBeenCalledWith(8, "Tolong tambahkan ringkasan tren malam hari.");
  });
});
