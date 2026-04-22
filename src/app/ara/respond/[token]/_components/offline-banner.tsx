"use client";

import { useEffect, useState } from "react";
import { WifiOff, Wifi } from "lucide-react";
import type { AraLanguage } from "@/types/ara";

type Mode = "online" | "offline" | "reconnected";

const COPY: Record<AraLanguage, { offline: string; reconnected: string }> = {
  en: {
    offline: "You are offline. Your answers are saved locally and will sync when you reconnect.",
    reconnected: "You are back online. Your answers have been synced.",
  },
  ar: {
    offline: "أنت غير متصل. إجاباتك محفوظة محلياً وستتم المزامنة عند عودة الاتصال.",
    reconnected: "عدت متصلاً. تمت مزامنة إجاباتك.",
  },
};

/**
 * Persistent banner reflecting navigator.onLine state.
 * Detects disconnection within a few seconds (browser-dependent) and
 * shows a brief "back online" confirmation after reconnect.
 */
export function OfflineBanner({ language }: { language: AraLanguage }) {
  const [mode, setMode] = useState<Mode>("online");
  const copy = COPY[language];

  useEffect(() => {
    // Initialise from current state so a hard-refresh while offline
    // immediately shows the banner instead of pretending we are online.
    if (typeof navigator !== "undefined" && !navigator.onLine) setMode("offline");

    const goOffline = () => setMode("offline");
    const goOnline = () => {
      setMode((prev) => (prev === "offline" ? "reconnected" : "online"));
    };
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, []);

  useEffect(() => {
    if (mode !== "reconnected") return;
    const t = setTimeout(() => setMode("online"), 3000);
    return () => clearTimeout(t);
  }, [mode]);

  if (mode === "online") return null;

  const isOffline = mode === "offline";
  return (
    <div
      role="status"
      className={`fixed inset-x-0 top-0 z-50 px-4 py-2 text-sm text-center font-medium ${
        isOffline
          ? "bg-amber-500 text-amber-950"
          : "bg-emerald-600 text-emerald-50"
      }`}
    >
      <span className="inline-flex items-center gap-2">
        {isOffline ? <WifiOff className="h-4 w-4" /> : <Wifi className="h-4 w-4" />}
        {isOffline ? copy.offline : copy.reconnected}
      </span>
    </div>
  );
}
