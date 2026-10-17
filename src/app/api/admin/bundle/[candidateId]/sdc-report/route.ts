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

const escapeHtml = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c);

/**
 * The report links open in a new tab, so a refusal is read by a person, not a
 * program: a short page instead of raw JSON. No script, so it needs no CSP
 * allowance; the reader closes the tab and goes back to the progress table.
 */
function problemPage(message: string, status: number) {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Report not available</title><style>body{margin:0;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;background:#f6f8fb;color:#1f2937}main{max-width:520px;margin:12vh auto;padding:28px 32px;background:#fff;border:1px solid #e5e7eb;border-radius:12px}h1{font-size:18px;margin:0 0 10px;display:flex;align-items:center;gap:10px}p{margin:0 0 12px;line-height:1.5}.muted{color:#6b7280;font-size:13px}</style></head><body><main><h1><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#b45309" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>Report not available</h1><p>${escapeHtml(message)}</p><p class="muted">Close this tab and use the progress table on the assessment page.</p></main></body></html>`;
  return new NextResponse(html, { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}

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
    return problemPage("The report kind must be summary or idp.", 400);
  }
  const kind = KINDS[kindKey];

  const built = await loadSdcCandidateReport(params.candidateId);
  if (!built.ok) return problemPage(built.error, built.status);

  let buffer: Buffer;
  try {
    buffer = await renderSdcPdf(kind.render(built.data));
  } catch (err) {
    console.error("[sdc report pdf]", err);
    return problemPage("The PDF could not be generated. Please try again in a minute; if it persists, tell Aiman.", 500);
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
