/**
 * VIFM Cognitive Ability - professional result report (PDF).
 *
 *   GET /api/ac/cognitive/[resultId]/report  → downloadable PDF
 *
 * Reads the stored result via the service client (psy_results is admin-RLS; the
 * result id is an unguessable uuid handed back to the taker after scoring, mirror
 * of the Fluent certificate). English React-PDF. 404s cleanly if the row/table is
 * absent. Data mapping lives in the shared builder (src/lib/reports/psy-report-data)
 * so the bundle combined report renders the identical document.
 */

import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { requireRole, isAuthorizationError, getCurrentCaller } from "@/lib/ara/auth-guards";
import { getClientOrgId } from "@/lib/auth/get-org-id";
import { PsychometricReport } from "@/lib/reports/psychometric-report";
import { buildPsyReportData } from "@/lib/reports/psy-report-data";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function notFound(): Response {
  return new Response(
    `<!doctype html><meta charset="utf-8"><title>Report not found</title>` +
      `<body style="font-family:system-ui;padding:3rem;color:#010131">` +
      `<h1>Report not available</h1><p>This result could not be found. It may have expired or not been saved.</p></body>`,
    { status: 404, headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

export async function GET(_req: Request, { params }: { params: { resultId: string } }) {
  // XP-13: staff-only. Takers never see their cognitive result; an admin
  // downloads/sends it from the cohort view. Additive: a client_manager may also
  // download, but only for a result in their own organisation.
  let clientMgrOrgId: string | null = null;
  try {
    await requireRole(["admin", "consultant", "lead_assessor", "associate_assessor"]);
  } catch (e) {
    if (!isAuthorizationError(e)) throw e;
    const caller = await getCurrentCaller();
    if (caller?.role === "client_manager") {
      clientMgrOrgId = await getClientOrgId();
      if (!clientMgrOrgId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    } else {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const built = await buildPsyReportData(params.resultId);
  if (!built.ok) return notFound();
  if (clientMgrOrgId && built.organizationId !== clientMgrOrgId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const data = built.data;
  const safeName = data.takerName.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "candidate";
  const buffer = await renderToBuffer(<PsychometricReport data={data} />);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="VIFM-Psychometric-Report-${safeName}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
