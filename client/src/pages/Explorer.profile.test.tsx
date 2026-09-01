// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const savePreferences = vi.fn();
const savedRefetch = vi.fn();
const removeSavedLocation = vi.fn();
const sendAssistantMessage = vi.fn();
const reverseLocationMutation = vi.fn();
let liveReading: Record<string, unknown> | null = null;
let favoriteAlerts: Array<{ id: number; label: string; address: string; latitude: number; longitude: number; aqi: number; status: string }> = [];
let roadRouteData: Record<string, unknown> | null = null;

vi.mock("@/_core/hooks/useAuth", () => ({
  useAuth: () => ({ user: { name: "Alya" }, isAuthenticated: true, loading: false, logout: vi.fn() }),
}));

vi.mock("@/components/EnvironmentalMap", () => ({
  default: ({ onLocationSelected, onMapLocationSelected, onLocationError }: { onLocationSelected: (location: { name: string; caption: string; lat: number; lng: number; kind: "user" }) => void; onMapLocationSelected: (location: { name: string; caption: string; lat: number; lng: number; kind: "search" }) => void; onLocationError: (reason: "denied") => void }) => <div data-testid="environmental-map"><button onClick={() => onLocationSelected({ name: "Lokasi perangkat", caption: "Lokasi perangkat saat ini", lat: -6.2, lng: 106.8, kind: "user" })}>Simulasi lokasi berhasil</button><button onClick={() => onMapLocationSelected({ name: "Memuat nama tempat…", caption: "Mencari nama area pada peta", lat: -6.1754, lng: 106.8272, kind: "search" })}>Simulasi klik peta</button><button onClick={() => onLocationError("denied")}>Simulasi izin ditolak</button></div>,
}));

vi.mock("@/components/AIChatBox", () => ({
  AIChatBox: ({ onSendMessage, messages }: { onSendMessage: (content: string) => void; messages: Array<{ role: string; content: string }> }) => <div><button onClick={() => onSendMessage("Apa arti AQI saat ini?")}>Kirim pertanyaan AI</button>{messages.map((message, index) => <p key={index}>{message.content}</p>)}</div>,
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    environmental: {
      preferences: { useQuery: () => ({ data: { profileType: "General", notificationPreference: false }, refetch: vi.fn() }) },
      savedLocations: { useQuery: () => ({ data: [{ id: 1, label: "Rumah", address: "Jakarta Barat", latitude: -6.14, longitude: 106.73 }], refetch: savedRefetch }) },
      favoriteAlerts: { useQuery: () => ({ data: favoriteAlerts }) },
      live: { useQuery: () => ({ data: liveReading, isFetching: false, refetch: vi.fn() }) },
      roadRoute: { useQuery: () => ({ data: roadRouteData, isFetching: false }) },
      routeExposure: { useQuery: () => ({ data: null, isFetching: false }) },
      pushConfig: { useQuery: () => ({ data: { enabled: false, publicKey: null } }) },
      exportMyData: { useQuery: () => ({ refetch: vi.fn().mockResolvedValue({ data: { preferences: null, savedLocations: [] } }) }) },
      reverseLocation: { useMutation: () => ({ mutate: (input: unknown, options?: { onSuccess?: (result: { name: string; caption: string; latitude: number; longitude: number }) => void }) => { reverseLocationMutation(input); options?.onSuccess?.({ name: "Monumen Nasional", caption: "Jakarta Pusat, Indonesia", latitude: -6.1754, longitude: 106.8272 }); } }) },
      searchLocations: { useQuery: ({ query }: { query: string }) => ({ data: query.toLowerCase() === "m" ? [{ name: "Monaco", caption: "Monaco", latitude: 43.7384, longitude: 7.4246 }, { name: "Monas", caption: "Jakarta Pusat, Indonesia", latitude: -6.1754, longitude: 106.8272 }] : [], isFetching: false }) },
      savePreferences: { useMutation: () => ({ mutate: savePreferences }) },
      subscribePush: { useMutation: () => ({ mutateAsync: vi.fn() }) },
      unsubscribePush: { useMutation: () => ({ mutateAsync: vi.fn() }) },
      clearMyEnvironmentalData: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      saveLocation: { useMutation: () => ({ mutate: vi.fn() }) },
      removeLocation: { useMutation: (options?: { onSuccess?: () => void }) => ({ mutate: (input: { id: number }) => { removeSavedLocation(input); options?.onSuccess?.(); } }) },
    },
    ai: {
      chat: { useMutation: (options?: { onSuccess?: (result: { answer: string }) => void }) => ({ mutate: (input: unknown) => { sendAssistantMessage(input); options?.onSuccess?.({ answer: "Respons AI HealthAir" }); }, isPending: false }) },
    },
  },
}));

import Explorer from "./Explorer";

describe("Explorer profile workflow", () => {
  afterEach(() => cleanup());
  beforeEach(() => {
    savePreferences.mockClear();
    savedRefetch.mockClear();
    removeSavedLocation.mockClear();
    sendAssistantMessage.mockClear();
    reverseLocationMutation.mockClear();
    liveReading = null;
    favoriteAlerts = [];
    roadRouteData = null;
    window.localStorage.clear();
    window.history.pushState({}, "", "/explore?preview=map");
  });

  it("updates profile context and air-quality notification preference from the profile panel", async () => {
    const user = userEvent.setup();
    render(<Explorer />);
    await user.click(screen.getByLabelText("Buka profil lingkungan"));
    await user.click(screen.getByRole("button", { name: "Aktivitas luar ruang" }));
    expect(savePreferences).toHaveBeenCalledWith({ profileType: "Outdoor Activity", notificationPreference: false });

    const toggle = screen.getByRole("checkbox", { name: /Peringatan kualitas udara/ });
    fireEvent.click(toggle);
    expect(savePreferences).toHaveBeenLastCalledWith({ profileType: "Outdoor Activity", notificationPreference: true });
  });

  it("renders a saved location and centers the selected-location workflow on it", async () => {
    const user = userEvent.setup();
    render(<Explorer />);
    await user.click(screen.getByLabelText("Buka profil lingkungan"));
    await user.click(screen.getByRole("button", { name: "Buka favorit Rumah" }));
    expect(screen.getByRole("heading", { name: "Rumah" })).toBeTruthy();
    expect(screen.queryByText("Pengaturan personal")).toBeNull();
  });

  it("shows the live data update time and supports opening or removing a favorite", async () => {
    const user = userEvent.setup();
    liveReading = { aqi: 42, pm25: 18, pm10: 24, ozone: 31, temperature: 29, humidity: 67, wind: 8, weather: "Cerah", status: "Baik", source: "Open-Meteo", observedAt: "2026-08-24T04:20:00.000Z" };
    render(<Explorer />);
    expect(screen.getByTestId("environmental-freshness").textContent).toContain("Diperbarui");
    expect(screen.getByTestId("environmental-freshness").textContent).toContain("Open-Meteo");

    await user.click(screen.getByRole("textbox", { name: "Cari lokasi" }));
    await user.click(screen.getByRole("button", { name: "Buka favorit Rumah" }));
    expect(screen.getByRole("heading", { name: "Rumah" })).toBeTruthy();

    await user.click(screen.getByLabelText("Buka profil lingkungan"));
    await user.click(screen.getByRole("button", { name: "Hapus favorit Rumah" }));
    expect(removeSavedLocation).toHaveBeenCalledWith({ id: 1 });
    expect(savedRefetch).toHaveBeenCalled();
  });

  it("replaces the technical dashboard menu with an accessible side navigation drawer", async () => {
    const user = userEvent.setup();
    render(<Explorer />);
    expect(screen.queryByLabelText("Status data peta")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Buka menu utama" }));
    expect(screen.getByRole("dialog", { name: "Menu utama HealthAir" })).toBeTruthy();
    expect(document.body.querySelector(".section-drawer-root")?.parentElement).toBe(document.body);
    expect(screen.getByRole("link", { name: /Tren/ })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Tutup menu utama" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Menu utama HealthAir" })).toBeNull());
  });

  it("shows a visual warning when a favorite location becomes unhealthy", async () => {
    const user = userEvent.setup();
    favoriteAlerts = [{ id: 8, label: "Kantor", address: "Jakarta Pusat", latitude: -6.18, longitude: 106.82, aqi: 148, status: "Perlu perhatian" }];
    render(<Explorer />);
    expect(screen.getByRole("alert").textContent).toContain("Kantor perlu diperhatikan");
    await user.click(screen.getByRole("button", { name: "Lihat lokasi" }));
    expect(screen.getByRole("heading", { name: "Kantor" })).toBeTruthy();
  });

  it("offers a concise sharing action for the selected location", () => {
    render(<Explorer />);
    expect(screen.getByRole("button", { name: "Bagikan" })).toBeTruthy();
  });

  it("hides and restores the location and recommended-place panels without leaving both in the active map area", async () => {
    const user = userEvent.setup();
    render(<Explorer />);
    const locationPanel = screen.getByLabelText(/Ringkasan lokasi Cengkareng/);
    const placesPanel = screen.getByLabelText("Rekomendasi tempat lebih sesuai");

    await user.click(screen.getByLabelText("Sembunyikan panel lokasi"));
    expect(locationPanel.className).toContain("is-hidden");
    expect(screen.getByLabelText("Tampilkan panel Cengkareng")).toBeTruthy();

    await user.click(screen.getByLabelText("Sembunyikan rekomendasi tempat"));
    expect(placesPanel.className).toContain("is-hidden");
    expect(screen.getByLabelText("Tampilkan rekomendasi tempat")).toBeTruthy();

    await user.click(screen.getByLabelText("Tampilkan panel Cengkareng"));
    await user.click(screen.getByLabelText("Tampilkan rekomendasi tempat"));
    expect(locationPanel.className).not.toContain("is-hidden");
    expect(placesPanel.className).not.toContain("is-hidden");
    expect(locationPanel.className).toContain("panel-enter-left");
    expect(placesPanel.className).toContain("panel-enter-bottom");
  });

  it("keeps recent-search history in the foreground above the selected-location panel", async () => {
    const user = userEvent.setup();
    render(<Explorer />);
    await user.click(screen.getByRole("textbox", { name: "Cari lokasi" }));
    const popover = screen.getByText("Riwayat pencarian terbaru").parentElement?.parentElement;
    expect(popover?.className).toContain("search-popover-front");
    await user.click(screen.getByRole("button", { name: "Tutup riwayat pencarian" }));
    expect(screen.queryByText("Riwayat pencarian terbaru")).toBeNull();
  });

  it("removes individual history items and clears the entire search history", async () => {
    const user = userEvent.setup();
    render(<Explorer />);
    await user.click(screen.getByRole("textbox", { name: "Cari lokasi" }));
    await user.click(screen.getByRole("button", { name: "Hapus Cengkareng dari riwayat" }));
    expect(screen.queryByRole("button", { name: "Hapus Cengkareng dari riwayat" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Hapus Semua" }));
    expect(screen.getByText("Belum ada riwayat pencarian.")).toBeTruthy();
  });

  it("keeps manual search available when browser geolocation is not supported", async () => {
    const user = userEvent.setup();
    const originalGeolocation = navigator.geolocation;
    Object.defineProperty(navigator, "geolocation", { configurable: true, value: undefined });
    render(<Explorer />);

    await user.click(screen.getByLabelText("Gunakan lokasi saya"));
    expect(screen.getByRole("status").textContent).toContain("Browser ini tidak mendukung lokasi");
    expect(screen.getByRole("textbox", { name: "Cari lokasi" })).toBeTruthy();

    Object.defineProperty(navigator, "geolocation", { configurable: true, value: originalGeolocation });
  });

  it("updates the selected location after the map reports a successful browser location", async () => {
    const user = userEvent.setup();
    render(<Explorer />);

    await user.click(screen.getByRole("button", { name: "Simulasi lokasi berhasil" }));
    expect(screen.getByRole("heading", { name: "Lokasi perangkat" })).toBeTruthy();
    expect(screen.getByTestId("selected-location-label").textContent).toBe("Lokasi perangkat");
  });

  it("replaces a map-click placeholder with the reverse-geocoded place name", async () => {
    const user = userEvent.setup();
    render(<Explorer />);

    await user.click(screen.getByRole("button", { name: "Simulasi klik peta" }));
    expect(reverseLocationMutation).toHaveBeenCalledWith({ latitude: -6.1754, longitude: 106.8272 });
    expect(screen.getByTestId("selected-location-label").textContent).toBe("Monumen Nasional");
  });

  it("shows denied-permission guidance while preserving the manual location search", async () => {
    const user = userEvent.setup();
    render(<Explorer />);

    await user.click(screen.getByRole("button", { name: "Simulasi izin ditolak" }));
    expect(screen.getByRole("status").textContent).toContain("Izin lokasi ditolak");
    expect(screen.getByRole("textbox", { name: "Cari lokasi" })).toBeTruthy();
  });

  it("renders a prominent hazardous-air warning and category colors from live AQI and PM2.5", () => {
    liveReading = { aqi: 320, pm25: 240, pm10: 310, ozone: 40, temperature: 31, humidity: 62, wind: 7, weather: "Berkabut", status: "Perlu perhatian", source: "Open-Meteo", observedAt: "2026-08-23T04:00:00.000Z" };
    render(<Explorer />);

    expect(screen.getByRole("alert").textContent).toContain("Peringatan kondisi udara berbahaya");
    expect(screen.getAllByText("Berbahaya").length).toBeGreaterThan(0);
  });

  it("allows the user to dismiss the current air-quality warning", async () => {
    const user = userEvent.setup();
    liveReading = { aqi: 320, pm25: 240, pm10: 310, ozone: 40, temperature: 31, humidity: 62, wind: 7, weather: "Berkabut", status: "Perlu perhatian", source: "Open-Meteo", observedAt: "2026-08-23T04:00:00.000Z" };
    render(<Explorer />);

    await user.click(screen.getByLabelText("Tutup peringatan kualitas udara"));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows live location suggestions while the user types", async () => {
    const user = userEvent.setup();
    render(<Explorer />);
    const search = screen.getByRole("textbox", { name: "Cari lokasi" });
    await user.click(search);
    await user.type(search, "m");

    await waitFor(() => expect(screen.getAllByText("Monaco").length).toBeGreaterThan(0));
    expect(screen.getAllByText("Monas").length).toBeGreaterThan(0);
  });

  it("updates the selected location after clicking a one-letter typeahead suggestion", async () => {
    const user = userEvent.setup();
    render(<Explorer />);
    const search = screen.getByRole("textbox", { name: "Cari lokasi" });
    await user.click(search);
    await user.type(search, "m");

    await waitFor(() => expect(screen.getAllByRole("button", { name: /Monaco/ }).length).toBeGreaterThan(0));
    await user.click(screen.getAllByRole("button", { name: /Monaco/ })[0]!);
    expect(screen.getByRole("heading", { name: "Monaco" })).toBeTruthy();
  });

  it("shows one-time map onboarding and remembers when the user dismisses it", async () => {
    const user = userEvent.setup();
    render(<Explorer />);
    expect(screen.getByLabelText("Panduan peta untuk pengguna baru")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Mulai jelajah" }));
    expect(screen.queryByLabelText("Panduan peta untuk pengguna baru")).toBeNull();
    expect(window.localStorage.getItem("healthair-map-onboarding-v1")).toBe("seen");
  });

  it("reveals a concise reason for a recommended place and uses metric skeletons while data refreshes", async () => {
    const user = userEvent.setup();
    render(<Explorer />);
    expect(screen.getByLabelText("Memuat data AQI")).toBeTruthy();
    await user.click(screen.getAllByRole("button", { name: "Mengapa dipilih?" })[0]!);
    expect(screen.getByText(/Paparan polusi/, { selector: ".place-rationale" })).toBeTruthy();
  });

  it("renders the multi-mode lower-exposure route planner when a route is active", () => {
    window.history.pushState({}, "", "/explore?preview=map&route=1");
    render(<Explorer />);
    expect(screen.getByLabelText("Perencana rute udara lebih aman")).toBeTruthy();
    expect(screen.getByLabelText("Pilih lokasi awal rute")).toBeTruthy();
    expect(screen.getByLabelText("Ketik tujuan rute")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Jalan kaki" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Transportasi umum" })).toBeTruthy();
  });

  it("keeps a distinct valid destination when the origin changes to the current destination", async () => {
    const user = userEvent.setup();
    window.history.pushState({}, "", "/explore?preview=map&route=1");
    render(<Explorer />);
    const origin = screen.getByLabelText("Pilih lokasi awal rute") as HTMLSelectElement;
    const destinationInput = screen.getByLabelText("Ketik tujuan rute") as HTMLInputElement;
    const selectedDestination = Array.from(origin.options).find(option => option.text === "Taman Kota Cengkareng")?.value;

    await user.selectOptions(origin, selectedDestination!);

    expect(origin.value).toBe(selectedDestination);
    expect(destinationInput.placeholder).toBe("Cengkareng");
    expect(screen.getByText(/Taman Kota Cengkareng ke Cengkareng/)).toBeTruthy();
  });

  it("lets a user type and select a custom destination for a road route", async () => {
    const user = userEvent.setup();
    window.history.pushState({}, "", "/explore?preview=map&route=1");
    render(<Explorer />);

    await user.type(screen.getByLabelText("Ketik tujuan rute"), "m");
    await waitFor(() => expect(screen.getByRole("option", { name: /Monas/ })).toBeTruthy());
    await user.click(screen.getByRole("option", { name: /Monas/ }));

    expect(screen.getByText(/Cengkareng ke Monas/)).toBeTruthy();
    expect(screen.getByText("Tujuan aktif: Monas")).toBeTruthy();
  });

  it("starts a dedicated route-navigation view from the selected road route", async () => {
    const user = userEvent.setup();
    roadRouteData = { coordinates: [[106.7337, -6.1425], [106.7368, -6.1483]], distanceMeters: 1081, durationSeconds: 906, summary: "Jl. Fajar Baru Selatan", provider: "Google Maps", steps: [{ instruction: "Belok kanan ke Jl. Fajar Baru Selatan", distanceMeters: 180, durationSeconds: 80, start: [106.7337, -6.1425], end: [106.7368, -6.1483], travelMode: "WALKING" }], transit: null, options: [{ distanceMeters: 1081, durationSeconds: 906, summary: "Jl. Fajar Baru Selatan" }] };
    window.history.pushState({}, "", "/explore?preview=map&route=1");
    render(<Explorer />);

    await user.click(screen.getByRole("button", { name: "Mulai navigasi" }));
    expect(screen.getByLabelText("Navigasi rute aktif")).toBeTruthy();
    expect(screen.getByText("Belok kanan ke Jl. Fajar Baru Selatan")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Selesai" }));
    expect(screen.queryByLabelText("Navigasi rute aktif")).toBeNull();
  });

  it("opens HealthAir AI and sends the current location context with a user question", async () => {
    const user = userEvent.setup();
    render(<Explorer />);
    await user.click(screen.getByLabelText("Buka asisten AI"));
    expect(screen.getByLabelText("Asisten AI HealthAir")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Kirim pertanyaan AI" }));

    expect(sendAssistantMessage).toHaveBeenCalledWith(expect.objectContaining({
      messages: [{ role: "user", content: "Apa arti AQI saat ini?" }],
      context: expect.objectContaining({ location: "Cengkareng, Jakarta Barat", aqi: expect.any(Number), pm25: expect.any(Number) }),
    }));
    expect(screen.getByText("Respons AI HealthAir")).toBeTruthy();
  });

  it("opens Puffy from the mobile app navigation event", async () => {
    render(<Explorer />);
    window.dispatchEvent(new Event("healthair-open-puffy"));

    expect(await screen.findByLabelText("Asisten AI HealthAir")).toBeTruthy();
    expect(screen.getByText("Puffy")).toBeTruthy();
  });
});
