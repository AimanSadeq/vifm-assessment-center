/**
 * Cookie name + language constants shared between client (language
 * switcher), server (getServerLocale), and the i18next config. Lives
 * in its own side-effect-free module so server components can import
 * the constants without pulling in react-i18next (which crashes in
 * RSC because it calls createContext at module load).
 */
export const LOCALE_COOKIE = "vifm-locale";

export const SUPPORTED_LANGUAGES = [
  { code: "en", label: "English", dir: "ltr" as const },
  { code: "ar", label: "العربية", dir: "rtl" as const },
] as const;

export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number]["code"];
