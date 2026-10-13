import { NextResponse } from "next/server";
import { requireRole, isAuthorizationError } from "@/lib/ara/auth-guards";
import { fileBundleReport } from "@/lib/bespoke/report-filing";
import { loadSdcCandidateReport } from "@/lib/reports/sdc-hipo/data";
import { renderSdcSummaryHtml, renderSdcIdpHtml } from "@/lib/reports/sdc-hipo/html";
import { renderSdcPdf, safeFilePart } from "@/lib/reports/sdc-hipo/pdf";

// Puppeteer needs the Node runtime, not Edge.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/bundle/[candidateId]/sdc-report?kind=summary|idp
 * SDC High-Potential executive summary or individual development plan for one
 * candidate, from live results. VIFM staff only (admin): no client-manager or
 * portal access. Deliberately OUTSIDE /api/bundle/, which middleware leaves
 * open for the candidate flow. Generating files the PDF and moves the
 * candidate from Completed to Scored; filing never fails the download.
 */
const UUID_RE = /^[0-9a-fA-F-]{36}$/;
const KINDS = {
  summary: { fileKind: "sdc_summary", title: "Executive_Summary", render: renderSdcSummaryHtml },
  idp: { fileKind: "sdc_idp", title: "IDP", render: renderSdcIdpHtml },
} as const;

export async function GET(req: Request, { params }: { params: { candidateId: string } }) {
  let staffId: string | null = null;
  try {
    const staff = await requireRole(["admin"]);
    staffId = staff.isDev ? null : staff.uid;
  } catch (e) {
    if (isAuthorizationError(e)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    throw e;
  }
  if (!UUID_RE.test(params.candidateId)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const kindKey = new URL(req.url).searchParams.get("kind");
  if (kindKey !== "summary" && kindKey !== "idp") {
    return NextResponse.json({ error: "kind must be summary or idp." }, { status: 400 });
  }
  const kind = KINDS[kindKey];

  const built = await loadSdcCandidateReport(params.candidateId);
  if (!built.ok) return NextResponse.json({ error: built.error }, { status: built.status });

  let buffer: Buffer;
  try {
    buffer = await renderSdcPdf(kind.render(built.data));
  } catch (err) {
    console.error("[sdc report pdf]", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "PDF generation failed" }, { status: 500 });
  }
  const fileName = `SDC_HiPo_${kind.title}_${safeFilePart(built.data.name, "Candidate")}.pdf`;

  await fileBundleReport({ candidateId: built.data.candidateId, kind: kind.fileKind, fileName, buffer, actorId: staffId });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
