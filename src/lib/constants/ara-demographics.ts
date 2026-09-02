/**
 * ARC OPTIONAL respondent demographics - the segments the interactive
 * dashboard can slice by. Decision (2026-09-02): segments are optional. A
 * respondent may answer this short "about you" block or skip it; nothing in
 * the scoring depends on it, and it is only ever shown as an aggregate over a
 * group at least ARA_SEGMENT_MIN_N strong.
 *
 * The option keys are the stored vocabulary (ara_respondents.demographics
 * jsonb, migration 00202); labels are bilingual for the form and the
 * dashboard. Keep the sets short - a respondent should be able to answer in
 * under twenty seconds - and GCC-appropriate (nationality is national vs
 * expatriate, not a country list).
 */

export type AraDemographicDimensionId = "grade" | "tenure" | "gender" | "nationality";

export type AraDemographicOption = { key: string; en: string; ar: string };

export type AraDemographicDimension = {
  id: AraDemographicDimensionId;
  label_en: string;
  label_ar: string;
  options: ReadonlyArray<AraDemographicOption>;
};

export const ARA_DEMOGRAPHICS: ReadonlyArray<AraDemographicDimension> = [
  {
    id: "grade",
    label_en: "Grade",
    label_ar: "الدرجة الوظيفية",
    options: [
      { key: "executive", en: "Executive", ar: "قيادة تنفيذية" },
      { key: "manager", en: "Manager", ar: "مدير" },
      { key: "specialist", en: "Specialist", ar: "أخصائي" },
      { key: "officer", en: "Officer", ar: "موظف" },
    ],
  },
  {
    id: "tenure",
    label_en: "Time in the organisation",
    label_ar: "مدة الخدمة في المؤسسة",
    options: [
      { key: "lt_2", en: "Under 2 years", ar: "أقل من سنتين" },
      { key: "2_5", en: "2 to 5 years", ar: "من سنتين إلى 5 سنوات" },
      { key: "5_10", en: "5 to 10 years", ar: "من 5 إلى 10 سنوات" },
      { key: "gt_10", en: "Over 10 years", ar: "أكثر من 10 سنوات" },
    ],
  },
  {
    id: "gender",
    label_en: "Gender",
    label_ar: "الجنس",
    options: [
      { key: "female", en: "Female", ar: "أنثى" },
      { key: "male", en: "Male", ar: "ذكر" },
    ],
  },
  {
    id: "nationality",
    label_en: "Nationality",
    label_ar: "الجنسية",
    options: [
      { key: "national", en: "National", ar: "مواطن" },
      { key: "expatriate", en: "Expatriate", ar: "مقيم" },
    ],
  },
];

/** Stored shape: only known dimension ids, only known option keys. */
export type AraDemographics = Partial<Record<AraDemographicDimensionId, string>>;

/**
 * A segment is shown only when this many people fall in it. Below that a
 * group mean is a person, not a segment - and gender and nationality are
 * sensitive in GCC deployments.
 */
export const ARA_SEGMENT_MIN_N = 3;

/**
 * Keep only known dimensions with known option keys. Unknown input is dropped
 * silently rather than rejected: the block is optional, so a stale key from an
 * older form should not block a submission.
 */
export function sanitiseDemographics(input: unknown): AraDemographics | null {
  if (!input || typeof input !== "object") return null;
  const out: AraDemographics = {};
  for (const dim of ARA_DEMOGRAPHICS) {
    const raw = (input as Record<string, unknown>)[dim.id];
    if (typeof raw !== "string") continue;
    if (dim.options.some((o) => o.key === raw)) out[dim.id] = raw;
  }
  return Object.keys(out).length > 0 ? out : null;
}
