import "server-only";
import type { Browser } from "puppeteer";
import { createServiceClient } from "@/lib/supabase/server";
import { computeComposite } from "@/lib/prehire/scoring";
import { renderPrehireCandidateHtml, type PrehireReportData } from "@/lib/reports/prehire-candidate-html";
import type { PrehireStagePlanEntry, PrehireStageKind } from "@/types/prehire";

/**
 * Shared builder for the per-candidate Pre-Hire screening PDF. Used by BOTH the
 * admin download route and the "email report to client" server action, so the
 * report is identical wherever it's produced. Service-client reads (admin-gated
 * by the callers); pure Puppeteer (bundled Chromium) like the ARA/Reflect PDFs.
 */

type Lang = "en" | "ar";

const STAGE_LABELS: Record<string, { en: string; ar: string }> = {
  quiz: { en: "Aptitude & Knowledge", ar: "المعرفة والقدرات" },
  fluent: { en: "English (Fluent)", ar: "الإنجليزية (Fluent)" },
  cbi: { en: "Behavioural Interview", ar: "المقابلة السلوكية" },
  assessment_center: { en: "Assessment Center", ar: "مركز التقييم" },
};

async function launchBrowser(): Promise<Browser> {
  const puppeteer = (await import("puppeteer")).default;
  return puppeteer.launch({
    headless: true,
    defaultViewport: { width: 1200, height: 1400, deviceScaleFactor: 1 },
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  }) as unknown as Browser;
}

export type PrehirePdfResult =
  | { ok: true; pdf: Buffer; filename: string; data: PrehireReportData }
  | { ok: false; status: number; error: string };

/** Load → score → render → Puppeteer the per-candidate report. */
export async function buildPrehireCandidatePdf(params: {
  requisitionId: string;
  candidateId: string;
  lang: Lang;
}): Promise<PrehirePdfResult> {
  const { requisitionId, candidateId, lang } = params;
  const sb = createServiceClient();

  const [reqRes, candRes] = await Promise.all([
    sb
      .from("prehire_requisitions")
      .select("title, level, stage_config, organizations(name)")
      .eq("id", requisitionId)
      .maybeSingle(),
    sb
      .from("prehire_candidates")
      .select("full_name, email, prehire_stage_results(kind, normalized_score)")
      .eq("id", candidateId)
      .eq("requisition_id", requisitionId)
      .maybeSingle(),
  ]);

  if (!reqRes.data || !candRes.data) {
    return { ok: false, status: 404, error: "Candidate or requisition not found" };
  }

  // Custom fields (00061) — separate best-effort read (tolerant pre-migration).
  let employeeId: string | null = null;
  const { data: customRow } = await sb
    .from("prehire_candidates")
    .select("custom_fields")
    .eq("id", candidateId)
    .maybeSingle();
  const cf = (customRow?.custom_fields ?? null) as Record<string, string> | null;
  if (cf && typeof cf === "object" && typeof cf.employee_id === "string") {
    employeeId = cf.employee_id.trim() || null;
  }

  const plan = (reqRes.data.stage_config ?? []) as PrehireStagePlanEntry[];
  const results = (candRes.data.prehire_stage_results ?? []) as {
    kind: PrehireStageKind;
    normalized_score: number | null;
  }[];
  const composite = computeComposite(plan, results);

  const stages = composite.perStage.map((s) => ({
    label: STAGE_LABELS[s.kind]?.[lang] ?? s.kind,
    normalized: s.normalized,
    cutScore: s.cutScore,
    passed: s.passed,
    weightPct: s.weight * 100,
    required: s.required,
  }));

  const data: PrehireReportData = {
    candidateName: (candRes.data.full_name as string) ?? "Candidate",
    candidateEmail: (candRes.data.email as string) ?? "",
    employeeId,
    requisitionTitle: (reqRes.data.title as string) ?? "Role",
    level: (reqRes.data.level as string | null) ?? null,
    orgName: (reqRes.data.organizations as unknown as { name: string } | null)?.name ?? null,
    composite: composite.composite,
    recommendation: composite.recommendation,
    stages,
    generatedAt: new Date(),
  };

  const html = renderPrehireCandidateHtml(data, lang);

  let browser: Browser | null = null;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0", timeout: 60_000 });
    const out = await page.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true });
    const pdf = Buffer.from(out);
    const filename = `prehire-${candidateId.slice(0, 8)}-${lang}.pdf`;
    return { ok: true, pdf, filename, data };
  } catch (err) {
    return { ok: false, status: 500, error: err instanceof Error ? err.message : "PDF generation failed" };
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}
