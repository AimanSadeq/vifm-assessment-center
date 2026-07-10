import { NextResponse } from "next/server";
import { runRetentionPurge } from "@/lib/ara/retention";
import { timingSafeStrEqual } from "@/lib/utils/secret";

/**
 * Daily retention-purge cron endpoint.
 *
 * Scheduled by `.github/workflows/ara-retention-purge.yml` (GitHub
 * Actions cron) - the workflow fires daily and sends an
 * `Authorization: Bearer <CRON_SECRET>` header pulled from the repo's
 * Actions secrets. The same CRON_SECRET must be set as a Render env
 * var on the vifm-assessment-center service for the route to verify
 * the bearer. Without the env var (e.g. local dev), the route refuses
 * to run, preventing accidental purges from a stray browser fetch.
 *
 * History: the original deployment was on Vercel, where the cron
 * lived in `vercel.json`. After the move to Render the vercel.json
 * was effectively no-op, so the cron became admin-triggered until
 * the GitHub Actions workflow was wired in. The endpoint accepts the
 * same bearer header from either trigger, so a future move back to
 * Vercel or to Render Cron Jobs needs zero code change.
 *
 * Body: { ok: true, deleted: N, trigger: 'cron' } on success;
 *       { ok: false, error: '...' } on failure.
 *
 * Logs every purged assessment to `ara_data_management_log` with
 * `trigger: cron` in the reason field for downstream traceability.
 */
export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "CRON_SECRET env var is not set. The cron endpoint is intentionally locked down until you set this in your Vercel project - set it to a long random string and rotate it as you would any secret.",
      },
      { status: 503 }
    );
  }

  // Vercel Cron auto-attaches the bearer; manual cron runners (e.g. a
  // simple Supabase scheduled function via pg_cron) can also send it.
  const auth = request.headers.get("authorization") ?? "";
  if (!timingSafeStrEqual(auth, `Bearer ${expected}`)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  try {
    const result = await runRetentionPurge("cron");
    if (!result.ok) {
      return NextResponse.json(result, { status: 500 });
    }
    return NextResponse.json({ ...result, trigger: "cron" }, { status: 200 });
  } catch (err) {
    console.error("[retention-cron] unexpected failure:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "unexpected error" },
      { status: 500 }
    );
  }
}
