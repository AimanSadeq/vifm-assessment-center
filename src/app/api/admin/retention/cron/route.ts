import { NextResponse } from "next/server";
import { runRetentionForAll } from "@/lib/retention/engine";
import { RETENTION_SPECS } from "@/lib/retention/specs";
import { RETENTION_MONTHS } from "@/lib/retention/policy";
import { timingSafeStrEqual } from "@/lib/utils/secret";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Platform-wide retention cron - the thing that actually keeps the 2-year
 * promise.
 *
 * Before this, six of the seven services purged only when an admin remembered
 * to open an admin page and type a confirmation. A retention commitment that
 * depends on someone clicking is not a commitment, so this runs the same one
 * policy across every service on a schedule, exactly as ARC's own cron has
 * always done for assessments.
 *
 * Auth mirrors the ARC cron: `Authorization: Bearer <CRON_SECRET>`, with the
 * secret set both as a Render env var and a GitHub Actions secret. Without the
 * env var the route refuses outright, so a stray browser fetch can never
 * trigger a destructive sweep.
 *
 * `?dryRun=1` reports what WOULD be removed without touching anything - safe to
 * call by hand when you want the numbers.
 *
 * ARC's assessment purge is deliberately NOT invoked here: it has bespoke
 * collateral (Storage files, email log, audit-log entry) and keeps its own
 * cron at /api/ara/admin/retention/cron. This route covers ARC's voucher
 * redemptions, which nothing else ever touched.
 */
export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET is not set; the retention cron is locked down until it is." },
      { status: 503 },
    );
  }

  const auth = request.headers.get("authorization") ?? "";
  if (!timingSafeStrEqual(auth, `Bearer ${expected}`)) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  const dryRun = new URL(request.url).searchParams.get("dryRun") === "1";

  try {
    const results = await runRetentionForAll(RETENTION_SPECS, { dryRun });
    const totals = results.reduce(
      (acc, r) => ({
        deleted: acc.deleted + r.deleted,
        anonymised: acc.anonymised + r.anonymised,
        swept: acc.swept + r.swept,
      }),
      { deleted: 0, anonymised: 0, swept: 0 },
    );
    // Surface step failures rather than reporting a clean run: a service whose
    // purge silently failed is the exact situation this endpoint exists to stop.
    const errors = results.flatMap((r) => r.errors.map((e) => `${r.key}: ${e}`));
    return NextResponse.json({
      ok: errors.length === 0,
      dryRun,
      retentionMonths: RETENTION_MONTHS,
      totals,
      services: results,
      errors,
      trigger: "cron",
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Retention run failed." },
      { status: 500 },
    );
  }
}
