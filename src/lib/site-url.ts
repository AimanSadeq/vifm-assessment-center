// The public origin of the portal, for links that leave the app: emails,
// PDFs, QR/verification codes, copy-link buttons.
//
// EMAIL-18: this used to be read ad hoc in ~30 places from two env vars in
// different orders with different fallbacks - some fell back to
// "http://localhost:3000" and some to "" (a relative link, which is broken in
// an email), so a missing variable on the server silently sent respondents a
// dead link. One resolver now: NEXT_PUBLIC_SITE_URL, else NEXT_PUBLIC_APP_URL,
// else the production domain. Trailing slashes are stripped.
// Plain module (no server-only imports) so client components can use it; the
// NEXT_PUBLIC_ variables are inlined at build time.

export const PRODUCTION_ORIGIN = "https://caliber.viftraining.com";

export function siteOrigin(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || PRODUCTION_ORIGIN;
  return raw.replace(/\/+$/, "");
}
