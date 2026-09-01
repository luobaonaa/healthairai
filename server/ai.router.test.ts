import { beforeEach, describe, expect, it, vi } from "vitest";

const assistantMocks = vi.hoisted(() => ({ answerAirQuestion: vi.fn() }));
const environmentMocks = vi.hoisted(() => ({
  fetchAqiTrend: vi.fn(),
  fetchLiveEnvironmentalReading: vi.fn(),
  fetchRouteExposure: vi.fn(),
}));
const locationMocks = vi.hoisted(() => ({
  reverseLocationSuggestion: vi.fn(),
  searchLocationSuggestions: vi.fn(),
}));
vi.mock("./airAssistant", () => assistantMocks);
vi.mock("./liveEnvironment", () => environmentMocks);
vi.mock("./locationSearch", () => locationMocks);

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

const context = {
  user: null,
  req: { protocol: "https", headers: {} },
  res: { clearCookie: vi.fn() },
} as unknown as TrpcContext;

const input = {
  messages: [
    { role: "user" as const, content: "Apakah nyaman untuk jalan kaki?" },
  ],
  context: {
    location: "Cengkareng, Jakarta Barat",
    profile: "Umum",
    aqi: 42,
    pm25: 18,
    pm10: 24,
    ozone: 37,
    temperature: 29,
    humidity: 70,
    wind: 8,
    weather: "Cerah berawan",
    status: "Baik",
    source: "Open-Meteo",
    observedAt: "2026-08-23T04:00:00.000Z",
  },
};

describe("ai.chat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    environmentMocks.fetchLiveEnvironmentalReading.mockResolvedValue(null);
    locationMocks.searchLocationSuggestions.mockResolvedValue([]);
  });

  it("forwards bounded chat history and environmental context to the HealthAir assistant", async () => {
    assistantMocks.answerAirQuestion.mockResolvedValue({
      answer: "Kondisi cukup nyaman untuk jalan kaki ringan.",
      fallback: false,
    });
    const result = await appRouter.createCaller(context).ai.chat(input);

    expect(assistantMocks.answerAirQuestion).toHaveBeenCalledWith(
      input.messages,
      input.context
    );
    expect(result).toEqual({
      answer: "Kondisi cukup nyaman untuk jalan kaki ringan.",
      fallback: false,
    });
  });

  it("returns a transport error instead of a fake assistant message", async () => {
    assistantMocks.answerAirQuestion.mockRejectedValue(
      new Error("provider unavailable")
    );
    await expect(appRouter.createCaller(context).ai.chat(input)).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
    });
  });

  it("accepts a long assistant reply when it is sent back as conversation history", async () => {
    assistantMocks.answerAirQuestion.mockResolvedValue({
      answer: "Riwayat percakapan diterima.",
      fallback: false,
    });
    const longHistory = {
      ...input,
      messages: [
        { role: "assistant" as const, content: "a".repeat(5000) },
        { role: "user" as const, content: "Lanjutkan penjelasannya." },
      ],
    };

    await expect(
      appRouter.createCaller(context).ai.chat(longHistory)
    ).resolves.toMatchObject({ answer: "Riwayat percakapan diterima." });
  });

  it("accepts the local Open-Meteo observation timestamp used by the live environmental endpoint", async () => {
    assistantMocks.answerAirQuestion.mockResolvedValue({
      answer: "Kondisi sedang dipantau.",
      fallback: false,
    });
    const result = await appRouter
      .createCaller(context)
      .ai.chat({
        ...input,
        context: { ...input.context, observedAt: "2026-08-23T13:00" },
      });

    expect(result).toEqual({
      answer: "Kondisi sedang dipantau.",
      fallback: false,
    });
  });

  it("fetches fresh Open-Meteo data for a location named in the question", async () => {
    assistantMocks.answerAirQuestion.mockResolvedValue({
      answer: "AQI Kebon Jeruk saat ini 61.",
      fallback: false,
    });
    locationMocks.searchLocationSuggestions.mockResolvedValue([{
      name: "Kebon Jeruk",
      caption: "Jakarta Barat, Indonesia",
      latitude: -6.191,
      longitude: 106.763,
    }]);
    environmentMocks.fetchLiveEnvironmentalReading.mockResolvedValue({
      aqi: 61,
      pm25: 22,
      pm10: 34,
      ozone: 40,
      temperature: 30,
      humidity: 71,
      wind: 7,
      weather: "Cerah berawan",
      status: "Sedang",
      observedAt: "2026-09-01T15:00",
      fetchedAt: "2026-09-01T15:02:00.000Z",
      source: "Open-Meteo",
      dataKind: "modeled-forecast",
      spatialResolutionKm: 45,
      attribution: "Open-Meteo · CAMS",
    });

    await appRouter.createCaller(context).ai.chat({
      messages: [{ role: "user", content: "Bagaimana kondisi udara di Kebon Jeruk sekarang?" }],
      context: { ...input.context, latitude: -6.1425, longitude: 106.7337 },
    });

    expect(locationMocks.searchLocationSuggestions).toHaveBeenCalledWith("Kebon Jeruk");
    expect(environmentMocks.fetchLiveEnvironmentalReading).toHaveBeenCalledWith(-6.191, 106.763);
    expect(assistantMocks.answerAirQuestion).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({
        location: "Kebon Jeruk, Jakarta Barat, Indonesia",
        aqi: 61,
        pm25: 22,
        source: "Open-Meteo",
      })
    );
  });
});
