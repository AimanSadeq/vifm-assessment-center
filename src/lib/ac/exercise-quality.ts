/**
 * Is this exercise fit to assess anyone?
 *
 * BPS 4.36 is unusual: instead of asking for a general judgement it names eight
 * distinct checks. So they are eight questions here, each with the thing it is
 * actually asking - a list of eight nouns is a list nobody can act on, and the
 * one most often skipped is the last, which is the one that decides whether the
 * exercise works at all.
 *
 * 4.37 adds that an exercise new to a centre shall be trialled on people
 * representative of the intended participants who are not themselves
 * participants. "We tried it on the team" is not that, so the record asks who.
 */

export type ExerciseCheckKey =
  | "content_validity"
  | "face_validity"
  | "timings"
  | "complexity"
  | "rating_benchmarks"
  | "instructions"
  | "materials"
  | "evidence_sufficiency";

export type ExerciseCheckDef = {
  key: ExerciseCheckKey;
  label: string;
  /** What this check is actually asking, in the words someone would use. */
  question: string;
  clause: string;
};

export const EXERCISE_CHECKS: ExerciseCheckDef[] = [
  {
    key: "content_validity",
    label: "Content validity",
    question: "Does what the participant does here resemble the work the role actually involves?",
    clause: "4.36",
  },
  {
    key: "face_validity",
    label: "Face validity",
    question: "Will a participant recognise this as a fair test of the role, rather than a puzzle?",
    clause: "4.36",
  },
  {
    key: "timings",
    label: "Timings",
    question: "Is there enough time to do it properly, and not so much that it stops discriminating?",
    clause: "4.36",
  },
  {
    key: "complexity",
    label: "Level of complexity",
    question: "Does the difficulty match the level of the role, rather than the level of the designer?",
    clause: "4.36 / 4.23",
  },
  {
    key: "rating_benchmarks",
    label: "Benchmarks for ratings",
    question: "Can two assessors watching the same performance be expected to land on the same rating?",
    clause: "4.36 / 4.31",
  },
  {
    key: "instructions",
    label: "Clarity of instructions",
    question: "Could a participant fail this because they misread what was being asked?",
    clause: "4.36",
  },
  {
    key: "materials",
    label: "Comprehensiveness of materials",
    question: "Is everything needed actually there: briefs, data, role-player material, forms?",
    clause: "4.36",
  },
  {
    key: "evidence_sufficiency",
    label: "Evidence can be collected",
    question:
      "For every criterion mapped to this exercise, will it produce enough behaviour to rate that criterion on?",
    clause: "4.36 / 4.20",
  },
];

export const EXERCISE_CHECK_MAP: Record<string, ExerciseCheckDef> = Object.fromEntries(
  EXERCISE_CHECKS.map((c) => [c.key, c])
);

export type ExerciseCheckRow = {
  checkKey: string;
  status: "pass" | "concern" | "not_applicable";
  note?: string | null;
  checkedByName?: string | null;
  checkedAt?: string | null;
};

export type ExerciseTrialRow = {
  trialledOn: string;
  participantCount?: number | null;
  representativeNote?: string | null;
  wasPilot?: boolean;
};

export type ExerciseQualityReview = {
  /** Checks with no record at all. */
  unchecked: ExerciseCheckDef[];
  /** Checks recorded as a concern. */
  concerns: { check: ExerciseCheckDef; note: string | null }[];
  /** 4.37: this exercise has never run live and has no trial recorded. */
  needsTrial: boolean;
  trials: number;
  piloted: boolean;
  /** Ready in the sense 4.36 means: every check asked, none outstanding. */
  complete: boolean;
  problems: string[];
};

export function reviewExerciseQuality(input: {
  exerciseName: string;
  checks: ExerciseCheckRow[];
  trials: ExerciseTrialRow[];
  /** Has this exercise been used at a centre that already ran? */
  usedLive: boolean;
}): ExerciseQualityReview {
  const recorded = new Map(input.checks.map((c) => [c.checkKey, c]));
  const unchecked = EXERCISE_CHECKS.filter((c) => !recorded.has(c.key));
  const concerns = EXERCISE_CHECKS.filter((c) => recorded.get(c.key)?.status === "concern").map((c) => ({
    check: c,
    note: recorded.get(c.key)?.note ?? null,
  }));

  const needsTrial = !input.usedLive && input.trials.length === 0;
  const problems: string[] = [];

  if (unchecked.length > 0) {
    problems.push(
      `${unchecked.length} of ${EXERCISE_CHECKS.length} checks have not been made on ${input.exerciseName}: ${unchecked.map((c) => c.label).join(", ")} (4.36).`
    );
  }
  for (const c of concerns) {
    problems.push(
      `${c.check.label} is recorded as a concern on ${input.exerciseName}${c.note ? `: ${c.note}` : ""} (${c.check.clause}).`
    );
  }
  if (needsTrial) {
    problems.push(
      `${input.exerciseName} has never been used at a centre and has no trial recorded. A new exercise is trialled on people representative of the intended participants, who are not themselves participants (4.37).`
    );
  }

  return {
    unchecked,
    concerns,
    needsTrial,
    trials: input.trials.length,
    piloted: input.trials.some((t) => t.wasPilot),
    complete: unchecked.length === 0 && concerns.length === 0 && !needsTrial,
    problems,
  };
}
