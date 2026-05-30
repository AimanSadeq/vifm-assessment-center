"use client";

import { useEffect } from "react";

/**
 * Scrolls to the `#section` in the URL on mount. The dashboard's pipeline nodes
 * deep-link into this console (e.g. …/items#cutscores); App Router doesn't
 * reliably scroll to a below-the-fold hash that lives inside a client component,
 * so we do it explicitly. Targets carry `scroll-mt-*` for the header offset.
 */
export function HashScroll() {
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (!id) return;
    // A tick after mount so the (client) console sections are laid out.
    const timer = setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
    return () => clearTimeout(timer);
  }, []);
  return null;
}
