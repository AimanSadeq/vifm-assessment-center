/**
 * Assessment centre staffing rules.
 *
 * The BPS standard sets floors that a centre must meet before it runs:
 *   - more than one assessor assesses each participant (5.18)
 *   - at least one assessor for every three participants (5.21)
 *   - assessor and role-player workload is not too great (5.20, 4.16, 4.17)
 *   - nobody assesses a participant they know (5.36)
 *
 * The first two are absolutes and are treated as blocking. The third has no
 * number in the standard, because what is too much depends on the exercise mix,
 * so it is reported as a caution with the figures behind it rather than enforced
 * as if it were a rule.
 */

/** Minimum distinct assessors per participant (BPS 5.18). */
export const MIN_ASSESSORS_PER_PARTICIPANT = 2;

/** Participants per assessor (BPS 5.21: at least one assessor per three). */
export const MAX_PARTICIPANTS_PER_ASSESSOR = 3;

/**
 * Observations per assessor above which we raise a caution. The standard sets no
 * number (5.20 says only that the workload must let them do the job well), so
 * this is VIFM's own guide, not a rule, and it never blocks.
 */
export const ASSESSOR_LOAD_CAUTION = 8;

export type StaffingInput = {
  candidateIds: string[];
  /** One row per observation: which assessor sees which candidate in which exercise. */
  assignments: { assessorId: string; candidateId: string; exerciseId?: string | null }[];
  /** Assessor id to display name, for readable messages. */
  assessorNames?: Record<string, string>;
  candidateNames?: Record<string, string>;
};

export type StaffingReport = {
  participants: number;
  assessors: number;
  /** Ceil(participants / 3): the fewest assessors the standard allows. */
  assessorsRequired: number;
  perCandidate: { candidateId: string; name?: string; assessors: number }[];
  perAssessor: { assessorId: string; name?: string; observations: number; candidates: number }[];
  /** Rules that are not met. A centre should not run while any of these stand. */
  blocking: string[];
  /** Figures worth a second look, which do not stop a centre running. */
  cautions: string[];
  meetsFloors: boolean;
};

export function reviewStaffing(input: StaffingInput): StaffingReport {
  const names = input.assessorNames ?? {};
  const candNames = input.candidateNames ?? {};

  const assessorsByCandidate = new Map<string, Set<string>>();
  const candidatesByAssessor = new Map<string, Set<string>>();
  const loadByAssessor = new Map<string, number>();
  for (const a of input.assignments) {
    if (!assessorsByCandidate.has(a.candidateId)) assessorsByCandidate.set(a.candidateId, new Set());
    assessorsByCandidate.get(a.candidateId)!.add(a.assessorId);
    if (!candidatesByAssessor.has(a.assessorId)) candidatesByAssessor.set(a.assessorId, new Set());
    candidatesByAssessor.get(a.assessorId)!.add(a.candidateId);
    loadByAssessor.set(a.assessorId, (loadByAssessor.get(a.assessorId) ?? 0) + 1);
  }

  const participants = input.candidateIds.length;
  const assessors = candidatesByAssessor.size;
  const assessorsRequired = Math.ceil(participants / MAX_PARTICIPANTS_PER_ASSESSOR);

  const perCandidate = input.candidateIds.map((candidateId) => ({
    candidateId,
    name: candNames[candidateId],
    assessors: assessorsByCandidate.get(candidateId)?.size ?? 0,
  }));

  const perAssessor = [...candidatesByAssessor.entries()].map(([assessorId, cands]) => ({
    assessorId,
    name: names[assessorId],
    observations: loadByAssessor.get(assessorId) ?? 0,
    candidates: cands.size,
  }));

  const blocking: string[] = [];
  const cautions: string[] = [];

  const unassigned = perCandidate.filter((c) => c.assessors === 0);
  const thin = perCandidate.filter((c) => c.assessors > 0 && c.assessors < MIN_ASSESSORS_PER_PARTICIPANT);

  if (participants === 0) {
    cautions.push("No participants have been added yet.");
  }
  if (unassigned.length > 0) {
    blocking.push(
      `${unassigned.length} participant${unassigned.length === 1 ? " has" : "s have"} no assessor assigned`
      + (unassigned.length <= 3 ? `: ${unassigned.map((c) => c.name ?? c.candidateId).join(", ")}.` : ".")
    );
  }
  if (thin.length > 0) {
    blocking.push(
      `${thin.length} participant${thin.length === 1 ? " is" : "s are"} seen by only one assessor. `
      + "The standard requires more than one assessor per participant."
    );
  }
  if (participants > 0 && assessors < assessorsRequired) {
    blocking.push(
      `${assessors} assessor${assessors === 1 ? "" : "s"} for ${participants} participants. `
      + `At least ${assessorsRequired} are required (one per three participants).`
    );
  }

  const overloaded = perAssessor.filter((a) => a.observations > ASSESSOR_LOAD_CAUTION);
  for (const a of overloaded) {
    cautions.push(
      `${a.name ?? "One assessor"} has ${a.observations} observations across ${a.candidates} participants. `
      + "Check they can do each one properly."
    );
  }

  return {
    participants,
    assessors,
    assessorsRequired,
    perCandidate,
    perAssessor,
    blocking,
    cautions,
    meetsFloors: blocking.length === 0,
  };
}
