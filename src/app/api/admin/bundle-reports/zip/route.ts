import { NextResponse } from "next/server";
import { requireRole, isAuthorizationError } from "@/lib/ara/auth-guards";
import { buildReportsZip, loadFiledReports } from "@/lib/bespoke/report-filing";
import { zipDownloadName } from "@/lib/bespoke/report-filing-paths";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ZIP of filed bundle reports (00237), foldered {Company}/{Assessment}/...
 *   ?org=<uuid | unassigned>   one company (or reports with no company)
 *   &bundle=<uuid>             narrows to one assessment
 * At least one is required. Admin only; OUTSIDE /api/bundle/ (middleware-bypassed).
 */
const UUID_RE = /^[0-9a-fA-F-]{36}$/;

export async function GET(req: Request) {
  try {
    await requireRole(["admin"]);
  } catch (e) {
    if (!isAuthorizationError(e)) throw e;
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const sp = new URL(req.url).searchParams;
  const org = sp.get("org");
  const bundle = sp.get("bundle");
  if (!org && !bundle) return NextResponse.json({ error: "Choose a company or an assessment." }, { status: 400 });
  if ((org && org !== "unassigned" && !UUID_RE.test(org)) || (bundle && !UUID_RE.test(bundle))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const rows = await loadFiledReports({
    ...(org ? { organizationId: org === "unassigned" ? null : org } : {}),
    ...(bundle ? { bundleId: bundle } : {}),
  });
  if (rows.length === 0) return NextResponse.json({ error: "No filed reports here yet." }, { status: 404 });

  const buffer = await buildReportsZip(rows);
  const name = zipDownloadName(org ? rows[0].orgName : null, bundle ? rows[0].bundleName : null);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
}
