import { afterEach, describe, expect, it, vi } from "vitest";
import { classifyAqi, fetchAqiTrend, fetchLiveEnvironmentalReading } from "./liveEnvironment";

describe("live environmental status", () => {
  it("maps AQI ranges to the cautious HealthAir environmental status labels", () => {
    expect(classifyAqi(42)).toBe("Baik");
    expect(classifyAqi(76)).toBe("Sedang");
    expect(classifyAqi(122)).toBe("Perlu perhatian");
  });

  it("maps real hourly AQI payloads into valid 24-hour trend points", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ hourly: { time: ["2026-08-24T07:00", "2026-08-24T08:00"], us_aqi: [48, null], pm2_5: [18.4, 24] } }) });
    vi.stubGlobal("fetch", fetchMock);
    await expect(fetchAqiTrend(-6.14, 106.73)).resolves.toEqual([{ time: "2026-08-24T07:00", aqi: 48, pm25: 18 }]);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("past_hours=24");
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("forecast_hours=1");
  });

  it("combines current weather and air-quality payloads into a live reading", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ current: { temperature_2m: 30.4, relative_humidity_2m: 71, weather_code: 2, wind_speed_10m: 8.6, time: "2026-08-30T19:00" } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ current: { us_aqi: 54, pm2_5: 18.2, pm10: 31.4, ozone: 42.1, time: "2026-08-30T19:00" } }) });
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchLiveEnvironmentalReading(-6.14, 106.73)).resolves.toMatchObject({
      aqi: 54,
      pm25: 18,
      pm10: 31,
      temperature: 30,
      humidity: 71,
      wind: 9,
      source: "Open-Meteo",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  afterEach(() => vi.unstubAllGlobals());
});
