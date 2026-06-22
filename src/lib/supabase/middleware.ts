import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Redirect unauthenticated users to login (except for auth pages)
  if (
    !user &&
    !request.nextUrl.pathname.startsWith("/login") &&
    !request.nextUrl.pathname.startsWith("/register") &&
    !request.nextUrl.pathname.startsWith("/password-reset") &&
    !request.nextUrl.pathname.startsWith("/update-password") &&
    !request.nextUrl.pathname.startsWith("/auth")
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Confine a client_manager to their own /portal. Any other PAGE route (the
  // admin / consultant / assessor surfaces, the open platform landing, the AC
  // runners) redirects back to /portal, so a client manager only ever sees the
  // services their org was allocated. API routes are left to self-gate - the
  // org-scoped report endpoints already admit a client_manager for their own
  // org; the Techno on-screen report page is org-gated too, so both are allowed
  // through. The role is read via the self-read profiles_select_own policy.
  if (user) {
    const p = request.nextUrl.pathname;
    const sharedOk =
      p.startsWith("/portal") ||
      p.startsWith("/api/") ||
      p.startsWith("/login") ||
      p.startsWith("/logout") ||
      p.startsWith("/register") ||
      p.startsWith("/password-reset") ||
      p.startsWith("/update-password") ||
      p.startsWith("/auth") ||
      p.startsWith("/courses") ||
      p.startsWith("/evidence") ||
      p.startsWith("/verify") ||
      p.startsWith("/admin/tech-sandbox/results");
    if (!sharedOk) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle<{ role: string }>();
      if (profile?.role === "client_manager") {
        const url = request.nextUrl.clone();
        url.pathname = "/portal";
        url.search = "";
        return NextResponse.redirect(url);
      }
    }
  }

  return supabaseResponse;
}
