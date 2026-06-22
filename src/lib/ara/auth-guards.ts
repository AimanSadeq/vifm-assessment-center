import { createClient, createServiceClient } from "@/lib/supabase/server";
import { AUTH_ENABLED } from "@/lib/auth/config";

// ─────────────────────────────────────────────────────────────
// ARA-specific auth helpers for server actions and API routes.
//
// When AUTH_ENABLED is false (dev mode), these helpers return a
// synthetic admin identity so existing flows keep working without a
// real Supabase session. When auth flips on in production, the same
// call sites enforce real role + ownership checks.
//
// Usage inside a server action:
//   const caller = await requireRole(["admin"]);
//   const caller = await requireRole(["admin", "consultant"]);
//   await requireAssessmentOwner(assessmentId); // admin or assessment owner
// ─────────────────────────────────────────────────────────────

export type AraCallerRole =
  | "admin"
  | "consultant"
  | "lead_assessor"
  | "associate_assessor"
  | "candidate"
  | "client"
  | "client_manager";

export type AraCaller = {
  uid: string;
  role: AraCallerRole;
  /** True when auth is disabled and the caller is a synthetic dev admin. */
  isDev: boolean;
};

export class AuthorizationError extends Error {
  readonly kind = "authorization" as const;
  constructor(message: string) {
    super(message);
    this.name = "AuthorizationError";
  }
}

/**
 * Resolve the current caller from the Supabase session cookie.
 * Returns null when unauthenticated AND auth is enabled.
 * Returns a dev-admin stub when auth is disabled.
 */
export async function getCurrentCaller(): Promise<AraCaller | null> {
  if (!AUTH_ENABLED) {
    return {
      uid: "00000000-0000-0000-0000-000000000000",
      role: "admin",
      isDev: true,
    };
  }

  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;

  // Read the role from the profiles table (same shape the AC portal uses).
  // Use the service client to bypass potential RLS recursion on profiles.
  const sv = createServiceClient();
  const { data: profile } = await sv
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle<{ role: AraCallerRole }>();

  if (!profile) return null;
  return { uid: user.id, role: profile.role, isDev: false };
}

/**
 * True when the caller is VIFM staff (admin / consultant / assessor) - i.e. NOT
 * an anonymous taker, delegate, candidate or client. Used to decide whether to
 * show on-screen assessment results: staff see results, takers see a thank-you.
 * Returns false for unauthenticated callers (when auth is on).
 */
export async function isStaffCaller(): Promise<boolean> {
  const c = await getCurrentCaller();
  return (
    !!c &&
    (c.role === "admin" || c.role === "consultant" || c.role === "lead_assessor" || c.role === "associate_assessor")
  );
}

/**
 * Throws AuthorizationError unless the caller's role is in `allowed`.
 * Accepts a single role or an array.
 */
export async function requireRole(
  allowed: AraCallerRole | AraCallerRole[]
): Promise<AraCaller> {
  const caller = await getCurrentCaller();
  if (!caller) throw new AuthorizationError("Not authenticated");

  const allowedArr = Array.isArray(allowed) ? allowed : [allowed];
  if (!allowedArr.includes(caller.role)) {
    throw new AuthorizationError(
      `Requires role: ${allowedArr.join(" or ")}. Caller is ${caller.role}.`
    );
  }
  return caller;
}

/**
 * Admins: always allowed.
 * Consultants: allowed only if they own the given assessment.
 * Anything else: denied.
 */
export async function requireAssessmentOwner(
  assessmentId: string
): Promise<AraCaller> {
  const caller = await requireRole(["admin", "consultant"]);
  if (caller.role === "admin") return caller;

  // Dev mode admin stub already returned above; this branch is only
  // consultant role in real auth.
  const sv = createServiceClient();
  const { data: assessment } = await sv
    .from("ara_assessments")
    .select("consultant_id")
    .eq("id", assessmentId)
    .maybeSingle<{ consultant_id: string | null }>();

  if (!assessment) throw new AuthorizationError("Assessment not found");
  if (assessment.consultant_id !== caller.uid) {
    throw new AuthorizationError("Not the assessment owner");
  }
  return caller;
}

/**
 * Admins: always allowed.
 * Consultants: allowed if they created the org OR if they have any
 * assessment against that org.
 */
export async function requireOrgAccess(orgId: string): Promise<AraCaller> {
  const caller = await requireRole(["admin", "consultant"]);
  if (caller.role === "admin") return caller;

  const sv = createServiceClient();
  const { data: org } = await sv
    .from("ara_organizations")
    .select("id, created_by")
    .eq("id", orgId)
    .maybeSingle<{ id: string; created_by: string | null }>();
  if (!org) throw new AuthorizationError("Organization not found");

  if (org.created_by === caller.uid) return caller;

  const { data: assessment } = await sv
    .from("ara_assessments")
    .select("id")
    .eq("organization_id", orgId)
    .eq("consultant_id", caller.uid)
    .limit(1)
    .maybeSingle<{ id: string }>();
  if (assessment) return caller;

  throw new AuthorizationError("Not permitted on this organization");
}

/**
 * Helper used by API routes to return a JSON 401/403 on auth failure
 * rather than a 500. Usage:
 *   try { await requireRole(...); ... }
 *   catch (e) { return authErrorResponse(e); }
 */
export function isAuthorizationError(e: unknown): e is AuthorizationError {
  return (
    e instanceof AuthorizationError ||
    (typeof e === "object" && e !== null && "kind" in e && (e as any).kind === "authorization")
  );
}
