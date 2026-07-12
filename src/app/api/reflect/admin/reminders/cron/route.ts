import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendReflectRemindersForEngagement } from "@/lib/reflect/rater-actions";
import { timingSafeStrEqual } from "@/lib/utils/secret";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/reflect/admin/reminders/cron
 *
 * Sweeps every Reflect engagement in 'live' status and fires reminders to
 * raters who haven't responded recently. Designed to be called by a
 * GitHub Actions cron (or any HTTPS scheduler) - auth is via a shared
 * CRON_SECRET header, identical to the ARA retention purge pattern.
 *
 * Header:  Authorization: Bearer <CRON_SECRET>
 */
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET not configured" },
      { status: 500 }
    );
  }
  const auth = req.headers.get("authorization") ?? "";
  if (!timingSafeStrEqual(auth, `Bearer ${secret}`)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const sb = createServiceClient();
  const { data: engagements } = await sb
    .from("reflect_engagements")
    .select("id, name")
    .eq("status", "live");

  const summary: Array<{ engagement_id: string; name: string; sent: number; skipped: number }> = [];
  const failed: Array<{ engagement_id: string; name: string; error: string }> = [];
  let totalSent = 0;
  let totalSkipped = 0;

  for (const e of (engagements ?? []) as Array<{ id: string; name: string }>) {
    const res = await sendReflectRemindersForEngagement(e.id);
    if (res.ok) {
      summary.push({ engagement_id: e.id, name: e.name, sent: res.sent, skipped: res.skipped });
      totalSent += res.sent;
      totalSkipped += res.skipped;
    } else {
      // A read/paginate failure for one engagement must be visible - otherwise
      // its raters silently never get reminded and the cron looks healthy.
      failed.push({ engagement_id: e.id, name: e.name, error: res.error });
    }
  }

  // Audit row at the engagement-agnostic level - uses zero-uuid as target so
  // the audit log doesn't violate the not-null constraint on target_id.
  await sb.from("reflect_audit_log").insert({
    action: "cron.reminders_sent",
    target_table: "reflect_engagements",
    target_id: "00000000-0000-0000-0000-000000000000",
    metadata: {
      engagements_processed: (engagements ?? []).length,
      total_sent: totalSent,
      total_skipped: totalSkipped,
      engagements_failed: failed.length,
      failed,
    },
  });

  return NextResponse.json({
    ok: true,
    engagements_processed: (engagements ?? []).length,
    total_sent: totalSent,
    total_skipped: totalSkipped,
    engagements_failed: failed.length,
    by_engagement: summary,
    failed,
  });
}
