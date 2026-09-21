/**
 * What an assessment centre is for.
 *
 * The BPS standard for assessment centres requires the purpose to be defined up
 * front (clause 3.7), because it decides how the centre must behave: a centre
 * that supports selection decisions has to reach its overall rating by an
 * arithmetic rule (clause 7.4), while a development centre reaches it by
 * assessor discussion and owes the participant feedback (clauses 7.9, 8.14).
 *
 * Single source of truth: the database CHECK constraint in migration 00204
 * carries the same three values.
 */
export const AC_PURPOSES = [
  {
    value: "selection",
    label: "Selection",
    short: "Hiring or promotion decisions",
    description:
      "The centre informs a decision about a person: hiring, promotion or placement. The overall rating is "
      + "calculated from the agreed competency ratings using the weights fixed at design time.",
  },
  {
    value: "development",
    label: "Development",
    short: "Growth, with feedback owed",
    description:
      "The centre exists to help people grow. Assessors agree the overall rating in discussion, and every "
      + "participant is owed feedback.",
  },
  {
    value: "succession",
    label: "Succession",
    short: "Readiness for future roles",
    description:
      "The centre assesses readiness for future roles. Where the outcome informs an appointment, treat it as "
      + "selection.",
  },
] as const;

export type AcPurpose = (typeof AC_PURPOSES)[number]["value"];

export const AC_PURPOSE_VALUES = AC_PURPOSES.map((p) => p.value) as readonly AcPurpose[];

export function acPurpose(value: string | null | undefined) {
  return AC_PURPOSES.find((p) => p.value === value) ?? null;
}

export function acPurposeLabel(value: string | null | undefined) {
  return acPurpose(value)?.label ?? "Not recorded";
}

/**
 * Selection centres must not reach an overall rating by consensus (clause 7.4).
 * Succession counts only when the client says the outcome drives an appointment,
 * which is recorded as selection, so this stays a single-value check.
 */
export function requiresArithmeticRating(value: string | null | undefined): boolean {
  return value === "selection";
}
