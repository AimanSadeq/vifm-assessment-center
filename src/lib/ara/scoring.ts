import { createServiceClient } from "@/lib/supabase/server";
import { fetchAllPages } from "@/lib/ara/paginate";
import { ARA_MATURITY_LEVELS, ARA_OVERALL_BANDS, ARA_PILLARS } from "@/lib/constants/ara-pillars";
import { getIndividualMaturityStage } from "@/lib/constants/ara-individual-factors";
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
// Lower-threshold lookup: pick the HIGHEST band whose min <= score. The
// band tables are ascending by min, so the last band that clears its lower
// threshold wins. This is gap-proof - a score like 3.95 (which fell in a
// former max/min gap and was mislabeled as the lowest band) now resolves to
// its correct band. Anything below the first min falls back to band[0].
export function maturityLevelFromScore(raw: number): {
  level: 1 | 2 | 3 | 4 | 5;
  label_en: string;
  label_ar: string;
} {
  let match = ARA_MATURITY_LEVELS[0];
  for (const m of ARA_MATURITY_LEVELS) {
    if (raw >= m.min) match = m;
  }
  return match;
}

export function overallBandFromScore(overall: number) {
  let match = ARA_OVERALL_BANDS[0];
  for (const b of ARA_OVERALL_BANDS) {
    if (overall >= b.min) match = b;
  }
  return match;
}

// ─────────────────────────────────────────────────────────────
// Full recalculation - Levels 2–5
// Called after a response is saved. Idempotent.
// ─────────────────────────────────────────────────────────────
export async function recalculateAssessmentScores(assessmentId: string): Promise<void> {
  const sb = createServiceClient();

  const { data: assessment } = await sb
    .from("ara_assessments")
    .select("id, pillar_weights, engagement_stage")
    .eq("id", assessmentId)
    .maybeSingle<Pick<AraAssessment, "id" | "pillar_weights" | "engagement_stage">>();

  if (!assessment) return;

  // Load all scored responses joined with their question pillar_id.
  // Note: open_text responses have question_score = null and are skipped.
  // PAGINATED: an enterprise Mode C + agentic cohort easily exceeds the
  // PostgREST 1000-row cap (e.g. 12 respondents x ~139 items = 1668 rows);
  // an unpaginated read silently dropped the later respondents from every
  // persisted pillar mean. On a query error we ABORT (keeping the previous
  // scores intact) rather than recompute from partial/empty data.
  type RowShape = {
    question_score: number | null;
    question: Pick<AraQuestion, "pillar_id" | "individual_factor_id" | "agentic_dimension_id"> | null;
  };
  let typed: RowShape[];
  try {
    const rows = await fetchAllPages<unknown>((from, to) =>
      sb
        .from("ara_responses")
        .select("question_score, question:ara_questions(pillar_id, individual_factor_id, agentic_dimension_id)")
        .eq("assessment_id", assessmentId)
        .order("id")
        .range(from, to)
    );
    typed = rows as RowShape[];
  } catch (e) {
    console.error(`[ara] recalculateAssessmentScores(${assessmentId}) response load failed - keeping prior scores:`, e);
    return;
  }

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

  // Renormalize weights over the pillars that actually scored, so the overall
  // is a true weighted MEAN. Without this, a subset-stage run (Department=4,
  // Division=6 pillars) under the default all-8 12.5% weights is deflated to
  // ~50-75% of the real overall, because the unscored pillars' weight mass is
  // never redistributed. Enterprise (all 8 scored, weights sum 100) is
  // unchanged. Respondents are only served in-scope pillar questions, so the
  // scored set IS the in-scope set.
  let scoredWeightSum = 0;
  let scoredCount = 0;
  for (const pillar of ARA_PILLARS) {
    if ((byPillar.get(pillar.id) ?? []).length > 0) {
      scoredWeightSum += weights?.[pillar.id] ?? 12.5;
      scoredCount += 1;
    }
  }

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
    // Weight normalised over the scored set (equal shares if every scored
    // pillar somehow carries weight 0), so weighted_score sums to the overall.
    const normWeight = scoredWeightSum > 0 ? pillarWeight / scoredWeightSum : 1 / scoredCount;
    const rawWeighted = raw * normWeight;
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
  let overall = anyPillarScored ? Number(overallWeighted.toFixed(2)) : null;
  let overallLabelEn: string | null = null;
  let overallLabelAr: string | null = null;

  if (overall != null) {
    const band = overallBandFromScore(overall);
    overallLabelEn = band.label_en;
    overallLabelAr = band.label_ar;
  } else if (assessment.engagement_stage === "individual") {
    // Individual-stage assessments serve ONLY individual-factor items, so no
    // pillar ever scores - which left overall_score null and the consultant
    // dashboard / org views blank, even though the taker's results page
    // recomputes a real score from the same responses. When there are no pillar
    // scores but the assessment has scored individual-factor responses, derive
    // the overall as the mean of the four factor means (the exact logic the
    // personal results page uses) and label it with the individual maturity
    // stage. STAGE-GATED to individual: on a Mode C ORG assessment whose first
    // submitters are individual_only respondents (no pillar answers yet), the
    // data-shape check alone published a personal-factor overall with a
    // personal maturity label onto the org record until the first pillar
    // answer arrived - an org run must stay "pending", never borrow the
    // personal construct.
    const byFactor = new Map<string, number[]>();
    for (const r of typed) {
      const fid = r.question?.individual_factor_id;
      if (r.question_score == null || !fid) continue;
      const arr = byFactor.get(fid) ?? [];
      arr.push(Number(r.question_score));
      byFactor.set(fid, arr);
    }
    const factorMeans: number[] = [];
    for (const arr of byFactor.values()) {
      if (arr.length > 0) factorMeans.push(arr.reduce((a, b) => a + b, 0) / arr.length);
    }
    if (factorMeans.length > 0) {
      overall = Number((factorMeans.reduce((a, b) => a + b, 0) / factorMeans.length).toFixed(2));
      const stage = getIndividualMaturityStage(overall);
      overallLabelEn = stage.name_en;
      overallLabelAr = stage.name_ar;
    }
  }

  await sb
    .from("ara_assessment_scores")
    .upsert(
      {
        assessment_id: assessmentId,
        overall_score: overall,
        overall_label_en: overallLabelEn,
        overall_label_ar: overallLabelAr,
        calculated_at: new Date().toISOString(),
      },
      { onConflict: "assessment_id" }
    );
}
