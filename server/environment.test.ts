import { describe, expect, it } from "vitest";
import { buildEnvironmentalInsight, calculateEnvironmentalScore } from "./environment";

describe("environmental guidance", () => {
  it("ranks cleaner and greener locations above polluted traffic-heavy locations", () => {
    const healthier = calculateEnvironmentalScore({ aqi: 31, pm25: 12, wind: 11, greenery: 88, traffic: 12 });
    const lessFavorable = calculateEnvironmentalScore({ aqi: 89, pm25: 42, wind: 4, greenery: 15, traffic: 87 });
    expect(healthier).toBeGreaterThan(lessFavorable);
    expect(healthier).toBeGreaterThan(70);
  });

  it("uses cautious, non-diagnostic wording for sensitive profiles", () => {
    const insight = buildEnvironmentalInsight({ aqi: 72, pm25: 31, wind: 5, greenery: 30, traffic: 64 }, "Respiratory Sensitive");
    expect(insight).toContain("pertimbangkan");
    expect(insight.toLowerCase()).not.toContain("diagnosis");
  });

  it("describes AQI 165 as unhealthy rather than controlled", () => {
    const insight = buildEnvironmentalInsight({ aqi: 165, pm25: 72, wind: 8, greenery: 30, traffic: 64 }, "General");
    expect(insight).toContain("Kondisi udara tidak sehat");
    expect(insight).toContain("Kurangi aktivitas luar ruang");
  });
});
