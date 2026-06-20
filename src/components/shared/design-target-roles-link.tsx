"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";
import { Target } from "lucide-react";

/**
 * Top-right "Design target roles" link → the role-profile designer
 * (/admin/role-profiles). The target role is the common thread across every
 * service - design it once, then assess against it with any instrument - so
 * every standalone service landing gets a consistent way to reach the designer.
 *  - default: light top bars (matches the ghost controls).
 *  - onDark:  white/translucent pill for the dark service heroes (ARC / Reflect
 *    / Fluent / Reason / Persona).
 */
export function DesignTargetRolesLink({ variant = "default" }: { variant?: "default" | "onDark" }) {
  const { t } = useTranslation();
  const label = t("adminNav.designTargetRoles");

  if (variant === "onDark") {
    return (
      <Link
        href="/admin/role-profiles"
        title={label}
        className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-xs font-medium text-white/85 backdrop-blur transition-colors hover:border-white/35 hover:bg-white/15"
      >
        <Target className="h-3.5 w-3.5" /> {label}
      </Link>
    );
  }

  return (
    <Link
      href="/admin/role-profiles"
      title={label}
      className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    >
      <Target className="h-4 w-4" />
      <span className="hidden sm:inline">{label}</span>
    </Link>
  );
}
