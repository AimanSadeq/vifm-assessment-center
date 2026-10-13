"use server";

// Scenario workbook upload for one bundle (00234): check the SME's workbook and
// show the report without writing, then load it. Same checks and response keys
// as scripts/sdc-hipo/load-scenarios.py.
import { revalidatePath } from "next/cache";
import { requireRole, isAuthorizationError } from "@/lib/ara/auth-guards";
import { loadBundleService } from "@/lib/bespoke/services";
import { applyScenarioImport, parseScenarioWorkbook, type ImportReportRow, type ParsedScenarioWorkbook } from "@/lib/bespoke/sjt-import";

const MAX_BYTES = 5 * 1024 * 1024;

async function guard(bundleId: string) {
  try {
    await requireRole(["admin"]);
    const bundle = await loadBundleService(bundleId);
    if (!bundle) return { ok: false as const, error: "Bundle not found." };
    return { ok: true as const };
  } catch (e) {
    if (isAuthorizationError(e)) return { ok: false as const, error: e.message };
    throw e;
  }
}

async function readUpload(formData: FormData): Promise<{ parsed: ParsedScenarioWorkbook } | { error: string }> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose the scenario workbook (.xlsx)." };
  if (!file.name.toLowerCase().endsWith(".xlsx")) return { error: "Only .xlsx workbooks are accepted." };
  if (file.size > MAX_BYTES) return { error: "The workbook is too large (max 5 MB)." };
  const includeReview = formData.get("includeReview") === "true";
  const parsed = await parseScenarioWorkbook(Buffer.from(await file.arrayBuffer()), {
    statuses: includeReview ? ["Approved", "Ready for review"] : ["Approved"],
  });
  return { parsed };
}

export type ScenarioImportPreview = {
  statuses: string[];
  report: ImportReportRow[];
  loadable: number;
  errors: number;
  skipped: number;
  perCompetency: Record<string, number>;
  short: string[];
  fatal: string | null;
};

const preview = (p: ParsedScenarioWorkbook): ScenarioImportPreview => ({
  statuses: p.statuses,
  report: p.report,
  loadable: p.items.length,
  errors: p.report.filter((r) => r.outcome === "error").length,
  skipped: p.report.filter((r) => r.outcome === "skipped").length,
  perCompetency: p.perCompetency,
  short: p.short,
  fatal: p.fatal,
});

/** Check the workbook and return the per-row report. Writes nothing. */
export async function previewScenarioImportAction(
  bundleId: string,
  formData: FormData,
): Promise<{ ok: true; preview: ScenarioImportPreview } | { error: string }> {
  const g = await guard(bundleId);
  if (!g.ok) return { error: g.error };
  const up = await readUpload(formData);
  if ("error" in up) return up;
  return { ok: true, preview: preview(up.parsed) };
}

/** Check the same workbook again and load it: competencies, scenarios, and retire the ones left out. */
export async function applyScenarioImportAction(
  bundleId: string,
  formData: FormData,
): Promise<{ ok: true; preview: ScenarioImportPreview; added: number; updated: number; retired: number } | { error: string }> {
  const g = await guard(bundleId);
  if (!g.ok) return { error: g.error };
  const up = await readUpload(formData);
  if ("error" in up) return up;
  if (up.parsed.fatal) return { error: up.parsed.fatal };
  if (up.parsed.items.length === 0) return { error: "Nothing to load: no row passed the checks for the chosen statuses." };
  const res = await applyScenarioImport(bundleId, up.parsed);
  if ("error" in res) return res;
  revalidatePath(`/admin/bespoke/${bundleId}`);
  return { ok: true, preview: preview(up.parsed), added: res.added, updated: res.updated, retired: res.retired };
}
