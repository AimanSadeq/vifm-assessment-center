import { NextResponse } from "next/server";
import { findCandidateByToken } from "@/lib/prehire/candidate-access";
import { buildPrehireCandidatePdf } from "@/lib/reports/prehire-candidate-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/prehire/[token]/report?lang=en|ar
 *
 * DEMO ONLY. Lets a demo candidate download the screening report on-screen
 * (mirroring the Techno demo). A real screening returns 403 - the report is
 * delivered to the hiring team via /api/admin/prehire, never to the candidate.
 */
export async function GET(req: Request, { params }: { params: { token: string } }) {
  const ctx = await findCandidateByToken(params.token);
  if (!ctx) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  if (!ctx.requisition.is_demo) {
    return NextResponse.json({ ok: false, error: "The report is delivered to the hiring team." }, { status: 403 });
  }

  const lang: "en" | "ar" = new URL(req.url).searchParams.get("lang") === "ar" ? "ar" : "en";
  const result = await buildPrehireCandidatePdf({
    requisitionId: ctx.requisition.id,
    candidateId: ctx.candidate.id,
    lang,
  });
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
  }

  return new NextResponse(result.pdf as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${result.filename}"`,
    },
  });
}
