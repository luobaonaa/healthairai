// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mapMocks = vi.hoisted(() => {
  const mapInstance = {
    addControl: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    remove: vi.fn(),
  };
  return {
    Map: vi.fn(() => mapInstance),
    NavigationControl: vi.fn(),
    FullscreenControl: vi.fn(),
    mapInstance,
  };
});

import { MapView } from "./Map";

beforeEach(() => {
  Object.defineProperty(window, "maplibregl", { configurable: true, value: mapMocks });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  Reflect.deleteProperty(window, "maplibregl");
});

describe("MapView", () => {
  it("initializes MapLibre with the non-Google OpenFreeMap style and standard navigation controls", async () => {
    render(<MapView initialCenter={{ lat: -6.2, lng: 106.8 }} initialZoom={13} />);

    await waitFor(() => expect(mapMocks.Map).toHaveBeenCalledTimes(1));
    expect(mapMocks.Map).toHaveBeenCalledWith(expect.objectContaining({
      style: "https://tiles.openfreemap.org/styles/liberty",
      center: [106.8, -6.2],
      zoom: 13,
      dragRotate: false,
      touchPitch: false,
    }));
    expect(mapMocks.mapInstance.addControl).toHaveBeenCalledWith(expect.any(Object), "top-right");
  });

  it("shows a clear retry state when the map emits an error", async () => {
    render(<MapView />);
    await waitFor(() => expect(mapMocks.mapInstance.on).toHaveBeenCalledWith("error", expect.any(Function)));
    const errorHandler = mapMocks.mapInstance.on.mock.calls.find(([event]) => event === "error")?.[1] as ((event: unknown) => void);
    errorHandler({ error: { message: "tiles unavailable" } });

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Peta belum tersedia");
    expect(alert.className).toContain("z-20");
    expect(screen.getByRole("button", { name: "Coba lagi" })).toBeTruthy();
  });

  it("does not recreate the map when the parent supplies new callback identities", async () => {
    const { rerender } = render(<MapView onMapReady={() => undefined} />);
    await waitFor(() => expect(mapMocks.Map).toHaveBeenCalledTimes(1));
    rerender(<MapView onMapReady={() => undefined} />);
    expect(mapMocks.Map).toHaveBeenCalledTimes(1);
  });
});
