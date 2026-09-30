import { NextResponse } from "next/server";
import { requireRole, isAuthorizationError } from "@/lib/ara/auth-guards";
import { createServiceClient } from "@/lib/supabase/server";
import { loadEngagementEvidence } from "@/lib/ac/evidence-data";
import { buildEvidencePackHtml } from "@/lib/reports/evidence-pack-html";
import { renderHtmlToPdfBuffer } from "@/lib/reports/html-to-pdf";

/**
 * GET /api/admin/engagements/[id]/evidence-pack - the validity evidence pack
 * for one centre (BPS 3.10, 9.9). Admin-gated: it is VIFM's document to give
 * a client, and it carries the design and the fairness table.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    await requireRole(["admin"]);
  } catch (e) {
    if (isAuthorizationError(e)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    throw e;
  }
  const sb = createServiceClient();
  const evidence = await loadEngagementEvidence(sb, params.id);
  if (!evidence) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const generatedAt = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
    const pdf = await renderHtmlToPdfBuffer(buildEvidencePackHtml(evidence, generatedAt));
    const safeName = String(evidence.engagement.name ?? "centre").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "");
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Evidence-pack-${safeName}.pdf"`,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "PDF generation failed" }, { status: 500 });
  }
}
