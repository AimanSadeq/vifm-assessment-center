import { NextRequest, NextResponse } from "next/server";
import type { Browser } from "puppeteer";
import { requireRole, isAuthorizationError } from "@/lib/ara/auth-guards";
import { createServiceClient } from "@/lib/supabase/server";
import { getServerLocale } from "@/lib/i18n/server";
import { computeComposite } from "@/lib/prehire/scoring";
import { renderPrehireCandidateHtml, type PrehireReportData } from "@/lib/reports/prehire-candidate-html";
import type { PrehireStagePlanEntry, PrehireStageKind } from "@/types/prehire";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

/**
 * GET /api/admin/prehire/[id]/candidate/[candidateId]/report?lang=en|ar
 * Admin-only. Per-candidate Pre-Hire screening report (advisory composite +
 * per-stage scores). Deliberately under /api/admin (NOT /api/prehire, which is
 * auth-bypassed) so candidate PII can't leak.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string; candidateId: string } }
) {
  try {
    await requireRole(["admin"]);
  } catch (err) {
    if (isAuthorizationError(err)) return NextResponse.json({ ok: false, error: err.message }, { status: 403 });
    throw err;
  }

  const urlLang = new URL(req.url).searchParams.get("lang");
  const lang = urlLang === "ar" ? "ar" : urlLang === "en" ? "en" : await getServerLocale();

  const sb = createServiceClient();
  const [reqRes, candRes] = await Promise.all([
    sb
      .from("prehire_requisitions")
      .select("title, level, stage_config, organizations(name)")
      .eq("id", params.id)
      .maybeSingle(),
    sb
      .from("prehire_candidates")
      .select("full_name, email, prehire_stage_results(kind, normalized_score)")
      .eq("id", params.candidateId)
      .eq("requisition_id", params.id)
      .maybeSingle(),
  ]);

  if (!reqRes.data || !candRes.data) {
    return NextResponse.json({ ok: false, error: "Candidate or requisition not found" }, { status: 404 });
  }

  // Custom fields (00061) — separate best-effort read so a pre-migration DB
  // (no custom_fields column) can't 404 the whole report.
  let employeeId: string | null = null;
  const { data: customRow } = await sb
    .from("prehire_candidates")
    .select("custom_fields")
    .eq("id", params.candidateId)
    .maybeSingle();
  const cf = (customRow?.custom_fields ?? null) as Record<string, string> | null;
  if (cf && typeof cf === "object" && typeof cf.employee_id === "string") {
    employeeId = cf.employee_id.trim() || null;
  }

  const plan = (reqRes.data.stage_config ?? []) as PrehireStagePlanEntry[];
  const results = ((candRes.data.prehire_stage_results ?? []) as { kind: PrehireStageKind; normalized_score: number | null }[]);
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
    const pdf = await page.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true });
    const filename = `prehire-${params.candidateId.slice(0, 8)}-${lang}.pdf`;
    return new NextResponse(pdf as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error("[prehire candidate report]", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "PDF generation failed" },
      { status: 500 }
    );
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}
