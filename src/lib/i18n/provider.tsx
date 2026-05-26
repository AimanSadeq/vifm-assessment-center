"use client";

import { I18nextProvider } from "react-i18next";
import { usePathname } from "next/navigation";
import i18n from "./config";
import { LOCALE_COOKIE } from "./cookie";
import { useEffect, type ReactNode } from "react";

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match ? match[1] : null;
}

/**
 * Routes that opt INTO the user's locale cookie. Everything else
 * (admin, login, etc.) stays English/LTR regardless of cookie because
 * those surfaces aren't translated yet - applying RTL there breaks
 * the layout (e.g. the admin sidebar's `start-0` logical-property
 * positioning lands on the wrong side).
 */
function localeAwareRoute(pathname: string | null): boolean {
  if (!pathname) return false;
  return pathname.startsWith("/candidate") || pathname.startsWith("/ara/respond");
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  // Sync i18next + html dir/lang on mount AND on every route change.
  // - Locale-aware routes follow the cookie (rtl when ar).
  // - Everything else is forced to ltr/en so the admin / login /
  //   assessor / client portals render in their designed direction.
  useEffect(() => {
    const cookieLang = readCookie(LOCALE_COOKIE);
    const aware = localeAwareRoute(pathname);
    const targetLang = aware ? (cookieLang ?? i18n.language) : "en";

    if (targetLang !== i18n.language) {
      i18n.changeLanguage(targetLang);
    }
    if (typeof document !== "undefined") {
      document.documentElement.lang = targetLang;
      document.documentElement.dir = targetLang === "ar" ? "rtl" : "ltr";
    }
  }, [pathname]);

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}
