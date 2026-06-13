// Shared auth configuration.
//
// Flip this to `true` when going to production. The middleware reads it
// to decide whether to enforce Supabase sessions; the ARA auth guards
// read it to decide whether to grant dev-admin identity to unauthenticated
// callers.
//
// When flipping to true:
//   1. Ensure every user has a row in the `profiles` table with the
//      correct role (admin / consultant / candidate / client / lead_assessor
//      / associate_assessor).
//   2. Create at least one admin user via the Supabase dashboard.
//   3. Follow src/lib/auth/README.md for the rest of the cutover.
export const AUTH_ENABLED = true;
