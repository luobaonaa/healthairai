import React from "react";

type HealthAirLogoProps = {
  className?: string;
};

export default function HealthAirLogo({ className = "" }: HealthAirLogoProps) {
  return (
    <img
      className={`healthair-logo ${className}`.trim()}
      src="/assets/healthair-logo-transparent.png"
      alt=""
      aria-hidden="true"
      draggable={false}
    />
  );
}
