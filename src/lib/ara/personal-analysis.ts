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

/** Hiring advisory band - never an auto-reject; a human always decides. */
export type AcquisitionBand = "advance" | "review" | "hold";

/** An AI-specific risk signal for a hiring reader to verify, never to auto-fail on. */
export type RiskFlag = { id: string; title: AnalysisBlock; detail: AnalysisBlock };

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
  /** Advisory decision band - advance / review / hold (never auto-reject). */
  band: { id: AcquisitionBand; label: AnalysisBlock; rationale: AnalysisBlock };
  /** Printed on the report face: this is a screening signal, a human decides. */
  guardrail: AnalysisBlock;
  /** AI-specific risks to probe - over-reliance, over-claiming, responsible-use. */
  riskFlags: RiskFlag[];
  /** AI readiness ages fast - a point-in-time caveat for the hiring reader. */
  freshness: AnalysisBlock;
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

  // ── Advisory band: advance / review / hold. NEVER an auto-reject - a Hold
  // caps the advice at "weigh carefully", it does not disqualify the person. ──
  const belowCount = belowIds.length;
  const bandId: AcquisitionBand =
    overallScore >= TARGET && belowCount === 0 ? "advance"
    : overallScore < 3 || belowCount >= 3 ? "hold"
    : "review";
  const band: PersonalAnalysis["band"] = {
    id: bandId,
    label:
      bandId === "advance" ? { en: "Advance", ar: "للتقدّم" }
      : bandId === "review" ? { en: "Review", ar: "للمراجعة" }
      : { en: "Hold", ar: "للتريّث" },
    rationale:
      bandId === "advance"
        ? {
            en: `Meets target on all four readiness factors (overall ${ov} / 5). A strong AI-readiness signal for a role where AI-assisted work is expected - proceed and confirm at interview.`,
            ar: `يحقق المستوى المستهدف في عوامل الجاهزية الأربعة جميعها (الإجمالي ${ov} / 5). إشارة جاهزية قوية لدور يُتوقَّع فيه العمل المدعوم بالذكاء الاصطناعي - تقدّم وأكّد في المقابلة.`,
          }
        : bandId === "review"
        ? {
            en: `A workable AI-readiness signal (overall ${ov} / 5) with ${belowCount} factor${belowCount === 1 ? "" : "s"} below target. Advance after probing the lighter area${belowCount === 1 ? "" : "s"} below - the gap is closeable, not disqualifying.`,
            ar: `إشارة جاهزية صالحة (الإجمالي ${ov} / 5) مع ${belowCount} ${belowCount === 1 ? "عامل" : "عوامل"} دون المستوى المستهدف. تقدّم بعد استقصاء المجال${belowCount === 1 ? "" : "ات"} الأخف أدناه - الفجوة قابلة للإغلاق وليست مُقصية.`,
          }
        : {
            en: `An early AI-readiness signal (overall ${ov} / 5)${belowCount >= 3 ? " with several factors below target" : ""}. Weigh against the role's real AI demands; if AI-assisted work is central, expect structured onboarding before relying on it.`,
            ar: `إشارة جاهزية مبكرة (الإجمالي ${ov} / 5)${belowCount >= 3 ? " مع عدة عوامل دون المستوى المستهدف" : ""}. وازِنها مع متطلبات الدور الفعلية للذكاء الاصطناعي؛ وإذا كان العمل المدعوم بالذكاء الاصطناعي محورياً، فتوقّع تأهيلاً منظَّماً قبل الاعتماد عليه.`,
          },
  };

  const guardrail: AnalysisBlock = {
    en: "This is a screening signal, not a decision. A qualified person makes the hiring call; no score here auto-disqualifies a candidate. Read it alongside the interview and other evidence.",
    ar: "هذه إشارة فرز لا قرار. يتخذ شخص مؤهَّل قرار التوظيف؛ ولا تُقصي أي درجة هنا مرشحاً تلقائياً. اقرأها مع المقابلة والأدلة الأخرى.",
  };

  // ── AI-specific risk flags - each a SIGNAL TO PROBE, never an auto-reject. ──
  const riskFlags: RiskFlag[] = [];
  const senseCheck = factorScores.thinking_sense_check;
  const workingPractice = factorScores.results_working_practice;
  const adaptive = factorScores.self_adaptive_mindset;
  // Over-reliance: productive with AI but light on checking it. The GAP, not
  // either score alone, is the risk - the single most important finance/GCC flag.
  if (workingPractice >= 3.5 && senseCheck > 0 && senseCheck < 3) {
    riskFlags.push({
      id: "over_reliance",
      title: { en: "Possible over-reliance on AI output", ar: "احتمال الإفراط في الاعتماد على مخرجات الذكاء الاصطناعي" },
      detail: {
        en: `Productive with AI (Working Practice ${fmt(workingPractice)}) but lighter on checking it (Sense-Check ${fmt(senseCheck)}). Where AI output feeds a decision, document, or client deliverable, probe how they verify before they rely.`,
        ar: `منتج مع الذكاء الاصطناعي (ممارسة العمل ${fmt(workingPractice)}) لكنه أخف في تدقيقه (التحقّق ${fmt(senseCheck)}). حيث تغذّي مخرجات الذكاء الاصطناعي قراراً أو وثيقة أو مخرجاً للعميل، استقصِ كيف يتحقق قبل أن يعتمد.`,
      },
    });
  }
  // Over-claiming: self-ratings run ahead of demonstrated answers.
  if (
    args.selfAvg != null && args.objectiveAvg != null &&
    args.objectiveCount != null && args.objectiveCount >= 4 &&
    args.selfAvg - args.objectiveAvg >= 0.75
  ) {
    riskFlags.push({
      id: "over_claiming",
      title: { en: "Self-rating ahead of demonstrated answers", ar: "التقييم الذاتي يفوق الإجابات الموضوعية" },
      detail: {
        en: `Self-ratings (${fmt(args.selfAvg)}) sit above performance on the scenario and knowledge items (${fmt(args.objectiveAvg)}). Weight the objective score, and ask for concrete examples behind the higher self-claims.`,
        ar: `تعلو التقييمات الذاتية (${fmt(args.selfAvg)}) على الأداء في بنود السيناريو والمعرفة (${fmt(args.objectiveAvg)}). رجّح الدرجة الموضوعية، واطلب أمثلة ملموسة وراء الادعاءات الذاتية الأعلى.`,
      },
    });
  }
  // Responsible-use: a lighter Adaptive Mindset carries the policy / confidentiality posture.
  if (adaptive > 0 && adaptive < 3) {
    riskFlags.push({
      id: "responsible_use",
      title: { en: "Responsible-use posture worth probing", ar: "وضعية الاستخدام المسؤول جديرة بالاستقصاء" },
      detail: {
        en: `A lighter Adaptive Mindset (${fmt(adaptive)}) is where confidentiality, fairness, and policy awareness sit. Probe how they decide what data is safe to put into an AI tool - a real compliance consideration under UAE / Saudi PDPL.`,
        ar: `العقلية المتكيفة الأخف (${fmt(adaptive)}) هي موضع الوعي بالسرية والإنصاف والسياسة. استقصِ كيف يقرر أي البيانات آمنة لإدخالها في أداة ذكاء اصطناعي - اعتبار امتثال فعلي وفق أنظمة حماية البيانات في الإمارات والسعودية.`,
      },
    });
  }

  const freshness: AnalysisBlock = {
    en: "AI readiness moves quickly - both a person's skill and the bar for it. Treat this as a point-in-time screen and re-check if the requisition is more than ~3-6 months old.",
    ar: "تتغيّر الجاهزية للذكاء الاصطناعي بسرعة - مهارة الفرد والمعيار معاً. اعتبرها فرزاً لحظياً وأعد التحقق إذا مضى على الشاغر أكثر من 3-6 أشهر تقريباً.",
  };

  return {
    verdict, profileShape, calibration, strengths, developmentAreas,
    allAtTarget: belowIds.length === 0, basis, band, guardrail, riskFlags, freshness,
  };
}

// ════════════════════════════════════════════════════════════════
// DEVELOPMENT (growth) lens - a DIFFERENT report for a different reader.
// ════════════════════════════════════════════════════════════════
// Where acquisition produces a hiring verdict + risk flags + interview probes,
// development produces a growth plan: strengths-first, ipsative (you vs your own
// target, never a ranking), 2-3 sequenced priorities each with a concrete first
// action (70-20-10), a manager coaching guide, self-reflection, and a re-measure
// cadence. Strictly NO verdict / cut-score / hire language - per Feedback
// Intervention Theory, evaluative framing in a development context depresses
// learning. Same answers, opposite job.

/** Foundation-first ordering. Openness to relearning and checking AI output come
 *  before scaling productive use - they make every later gain safe and durable. */
const DEV_SEQUENCE: Record<AraIndividualFactorId, number> = {
  self_adaptive_mindset: 0,
  thinking_sense_check: 1,
  results_working_practice: 2,
  people_collaboration: 3,
};

/** Per-factor "why this now" + a concrete first action, tagged 70-20-10. */
const FACTOR_DEVELOPMENT: Record<AraIndividualFactorId, { whyNow: AnalysisBlock; action: AnalysisBlock }> = {
  thinking_sense_check: {
    whyNow: {
      en: "Sense-checking is your safety floor - you can't safely scale AI use you can't evaluate. Building this habit first makes every other gain trustworthy.",
      ar: "التحقّق هو خط أمانك - لا يمكنك التوسّع بأمان في استخدام ذكاء اصطناعي لا تستطيع تقييمه. بناء هذه العادة أولاً يجعل كل مكسب لاحق جديراً بالثقة.",
    },
    action: {
      en: "This week (70% on-the-job): take three AI outputs you'd normally use as-is and verify each against a trusted source before it leaves your hands - note what you'd have missed. Add one short module on evaluating AI output (10% formal), and ask a domain expert to sanity-check one of your reviews (20% social).",
      ar: "هذا الأسبوع (70% أثناء العمل): خذ ثلاثة مخرجات للذكاء الاصطناعي كنت ستستخدمها كما هي وتحقّق من كلٍّ منها في ضوء مصدر موثوق قبل تسليمها - دوّن ما كنت ستفوّته. أضِف وحدة قصيرة عن تقييم مخرجات الذكاء الاصطناعي (10% تدريب رسمي)، واطلب من خبير في المجال مراجعة أحد تحقّقاتك (20% تعلّم اجتماعي).",
    },
  },
  results_working_practice: {
    whyNow: {
      en: "This is where AI turns into time saved and better work. With your checking habit in place, building AI into recurring tasks is the highest-leverage productivity gain.",
      ar: "هنا يتحوّل الذكاء الاصطناعي إلى وقت موفَّر وعمل أفضل. ومع ترسّخ عادة التدقيق لديك، يصبح إدخال الذكاء الاصطناعي في المهام المتكررة أعلى مكسب إنتاجي رافعةً.",
    },
    action: {
      en: "This week (70%): pick one recurring task and build a reusable prompt for it; run it three times, refining each pass, and save the prompt where the team can find it. Add a short prompt-craft module (10%) and swap one working prompt with a colleague (20%).",
      ar: "هذا الأسبوع (70%): اختر مهمة متكررة وابْنِ لها تعليمة قابلة لإعادة الاستخدام؛ شغّلها ثلاث مرات محسّناً إياها في كل مرة، واحفظها حيث يجدها الفريق. أضِف وحدة قصيرة في صياغة التعليمات (10%) وتبادل تعليمة ناجحة مع زميل (20%).",
    },
  },
  people_collaboration: {
    whyNow: {
      en: "Your individual practice multiplies when you lift the team's. Sharing what works - and pushing back on misuse - turns personal skill into group capability.",
      ar: "تتضاعف ممارستك الفردية حين ترفع ممارسة الفريق. مشاركة ما ينجح - والاعتراض على سوء الاستخدام - تحوّل المهارة الفردية إلى قدرة جماعية.",
    },
    action: {
      en: "This month (70%): run one short, practical share-out - a prompt or pattern that worked for you - and agree one shared norm for what AI output your team will and won't trust. Add a facilitation / influence module (10%) and mentor one colleague through their first sound use (20%).",
      ar: "هذا الشهر (70%): نفّذ جلسة مشاركة قصيرة وعملية - تعليمة أو نمط نجح معك - واتفقوا على معيار مشترك لما تثق به مخرجات الذكاء الاصطناعي وما لا تثق به. أضِف وحدة في التيسير والتأثير (10%) ووجّه زميلاً في أول استخدام سليم له (20%).",
    },
  },
  self_adaptive_mindset: {
    whyNow: {
      en: "Openness to relearning - and a clear sense of where models can fail and what's safe to share - is the foundation everything else stands on. Without it, gains don't stick and risk creeps in.",
      ar: "الانفتاح على إعادة التعلّم - مع وعي واضح بأين تخفق النماذج وما الآمن مشاركته - هو الأساس الذي يقوم عليه كل ما عداه. وبدونه لا تثبت المكاسب ويتسلّل الخطر.",
    },
    action: {
      en: "This month (70%): deliberately relearn one familiar workflow with an AI tool, and before each use ask 'where could this be wrong, and is this data safe to share?'. Add a short responsible-AI / data-handling module (10%) and talk one tricky judgement call through with your manager (20%).",
      ar: "هذا الشهر (70%): أعد تعلّم سير عمل مألوف عمداً باستخدام أداة ذكاء اصطناعي، واسأل قبل كل استخدام: 'أين قد يكون هذا خاطئاً، وهل هذه البيانات آمنة للمشاركة؟'. أضِف وحدة قصيرة في الذكاء الاصطناعي المسؤول والتعامل مع البيانات (10%) وناقش قراراً صعباً واحداً مع مديرك (20%).",
    },
  },
};

export type DevelopmentPriority = {
  factorId: AraIndividualFactorId;
  score: number;
  /** TARGET - score, floored at 0. */
  gapToTarget: number;
  whyNow: AnalysisBlock;
  action: AnalysisBlock;
  /** AC behavioural competencies this factor builds (for the learning thread). */
  acCompetencies: string[];
};

export type DevelopmentAnalysis = {
  /** "This is a growth report, not a scorecard / not used for hiring or pay." */
  framing: AnalysisBlock;
  /** Strengths-first opener naming the top factor as a lever. */
  headline: AnalysisBlock;
  /** Factors at/above target (or the single highest), each with a read. */
  strengths: { factorId: AraIndividualFactorId; score: number; read: AnalysisBlock }[];
  /** 2-3 sequenced development priorities (foundation-first). */
  priorities: DevelopmentPriority[];
  /** True when no factor is below target - priorities then hold a single stretch. */
  allAtTarget: boolean;
  /** Constructive self-vs-objective read; null when too few objective items. */
  calibration: AnalysisBlock | null;
  /** Why the priorities are ordered the way they are. */
  sequencingNote: AnalysisBlock;
  /** Self-reflection + a SMART / implementation-intention scaffold. */
  reflection: AnalysisBlock;
  /** GROW-style stems for a manager development conversation. */
  managerPrompts: AnalysisBlock;
  /** Re-measure cadence. */
  cadence: AnalysisBlock;
};

export function buildDevelopmentAnalysis(args: {
  factorScores: Record<AraIndividualFactorId, number>;
  overallScore: number;
  selfAvg?: number;
  objectiveAvg?: number;
  objectiveCount?: number;
}): DevelopmentAnalysis | null {
  const { factorScores, overallScore } = args;
  if (!(overallScore > 0)) return null;

  const present = ARA_INDIVIDUAL_FACTOR_IDS.filter((id) => factorScores[id] > 0);
  if (present.length === 0) return null;

  const ranked = [...present].sort((a, b) => factorScores[b] - factorScores[a]);
  const topId = ranked[0];
  const top = ARA_INDIVIDUAL_FACTOR_MAP[topId];

  const framing: AnalysisBlock = {
    en: "This is a development snapshot, for you and your development partner. It is not a scorecard, not a ranking against colleagues, and not an input to any pay, promotion, or hiring decision - it's a mirror to help you choose where to grow next.",
    ar: "هذه لقطة تطويرية، لك ولشريك تطويرك. ليست بطاقة درجات، ولا ترتيباً مقارنةً بالزملاء، ولا مُدخلاً لأي قرار يتعلق بالراتب أو الترقية أو التوظيف - بل مرآة تساعدك على اختيار وجهة نموّك التالية.",
  };

  const headline: AnalysisBlock = {
    en: `Start from strength: ${top.name_en} is where you are most fluent today (${fmt(factorScores[topId])} / 5). Use it as a lever - the priorities below are where a little focus will move you furthest.`,
    ar: `ابدأ من القوة: ${top.name_ar} هو أكثر ما تتقنه اليوم (${fmt(factorScores[topId])} / 5). استخدمه رافعةً - والأولويات أدناه هي حيث سيُحدث القليل من التركيز أكبر تقدّم.`,
  };

  const strongIds = ranked.filter((id) => factorScores[id] >= TARGET);
  const strengths = (strongIds.length > 0 ? strongIds : [topId]).map((id) => ({
    factorId: id,
    score: factorScores[id],
    read: FACTOR_DESCRIPTIVE[id][getIndividualMaturityStage(factorScores[id]).id],
  }));

  const belowIds = present
    .filter((id) => factorScores[id] < TARGET)
    .sort((a, b) => DEV_SEQUENCE[a] - DEV_SEQUENCE[b]);
  const allAtTarget = belowIds.length === 0;
  const priorityIds = (allAtTarget ? [ranked[ranked.length - 1]] : belowIds).slice(0, 3);
  const priorities: DevelopmentPriority[] = priorityIds.map((id) => ({
    factorId: id,
    score: factorScores[id],
    gapToTarget: Math.max(0, TARGET - factorScores[id]),
    whyNow: FACTOR_DEVELOPMENT[id].whyNow,
    action: FACTOR_DEVELOPMENT[id].action,
    acCompetencies: ARA_INDIVIDUAL_FACTOR_MAP[id].ac_competency_names,
  }));

  let calibration: AnalysisBlock | null = null;
  if (
    args.selfAvg != null && args.objectiveAvg != null &&
    args.objectiveCount != null && args.objectiveCount >= 4 &&
    args.selfAvg > 0 && args.objectiveAvg > 0
  ) {
    const d = args.selfAvg - args.objectiveAvg;
    calibration =
      d >= 0.75
        ? {
            en: "You rate yourself a little ahead of how the scenario and knowledge items came out - very common. The quickest win is to make your checking habit visible and consistent, so your confidence and your evidence move together.",
            ar: "تقيّم نفسك أعلى قليلاً مما أظهرته بنود السيناريو والمعرفة - وهذا شائع جداً. أسرع مكسب هو جعل عادة التدقيق لديك ظاهرة ومتسقة، حتى تتحرك ثقتك وأدلتك معاً.",
          }
        : d <= -0.75
        ? {
            en: "Your scenario and knowledge answers came out stronger than your own self-rating - you may be underselling yourself. Back your judgement a little more, especially when helping others.",
            ar: "جاءت إجاباتك في السيناريو والمعرفة أقوى من تقييمك الذاتي - وقد تبخس نفسك حقها. ثِق بحُكمك أكثر قليلاً، خصوصاً حين تساعد الآخرين.",
          }
        : {
            en: "Your self-view and your demonstrated answers line up well - a calibrated, honest read of where you are.",
            ar: "يتوافق تصوّرك الذاتي مع إجاباتك المُثبتة بشكل جيد - قراءة معايَرة وصادقة لموقعك.",
          };
  }

  const sequencingNote: AnalysisBlock = {
    en: "These priorities are ordered foundation-first: openness to relearning and the habit of checking AI output come before scaling productive use, because they make every later gain safe and durable.",
    ar: "رُتّبت هذه الأولويات بالأساس أولاً: الانفتاح على إعادة التعلّم وعادة تدقيق مخرجات الذكاء الاصطناعي يسبقان التوسّع في الاستخدام المنتج، لأنهما يجعلان كل مكسب لاحق آمناً وراسخاً.",
  };

  const reflection: AnalysisBlock = {
    en: "Before you move on: which one of these resonates - or surprises you? Pick a single priority and write a specific commitment as 'When [situation] happens, I will [action]'. Name one person you'll check in with, and a date to review.",
    ar: "قبل أن تمضي: أيٌّ من هذه يلامسك - أو يفاجئك؟ اختر أولوية واحدة واكتب التزاماً محدداً بصيغة 'عندما يحدث [موقف]، سأفعل [إجراء]'. سمِّ شخصاً واحداً ستراجعه معه، وحدّد تاريخاً للمتابعة.",
  };

  const managerPrompts: AnalysisBlock = {
    en: "For a development conversation (manager + you), use GROW. Goal: what does 'good' look like on your top priority in your role? Reality: where are you now, with a recent example? Options: what is one experiment to try this month? Will: what will you commit to, and when will we review it?",
    ar: "لمحادثة تطويرية (المدير وأنت)، استخدم نموذج GROW. الهدف: كيف يبدو 'الجيد' في أولويتك الأولى ضمن دورك؟ الواقع: أين أنت الآن، مع مثال حديث؟ الخيارات: ما تجربة واحدة تخوضها هذا الشهر؟ الإرادة: بماذا ستلتزم، ومتى نراجعه؟",
  };

  const cadence: AnalysisBlock = {
    en: "AI readiness moves fast - both your skill and the bar for it. Re-take this snapshot in about 3 months to see movement on your priorities, and do a fuller re-assessment in 6-12 months. A flat score against a rising field can still mean real growth.",
    ar: "تتحرّك الجاهزية للذكاء الاصطناعي بسرعة - مهارتك والمعيار معاً. أعد هذه اللقطة بعد نحو 3 أشهر لترى تقدّمك في أولوياتك، وأجرِ تقييماً أشمل بعد 6-12 شهراً. وثبات الدرجة في مجال يرتفع قد يعني نمواً حقيقياً.",
  };

  return {
    framing, headline, strengths, priorities, allAtTarget,
    calibration, sequencingNote, reflection, managerPrompts, cadence,
  };
}
