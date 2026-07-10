import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Edge-safe constant-time string compare (node:crypto's timingSafeEqual is
 * unavailable in the middleware runtime). False when either side is empty,
 * so an unset CRON_SECRET can never be matched by an empty header.
 */
function edgeTimingSafeEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Server-to-server Puppeteer render of a report page, sent by a PDF route with
 * the x-ara-internal header (CRON_SECRET). Those routes have ALREADY
 * authorized their caller (requireAssessmentOwner / guardReflectEngagementAccess
 * - both of which admit a portal client_manager for their own org) - but the
 * confinement below would 302 the render to /portal before the page's own
 * gate could run, so the delivered "PDF" was a print of the portal dashboard.
 * Narrowly scoped: only the known report page paths, only with the exact secret.
 */
const INTERNAL_RENDER_PATHS = [
  /^\/ara\/consultant\/assessments\/[^/]+\/report$/,
  /^\/reflect\/consultant\/participants\/[^/]+\/report$/,
  /^\/reflect\/consultant\/engagements\/[^/]+\/cohort-report$/,
  /^\/reflect\/consultant\/engagements\/[^/]+\/framework-preview$/,
];
function isInternalReportRender(request: NextRequest): boolean {
  const p = request.nextUrl.pathname;
  if (!INTERNAL_RENDER_PATHS.some((re) => re.test(p))) return false;
  return edgeTimingSafeEqual(request.headers.get("x-ara-internal"), process.env.CRON_SECRET);
}

/**
 * For otherwise-public PAGE routes (the marketing landings) that are bypassed
 * before updateSession: anonymous prospects and VIFM staff see them unchanged,
 * but a signed-in client_manager is bounced to their own /portal. Returns a
 * redirect response for a client_manager, or null to let the request continue.
 */
export async function redirectIfClientManager(request: NextRequest): Promise<NextResponse | null> {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll() {
          /* read-only role probe - no cookie writes */
        },
      },
    }
  );
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null; // anonymous - keep the public route public
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
  return null;
}

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
      // Path-BOUNDARY match (not a loose prefix): admit the Techno results list
      // and its [token] detail, but NOT a hypothetical sibling like
      // /admin/tech-sandbox/results-export that a bare startsWith would leak. The
      // admin layout admits a client_manager on the strength of this confinement,
      // so a new sibling must be added here deliberately, with its own org gate.
      p === "/admin/tech-sandbox/results" ||
      p.startsWith("/admin/tech-sandbox/results/") ||
      // Puppeteer render of the report page for an already-authorized PDF
      // request (see isInternalReportRender) - a client_manager's own cookies
      // ride along, so the confinement below would otherwise 302 it to /portal
      // and the PDF became a print of the portal dashboard.
      isInternalReportRender(request);
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
