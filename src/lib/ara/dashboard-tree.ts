/**
 * ARC interactive dashboard - the tree behind it.
 *
 * The August sample dashboard was driven by a hand-written JSON tree. This
 * builder produces the same shape from the real engine so one dashboard can be
 * opened at ANY level - a department, a division, an enterprise - and every
 * number on it is the number the PDF reports print:
 *
 *   organisation  = computeUnitRollup(enterprise assessment)   (00200 links)
 *     division    = the rollup's units, themselves pooled from their departments
 *       department= a leaf assessment: its own ara_pillar_scores
 *         person  = computeWorkforceReadiness(leaf) when the individual layer ran
 *
 * Segments (grade / tenure / gender / nationality) are OPTIONAL: they come from
 * ara_respondents.demographics (00202), are pooled upwards through the tree,
 * and a slice is emitted only when at least ARA_SEGMENT_MIN_N people fall in
 * it. Nothing here is per-person demographic data.
 */
import { createServiceClient } from "@/lib/supabase/server";
import { ARA_PILLARS, ARA_MATURITY_LEVELS, ARA_OVERALL_BANDS } from "@/lib/constants/ara-pillars";
import {
  ARA_INDIVIDUAL_FACTORS,
  getIndividualMaturityStage,
  type AraIndividualFactorId,
} from "@/lib/constants/ara-individual-factors";
import {
  ARA_DEMOGRAPHICS,
  ARA_SEGMENT_MIN_N,
  sanitiseDemographics,
  type AraDemographicDimensionId,
  type AraDemographics,
} from "@/lib/constants/ara-demographics";
import { getPillarsForAssessment } from "@/lib/constants/ara-stages";
import type { AraPillarId, AraEngagementStage } from "@/types/ara";
import { computeUnitRollup, type RollupUnit } from "@/lib/ara/unit-rollup";
import { computeWorkforceReadiness } from "@/lib/ara/workforce-readiness";
import { recommendCoursesForAraAssessment } from "@/lib/recommender/courses";

export type DashboardKind = "organisation" | "division" | "department";

export type DashboardBand = { label_en: string; label_ar: string; color: string; min: number };
export type DashboardLevel = { level: number; label_en: string; label_ar: string; min: number };

export type DashboardPerson = {
  id: string;
  name: string;
  individual_only: boolean;
  completed_at: string | null;
  overall: number | null;
  stage: { id: string; name_en: string; name_ar: string } | null;
  factors: Record<AraIndividualFactorId, number | null>;
};

export type DashboardSegmentSlice = {
  key: string;
  label_en: string;
  label_ar: string;
  n: number;
  overall: number | null;
  factors: Record<AraIndividualFactorId, number | null>;
};

export type DashboardSegmentDimension = {
  id: AraDemographicDimensionId;
  label_en: string;
  label_ar: string;
  slices: DashboardSegmentSlice[];
};

export type DashboardCourse = {
  code: string | null;
  title_en: string;
  title_ar: string | null;
  duration_days: number;
  drivers: string[];
};

export type DashboardNode = {
  id: string;
  kind: DashboardKind;
  stage: AraEngagementStage;
  label: string;
  label_ar: string;
  status: string;
  /** Completed respondents at or beneath this node. */
  respondents: number;
  overall: number | null;
  band: DashboardBand | null;
  level: DashboardLevel | null;
  /** Pillars this node has evidence for, in canonical order. */
  pillars: Array<{ id: AraPillarId; score: number }>;
  /** True when the number was pooled from the children, not scored directly. */
  pooled: boolean;
  children: DashboardNode[];
  /** People who completed the individual layer, at or beneath this node. */
  people: DashboardPerson[];
  /** Four-factor means over `people`, null when nobody ran the layer. */
  workforce: { overall: number | null; factors: Record<AraIndividualFactorId, number | null> } | null;
  /** Optional. Empty when nobody answered the "about you" block or no slice reaches the minimum. */
  segments: DashboardSegmentDimension[];
  /** How many of `people` answered the optional block - lets the UI say why a tab is missing. */
  segmentsAnswered: number;
  training: DashboardCourse[];
};

export type DashboardTree = {
  root: DashboardNode;
  organization_name: string | null;
  generated_at: string;
  is_sample: boolean;
  constants: {
    target: number;
    levels: DashboardLevel[];
    bands: DashboardBand[];
    pillars: Array<{ id: AraPillarId; name_en: string; name_ar: string }>;
    factors: Array<{ id: AraIndividualFactorId; name_en: string; name_ar: string; color: string }>;
    segment_min_n: number;
  };
};

export const DASHBOARD_TARGET = 4.0;

const round2 = (n: number) => Math.round(n * 100) / 100;

function bandFor(score: number | null): DashboardBand | null {
  if (score === null) return null;
  let match = ARA_OVERALL_BANDS[0];
  for (const b of ARA_OVERALL_BANDS) if (score >= b.min) match = b;
  return { label_en: match.label_en, label_ar: match.label_ar, color: match.color, min: match.min };
}

function levelFor(score: number | null): DashboardLevel | null {
  if (score === null) return null;
  let match = ARA_MATURITY_LEVELS[0];
  for (const l of ARA_MATURITY_LEVELS) if (score >= l.min) match = l;
  return { level: match.level, label_en: match.label_en, label_ar: match.label_ar, min: match.min };
}

function kindFor(stage: AraEngagementStage, hasChildren: boolean, depthBelow: number): DashboardKind {
  if (stage === "enterprise") return "organisation";
  if (stage === "division") return "division";
  if (!hasChildren) return "department";
  return depthBelow >= 2 ? "organisation" : "division";
}

function mean(values: Array<number | null>): number | null {
  const xs = values.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  if (xs.length === 0) return null;
  return round2(xs.reduce((a, b) => a + b, 0) / xs.length);
}

function emptyFactors(): Record<AraIndividualFactorId, number | null> {
  const out = {} as Record<AraIndividualFactorId, number | null>;
  for (const f of ARA_INDIVIDUAL_FACTORS) out[f.id] = null;
  return out;
}

function factorMeans(people: DashboardPerson[]): Record<AraIndividualFactorId, number | null> {
  const out = emptyFactors();
  for (const f of ARA_INDIVIDUAL_FACTORS) out[f.id] = mean(people.map((p) => p.factors[f.id]));
  return out;
}

function workforceOf(people: DashboardPerson[]) {
  return people.length > 0 ? { overall: mean(people.map((p) => p.overall)), factors: factorMeans(people) } : null;
}

/**
 * Aggregate the optional demographics of a group of people. Person ids map to
 * their sanitised answers; anyone without an answer is simply absent. A slice
 * below the anonymity minimum is dropped; a dimension with no surviving slice
 * is dropped; the count of answerers is returned so the UI can be honest.
 */
function buildSegments(
  people: DashboardPerson[],
  demographicsById: Map<string, AraDemographics>
): { segments: DashboardSegmentDimension[]; answered: number } {
  const answered = people.filter((p) => demographicsById.has(p.id)).length;
  const segments: DashboardSegmentDimension[] = [];
  for (const dim of ARA_DEMOGRAPHICS) {
    const slices: DashboardSegmentSlice[] = [];
    for (const opt of dim.options) {
      const members = people.filter((p) => demographicsById.get(p.id)?.[dim.id] === opt.key);
      if (members.length < ARA_SEGMENT_MIN_N) continue;
      slices.push({
        key: opt.key,
        label_en: opt.en,
        label_ar: opt.ar,
        n: members.length,
        overall: mean(members.map((m) => m.overall)),
        factors: factorMeans(members),
      });
    }
    if (slices.length > 0) segments.push({ id: dim.id, label_en: dim.label_en, label_ar: dim.label_ar, slices });
  }
  return { segments, answered };
}

type LeafMeta = { include_individual_layer: boolean };

async function loadPeople(assessmentId: string, meta: LeafMeta | undefined): Promise<DashboardPerson[]> {
  if (!meta?.include_individual_layer) return [];
  const wf = await computeWorkforceReadiness(assessmentId);
  if (!wf) return [];
  return wf.respondents
    .filter((r) => r.completed_at)
    .map((r) => {
      const stage = r.overall === null ? null : getIndividualMaturityStage(r.overall);
      return {
        id: r.respondent_id,
        name: r.name,
        individual_only: r.individual_only,
        completed_at: r.completed_at,
        overall: r.overall === null ? null : round2(r.overall),
        stage: stage ? { id: stage.id, name_en: stage.name_en, name_ar: stage.name_ar } : null,
        factors: r.per_factor,
      };
    });
}

type Sb = ReturnType<typeof createServiceClient>;

async function loadTraining(sb: Sb, assessmentId: string): Promise<DashboardCourse[]> {
  try {
    const courses = await recommendCoursesForAraAssessment({ assessmentId, limit: 6, client: sb });
    return courses.map((c) => ({
      code: c.course_code,
      title_en: c.title_en,
      title_ar: c.title_ar,
      duration_days: c.default_duration_days,
      drivers: c.drivers.slice(0, 3).map((d) => d.label),
    }));
  } catch {
    return [];
  }
}

function depthOf(n: DashboardNode): number {
  return n.children.length === 0 ? 0 : 1 + Math.max(...n.children.map(depthOf));
}

/** Convert a rollup unit (division or department beneath a parent) into a node. */
async function nodeFromUnit(
  sb: Sb,
  unit: RollupUnit,
  leafMeta: Map<string, LeafMeta>,
  demographicsById: Map<string, AraDemographics>
): Promise<DashboardNode> {
  const children = await Promise.all(unit.children.map((c) => nodeFromUnit(sb, c, leafMeta, demographicsById)));
  const isLeaf = children.length === 0;
  const people = isLeaf ? await loadPeople(unit.assessment_id, leafMeta.get(unit.assessment_id)) : children.flatMap((c) => c.people);
  const pillars = ARA_PILLARS.filter((p) => unit.byPillar.has(p.id)).map((p) => ({ id: p.id, score: round2(unit.byPillar.get(p.id) ?? 0) }));
  const overall = unit.overall === null ? null : round2(unit.overall);
  const depthBelow = isLeaf ? 0 : 1 + Math.max(...children.map(depthOf));
  const { segments, answered } = buildSegments(people, demographicsById);
  return {
    id: unit.assessment_id,
    kind: kindFor(unit.engagement_stage, !isLeaf, depthBelow),
    stage: unit.engagement_stage,
    label: unit.label,
    label_ar: unit.label_ar,
    status: unit.status,
    respondents: unit.completed_respondents,
    overall,
    band: bandFor(overall),
    level: levelFor(overall),
    pillars,
    pooled: unit.pooled,
    children,
    people,
    workforce: workforceOf(people),
    segments,
    segmentsAnswered: answered,
    training: isLeaf ? await loadTraining(sb, unit.assessment_id) : [],
  };
}

function collectLeafIds(units: RollupUnit[], out: string[] = []): string[] {
  for (const u of units) {
    if (u.children.length === 0) out.push(u.assessment_id);
    else collectLeafIds(u.children, out);
  }
  return out;
}

type AssessmentRow = {
  id: string;
  organization_id: string;
  scope_label: string | null;
  scope_label_ar: string | null;
  engagement_stage: AraEngagementStage;
  status: string;
  include_individual_layer: boolean | null;
  pillars_in_scope: AraPillarId[] | null;
  is_sandbox: boolean | null;
  ara_organizations: { name: string | null } | null;
};

/**
 * Build the dashboard tree rooted at an assessment. Works for a leaf
 * (department), a division with linked departments, or an enterprise with
 * linked divisions. Returns null when the assessment does not exist.
 */
export async function buildDashboardTree(rootAssessmentId: string): Promise<DashboardTree | null> {
  const sb = createServiceClient();
  const { data: root, error: rootErr } = await sb
    .from("ara_assessments")
    .select("id, organization_id, scope_label, scope_label_ar, engagement_stage, status, include_individual_layer, pillars_in_scope, is_sandbox, ara_organizations(name)")
    .eq("id", rootAssessmentId)
    .maybeSingle<AssessmentRow>();
  if (rootErr) console.error("[dashboard-tree] root select failed", rootErr.message);
  if (!root) return null;

  const rollup = await computeUnitRollup(rootAssessmentId);
  const isRollup = rollup.units.length > 0;
  const leafIds = isRollup ? collectLeafIds(rollup.units) : [rootAssessmentId];

  // Which leaves ran the individual layer - one query for the whole tree.
  const leafMeta = new Map<string, LeafMeta>();
  const { data: leafRows } = await sb
    .from("ara_assessments")
    .select("id, include_individual_layer")
    .in("id", leafIds);
  for (const r of (leafRows ?? []) as Array<{ id: string; include_individual_layer: boolean | null }>) {
    leafMeta.set(r.id, { include_individual_layer: !!r.include_individual_layer });
  }

  // Optional demographics for everyone beneath the root. Tolerant of 00202
  // not being applied: the select fails, the map stays empty, no Segments tab.
  const demographicsById = new Map<string, AraDemographics>();
  const { data: demoRows } = await sb
    .from("ara_respondents")
    .select("id, demographics")
    .in("assessment_id", leafIds)
    .not("completed_at", "is", null)
    .not("demographics", "is", null);
  for (const r of (demoRows ?? []) as Array<{ id: string; demographics: unknown }>) {
    const clean = sanitiseDemographics(r.demographics);
    if (clean) demographicsById.set(r.id, clean);
  }

  const orgName = root.ara_organizations?.name ?? null;
  let node: DashboardNode;
  if (isRollup) {
    const children = await Promise.all(rollup.units.map((u) => nodeFromUnit(sb, u, leafMeta, demographicsById)));
    const people = children.flatMap((c) => c.people);
    const overall = rollup.overall === null ? null : round2(rollup.overall);
    const pillars = rollup.spreads.map((s) => ({ id: s.pillar_id, score: round2(s.mean) }));
    const depthBelow = 1 + Math.max(...children.map(depthOf));
    const { segments, answered } = buildSegments(people, demographicsById);
    node = {
      id: root.id,
      kind: kindFor(root.engagement_stage, true, depthBelow),
      stage: root.engagement_stage,
      label: root.scope_label ?? orgName ?? "Organisation",
      label_ar: root.scope_label_ar ?? root.scope_label ?? orgName ?? "المؤسسة",
      status: root.status,
      respondents: rollup.totalRespondents,
      overall,
      band: bandFor(overall),
      level: levelFor(overall),
      pillars,
      pooled: true,
      children,
      people,
      workforce: workforceOf(people),
      segments,
      segmentsAnswered: answered,
      training: [],
    };
  } else {
    const inScope = new Set<string>(
      getPillarsForAssessment({ engagement_stage: root.engagement_stage, pillars_in_scope: root.pillars_in_scope })
    );
    const { data: scoreRows } = await sb
      .from("ara_pillar_scores")
      .select("pillar_id, raw_score")
      .eq("assessment_id", root.id);
    const byPillar = new Map<AraPillarId, number>();
    for (const r of (scoreRows ?? []) as Array<{ pillar_id: AraPillarId; raw_score: number | null }>) {
      if (r.raw_score !== null && inScope.has(r.pillar_id)) byPillar.set(r.pillar_id, r.raw_score);
    }
    const { count } = await sb
      .from("ara_respondents")
      .select("id", { count: "exact", head: true })
      .eq("assessment_id", root.id)
      .not("completed_at", "is", null);
    const pillars = ARA_PILLARS.filter((p) => byPillar.has(p.id)).map((p) => ({ id: p.id, score: round2(byPillar.get(p.id) ?? 0) }));
    const overall = pillars.length > 0 ? round2(pillars.reduce((a, p) => a + p.score, 0) / pillars.length) : null;
    const people = await loadPeople(root.id, { include_individual_layer: !!root.include_individual_layer });
    const { segments, answered } = buildSegments(people, demographicsById);
    node = {
      id: root.id,
      kind: kindFor(root.engagement_stage, false, 0),
      stage: root.engagement_stage,
      label: root.scope_label ?? orgName ?? "Department",
      label_ar: root.scope_label_ar ?? root.scope_label ?? "الإدارة",
      status: root.status,
      respondents: count ?? 0,
      overall,
      band: bandFor(overall),
      level: levelFor(overall),
      pillars,
      pooled: false,
      children: [],
      people,
      workforce: workforceOf(people),
      segments,
      segmentsAnswered: answered,
      training: await loadTraining(sb, root.id),
    };
  }

  return {
    root: node,
    organization_name: orgName,
    generated_at: new Date().toISOString(),
    is_sample: !!root.is_sandbox,
    constants: {
      target: DASHBOARD_TARGET,
      levels: ARA_MATURITY_LEVELS.map((l) => ({ level: l.level, label_en: l.label_en, label_ar: l.label_ar, min: l.min })),
      bands: ARA_OVERALL_BANDS.map((b) => ({ label_en: b.label_en, label_ar: b.label_ar, color: b.color, min: b.min })),
      pillars: ARA_PILLARS.map((p) => ({ id: p.id, name_en: p.name_en, name_ar: p.name_ar })),
      factors: ARA_INDIVIDUAL_FACTORS.map((f) => ({ id: f.id, name_en: f.name_en, name_ar: f.name_ar, color: f.color })),
      segment_min_n: ARA_SEGMENT_MIN_N,
    },
  };
}
