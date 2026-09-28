// Which routes follow the user's `vifm-locale` cookie (right-to-left when
// Arabic). Everything else - the public marketing / landing surfaces - stays
// English, left-to-right. One list, used by the client I18nProvider AND the
// pre-paint script in the root layout, so the two cannot drift (I18N-03).
// Plain module: no React, safe to import from server and client code.

/** Checked first: these stay English even though a parent prefix is locale-aware. */
export const LOCALE_EXCLUDED_PREFIXES = [
  "/ac/fluent", // the English placement test - its UI stays English/LTR
] as const;

export const LOCALE_AWARE_PREFIXES = [
  "/candidate",
  "/ara/respond",
  "/ara/consultant",
  "/ara/admin",
  "/ara/cohort",
  "/reflect/consultant",
  "/reflect/admin",
  "/admin",
  "/assessor",
  "/client",
  "/ac",
  "/courses",
  "/verify",
  "/login",
  "/register",
  "/password-reset",
] as const;

export function isLocaleAwareRoute(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  if (LOCALE_EXCLUDED_PREFIXES.some((p) => pathname.startsWith(p))) return false;
  return LOCALE_AWARE_PREFIXES.some((p) => pathname.startsWith(p));
}
