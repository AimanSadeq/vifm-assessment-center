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

  // The unselected buttons MUST carry an explicit text colour. The toggle sits on
  // a dark hero, and without `text-foreground` the unselected option inherited
  // the hero's white text on the light `bg-card` pill - rendering invisible
  // (white on white). The trial reported the Arabic option "wasn't there" for
  // exactly this reason, which on a bilingual GCC product is a real problem.
  const base = "px-3 py-1.5 rounded font-medium transition-colors";
  const selected = "bg-primary text-primary-foreground";
  const unselected = "text-foreground hover:bg-muted";
  return (
    <div className="inline-flex items-center gap-1 rounded-md border bg-card p-1 text-xs shadow-sm">
      <Languages className="h-3.5 w-3.5 text-muted-foreground mx-1" />
      <button
        type="button"
        onClick={() => switchTo("en")}
        disabled={pending}
        aria-pressed={current === "en"}
        className={`${base} ${current === "en" ? selected : unselected}`}
      >
        English
      </button>
      <button
        type="button"
        onClick={() => switchTo("ar")}
        disabled={pending}
        aria-pressed={current === "ar"}
        className={`${base} ${current === "ar" ? selected : unselected}`}
        lang="ar"
      >
        العربية
      </button>
    </div>
  );
}
