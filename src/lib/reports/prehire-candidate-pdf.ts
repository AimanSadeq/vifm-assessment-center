import "server-only";
import type { Browser } from "puppeteer-core";
import { launchPdfBrowser } from "@/lib/reports/pdf-browser";
import { createServiceClient } from "@/lib/supabase/server";
import { computeComposite } from "@/lib/prehire/scoring";
import { getPrehireCertification } from "@/lib/prehire/certification";
import {
  renderPrehireCandidateHtml,
  renderPrehireSummaryHtml,
  type PrehireReportData,
} from "@/lib/reports/prehire-candidate-html";
import {
  FLUENT_SKILLS,
  resolveFluentSkills,
  type PrehireStagePlanEntry,
  type PrehireStageKind,
  type FluentSkill,
} from "@/types/prehire";

/**
 * Shared builder for the per-candidate Pre-Hire screening PDF. Used by BOTH the
 * admin download route and the "email report to client" server action, so the
 * report is identical wherever it's produced. Service-client reads (admin-gated
 * by the callers); pure Puppeteer (bundled Chromium) like the ARA/Reflect PDFs.
 */

type Lang = "en" | "ar";

const STAGE_LABELS: Record<string, { en: string; ar: string }> = {
  quiz: { en: "Competency Quiz", ar: "اختبار الكفاءات" },
  fluent: { en: "English (Fluent®)", ar: "الإنجليزية (Fluent®)" },
  cbi: { en: "Behavioural Interview", ar: "المقابلة السلوكية" },
  assessment_center: { en: "Assessment Center", ar: "مركز التقييم" },
};

// One-line definition of what each stage measures, shown under the stage label
// so the client report explains every row.
const STAGE_DEFINITIONS: Record<string, { en: string; ar: string }> = {
  quiz: {
    en: "Role-relevant knowledge and competency questions, drawn from the requisition's competency set.",
    ar: "أسئلة معرفية وكفاءات متصلة بالوظيفة، مأخوذة من مجموعة كفاءات الطلب الوظيفي.",
  },
  fluent: {
    en: "AI-scored English placement against the CEFR scale (reading, listening, writing, speaking).",
    ar: "تقييم للإنجليزية مصحَّح بالذكاء الاصطناعي وفق مقياس CEFR (قراءة، استماع، كتابة، تحدث).",
  },
  cbi: {
    en: "An AI-led structured behavioural (STAR) interview, AI-scored. The full transcript and the AI's assessment are included below for your review.",
    ar: "مقابلة سلوكية منظَّمة (STAR) يقودها الذكاء الاصطناعي ويصحّحها آليًا. النص الكامل وتقييم الذكاء الاصطناعي مُدرَجان أدناه للمراجعة.",
  },
  assessment_center: {
    en: "Assessment-centre exercises observed and scored by trained assessors.",
    ar: "تمارين مركز تقييم يلاحظها ويصحّحها مقيّمون مدرَّبون.",
  },
};

const FLUENT_SKILL_LABELS: Record<FluentSkill, { en: string; ar: string }> = {
  reading: { en: "Reading", ar: "القراءة" },
  listening: { en: "Listening", ar: "الاستماع" },
  writing: { en: "Writing", ar: "الكتابة" },
  speaking: { en: "Speaking", ar: "التحدث" },
};

const PARTIAL_LABEL: Record<Lang, string> = {
  en: "Partial placement",
  ar: "تقييم جزئي",
};

// Build the "which sub-skills ran" note for the Fluent row. Returns null for a
// full four-skill placement (no note needed). Reads the assessed-skills list
// persisted on the stage detail at submit time (CAL-PRE-503), falling back to
// the requisition's configured skills for older completed rows that predate the
// detail.skills write. A four-skill run is never flagged partial.
function fluentSkillsNote(
  detail: Record<string, unknown> | null | undefined,
  fluentEntry: PrehireStagePlanEntry | undefined,
  lang: Lang
): string | null {
  const fromDetail = Array.isArray(detail?.skills) ? (detail?.skills as FluentSkill[]) : null;
  const skills = fromDetail
    ? resolveFluentSkills({ skills: fromDetail })
    : resolveFluentSkills(fluentEntry);
  if (skills.length >= FLUENT_SKILLS.length) return null;
  const names = skills.map((s) => FLUENT_SKILL_LABELS[s][lang]).join(lang === "ar" ? "، " : ", ");
  return `${PARTIAL_LABEL[lang]} - ${names}`;
}

async function launchBrowser(): Promise<Browser> {
  return launchPdfBrowser({ defaultViewport: { width: 1200, height: 1400, deviceScaleFactor: 1 } });
}

export type PrehirePdfResult =
  | { ok: true; pdf: Buffer; filename: string; data: PrehireReportData }
  | { ok: false; status: number; error: string };

/** Load → score → render → Puppeteer the per-candidate report. */
export async function buildPrehireCandidatePdf(params: {
  requisitionId: string;
  candidateId: string;
  lang: Lang;
  /** "full" = the detailed report (default); "summary" = the 1-page sheet. */
  mode?: "full" | "summary";
}): Promise<PrehirePdfResult> {
  const { requisitionId, candidateId, lang, mode = "full" } = params;
  const sb = createServiceClient();

  const [reqRes, candRes] = await Promise.all([
    sb
      .from("prehire_requisitions")
      .select("title, level, stage_config, organizations(name)")
      .eq("id", requisitionId)
      .maybeSingle(),
    sb
      .from("prehire_candidates")
      .select("full_name, email, prehire_stage_results(kind, normalized_score, detail)")
      .eq("id", candidateId)
      .eq("requisition_id", requisitionId)
      .maybeSingle(),
  ]);

  if (!reqRes.data || !candRes.data) {
    return { ok: false, status: 404, error: "Candidate or requisition not found" };
  }

  // Custom fields (00061) - separate best-effort read (tolerant pre-migration).
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
  const rawResults = (candRes.data.prehire_stage_results ?? []) as {
    kind: PrehireStageKind;
    normalized_score: number | null;
    detail: Record<string, unknown> | null;
  }[];
  // computeComposite only needs kind + normalized_score; detail is read separately.
  const results = rawResults.map(({ kind, normalized_score }) => ({ kind, normalized_score }));
  const composite = computeComposite(plan, results);

  const fluentEntry = plan.find((s) => s.kind === "fluent");
  const fluentDetail = rawResults.find((r) => r.kind === "fluent")?.detail ?? null;

  // CBI (AI interview) transcript + AI assessment. The stage detail stores
  // { history, score }; surface BOTH so the client can read the candidate's
  // actual responses, not just a score - the interview is AI-scored (not
  // human-reviewed), so the transcript is what the client validates.
  type CbiDetailShape = {
    history?: { role?: string; text?: string }[];
    score?: {
      bars_rating?: number; rating_label?: string; rationale?: string;
      strengths?: string[]; development_areas?: string[]; ai_generated?: boolean;
    };
  };
  const cbiD = (rawResults.find((r) => r.kind === "cbi")?.detail ?? null) as unknown as CbiDetailShape | null;
  const cbiHistory = Array.isArray(cbiD?.history) ? cbiD!.history! : [];
  const cbiScore = cbiD?.score ?? null;
  const cbi =
    cbiHistory.length > 0
      ? {
          bars: typeof cbiScore?.bars_rating === "number" ? cbiScore.bars_rating : null,
          ratingLabel: cbiScore?.rating_label ?? null,
          rationale: cbiScore?.rationale ?? null,
          strengths: Array.isArray(cbiScore?.strengths) ? cbiScore!.strengths! : [],
          developmentAreas: Array.isArray(cbiScore?.development_areas) ? cbiScore!.development_areas! : [],
          aiGenerated: cbiScore?.ai_generated ?? true,
          exchanges: cbiHistory.map((m) => ({
            who: (m.role === "candidate" ? "candidate" : "interviewer") as "candidate" | "interviewer",
            text: String(m.text ?? ""),
          })),
        }
      : null;

  const stages = composite.perStage.map((s) => ({
    label: STAGE_LABELS[s.kind]?.[lang] ?? s.kind,
    definition: STAGE_DEFINITIONS[s.kind]?.[lang] ?? null,
    normalized: s.normalized,
    cutScore: s.cutScore,
    passed: s.passed,
    weightPct: s.weight * 100,
    required: s.required,
    // CAL-PRE-503: surface a "partial placement - <skills>" note on the Fluent
    // row when fewer than four sub-skills ran. Only computed once the stage has
    // a score (a not-taken Fluent stage gets no note).
    note:
      s.kind === "fluent" && s.normalized != null
        ? fluentSkillsNote(fluentDetail, fluentEntry, lang)
        : null,
  }));

  const certification = await getPrehireCertification(candidateId);

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
    cbi,
    certification,
    generatedAt: new Date(),
  };

  const html = mode === "summary" ? renderPrehireSummaryHtml(data, lang) : renderPrehireCandidateHtml(data, lang);

  let browser: Browser | null = null;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0", timeout: 60_000 });
    const out = await page.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true });
    const pdf = Buffer.from(out);
    const filename = `prehire-${mode === "summary" ? "summary-" : ""}${candidateId.slice(0, 8)}-${lang}.pdf`;
    return { ok: true, pdf, filename, data };
  } catch (err) {
    return { ok: false, status: 500, error: err instanceof Error ? err.message : "PDF generation failed" };
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}
