import { cookies } from "next/headers";
import en from "./locales/en.json";
import ar from "./locales/ar.json";
import {
  LOCALE_COOKIE,
  SUPPORTED_LANGUAGES,
  type LanguageCode,
} from "./cookie";

export { LOCALE_COOKIE };

/**
 * Server-side i18n helpers, used by server components that don't
 * have access to react-i18next's hooks.
 *
 * Locale precedence:
 *   1. `vifm-locale` cookie (set by the language switcher)
 *   2. fallback to "en"
 *
 * Returns a tiny `t(key)` function that walks the locale JSON tree
 * by dot-path and returns the original key as fallback. Mirrors the
 * shape returned by useTranslation().t so client/server callers can
 * use the same key strings.
 */

const LOCALES: Record<LanguageCode, Record<string, unknown>> = {
  en: en as Record<string, unknown>,
  ar: ar as Record<string, unknown>,
};

const VALID_CODES = new Set(SUPPORTED_LANGUAGES.map((l) => l.code));

export async function getServerLocale(): Promise<LanguageCode> {
  const store = await cookies();
  const v = store.get(LOCALE_COOKIE)?.value;
  if (v && VALID_CODES.has(v as LanguageCode)) return v as LanguageCode;
  return "en";
}

export function getServerDir(locale: LanguageCode): "ltr" | "rtl" {
  return SUPPORTED_LANGUAGES.find((l) => l.code === locale)?.dir ?? "ltr";
}

function lookup(tree: Record<string, unknown>, path: string): string | null {
  const parts = path.split(".");
  let cur: unknown = tree;
  for (const p of parts) {
    if (cur && typeof cur === "object" && p in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[p];
    } else {
      return null;
    }
  }
  return typeof cur === "string" ? cur : null;
}

export type ServerT = (key: string, vars?: Record<string, string | number>) => string;

/**
 * Server-side translator. Reads the `vifm-locale` cookie by default, mirroring
 * the client provider. Pass `localeOverride` to pin a locale regardless of the
 * cookie — used by Fluent, the English-language placement, whose server-rendered
 * chrome must stay English even when the rest of the portal is Arabic (the client
 * provider already forces /ac/fluent to en/ltr; this keeps SSR consistent).
 */
export async function getServerT(localeOverride?: LanguageCode): Promise<ServerT> {
  const locale = localeOverride ?? (await getServerLocale());
  const tree = LOCALES[locale] ?? LOCALES.en;
  return (key, vars) => {
    const found = lookup(tree, key) ?? lookup(LOCALES.en, key) ?? key;
    if (!vars) return found;
    return Object.entries(vars).reduce(
      (acc, [k, v]) => acc.replace(new RegExp(`\\{\\{\\s*${k}\\s*\\}\\}`, "g"), String(v)),
      found
    );
  };
}
