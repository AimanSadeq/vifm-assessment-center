import { NextRequest, NextResponse } from "next/server";
import { requireRole, isAuthorizationError } from "@/lib/ara/auth-guards";
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
  try {
    await requireRole(["admin"]);
  } catch (err) {
    if (isAuthorizationError(err)) return NextResponse.json({ ok: false, error: err.message }, { status: 403 });
    throw err;
  }

  const urlLang = new URL(req.url).searchParams.get("lang");
  const lang = urlLang === "ar" ? "ar" : urlLang === "en" ? "en" : await getServerLocale();

  const result = await buildPrehireCandidatePdf({
    requisitionId: params.id,
    candidateId: params.candidateId,
    lang,
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
