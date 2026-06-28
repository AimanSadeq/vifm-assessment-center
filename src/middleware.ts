import { NextResponse, type NextRequest } from "next/server";
import { updateSession, redirectIfClientManager } from "@/lib/supabase/middleware";
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

// Public ARC cohort dashboard - a share-by-link, read-only client view keyed
// by the assessment UUID (no PII; gated server-side to Mode C assessments). The
// page is designed as a share-by-link credential, so bypass auth like redeem.
const isAraCohortRoute = (pathname: string) =>
  pathname.startsWith("/ara/cohort/");

// Public ARC methodology brief PDF - static methodology content, linked from
// the no-account report + cohort + personal-results surfaces. No PII.
const isAraMethodologyRoute = (pathname: string) =>
  pathname === "/api/ara/methodology/pdf";

// Personal AI Readiness snapshot - anonymous Mode A start + the token-gated
// results page + the token-gated results PDF. No account: the unguessable token
// plus handler-level gating (eligibility, completion, client visibility) protect
// them. Without this, the server-side completion task that fetches the PDF to
// attach to the results email gets redirected to /login and attaches the login
// HTML as a corrupt "PDF" - and real delegates can't open their results at all.
const isAraPersonalRoute = (pathname: string) =>
  pathname.startsWith("/ara/personal/") || pathname.startsWith("/api/ara/personal/");

// Public ARA top-of-funnel marketing pages - the AI Readiness landing (/ara),
// the "how to engage" funnel (/ara/engage), and the roadmap (/ara/roadmap).
// These are no-account marketing surfaces holding no privileged data; the only
// truly complimentary self-serve path they lead to (the Personal Snapshot at
// /ara/personal/*) is already public above. Without this, a lapsed Supabase
// session bounces a signed-in user - or a genuine prospect - off the funnel to
// /login (the already-rendered /ara page stays visible via the client router
// cache, but clicking through to /ara/engage triggers a fresh server request
// that the middleware redirects). Privileged ARA surfaces (/ara/consultant,
// /ara/admin) are deliberately NOT matched and stay session-gated; the
// consultant CTA on /ara/engage correctly hits /login when signed out.
const isAraMarketingRoute = (pathname: string) =>
  pathname === "/ara" ||
  pathname.startsWith("/ara/engage") ||
  pathname.startsWith("/ara/roadmap");

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

// Public research & validity evidence page - no account; static instrument
// metadata + live item counts (no PII). Shareable with a client / regulator as
// proof the questions are grounded in established research.
const isPublicEvidenceRoute = (pathname: string) =>
  pathname === "/evidence" || pathname.startsWith("/evidence/");

// Public methodology briefs - one branded PDF per service via the generic route
// /api/methodology/[service]/pdf. Static methodology content with no PII, linked
// from the public /evidence hub and the no-account report/results surfaces.
// Bypass auth in dev and prod so a prospect or regulator can open any service's
// brief without an account (mirrors the ARC methodology + evidence routes).
const isPublicMethodologyRoute = (pathname: string) =>
  pathname.startsWith("/api/methodology/");

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
// I-3: scope the API bypass to a UUID-shaped token segment. Every /api/prehire/*
// route lives under /api/prehire/[token]/..., so requiring a 36-char access-token
// segment (the prehire_candidates.access_token shape) means a future route added
// under /api/prehire/ that is NOT token-gated cannot be silently auth-bypassed.
const PREHIRE_API_TOKEN = /^\/api\/prehire\/[0-9a-fA-F-]{36}(\/|$)/;
const isPreHireApplyRoute = (pathname: string) =>
  pathname.startsWith("/prehire/apply/") || PREHIRE_API_TOKEN.test(pathname);

// Pre-Hire voucher redemption - a no-account applicant redeems a code at
// /prehire/redeem; the redeem server action provisions a candidate and forwards
// to /prehire/apply/[token] (already bypassed). This page is NOT under
// /prehire/apply/, so it needs its own bypass.
const isPreHireRedeemRoute = (pathname: string) =>
  pathname === "/prehire/redeem" || pathname.startsWith("/prehire/redeem/");

// Technical sandbox candidate flow - a candidate reaches the performance-based
// assessment via technical_sandbox_sessions.access_token (no account). Identity
// is derived server-side from the token. Bypass auth in dev and prod.
const isTechSandboxRoute = (pathname: string) =>
  pathname.startsWith("/tech-sandbox/") || pathname.startsWith("/api/tech-sandbox/");

// Fluent voucher delegate flow - a no-account delegate redeems a code and takes
// the English placement via a redemption token. Precise paths only: the redeem
// page, the token-gated runner, and the start/score + speech APIs. The
// certificate is NOT public (XP-13: results are not shown to the taker - only an
// admin downloads/sends the report). The bare /ac/fluent runner and admin
// surfaces (cohort, calibration, vouchers) stay session-gated.
const isFluentPublicRoute = (pathname: string) =>
  pathname === "/ac/fluent/redeem" ||
  pathname.startsWith("/ac/fluent/take/") ||
  pathname === "/api/ac/fluent" ||
  pathname === "/api/ac/fluent/transcribe" ||
  pathname === "/api/ac/fluent/tts";

// Cognitive voucher delegate flow - same pattern as Fluent: redeem page,
// token-gated runner, start/score API. The result-report PDF is NOT public
// (XP-13: results are not shown to the taker - only an admin downloads/sends).
const isCognitivePublicRoute = (pathname: string) =>
  pathname === "/ac/cognitive/redeem" ||
  pathname.startsWith("/ac/cognitive/take/") ||
  pathname === "/api/ac/cognitive";

// Persona voucher delegate flow. The runner is driven by server actions (which
// POST to the take-page route), so only the redeem page, the token runner, and
// the result-report PDF need bypassing.
const isPersonaPublicRoute = (pathname: string) =>
  pathname === "/ac/persona/redeem" ||
  pathname.startsWith("/ac/persona/take/") ||
  pathname === "/api/ac/persona/methodology/pdf" ||
  (pathname.startsWith("/api/ac/persona/") && pathname.endsWith("/report"));

// Camera-proctoring capture endpoints - a (no-account) taker's browser posts
// consent + periodic webcam snapshots while taking a proctored test; identity is
// the unguessable session UUID created server-side. The retention cron (Bearer
// CRON_SECRET) also lives here. The admin report (/admin/proctor) is NOT matched
// and stays session-gated.
const isProctorApiRoute = (pathname: string) =>
  pathname.startsWith("/api/proctor/");

// Role Readiness candidate flow (Bespoke Services) - a no-account candidate takes
// the combined Persona + Techno sitting via rr_candidates.access_token. Identity
// is derived server-side from the token. Bypass auth in dev and prod, like the
// Pre-Hire applicant flow.
const isRoleReadinessRoute = (pathname: string) =>
  pathname.startsWith("/role-readiness/apply/") ||
  pathname.startsWith("/role-readiness/redeem") ||
  pathname.startsWith("/api/role-readiness/");

// Public, read-only "Licensed Portal Preview" share link - a no-account
// leave-behind for a prospect. The page renders only representative sample data
// from the URL params (no DB, no real records), so it is safe to expose without
// a session. The admin launcher + the admin /licensed-preview tenant stay
// session-gated; only this /share/preview variant is public.
const isPublicPreviewRoute = (pathname: string) =>
  pathname === "/share/preview" || pathname.startsWith("/share/preview/");

export async function middleware(request: NextRequest) {
  if (
    isProctorApiRoute(request.nextUrl.pathname) ||
    isAraRespondentRoute(request.nextUrl.pathname) ||
    isAraRedeemRoute(request.nextUrl.pathname) ||
    isAraCohortRoute(request.nextUrl.pathname) ||
    isAraMethodologyRoute(request.nextUrl.pathname) ||
    isAraPersonalRoute(request.nextUrl.pathname) ||
    isReflectRaterRoute(request.nextUrl.pathname) ||
    isPublicMethodologyRoute(request.nextUrl.pathname) ||
    isPublicVerifyRoute(request.nextUrl.pathname) ||
    isPreHireApplyRoute(request.nextUrl.pathname) ||
    isPreHireRedeemRoute(request.nextUrl.pathname) ||
    isTechSandboxRoute(request.nextUrl.pathname) ||
    isFluentPublicRoute(request.nextUrl.pathname) ||
    isCognitivePublicRoute(request.nextUrl.pathname) ||
    isPersonaPublicRoute(request.nextUrl.pathname) ||
    isRoleReadinessRoute(request.nextUrl.pathname) ||
    isPublicPreviewRoute(request.nextUrl.pathname)
  ) {
    return NextResponse.next();
  }

  // Public marketing pages (the AI Readiness landing, /courses, /evidence):
  // anonymous prospects and VIFM staff see them unchanged, but a signed-in
  // client_manager is bounced to their own /portal so they stay confined.
  if (
    isAraMarketingRoute(request.nextUrl.pathname) ||
    isPublicCoursesRoute(request.nextUrl.pathname) ||
    isPublicEvidenceRoute(request.nextUrl.pathname)
  ) {
    if (!AUTH_ENABLED) return NextResponse.next();
    const bounce = await redirectIfClientManager(request);
    return bounce ?? NextResponse.next();
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
