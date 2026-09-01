import { beforeEach, describe, expect, it, vi } from "vitest";

const assistantMocks = vi.hoisted(() => ({ answerAirQuestion: vi.fn() }));
vi.mock("./airAssistant", () => assistantMocks);

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
  beforeEach(() => vi.clearAllMocks());

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
});
