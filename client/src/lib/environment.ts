export type EnvironmentalProfile =
  | "General"
  | "Respiratory Sensitive"
  | "Older Adult"
  | "Child"
  | "Outdoor Activity";

export type LocationSelection = {
  name: string;
  caption: string;
  lat: number;
  lng: number;
  kind?: "user" | "place" | "search";
};

export type EnvironmentalReading = {
  aqi: number;
  pm25: number;
  temperature: number;
  humidity: number;
  wind: number;
  weather: string;
  status: "Baik" | "Sedang" | "Perlu perhatian";
  trend: "Membaik" | "Stabil" | "Perlu dipantau";
  score: number;
};

export type AirCategory = {
  label: string;
  tone: "good" | "moderate" | "sensitive" | "unhealthy" | "very-unhealthy" | "hazardous";
  description: string;
};

export type TravelMode = "walk" | "motor" | "car" | "transit";

export const travelModeOptions: Array<{ id: TravelMode; label: string; speedKmh: number; exposureMultiplier: number; transferMinutes: number }> = [
  { id: "walk", label: "Jalan kaki", speedKmh: 4.8, exposureMultiplier: 1, transferMinutes: 0 },
  { id: "motor", label: "Motor", speedKmh: 24, exposureMultiplier: .91, transferMinutes: 2 },
  { id: "car", label: "Mobil", speedKmh: 21, exposureMultiplier: .66, transferMinutes: 3 },
  { id: "transit", label: "Transportasi umum", speedKmh: 18, exposureMultiplier: .78, transferMinutes: 8 },
];

export type AirRiskWarning = {
  severity: "sensitive" | "unhealthy" | "very-unhealthy" | "hazardous";
  title: string;
  message: string;
};

export const profileLabels: Record<EnvironmentalProfile, string> = {
  General: "Umum",
  "Respiratory Sensitive": "Sensitif pernapasan",
  "Older Adult": "Lansia",
  Child: "Anak-anak",
  "Outdoor Activity": "Aktivitas luar ruang",
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export function getAqiCategory(aqi: number): AirCategory {
  if (aqi <= 50) return { label: "Baik", tone: "good", description: "Risiko polusi rendah." };
  if (aqi <= 100) return { label: "Sedang", tone: "moderate", description: "Umumnya dapat diterima; sebagian orang sensitif perlu memperhatikan kondisi." };
  if (aqi <= 150) return { label: "Tidak sehat bagi kelompok sensitif", tone: "sensitive", description: "Anak-anak, lansia, dan orang sensitif pernapasan perlu mengurangi paparan." };
  if (aqi <= 200) return { label: "Tidak sehat", tone: "unhealthy", description: "Kurangi aktivitas luar ruang yang lama atau berat." };
  if (aqi <= 300) return { label: "Sangat tidak sehat", tone: "very-unhealthy", description: "Peringatan kesehatan untuk semua orang; batasi paparan luar ruang." };
  return { label: "Berbahaya", tone: "hazardous", description: "Kondisi berisiko tinggi; hindari paparan luar ruang bila memungkinkan." };
}

export function getPm25Category(pm25: number): AirCategory {
  if (pm25 <= 9) return { label: "Baik", tone: "good", description: "Partikel halus berada pada kategori rendah." };
  if (pm25 <= 35.4) return { label: "Sedang", tone: "moderate", description: "Partikel halus perlu diperhatikan oleh kelompok sensitif." };
  if (pm25 <= 55.4) return { label: "Tidak sehat bagi kelompok sensitif", tone: "sensitive", description: "Kelompok sensitif sebaiknya membatasi paparan." };
  if (pm25 <= 125.4) return { label: "Tidak sehat", tone: "unhealthy", description: "Paparan partikel halus dapat memengaruhi lebih banyak orang." };
  if (pm25 <= 225.4) return { label: "Sangat tidak sehat", tone: "very-unhealthy", description: "Batasi aktivitas luar ruang dan pantau kondisi." };
  return { label: "Berbahaya", tone: "hazardous", description: "Partikel halus sangat tinggi; hindari paparan luar ruang bila memungkinkan." };
}

export function getAirRiskWarning(reading: Pick<EnvironmentalReading, "aqi" | "pm25">): AirRiskWarning | null {
  const aqi = getAqiCategory(reading.aqi);
  const pm25 = getPm25Category(reading.pm25);
  const toneOrder = { good: 0, moderate: 0, sensitive: 1, unhealthy: 2, "very-unhealthy": 3, hazardous: 4 } as const;
  const riskTone = toneOrder[aqi.tone] >= toneOrder[pm25.tone] ? aqi.tone : pm25.tone;
  if (riskTone === "good" || riskTone === "moderate") return null;
  if (riskTone === "sensitive") return { severity: "sensitive", title: "Perhatian untuk kelompok sensitif", message: "Anak-anak, lansia, dan orang yang sensitif terhadap polusi sebaiknya mengurangi aktivitas luar ruang yang lama dan memantau pembaruan kondisi." };
  if (riskTone === "unhealthy") return { severity: "unhealthy", title: "Peringatan kualitas udara", message: "Kondisi udara tidak sehat. Kurangi aktivitas luar ruang yang lama atau berat, terutama di dekat sumber asap dan lalu lintas." };
  if (riskTone === "very-unhealthy") return { severity: "very-unhealthy", title: "Peringatan kualitas udara tinggi", message: "Kondisi sangat tidak sehat. Sebaiknya batasi aktivitas luar ruang, tutup ventilasi yang mengarah ke sumber asap bila aman, dan pantau pembaruan kondisi." };
  return { severity: "hazardous", title: "Peringatan kondisi udara berbahaya", message: "Polusi atau asap berada pada tingkat berbahaya. Hindari aktivitas luar ruang bila memungkinkan, pindah ke ruang berudara lebih bersih, dan ikuti arahan resmi setempat. Jika muncul gejala berat atau keadaan darurat, cari bantuan medis segera." };
}

export function getEnvironmentalReading(location: LocationSelection): EnvironmentalReading {
  const latitudeVariation = Math.abs(Math.round(location.lat * 100)) % 13;
  const longitudeVariation = Math.abs(Math.round(location.lng * 100)) % 11;
  const isGreenPlace = /taman|hutan|park|lapangan|hijau/i.test(location.name);
  const aqi = clamp(42 + latitudeVariation - longitudeVariation - (isGreenPlace ? 11 : 0), 24, 92);
  const pm25 = clamp(18 + Math.round(latitudeVariation * 0.8) - (isGreenPlace ? 5 : 0), 8, 43);
  const temperature = 28 + (longitudeVariation % 3);
  const humidity = clamp(72 - latitudeVariation + (isGreenPlace ? 4 : 0), 58, 84);
  const wind = clamp(8 + (longitudeVariation % 5), 4, 16);
  const score = clamp(Math.round(100 - aqi * 0.48 - pm25 * 0.45 + wind * 1.1 + (isGreenPlace ? 9 : 0)), 42, 96);
  const status = aqi <= 50 ? "Baik" : aqi <= 75 ? "Sedang" : "Perlu perhatian";
  return { aqi, pm25, temperature, humidity, wind, weather: humidity > 76 ? "Berawan tipis" : "Cerah berawan", status, trend: aqi <= 50 ? "Membaik" : aqi <= 70 ? "Stabil" : "Perlu dipantau", score };
}

export function getEnvironmentalInsight(reading: EnvironmentalReading, profile: EnvironmentalProfile): string {
  const aqiTone = getAqiCategory(reading.aqi).tone;
  const pm25Tone = getPm25Category(reading.pm25).tone;
  const toneOrder = { good: 0, moderate: 1, sensitive: 2, unhealthy: 3, "very-unhealthy": 4, hazardous: 5 } as const;
  const riskTone = toneOrder[aqiTone] >= toneOrder[pm25Tone] ? aqiTone : pm25Tone;
  const condition = riskTone === "hazardous"
    ? "Kondisi udara berbahaya. Hindari aktivitas luar ruang bila memungkinkan dan kurangi paparan asap atau polusi."
    : riskTone === "very-unhealthy"
      ? "Kondisi udara sangat tidak sehat. Sebaiknya batasi aktivitas luar ruang dan pantau pembaruan kondisi."
      : riskTone === "unhealthy"
        ? "Kondisi udara tidak sehat. Kurangi aktivitas luar ruang yang lama atau berat, terutama di dekat sumber asap dan lalu lintas."
        : riskTone === "sensitive"
          ? "Kondisi udara tidak sehat bagi kelompok sensitif. Anak-anak, lansia, dan orang sensitif pernapasan sebaiknya mengurangi paparan luar ruang."
          : riskTone === "moderate"
            ? "Kondisi udara sedang. Aktivitas ringan umumnya dapat dilakukan, tetapi kelompok sensitif perlu memperhatikan perubahan kondisi."
            : "Kondisi udara saat ini cukup baik untuk aktivitas luar ruang ringan.";
  if (profile === "Respiratory Sensitive") return `${condition} Untuk konteks sensitif pernapasan, pertimbangkan aktivitas lebih singkat bila partikulat meningkat.`;
  if (profile === "Older Adult" || profile === "Child") return `${condition} Untuk kelompok yang membutuhkan perhatian ekstra, pilih area yang lebih hijau dan kurangi paparan dekat lalu lintas.`;
  if (profile === "Outdoor Activity") return `${condition} Angin ${reading.wind} km/jam membantu sirkulasi, tetapi tidak meniadakan risiko polusi; sesuaikan durasi aktivitas dengan kondisi saat ini.`;
  return `${condition} Kondisi dapat berubah seiring angin dan aktivitas di sekitar lokasi.`;
}

export function getRouteGuidance(origin: LocationSelection, destination: LocationSelection) {
  const originReading = getEnvironmentalReading(origin);
  const destinationReading = getEnvironmentalReading(destination);
  const latitudeKm = (destination.lat - origin.lat) * 111;
  const longitudeKm = (destination.lng - origin.lng) * 111 * Math.cos(((origin.lat + destination.lat) / 2) * Math.PI / 180);
  const distance = Math.sqrt(latitudeKm ** 2 + longitudeKm ** 2);
  const improvement = destinationReading.score - originReading.score;
  const pollutionLabel = destinationReading.aqi <= 50 ? "Paparan polusi rendah" : destinationReading.aqi <= 70 ? "Paparan polusi sedang" : "Paparan perlu dipantau";
  return {
    distanceLabel: `${distance.toFixed(1).replace(".", ",")} km`,
    distanceKm: Number(distance.toFixed(1)),
    qualifier: improvement >= 5 ? `Tujuan diperkirakan memiliki skor lingkungan ${improvement} poin lebih baik.` : "Kondisi lingkungan di tujuan diperkirakan serupa dengan titik awal.",
    score: destinationReading.score,
    routePriority: Math.round(destinationReading.score - distance * 8),
    pollutionLabel,
    temperature: destinationReading.temperature,
    weather: destinationReading.weather,
  };
}

export function getLowExposureRoute(origin: LocationSelection, destination: LocationSelection, mode: TravelMode) {
  const guidance = getRouteGuidance(origin, destination);
  const preference = travelModeOptions.find(option => option.id === mode) ?? travelModeOptions[0];
  const originReading = getEnvironmentalReading(origin);
  const destinationReading = getEnvironmentalReading(destination);
  const distanceFactor = mode === "walk" ? 1.04 : mode === "transit" ? 1.1 : 1.07;
  const corridorDistanceKm = Number((guidance.distanceKm * distanceFactor).toFixed(1));
  const baseExposure = originReading.aqi * .45 + destinationReading.aqi * .55;
  const greenDestinationBenefit = destinationReading.score > originReading.score ? 3 : 0;
  const estimatedExposureAqi = Math.max(1, Math.round(baseExposure * preference.exposureMultiplier - greenDestinationBenefit));
  const estimatedMinutes = Math.max(1, Math.round(corridorDistanceKm / preference.speedKmh * 60 + preference.transferMinutes));
  const exposureLabel = estimatedExposureAqi <= 50 ? "Paparan diperkirakan rendah" : estimatedExposureAqi <= 100 ? "Paparan diperkirakan sedang" : "Paparan perlu diwaspadai";
  return {
    ...guidance,
    mode,
    modeLabel: preference.label,
    distanceKm: corridorDistanceKm,
    distanceLabel: `${corridorDistanceKm.toFixed(1).replace(".", ",")} km`,
    estimatedExposureAqi,
    estimatedMinutes,
    exposureLabel,
    summary: `${preference.label} dipilih dengan koridor yang menyeimbangkan jarak dan estimasi paparan. ${exposureLabel.toLowerCase()} sepanjang perjalanan.`,
    disclaimer: "Jalur dan paparan adalah estimasi berbasis jarak serta kondisi lingkungan di titik awal dan tujuan; periksa situasi jalan sebelum berangkat.",
  };
}

export type NavigationStep = { instruction: string; distanceMeters: number; durationSeconds: number; start: [number, number]; end: [number, number]; travelMode: string };
export type RouteNavigationProgress = { remainingMeters: number; nextStepIndex: number; distanceToInstructionMeters: number; offRouteMeters: number };

export function formatNavigationDistance(meters: number) {
  if (meters < 1000) return `${Math.max(10, Math.round(meters / 10) * 10)} m`;
  return `${(meters / 1000).toFixed(1).replace(".", ",")} km`;
}

function metersBetween(first: [number, number], second: [number, number]) {
  const latitudeRadians = ((first[1] + second[1]) / 2) * Math.PI / 180;
  const x = (second[0] - first[0]) * 111_320 * Math.cos(latitudeRadians);
  const y = (second[1] - first[1]) * 110_540;
  return Math.sqrt(x ** 2 + y ** 2);
}

export function getRouteNavigationProgress(coordinates: Array<[number, number]>, steps: NavigationStep[], current: [number, number]): RouteNavigationProgress | null {
  if (coordinates.length < 2) return null;
  let totalMeters = 0;
  let closestDistance = Infinity;
  let completedMeters = 0;
  let accumulatedMeters = 0;
  for (let index = 0; index < coordinates.length - 1; index += 1) {
    const start = coordinates[index];
    const end = coordinates[index + 1];
    const segmentMeters = metersBetween(start, end);
    totalMeters += segmentMeters;
    const latitudeRadians = ((start[1] + end[1] + current[1]) / 3) * Math.PI / 180;
    const scaleX = 111_320 * Math.cos(latitudeRadians);
    const scaleY = 110_540;
    const segmentX = (end[0] - start[0]) * scaleX;
    const segmentY = (end[1] - start[1]) * scaleY;
    const currentX = (current[0] - start[0]) * scaleX;
    const currentY = (current[1] - start[1]) * scaleY;
    const projection = Math.max(0, Math.min(1, (currentX * segmentX + currentY * segmentY) / Math.max(1, segmentX ** 2 + segmentY ** 2)));
    const projected: [number, number] = [start[0] + (end[0] - start[0]) * projection, start[1] + (end[1] - start[1]) * projection];
    const distanceToSegment = metersBetween(current, projected);
    if (distanceToSegment < closestDistance) {
      closestDistance = distanceToSegment;
      completedMeters = accumulatedMeters + segmentMeters * projection;
    }
    accumulatedMeters += segmentMeters;
  }
  let stepDistance = 0;
  let nextStepIndex = Math.max(0, steps.length - 1);
  for (let index = 0; index < steps.length; index += 1) {
    stepDistance += steps[index].distanceMeters;
    if (completedMeters < stepDistance) { nextStepIndex = index; break; }
  }
  const priorStepDistance = steps.slice(0, nextStepIndex).reduce((total, step) => total + step.distanceMeters, 0);
  return { remainingMeters: Math.max(0, totalMeters - completedMeters), nextStepIndex, distanceToInstructionMeters: Math.max(0, priorStepDistance + (steps[nextStepIndex]?.distanceMeters ?? 0) - completedMeters), offRouteMeters: Math.round(closestDistance) };
}

export function estimateRouteExposure(points: Array<{ lat: number; lng: number }>, baselineAqi: number) {
  if (points.length === 0) return baselineAqi;
  const variation = points.reduce((total, point) => total + ((Math.abs(Math.round(point.lat * 1000)) + Math.abs(Math.round(point.lng * 1000))) % 9) - 4, 0) / points.length;
  return clamp(Math.round(baselineAqi + variation), 1, 300);
}

export function sampleRouteCoordinates(coordinates: Array<[number, number]>, limit = 8) {
  if (coordinates.length <= limit) return coordinates.map(([longitude, latitude]) => ({ latitude, longitude }));
  const indexes = Array.from({ length: limit }, (_, index) => Math.round(index * (coordinates.length - 1) / (limit - 1)));
  return indexes.map(index => ({ latitude: coordinates[index][1], longitude: coordinates[index][0] }));
}

export function getDataFreshness(fetchedAt: string | undefined, cached: boolean, now = Date.now()) {
  if (!fetchedAt) return { state: "unknown" as const, label: "Waktu pengambilan tidak tersedia", ageMinutes: null };
  const timestamp = new Date(fetchedAt).getTime();
  if (!Number.isFinite(timestamp)) return { state: "unknown" as const, label: "Waktu pengambilan tidak valid", ageMinutes: null };
  const ageMinutes = Math.max(0, Math.round((now - timestamp) / 60_000));
  if (cached || ageMinutes > 30) return { state: "stale" as const, label: `Data terakhir · ${ageMinutes} menit lalu`, ageMinutes };
  if (ageMinutes > 10) return { state: "aging" as const, label: `Diambil ${ageMinutes} menit lalu`, ageMinutes };
  return { state: "fresh" as const, label: ageMinutes <= 1 ? "Baru diperbarui" : `Diambil ${ageMinutes} menit lalu`, ageMinutes };
}

export function updateRecentLocations(history: LocationSelection[], selection: LocationSelection, limit = 4) {
  return [selection, ...history.filter(item => item.name !== selection.name)].slice(0, limit);
}

export function chooseHealthierLocation(first: LocationSelection, second: LocationSelection) {
  return getEnvironmentalReading(first).score >= getEnvironmentalReading(second).score ? first : second;
}

export function buildPreferenceUpdate(profileType: EnvironmentalProfile, notificationPreference: boolean) {
  return { profileType, notificationPreference };
}

export function selectSavedLocation(saved: { label: string; address: string; latitude: number; longitude: number; }): LocationSelection {
  return { name: saved.label, caption: saved.address, lat: saved.latitude, lng: saved.longitude, kind: "place" };
}

export function getSurroundingConditions(origin: LocationSelection) {
  const zones = [
    { name: "Koridor barat", caption: "Angin menuju barat", deltaLat: .006, deltaLng: -.011 },
    { name: "Area selatan", caption: "Dekat aktivitas jalan", deltaLat: -.009, deltaLng: .004 },
    { name: "Ruang hijau timur", caption: "Sirkulasi lebih terbuka", deltaLat: .004, deltaLng: .012 },
  ];
  return zones.map(zone => {
    const location: LocationSelection = { name: zone.name, caption: zone.caption, lat: origin.lat + zone.deltaLat, lng: origin.lng + zone.deltaLng, kind: "place" };
    return { ...zone, location, reading: getEnvironmentalReading(location) };
  });
}

export const nearbyPlaces: LocationSelection[] = [
  { name: "Taman Kota Cengkareng", caption: "1,2 km · Ruang hijau", lat: -6.1483, lng: 106.7368, kind: "place" },
  { name: "Jalur Hijau Daan Mogot", caption: "0,8 km · Koridor teduh", lat: -6.1589, lng: 106.7389, kind: "place" },
  { name: "Lapangan Puri Indah", caption: "2,1 km · Area terbuka", lat: -6.1866, lng: 106.7386, kind: "place" },
];
