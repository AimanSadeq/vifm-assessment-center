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
