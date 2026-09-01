export type EnvironmentalSignal = { aqi: number; pm25: number; wind: number; greenery: number; traffic: number; };

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export function calculateEnvironmentalScore(signal: EnvironmentalSignal) {
  return clamp(Math.round(100 - signal.aqi * .42 - signal.pm25 * .5 + signal.wind * .8 + signal.greenery * .22 - signal.traffic * .16), 0, 100);
}

export function buildEnvironmentalInsight(signal: EnvironmentalSignal, profile: "General" | "Respiratory Sensitive" | "Older Adult" | "Child" | "Outdoor Activity") {
  const base = signal.aqi > 300 || signal.pm25 > 225.4
    ? "Kondisi udara berbahaya. Hindari aktivitas luar ruang bila memungkinkan dan kurangi paparan asap atau polusi."
    : signal.aqi > 200 || signal.pm25 > 125.4
      ? "Kondisi udara sangat tidak sehat. Sebaiknya batasi aktivitas luar ruang dan pantau pembaruan kondisi."
      : signal.aqi > 150 || signal.pm25 > 55.4
        ? "Kondisi udara tidak sehat. Kurangi aktivitas luar ruang yang lama atau berat, terutama di dekat sumber asap dan lalu lintas."
        : signal.aqi > 100 || signal.pm25 > 35.4
          ? "Kondisi udara tidak sehat bagi kelompok sensitif. Anak-anak, lansia, dan orang sensitif pernapasan sebaiknya mengurangi paparan luar ruang."
          : signal.aqi > 50 || signal.pm25 > 9
            ? "Kondisi udara sedang. Aktivitas ringan umumnya dapat dilakukan, tetapi kelompok sensitif perlu memperhatikan perubahan kondisi."
            : "Kondisi udara saat ini cukup baik untuk aktivitas luar ruang ringan.";
  if (profile === "Respiratory Sensitive") return `${base} Untuk konteks sensitif pernapasan, pertimbangkan mengurangi durasi aktivitas bila partikulat meningkat.`;
  if (profile === "Outdoor Activity") return `${base} Periksa kembali kondisi sebelum aktivitas dengan durasi lebih panjang.`;
  return `${base} Pilih area yang lebih hijau bila Anda ingin mengurangi paparan lalu lintas.`;
}
