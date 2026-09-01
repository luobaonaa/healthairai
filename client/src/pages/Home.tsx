import { useAuth } from "@/_core/hooks/useAuth";
import HealthAirLogo from "@/components/HealthAirLogo";
import { getAqiCategory } from "@/lib/environment";
import { trpc } from "@/lib/trpc";
import { ArrowRight, Compass, Leaf, Map, ShieldCheck, Sparkles, Wind } from "lucide-react";
import React, { useEffect, useMemo, useRef } from "react";
import { Link, useLocation } from "wouter";

const landingLocation = { latitude: -6.1425, longitude: 106.7337 };

export default function Home() {
  const { isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const mascotRef = useRef<HTMLDivElement>(null);
  const mascotVideoRef = useRef<HTMLVideoElement>(null);
  const mascotCanvasRef = useRef<HTMLCanvasElement>(null);
  const liveQuery = trpc.environmental.live.useQuery(landingLocation, { refetchInterval: 300000, refetchOnWindowFocus: true, retry: 1 });
  const live = liveQuery.data;
  const aqiCategory = useMemo(() => live ? getAqiCategory(live.aqi) : null, [live]);
  const observedAt = useMemo(() => {
    if (!live?.observedAt) return null;
    const date = new Date(live.observedAt);
    if (Number.isNaN(date.getTime())) return null;
    return new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit" }).format(date);
  }, [live?.observedAt]);
  const explore = () => setLocation("/explore");

  useEffect(() => {
    const mascot = mascotRef.current;
    const video = mascotVideoRef.current;
    const canvas = mascotCanvasRef.current;
    if (!mascot || !video || !canvas) return;

    let animationFrame = 0;
    let pointerX = 0;
    let pointerY = 0;
    let targetMascotTime = 0;
    let lastMascotFrameAt = 0;
    const mascotFrameInterval = 1000 / 24;

    const renderTransparentFrame = () => {
      if (video.readyState < 2 || !video.videoWidth || !video.videoHeight) return;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) return;
      const cropSize = video.videoHeight;
      const cropX = Math.max(0, (video.videoWidth - cropSize) / 2);
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(video, cropX, 0, cropSize, cropSize, 0, 0, canvas.width, canvas.height);

      const frame = context.getImageData(0, 0, canvas.width, canvas.height);
      const pixels = frame.data;
      const width = canvas.width;
      const height = canvas.height;
      const removed = new Uint8Array(width * height);
      const queue = new Int32Array(width * height);
      let head = 0;
      let tail = 0;
      const enqueue = (index: number) => {
        if (!removed[index]) {
          removed[index] = 1;
          queue[tail++] = index;
        }
      };
      for (let x = 0; x < width; x += 1) { enqueue(x); enqueue((height - 1) * width + x); }
      for (let y = 1; y < height - 1; y += 1) { enqueue(y * width); enqueue(y * width + width - 1); }

      while (head < tail) {
        const index = queue[head++];
        const offset = index * 4;
        const red = pixels[offset];
        const green = pixels[offset + 1];
        const blue = pixels[offset + 2];
        const min = Math.min(red, green, blue);
        const max = Math.max(red, green, blue);
        if (min < 210 || max - min > 22) { removed[index] = 2; continue; }
        pixels[offset + 3] = 0;
        const x = index % width;
        const y = Math.floor(index / width);
        if (x > 0) enqueue(index - 1);
        if (x + 1 < width) enqueue(index + 1);
        if (y > 0) enqueue(index - width);
        if (y + 1 < height) enqueue(index + width);
      }
      context.putImageData(frame, 0, 0);

      if (!animationFrame && Math.abs(targetMascotTime - video.currentTime) > .012) {
        animationFrame = window.requestAnimationFrame(updateMascot);
      }
    };

    video.addEventListener("loadeddata", renderTransparentFrame);
    video.addEventListener("seeked", renderTransparentFrame);
    if (video.readyState >= 2) renderTransparentFrame();

    const calculateTargetTime = (duration: number) => {
      let targetTime: number;
      const horizontalDirection = Math.abs(pointerX) > Math.abs(pointerY) * 1.2;
      if (horizontalDirection && pointerX > 0) {
        const strength = Math.min(1, Math.abs(pointerX));
        targetTime = 7.1 + strength * .75;
      } else if (horizontalDirection && pointerX < 0) {
        targetTime = 5.05;
      } else {
        const verticalStrength = Math.min(1, Math.abs(pointerY));
        targetTime = pointerY <= 0
          ? .08 + verticalStrength * 1.9
          : .08 + verticalStrength * 3.8;
      }
      const frameTime = Math.round(targetTime * 24) / 24;
      return Math.max(.04, Math.min(duration - .04, frameTime));
    };

    const updateMascot = () => {
      const video = mascotVideoRef.current;
      if (video && Number.isFinite(video.duration) && video.duration > 0) {
        targetMascotTime = calculateTargetTime(video.duration);
        if (video.seeking) {
          animationFrame = 0;
          return;
        }
        const now = performance.now();
        if (now - lastMascotFrameAt < mascotFrameInterval) {
          animationFrame = window.requestAnimationFrame(updateMascot);
          return;
        }
        const difference = targetMascotTime - video.currentTime;
        if (Math.abs(difference) > .012) {
          lastMascotFrameAt = now;
          video.currentTime = targetMascotTime;
          animationFrame = 0;
          return;
        }
      }
      animationFrame = 0;
    };

    const followPosition = (clientX: number, clientY: number) => {
      const bounds = mascot.getBoundingClientRect();
      const rawX = (clientX - (bounds.left + bounds.width / 2)) / (window.innerWidth / 2);
      const rawY = (clientY - (bounds.top + bounds.height / 2)) / (window.innerHeight / 2);
      const visualX = Math.max(-1, Math.min(1, rawX));
      const visualY = Math.max(-1, Math.min(1, rawY));
      pointerX = rawX;
      pointerY = rawY;
      mascot.style.setProperty("--mascot-x", `${visualX * 7}px`);
      mascot.style.setProperty("--mascot-y", `${visualY * 4}px`);
      mascot.style.setProperty("--mascot-rotate", `${visualX * 1.4}deg`);
      if (!animationFrame) animationFrame = window.requestAnimationFrame(updateMascot);
    };

    const followPointer = (event: PointerEvent) => {
      // Touch has its own listener so it keeps updating while the page scrolls.
      if (event.pointerType === "touch") return;
      followPosition(event.clientX, event.clientY);
    };

    const followTouch = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (touch) followPosition(touch.clientX, touch.clientY);
    };

    const resetMascot = () => {
      pointerX = 0;
      pointerY = 0;
      mascot.style.setProperty("--mascot-x", "0px");
      mascot.style.setProperty("--mascot-y", "0px");
      mascot.style.setProperty("--mascot-rotate", "0deg");
      if (!animationFrame) animationFrame = window.requestAnimationFrame(updateMascot);
    };

    window.addEventListener("pointermove", followPointer, { passive: true });
    window.addEventListener("touchstart", followTouch, { passive: true });
    window.addEventListener("touchmove", followTouch, { passive: true });
    document.documentElement.addEventListener("mouseleave", resetMascot);
    return () => {
      window.removeEventListener("pointermove", followPointer);
      window.removeEventListener("touchstart", followTouch);
      window.removeEventListener("touchmove", followTouch);
      document.documentElement.removeEventListener("mouseleave", resetMascot);
      video.removeEventListener("loadeddata", renderTransparentFrame);
      video.removeEventListener("seeked", renderTransparentFrame);
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
    };
  }, []);

  return (
    <div className="page-shell">
      <div className="landing-orb one" />
      <div className="landing-orb two" />
      <header className="landing-nav">
        <Link href="/" className="brand"><span className="brand-mark"><HealthAirLogo /></span>HealthAir AI</Link>
        <nav className="nav-links" aria-label="Navigasi utama">
          <a href="#cara-kerja">Cara kerja</a>
          <a href="#jelajah">Eksplorasi</a>
          <a href="#insight">Insight lingkungan</a>
        </nav>
        <div className="nav-actions">
          {!isAuthenticated && <Link href="/login" className="button button-ghost button-small">Masuk</Link>}
          <button className="button button-primary button-small" onClick={explore}>{isAuthenticated ? "Buka peta" : "Mulai"}<ArrowRight size={14} /></button>
        </div>
      </header>

      <main>
        <section className="hero" id="jelajah">
          <div className="hero-copy">
            <span className="eyebrow hero-kicker"><span className="eyebrow-dot" /> Peta udara cerdas</span>
            <h1><span className="hero-line hero-line-one">Tahu udaranya.</span><span className="hero-line hero-line-two"><em>Jalani</em> harinya.</span><span className="hero-line hero-line-three">Lebih lega.</span></h1>
            <p className="hero-description">Baca udaranya. Pilih langkah yang lebih nyaman.</p>
            <div className="hero-buttons hero-actions">
              <button className="button button-primary" onClick={explore}>Jelajahi HealthAir <ArrowRight size={16} /></button>
              {!isAuthenticated && <Link href="/register" className="button button-ghost">Buat profil</Link>}
            </div>
            <div className="hero-note"><ShieldCheck size={15} /> Bukan diagnosis medis—dibuat untuk membantu Anda membaca konteks lingkungan.</div>
          </div>
          <div className="hero-map-wrap" aria-label="Pratinjau peta lingkungan HealthAir AI">
            <div className="hero-map">
              <span className="mock-map-label">Cengkareng, Jakarta Barat{live ? ` · ${live.temperature}°C` : ""}</span>
              <span className="mock-pin" />
              <div className="mock-card aqi"><span className="label">Kualitas udara langsung</span><strong>{live?.aqi ?? "—"}</strong> <small>{live ? `AQI · ${aqiCategory?.label ?? live.status}` : liveQuery.isLoading ? "Memuat data…" : "Data tidak tersedia"}</small></div>
              <div className="mock-card weather"><span className="label">PM2.5 langsung</span><strong>{live?.pm25 ?? "—"}</strong> <small>{live ? `μg/m³ · Angin ${live.wind} km/j` : liveQuery.isLoading ? "Memuat data…" : "Data tidak tersedia"}</small></div>
              <div className="mock-card insight"><span className="label">{live ? `Data langsung · ${live.source}` : "Status data"}</span><p>{live ? `${live.weather}. Kelembapan ${live.humidity}%.${observedAt ? ` Diperbarui pukul ${observedAt}.` : ""}` : liveQuery.isLoading ? "Mengambil pembacaan lingkungan terbaru…" : "Pembacaan langsung belum dapat dimuat. Buka peta untuk mencoba kembali."}</p></div>
            </div>
          </div>
        </section>

        <div className="trust-row">
          <span><Map size={16} /> Peta adalah pusat pengalaman</span>
          <span><Wind size={16} /> Cuaca & kualitas udara dalam satu tampilan</span>
          <span><Sparkles size={16} /> Rekomendasi yang mempertimbangkan konteks Anda</span>
        </div>

        <section className="land-section" id="cara-kerja">
          <div className="section-inner">
            <div className="section-top">
              <span className="eyebrow"><span className="eyebrow-dot" /> Lebih dari angka</span>
              <h2>Lingkungan, diterjemahkan menjadi pilihan yang lebih jelas.</h2>
              <p>HealthAir menggabungkan lokasi, pembacaan udara, cuaca, area hijau, dan konteks aktivitas untuk membantu Anda mengeksplorasi sekitar dengan lebih sadar.</p>
            </div>
            <div className="feature-grid" id="insight">
              <article className="feature-card"><div className="feature-icon"><Map size={21} /></div><h3>Jelajahi dari peta</h3><p>Pilih titik mana pun, cari lokasi, atau gunakan lokasi perangkat untuk melihat kondisi lingkungan di sekitarnya.</p></article>
              <article className="feature-card"><div className="feature-icon"><Compass size={21} /></div><h3>Bandingkan tempat</h3><p>Temukan ruang hijau dan area publik terdekat dengan ringkasan faktor udara, sirkulasi, dan kenyamanan.</p></article>
              <article className="feature-card"><div className="feature-icon"><Leaf size={21} /></div><h3>Sesuaikan konteks</h3><p>Pilih profil lingkungan agar interpretasi kondisi lebih relevan—tanpa menggantikan pertimbangan profesional.</p></article>
            </div>
          </div>
        </section>

        <section className="cta-section">
          <h2>Mulai dari udara yang Anda hirup hari ini.</h2>
          <p>Buka peta, izinkan lokasi bila Anda nyaman, lalu lihat cara HealthAir menyatukan kondisi lingkungan di sekitar Anda.</p>
          <button className="button" onClick={explore}>Buka peta lingkungan <ArrowRight size={16} /></button>
        </section>
      </main>
      <footer className="landing-footer"><span>© 2026 HealthAir AI</span><span>A smarter map for healthier environments.</span></footer>
      <div ref={mascotRef} className="hero-mascot" data-testid="hero-mascot">
        <video ref={mascotVideoRef} className="mascot-source-video" src="/assets/healthair-mascot-look-v2.mp4" aria-hidden="true" muted playsInline preload="auto" onLoadedMetadata={event => { event.currentTarget.currentTime = event.currentTarget.duration / 2; }} />
        <canvas ref={mascotCanvasRef} className="mascot-transparent-canvas" width="320" height="320" aria-label="Maskot HealthAir mengikuti arah kursor atau jari" />
        <span className="mascot-shadow" aria-hidden="true" />
      </div>
    </div>
  );
}
