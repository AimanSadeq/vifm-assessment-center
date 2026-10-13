import { NextResponse } from "next/server";
import { requireRole, isAuthorizationError, getCurrentCaller } from "@/lib/ara/auth-guards";
import { getClientOrgId } from "@/lib/auth/get-org-id";
import { buildBundleCombinedReport } from "@/lib/reports/bundle-combined";
import { fileBundleReport } from "@/lib/bespoke/report-filing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Combined bundle report (one PDF: cover + Persona + Leadership + Logica).
 * Deliberately OUTSIDE /api/bundle/ - that prefix is middleware-bypassed for the
 * token candidate flow, and this deliverable must stay behind auth: admin (or
 * staff) always; client_manager only for a candidate in their own organisation.
 * The UUID rail rejects junk before any DB read.
 */
const UUID_RE = /^[0-9a-fA-F-]{36}$/;

export async function GET(_req: Request, { params }: { params: { candidateId: string } }) {
  if (!UUID_RE.test(params.candidateId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let clientMgrOrgId: string | null = null;
  let staffId: string | null = null;
  try {
    const staff = await requireRole(["admin", "consultant", "lead_assessor", "associate_assessor"]);
    staffId = staff.isDev ? null : staff.uid;
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

  const built = await buildBundleCombinedReport(params.candidateId);
  if (!built.ok) return NextResponse.json({ error: built.error }, { status: built.status });
  if (clientMgrOrgId && built.organizationId !== clientMgrOrgId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Staff generation files the PDF and moves Completed -> Scored. A client
  // manager's download changes nothing. Filing never fails the download.
  if (!clientMgrOrgId) {
    await fileBundleReport({
      candidateId: params.candidateId,
      kind: "combined",
      fileName: built.fileName,
      buffer: built.buffer,
      actorId: staffId,
    });
  }

  return new NextResponse(new Uint8Array(built.buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${built.fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
