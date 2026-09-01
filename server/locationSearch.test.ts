import { afterEach, describe, expect, it, vi } from "vitest";
import { reverseLocationSuggestion, searchLocationSuggestions } from "./locationSearch";

describe("location suggestions", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("converts Open-Meteo geocoding results into concise location suggestions", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ results: [{ name: "Monaco", admin1: "Monaco", country: "Monaco", latitude: 43.7384, longitude: 7.4246 }, { name: "Monas", admin1: "Jakarta Pusat", country: "Indonesia", latitude: -6.1754, longitude: 106.8272 }] }) });
    vi.stubGlobal("fetch", fetchMock);

    await expect(searchLocationSuggestions("m")).resolves.toEqual([
      { name: "Monaco", caption: "Monaco, Monaco", latitude: 43.7384, longitude: 7.4246 },
      { name: "Monas", caption: "Jakarta Pusat, Indonesia", latitude: -6.1754, longitude: 106.8272 },
    ]);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("count=6");
  });

  it("uses the OpenStreetMap fallback when a short query has no Open-Meteo results", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ results: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ([{ name: "Melaka", display_name: "Melaka, Malaysia", lat: "2.3293744", lon: "102.2880962" }]) });
    vi.stubGlobal("fetch", fetchMock);

    await expect(searchLocationSuggestions("m")).resolves.toEqual([{ name: "Melaka", caption: "Melaka, Malaysia", latitude: 2.3293744, longitude: 102.2880962 }]);
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain("nominatim.openstreetmap.org/search");
  });

  it("falls back to OpenStreetMap when the primary geocoder response cannot be parsed", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => { throw new Error("empty response"); } })
      .mockResolvedValueOnce({ ok: true, json: async () => ([{ name: "Melaka", display_name: "Melaka, Malaysia", lat: "2.3293744", lon: "102.2880962" }]) });
    vi.stubGlobal("fetch", fetchMock);

    await expect(searchLocationSuggestions("m")).resolves.toHaveLength(1);
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain("nominatim.openstreetmap.org/search");
  });

  it("converts reverse geocoding data into a selected place name", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ name: "Monumen Nasional", display_name: "Monumen Nasional, Jakarta Pusat, Indonesia" }) });
    vi.stubGlobal("fetch", fetchMock);

    await expect(reverseLocationSuggestion(-6.1754, 106.8272)).resolves.toEqual({ name: "Monumen Nasional", caption: "Monumen Nasional, Jakarta Pusat, Indonesia", latitude: -6.1754, longitude: 106.8272 });
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("nominatim.openstreetmap.org/reverse");
  });
});
