"use client";

import { I18nextProvider } from "react-i18next";
import i18n from "./config";
import { LOCALE_COOKIE } from "./cookie";
import { useEffect, type ReactNode } from "react";

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match ? match[1] : null;
}

export function I18nProvider({ children }: { children: ReactNode }) {
  // Sync i18next's in-memory locale with the persisted cookie on mount, so
  // a hard refresh keeps Arabic if the user picked Arabic last session.
  useEffect(() => {
    const cookieLang = readCookie(LOCALE_COOKIE);
    if (cookieLang && cookieLang !== i18n.language) {
      i18n.changeLanguage(cookieLang);
    }
    // Ensure html dir matches whatever locale we just settled on.
    if (typeof document !== "undefined") {
      const lang = cookieLang ?? i18n.language;
      document.documentElement.lang = lang;
      document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    }
  }, []);

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}
