// Client-safe half of the HiPo Engagement instrument: the six items and the
// pure scoring function. NO server imports here - the token form (a client
// component) imports this module, so anything that pulls next/headers or the
// service client would break the production build. Server-side lookup/submit
// helpers live in ./engagement.ts, which re-exports these.

export type EngagementItem = {
  key: string;
  en: string;
  ar: string;
  /** Reverse-keyed: high agreement means LOW engagement (scored 6 - answer). */
  reverse?: boolean;
};

/** The six manager-rated items. Observable judgements only - no mind-reading. */
export const HIPO_ENGAGEMENT_ITEMS: EngagementItem[] = [
  {
    key: "future_here",
    en: "They talk about their future in terms of this organisation.",
    ar: "يتحدث عن مستقبله المهني في إطار هذه المؤسسة.",
  },
  {
    key: "discretionary_effort",
    en: "They routinely give effort beyond what the role requires.",
    ar: "يبذل باستمرار جهدا يتجاوز متطلبات الدور.",
  },
  {
    key: "acts_on_development",
    en: "When given feedback or learning opportunities, they visibly act on them.",
    ar: "عند حصوله على ملاحظات أو فرص تعلم، يتصرف بناء عليها بشكل ملحوظ.",
  },
  {
    key: "retention_risk",
    en: "I see signals they may leave us within the next year.",
    ar: "أرى مؤشرات على احتمال مغادرته المؤسسة خلال السنة القادمة.",
    reverse: true,
  },
  {
    key: "purpose_alignment",
    en: "They connect their work to the organisation's purpose and priorities.",
    ar: "يربط عمله برسالة المؤسسة وأولوياتها.",
  },
  {
    key: "internal_appetite",
    en: "They actively seek bigger responsibility inside this organisation.",
    ar: "يسعى بنشاط إلى تحمل مسؤوليات أكبر داخل هذه المؤسسة.",
  },
];

export const ENGAGEMENT_MIN_ANSWERED = 5;

/** Pure scoring: mean of answered items on 1-5 (reverse-keyed applied).
 *  Returns null below the minimum-coverage floor. */
export function scoreEngagement(answers: Record<string, number>): number | null {
  const vals: number[] = [];
  for (const item of HIPO_ENGAGEMENT_ITEMS) {
    const raw = answers[item.key];
    if (typeof raw !== "number" || !Number.isInteger(raw) || raw < 1 || raw > 5) continue;
    vals.push(item.reverse ? 6 - raw : raw);
  }
  if (vals.length < ENGAGEMENT_MIN_ANSWERED) return null;
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100;
}
