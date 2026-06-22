// Demo-data module for AI Readiness (AR Compass / ARC). Seeds ONE completed
// enterprise-stage org diagnostic against the demo ara_organization, with a
// handful of respondents who each answered a small spread of Layer-1 rating
// questions across all eight pillars - enough that /ara/consultant lists the
// assessment and the detail page shows a real maturity profile (pillar scores +
// overall band) after recalculateAssessmentScores runs.
//
// Mirrors the seed/purge/count contract in ./types: idempotent, best-effort,
// tolerant of an un-applied migration in count().

import { recalculateAssessmentScores } from "@/lib/ara/scoring";
import { DEMO_TAG, type DemoSeedOutcome, type DemoServiceCount } from "../constants";
import type { DemoServiceModule, DemoSb, DemoOrgIds } from "./types";

const SERVICE = "ara";
const LABEL = "AI Readiness (ARC)";

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

// All eight pillars, in scope for an enterprise-stage assessment. The respondent
// loader would normally split these by stage; for the demo we answer a spread
// across every pillar so the radar/heatmap on the report renders fully.
const PILLARS = [
  "strategy", "data", "technology", "talent",
  "culture", "governance", "operations", "model_management",
] as const;

// Five demo respondents (sentinel names so they read realistically without a
// real email domain - ara_respondents is not org-scoped beyond assessment_id,
// and the assessment IS org-scoped, so the FK chain keeps purge clean). Each
// carries a rough "self-rating posture" used to bias their answers so the
// cohort shows believable spread rather than a flat profile.
const RESPONDENTS: Array<{ name: string; name_ar: string; email: string; role: string; posture: number }> = [
  { name: "Faisal Al Otaibi (Caliber Demo)",   name_ar: "فيصل العتيبي (عرض كاليبر)",   email: "faisal.otaibi@caliber-demo.local",   role: "Chief Data Officer",        posture: 0.85 },
  { name: "Hessa Al Mutairi (Caliber Demo)",    name_ar: "حصة المطيري (عرض كاليبر)",    email: "hessa.mutairi@caliber-demo.local",   role: "Head of Risk & Governance", posture: 0.65 },
  { name: "Omar Al Ghamdi (Caliber Demo)",      name_ar: "عمر الغامدي (عرض كاليبر)",    email: "omar.ghamdi@caliber-demo.local",     role: "Head of Technology",        posture: 0.55 },
  { name: "Reem Al Harbi (Caliber Demo)",       name_ar: "ريم الحربي (عرض كاليبر)",     email: "reem.harbi@caliber-demo.local",      role: "HR & Talent Director",      posture: 0.45 },
  { name: "Tarek Al Shammari (Caliber Demo)",   name_ar: "طارق الشمري (عرض كاليبر)",    email: "tarek.shammari@caliber-demo.local",  role: "Operations Lead",           posture: 0.70 },
];

const SCORE_LABEL: Record<number, string> = {
  1: "1 - Not at all",
  2: "2 - Early exploration",
  3: "3 - In progress",
  4: "4 - Mostly in place",
  5: "5 - Comprehensive",
};

type SeedQuestion = {
  id: string;
  pillar_id: string;
  question_number: number;
  score_map: Record<string, number> | null;
};

/** Pick a 1-5 rating for a respondent on a question, biased by their posture
 *  and a per-pillar/per-question wobble so the cohort isn't flat. Deterministic
 *  given the inputs, so a re-seed (after a purge) reproduces the same profile. */
function ratingFor(posture: number, pillarIdx: number, qNumber: number): number {
  // Base maturity drifts down across the later pillars (governance / model mgmt
  // typically lag), then nudged by the respondent's optimism and a small wobble.
  const pillarBias = pillarIdx >= 5 ? -0.6 : pillarIdx >= 3 ? -0.2 : 0.2;
  const wobble = ((pillarIdx * 7 + qNumber * 3) % 5) / 5 - 0.4; // -0.4 .. +0.4
  const raw = 2.6 + posture * 2.2 + pillarBias + wobble;
  return Math.max(1, Math.min(5, Math.round(raw)));
}

async function findActiveVersionId(sb: DemoSb): Promise<string | null> {
  const active = await sb
    .from("ara_question_bank_versions")
    .select("id")
    .eq("is_active", true)
    .maybeSingle();
  if (active.data?.id) return active.data.id as string;
  // Fallback: newest version if none flagged active (shouldn't happen on prod).
  const newest = await sb
    .from("ara_question_bank_versions")
    .select("id")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (newest.data?.id as string) ?? null;
}

async function seed(sb: DemoSb, org: DemoOrgIds): Promise<DemoSeedOutcome> {
  const araOrgId = org.araOrganizationId;

  // Idempotent: skip if this demo org already has an assessment.
  const existing = await sb
    .from("ara_assessments")
    .select("id")
    .eq("organization_id", araOrgId)
    .limit(1);
  if (existing.data && existing.data.length > 0) {
    return { service: SERVICE, label: LABEL, created: 0, note: "already present" };
  }

  const versionId = await findActiveVersionId(sb);
  if (!versionId) throw new Error("No ARA question bank version found (apply migration 00021).");

  // ── Assessment (enterprise stage, completed, Saudi banking to match the demo org) ──
  const assess = await sb
    .from("ara_assessments")
    .insert({
      organization_id: araOrgId,
      region: "saudi",
      sector: "banking",
      default_language: "en",
      status: "completed",
      phase: "report",
      engagement_stage: "enterprise",
      scope_label: `${DEMO_TAG} Group-wide AI Readiness Diagnostic`,
      question_bank_version_id: versionId,
      completed_at: daysAgo(2),
    })
    .select("id")
    .single();
  if (assess.error || !assess.data) throw new Error(`ARA assessment: ${assess.error?.message}`);
  const assessmentId = assess.data.id as string;

  // ── Pull a small spread of Layer-1 rating questions per pillar (3 each = 24) ──
  const { data: qrows, error: qerr } = await sb
    .from("ara_questions")
    .select("id, pillar_id, question_number, score_map")
    .eq("version_id", versionId)
    .eq("question_type", "rating")
    .eq("layer", 1)
    .is("individual_factor_id", null)
    .is("agentic_dimension_id", null)
    .in("pillar_id", PILLARS as unknown as string[])
    .order("pillar_id")
    .order("question_number");
  if (qerr) throw new Error(`ARA questions: ${qerr.message}`);

  const byPillar = new Map<string, SeedQuestion[]>();
  for (const q of (qrows ?? []) as SeedQuestion[]) {
    const arr = byPillar.get(q.pillar_id) ?? [];
    if (arr.length < 3) arr.push(q); // cap at 3 per pillar - enough to populate scoring
    byPillar.set(q.pillar_id, arr);
  }
  const chosen: SeedQuestion[] = [];
  PILLARS.forEach((p) => chosen.push(...(byPillar.get(p) ?? [])));
  if (chosen.length === 0) throw new Error("ARA: no rating questions available on the active bank.");

  // ── Respondents (all completed) ──
  const respRows = RESPONDENTS.map((r, i) => ({
    assessment_id: assessmentId,
    name: r.name,
    name_ar: r.name_ar,
    email: r.email,
    role_key: r.role.toLowerCase().replace(/[^a-z]+/g, "_"),
    role_label_en: r.role,
    language_preference: "en" as const,
    invited_at: daysAgo(12),
    first_opened_at: daysAgo(10),
    last_active_at: daysAgo(3 + i),
    completed_at: daysAgo(3 + i),
  }));
  const respIns = await sb.from("ara_respondents").insert(respRows).select("id, email");
  if (respIns.error || !respIns.data) throw new Error(`ARA respondents: ${respIns.error?.message}`);
  const respondents = respIns.data as { id: string; email: string }[];

  // ── Responses: every respondent answers every chosen question ──
  const responseRows: Array<{
    assessment_id: string;
    respondent_id: string;
    question_id: string;
    answer_value: string;
    question_score: number;
    answered_at: string;
  }> = [];
  respondents.forEach((resp, ri) => {
    const posture = RESPONDENTS[ri].posture;
    chosen.forEach((q) => {
      const pillarIdx = PILLARS.indexOf(q.pillar_id as (typeof PILLARS)[number]);
      const rating = ratingFor(posture, Math.max(0, pillarIdx), q.question_number);
      const optionLabel = SCORE_LABEL[rating];
      // Prefer the question's own score_map (option label -> score) so the saved
      // value matches what the live respondent flow would store; fall back to the
      // rating itself if a question carries no map.
      const mapped = q.score_map?.[optionLabel];
      const score = typeof mapped === "number" ? mapped : rating;
      responseRows.push({
        assessment_id: assessmentId,
        respondent_id: resp.id,
        question_id: q.id,
        answer_value: optionLabel,
        question_score: score,
        answered_at: daysAgo(3 + ri),
      });
    });
  });
  const respAnsIns = await sb.from("ara_responses").insert(responseRows);
  if (respAnsIns.error) throw new Error(`ARA responses: ${respAnsIns.error.message}`);

  // ── Run the real scorer so pillar scores + overall band populate ──
  let scored = "scored to pillar + overall";
  try {
    await recalculateAssessmentScores(assessmentId);
  } catch (e) {
    scored = `responses only (scoring step skipped: ${e instanceof Error ? e.message : String(e)})`;
  }

  return {
    service: SERVICE,
    label: LABEL,
    created: 1,
    note: `1 enterprise assessment + ${respondents.length} respondents, ${responseRows.length} responses, ${scored}`,
  };
}

async function purge(sb: DemoSb, org: DemoOrgIds): Promise<string> {
  const araOrgId = org.araOrganizationId;
  if (!araOrgId) return "no ara org";

  const assessRes = await sb.from("ara_assessments").select("id").eq("organization_id", araOrgId);
  const assessIds = ((assessRes.data ?? []) as { id: string }[]).map((r) => r.id);
  if (assessIds.length === 0) return "no assessments";

  const respRes = await sb.from("ara_respondents").select("id").in("assessment_id", assessIds);
  const respIds = ((respRes.data ?? []) as { id: string }[]).map((r) => r.id);

  // Children before parents. ara_responses / pillar+assessment scores / notes /
  // reports / materials / compliance all FK to the assessment (and would cascade
  // on assessment delete), but we delete explicitly so a partial purge is clean.
  await sb.from("ara_responses").delete().in("assessment_id", assessIds);
  if (respIds.length) {
    await sb.from("ara_respondent_pillar_assignments").delete().in("respondent_id", respIds);
    await sb.from("ara_supporting_materials").delete().in("respondent_id", respIds);
  }
  await sb.from("ara_pillar_scores").delete().in("assessment_id", assessIds);
  await sb.from("ara_assessment_scores").delete().in("assessment_id", assessIds);
  await sb.from("ara_consultant_notes").delete().in("assessment_id", assessIds);
  await sb.from("ara_compliance_results").delete().in("assessment_id", assessIds);
  await sb.from("ara_supporting_materials").delete().in("assessment_id", assessIds);
  await sb.from("ara_reports").delete().in("assessment_id", assessIds);
  await sb.from("ara_email_log").delete().in("assessment_id", assessIds);
  await sb.from("ara_respondents").delete().in("assessment_id", assessIds);
  await sb.from("ara_assessments").delete().in("id", assessIds);

  return `assessments removed (${assessIds.length}), respondents (${respIds.length})`;
}

async function count(sb: DemoSb, org: DemoOrgIds): Promise<DemoServiceCount | null> {
  const araOrgId = org.araOrganizationId;
  if (!araOrgId) return null;
  try {
    const { count: n } = await sb
      .from("ara_assessments")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", araOrgId);
    return { service: SERVICE, label: "AI Readiness assessments", count: n ?? 0 };
  } catch {
    return null;
  }
}

const araDemoModule: DemoServiceModule = { id: SERVICE, label: LABEL, seed, purge, count };

export default araDemoModule;
