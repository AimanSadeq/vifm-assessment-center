import JSZip from "jszip";
import { NextResponse } from "next/server";
import { requireRole, isAuthorizationError } from "@/lib/ara/auth-guards";
import { getServiceActivity } from "@/lib/clients/monitor";
import { portalService, type CaliberService } from "@/lib/clients/portal-services";
import { selfOrigin } from "@/lib/reports/pdf-browser";
import { safeFileSegment } from "@/lib/ara/cohort-filenames";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const MAX_FILES = 60;
const VOUCHER_SERVICES: CaliberService[] = ["fluent", "logica", "persona", "techno"];

/**
 * GET /api/admin/clients/reports-zip?service=fluent|logica|persona|techno&org=<organizations.id>
 *
 * Every completed report of one voucher service for one client, in one ZIP.
 * The report routes are the same admin-gated ones the rows link to; this
 * route calls them on the admin's behalf, forwarding the session cookie, so
 * each PDF is produced by exactly the code that produces the single download.
 * Anything that fails is listed in a README inside the archive. Admin only.
 */
export async function GET(request: Request) {
  try {
    await requireRole(["admin"]);
  } catch (e) {
    if (!isAuthorizationError(e)) throw e;
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const service = (url.searchParams.get("service") ?? "") as CaliberService;
  const org = (url.searchParams.get("org") ?? "").trim();
  if (!VOUCHER_SERVICES.includes(service) || !/^[0-9a-f-]{36}$/i.test(org)) {
    return NextResponse.json({ error: "Choose a service and a client." }, { status: 400 });
  }

  const activity = await getServiceActivity(service, org);
  const rows = activity.rows.slice(0, MAX_FILES);
  if (rows.length === 0) return NextResponse.json({ error: "No completed reports for this service yet." }, { status: 404 });

  const origin = selfOrigin(request.url);
  const cookie = request.headers.get("cookie") ?? "";
  const zip = new JSZip();
  const taken = new Set<string>();
  const skipped: string[] = [];
  let included = 0;

  for (const r of rows) {
    const path = service === "techno" ? `/api/tech-sandbox/${r.id}/report` : r.reportPath;
    try {
      const res = await fetch(`${origin}${path}`, { headers: { cookie }, cache: "no-store" });
      if (!res.ok) {
        skipped.push(`${r.name}: report route returned ${res.status}`);
        continue;
      }
      const buf = Buffer.from(await res.arrayBuffer());
      let name = `${safeFileSegment(r.name, "report")}.pdf`;
      const disposition = res.headers.get("content-disposition") ?? "";
      const m = /filename="([^"]+)"/.exec(disposition);
      if (m?.[1]) name = m[1];
      let unique = name;
      let n = 2;
      while (taken.has(unique)) {
        unique = name.replace(/\.pdf$/i, `_${n}.pdf`);
        n += 1;
      }
      taken.add(unique);
      zip.file(unique, buf);
      included += 1;
    } catch (e) {
      skipped.push(`${r.name}: ${e instanceof Error ? e.message : "could not be fetched"}`);
    }
  }
  if (activity.rows.length > MAX_FILES) skipped.push(`${activity.rows.length - MAX_FILES} more reports beyond the limit of ${MAX_FILES} per download`);
  if (included === 0) return NextResponse.json({ error: `No report could be produced. ${skipped[0] ?? ""}`.trim() }, { status: 500 });
  if (skipped.length > 0) {
    zip.file("README.txt", [`${included} report${included === 1 ? "" : "s"} included.`, "", "Not included:", ...skipped.map((s) => `- ${s}`), ""].join("\n"));
  }

  const buffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 6 } });
  const label = portalService(service)?.label ?? service;
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="VIFM_${safeFileSegment(label)}_Reports.zip"`,
      "Cache-Control": "no-store",
      "X-Reports-Included": String(included),
      "X-Reports-Skipped": String(skipped.length),
    },
  });
}
