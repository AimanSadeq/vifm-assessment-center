import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { requireAssessmentOwner, isAuthorizationError } from "@/lib/ara/auth-guards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/ara/reports/[assessmentId]/versions/[reportId]
 *
 * PDF-07/43: download a stored report exactly as it was generated. Same
 * owner gate as generation; the report row must belong to this assessment,
 * and the file is served through a short-lived signed URL from the private
 * ara-reports bucket (never a public link).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { assessmentId: string; reportId: string } },
) {
  if (!UUID.test(params.assessmentId) || !UUID.test(params.reportId)) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }
  try {
    await requireAssessmentOwner(params.assessmentId);
  } catch (err) {
    if (isAuthorizationError(err)) {
      return NextResponse.json({ ok: false, error: err.message }, { status: 403 });
    }
    throw err;
  }

  const sb = createServiceClient();
  const { data: report } = await sb
    .from("ara_reports")
    .select("file_url, language, version")
    .eq("id", params.reportId)
    .eq("assessment_id", params.assessmentId)
    .maybeSingle<{ file_url: string | null; language: string; version: number }>();
  if (!report?.file_url) {
    return NextResponse.json({ ok: false, error: "This report version was not stored." }, { status: 404 });
  }

  const filename = `ara-report-${params.assessmentId.slice(0, 8)}-${report.language}-v${report.version}.pdf`;
  const { data: signed, error } = await sb.storage
    .from("ara-reports")
    .createSignedUrl(report.file_url, 60, { download: filename });
  if (error || !signed?.signedUrl) {
    return NextResponse.json({ ok: false, error: "The stored report could not be retrieved." }, { status: 502 });
  }
  return NextResponse.redirect(signed.signedUrl, 302);
}
