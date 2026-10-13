import { NextResponse } from "next/server";
import { requireRole, isAuthorizationError } from "@/lib/ara/auth-guards";
import { loadSdcCohortReport } from "@/lib/reports/sdc-hipo/data";
import { renderSdcGroupHtml } from "@/lib/reports/sdc-hipo/html";
import { renderSdcPdf, safeFilePart } from "@/lib/reports/sdc-hipo/pdf";

// Puppeteer needs the Node runtime, not Edge.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/bundle-progress/[bundleId]/sdc-group
 * SDC High-Potential group report: everyone on the approved list (testers
 * excluded) who has completed, placed on the grid and ranked within grade
 * band. VIFM staff only (admin), under /api/admin/ (never /api/bundle/). Not
 * filed per candidate and changes no status: it is only downloaded.
 */
const UUID_RE = /^[0-9a-fA-F-]{36}$/;

export async function GET(_req: Request, { params }: { params: { bundleId: string } }) {
  try {
    await requireRole(["admin"]);
  } catch (e) {
    if (isAuthorizationError(e)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    throw e;
  }
  if (!UUID_RE.test(params.bundleId)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let built: Awaited<ReturnType<typeof loadSdcCohortReport>>;
  try {
    built = await loadSdcCohortReport(params.bundleId);
  } catch (err) {
    console.error("[sdc group] load failed", err);
    return NextResponse.json({ error: "Could not load the cohort results." }, { status: 500 });
  }
  if (!built.ok) return NextResponse.json({ error: built.error }, { status: built.status });
  if (built.data.people.length === 0) {
    return NextResponse.json({ error: "Nobody on the approved list has completed the assessment yet." }, { status: 400 });
  }

  let buffer: Buffer;
  try {
    buffer = await renderSdcPdf(renderSdcGroupHtml(built.data));
  } catch (err) {
    console.error("[sdc group pdf]", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "PDF generation failed" }, { status: 500 });
  }
  const stamp = new Date().toISOString().slice(0, 10);
  const fileName = `SDC_HiPo_Group_Report_${safeFilePart(built.data.bundleName, "Assessment")}_${stamp}.pdf`;
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
