import {
  BarChart3,
  Info,
  Map,
  Menu,
  MessageSquare,
  X,
} from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import HealthAirLogo from "@/components/HealthAirLogo";
import React, { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation } from "wouter";

const drawerExitDuration = 380;
const sections = [
  {
    href: "/explore",
    label: "Peta",
    description: "Cari dan pilih lokasi",
    icon: Map,
  },
  {
    href: "/trends",
    label: "Tren",
    description: "Lihat perubahan AQI",
    icon: BarChart3,
  },
  {
    href: "/information",
    label: "Informasi",
    description: "Pahami kualitas udara",
    icon: Info,
  },
  {
    href: "/feedback",
    label: "Masukan",
    description: "Kirim saran Anda",
    icon: MessageSquare,
  },
];

type DrawerState = "closed" | "open" | "closing";

export default function ExploreSectionNav({
  compact = false,
}: {
  compact?: boolean;
}) {
  const [location] = useLocation();
  const { user, isAuthenticated } = useAuth();
  const [drawerState, setDrawerState] = useState<DrawerState>(() =>
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).has("menu")
      ? "open"
      : "closed"
  );
  const drawerId = useId();
  const closeTimer = useRef<number | undefined>(undefined);
  const isDrawerMounted = drawerState !== "closed";

  const openDrawer = () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    setDrawerState("open");
  };

  const closeDrawer = () => {
    if (drawerState !== "open") return;
    setDrawerState("closing");
    closeTimer.current = window.setTimeout(
      () => setDrawerState("closed"),
      drawerExitDuration
    );
  };

  useEffect(
    () => () => {
      if (closeTimer.current) window.clearTimeout(closeTimer.current);
    },
    []
  );

  useEffect(() => {
    if (!isDrawerMounted) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeDrawer();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [isDrawerMounted, drawerState]);

  const drawer =
    isDrawerMounted && typeof document !== "undefined"
      ? createPortal(
          <div
            className={`section-drawer-root ${drawerState === "open" ? "is-open" : "is-closing"}`}
          >
            <button
              className="section-drawer-backdrop"
              type="button"
              aria-label="Tutup overlay menu utama"
              onClick={closeDrawer}
            />
            <aside
              id={drawerId}
              className="section-drawer"
              role="dialog"
              aria-modal="true"
              aria-label="Menu utama HealthAir"
            >
              <div className="section-drawer-head">
          <span className="section-drawer-brand">
            <i>
              <HealthAirLogo />
            </i>
                  HealthAir AI
                </span>
                <button
                  type="button"
                  aria-label="Tutup menu utama"
                  onClick={closeDrawer}
                >
                  <X size={17} />
                </button>
              </div>
              <div className="section-drawer-account">
                <span className={`section-drawer-avatar ${isAuthenticated ? "" : "is-logo"}`}>
                  {isAuthenticated ? (
                    user?.name?.slice(0, 1).toUpperCase() || "A"
                  ) : (
                    <HealthAirLogo />
                  )}
                </span>
                <span>
                  <strong>
                    {isAuthenticated
                      ? user?.name || "Akun HealthAir"
                      : "Akun HealthAir"}
                  </strong>
                  <small>
                    {isAuthenticated
                      ? user?.email || "Profil lingkungan aktif"
                      : "Masuk untuk menyimpan favorit"}
                  </small>
                </span>
                <Link
                  href={isAuthenticated ? "/explore" : "/login"}
                  onClick={closeDrawer}
                >
                  {isAuthenticated ? "Profil" : "Masuk"}
                </Link>
              </div>
              <p>Jelajahi kondisi udara sesuai kebutuhan Anda.</p>
              <nav aria-label="Bagian HealthAir">
                {sections.map(({ href, label, description, icon: Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    className={location === href ? "active" : ""}
                    onClick={closeDrawer}
                  >
                    <Icon size={17} />
                    <span>
                      <strong>{label}</strong>
                      <small>{description}</small>
                    </span>
                    <span className="section-drawer-arrow">›</span>
                  </Link>
                ))}
              </nav>
              <div className="section-drawer-foot">
                HealthAir membantu membaca konteks lingkungan, bukan
                menggantikan saran medis.
              </div>
            </aside>
          </div>,
          document.body
        )
      : null;

  return (
    <div className={`section-menu ${compact ? "is-compact" : ""}`}>
      <button
        className="section-menu-trigger"
        type="button"
        aria-label="Buka menu utama"
        aria-expanded={drawerState === "open"}
        aria-controls={drawerId}
        onClick={openDrawer}
      >
        <Menu size={compact ? 15 : 16} />
        <span>Menu</span>
      </button>
      {drawer}
    </div>
  );
}
