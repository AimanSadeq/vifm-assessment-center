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

import { createClient, createServiceClient } from "@/lib/supabase/server";
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
// Reflect — per-participant
//
// Reflect frameworks are CUSTOM per engagement (the consultant clones
// a template or builds bespoke), so reflect_competencies.id can't be
// joined directly to vifm_course_competency_tags. We match by name:
//
//   1. Normalise both names (lowercase, strip non-alphanumeric,
//      collapse whitespace)
//   2. Exact match wins
//   3. Substring match in either direction wins next
//   4. Major-token overlap (>=2 shared tokens >=4 chars) wins last
//
// If no AC competency matches, that Reflect competency contributes
// nothing to the ranking (graceful degradation). The PDF caller can
// detect an empty list and show "Bring your own course mapping"
// guidance.
// ──────────────────────────────────────────────────────────────

type AcCompetencyLite = { id: string; name: string; normalized: string; tokens: Set<string> };

function normalizeName(s: string): { normalized: string; tokens: Set<string> } {
  const cleaned = s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const tokens = new Set(cleaned.split(" ").filter((t) => t.length >= 4));
  return { normalized: cleaned, tokens };
}

function findAcMatch(
  reflectName: string,
  catalogue: AcCompetencyLite[]
): AcCompetencyLite | null {
  const { normalized, tokens } = normalizeName(reflectName);
  if (!normalized) return null;

  // Strategy 1: exact normalized match
  const exact = catalogue.find((c) => c.normalized === normalized);
  if (exact) return exact;

  // Strategy 2: substring in either direction. Prefer longer match.
  const subs = catalogue
    .filter((c) => normalized.includes(c.normalized) || c.normalized.includes(normalized))
    .sort((a, b) => b.normalized.length - a.normalized.length);
  if (subs.length > 0) return subs[0];

  // Strategy 3: token overlap (>= 2 long tokens shared). Higher overlap wins.
  // Array.from on the Set so the iteration works under the project's TS target.
  const tokenList = Array.from(tokens);
  let best: { c: AcCompetencyLite; shared: number } | null = null;
  for (const c of catalogue) {
    let shared = 0;
    for (const t of tokenList) if (c.tokens.has(t)) shared += 1;
    if (shared >= 2 && (!best || shared > best.shared)) {
      best = { c, shared };
    }
  }
  return best?.c ?? null;
}

export async function recommendCoursesForReflectParticipant(args: {
  participantId: string;
  /** Target mean — defaults to 4 (Often). Below this counts as a gap. */
  target?: number;
  limit?: number;
}): Promise<{
  recommendations: RecommendedCourse[];
  /** Reflect competency names that couldn't be matched to any AC competency. Useful for the PDF caller. */
  unmapped: string[];
}> {
  const limit = args.limit ?? TAG_LIMIT_DEFAULT;
  const target = args.target ?? 4;
  const sb = createServiceClient();

  // 1. Compute the participant's per-competency scoring (Others' view).
  // We re-import inline rather than statically to avoid a cycle (scoring
  // doesn't import the recommender, but explicit import here keeps the
  // module dependency graph one-directional).
  const { computeParticipantScoring } = await import("@/lib/reflect/scoring");
  const scoring = await computeParticipantScoring(args.participantId);
  if (!scoring) return { recommendations: [], unmapped: [] };

  // 2. Build gap list. Use others_mean (excludes self bias); fall back
  //    to self_mean when no Others view exists.
  type RawGap = { reflect_name: string; reflect_id: string; gap: number };
  const rawGaps: RawGap[] = scoring.competencies
    .map((c) => {
      const observed = c.others_mean ?? c.self_mean;
      if (observed === null) return null;
      return {
        reflect_name: c.name_en,
        reflect_id: c.competency_id,
        gap: target - observed,
      };
    })
    .filter((g): g is RawGap => g !== null && g.gap > 0);

  if (rawGaps.length === 0) return { recommendations: [], unmapped: [] };

  // 3. Pull the AC competency catalogue once.
  const { data: acRows } = await sb.from("competencies").select("id, name");
  const catalogue: AcCompetencyLite[] = ((acRows ?? []) as Array<{ id: string; name: string }>).map(
    (r) => {
      const n = normalizeName(r.name);
      return { id: r.id, name: r.name, normalized: n.normalized, tokens: n.tokens };
    }
  );

  // 4. Map each Reflect gap → AC competency. Keep the AC label so the
  //    PDF can show "Communication & Influence → Communicates Effectively".
  type MappedGap = { competency_id: string; name: string; gap: number };
  const mappedGaps: MappedGap[] = [];
  const unmapped: string[] = [];
  for (const g of rawGaps) {
    const m = findAcMatch(g.reflect_name, catalogue);
    if (m) {
      mappedGaps.push({
        competency_id: m.id,
        // Use the Reflect name in the label — that's what the participant saw
        // in their report. The driver chip will read e.g. "People Leadership
        // (gap 1.2 × relevance 3)".
        name: g.reflect_name,
        gap: g.gap,
      });
    } else {
      unmapped.push(g.reflect_name);
    }
  }

  if (mappedGaps.length === 0) return { recommendations: [], unmapped };

  // 5. Pull course tags for the mapped competency IDs.
  const competencyIds = Array.from(new Set(mappedGaps.map((g) => g.competency_id)));
  const { data: tagsRows } = await sb
    .from("vifm_course_competency_tags")
    .select(
      "course_id, competency_id, relevance_weight, rationale, " +
      "vifm_courses(id, code, title_en, title_ar, vertical, level, " +
      "default_duration_days, min_duration_days, max_duration_days, is_active)"
    )
    .in("competency_id", competencyIds);
  const tags = (tagsRows ?? []) as unknown as CompetencyTagJoin[];

  const recommendations = rankFromCompetencyTags(tags, mappedGaps, limit);
  return { recommendations, unmapped };
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
  // Personal snapshot is anonymous — the respondent is not logged in.
  // The regular `createClient()` returns an anon-role client and RLS
  // blocks reads on competencies / vifm_courses / vifm_course_competency_tags,
  // which silently empties the recommendation list regardless of gap size.
  // Use the service client here: this function is server-side only and
  // its inputs come from the trusted respondent-results / PDF routes.
  const sb = createServiceClient();

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
