import { renderToBuffer } from "@react-pdf/renderer";
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { computeCandidateReadiness } from "@/lib/scoring/readiness-data";
import { READINESS_TIER_META } from "@/lib/scoring/readiness";
import { ReadinessReportPdf, type ReadinessPdfData } from "@/lib/reports/readiness-report";

export const runtime = "nodejs";

// Succession Readiness verdict PDF. Mirrors the on-screen report. Uses the
// service client (the readiness pages are admin-only surfaces); a hard auth
// gate belongs with the AUTH_ENABLED flip (same posture as the Reflect PDFs).
export async function GET(
  _req: Request,
  { params }: { params: { engagementId: string; candidateId: string } },
) {
  try {
    const sb = createServiceClient();
    const { data: cand } = await sb
      .from("candidates")
      .select("id, full_name, engagement_id, engagements(name)")
      .eq("id", params.candidateId)
      .maybeSingle();
    if (!cand || cand.engagement_id !== params.engagementId) {
      return NextResponse.json({ error: "Candidate not found in this engagement" }, { status: 404 });
    }
    const engName = Array.isArray(cand.engagements)
      ? cand.engagements[0]?.name ?? ""
      : (cand.engagements as { name: string } | null)?.name ?? "";

    const r = await computeCandidateReadiness(params.engagementId, params.candidateId);
    const meta = READINESS_TIER_META[r.status];

    const data: ReadinessPdfData = {
      candidateName: (cand.full_name as string) ?? "-",
      engagementName: engName,
      generatedAt: new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }),
      tierLabel: meta.label,
      tierBlurb: meta.blurb,
      status: r.status,
      weightedOthers: r.weightedOthers,
      weightedTarget: r.weightedTarget,
      overallGap: r.overallGap,
      coveragePct: r.coveragePct,
      coveredCount: r.coveredCount,
      totalCount: r.totalCount,
      knockoutApplied: r.knockoutApplied,
      borderline: r.borderline,
      borderlineNote: r.borderlineNote,
      yearLabel: r.yearLabel,
      lowAgreementCount: r.lowAgreementCount,
      competencies: r.competencies.map((c) => ({
        competencyId: c.competencyId,
        name: c.name,
        priority: c.priority,
        othersMean: c.othersMean,
        target: c.target,
        gap: c.gap,
        selfMean: c.selfMean,
        selfFlag: c.selfFlag,
        knockoutTriggered: c.knockoutTriggered,
        covered: c.covered,
        lowAgreement: c.lowAgreement,
      })),
    };

    const buffer = await renderToBuffer(<ReadinessReportPdf data={data} />);
    const safeName = data.candidateName.replace(/[^a-zA-Z0-9\s]/g, "").replace(/\s+/g, "_");
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="VIFM_Readiness_${safeName}.pdf"`,
      },
    });
  } catch (error) {
    console.error("Readiness PDF generation error:", error);
    const message = error instanceof Error ? error.message : "Failed to generate readiness report";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
