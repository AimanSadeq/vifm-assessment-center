import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing sessions.
          }
        },
      },
    }
  );
}

/**
 * Service role client - bypasses RLS.
 * Use ONLY in server actions / server components. Never expose to client.
 *
 * Cache discipline: every PostgREST request is forced through fetch with
 * `cache: 'no-store'` so Next.js can never serve a stale snapshot from its
 * internal Data Cache. Without this, two reads against the same URL+headers
 * within the same render pass can return the same body — including across
 * write-then-read flows where the second read needs to see the post-write
 * state. Confirmed during Reflect M3 verification: `.select("*")` returned
 * cached `status=pending` even after a server action had committed
 * `status=completed`, while differently-shaped selects (different URLs)
 * returned the fresh row.
 */
export function createServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      global: {
        fetch: (input, init) =>
          fetch(input, { ...init, cache: "no-store" }),
      },
    }
  );
}
