"use client";

import { useTransition } from "react";
import { Languages } from "lucide-react";
import { setAraRespondentLanguage } from "@/lib/ara/respondent-actions";
import type { AraLanguage } from "@/types/ara";

export function LanguageToggle({
  token,
  current,
}: {
  token: string;
  current: AraLanguage;
}) {
  const [pending, start] = useTransition();

  const switchTo = (lang: AraLanguage) => {
    if (lang === current) return;
    start(async () => {
      await setAraRespondentLanguage(token, lang);
    });
  };

  return (
    <div className="inline-flex items-center gap-1 rounded-md border bg-card p-1 text-xs">
      <Languages className="h-3.5 w-3.5 text-muted-foreground mx-1.5" />
      <button
        type="button"
        onClick={() => switchTo("en")}
        disabled={pending}
        className={`px-2.5 py-1 rounded ${
          current === "en" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
        }`}
      >
        English
      </button>
      <button
        type="button"
        onClick={() => switchTo("ar")}
        disabled={pending}
        className={`px-2.5 py-1 rounded ${
          current === "ar" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
        }`}
      >
        العربية
      </button>
    </div>
  );
}
