import { NextRequest, NextResponse } from "next/server";
import { requireRole, isAuthorizationError, getCurrentCaller } from "@/lib/ara/auth-guards";
import { getClientOrgId } from "@/lib/auth/get-org-id";
import { createServiceClient } from "@/lib/supabase/server";
import { getServerLocale } from "@/lib/i18n/server";
import { buildPrehireCandidatePdf } from "@/lib/reports/prehire-candidate-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/prehire/[id]/candidate/[candidateId]/report?lang=en|ar
 * Admin-only. Per-candidate Pre-Hire screening report (advisory composite +
 * per-stage scores). Deliberately under /api/admin (NOT /api/prehire, which is
 * auth-bypassed) so candidate PII can't leak. The PDF itself is built by the
 * shared buildPrehireCandidatePdf() so the download and the "email to client"
 * action produce an identical report.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string; candidateId: string } }
) {
  // Admin-only, plus an additive client_manager branch scoped to their own org.
  let clientMgrOrgId: string | null = null;
  try {
    await requireRole(["admin"]);
  } catch (err) {
    if (!isAuthorizationError(err)) throw err;
    const caller = await getCurrentCaller();
    if (caller?.role === "client_manager") {
      clientMgrOrgId = await getClientOrgId();
      if (!clientMgrOrgId) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    } else {
      return NextResponse.json({ ok: false, error: err.message }, { status: 403 });
    }
  }

  if (clientMgrOrgId) {
    const { data: reqRow } = await createServiceClient()
      .from("prehire_requisitions")
      .select("organization_id")
      .eq("id", params.id)
      .maybeSingle<{ organization_id: string | null }>();
    if (!reqRow || reqRow.organization_id !== clientMgrOrgId) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }
  }

  const sp = new URL(req.url).searchParams;
  const urlLang = sp.get("lang");
  const lang = urlLang === "ar" ? "ar" : urlLang === "en" ? "en" : await getServerLocale();
  const mode = sp.get("view") === "summary" ? "summary" : "full";

  const result = await buildPrehireCandidatePdf({
    requisitionId: params.id,
    candidateId: params.candidateId,
    lang,
    mode,
  });

  if (!result.ok) {
    if (result.status === 500) console.error("[prehire candidate report]", result.error);
    return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
  }

  return new NextResponse(result.pdf as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${result.filename}"`,
    },
  });
}
