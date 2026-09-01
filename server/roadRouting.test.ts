import { afterEach, describe, expect, it, vi } from "vitest";

const mapMocks = vi.hoisted(() => ({ makeRequest: vi.fn() }));
vi.mock("./_core/map", () => mapMocks);

import { decodeGooglePolyline, getRoadRoute } from "./roadRouting";

describe("roadRouting", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("decodes a Google overview polyline into longitude-latitude road coordinates", () => {
    expect(decodeGooglePolyline("_p~iF~ps|U_ulLnnqC_mqNvxq`@")).toEqual([
      [-120.2, 38.5],
      [-120.95, 40.7],
      [-126.453, 43.252],
    ]);
  });

  it("returns route geometry and practical directions metadata", async () => {
    mapMocks.makeRequest.mockResolvedValue({
      status: "OK",
      routes: [
        {
          overview_polyline: { points: "_p~iF~ps|U_ulLnnqC_mqNvxq`@" },
          summary: "Jl. Utama",
          legs: [
            {
              distance: { value: 4200 },
              duration: { value: 780 },
              steps: [
                {
                  distance: { value: 4200 },
                  duration: { value: 780 },
                  html_instructions: "Belok <b>kanan</b> ke Jl. Utama",
                  travel_mode: "WALKING",
                  start_location: { lat: -6.14, lng: 106.73 },
                  end_location: { lat: -6.15, lng: 106.72 },
                },
              ],
            },
          ],
        },
      ],
    });
    const route = await getRoadRoute({
      originLatitude: -6.14,
      originLongitude: 106.73,
      destinationLatitude: -6.15,
      destinationLongitude: 106.72,
      mode: "walk",
    });

    expect(mapMocks.makeRequest).toHaveBeenCalledWith(
      "/maps/api/directions/json",
      expect.objectContaining({ mode: "walking", region: "id" })
    );
    expect(route).toMatchObject({
      distanceMeters: 4200,
      durationSeconds: 780,
      summary: "Jl. Utama",
      provider: "Google Maps",
    });
    expect(route?.coordinates).toHaveLength(3);
    expect(route?.steps[0]).toMatchObject({
      instruction: "Belok kanan ke Jl. Utama",
      travelMode: "WALKING",
    });
    expect(route?.options).toHaveLength(1);
  });

  it("falls back to an OpenStreetMap road geometry when Google Directions is unavailable", async () => {
    mapMocks.makeRequest.mockRejectedValueOnce(
      new Error("missing credentials")
    );
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        code: "Ok",
        routes: [
          {
            distance: 2850,
            duration: 650,
            geometry: {
              coordinates: [
                [106.7337, -6.1425],
                [106.7401, -6.145],
                [106.751, -6.15],
              ],
            },
            legs: [
              {
                summary: "Jalan Kamal Raya",
                steps: [
                  {
                    distance: 900,
                    duration: 180,
                    name: "Jalan Kamal Raya",
                    maneuver: { type: "depart", location: [106.7337, -6.1425] },
                  },
                  {
                    distance: 1950,
                    duration: 470,
                    name: "Jalan Tzu Chi",
                    maneuver: {
                      type: "turn",
                      modifier: "right",
                      location: [106.7401, -6.145],
                    },
                  },
                ],
              },
            ],
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const route = await getRoadRoute({
      originLatitude: -6.1425,
      originLongitude: 106.7337,
      destinationLatitude: -6.15,
      destinationLongitude: 106.751,
      mode: "car",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.objectContaining({ host: "routing.openstreetmap.de" }),
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
    expect(route).toMatchObject({
      provider: "OpenStreetMap",
      distanceMeters: 2850,
      durationSeconds: 650,
      summary: "Jalan Kamal Raya",
    });
    expect(route?.coordinates).toHaveLength(3);
    expect(route?.steps[1]?.instruction).toBe("Belok kanan ke Jalan Tzu Chi");
  });

  it("returns no fabricated geometry when both road-directions services are unavailable", async () => {
    mapMocks.makeRequest.mockRejectedValueOnce(new Error("offline"));
    vi.stubGlobal("fetch", vi.fn().mockRejectedValueOnce(new Error("offline")));
    await expect(
      getRoadRoute({
        originLatitude: -6.14,
        originLongitude: 106.73,
        destinationLatitude: -6.15,
        destinationLongitude: 106.72,
        mode: "car",
      })
    ).resolves.toBeNull();
  });

  it("maps available transit line and stop data without fabricating operator updates", async () => {
    mapMocks.makeRequest.mockResolvedValue({
      status: "OK",
      routes: [
        {
          overview_polyline: { points: "_p~iF~ps|U_ulLnnqC_mqNvxq`@" },
          summary: "Transit",
          legs: [
            {
              distance: { value: 4200 },
              duration: { value: 780 },
              steps: [
                {
                  distance: { value: 1200 },
                  duration: { value: 500 },
                  html_instructions: "Naik bus",
                  travel_mode: "TRANSIT",
                  start_location: { lat: -6.14, lng: 106.73 },
                  end_location: { lat: -6.15, lng: 106.72 },
                  transit_details: {
                    departure_stop: { name: "Halte A" },
                    arrival_stop: { name: "Halte B" },
                    departure_time: { text: "08.10" },
                    headsign: "Kota",
                    num_stops: 4,
                    line: {
                      short_name: "1A",
                      name: "TransJakarta",
                      vehicle: { name: "Bus" },
                      agencies: [{ name: "TransJakarta" }],
                    },
                  },
                },
              ],
            },
          ],
        },
      ],
    });
    const route = await getRoadRoute({
      originLatitude: -6.14,
      originLongitude: 106.73,
      destinationLatitude: -6.15,
      destinationLongitude: 106.72,
      mode: "transit",
    });

    expect(mapMocks.makeRequest).toHaveBeenCalledWith(
      "/maps/api/directions/json",
      expect.objectContaining({ mode: "transit" })
    );
    expect(route?.transit).toMatchObject({
      lineShortName: "1A",
      agencyName: "TransJakarta",
      departureStop: "Halte A",
      arrivalStop: "Halte B",
      stopCount: 4,
    });
  });
});
