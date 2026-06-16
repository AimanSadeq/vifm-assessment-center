import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { AUTH_ENABLED } from "@/lib/auth/config";

// ARA respondent routes use token-based access (no Supabase session).
// The token is validated server-side against ara_respondents.access_token.
// Always bypass auth here, even in production mode.
const isAraRespondentRoute = (pathname: string) =>
  pathname.startsWith("/ara/respond/") || pathname.startsWith("/api/ara/respond/");

// Public voucher redemption - a delegate redeems a practice-access code with no
// account; the code is validated server-side via the ara_voucher_claim RPC.
// Bypass auth in dev and prod, like the ARA respondent flow.
const isAraRedeemRoute = (pathname: string) =>
  pathname === "/ara/redeem" || pathname.startsWith("/ara/redeem/");

// Reflect rater routes follow the same token pattern - rater identity
// is established server-side from reflect_raters.access_token.
const isReflectRaterRoute = (pathname: string) =>
  pathname.startsWith("/reflect/respond/") || pathname.startsWith("/api/reflect/respond/");

// Public training catalogue + quote-request flow. Anyone (no account)
// browses /courses and submits a quote request - the quote-request
// server action persists via the service-role client. Treated like
// the ARA respondent flow: bypass auth in both dev and prod.
const isPublicCoursesRoute = (pathname: string) =>
  pathname === "/courses" || pathname.startsWith("/courses/");

// Public credential verification - anyone can verify a credential by its
// code, no account needed. The /verify page and its API read only
// non-sensitive fields via a service-role helper.
const isPublicVerifyRoute = (pathname: string) =>
  pathname === "/verify" ||
  pathname.startsWith("/verify/") ||
  pathname.startsWith("/api/credentials/verify/");

// Pre-Hire candidate flow - external job applicants reach their screening via
// prehire_candidates.access_token (no account). Identity is always derived
// server-side from the token. Bypass auth in dev and prod, like ARA respondents.
const isPreHireApplyRoute = (pathname: string) =>
  pathname.startsWith("/prehire/apply/") || pathname.startsWith("/api/prehire/");

// Technical sandbox candidate flow - a candidate reaches the performance-based
// assessment via technical_sandbox_sessions.access_token (no account). Identity
// is derived server-side from the token. Bypass auth in dev and prod.
const isTechSandboxRoute = (pathname: string) =>
  pathname.startsWith("/tech-sandbox/") || pathname.startsWith("/api/tech-sandbox/");

// Fluent voucher delegate flow - a no-account delegate redeems a code and takes
// the English placement via a redemption token. Precise paths only: the redeem
// page, the token-gated runner, the start/score + speech APIs, and the
// certificate. The bare /ac/fluent runner and admin surfaces (cohort,
// calibration, vouchers) stay session-gated.
const isFluentPublicRoute = (pathname: string) =>
  pathname === "/ac/fluent/redeem" ||
  pathname.startsWith("/ac/fluent/take/") ||
  pathname === "/api/ac/fluent" ||
  pathname === "/api/ac/fluent/transcribe" ||
  pathname === "/api/ac/fluent/tts" ||
  (pathname.startsWith("/api/ac/fluent/") && pathname.endsWith("/certificate"));

// Cognitive voucher delegate flow - same pattern as Fluent: redeem page,
// token-gated runner, start/score API, and the result-report PDF.
const isCognitivePublicRoute = (pathname: string) =>
  pathname === "/ac/cognitive/redeem" ||
  pathname.startsWith("/ac/cognitive/take/") ||
  pathname === "/api/ac/cognitive" ||
  (pathname.startsWith("/api/ac/cognitive/") && pathname.endsWith("/report"));

// Persona voucher delegate flow. The runner is driven by server actions (which
// POST to the take-page route), so only the redeem page, the token runner, and
// the result-report PDF need bypassing.
const isPersonaPublicRoute = (pathname: string) =>
  pathname === "/ac/persona/redeem" ||
  pathname.startsWith("/ac/persona/take/") ||
  (pathname.startsWith("/api/ac/persona/") && pathname.endsWith("/report"));

export async function middleware(request: NextRequest) {
  if (
    isAraRespondentRoute(request.nextUrl.pathname) ||
    isAraRedeemRoute(request.nextUrl.pathname) ||
    isReflectRaterRoute(request.nextUrl.pathname) ||
    isPublicCoursesRoute(request.nextUrl.pathname) ||
    isPublicVerifyRoute(request.nextUrl.pathname) ||
    isPreHireApplyRoute(request.nextUrl.pathname) ||
    isTechSandboxRoute(request.nextUrl.pathname) ||
    isFluentPublicRoute(request.nextUrl.pathname) ||
    isCognitivePublicRoute(request.nextUrl.pathname) ||
    isPersonaPublicRoute(request.nextUrl.pathname)
  ) {
    return NextResponse.next();
  }

  if (!AUTH_ENABLED) {
    // Development mode - allow all access
    return NextResponse.next();
  }

  // Production mode - enforce authentication
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder assets
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
