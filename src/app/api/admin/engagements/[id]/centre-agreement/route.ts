import { NextResponse } from "next/server";
import { requireRole, isAuthorizationError } from "@/lib/ara/auth-guards";
import { createServiceClient } from "@/lib/supabase/server";
import { buildAgreementPrefill } from "@/lib/reports/centre-agreement-prefill";
import { loadAgreementInput } from "@/lib/reports/centre-agreement-data";
import { buildCentreAgreementDocx } from "@/lib/reports/centre-agreement-docx";

/**
 * GET /api/admin/engagements/[id]/centre-agreement - the Assessment Centre
 * Agreement and Statement of Work as a Word file, pre-filled from the
 * engagement (BPS 3.21-3.30, 5.10). Word so VIFM can complete the commercial
 * and legal fields and both parties can sign. Admin-gated: it carries the
 * client's name and the centre design, and is a VIFM drafting document.
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
  const generatedAt = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const loaded = await loadAgreementInput(sb, params.id, generatedAt);
  if (!loaded) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const prefill = buildAgreementPrefill(loaded.input);
  const engagement = loaded.engagement;

  try {
    const buf = await buildCentreAgreementDocx(prefill, generatedAt);
    const safeName = String(engagement.name ?? "centre").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "");
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="Centre-agreement-${safeName}.docx"`,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Agreement generation failed" },
      { status: 500 }
    );
  }
}
