import { beforeEach, describe, expect, it, vi } from "vitest";

const llmMocks = vi.hoisted(() => ({ invokeLLM: vi.fn() }));
vi.mock("./_core/llm", () => llmMocks);

import { answerAirQuestion } from "./airAssistant";

const hazardousContext = {
  location: "Jakarta Pusat",
  profile: "Umum",
  aqi: 220,
  pm25: 140,
  pm10: 180,
  ozone: 40,
  temperature: 30,
  humidity: 70,
  wind: 6,
  weather: "Berkabut",
  status: "Perlu perhatian",
  source: "Open-Meteo",
};

describe("HealthAir AI risk guidance", () => {
  beforeEach(() => {
    llmMocks.invokeLLM.mockReset();
  });

  it("gives the server-side model explicit instructions for hazardous AQI and PM2.5 context", async () => {
    llmMocks.invokeLLM.mockResolvedValue({
      choices: [{ message: { content: "Batasi aktivitas luar ruang." } }],
    });
    await answerAirQuestion(
      [{ role: "user", content: "Apakah aman keluar?" }],
      hazardousContext
    );

    const request = llmMocks.invokeLLM.mock.calls[0]?.[0] as {
      messages: Array<{ role: string; content: string }>;
    };
    expect(request.messages[0]?.content).toContain(
      "Jika AQI berada pada 151 atau lebih"
    );
    expect(request.messages[0]?.content).toContain("PM2.5 125,5 µg/m³");
    expect(request.messages[0]?.content).toContain(
      "termasuk bila topiknya tidak berhubungan"
    );
    expect(request.messages[0]?.content).toContain(
      "Anda adalah Puffy, maskot sekaligus asisten AI milik HealthAir"
    );
    expect(request.messages[0]?.content).toContain(
      "Hindari kalimat kaku"
    );
    expect(request.messages[0]?.content).toContain(
      "anggap keluhan itu merujuk pada Puffy"
    );
  });

  it("prefixes the returned assistant answer with a deterministic warning for hazardous air", async () => {
    llmMocks.invokeLLM.mockResolvedValue({
      choices: [{ message: { content: "Tetap cek pembaruan kondisi lokal." } }],
    });
    const result = await answerAirQuestion(
      [{ role: "user", content: "Bagaimana kondisi di luar?" }],
      { ...hazardousContext, aqi: 320, pm25: 240 }
    );

    expect(result.answer).toContain("Peringatan kondisi udara berbahaya");
    expect(result.answer).toContain("Tetap cek pembaruan kondisi lokal.");
    expect(result.answer).toContain("peta HealthAir");
  });

  it("answers an off-topic question without injecting an unrelated hazardous-air warning", async () => {
    llmMocks.invokeLLM.mockResolvedValue({
      choices: [
        {
          message: {
            content:
              "Jakarta adalah ibu kota Indonesia selama sebagian besar era modern.",
          },
        },
      ],
    });
    const result = await answerAirQuestion(
      [{ role: "user", content: "Ceritakan fakta tentang Jakarta" }],
      hazardousContext
    );

    expect(result.answer).toContain("Jakarta adalah ibu kota Indonesia");
    expect(result.answer).not.toContain("Peringatan kualitas udara tinggi");
    expect(result.answer).not.toContain("peta HealthAir");
  });

  it("sends ordinary greetings to the AI provider", async () => {
    llmMocks.invokeLLM.mockResolvedValue({
      choices: [{ message: { content: "Halo. Senang bertemu dengan Anda." } }],
    });
    const result = await answerAirQuestion(
      [{ role: "user", content: "Halo" }],
      hazardousContext
    );

    expect(result.fallback).toBe(false);
    expect(result.answer).toBe("Halo. Senang bertemu dengan Anda.");
    expect(llmMocks.invokeLLM).toHaveBeenCalledOnce();
  });

  it("sends a simple AI identity question to the provider", async () => {
    llmMocks.invokeLLM.mockResolvedValue({
      choices: [{ message: { content: "Iya, saya HealthAir AI." } }],
    });
    const result = await answerAirQuestion(
      [{ role: "user", content: "kamu ai?" }],
      hazardousContext
    );

    expect(result.answer).toContain("Iya, saya HealthAir AI");
    expect(result.answer).not.toContain("belum sepenuhnya memahami");
    expect(result.answer).not.toContain("sedikit konteks");
    expect(llmMocks.invokeLLM).toHaveBeenCalledOnce();
  });

  it("understands a slang AI identity question without asking for context", async () => {
    llmMocks.invokeLLM.mockResolvedValue({
      choices: [{ message: { content: "Iya, saya AI. Ada yang ingin dibahas?" } }],
    });
    const result = await answerAirQuestion(
      [{ role: "user", content: "LU SEBERNYA AI GA SI" }],
      hazardousContext
    );

    expect(result.answer).toContain("Iya, saya AI");
    expect(result.answer).not.toContain("belum sepenuhnya memahami");
    expect(result.answer).not.toContain("berikan sedikit konteks");
    expect(llmMocks.invokeLLM).toHaveBeenCalledOnce();
  });

  it("reports provider failure instead of pretending a local template is AI", async () => {
    llmMocks.invokeLLM.mockImplementation(async () => {
      throw new Error("provider unavailable");
    });
    const result = await answerAirQuestion(
      [{ role: "user", content: "Bantu susun agenda hari ini" }],
      hazardousContext
    );

    expect(result.answer).toContain("Koneksi ke model AI sedang bermasalah");
    expect(result.answer).not.toContain("peta HealthAir");
    expect(result.unavailable).toBe(true);
  });

  it("shows a clear setup message when no API key is configured", async () => {
    llmMocks.invokeLLM.mockImplementation(async () => {
      throw new Error(
        "AI provider is not configured. Set OPENAI_API_KEY in .env.local."
      );
    });
    const result = await answerAirQuestion(
      [{ role: "user", content: "lau empruy" }],
      hazardousContext
    );

    expect(result.answer).toContain("OPENAI_API_KEY");
    expect(result.unavailable).toBe(true);
  });

  it("does not append map promotion to a provider error", async () => {
    llmMocks.invokeLLM.mockImplementation(async () => {
      throw new Error("provider unavailable");
    });
    const result = await answerAirQuestion(
      [
        { role: "user", content: "Halo" },
        {
          role: "assistant",
          content:
            "Halo. Jika diperlukan, saya juga dapat membantu membaca kondisi lokasi pada peta.",
        },
        { role: "user", content: "wkwk" },
      ],
      hazardousContext
    );

    expect(result.answer).toContain("Koneksi ke model AI sedang bermasalah");
    expect(result.answer).not.toContain("membaca kondisi lokasi pada peta");
    expect(result.answer).not.toContain("peta HealthAir");
  });
});
