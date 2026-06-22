/**
 * GET /api/admin/proctor/[sessionId]/report -> Proctoring & Integrity Report PDF.
 *
 * Deliberately OUTSIDE the middleware-bypassed /api/proctor/* prefix (which is
 * open for the anonymous capture endpoints): this report carries face snapshots
 * (sensitive PII), so it must stay session-gated by middleware AND role-gated by
 * the route - the same precaution as the Pre-Hire ATS export. Admin only.
 */
import { NextResponse } from "next/server";
import { requireRole, isAuthorizationError } from "@/lib/ara/auth-guards";
import { getSessionWithSnapshots } from "@/lib/proctor/access";
import { proctoringReportHtml } from "@/lib/reports/proctoring-report-html";
import { renderHtmlToPdfBuffer } from "@/lib/reports/html-to-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { sessionId: string } }) {
  try {
    await requireRole(["admin"]);
  } catch (e) {
    if (isAuthorizationError(e)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    throw e;
  }

  const view = await getSessionWithSnapshots(params.sessionId);
  if (!view) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  try {
    const html = proctoringReportHtml(view);
    const pdf = await renderHtmlToPdfBuffer(html);
    const safe =
      (view.session.subject_name || "session").replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() ||
      "session";
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="proctoring-report-${safe}.pdf"`,
      },
    });
  } catch (err) {
    console.error("[proctor report] generation failed:", err);
    return NextResponse.json({ error: "Could not generate the proctoring report." }, { status: 500 });
  }
}
