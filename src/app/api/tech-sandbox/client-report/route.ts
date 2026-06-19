/**
 * Technical client report - structured payload export (admin-gated).
 *
 *   GET /api/tech-sandbox/client-report?company=<name>&format=json|csv
 *
 * Returns the full Company -> Project aggregation payload as JSON (the shape a
 * reporting template consumes), or a flat CSV of the company-level skill
 * profiles for Excel. Admin-only (service-role reads), force-dynamic.
 */
import { NextResponse } from "next/server";
import { requireRole, isAuthorizationError } from "@/lib/ara/auth-guards";
import { buildClientReport } from "@/lib/reports/tech-aggregation/aggregate";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    await requireRole(["admin"]);
  } catch (e) {
    if (isAuthorizationError(e)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    throw e;
  }

  const url = new URL(req.url);
  const company = (url.searchParams.get("company") ?? "").trim();
  const format = (url.searchParams.get("format") ?? "json").toLowerCase();
  if (!company) return NextResponse.json({ error: "Missing company" }, { status: 400 });

  const report = await buildClientReport(company, { generatedAt: new Date().toISOString() });
  if (!report) return NextResponse.json({ error: "No data for this company" }, { status: 404 });

  const safe = report.company_label.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() || "company";

  if (format === "csv") {
    const esc = (v: string | number) => {
      const s = String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [
      "level,domain,average_pct,highest_pct,lowest_pct,n,below_baseline",
      ...report.company_metrics.skill_profiles.map((p) => {
        const gap = report.company_metrics.skill_gaps.find((g) => g.domainKey === p.domainKey);
        return ["Company", p.domainLabel, p.averagePct, p.highestPct, p.lowestPct, p.n, gap ? "yes" : "no"].map(esc).join(",");
      }),
      ...report.projects.flatMap((proj) =>
        proj.project_metrics.skill_profiles.map((p) => {
          const gap = proj.project_metrics.skill_gaps.find((g) => g.domainKey === p.domainKey);
          return [proj.project_label, p.domainLabel, p.averagePct, p.highestPct, p.lowestPct, p.n, gap ? "yes" : "no"].map(esc).join(",");
        })
      ),
    ];
    // UTF-8 BOM so Excel reads it correctly.
    return new NextResponse("﻿" + lines.join("\n"), {
      headers: {
        "Content-Type": "text/csv;charset=utf-8;",
        "Content-Disposition": `attachment; filename="tech-client-report-${safe}.csv"`,
      },
    });
  }

  return new NextResponse(JSON.stringify(report, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="tech-client-report-${safe}.json"`,
    },
  });
}
