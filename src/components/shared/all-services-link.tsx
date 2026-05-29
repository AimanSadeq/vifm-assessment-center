"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";
import { LayoutGrid } from "lucide-react";

/**
 * Top-right "All services" link → the platform launcher (/).
 *  - default: for the portals' light top bars (matches the ghost controls).
 *  - onDark:  a white/translucent pill for the standalone services' dark hero
 *    navs (AR Compass / Reflect / Fluent).
 * Every surface gets a consistent way back to the service launcher.
 */
export function AllServicesLink({ variant = "default" }: { variant?: "default" | "onDark" }) {
  const { t } = useTranslation();
  const label = t("adminNav.allServices");

  if (variant === "onDark") {
    return (
      <Link
        href="/"
        title={label}
        className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-xs font-medium text-white/85 backdrop-blur transition-colors hover:border-white/35 hover:bg-white/15"
      >
        <LayoutGrid className="h-3.5 w-3.5" /> {label}
      </Link>
    );
  }

  return (
    <Link
      href="/"
      title={label}
      className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    >
      <LayoutGrid className="h-4 w-4" />
      <span className="hidden sm:inline">{label}</span>
    </Link>
  );
}
