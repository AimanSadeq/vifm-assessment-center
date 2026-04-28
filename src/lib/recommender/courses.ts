/**
 * Course recommender — bridges the diagnostic side (AC engagement
 * gaps, ARA pillar maturity gaps) to VIFM's training catalogue.
 *
 * Two ranking functions live here:
 *
 *   recommendCoursesForAcCandidate
 *     Per-candidate. Reads the candidate's consensus ratings, computes
 *     gap-severity per competency, joins to vifm_course_competency_tags,
 *     and returns courses ranked by sum(gap * relevance_weight).
 *
 *   recommendCoursesForAraAssessment
 *     Per-assessment (the org as a whole). Reads pillar maturity_level,
 *     computes gap to target=4, joins to vifm_course_pillar_tags, and
 *     returns courses ranked by sum(gap * relevance_weight).
 *
 * Both functions return the same RecommendedCourse shape so a single
 * card component can render either side. Each result carries the
 * driving competencies/pillars + their individual gap contributions
 * so the UI can show "covers Strategic Thinking gap (Sig.) +
 * Decision Making gap (Mod.)" — turning the raw rank into a story.
 *
 * RLS: callers run under the admin/consultant client. The catalogue
 * tables grant authenticated read; no service-role escape needed.
 */

import { createClient } from "@/lib/supabase/server";
import { DEFAULT_TARGET } from "@/lib/scoring/competency-gap";
import {
  ARA_INDIVIDUAL_FACTORS,
  type AraIndividualFactorId,
} from "@/lib/constants/ara-individual-factors";
import type {
  VifmCourseLevel,
  VifmVertical,
} from "@/types/database";

const TAG_LIMIT_DEFAULT = 8;
// Above this score-per-result we emit "high-fit" badge in the UI.
export const HIGH_FIT_THRESHOLD = 4;

export type RecommendedCourse = {
  course_id: string;
  course_code: string | null;
  title_en: string;
  title_ar: string | null;
  vertical: VifmVertical;
  level: VifmCourseLevel;
  default_duration_days: number;
  min_duration_days: number;
  max_duration_days: number;
  // Total ranking score = sum over driving items of (gap * relevance).
  // Higher = better fit.
  total_score: number;
  // Per-driver breakdown so the UI can explain why this course was
  // recommended — e.g. "Strategic Thinking (gap 2 × relevance 3 = 6)".
  drivers: Array<{
    label: string;        // human-readable competency or pillar name
    kind: "competency" | "pillar";
    gap: number;          // how far below target
    relevance: 1 | 2 | 3; // course→driver relevance weight
    contribution: number; // gap * relevance
    rationale?: string | null;
  }>;
};

type CompetencyTagJoin = {
  course_id: string;
  competency_id: string;
  relevance_weight: 1 | 2 | 3;
  rationale: string | null;
  // Embedded course row from the FK join
  vifm_courses: {
    id: string;
    code: string | null;
    title_en: string;
    title_ar: string | null;
    vertical: VifmVertical;
    level: VifmCourseLevel;
    default_duration_days: number;
    min_duration_days: number;
    max_duration_days: number;
    is_active: boolean;
  } | null;
};

type PillarTagJoin = Omit<CompetencyTagJoin, "competency_id"> & {
  pillar_id: string;
};

type ConsensusRow = {
  competency_id: string;
  final_score: number | null;
  competencies: { name: string } | null;
};

// ──────────────────────────────────────────────────────────────
// AC — per-candidate
// ──────────────────────────────────────────────────────────────

export async function recommendCoursesForAcCandidate(args: {
  engagementId: string;
  candidateId: string;
  /** BARS target — defaults to 3 (Competent) if no role profile target is bound. */
  target?: number;
  limit?: number;
}): Promise<RecommendedCourse[]> {
  const limit = args.limit ?? TAG_LIMIT_DEFAULT;
  const target = args.target ?? DEFAULT_TARGET;
  const sb = await createClient();

  // 1. Pull the candidate's consensus ratings + competency name.
  const consensusRes = await sb
    .from("consensus_ratings")
    .select("competency_id, final_score, competencies(name)")
    .eq("engagement_id", args.engagementId)
    .eq("candidate_id", args.candidateId);
  const consensus = (consensusRes.data ?? []) as unknown as ConsensusRow[];

  // 2. Compute gaps. Anything ≤ 0 is on-target or stronger — skip.
  type GapEntry = { competency_id: string; name: string; gap: number };
  const gaps: GapEntry[] = consensus
    .map((row) => ({
      competency_id: row.competency_id,
      name: row.competencies?.name ?? "(unknown)",
      gap: target - (row.final_score ?? target),
    }))
    .filter((g) => g.gap > 0);

  if (gaps.length === 0) return [];

  // 3. Pull all course→competency tag rows for the gap competencies,
  //    embedded with the course row.
  const competencyIds = gaps.map((g) => g.competency_id);
  const tagsRes = await sb
    .from("vifm_course_competency_tags")
    .select(
      "course_id, competency_id, relevance_weight, rationale, " +
      "vifm_courses(id, code, title_en, title_ar, vertical, level, " +
      "default_duration_days, min_duration_days, max_duration_days, is_active)"
    )
    .in("competency_id", competencyIds);
  const tags = (tagsRes.data ?? []) as unknown as CompetencyTagJoin[];

  return rankFromCompetencyTags(tags, gaps, limit);
}

// ──────────────────────────────────────────────────────────────
// AC — cohort aggregate
// ──────────────────────────────────────────────────────────────

export async function recommendCoursesForAcCohort(args: {
  engagementId: string;
  target?: number;
  limit?: number;
}): Promise<RecommendedCourse[]> {
  const limit = args.limit ?? TAG_LIMIT_DEFAULT;
  const target = args.target ?? DEFAULT_TARGET;
  const sb = await createClient();

  // Aggregate: sum each competency's gap across every candidate in
  // the engagement. A wider cohort gap = course is more valuable.
  const consensusRes = await sb
    .from("consensus_ratings")
    .select("competency_id, final_score, competencies(name)")
    .eq("engagement_id", args.engagementId);
  const consensus = (consensusRes.data ?? []) as unknown as ConsensusRow[];

  const gapByCompetency = new Map<string, { name: string; gap: number }>();
  for (const row of consensus) {
    const gap = target - (row.final_score ?? target);
    if (gap <= 0) continue;
    const existing = gapByCompetency.get(row.competency_id);
    if (existing) {
      existing.gap += gap;
    } else {
      gapByCompetency.set(row.competency_id, {
        name: row.competencies?.name ?? "(unknown)",
        gap,
      });
    }
  }

  if (gapByCompetency.size === 0) return [];

  const gaps = Array.from(gapByCompetency.entries()).map(
    ([competency_id, { name, gap }]) => ({ competency_id, name, gap })
  );

  const tagsRes = await sb
    .from("vifm_course_competency_tags")
    .select(
      "course_id, competency_id, relevance_weight, rationale, " +
      "vifm_courses(id, code, title_en, title_ar, vertical, level, " +
      "default_duration_days, min_duration_days, max_duration_days, is_active)"
    )
    .in("competency_id", gaps.map((g) => g.competency_id));
  const tags = (tagsRes.data ?? []) as unknown as CompetencyTagJoin[];

  return rankFromCompetencyTags(tags, gaps, limit);
}

// ──────────────────────────────────────────────────────────────
// ARA — per-assessment
// ──────────────────────────────────────────────────────────────

type AraPillarScoreRow = {
  pillar_id: string;
  maturity_level: number | null;
  raw_score: number | null;
};

const PILLAR_LABELS: Record<string, string> = {
  strategy: "Strategy",
  data: "Data",
  technology: "Technology",
  talent: "Talent",
  culture: "Culture",
  governance: "Governance",
  operations: "Operations",
  model_management: "Model Management",
};

export async function recommendCoursesForAraAssessment(args: {
  assessmentId: string;
  /** Target maturity — defaults to 4 (Managed) which is "best practice" per most AI maturity frameworks. */
  target?: number;
  limit?: number;
}): Promise<RecommendedCourse[]> {
  const limit = args.limit ?? TAG_LIMIT_DEFAULT;
  const target = args.target ?? 4;
  const sb = await createClient();

  // 1. Pull pillar scores for this assessment.
  const scoresRes = await sb
    .from("ara_pillar_scores")
    .select("pillar_id, maturity_level, raw_score")
    .eq("assessment_id", args.assessmentId);
  const scores = (scoresRes.data ?? []) as unknown as AraPillarScoreRow[];

  // 2. Gap = target - maturity_level (ARA uses 1-5 maturity scale).
  type PillarGapEntry = { pillar_id: string; name: string; gap: number };
  const gaps: PillarGapEntry[] = scores
    .map((row) => {
      const level = row.maturity_level ?? Math.round(row.raw_score ?? target);
      return {
        pillar_id: row.pillar_id,
        name: PILLAR_LABELS[row.pillar_id] ?? row.pillar_id,
        gap: target - level,
      };
    })
    .filter((g) => g.gap > 0);

  if (gaps.length === 0) return [];

  // 3. Pull course→pillar tag rows for the gap pillars.
  const pillarIds = gaps.map((g) => g.pillar_id);
  const tagsRes = await sb
    .from("vifm_course_pillar_tags")
    .select(
      "course_id, pillar_id, relevance_weight, rationale, " +
      "vifm_courses(id, code, title_en, title_ar, vertical, level, " +
      "default_duration_days, min_duration_days, max_duration_days, is_active)"
    )
    .in("pillar_id", pillarIds);
  const tags = (tagsRes.data ?? []) as unknown as PillarTagJoin[];

  return rankFromPillarTags(tags, gaps, limit);
}

// ──────────────────────────────────────────────────────────────
// Internal — ranking aggregator (shared between AC and ARA)
// ──────────────────────────────────────────────────────────────

function rankFromCompetencyTags(
  tags: CompetencyTagJoin[],
  gaps: Array<{ competency_id: string; name: string; gap: number }>,
  limit: number
): RecommendedCourse[] {
  const gapByCompId = new Map(gaps.map((g) => [g.competency_id, g]));
  const accumulator = new Map<string, RecommendedCourse>();

  for (const tag of tags) {
    const course = tag.vifm_courses;
    if (!course || !course.is_active) continue;
    const driver = gapByCompId.get(tag.competency_id);
    if (!driver) continue;

    const contribution = driver.gap * tag.relevance_weight;
    const existing = accumulator.get(course.id);
    if (existing) {
      existing.total_score += contribution;
      existing.drivers.push({
        label: driver.name,
        kind: "competency",
        gap: driver.gap,
        relevance: tag.relevance_weight,
        contribution,
        rationale: tag.rationale,
      });
    } else {
      accumulator.set(course.id, {
        course_id: course.id,
        course_code: course.code,
        title_en: course.title_en,
        title_ar: course.title_ar,
        vertical: course.vertical,
        level: course.level,
        default_duration_days: course.default_duration_days,
        min_duration_days: course.min_duration_days,
        max_duration_days: course.max_duration_days,
        total_score: contribution,
        drivers: [{
          label: driver.name,
          kind: "competency",
          gap: driver.gap,
          relevance: tag.relevance_weight,
          contribution,
          rationale: tag.rationale,
        }],
      });
    }
  }

  return finaliseRanking(accumulator, limit);
}

function rankFromPillarTags(
  tags: PillarTagJoin[],
  gaps: Array<{ pillar_id: string; name: string; gap: number }>,
  limit: number
): RecommendedCourse[] {
  const gapByPillarId = new Map(gaps.map((g) => [g.pillar_id, g]));
  const accumulator = new Map<string, RecommendedCourse>();

  for (const tag of tags) {
    const course = tag.vifm_courses;
    if (!course || !course.is_active) continue;
    const driver = gapByPillarId.get(tag.pillar_id);
    if (!driver) continue;

    const contribution = driver.gap * tag.relevance_weight;
    const existing = accumulator.get(course.id);
    if (existing) {
      existing.total_score += contribution;
      existing.drivers.push({
        label: driver.name,
        kind: "pillar",
        gap: driver.gap,
        relevance: tag.relevance_weight,
        contribution,
        rationale: tag.rationale,
      });
    } else {
      accumulator.set(course.id, {
        course_id: course.id,
        course_code: course.code,
        title_en: course.title_en,
        title_ar: course.title_ar,
        vertical: course.vertical,
        level: course.level,
        default_duration_days: course.default_duration_days,
        min_duration_days: course.min_duration_days,
        max_duration_days: course.max_duration_days,
        total_score: contribution,
        drivers: [{
          label: driver.name,
          kind: "pillar",
          gap: driver.gap,
          relevance: tag.relevance_weight,
          contribution,
          rationale: tag.rationale,
        }],
      });
    }
  }

  return finaliseRanking(accumulator, limit);
}

function finaliseRanking(
  accumulator: Map<string, RecommendedCourse>,
  limit: number
): RecommendedCourse[] {
  const ranked = Array.from(accumulator.values());
  // Sort drivers within each course by contribution desc so the UI
  // shows the most-impactful driver first per card.
  for (const r of ranked) {
    r.drivers.sort((a, b) => b.contribution - a.contribution);
  }
  // Sort courses by total_score desc, then by course title asc as tiebreaker.
  ranked.sort((a, b) => {
    if (b.total_score !== a.total_score) return b.total_score - a.total_score;
    return a.title_en.localeCompare(b.title_en);
  });
  return ranked.slice(0, limit);
}

// ──────────────────────────────────────────────────────────────
// Personal — per-individual-snapshot recommender
// ──────────────────────────────────────────────────────────────

/**
 * Course recommender for the Personal AI Readiness Snapshot.
 *
 * Input: per-factor average scores (1-5 Likert) computed from the
 * respondent's answers. The factor → AC behavioural competency
 * mapping lives in src/lib/constants/ara-individual-factors.ts.
 *
 * For each factor below target, look up its mapped AC competency
 * names, find courses tagged to those competencies (case-sensitive
 * name lookup on the competencies table), and rank by
 * sum(gap × relevance_weight). Default target is 4 (Agree) — a
 * personal score of 5 is "Strongly Agree" and ≤3 is the actionable
 * range.
 */
export async function recommendCoursesForIndividualSnapshot(args: {
  factorScores: Record<AraIndividualFactorId, number>;
  target?: number;
  limit?: number;
}): Promise<RecommendedCourse[]> {
  const limit = args.limit ?? TAG_LIMIT_DEFAULT;
  const target = args.target ?? 4;
  const sb = await createClient();

  // 1. Build a flat list of (factor, competency_name, gap) tuples.
  type FactorGap = { factorId: AraIndividualFactorId; factorLabel: string; competencyNames: string[]; gap: number };
  const factorGaps: FactorGap[] = ARA_INDIVIDUAL_FACTORS
    .map((f) => ({
      factorId: f.id,
      factorLabel: f.name_en,
      competencyNames: f.ac_competency_names,
      gap: target - (args.factorScores[f.id] ?? target),
    }))
    .filter((fg) => fg.gap > 0 && fg.competencyNames.length > 0);

  if (factorGaps.length === 0) return [];

  // 2. Resolve all referenced competency names to ids in one round-trip.
  const allCompetencyNames = Array.from(
    new Set(factorGaps.flatMap((fg) => fg.competencyNames))
  );
  const compsRes = await sb
    .from("competencies")
    .select("id, name")
    .in("name", allCompetencyNames);
  const comps = (compsRes.data ?? []) as Array<{ id: string; name: string }>;
  const nameToId = new Map(comps.map((c) => [c.name, c.id]));

  // Build (factor → competency_id list) so we can compute per-factor
  // contributions when ranking.
  type FactorCompPair = { factorLabel: string; competency_id: string; gap: number };
  const pairs: FactorCompPair[] = [];
  for (const fg of factorGaps) {
    for (const name of fg.competencyNames) {
      const compId = nameToId.get(name);
      if (!compId) continue; // competency name not in catalogue — skip
      pairs.push({
        factorLabel: fg.factorLabel,
        competency_id: compId,
        gap: fg.gap,
      });
    }
  }
  if (pairs.length === 0) return [];

  // 3. Pull all course→competency tag rows for those competencies.
  const competencyIds = Array.from(new Set(pairs.map((p) => p.competency_id)));
  const tagsRes = await sb
    .from("vifm_course_competency_tags")
    .select(
      "course_id, competency_id, relevance_weight, rationale, " +
      "vifm_courses(id, code, title_en, title_ar, vertical, level, " +
      "default_duration_days, min_duration_days, max_duration_days, is_active)"
    )
    .in("competency_id", competencyIds);
  const tags = (tagsRes.data ?? []) as unknown as CompetencyTagJoin[];

  // 4. Aggregate. A course can be pulled in by multiple factors —
  // each contributes (gap × relevance) to the total score, with the
  // factor surfacing as a driver chip on the card.
  const accumulator = new Map<string, RecommendedCourse>();
  for (const tag of tags) {
    const course = tag.vifm_courses;
    if (!course || !course.is_active) continue;

    // A competency can appear in multiple factors (rare but valid).
    // Sum each factor's contribution separately so the driver list
    // reflects the actual breakdown.
    const matchingPairs = pairs.filter((p) => p.competency_id === tag.competency_id);
    for (const pair of matchingPairs) {
      const contribution = pair.gap * tag.relevance_weight;
      const existing = accumulator.get(course.id);
      if (existing) {
        existing.total_score += contribution;
        existing.drivers.push({
          label: pair.factorLabel,
          kind: "competency",
          gap: pair.gap,
          relevance: tag.relevance_weight,
          contribution,
          rationale: tag.rationale,
        });
      } else {
        accumulator.set(course.id, {
          course_id: course.id,
          course_code: course.code,
          title_en: course.title_en,
          title_ar: course.title_ar,
          vertical: course.vertical,
          level: course.level,
          default_duration_days: course.default_duration_days,
          min_duration_days: course.min_duration_days,
          max_duration_days: course.max_duration_days,
          total_score: contribution,
          drivers: [{
            label: pair.factorLabel,
            kind: "competency",
            gap: pair.gap,
            relevance: tag.relevance_weight,
            contribution,
            rationale: tag.rationale,
          }],
        });
      }
    }
  }

  return finaliseRanking(accumulator, limit);
}
