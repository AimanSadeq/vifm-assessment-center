import { NextResponse } from "next/server";
import { requireRole, isAuthorizationError } from "@/lib/ara/auth-guards";
import { getFiledReport, signedReportUrl } from "@/lib/bespoke/report-filing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * One filed bundle report (00237): redirects to a five-minute signed URL on
 * the private bundle-reports bucket. Admin only. Deliberately OUTSIDE
 * /api/bundle/ (that prefix is middleware-bypassed for the candidate flow).
 */
const UUID_RE = /^[0-9a-fA-F-]{36}$/;

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    await requireRole(["admin"]);
  } catch (e) {
    if (!isAuthorizationError(e)) throw e;
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!UUID_RE.test(params.id)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const file = await getFiledReport(params.id);
  if (!file) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const url = await signedReportUrl(file.storagePath, 300, file.fileName);
  if (!url) return NextResponse.json({ error: "The filed report could not be opened." }, { status: 502 });
  return NextResponse.redirect(url, { status: 302, headers: { "Cache-Control": "no-store" } });
}
