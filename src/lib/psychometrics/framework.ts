// VIFM Psychometrics — the Foundations layer (cognitive ability + Big-Five
// personality). Code-side framework + the public-domain Mini-IPIP item set, so
// the Tier-1 indicative runner works without seeded DB items or an AI key.
//
// Each scale declares the behavioural competencies it PREDICTS (layered model);
// P8 seeds these as `predicts`/`foundations` rows in construct_competency_links
// (resolved by competency name; non-matches are skipped). Tier 1 is INDICATIVE —
// no local norms, no IRT calibration, no credential.

export type PsyKind = "cognitive" | "personality";

// ── Cognitive ability subtests ───────────────────────────────────
export type CognitiveSubtest = {
  key: string;
  name_en: string;
  name_ar: string;
  desc_en: string;
  /** Fuller, scientifically-grounded definition surfaced on the result + report. */
  definition_en: string;
  definition_ar: string;
  competencies: string[];
};
export const COGNITIVE_SUBTESTS: CognitiveSubtest[] = [
  {
    key: "numerical",
    name_en: "Numerical reasoning",
    name_ar: "الاستدلال العددي",
    desc_en: "Interpreting data, ratios, percentages and trends.",
    definition_en:
      "Working with numbers and quantitative information: number series, ratios and percentages, and interpreting data presented in tables and charts to draw correct conclusions.",
    definition_ar:
      "التعامل مع الأرقام والمعلومات الكمية: المتسلسلات العددية والنسب والمئويات، وتفسير البيانات في الجداول والرسوم لاستخلاص النتائج الصحيحة.",
    competencies: ["Financial Literacy & Acumen", "Critical Analysis", "Sound Judgement"],
  },
  {
    key: "verbal",
    name_en: "Verbal reasoning",
    name_ar: "الاستدلال اللفظي",
    desc_en: "Comprehension and critical reasoning from text.",
    definition_en:
      "Understanding and reasoning with language: comprehension of written passages, verbal analogies, and evaluating arguments to judge what does or does not follow.",
    definition_ar:
      "الفهم والاستدلال باللغة: استيعاب النصوص المكتوبة، والتناظر اللفظي، وتقييم الحجج لتمييز ما يصح استنتاجه.",
    competencies: ["Clear & Adaptive Communication", "Critical Analysis"],
  },
  {
    key: "inductive",
    name_en: "Inductive reasoning",
    name_ar: "الاستدلال الاستقرائي",
    desc_en: "Inferring the underlying rule from patterns and examples.",
    definition_en:
      "Inferring the general rule from specific cases - spotting the pattern in figural series, matrices and odd-one-out problems, then predicting what comes next. A core marker of fluid intelligence.",
    definition_ar:
      "استنتاج القاعدة العامة من حالات محددة - تمييز النمط في المتسلسلات الشكلية والمصفوفات ومسائل (الشاذ)، ثم توقّع ما يلي. مؤشر أساسي للذكاء السيّال.",
    competencies: ["Navigating Complexity", "Creative Problem-Solving"],
  },
  {
    key: "deductive",
    name_en: "Deductive reasoning",
    name_ar: "الاستدلال الاستنباطي",
    desc_en: "Applying given rules and premises to reach a valid conclusion.",
    definition_en:
      "Applying given rules or premises to reach a logically valid conclusion - syllogisms, conditional (if-then) logic, and arrangement/ordering problems where the answer must follow necessarily from the information given.",
    definition_ar:
      "تطبيق قواعد أو مقدمات معطاة للوصول إلى نتيجة صحيحة منطقيًا - القياس المنطقي، والمنطق الشرطي (إذا-فإن)، ومسائل الترتيب حيث تلزم النتيجة من المعطيات.",
    competencies: ["Critical Analysis", "Sound Judgement"],
  },
];

/** The four cognitive subtest keys, in canonical order. */
export const COGNITIVE_SUBTEST_KEYS = COGNITIVE_SUBTESTS.map((s) => s.key);

/**
 * Validate a requested subtest selection: keep only known keys, dedupe, and
 * preserve canonical order. An empty / missing / all-invalid selection defaults
 * to all four (back-compat). Single source of truth shared by the runner UI and
 * the generation API so a client can never request an unknown or empty set.
 */
export function sanitizeSubtests(keys: unknown): string[] {
  const valid = new Set(COGNITIVE_SUBTEST_KEYS);
  const requested = Array.isArray(keys) ? keys : [];
  const picked = COGNITIVE_SUBTEST_KEYS.filter((k) =>
    requested.some((r) => typeof r === "string" && r === k)
  );
  return picked.length > 0 ? picked : [...COGNITIVE_SUBTEST_KEYS];
}

/** Score-band narrative per subtest (indicative; non-clinical). */
export function cognitiveNarrative(scorePct: number, ar: boolean): string {
  if (scorePct >= 75) {
    return ar
      ? "أداء قوي: يتعامل بثقة مع البنود الأصعب ويصل إلى الإجابة الصحيحة باطّراد."
      : "Strong performance: handles the harder items confidently and reaches the correct answer consistently.";
  }
  if (scorePct >= 45) {
    return ar
      ? "أداء متوسط: أساس سليم في البنود المعتادة، مع فرص للتحسّن في الأصعب."
      : "Mid-range performance: a sound grasp of standard items, with room to grow on the harder ones.";
  }
  return ar
    ? "أداء يحتاج تطويرًا: ركّز على التدرّب على هذا النوع من الاستدلال لبناء الأساس."
    : "Developing performance: targeted practice on this reasoning type will build the foundation.";
}

/** General mental ability (g) — the composite — predicts broadly. */
export const COGNITIVE_G_COMPETENCIES = ["Critical Analysis", "Sound Judgement", "Navigating Complexity"];

// ── Big-Five (OCEAN) personality ─────────────────────────────────
export type BigFiveTrait = {
  key: "O" | "C" | "E" | "A" | "S";
  name_en: string;
  name_ar: string;
  desc_en: string;
  competencies: string[];
};
export const BIG_FIVE: BigFiveTrait[] = [
  { key: "O", name_en: "Openness", name_ar: "الانفتاح على التجارب", desc_en: "Curiosity, imagination, openness to new ideas.", competencies: ["Creative Problem-Solving", "Learning by Doing", "Navigating Complexity"] },
  { key: "C", name_en: "Conscientiousness", name_ar: "يقظة الضمير", desc_en: "Organisation, diligence, follow-through.", competencies: ["Outcome Ownership", "Planning & Prioritisation", "Proactive Initiative"] },
  { key: "E", name_en: "Extraversion", name_ar: "الانبساط", desc_en: "Sociability, assertiveness, energy.", competencies: ["Clear & Adaptive Communication", "Persuasion & Buy-in", "Relationship Networks"] },
  { key: "A", name_en: "Agreeableness", name_ar: "المقبولية", desc_en: "Empathy, cooperation, trust.", competencies: ["Cross-Functional Collaboration", "Coaching & Talent Growth", "Emotional Regulation & Empathy"] },
  { key: "S", name_en: "Emotional Stability", name_ar: "الاتزان الانفعالي", desc_en: "Calm and resilience under pressure (low neuroticism).", competencies: ["Resilience Under Pressure", "Operating Through Uncertainty", "Self-Insight"] },
];

// ── Mini-IPIP (Donnellan, Oswald, Baird & Lucas, 2006) — public domain ──
// 20 items, 4 per factor. High score = more of the trait; for S (Emotional
// Stability) high = calmer / more stable. `reverse` flips the item for its scale.
export type IpipItem = { scale: BigFiveTrait["key"]; text_en: string; text_ar: string; reverse: boolean };
export const MINI_IPIP: IpipItem[] = [
  { scale: "E", text_en: "I am the life of the party.", text_ar: "أنا محور الحياة في الحفلات.", reverse: false },
  { scale: "A", text_en: "I sympathize with others' feelings.", text_ar: "أتعاطف مع مشاعر الآخرين.", reverse: false },
  { scale: "C", text_en: "I get chores done right away.", text_ar: "أُنجز المهام فورًا.", reverse: false },
  { scale: "S", text_en: "I have frequent mood swings.", text_ar: "تتقلّب حالتي المزاجية كثيرًا.", reverse: true },
  { scale: "O", text_en: "I have a vivid imagination.", text_ar: "لديّ خيال واسع.", reverse: false },
  { scale: "E", text_en: "I don't talk a lot.", text_ar: "لا أتحدّث كثيرًا.", reverse: true },
  { scale: "A", text_en: "I am not interested in other people's problems.", text_ar: "لا تعنيني مشكلات الآخرين.", reverse: true },
  { scale: "C", text_en: "I often forget to put things back in their proper place.", text_ar: "كثيرًا ما أنسى إعادة الأشياء إلى أماكنها.", reverse: true },
  { scale: "S", text_en: "I am relaxed most of the time.", text_ar: "أكون مسترخيًا معظم الوقت.", reverse: false },
  { scale: "O", text_en: "I am not interested in abstract ideas.", text_ar: "لا تعنيني الأفكار المجرّدة.", reverse: true },
  { scale: "E", text_en: "I talk to a lot of different people at parties.", text_ar: "أتحدّث مع كثير من الناس في المناسبات.", reverse: false },
  { scale: "A", text_en: "I feel others' emotions.", text_ar: "أشعر بمشاعر الآخرين.", reverse: false },
  { scale: "C", text_en: "I like order.", text_ar: "أحبّ النظام.", reverse: false },
  { scale: "S", text_en: "I get upset easily.", text_ar: "أنزعج بسهولة.", reverse: true },
  { scale: "O", text_en: "I have difficulty understanding abstract ideas.", text_ar: "أجد صعوبة في فهم الأفكار المجرّدة.", reverse: true },
  { scale: "E", text_en: "I keep in the background.", text_ar: "أُفضّل البقاء في الخلفية.", reverse: true },
  { scale: "A", text_en: "I am not really interested in others.", text_ar: "لا أهتمّ كثيرًا بالآخرين.", reverse: true },
  { scale: "C", text_en: "I make a mess of things.", text_ar: "أتسبّب في الفوضى.", reverse: true },
  { scale: "S", text_en: "I seldom feel blue.", text_ar: "نادرًا ما أشعر بالحزن.", reverse: false },
  { scale: "O", text_en: "I do not have a good imagination.", text_ar: "ليس لديّ خيال جيّد.", reverse: true },
];

export const LIKERT_ANCHORS_EN = ["Strongly disagree", "Disagree", "Neutral", "Agree", "Strongly agree"];
export const LIKERT_ANCHORS_AR = ["أعارض بشدة", "أعارض", "محايد", "أوافق", "أوافق بشدة"];

// ── Bands (Tier 1 INDICATIVE — based on raw scores, not local norms) ──
export type PsyBand = "low" | "below" | "average" | "above" | "high";

/** Cognitive: % correct → indicative band. */
export function cognitiveBand(pct: number): PsyBand {
  if (pct < 40) return "low";
  if (pct < 60) return "below";
  if (pct < 75) return "average";
  if (pct < 90) return "above";
  return "high";
}

/** Personality: 1–5 trait mean → indicative band (midpoint = 3). */
export function traitBand(mean: number): PsyBand {
  if (mean < 2.0) return "low";
  if (mean < 2.75) return "below";
  if (mean < 3.5) return "average";
  if (mean < 4.25) return "above";
  return "high";
}

/** A sten-like 1–10 from a 1–5 mean (indicative; not norm-referenced). */
export function stenFromMean(mean: number): number {
  return Math.max(1, Math.min(10, Math.round(((mean - 1) / 4) * 9 + 1)));
}

export const BAND_LABEL_EN: Record<PsyBand, string> = {
  low: "Low", below: "Below average", average: "Average", above: "Above average", high: "High",
};
export const BAND_LABEL_AR: Record<PsyBand, string> = {
  low: "منخفض", below: "دون المتوسط", average: "متوسط", above: "فوق المتوسط", high: "مرتفع",
};

export const COGNITIVE_INSTRUMENT = { code: "cog_v1", name_en: "Cognitive Ability (indicative)", name_ar: "القدرة الذهنية (استرشادي)" };
export const PERSONALITY_INSTRUMENT = { code: "big5_ipip_v1", name_en: "Big Five Personality (Mini-IPIP)", name_ar: "الشخصية بالعوامل الخمسة (Mini-IPIP)" };
