import { NextResponse } from "next/server";
import { purgeExpiredProctorData } from "@/lib/proctor/access";
import { timingSafeStrEqual } from "@/lib/utils/secret";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Daily proctoring retention purge (90-day policy, migration 00147).
 *
 * Scheduled by `.github/workflows/proctor-retention-purge.yml` (GitHub Actions
 * cron), which sends `Authorization: Bearer <CRON_SECRET>`. The same CRON_SECRET
 * must be set as a Render env var. Without it (e.g. local dev) the route refuses
 * to run, preventing accidental purges. Mirrors the ARA retention cron.
 *
 * Deletes proctor_sessions past their expires_at (now + 90d at creation) and the
 * snapshot images in the private `proctor` Storage bucket; proctor_snapshots rows
 * are removed by the FK cascade.
 */
export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET env var is not set; the cron endpoint is locked down until it is." },
      { status: 503 }
    );
  }

  const auth = request.headers.get("authorization") ?? "";
  if (!timingSafeStrEqual(auth, `Bearer ${expected}`)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  try {
    const result = await purgeExpiredProctorData();
    return NextResponse.json({ ok: true, ...result, trigger: "cron" }, { status: 200 });
  } catch (err) {
    console.error("[proctor-retention-cron] unexpected failure:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "unexpected error" },
      { status: 500 }
    );
  }
}
