// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => ({ isAuthenticated: true }) }));
vi.mock("@/lib/trpc", () => ({ trpc: { environmental: { savedLocations: { useQuery: () => ({ data: [{ id: 4, label: "Rumah", address: "Jakarta Barat", latitude: -6.14, longitude: 106.73 }] }) }, aqiTrend: { useQuery: () => ({ data: [{ time: "2026-08-24T07:00", aqi: 51, pm25: 20 }, { time: "2026-08-24T08:00", aqi: 74, pm25: 32 }], isLoading: false }) } } } }));

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal("ResizeObserver", ResizeObserverMock);

import Trends from "./Trends";

describe("AQI trend view", () => {
  it("renders a standalone 24-hour AQI chart and lets the user select a favorite", () => {
    render(<Trends />);
    expect(screen.getByRole("heading", { name: "AQI, dilihat sebagai perjalanan satu hari." })).toBeTruthy();
    expect(screen.getByText("AQI per jam")).toBeTruthy();
    expect(screen.getByText("Puncak dalam 24 jam")).toBeTruthy();

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "-6.14,106.73" } });
    expect(screen.getByRole("heading", { name: "Rumah" })).toBeTruthy();
  });
});
