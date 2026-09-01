import React from "react";

export default function HealthAirChatAvatar({ className = "" }: { className?: string }) {
  return (
    <img
      className={`healthair-chat-avatar ${className}`.trim()}
      src="/assets/healthair-chat-avatar-transparent.png"
      alt=""
      aria-hidden="true"
      draggable={false}
    />
  );
}
