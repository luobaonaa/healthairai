// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

const mapHarness = vi.hoisted(() => {
  class Marker {
    setLngLat() { return this; }
    addTo() { return this; }
    remove() { return undefined; }
    getElement() { return document.createElement("div"); }
  }
  return { Marker, map: { on: vi.fn(), getZoom: () => 12, flyTo: vi.fn(), addControl: vi.fn(), off: vi.fn(), remove: vi.fn(), addLayer: vi.fn(), addSource: vi.fn(), getLayer: vi.fn(), getSource: vi.fn() } };
});

vi.mock("@/components/Map", () => ({
  MapView: ({ onMapReady }: { onMapReady?: (map: unknown) => void }) => <button onClick={() => onMapReady?.(mapHarness.map)}>Peta siap</button>,
  getMapLibre: () => ({ Marker: mapHarness.Marker }),
}));

import EnvironmentalMap from "./EnvironmentalMap";

describe("EnvironmentalMap entry transition", () => {
  it("shows a readiness curtain, then reveals the map stage after MapLibre is ready", () => {
    render(<EnvironmentalMap locateRequest={0} focusLocation={{ name: "Cengkareng", caption: "Jakarta Barat", lat: -6.14, lng: 106.73, kind: "search" }} routeDestination={null} routeRequest={0} routeActive={false} recommendedPlaces={[]} onLocationSelected={vi.fn()} onMapLocationSelected={vi.fn()} onLocationRequesting={vi.fn()} onLocationError={vi.fn()} onRouteStatus={vi.fn()} onRouteQuality={vi.fn()} />);
    const stage = screen.getByLabelText("Memuat peta lingkungan");
    expect(stage.getAttribute("aria-busy")).toBe("true");
    expect(screen.getByText("Menyiapkan peta lingkungan")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Peta siap" }));
    expect(stage.getAttribute("aria-busy")).toBe("false");
    expect(stage.className).toContain("is-ready");
  });

  it("reports a route error instead of crashing when the map was removed before route setup", () => {
    const onRouteStatus = vi.fn();
    const onRouteQuality = vi.fn();
    mapHarness.map.getSource.mockImplementationOnce(() => { throw new Error("Map has already been removed"); });
    const view = render(<EnvironmentalMap locateRequest={0} focusLocation={{ name: "Cengkareng", caption: "Jakarta Barat", lat: -6.14, lng: 106.73, kind: "search" }} routeDestination={{ name: "Taman Kota Cengkareng", caption: "Jakarta Barat", lat: -6.15, lng: 106.72, kind: "place" }} roadRoute={{ coordinates: [[106.73, -6.14], [106.725, -6.142], [106.72, -6.15]], distanceMeters: 1800, durationSeconds: 720, summary: "Jl. Raya", provider: "Google Maps" }} routeRequest={1} routeActive recommendedPlaces={[]} onLocationSelected={vi.fn()} onMapLocationSelected={vi.fn()} onLocationRequesting={vi.fn()} onLocationError={vi.fn()} onRouteStatus={onRouteStatus} onRouteQuality={onRouteQuality} />);

    fireEvent.click(within(view.container).getByRole("button", { name: "Peta siap" }));

    expect(onRouteStatus).toHaveBeenCalledWith("error");
    expect(onRouteQuality).toHaveBeenCalledWith(null);
  });

  it("draws the returned road geometry instead of a straight corridor", () => {
    const roadCoordinates: Array<[number, number]> = [[106.7337, -6.1425], [106.7351, -6.1438], [106.7368, -6.1483]];
    const onRouteStatus = vi.fn();
    const view = render(<EnvironmentalMap locateRequest={0} focusLocation={{ name: "Cengkareng", caption: "Jakarta Barat", lat: -6.1425, lng: 106.7337, kind: "search" }} routeDestination={{ name: "Taman Kota Cengkareng", caption: "Jakarta Barat", lat: -6.1483, lng: 106.7368, kind: "place" }} roadRoute={{ coordinates: roadCoordinates, distanceMeters: 1081, durationSeconds: 906, summary: "Jl. Fajar Baru Selatan", provider: "Google Maps" }} routeRequest={2} routeActive recommendedPlaces={[]} onLocationSelected={vi.fn()} onMapLocationSelected={vi.fn()} onLocationRequesting={vi.fn()} onLocationError={vi.fn()} onRouteStatus={onRouteStatus} onRouteQuality={vi.fn()} />);

    fireEvent.click(within(view.container).getByRole("button", { name: "Peta siap" }));

    expect(mapHarness.map.addSource).toHaveBeenCalledWith("healthair-low-exposure-route", expect.objectContaining({ data: expect.objectContaining({ geometry: expect.objectContaining({ coordinates: roadCoordinates }) }) }));
    expect(mapHarness.map.addLayer).toHaveBeenCalledWith(expect.objectContaining({ id: "healthair-low-exposure-route-line" }));
    const flyToOptions = mapHarness.map.flyTo.mock.calls.at(-1)?.[0] as { center: [number, number]; zoom: number };
    expect(flyToOptions.zoom).toBe(14.5);
    expect(flyToOptions.center[0]).toBeCloseTo(106.73525, 5);
    expect(flyToOptions.center[1]).toBeCloseTo(-6.1454, 5);
    expect(onRouteStatus).toHaveBeenCalledWith("ready");
  });
});
