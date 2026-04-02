import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Set to true to enable authentication (production mode)
// Set to false for development bypass
const AUTH_ENABLED = true;

export async function middleware(request: NextRequest) {
  if (!AUTH_ENABLED) {
    // Development mode — allow all access
    return NextResponse.next();
  }

  // Production mode — enforce authentication
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
