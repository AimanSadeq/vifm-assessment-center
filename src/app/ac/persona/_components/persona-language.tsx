"use client";

import { Layers } from "lucide-react";
import { createContext, useContext, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";

export type PersonaLanguage = "en" | "ar";

type Ctx = {
  language: PersonaLanguage;
  setLanguage: Dispatch<SetStateAction<PersonaLanguage>>;
};

/**
 * Shared language state for the Persona take page - the same pattern as
 * Fluent's and Logica's providers, for the same trial finding (Asaad, Omar):
 * the language toggle lives inside the runner card, but the welcome header is
 * server-rendered above it, so switching to Arabic left the header in English.
 * The runner falls back to its own local state when no provider is present, so
 * the standalone /ac/persona surfaces are unaffected.
 */
const PersonaLanguageContext = createContext<Ctx | null>(null);

export function PersonaLanguageProvider({
  initial = "en",
  children,
}: {
  initial?: PersonaLanguage;
  children: ReactNode;
}) {
  const [language, setLanguage] = useState<PersonaLanguage>(initial);
  return (
    <PersonaLanguageContext.Provider value={{ language, setLanguage }}>{children}</PersonaLanguageContext.Provider>
  );
}

/** Returns the shared language state, or null when rendered outside a provider. */
export function usePersonaLanguage(): Ctx | null {
  return useContext(PersonaLanguageContext);
}

const HEADER = {
  en: { eyebrow: "VIFM Persona®", welcome: "Welcome" },
  ar: { eyebrow: "‏VIFM Persona®", welcome: "مرحبًا" },
} as const;

/** The take-page welcome, rendered in whichever language the taker selects in
 *  the runner card below it (and flipped to RTL for Arabic). */
export function PersonaTakeHeader({ name }: { name?: string | null }) {
  const ctx = usePersonaLanguage();
  const language = ctx?.language ?? "en";
  const rtl = language === "ar";
  const copy = HEADER[language];
  const greeting = name ? `${copy.welcome}${rtl ? "، " : ", "}${name}` : copy.welcome;

  return (
    <div className="mt-8 max-w-2xl" dir={rtl ? "rtl" : "ltr"}>
      <span className="ara-eyebrow text-accent">
        <Layers className="h-3 w-3" /> {copy.eyebrow}
      </span>
      <h1 className="ara-numeral mt-3 text-2xl font-semibold leading-tight text-white sm:text-3xl">{greeting}</h1>
    </div>
  );
}
