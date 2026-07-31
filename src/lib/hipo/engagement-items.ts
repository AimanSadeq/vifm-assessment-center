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

/** The twenty manager-rated items. Observable judgements only - no mind-reading -
 *  spanning stay-intent, discretionary effort, development response, purpose,
 *  advancement appetite, advocacy, pride, energy, ownership, resilience, values,
 *  relationships, long-term orientation, learning, initiative, reliability, and
 *  recommendation, with three reverse-keyed disengagement signals. Older surveys
 *  answered only the first six keys; the report filters to answered items, so
 *  the expansion is backward compatible. */
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
  {
    key: "advocacy",
    en: "They speak positively about this organisation to others.",
    ar: "يتحدث بإيجابية عن هذه المؤسسة أمام الآخرين.",
  },
  {
    key: "pride",
    en: "They show pride in being part of this organisation.",
    ar: "يُظهر اعتزازه بانتمائه إلى هذه المؤسسة.",
  },
  {
    key: "energy",
    en: "They bring visible energy and enthusiasm to their work.",
    ar: "يُضفي طاقة وحماسا ظاهرين على عمله.",
  },
  {
    key: "ownership",
    en: "They take personal ownership of outcomes rather than waiting to be told.",
    ar: "يتحمّل مسؤولية النتائج شخصيا بدلا من انتظار التوجيه.",
  },
  {
    key: "resilience_commitment",
    en: "They stay committed and constructive when things get difficult.",
    ar: "يبقى ملتزما وإيجابيا عندما تصعب الأمور.",
  },
  {
    key: "values_alignment",
    en: "Their day-to-day behaviour reflects the organisation's values.",
    ar: "يعكس سلوكه اليومي قيم المؤسسة.",
  },
  {
    key: "team_connection",
    en: "They build genuine, supportive relationships with colleagues.",
    ar: "يبني علاقات داعمة وصادقة مع زملائه.",
  },
  {
    key: "long_term",
    en: "They make decisions with the organisation's long-term interests in mind.",
    ar: "يتخذ قراراته بما يخدم مصلحة المؤسسة على المدى الطويل.",
  },
  {
    key: "learning_curiosity",
    en: "They show curiosity and a drive to keep learning in their field.",
    ar: "يُظهر فضولا ورغبة في مواصلة التعلّم في مجاله.",
  },
  {
    key: "initiative_improve",
    en: "They proactively suggest ways to improve how the team works.",
    ar: "يقترح بشكل استباقي طرقا لتحسين طريقة عمل الفريق.",
  },
  {
    key: "reliability_commitment",
    en: "They can be relied on to follow through on commitments they make.",
    ar: "يمكن الاعتماد عليه في الوفاء بالالتزامات التي يقطعها.",
  },
  {
    key: "disengagement_signal",
    en: "They often seem to be going through the motions rather than genuinely invested.",
    ar: "كثيرا ما يبدو أنه يؤدي عمله بشكل روتيني دون انخراط حقيقي.",
    reverse: true,
  },
  {
    key: "external_looking",
    en: "They have mentioned or hinted at exploring opportunities elsewhere.",
    ar: "ألمح أو ذكر أنه يستكشف فرصا خارج المؤسسة.",
    reverse: true,
  },
  {
    key: "recommend_org",
    en: "I believe they would recommend this organisation as a place to work.",
    ar: "أعتقد أنه سيوصي بهذه المؤسسة كمكان جيد للعمل.",
  },
];

// Require most items answered so the mean is stable (about 75% of 20).
export const ENGAGEMENT_MIN_ANSWERED = 15;

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
