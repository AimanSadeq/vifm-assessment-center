"use client";

import { useTranslation } from "react-i18next";
import { SUPPORTED_LANGUAGES, type LanguageCode } from "@/lib/i18n/config";
import { Button } from "@/components/ui/button";

export function LanguageSwitcher() {
  const { i18n } = useTranslation();

  const handleSwitch = (code: LanguageCode) => {
    i18n.changeLanguage(code);
    // Update HTML dir and lang attributes
    document.documentElement.lang = code;
    document.documentElement.dir =
      SUPPORTED_LANGUAGES.find((l) => l.code === code)?.dir ?? "ltr";
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
