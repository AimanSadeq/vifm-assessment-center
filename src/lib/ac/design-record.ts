/**
 * The design record: why this centre assesses what it assesses, the way it does.
 *
 * Section 4 of the BPS standard is mostly about decisions Caliber already
 * makes - which criteria, which exercises, how they map - and never wrote down
 * the reasons for. A centre challenged on why it assessed what it assessed
 * could point at a matrix, not at an argument.
 *
 * Two of these clauses can be CHECKED rather than merely recorded, and those
 * are the valuable ones:
 *
 *   4.5  the number of criteria shall not be greater than can be effectively
 *        assessed within the confines of the design. The thresholds below are
 *        assessment-centre practice, not numbers from the standard, and they
 *        are named as such wherever they are shown - an assessor watching a
 *        45-minute exercise cannot reliably score eight competencies, and a
 *        criterion observed once has no converging evidence behind it.
 *
 *   4.20 exercises in combination shall collect evidence on all performance
 *        indicators within the criteria. A criterion with no behavioural
 *        indicators is one nobody can rate consistently.
 *
 * Everything else is prose a person must write, and `missing` is what drives
 * the checklist.
 */

/** Practice thresholds, not clause values. Named in the UI as rules of thumb. */
export const MAX_COMPETENCIES_PER_EXERCISE = 5;
export const MIN_EXERCISES_PER_COMPETENCY = 2;
export const MAX_COMPETENCIES_PER_CENTRE = 8;

export type DesignEngagement = {
  design_rationale?: string | null;
  alternatives_considered?: string | null;
  job_analysis_method?: string | null;
  job_analysis_note?: string | null;
  work_context?: string | null;
  sme_review_note?: string | null;
  exercise_independence_note?: string | null;
  existing_exercises_note?: string | null;
  criteria_load_ack?: string | null;
  facilities_note?: string | null;
  plan_approved_at?: string | null;
  plan_approved_client_name?: string | null;
};

export type DesignCompetency = {
  competencyId: string;
  name: string;
  rationale?: string | null;
  source?: string | null;
  /** How many behavioural indicators exist for it (4.20). */
  indicatorCount?: number;
};

export type DesignExercise = {
  id: string;
  name: string;
  exerciseType?: string | null;
  durationMinutes?: number | null;
};

export type DesignMatrixEntry = { exerciseId: string; competencyId: string };

export type DesignReview = {
  /** Clause items with nothing recorded yet. */
  missing: { field: string; label: string; clause: string }[];
  /** Things the design says that are worth a second look. */
  cautions: string[];
  /** Load per exercise, for the table. */
  exerciseLoad: { id: string; name: string; competencies: number; minutes: number | null; overloaded: boolean }[];
  /** Criteria observed fewer than twice (4.15 already enforces this at save). */
  thinlyObserved: { competencyId: string; name: string; exercises: number }[];
  /** Criteria with no behavioural indicators to rate against (4.20). */
  withoutIndicators: { competencyId: string; name: string }[];
  /** Criteria with no recorded link to the job (4.4). */
  withoutRationale: { competencyId: string; name: string }[];
  /** Output modes the exercises produce (4.21). */
  outputModes: string[];
  approved: boolean;
};

const OUTPUT_MODE: Record<string, string> = {
  in_basket: "written",
  case_study: "written",
  oral_presentation: "spoken",
  role_play: "spoken, one to one",
  group_exercise: "spoken, in a group",
  competency_based_interview: "spoken, one to one",
};

export function reviewDesignRecord(input: {
  engagement: DesignEngagement;
  competencies: DesignCompetency[];
  exercises: DesignExercise[];
  matrix: DesignMatrixEntry[];
}): DesignReview {
  const { engagement, competencies, exercises, matrix } = input;

  const missing: DesignReview["missing"] = [];
  const need = (value: string | null | undefined, field: string, label: string, clause: string) => {
    if (!value || !value.trim()) missing.push({ field, label, clause });
  };
  need(engagement.design_rationale, "design_rationale", "Why this centre is designed the way it is", "4.1 / 3.26");
  need(engagement.alternatives_considered, "alternatives_considered", "What else was considered, and why it was not chosen", "4.1");
  need(engagement.job_analysis_method, "job_analysis_method", "How the criteria were derived from the job", "4.4");
  need(engagement.work_context, "work_context", "The work, its context and the systems the role uses", "4.9 / 4.12");
  need(engagement.sme_review_note, "sme_review_note", "Who from the job reviewed the exercises for difficulty", "4.23");
  need(engagement.exercise_independence_note, "exercise_independence_note", "Confirmation that no exercise carries into another", "4.19");
  need(engagement.facilities_note, "facilities_note", "The people and facilities the centre needs", "3.26");

  const byCompetency = new Map<string, Set<string>>();
  const byExercise = new Map<string, Set<string>>();
  for (const m of matrix) {
    const c = byCompetency.get(m.competencyId) ?? new Set<string>();
    c.add(m.exerciseId);
    byCompetency.set(m.competencyId, c);
    const e = byExercise.get(m.exerciseId) ?? new Set<string>();
    e.add(m.competencyId);
    byExercise.set(m.exerciseId, e);
  }

  const exerciseLoad = exercises.map((x) => {
    const n = byExercise.get(x.id)?.size ?? 0;
    return {
      id: x.id,
      name: x.name,
      competencies: n,
      minutes: x.durationMinutes ?? null,
      overloaded: n > MAX_COMPETENCIES_PER_EXERCISE,
    };
  });

  const thinlyObserved = competencies
    .map((c) => ({ competencyId: c.competencyId, name: c.name, exercises: byCompetency.get(c.competencyId)?.size ?? 0 }))
    .filter((c) => c.exercises < MIN_EXERCISES_PER_COMPETENCY);

  const withoutIndicators = competencies
    .filter((c) => (c.indicatorCount ?? 0) === 0)
    .map((c) => ({ competencyId: c.competencyId, name: c.name }));

  const withoutRationale = competencies
    .filter((c) => !c.rationale || !c.rationale.trim())
    .map((c) => ({ competencyId: c.competencyId, name: c.name }));

  const cautions: string[] = [];
  const overloaded = exerciseLoad.filter((x) => x.overloaded);
  for (const x of overloaded) {
    cautions.push(
      `${x.name} is mapped to ${x.competencies} criteria. More than ${MAX_COMPETENCIES_PER_EXERCISE} in one exercise is more than an assessor can reliably observe at once (4.5; the number is practice, not the clause).`
    );
  }
  if (competencies.length > MAX_COMPETENCIES_PER_CENTRE && !engagement.criteria_load_ack) {
    cautions.push(
      `This centre assesses ${competencies.length} criteria. Beyond about ${MAX_COMPETENCIES_PER_CENTRE}, evidence per criterion thins out across the exercises available (4.5). Record why if that is deliberate.`
    );
  }
  for (const c of thinlyObserved) {
    cautions.push(
      `${c.name} is observed in ${c.exercises === 0 ? "no exercise" : "only one exercise"}, so nothing converges on it (4.15, 4.20).`
    );
  }
  if (withoutIndicators.length > 0) {
    cautions.push(
      `${withoutIndicators.length} criteria have no behavioural indicators, so assessors have nothing concrete to rate against (4.20): ${withoutIndicators.map((c) => c.name).join(", ")}.`
    );
  }
  if (withoutRationale.length > 0) {
    cautions.push(
      `${withoutRationale.length} of ${competencies.length} criteria have no recorded link to the job (4.4): ${withoutRationale.map((c) => c.name).join(", ")}.`
    );
  }

  const outputModes = Array.from(
    new Set(
      exercises
        .map((x) => OUTPUT_MODE[x.exerciseType ?? ""] ?? null)
        .filter((x): x is string => Boolean(x))
    )
  );
  if (outputModes.length < 2 && exercises.length > 1) {
    cautions.push(
      "Every exercise produces the same kind of output. A role that involves writing and speaking should be assessed in both (4.21)."
    );
  }

  return {
    missing,
    cautions,
    exerciseLoad,
    thinlyObserved,
    withoutIndicators,
    withoutRationale,
    outputModes,
    approved: Boolean(engagement.plan_approved_at),
  };
}
