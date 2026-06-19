import {
  ARA_INDIVIDUAL_FACTOR_IDS,
  ARA_INDIVIDUAL_FACTOR_MAP,
  FACTOR_DESCRIPTIVE,
  getIndividualMaturityStage,
  type AraIndividualFactorId,
} from "@/lib/constants/ara-individual-factors";

/**
 * Deterministic, evidence-grounded analysis of a Personal AI Readiness result
 * for the selection (hiring) lens.
 *
 * Every statement is derived ONLY from the candidate's own answers - the
 * per-factor scores (self-ratings + objective scenario / knowledge items) the
 * results page already computes. No AI generation, so the read is reproducible
 * and defensible: the same answers always yield the same analysis. It is framed
 * as a screening input to weigh against interview and other evidence, never as
 * a hiring decision.
 *
 * Arabic is best-effort MSA per project convention and still needs native
 * review before going to a client.
 */

export type AnalysisBlock = { en: string; ar: string };

export type PersonalAnalysis = {
  /** Overall hiring read keyed to the overall maturity stage. */
  verdict: AnalysisBlock;
  /** Even vs spiky, citing the spread + the strongest/weakest factor. */
  profileShape: AnalysisBlock;
  /** Self-rating vs objective-item calibration; null when too few objective items. */
  calibration: AnalysisBlock | null;
  /** Factors at/above target (>=4); falls back to the single highest factor. */
  strengths: { factorId: AraIndividualFactorId; score: number; read: AnalysisBlock }[];
  /** Factors below target (<4), lowest first, each with an interview probe. */
  developmentAreas: { factorId: AraIndividualFactorId; score: number; read: AnalysisBlock; probe: AnalysisBlock }[];
  /** True when no factor is below target. */
  allAtTarget: boolean;
  /** The "what this is / isn't" caveat for a hiring reader. */
  basis: AnalysisBlock;
};

const TARGET = 4;

/** Factor-specific interview probes - what to verify when a factor is light. */
const FACTOR_PROBE: Record<AraIndividualFactorId, AnalysisBlock> = {
  thinking_sense_check: {
    en: "Ask for a specific time they caught an AI output that was wrong, fabricated, or misleading - and what they did about it.",
    ar: "اطلب موقفاً محدداً اكتشف فيه مخرجاً خاطئاً أو ملفقاً أو مضللاً من الذكاء الاصطناعي، وكيف تصرّف حياله.",
  },
  results_working_practice: {
    en: "Ask how AI fits into a task they do regularly, and what concretely changed in the speed or quality of their output.",
    ar: "اسأل كيف يدمج الذكاء الاصطناعي في مهمة يؤديها بانتظام، وما الذي تغيّر فعلياً في سرعة مخرجاته أو جودتها.",
  },
  people_collaboration: {
    en: "Ask for an example of helping a colleague or team use AI more soundly - sharing a prompt, setting a norm, or pushing back on misuse.",
    ar: "اطلب مثالاً ساعد فيه زميلاً أو فريقاً على استخدام الذكاء الاصطناعي بشكل أسلم - بمشاركة تعليمة، أو وضع معيار، أو الاعتراض على سوء الاستخدام.",
  },
  self_adaptive_mindset: {
    en: "Ask about a workflow they changed because of AI, and how they weigh confidentiality, fairness, and policy when deciding what to use.",
    ar: "اسأل عن سير عمل غيّره بسبب الذكاء الاصطناعي، وكيف يوازن بين السرية والإنصاف والسياسة عند اختيار ما يستخدمه.",
  },
};

const fmt = (n: number): string => n.toFixed(1);

export function buildPersonalAnalysis(args: {
  factorScores: Record<AraIndividualFactorId, number>;
  overallScore: number;
  /** Mean of the self-rating (Likert) items only. */
  selfAvg?: number;
  /** Mean of the objective (scenario / knowledge) items only. */
  objectiveAvg?: number;
  /** How many objective items were answered (gates the calibration read). */
  objectiveCount?: number;
}): PersonalAnalysis | null {
  const { factorScores, overallScore } = args;
  if (!(overallScore > 0)) return null;

  const ranked = [...ARA_INDIVIDUAL_FACTOR_IDS]
    .filter((id) => factorScores[id] > 0)
    .sort((a, b) => factorScores[b] - factorScores[a]);
  if (ranked.length === 0) return null;

  const stage = getIndividualMaturityStage(overallScore);
  const ov = fmt(overallScore);

  const verdict: AnalysisBlock =
    stage.id === "embedded"
      ? {
          en: `Overall, this candidate works with AI fluently (${ov} / 5). Across the four readiness factors they show a confident, established relationship with AI - a low ramp-up risk for a role where AI-assisted work is expected.`,
          ar: `إجمالاً، يتعامل هذا المرشح مع الذكاء الاصطناعي بطلاقة (${ov} / 5). ويُظهر عبر عوامل الجاهزية الأربعة علاقة واثقة وراسخة مع الذكاء الاصطناعي - ما يعني مخاطر تأهيل منخفضة لدور يُتوقَّع فيه العمل المدعوم بالذكاء الاصطناعي.`,
        }
      : stage.id === "practising"
      ? {
          en: `Overall, this candidate is actively building their AI practice (${ov} / 5). They apply AI to real work with growing judgement - expect a short, manageable ramp-up rather than a standing start.`,
          ar: `إجمالاً، يبني هذا المرشح ممارسته للذكاء الاصطناعي بنشاط (${ov} / 5). ويطبّقه على عمل فعلي بحُكم متنامٍ - فتوقّع فترة تأهيل قصيرة ومنطقية لا بدايةً من الصفر.`,
        }
      : {
          en: `Overall, this candidate is at an early stage with AI (${ov} / 5). They would benefit from structured onboarding and clear guardrails before AI-assisted work is relied upon.`,
          ar: `إجمالاً، هذا المرشح في مرحلة مبكرة مع الذكاء الاصطناعي (${ov} / 5). وسيستفيد من تأهيل منظَّم وضوابط واضحة قبل الاعتماد على العمل المدعوم بالذكاء الاصطناعي.`,
        };

  const vals = ranked.map((id) => factorScores[id]);
  const max = Math.max(...vals), min = Math.min(...vals);
  const spread = max - min;
  const topId = ranked[0];
  const bottomId = ranked[ranked.length - 1];
  const top = ARA_INDIVIDUAL_FACTOR_MAP[topId];
  const bottom = ARA_INDIVIDUAL_FACTOR_MAP[bottomId];

  const profileShape: AnalysisBlock =
    spread <= 0.5
      ? {
          en: `An even profile - consistent across all four factors (a spread of just ${fmt(spread)}), with no single area markedly ahead or behind.`,
          ar: `ملمح متوازن - متسق عبر العوامل الأربعة (بفارق ${fmt(spread)} فقط)، دون تقدّم أو تأخّر ملحوظ في أي جانب.`,
        }
      : spread <= 1.0
      ? {
          en: `A fairly even profile with a modest tilt toward ${top.name_en} (${fmt(max)}); ${bottom.name_en} is the lightest at ${fmt(min)}.`,
          ar: `ملمح متوازن نسبياً مع ميل طفيف نحو ${top.name_ar} (${fmt(max)})؛ وأقلّها ${bottom.name_ar} عند ${fmt(min)}.`,
        }
      : {
          en: `An uneven profile - notably stronger on ${top.name_en} (${fmt(max)}) than ${bottom.name_en} (${fmt(min)}), a spread of ${fmt(spread)}. Weigh which the role leans on most.`,
          ar: `ملمح غير متوازن - أقوى بوضوح في ${top.name_ar} (${fmt(max)}) منه في ${bottom.name_ar} (${fmt(min)})، بفارق ${fmt(spread)}. وازِن أيّهما يعتمد عليه الدور أكثر.`,
        };

  const readFor = (id: AraIndividualFactorId): AnalysisBlock => {
    const st = getIndividualMaturityStage(factorScores[id]);
    return FACTOR_DESCRIPTIVE[id][st.id];
  };

  const strongIds = ranked.filter((id) => factorScores[id] >= TARGET);
  const belowIds = ranked.filter((id) => factorScores[id] < TARGET).reverse(); // lowest first

  // When nothing clears the target, surface the single highest factor as a
  // relative strength so the read isn't all-negative - and then exclude it
  // from the development list to avoid double-counting.
  const strengths = (strongIds.length > 0 ? strongIds : [topId]).map((id) => ({
    factorId: id,
    score: factorScores[id],
    read: readFor(id),
  }));

  const developmentAreas = belowIds
    .filter((id) => !(strongIds.length === 0 && id === topId))
    .map((id) => ({
      factorId: id,
      score: factorScores[id],
      read: readFor(id),
      probe: FACTOR_PROBE[id],
    }));

  let calibration: AnalysisBlock | null = null;
  if (
    args.selfAvg != null && args.objectiveAvg != null &&
    args.objectiveCount != null && args.objectiveCount >= 4 &&
    args.selfAvg > 0 && args.objectiveAvg > 0
  ) {
    const s = fmt(args.selfAvg), o = fmt(args.objectiveAvg);
    const d = args.selfAvg - args.objectiveAvg;
    calibration =
      d >= 0.75
        ? {
            en: `Self-ratings (${s}) run ahead of performance on the objective scenario and knowledge items (${o}) - a possible over-confidence signal. Verify claimed strengths with concrete examples.`,
            ar: `تتقدّم التقييمات الذاتية (${s}) على الأداء في بنود السيناريو والمعرفة الموضوعية (${o}) - وهو مؤشر محتمل على ثقة زائدة. تحقّق من نقاط القوة المُدّعاة بأمثلة ملموسة.`,
          }
        : d <= -0.75
        ? {
            en: `Performance on the objective items (${o}) is stronger than the candidate's own self-ratings (${s}) - they may under-sell their capability.`,
            ar: `الأداء في البنود الموضوعية (${o}) أقوى من التقييمات الذاتية للمرشح (${s}) - وقد يبخس قدرته حقّها.`,
          }
        : {
            en: `Self-ratings (${s}) and the objective items (${o}) are well aligned - the self-assessment looks calibrated.`,
            ar: `تتوافق التقييمات الذاتية (${s}) مع البنود الموضوعية (${o}) بشكل جيد - ويبدو التقييم الذاتي معايَراً.`,
          };
  }

  const basis: AnalysisBlock = {
    en: "This analysis is generated only from the candidate's own responses to the assessment - their self-ratings and the objective items they answered. It is a screening input to weigh alongside interview and other evidence, not a hiring decision.",
    ar: "يُبنى هذا التحليل فقط من إجابات المرشح على التقييم - تقييماته الذاتية والبنود الموضوعية التي أجاب عنها. وهو مُدخل فرز يُوازَن مع المقابلة والأدلة الأخرى، وليس قراراً توظيفياً.",
  };

  return { verdict, profileShape, calibration, strengths, developmentAreas, allAtTarget: belowIds.length === 0, basis };
}
