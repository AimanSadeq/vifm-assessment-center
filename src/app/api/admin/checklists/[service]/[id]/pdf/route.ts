import { NextResponse } from "next/server";
import { getCurrentCaller } from "@/lib/ara/auth-guards";
import { createServiceClient } from "@/lib/supabase/server";
import { isChecklistService, CHECKLISTS } from "@/lib/checklists/definitions";
import { canManageChecklist, loadChecklist } from "@/lib/checklists/load";
import { buildChecklistHtml } from "@/lib/reports/checklist-html";
import { renderHtmlToPdfBuffer } from "@/lib/reports/html-to-pdf";

/**
 * GET /api/admin/checklists/[service]/[id]/pdf - the engagement checklist as
 * a printable PDF. Admin, or the consultant who owns the engagement (AI
 * Readiness, Reflect 360).
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: { service: string; id: string } }) {
  const caller = await getCurrentCaller();
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isChecklistService(params.service)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const sb = createServiceClient();
  const loaded = await loadChecklist(sb, params.service, params.id);
  if (!loaded) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canManageChecklist(caller, params.service, loaded.subject)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const generatedAt = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
    const pdf = await renderHtmlToPdfBuffer(buildChecklistHtml(loaded.subject, loaded.status, CHECKLISTS[params.service].serviceLabel, generatedAt));
    const safeName = loaded.subject.name.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "");
    return new NextResponse(new Uint8Array(pdf), {
      headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="Checklist-${safeName}.pdf"` },
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "PDF generation failed" }, { status: 500 });
  }
}
