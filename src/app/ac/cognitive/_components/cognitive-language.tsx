"use client";

import { BrainCircuit } from "lucide-react";
import { createContext, useContext, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";

export type CognitiveLanguage = "en" | "ar";

type Ctx = {
  language: CognitiveLanguage;
  setLanguage: Dispatch<SetStateAction<CognitiveLanguage>>;
};

/**
 * Shared language state for the Logica take page - same pattern as Fluent's
 * FluentLanguageProvider, for the same trial finding (Omar, on both trials):
 * the language toggle lives inside the runner card, but the welcome header is
 * server-rendered above it, so switching to Arabic left the header in English.
 * Lifting the state lets both read one value while the page stays a server
 * component. The runner falls back to its own local state when no provider is
 * present, so the standalone /ac/cognitive surface is unaffected.
 */
const CognitiveLanguageContext = createContext<Ctx | null>(null);

export function CognitiveLanguageProvider({
  initial = "en",
  children,
}: {
  initial?: CognitiveLanguage;
  children: ReactNode;
}) {
  const [language, setLanguage] = useState<CognitiveLanguage>(initial);
  return (
    <CognitiveLanguageContext.Provider value={{ language, setLanguage }}>
      {children}
    </CognitiveLanguageContext.Provider>
  );
}

/** Returns the shared language state, or null when rendered outside a provider. */
export function useCognitiveLanguage(): Ctx | null {
  return useContext(CognitiveLanguageContext);
}

const HEADER = {
  en: { eyebrow: "VIFM Logica®", welcome: "Welcome" },
  ar: { eyebrow: "‏VIFM Logica®", welcome: "أهلاً بك" },
} as const;

/** The take-page welcome, rendered in whichever language the taker selects in
 *  the runner card below it (and flipped to RTL for Arabic). */
export function CognitiveTakeHeader({ name }: { name?: string | null }) {
  const ctx = useCognitiveLanguage();
  const language = ctx?.language ?? "en";
  const rtl = language === "ar";
  const copy = HEADER[language];
  const greeting = name ? `${copy.welcome}${rtl ? "، " : ", "}${name}` : copy.welcome;

  return (
    <div className="mt-8 max-w-2xl" dir={rtl ? "rtl" : "ltr"}>
      <span className="ara-eyebrow text-accent">
        <BrainCircuit className="h-3 w-3" /> {copy.eyebrow}
      </span>
      <h1 className="ara-numeral mt-3 text-2xl font-semibold leading-tight text-white sm:text-3xl">{greeting}</h1>
    </div>
  );
}
