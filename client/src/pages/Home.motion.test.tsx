// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => ({ isAuthenticated: false }) }));
vi.mock("@/lib/trpc", () => ({ trpc: { environmental: { live: { useQuery: () => ({ data: { aqi: 37, pm25: 11, temperature: 30, humidity: 68, wind: 9, weather: "Cerah", status: "Baik", source: "Open-Meteo", observedAt: "2026-08-30T07:00:00.000Z" }, isLoading: false }) } } } }));

import Home from "./Home";

describe("Home atmospheric motion", () => {
  afterEach(() => cleanup());

  it("applies staggered text-motion classes to the landing introduction", () => {
    render(<Home />);
    expect(screen.getByText("Tahu udaranya.").className).toContain("hero-line-one");
    expect(screen.getByText("Lebih lega.").className).toContain("hero-line-three");
    expect(document.querySelector(".hero-kicker")?.className).toContain("hero-kicker");
    expect(screen.getByText("Baca udaranya. Pilih langkah yang lebih nyaman.").className).toContain("hero-description");
    expect(document.querySelector(".hero-actions")?.className).toContain("hero-actions");
    expect(screen.getByLabelText("Maskot HealthAir mengikuti arah kursor")).toBeTruthy();
    expect(screen.getByTestId("hero-mascot")).toBeTruthy();
    expect(screen.getByText("37")).toBeTruthy();
    expect(screen.getByText(/Data langsung · Open-Meteo/)).toBeTruthy();
    expect(document.querySelectorAll(".feature-card")).toHaveLength(3);
    expect(document.querySelector(".cta-section")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Pasang aplikasi" })).toBeTruthy();
  });

  it("shows mobile installation guidance when the browser has no native prompt", () => {
    render(<Home />);
    fireEvent.click(screen.getByRole("button", { name: "Pasang aplikasi" }));
    expect(screen.getByRole("dialog", { name: "Pasang aplikasi HealthAir" })).toBeTruthy();
    expect(screen.getByText(/Tambahkan ke layar utama/i)).toBeTruthy();
  });
});
