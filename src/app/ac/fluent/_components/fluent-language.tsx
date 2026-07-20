"use client";

import { Languages } from "lucide-react";
import { createContext, useContext, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";

export type FluentLanguage = "en" | "ar";

type Ctx = {
  language: FluentLanguage;
  setLanguage: Dispatch<SetStateAction<FluentLanguage>>;
};

/**
 * Shared language state for the Fluent take page.
 *
 * The test-language selector lives INSIDE the runner card, but the welcome
 * header sits above it in the server-rendered page - so the header could not
 * follow the taker's choice (trial feedback: "the welcome should be in one
 * language, and it should change based on the language the user selects").
 * Lifting the state into a context lets both read the same value while the
 * page itself stays a server component.
 *
 * The runner falls back to its own local state when no provider is present, so
 * the standalone /ac/fluent surface is unaffected.
 */
const FluentLanguageContext = createContext<Ctx | null>(null);

export function FluentLanguageProvider({
  initial = "en",
  children,
}: {
  initial?: FluentLanguage;
  children: ReactNode;
}) {
  const [language, setLanguage] = useState<FluentLanguage>(initial);
  return (
    <FluentLanguageContext.Provider value={{ language, setLanguage }}>{children}</FluentLanguageContext.Provider>
  );
}

/** Returns the shared language state, or null when rendered outside a provider. */
export function useFluentLanguage(): Ctx | null {
  return useContext(FluentLanguageContext);
}

const HEADER = {
  en: {
    eyebrow: "VIFM Fluent® · English placement",
    welcome: "Welcome",
    description:
      "A four-skill, CEFR-aligned English placement. Reading and listening are auto-scored; writing and speaking are scored against the CEFR rubric.",
  },
  ar: {
    eyebrow: "‏VIFM Fluent® · اختبار تحديد المستوى في اللغة الإنجليزية",
    welcome: "أهلاً بك",
    description:
      "اختبار تحديد مستوى في اللغة الإنجليزية يغطي أربع مهارات وفق الإطار الأوروبي المرجعي (CEFR). تُصحَّح القراءة والاستماع آلياً، بينما تُقيَّم الكتابة والتحدث وفق معايير الإطار.",
  },
} as const;

/**
 * The take-page welcome, rendered in whichever language the taker has selected
 * in the runner card below it (and flipped to RTL for Arabic).
 */
export function FluentTakeHeader({ name }: { name?: string | null }) {
  const ctx = useFluentLanguage();
  const language = ctx?.language ?? "en";
  const rtl = language === "ar";
  const copy = HEADER[language];

  // Arabic uses its own comma; the name itself is never transliterated.
  const greeting = name ? `${copy.welcome}${rtl ? "، " : ", "}${name}` : copy.welcome;

  return (
    <div className="mt-8 max-w-2xl" dir={rtl ? "rtl" : "ltr"}>
      <span className="ara-eyebrow text-[#9CC4EC]">
        <Languages className="h-3 w-3" /> {copy.eyebrow}
      </span>
      <h1 className="ara-numeral mt-4 text-3xl font-semibold leading-tight text-white sm:text-4xl">{greeting}</h1>
      <p className="mt-3 text-base leading-relaxed text-white/75">{copy.description}</p>
    </div>
  );
}
