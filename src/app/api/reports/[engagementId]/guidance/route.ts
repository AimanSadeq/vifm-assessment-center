import { NextResponse } from "next/server";
import { getCurrentCaller } from "@/lib/ara/auth-guards";
import { getClientOrgId } from "@/lib/auth/get-org-id";
import { createServiceClient } from "@/lib/supabase/server";
import { loadAgreementInput } from "@/lib/reports/centre-agreement-data";
import { buildAgreementPrefill } from "@/lib/reports/centre-agreement-prefill";
import { buildReportGuidanceHtml } from "@/lib/reports/report-guidance";
import { renderHtmlToPdfBuffer } from "@/lib/reports/html-to-pdf";

/**
 * GET /api/reports/[engagementId]/guidance - "Using these results", the note
 * for the client's decision makers that accompanies a centre's reports
 * (BPS 8.4).
 *
 * Access: admin, or a client user of the engagement's own organisation. It
 * holds no participant data (purpose, rating rule, weights, handling rules),
 * but it does describe a client's centre design, so it is not public and not
 * for other organisations. Participants have their own "Using this report"
 * page in each report.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: { engagementId: string } }) {
  const caller = await getCurrentCaller();
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sb = createServiceClient();
  if (caller.role !== "admin") {
    if (caller.role !== "client") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const orgId = await getClientOrgId();
    const { data: eng } = await sb
      .from("engagements")
      .select("organization_id")
      .eq("id", params.engagementId)
      .maybeSingle();
    if (!eng) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (!orgId || eng.organization_id !== orgId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const generatedAt = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const loaded = await loadAgreementInput(sb, params.engagementId, generatedAt);
  if (!loaded) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const html = buildReportGuidanceHtml(buildAgreementPrefill(loaded.input), generatedAt);
    const pdf = await renderHtmlToPdfBuffer(html);
    const safeName = String(loaded.engagement.name ?? "centre").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "");
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Using-these-results-${safeName}.pdf"`,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "PDF generation failed" },
      { status: 500 }
    );
  }
}
