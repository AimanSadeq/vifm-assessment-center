import { NextResponse } from "next/server";
import { getCurrentCaller } from "@/lib/ara/auth-guards";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * Authorisation guard for Reflect 360 report / export API routes.
 * Returns a NextResponse to send on denial, or null when access is allowed.
 *
 * Policy (mirrors the reflect_is_engagement_owner RLS helper):
 *   - admin                 -> allow
 *   - consultant            -> allow only for engagements they own
 *   - anyone else / no user -> 403 / 401
 *
 * Under AUTH_ENABLED=false getCurrentCaller returns a synthetic admin, so the
 * dev flows that drive these report endpoints keep working unchanged.
 */
export async function guardReflectEngagementAccess(
  engagementId: string,
): Promise<NextResponse | null> {
  const caller = await getCurrentCaller();
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (caller.role === "admin") return null;
  if (caller.role !== "consultant") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const sv = createServiceClient();
  const { data: eng } = await sv
    .from("reflect_engagements")
    .select("consultant_id")
    .eq("id", engagementId)
    .maybeSingle<{ consultant_id: string | null }>();
  if (!eng) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return eng.consultant_id === caller.uid
    ? null
    : NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

/**
 * Boolean page-guards (for Server Component pages, which call notFound() on
 * denial rather than returning a NextResponse). Same policy as the API guard:
 * admin -> allow; consultant -> only engagements they own; anyone else -> deny.
 *
 * NOTE: the Puppeteer PDF routes render these pages with no user session, so
 * those routes forward the requesting (already-authorised) user's cookies to
 * Chromium - the page then authorises as that owner. Without forwarded cookies
 * (a direct, unauthorised navigation) the guard denies.
 */
export async function canAccessReflectEngagement(engagementId: string): Promise<boolean> {
  const caller = await getCurrentCaller();
  if (!caller) return false;
  if (caller.role === "admin") return true;
  if (caller.role !== "consultant") return false;
  const sv = createServiceClient();
  const { data: eng } = await sv
    .from("reflect_engagements")
    .select("consultant_id")
    .eq("id", engagementId)
    .maybeSingle<{ consultant_id: string | null }>();
  return !!eng && eng.consultant_id === caller.uid;
}

export async function canAccessReflectParticipant(participantId: string): Promise<boolean> {
  const caller = await getCurrentCaller();
  if (!caller) return false;
  if (caller.role === "admin") return true;
  if (caller.role !== "consultant") return false;
  const sv = createServiceClient();
  const { data: p } = await sv
    .from("reflect_participants")
    .select("engagement_id")
    .eq("id", participantId)
    .maybeSingle<{ engagement_id: string | null }>();
  if (!p?.engagement_id) return false;
  const { data: eng } = await sv
    .from("reflect_engagements")
    .select("consultant_id")
    .eq("id", p.engagement_id)
    .maybeSingle<{ consultant_id: string | null }>();
  return !!eng && eng.consultant_id === caller.uid;
}
