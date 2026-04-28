"use client";

import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { SUPPORTED_LANGUAGES, type LanguageCode } from "@/lib/i18n/config";
import { LOCALE_COOKIE } from "@/lib/i18n/cookie";
import { Button } from "@/components/ui/button";

export function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const router = useRouter();

  const handleSwitch = (code: LanguageCode) => {
    i18n.changeLanguage(code);
    // Update HTML dir and lang attributes
    document.documentElement.lang = code;
    document.documentElement.dir =
      SUPPORTED_LANGUAGES.find((l) => l.code === code)?.dir ?? "ltr";
    // Persist as a cookie so server components pick it up on next request.
    // 1-year expiry; SameSite=Lax so it survives normal navigation.
    const oneYear = 60 * 60 * 24 * 365;
    document.cookie = `${LOCALE_COOKIE}=${code}; max-age=${oneYear}; path=/; SameSite=Lax`;
    // Re-fetch the current page so server components re-render with the new locale.
    router.refresh();
  };

  const currentLang = i18n.language;

  return (
    <div className="flex gap-1">
      {SUPPORTED_LANGUAGES.map((lang) => (
        <Button
          key={lang.code}
          variant={currentLang === lang.code ? "default" : "ghost"}
          size="sm"
          className="text-xs px-2"
          onClick={() => handleSwitch(lang.code)}
        >
          {lang.label}
        </Button>
      ))}
    </div>
  );
}
