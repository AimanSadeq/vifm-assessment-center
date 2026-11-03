import { NextResponse } from "next/server";
import { getCurrentCaller } from "@/lib/ara/auth-guards";
import { buildCohortReportsZip, buildOrgReportsZip } from "@/lib/ara/cohort-reports";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
export const maxDuration = 120;

/**
 * GET /api/ara/admin/vouchers/zip?company=<label>&language=en|ar
 * GET /api/ara/admin/vouchers/zip?org=<ara_organizations.id>&language=en|ar
 *
 * Every completed delegate's Personal AI Readiness Report for one voucher
 * company cohort, or for every sitting under a client organization, in one
 * ZIP. Admin only, like the pages it sits on.
 */
export async function GET(request: Request) {
  const caller = await getCurrentCaller();
  if (!caller || caller.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const company = (url.searchParams.get("company") ?? "").trim();
  const org = (url.searchParams.get("org") ?? "").trim();
  if (!company && !org) return NextResponse.json({ error: "Choose a company." }, { status: 400 });
  if (org && !/^[0-9a-f-]{36}$/i.test(org)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const lang = url.searchParams.get("language");
    const result = org ? await buildOrgReportsZip({ organizationId: org, lang }) : await buildCohortReportsZip({ company, lang });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return new NextResponse(new Uint8Array(result.zip), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${result.filename}"`,
        "Cache-Control": "no-store",
        "X-Reports-Included": String(result.included),
        "X-Reports-Skipped": String(result.skipped.length),
      },
    });
  } catch (error) {
    console.error("ARC cohort ZIP error:", error);
    if (error instanceof Error && error.message === "PDF_RENDERER_UNAVAILABLE") {
      return NextResponse.json(
        { error: "The PDF renderer is temporarily unavailable. Please try again in a moment." },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to build the ZIP" }, { status: 500 });
  }
}
