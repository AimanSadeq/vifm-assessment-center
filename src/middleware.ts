import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { AUTH_ENABLED } from "@/lib/auth/config";

// ARA respondent routes use token-based access (no Supabase session).
// The token is validated server-side against ara_respondents.access_token.
// Always bypass auth here, even in production mode.
const isAraRespondentRoute = (pathname: string) =>
  pathname.startsWith("/ara/respond/") || pathname.startsWith("/api/ara/respond/");

// Reflect rater routes follow the same token pattern — rater identity
// is established server-side from reflect_raters.access_token.
const isReflectRaterRoute = (pathname: string) =>
  pathname.startsWith("/reflect/respond/") || pathname.startsWith("/api/reflect/respond/");

// Public training catalogue + quote-request flow. Anyone (no account)
// browses /courses and submits a quote request — the quote-request
// server action persists via the service-role client. Treated like
// the ARA respondent flow: bypass auth in both dev and prod.
const isPublicCoursesRoute = (pathname: string) =>
  pathname === "/courses" || pathname.startsWith("/courses/");

export async function middleware(request: NextRequest) {
  if (
    isAraRespondentRoute(request.nextUrl.pathname) ||
    isReflectRaterRoute(request.nextUrl.pathname) ||
    isPublicCoursesRoute(request.nextUrl.pathname)
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
