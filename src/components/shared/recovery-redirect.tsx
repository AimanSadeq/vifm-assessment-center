"use client";

/**
 * Catches a Supabase password-recovery token on ANY page and forwards to the
 * dedicated set-password screen. The recovery email lands on the Site URL (the
 * app root) with the token in the URL hash; if the visitor is already logged in
 * they stay on that page, so we redirect here before anything consumes the hash.
 *
 * Runs at render time (before child effects / any supabase client that would
 * consume the hash) and only acts when a recovery token is present.
 */
export function RecoveryRedirect() {
  if (
    typeof window !== "undefined" &&
    window.location.hash.includes("type=recovery") &&
    window.location.pathname !== "/update-password"
  ) {
    window.location.replace(`/update-password${window.location.hash}`);
  }
  return null;
}
