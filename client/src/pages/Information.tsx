import ExploreSectionNav from "@/components/ExploreSectionNav";
import HealthAirLogo from "@/components/HealthAirLogo";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  ExternalLink,
  HeartPulse,
  Info,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Wind,
} from "lucide-react";
import React from "react";
import { Link } from "wouter";

const categories = [
  { range: "0–50", label: "Baik", copy: "Udara umumnya memadai untuk aktivitas luar ruang bagi kebanyakan orang.", tone: "good", icon: CheckCircle2 },
  { range: "51–100", label: "Sedang", copy: "Masih dapat diterima, tetapi orang yang sangat sensitif perlu memperhatikan gejala.", tone: "moderate", icon: Info },
  { range: "101–150", label: "Tidak sehat bagi kelompok sensitif", copy: "Anak-anak, lansia, ibu hamil, dan orang dengan penyakit jantung atau paru perlu mengurangi paparan lama.", tone: "sensitive", icon: HeartPulse },
  { range: "151–200", label: "Tidak sehat", copy: "Sebagian orang dapat merasakan dampak; batasi aktivitas berat dan lama di luar ruang.", tone: "unhealthy", icon: AlertTriangle },
  { range: "201–300", label: "Sangat tidak sehat", copy: "Risiko dampak kesehatan meningkat untuk semua orang. Kurangi paparan luar ruang secara nyata.", tone: "very-unhealthy", icon: ShieldAlert },
  { range: "301+", label: "Berbahaya", copy: "Kondisi darurat kesehatan. Hindari paparan luar ruang dan ikuti arahan otoritas setempat.", tone: "hazardous", icon: AlertTriangle },
];

const pollutants = [
  { name: "PM2.5", detail: "Partikel sangat kecil berdiameter 2,5 mikrometer atau kurang. Partikel ini dapat masuk jauh ke paru-paru dan aliran darah." },
  { name: "PM10", detail: "Partikel berdiameter 10 mikrometer atau kurang, termasuk debu dan partikel dari jalan, konstruksi, atau pembakaran." },
  { name: "Ozon permukaan", detail: "Berbeda dari lapisan ozon di atmosfer atas. Ozon dekat permukaan terbentuk dari reaksi polutan dengan sinar matahari." },
];

const references = [
  { title: "WHO — Ambient (outdoor) air pollution", copy: "Ringkasan dampak kesehatan dan jenis polutan udara luar ruang.", href: "https://www.who.int/news-room/fact-sheets/detail/ambient-%28outdoor%29-air-quality-and-health" },
  { title: "AirNow / U.S. EPA — AQI Basics", copy: "Definisi enam kategori AQI dan tingkat perhatian kesehatannya.", href: "https://www.airnow.gov/aqi/aqi-basics/" },
  { title: "Open-Meteo — Air Quality API", copy: "Dokumentasi variabel, metode AQI, sumber CAMS, resolusi, dan pembaruan model.", href: "https://open-meteo.com/en/docs/air-quality-api" },
];

export default function Information() {
  return (
    <main className="section-page information-page">
      <header className="section-header">
        <Link href="/" className="section-brand"><span><HealthAirLogo /></span>HealthAir AI</Link>
        <ExploreSectionNav />
        <Link href="/explore" className="section-map-link">Buka peta <ArrowUpRight size={14} /></Link>
      </header>

      <section className="section-hero information-hero">
        <div>
          <span className="section-kicker"><Info size={14} /> Panduan kualitas udara</span>
          <h1>Pahami angkanya, lalu tentukan langkah yang lebih aman.</h1>
          <p>HealthAir membantu membaca AQI, PM2.5, cuaca, dan konteks lokasi. Informasi ini adalah panduan lingkungan, bukan diagnosis atau pengganti saran tenaga medis.</p>
        </div>
        <ShieldCheck className="information-hero-icon" />
      </section>

      <section className="information-section" aria-labelledby="aqi-heading">
        <div className="information-section-heading">
          <span>01 · Skala AQI</span>
          <h2 id="aqi-heading">Semakin tinggi angka, semakin besar perhatian kesehatannya.</h2>
          <p>HealthAir menampilkan kategori U.S. AQI agar tingkat risiko mudah dibandingkan.</p>
        </div>
        <div className="aqi-category-grid">
          {categories.map(({ range, label, copy, tone, icon: Icon }) => (
            <article key={label} className={`aqi-category-card ${tone}`}>
              <Icon size={19} /><small>AQI {range}</small><h3>{label}</h3><p>{copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="information-section" aria-labelledby="pollutant-heading">
        <div className="information-section-heading">
          <span>02 · Polutan utama</span>
          <h2 id="pollutant-heading">AQI merangkum beberapa polutan, bukan satu jenis udara.</h2>
        </div>
        <div className="information-detail-grid pollutant-grid">
          {pollutants.map(item => (
            <article key={item.name}><Wind size={18} /><h3>{item.name}</h3><p>{item.detail}</p></article>
          ))}
        </div>
      </section>

      <section className="puffy-information-card" aria-labelledby="puffy-heading">
        <div className="puffy-information-copy">
          <span className="section-kicker"><Sparkles size={14} /> Kenalan dengan Puffy</span>
          <h2 id="puffy-heading">Puffy menerjemahkan data menjadi langkah yang mudah dipahami.</h2>
          <p>Puffy adalah maskot sekaligus asisten AI HealthAir. Saat kondisi udara memburuk, Puffy dapat muncul secara proaktif, menjelaskan risikonya, dan membantu menyesuaikan aktivitas dengan lokasi serta profil yang dipilih.</p>
          <ul>
            <li><Activity size={15} /> Menjelaskan kondisi dan saran aktivitas dengan bahasa sederhana.</li>
            <li><Clock3 size={15} /> Mengingatkan bahwa data model memiliki waktu pembaruan.</li>
            <li><ShieldCheck size={15} /> Membedakan panduan lingkungan dari diagnosis medis.</li>
          </ul>
          <Link href="/explore" className="puffy-information-link">Tanya Puffy di peta <ArrowUpRight size={14} /></Link>
        </div>
        <img src="/assets/puffy-flying-transparent.png" alt="Puffy, maskot HealthAir, sedang terbang" className="puffy-information-image" />
      </section>

      <section className="information-section" aria-labelledby="accuracy-heading">
        <div className="information-section-heading">
          <span>03 · Cara memakai data</span>
          <h2 id="accuracy-heading">Periksa waktu, lokasi, dan keterbatasan sebelum mengambil keputusan.</h2>
        </div>
        <div className="information-detail-grid">
          <article><Clock3 size={18} /><h3>Mengapa waktu pembaruan penting?</h3><p>Angin, emisi, dan cuaca dapat mengubah kondisi. Selalu lihat waktu model terakhir sebelum merencanakan aktivitas.</p></article>
          <article><Activity size={18} /><h3>Bagaimana membaca tren?</h3><p>Satu angka adalah potret sesaat. Gunakan halaman Tren untuk melihat arah perubahan dan menghindari jam dengan paparan lebih tinggi.</p></article>
          <article><ShieldAlert size={18} /><h3>Model bukan sensor di titik Anda</h3><p>Data global CAMS memiliki resolusi sekitar 45 km. Asap jalan, konstruksi, atau sumber lokal dapat membuat kondisi nyata berbeda.</p></article>
        </div>
        <aside className="information-safety-note">
          <HeartPulse size={19} />
          <p><strong>Jika muncul sesak berat, nyeri dada, kebingungan, atau kondisi darurat lainnya, cari bantuan medis segera.</strong> HealthAir tidak menilai gejala atau memberikan diagnosis.</p>
        </aside>
      </section>

      <section className="information-references" aria-labelledby="references-heading">
        <div className="information-section-heading">
          <span>Referensi</span>
          <h2 id="references-heading">Sumber data dan pedoman yang digunakan.</h2>
          <p>Referensi dibuka ke situs resminya agar metode dan pembaruannya dapat diperiksa langsung.</p>
        </div>
        <div className="information-reference-list">
          {references.map(reference => (
            <a key={reference.href} href={reference.href} target="_blank" rel="noreferrer">
              <span><strong>{reference.title}</strong><small>{reference.copy}</small></span><ExternalLink size={16} />
            </a>
          ))}
        </div>
        <p className="information-attribution">Data kualitas udara HealthAir: Open-Meteo Air Quality API dengan keluaran model Copernicus Atmosphere Monitoring Service (CAMS). Terakhir ditinjau 31 Agustus 2026.</p>
      </section>
    </main>
  );
}
