import JSZip from "jszip";
import { createServiceClient } from "@/lib/supabase/server";
import { buildPersonalReportPdf } from "@/lib/reports/personal-report-build";
import { computeCompanyCohortInsight } from "@/lib/ara/company-cohort";
import { cohortZipFilename } from "@/lib/ara/cohort-filenames";

export { safeFileSegment, cohortZipFilename } from "@/lib/ara/cohort-filenames";

/**
 * One ZIP with every completed delegate's Personal AI Readiness Report for a
 * voucher company cohort (the grouping the /ara/admin/vouchers/insights page
 * uses). Ahmad's ask of 19 Oct 2026: a client with 11 vouchers, 11 reports,
 * one download instead of eleven.
 *
 * Each PDF is produced by the same builder as the delegate's own download, so
 * the client receives exactly what the delegate saw. Reports are rendered one
 * at a time: each render opens its own headless browser, and the cohorts are
 * small (a voucher batch, not a workforce). Anything that could not be
 * rendered is listed in a README inside the archive rather than dropped.
 *
 * Authorization is the caller's job (admin only).
 */

/** Hard cap so a mistyped company name cannot turn into a very long render. */
export const COHORT_ZIP_MAX_REPORTS = 60;

export type CohortZipResult =
  | { ok: true; zip: Buffer; filename: string; included: number; skipped: string[] }
  | { ok: false; status: number; error: string };

export async function buildCohortReportsZip(opts: {
  company: string;
  lang?: string | null;
}): Promise<CohortZipResult> {
  const lang: "en" | "ar" = opts.lang === "ar" ? "ar" : "en";
  const insight = await computeCompanyCohortInsight(opts.company);
  if (!insight) return { ok: false, status: 404, error: "No cohort data for this company yet." };

  const completed = insight.respondents.filter((r) => r.completed_at);
  if (completed.length === 0) {
    return { ok: false, status: 404, error: "No delegate in this cohort has completed the assessment yet." };
  }

  const sb = createServiceClient();
  const ids = completed.map((r) => r.respondent_id);
  const { data: tokenRows, error } = await sb
    .from("ara_respondents")
    .select("id, access_token")
    .in("id", ids);
  if (error) return { ok: false, status: 500, error: error.message };
  const rows = (tokenRows ?? []) as { id: string; access_token: string | null }[];
  const tokenById = new Map<string, string | null>(rows.map((r) => [r.id, r.access_token]));

  const zip = new JSZip();
  const taken = new Set<string>();
  const skipped: string[] = [];
  let included = 0;

  const picked = completed.slice(0, COHORT_ZIP_MAX_REPORTS);
  for (const r of completed.slice(COHORT_ZIP_MAX_REPORTS)) {
    skipped.push(`${r.name}: over the limit of ${COHORT_ZIP_MAX_REPORTS} reports per download`);
  }

  for (const r of picked) {
    const token = tokenById.get(r.respondent_id);
    if (!token) {
      skipped.push(`${r.name}: no access token on record`);
      continue;
    }
    try {
      const result = await buildPersonalReportPdf({ token, lang });
      if (!result.ok) {
        skipped.push(`${r.name}: ${result.error}`);
        continue;
      }
      let path = result.filename;
      let n = 2;
      while (taken.has(path)) {
        path = result.filename.replace(/\.pdf$/i, `_${n}.pdf`);
        n += 1;
      }
      taken.add(path);
      zip.file(path, result.pdf);
      included += 1;
    } catch (e) {
      console.error(`[arc cohort zip] ${r.name}:`, e instanceof Error ? e.message : e);
      skipped.push(`${r.name}: the report could not be rendered; try again in a moment`);
    }
  }

  if (included === 0) {
    return { ok: false, status: 500, error: `No report could be rendered. ${skipped[0] ?? ""}`.trim() };
  }

  if (skipped.length > 0) {
    zip.file(
      "README.txt",
      [
        `${insight.company_label}: ${included} report${included === 1 ? "" : "s"} included.`,
        "",
        "Not included:",
        ...skipped.map((s) => `- ${s}`),
        "",
      ].join("\n"),
    );
  }

  const buffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 6 } });
  return { ok: true, zip: buffer, filename: cohortZipFilename(insight.company_label, lang), included, skipped };
}
