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
 * Routes that opt INTO the user's locale cookie (rtl when ar). Everything
 * else (login, the public marketing/landing surfaces) stays English/LTR.
 * The admin/consultant portal is being migrated to bilingual Arabic/RTL
 * phase by phase; /admin is enabled here. The /ara and /reflect consoles
 * join as their translation phases land.
 */
function localeAwareRoute(pathname: string | null): boolean {
  if (!pathname) return false;
  // Fluent is the English-language placement — its UI stays English/LTR even
  // though the rest of /ac is locale-aware.
  if (pathname.startsWith("/ac/fluent")) return false;
  return (
    pathname.startsWith("/candidate") ||
    pathname.startsWith("/ara/respond") ||
    pathname.startsWith("/ara/consultant") ||
    pathname.startsWith("/ara/admin") ||
    pathname.startsWith("/ara/cohort") ||
    pathname.startsWith("/reflect/consultant") ||
    pathname.startsWith("/reflect/admin") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/assessor") ||
    pathname.startsWith("/client") ||
    pathname.startsWith("/ac") ||
    pathname.startsWith("/courses") ||
    pathname.startsWith("/verify") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/password-reset")
  );
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  // Sync i18next + html dir/lang on mount AND on every route change.
  // - Locale-aware routes (the portals listed above, now incl. the bilingual
  //   admin/assessor/client surfaces) follow the cookie (rtl when ar).
  // - Public marketing/landing surfaces stay ltr/en.
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
