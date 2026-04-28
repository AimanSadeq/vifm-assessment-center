import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";
import ar from "./locales/ar.json";

// SUPPORTED_LANGUAGES + LanguageCode now live in ./cookie so they
// can be imported from server components without dragging in
// react-i18next. Re-exported here for backwards compatibility with
// existing client imports.
export { SUPPORTED_LANGUAGES, type LanguageCode } from "./cookie";

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    ar: { translation: ar },
  },
  lng: "en",
  fallbackLng: "en",
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
