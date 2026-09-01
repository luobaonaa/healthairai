import { useAuth } from "@/_core/hooks/useAuth";
import ExploreSectionNav from "@/components/ExploreSectionNav";
import HealthAirLogo from "@/components/HealthAirLogo";
import { trpc } from "@/lib/trpc";
import {
  getAqiCategory,
  selectSavedLocation,
  type LocationSelection,
} from "@/lib/environment";
import {
  Activity,
  ArrowUpRight,
  ChartNoAxesCombined,
  Clock3,
  MapPin,
} from "lucide-react";
import React from "react";
import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Link } from "wouter";

const defaultLocation: LocationSelection = {
  name: "Cengkareng",
  caption: "Jakarta Barat",
  lat: -6.1425,
  lng: 106.7337,
  kind: "user",
};

function hourLabel(value: string) {
  return value.slice(11, 16);
}

export default function Trends() {
  const { isAuthenticated } = useAuth();
  const [selectedLocation, setSelectedLocation] =
    useState<LocationSelection>(defaultLocation);
  const favoritesQuery = trpc.environmental.savedLocations.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const queryInput = useMemo(
    () => ({ latitude: selectedLocation.lat, longitude: selectedLocation.lng }),
    [selectedLocation.lat, selectedLocation.lng]
  );
  const trendQuery = trpc.environmental.aqiTrend.useQuery(queryInput, {
    refetchInterval: 300000,
    refetchOnWindowFocus: true,
    retry: 1,
  });
  const points = trendQuery.data ?? [];
  const latest = points.at(-1);
  const peak = points.reduce(
    (highest, point) => (point.aqi > highest.aqi ? point : highest),
    points[0] ?? { aqi: 0, pm25: 0, time: "" }
  );
  const category = getAqiCategory(latest?.aqi ?? 0);

  return (
    <main className="section-page trend-page">
      <header className="section-header">
        <Link href="/" className="section-brand">
          <span>
              <HealthAirLogo />
          </span>
          HealthAir AI
        </Link>
        <ExploreSectionNav />
        <Link href="/explore" className="section-map-link">
          Buka peta <ArrowUpRight size={14} />
        </Link>
      </header>
      <section className="section-hero">
        <div>
          <span className="section-kicker">
            <ChartNoAxesCombined size={14} /> Tren lingkungan
          </span>
          <h1>AQI, dilihat sebagai perjalanan satu hari.</h1>
          <p>
            Grafik ini memakai pembacaan per jam dari sumber kualitas udara
            untuk membantu Anda mengenali pola, bukan hanya satu angka saat ini.
          </p>
        </div>
        <div className={`trend-current category-${category.tone}`}>
          <small>Pembacaan terbaru</small>
          <strong>{latest?.aqi ?? "—"}</strong>
          <span>{latest ? `AQI · ${category.label}` : "Menunggu data"}</span>
        </div>
      </section>
      <section className="trend-layout">
        <article className="trend-chart-card">
          <div className="trend-card-heading">
            <div>
              <span className="section-kicker">
                <Activity size={13} /> AQI per jam
              </span>
              <h2>{selectedLocation.name}</h2>
              <p>
                <Clock3 size={12} /> 24 jam terakhir · waktu lokal lokasi
              </p>
            </div>
            {isAuthenticated && (favoritesQuery.data?.length ?? 0) > 0 && (
              <label className="trend-location-select">
                <MapPin size={13} />
                <select
                  value={`${selectedLocation.lat},${selectedLocation.lng}`}
                  onChange={event => {
                    const match = favoritesQuery.data?.find(
                      item =>
                        `${item.latitude},${item.longitude}` ===
                        event.target.value
                    );
                    if (match) setSelectedLocation(selectSavedLocation(match));
                  }}
                >
                  <option
                    value={`${defaultLocation.lat},${defaultLocation.lng}`}
                  >
                    Cengkareng
                  </option>
                  {favoritesQuery.data?.map(item => (
                    <option
                      key={item.id}
                      value={`${item.latitude},${item.longitude}`}
                    >
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          {trendQuery.isLoading ? (
            <div className="trend-empty">Memuat pembacaan AQI per jam…</div>
          ) : points.length ? (
            <div className="trend-chart-wrap">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={points}
                  margin={{ top: 12, right: 4, left: -22, bottom: 0 }}
                >
                  <defs>
                    <linearGradient
                      id="aqiTrendFill"
                      x1="0"
                      x2="0"
                      y1="0"
                      y2="1"
                    >
                      <stop
                        offset="0%"
                        stopColor="#48a8c8"
                        stopOpacity={0.38}
                      />
                      <stop
                        offset="100%"
                        stopColor="#48a8c8"
                        stopOpacity={0.02}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#dbecef" vertical={false} />
                  <XAxis
                    dataKey="time"
                    tickFormatter={hourLabel}
                    interval="preserveStartEnd"
                    minTickGap={30}
                    tick={{ fill: "#77919a", fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    domain={[0, "auto"]}
                    tick={{ fill: "#77919a", fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    labelFormatter={value =>
                      `Pukul ${hourLabel(String(value))}`
                    }
                    formatter={(value: number, name: string) => [
                      name === "aqi" ? value : `${value} µg/m³`,
                      name === "aqi" ? "AQI" : "PM2.5",
                    ]}
                    contentStyle={{
                      borderRadius: 12,
                      border: "1px solid #d8eaed",
                      boxShadow: "0 12px 24px rgba(35,91,108,.12)",
                    }}
                  />
                  <ReferenceLine
                    y={100}
                    stroke="#d69062"
                    strokeDasharray="4 4"
                  />
                  <Area
                    type="monotone"
                    dataKey="aqi"
                    stroke="#368db3"
                    strokeWidth={3}
                    fill="url(#aqiTrendFill)"
                  />
                  <Area
                    type="monotone"
                    dataKey="pm25"
                    stroke="#67b9a2"
                    strokeWidth={2}
                    fill="transparent"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="trend-empty">
              Riwayat AQI belum dapat dimuat. Coba perbarui beberapa saat lagi.
            </div>
          )}
        </article>
        <aside className="trend-insight-card">
          <span className="section-kicker">
            <Activity size={13} /> Ringkasan
          </span>
          <div>
            <small>Puncak dalam 24 jam</small>
            <strong>{peak.aqi || "—"}</strong>
            <span>
              {peak.time ? `Sekitar ${hourLabel(peak.time)}` : "Belum tersedia"}
            </span>
          </div>
          <div>
            <small>PM2.5 terakhir</small>
            <strong>{latest?.pm25 ?? "—"}</strong>
            <span>μg/m³</span>
          </div>
          <p>
            Garis putus-putus menunjukkan AQI 100, ambang ketika kualitas udara
            mulai perlu lebih diperhatikan.
          </p>
        </aside>
      </section>
      <section className="section-source-note">
        Sumber tren: Open-Meteo Air Quality, pembaruan per jam.{" "}
        <Link href="/information">
          Pelajari cara membaca AQI <ArrowUpRight size={12} />
        </Link>
      </section>
    </main>
  );
}
