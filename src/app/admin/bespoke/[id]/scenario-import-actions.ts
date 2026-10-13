"use server";

// Scenario workbook upload for one bundle (00234): check the SME's workbook and
// show the report without writing, then load it. Same checks and response keys
// as scripts/sdc-hipo/load-scenarios.py.
import { revalidatePath } from "next/cache";
import { requireRole, isAuthorizationError } from "@/lib/ara/auth-guards";
import { loadBundleService } from "@/lib/bespoke/services";
import {
  applyScenarioImport, parseScenarioWorkbook, scenarioImportImpact,
  type ImportReportRow, type ParsedScenarioWorkbook, type ScenarioImportImpact,
} from "@/lib/bespoke/sjt-import";

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
  // The Status values to load, chosen by the admin from those in the workbook.
  const statuses = String(formData.get("statuses") ?? "")
    .split("\n")
    .map((s) => s.trim().slice(0, 60))
    .filter(Boolean)
    .slice(0, 20);
  const parsed = await parseScenarioWorkbook(Buffer.from(await file.arrayBuffer()), {
    statuses: statuses.length ? statuses : ["Approved"],
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
  statusCounts: Record<string, number>;
  /** What loading would change in the live bundle (null when nothing is loadable). */
  impact: ScenarioImportImpact | null;
  /** Set when loading is refused: real candidates have started and the load would change or retire scenarios. */
  blocked: string | null;
};

// Once real candidates have started, the wording they see must not change under
// them: a new version belongs in a new assessment. Testers' sittings do not block.
const blockReason = (impact: ScenarioImportImpact | null): string | null =>
  impact && impact.startedCandidates > 0 && impact.changed.length + impact.retired.length > 0
    ? `${impact.startedCandidates} candidate${impact.startedCandidates === 1 ? " has" : "s have"} already started the scenario section, so existing scenarios cannot be changed or retired now. Only new scenarios can be added; put a revised set in a new assessment.`
    : null;

const preview = (p: ParsedScenarioWorkbook, impact: ScenarioImportImpact | null): ScenarioImportPreview => ({
  impact,
  blocked: blockReason(impact),
  statuses: p.statuses,
  report: p.report,
  loadable: p.items.length,
  errors: p.report.filter((r) => r.outcome === "error").length,
  skipped: p.report.filter((r) => r.outcome === "skipped").length,
  perCompetency: p.perCompetency,
  short: p.short,
  fatal: p.fatal,
  statusCounts: p.statusCounts,
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
  const impact = !up.parsed.fatal && up.parsed.items.length > 0 ? await scenarioImportImpact(bundleId, up.parsed) : null;
  return { ok: true, preview: preview(up.parsed, impact) };
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
  const impact = await scenarioImportImpact(bundleId, up.parsed);
  const blocked = blockReason(impact);
  if (blocked) return { error: blocked };
  const res = await applyScenarioImport(bundleId, up.parsed);
  if ("error" in res) return res;
  revalidatePath(`/admin/bespoke/${bundleId}`);
  return { ok: true, preview: preview(up.parsed, impact), added: res.added, updated: res.updated, retired: res.retired };
}
