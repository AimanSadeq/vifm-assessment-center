/**
 * Everything the validity evidence surfaces need for one engagement, read once
 * and computed once, so the engagement panel and the evidence pack PDF can
 * never show a client two different numbers for the same centre.
 *
 * Takes the client it is given (callers check access first). Every read is
 * tolerant of migration 00230 not being applied: the numbers that come from
 * older tables still compute, and the follow-up and evaluation sections say
 * "nothing yet" rather than failing.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { bestPairMatrix, calculateICC } from "@/lib/scoring/icc";
import { computeAcFairness, type AcFairnessView } from "@/lib/ac/fairness";
import {
  criteriaOverlap,
  criterionValidity,
  evaluationCalendar,
  summariseFollowups,
  type CriteriaOverlap,
  type CriterionValidity,
  type EvaluationCalendar,
  type FollowupSummary,
} from "@/lib/ac/validity";

type Row = Record<string, unknown>;

export type EvidencePlan = {
  validation?: boolean;
  reaction?: boolean;
  utility?: boolean;
  trigger?: "participants" | "date";
  trigger_participants?: number | null;
  trigger_date?: string | null;
  criterion?: string | null;
  note?: string | null;
} | null;

export type EngagementEvidence = {
  engagement: Row;
  organisationName: string | null;
  plan: EvidencePlan;
  candidates: Row[];
  ratedCount: number;
  followups: Row[];
  followupSummary: FollowupSummary;
  evaluations: Row[];
  calendar: EvaluationCalendar;
  validity: CriterionValidity;
  overlap: CriteriaOverlap[];
  icc: { value: number | null; subjects: number } | null;
  fairness: AcFairnessView;
  fairnessNote: string;
  participantImpact: { responses: number; meanRating: number | null };
  competencies: { id: string; name: string; rationale: string | null; indicators: number }[];
  today: string;
};

const nameOf = (row: unknown): string => {
  const c = row as { name?: string } | { name?: string }[] | null;
  return (Array.isArray(c) ? c[0]?.name : c?.name) ?? "Unnamed criterion";
};

export async function loadEngagementEvidence(sb: SupabaseClient, engagementId: string): Promise<EngagementEvidence | null> {
  const today = new Date().toISOString().slice(0, 10);
  const { data: engagement } = await sb
    .from("engagements")
    .select("*, organizations(name)")
    .eq("id", engagementId)
    .maybeSingle();
  if (!engagement) return null;
  const e = engagement as Row;

  const safe = <T,>(p: PromiseLike<{ data: T[] | null }>, fallback: T[] = []) =>
    Promise.resolve(p).then((r) => (r.data ?? fallback) as T[], () => fallback);

  const seriesName = (e.series_name as string | null) ?? null;
  const [candidates, oars, consensus, ratingRows, followups, evalRows, feedback, compRows] = await Promise.all([
    safe<Row>(sb.from("candidates").select("id, full_name, gender, age_band, nationality_group, demographics_submitted_at").eq("engagement_id", engagementId).order("full_name")),
    safe<Row>(sb.from("overall_assessment_ratings").select("candidate_id, overall_score, computed_score, recommendation").eq("engagement_id", engagementId)),
    safe<Row>(sb.from("consensus_ratings").select("candidate_id, competency_id, final_score").eq("engagement_id", engagementId)),
    safe<Row>(sb.from("ratings").select("score, competency_id, assessor_assignments!inner(assessor_id, candidate_id, engagement_id)").eq("assessor_assignments.engagement_id", engagementId)),
    safe<Row>(sb.from("ac_outcome_followups").select("*").eq("engagement_id", engagementId).order("due_on")),
    seriesName
      ? safe<Row>(sb.from("ac_evaluations").select("*").or(`engagement_id.eq.${engagementId},series_name.eq.${seriesName.replace(/[,()]/g, " ")}`).order("conducted_at", { ascending: false }))
      : safe<Row>(sb.from("ac_evaluations").select("*").eq("engagement_id", engagementId).order("conducted_at", { ascending: false })),
    safe<Row>(sb.from("ac_centre_feedback").select("source, rating").eq("engagement_id", engagementId)),
    safe<Row>(sb.from("engagement_competencies").select("competency_id, rationale, competencies(name)").eq("engagement_id", engagementId)),
  ]);

  const compIds = compRows.map((c) => c.competency_id as string);
  const indicatorRows = compIds.length
    ? await safe<Row>(sb.from("behavioral_indicators").select("competency_id").neq("sme_status", "rejected").in("competency_id", compIds))
    : [];
  const indicatorCount = new Map<string, number>();
  for (const i of indicatorRows) indicatorCount.set(i.competency_id as string, (indicatorCount.get(i.competency_id as string) ?? 0) + 1);
  const competencies = compRows.map((c) => ({
    id: c.competency_id as string,
    name: nameOf(c.competencies),
    rationale: (c.rationale as string | null) ?? null,
    indicators: indicatorCount.get(c.competency_id as string) ?? 0,
  }));
  const compName: Record<string, string> = Object.fromEntries(competencies.map((c) => [c.id, c.name]));

  // Reliability: the same complete-case pair method the analytics page uses.
  const subjectRaters = new Map<string, Map<string, number>>();
  for (const r of ratingRows) {
    const a = r.assessor_assignments as { assessor_id: string; candidate_id: string } | { assessor_id: string; candidate_id: string }[] | null;
    const asg = Array.isArray(a) ? a[0] : a;
    if (!asg) continue;
    const key = `${asg.candidate_id}::${r.competency_id as string}`;
    const m = subjectRaters.get(key) ?? new Map<string, number>();
    m.set(asg.assessor_id, r.score as number);
    subjectRaters.set(key, m);
  }
  const matrix = bestPairMatrix(subjectRaters);
  const icc = matrix ? { value: calculateICC(matrix), subjects: matrix.length } : null;

  // Criterion validity: the centre's overall rating against later performance.
  // One pair per participant, taking the latest collected wave with a rating.
  const scoreOf = new Map<string, number>();
  for (const o of oars) {
    const v = (o.computed_score as number | null) ?? (o.overall_score as number | null);
    if (v != null) scoreOf.set(o.candidate_id as string, Number(v));
  }
  const latest = new Map<string, Row>();
  for (const f of followups) {
    if (f.status !== "collected" || f.performance_rating == null) continue;
    const prev = latest.get(f.candidate_id as string);
    if (!prev || String(f.due_on) > String(prev.due_on)) latest.set(f.candidate_id as string, f);
  }
  const pairs: { centreScore: number; performance: number }[] = [];
  for (const [cid, f] of Array.from(latest.entries())) {
    const s = scoreOf.get(cid);
    if (s !== undefined && f.in_role === true) pairs.push({ centreScore: s, performance: Number(f.performance_rating) });
  }
  const inRole = new Set(followups.filter((f) => f.in_role === true).map((f) => f.candidate_id as string)).size;
  const validity = criterionValidity({ pairs, inRole });

  const overlap = criteriaOverlap(
    consensus.map((c) => ({ candidateId: c.candidate_id as string, competencyId: c.competency_id as string, score: Number(c.final_score) })),
    compName
  );

  const recById = new Map(oars.map((o) => [o.candidate_id as string, o.recommendation as string]));
  const fairness = computeAcFairness(
    candidates.map((c) => ({
      gender: c.gender as string | null,
      age_band: c.age_band as string | null,
      nationality_group: c.nationality_group as string | null,
      demographics_submitted_at: c.demographics_submitted_at as string | null,
      recommendation: recById.get(c.id as string) ?? null,
    })),
    { purpose: (e.purpose as string | null) ?? null }
  );
  const flagged = fairness.report?.dimensions.some((d) => d.anyAdverseImpact) ?? false;
  const underpowered = fairness.report ? fairness.report.dimensions.every((d) => d.underpowered) : false;
  const fairnessNote = fairness.report
    ? flagged
      ? `Adverse-impact check flagged a group (${fairness.disclosed} of ${fairness.participants} disclosed demographics${underpowered ? "; small sample, low confidence" : ""}). Review job-relatedness with the client.`
      : `Adverse-impact check found no group below four-fifths (${fairness.disclosed} of ${fairness.participants} disclosed demographics${underpowered ? "; small sample, low confidence" : ""}).`
    : fairness.reason ?? "Not applicable.";

  const participantRatings = feedback.filter((f) => f.source === "participant" && typeof f.rating === "number").map((f) => Number(f.rating));
  const participantImpact = {
    responses: feedback.filter((f) => f.source === "participant").length,
    meanRating: participantRatings.length ? Math.round((participantRatings.reduce((a, b) => a + b, 0) / participantRatings.length) * 10) / 10 : null,
  };

  const conducted = evalRows.map((x) => String(x.conducted_at).slice(0, 10)).sort();
  const majors = evalRows.filter((x) => x.kind === "major").map((x) => String(x.conducted_at).slice(0, 10)).sort();
  const calendar = evaluationCalendar({
    firstCentreOn: (e.end_date as string | null) ?? (e.start_date as string | null) ?? null,
    lastEvaluationOn: conducted.length ? conducted[conducted.length - 1] : null,
    lastMajorOn: majors.length ? majors[majors.length - 1] : null,
    today,
  });

  const org = e.organizations as { name?: string } | { name?: string }[] | null;
  return {
    engagement: e,
    organisationName: (Array.isArray(org) ? org[0]?.name : org?.name) ?? null,
    plan: (e.evaluation_plan as EvidencePlan) ?? null,
    candidates,
    ratedCount: scoreOf.size,
    followups,
    followupSummary: summariseFollowups(followups.map((f) => ({ status: String(f.status), due_on: String(f.due_on), in_role: f.in_role as boolean | null })), today),
    evaluations: evalRows,
    calendar,
    validity,
    overlap,
    icc,
    fairness,
    fairnessNote,
    participantImpact,
    competencies,
    today,
  };
}
