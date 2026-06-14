import { createServiceClient } from "@/lib/supabase/server";
import { ARA_MATURITY_LEVELS, ARA_OVERALL_BANDS, ARA_PILLARS } from "@/lib/constants/ara-pillars";
import type {
  AraAssessment, AraPillarId, AraQuestion, AraQuestionType,
} from "@/types/ara";

// ─────────────────────────────────────────────────────────────
// Level 1 - per-question score
// ─────────────────────────────────────────────────────────────
export function calculateQuestionScore(
  questionType: AraQuestionType,
  answerValue: string | null,
  scoreMap: Record<string, number> | null
): number | null {
  if (!answerValue) return null;

  switch (questionType) {
    case "rating": {
      const n = Number(answerValue);
      if (Number.isFinite(n) && n >= 1 && n <= 5) return n;
      return null;
    }
    case "multiple_choice":
    case "yes_no":
    // Graded individual-factor types: scored against the expert key (score_map),
    // exactly like multiple_choice (best/correct option -> 5, etc.).
    case "situational_judgment":
    case "knowledge_check": {
      if (!scoreMap) return null;
      const score = scoreMap[answerValue];
      return typeof score === "number" ? score : null;
    }
    case "open_text":
      return null; // excluded from scoring
  }
}

// ─────────────────────────────────────────────────────────────
// Level 3 - maturity level from raw score
// ─────────────────────────────────────────────────────────────
export function maturityLevelFromScore(raw: number): {
  level: 1 | 2 | 3 | 4 | 5;
  label_en: string;
  label_ar: string;
} {
  for (const m of ARA_MATURITY_LEVELS) {
    if (raw >= m.min && raw <= m.max) return m;
  }
  // Below 1.0 - treat as Level 1
  return ARA_MATURITY_LEVELS[0];
}

export function overallBandFromScore(overall: number) {
  for (const b of ARA_OVERALL_BANDS) {
    if (overall >= b.min && overall <= b.max) return b;
  }
  return ARA_OVERALL_BANDS[0];
}

// ─────────────────────────────────────────────────────────────
// Full recalculation - Levels 2–5
// Called after a response is saved. Idempotent.
// ─────────────────────────────────────────────────────────────
export async function recalculateAssessmentScores(assessmentId: string): Promise<void> {
  const sb = createServiceClient();

  const { data: assessment } = await sb
    .from("ara_assessments")
    .select("id, pillar_weights")
    .eq("id", assessmentId)
    .maybeSingle<Pick<AraAssessment, "id" | "pillar_weights">>();

  if (!assessment) return;

  // Load all scored responses joined with their question pillar_id.
  // Note: open_text responses have question_score = null and are skipped.
  const { data: rows } = await sb
    .from("ara_responses")
    .select("question_score, question:ara_questions(pillar_id, individual_factor_id, agentic_dimension_id)")
    .eq("assessment_id", assessmentId);

  type RowShape = {
    question_score: number | null;
    question: Pick<AraQuestion, "pillar_id" | "individual_factor_id" | "agentic_dimension_id"> | null;
  };
  const typed = (rows ?? []) as unknown as RowShape[];

  // Group scored responses by pillar. Pillar scores must reflect ONLY
  // pillar questions - exclude personal-layer (individual_factor_id) and
  // Agentic-AI Readiness (agentic_dimension_id) items. Those reuse a
  // pillar_id for storage but are scored as separate constructs, so
  // counting them here would pollute the eight pillar means.
  const byPillar = new Map<AraPillarId, number[]>();
  for (const p of ARA_PILLARS) byPillar.set(p.id, []);

  for (const r of typed) {
    if (r.question_score == null || !r.question?.pillar_id) continue;
    if (r.question.individual_factor_id != null) continue;
    if (r.question.agentic_dimension_id != null) continue;
    const arr = byPillar.get(r.question.pillar_id as AraPillarId);
    if (arr) arr.push(Number(r.question_score));
  }

  // Upsert pillar rows and accumulate the overall weighted sum.
  const weights = assessment.pillar_weights as Record<AraPillarId, number>;
  let overallWeighted = 0;
  let anyPillarScored = false;

  for (const pillar of ARA_PILLARS) {
    const scores = byPillar.get(pillar.id) ?? [];
    const pillarWeight = weights?.[pillar.id] ?? 12.5;

    if (scores.length === 0) {
      // No scored responses yet - upsert with nulls so consultants see
      // "pending" rather than a missing row.
      await sb
        .from("ara_pillar_scores")
        .upsert(
          {
            assessment_id: assessmentId,
            pillar_id: pillar.id,
            raw_score: null,
            weighted_score: null,
            pillar_weight: pillarWeight,
            maturity_level: null,
            maturity_label_en: null,
            maturity_label_ar: null,
            benchmark_gap: null,
            calculated_at: new Date().toISOString(),
          },
          { onConflict: "assessment_id,pillar_id" }
        );
      continue;
    }

    anyPillarScored = true;
    const raw = scores.reduce((a, b) => a + b, 0) / scores.length;
    // Accumulate the UNROUNDED weighted value into the overall total so
    // rounding error does not compound across eight pillars. We still
    // round the per-pillar weighted value when storing it, because the
    // column is numeric(4,2) and consultants compare it against the
    // rounded raw_score in the report.
    const rawWeighted = raw * (pillarWeight / 100);
    const weighted = Number(rawWeighted.toFixed(2));
    const maturity = maturityLevelFromScore(raw);
    const benchmarkGap = Number((4.0 - raw).toFixed(2));
    overallWeighted += rawWeighted;

    await sb
      .from("ara_pillar_scores")
      .upsert(
        {
          assessment_id: assessmentId,
          pillar_id: pillar.id,
          raw_score: Number(raw.toFixed(2)),
          weighted_score: weighted,
          pillar_weight: pillarWeight,
          maturity_level: maturity.level,
          maturity_label_en: maturity.label_en,
          maturity_label_ar: maturity.label_ar,
          benchmark_gap: benchmarkGap,
          calculated_at: new Date().toISOString(),
        },
        { onConflict: "assessment_id,pillar_id" }
      );
  }

  // Level 5 - overall score. Sum of weighted scores. Only publish a
  // non-null overall once at least one pillar has been scored, otherwise
  // the cover page shows 0.00 prematurely.
  const overall = anyPillarScored ? Number(overallWeighted.toFixed(2)) : null;
  const band = overall != null ? overallBandFromScore(overall) : null;

  await sb
    .from("ara_assessment_scores")
    .upsert(
      {
        assessment_id: assessmentId,
        overall_score: overall,
        overall_label_en: band?.label_en ?? null,
        overall_label_ar: band?.label_ar ?? null,
        calculated_at: new Date().toISOString(),
      },
      { onConflict: "assessment_id" }
    );
}
