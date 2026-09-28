"use client";

import { I18nextProvider } from "react-i18next";
import { usePathname } from "next/navigation";
import i18n from "./config";
import { LOCALE_COOKIE } from "./cookie";
import { isLocaleAwareRoute } from "./locale-routes";
import { useEffect, useMemo, type ReactNode } from "react";

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match ? match[1] : null;
}

/**
 * Routes that opt INTO the user's locale cookie live in ./locale-routes (one
 * list, shared with the pre-paint script in the root layout).
 *
 * I18N-03: the language used to be applied only in a post-mount effect, so a
 * user with the Arabic cookie saw every client component render in English and
 * left-to-right, then flip. The root layout now passes the cookie's locale in
 * (`initialLocale`), and the translation instance starts in the right language
 * on the server render as well as the client. Each provider gets its OWN
 * instance (cloneInstance shares the loaded resources) - changing the language
 * of the module singleton during a server render would leak into concurrent
 * requests. The html dir/lang are set before first paint by the layout script;
 * the effect below keeps them in step on client-side navigation.
 */
export function I18nProvider({
  children,
  initialLocale = null,
}: {
  children: ReactNode;
  /** The `vifm-locale` cookie as read by the server, or null. */
  initialLocale?: string | null;
}) {
  const pathname = usePathname();
  const aware = isLocaleAwareRoute(pathname);
  const startLang = aware && initialLocale === "ar" ? "ar" : "en";

  // One instance per provider mount, started in the language this request
  // should render in. Deliberately keyed only on mount: later changes go
  // through changeLanguage below (and the switcher), not a re-clone.
  const instance = useMemo(
    () => i18n.cloneInstance({ lng: startLang }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useEffect(() => {
    const cookieLang = readCookie(LOCALE_COOKIE);
    const targetLang = isLocaleAwareRoute(pathname) ? (cookieLang ?? instance.language) : "en";
    if (targetLang !== instance.language) {
      instance.changeLanguage(targetLang);
    }
    if (typeof document !== "undefined") {
      document.documentElement.lang = targetLang;
      document.documentElement.dir = targetLang === "ar" ? "rtl" : "ltr";
    }
  }, [pathname, instance]);

  return <I18nextProvider i18n={instance}>{children}</I18nextProvider>;
}
