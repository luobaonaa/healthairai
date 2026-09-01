import { BarChart3, Info, Map, Sparkles } from "lucide-react";
import React from "react";
import { Link, useLocation } from "wouter";

const appRoutes = ["/explore", "/trends", "/information", "/feedback"];

export default function MobileAppChrome() {
  const [location] = useLocation();
  if (!appRoutes.includes(location)) return null;

  const items = [
    { href: "/explore", label: "Peta", icon: Map, active: location === "/explore" },
    { href: "/trends", label: "Tren", icon: BarChart3, active: location === "/trends" },
    { href: "/information", label: "Informasi", icon: Info, active: location === "/information" },
    { href: "/explore?assistant=1", label: "Puffy", icon: Sparkles, active: false },
  ];

  return (
    <nav className="mobile-bottom-nav" aria-label="Navigasi aplikasi HealthAir">
        {items.map(({ href, label, icon: Icon, active }) => (
          <Link
            key={label}
            href={href}
            className={active ? "active" : ""}
            aria-current={active ? "page" : undefined}
            onClick={event => {
              if (label === "Puffy" && location === "/explore") {
                event.preventDefault();
                window.dispatchEvent(new Event("healthair-open-puffy"));
              }
            }}
          >
            <Icon size={19} />
            <span>{label}</span>
          </Link>
        ))}
    </nav>
  );
}
