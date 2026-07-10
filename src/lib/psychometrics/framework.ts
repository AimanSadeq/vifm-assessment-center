// VIFM Psychometrics - the Foundations layer (cognitive ability + Big-Five
// personality). Code-side framework + the public-domain Mini-IPIP item set, so
// the Tier-1 indicative runner works without seeded DB items or an AI key.
//
// Each scale declares the behavioural competencies it PREDICTS (layered model);
// P8 seeds these as `predicts`/`foundations` rows in construct_competency_links
// (resolved by competency name; non-matches are skipped). Tier 1 is INDICATIVE -
// no local norms, no IRT calibration, no credential.

export type PsyKind = "cognitive";

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
      "Working with numbers and quantitative information: ratios and proportion, percentages and percentage-change, and interpreting data presented in tables and charts to draw correct conclusions. (Number/letter series belong to inductive reasoning, not here.)",
    definition_ar:
      "التعامل مع الأرقام والمعلومات الكمية: النسب والتناسب، والنسب المئوية والتغيّر، وتفسير البيانات في الجداول والرسوم لاستخلاص النتائج الصحيحة. (المتسلسلات العددية والحرفية تندرج ضمن الاستدلال الاستقرائي لا هنا.)",
    competencies: ["Critical Analysis", "Sound Judgement"],
  },
  {
    key: "verbal",
    name_en: "Verbal reasoning",
    name_ar: "الاستدلال اللفظي",
    desc_en: "Comprehension and reasoning with language.",
    definition_en:
      "Understanding and reasoning with language: comprehension of written passages, verbal analogies, and vocabulary-in-context. This is language reasoning only - formal logical validity (syllogisms, if-then, what necessarily follows) is measured under deductive reasoning, never here.",
    definition_ar:
      "الفهم والاستدلال باللغة: استيعاب النصوص المكتوبة، والتناظر اللفظي، والمفردات في السياق. هذا استدلال لغوي فقط - أما الصحّة المنطقية الصورية (القياس، والشرطية، وما يلزم بالضرورة) فتُقاس ضمن الاستدلال الاستنباطي لا هنا.",
    competencies: ["Clear & Adaptive Communication"],
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

// ── Cognitive item-bank blueprint (VIFM Cognitive Item-Bank Standard v1) ──
// Each subtest is composed of 3 fixed FACETS, so a served sitting always measures
// the same construct mix (closing the "one sitting felt like vocabulary, the next
// like inference" drift). The bank is filled to `authorPerFacet` depth so the
// least-administered-first draw gives ~3-form exposure rotation; each sitting
// serves `servedPerFacetByDifficulty` from every facet -> a fixed 9/subtest form.
export type CognitiveDifficulty = "easy" | "medium" | "hard";
export type CognitiveFacet = { key: string; subtest: string; name_en: string; name_ar: string };

export const COGNITIVE_FACETS: CognitiveFacet[] = [
  // numerical - computation only (a number/letter SERIES is inductive, not here)
  { key: "num_ratio", subtest: "numerical", name_en: "Ratio & proportion", name_ar: "النسبة والتناسب" },
  { key: "num_percent", subtest: "numerical", name_en: "Percentage & change", name_ar: "النسبة المئوية والتغيّر" },
  { key: "num_data", subtest: "numerical", name_en: "Data interpretation", name_ar: "تفسير البيانات" },
  // verbal - LANGUAGE only (no formal logic - that is deductive)
  { key: "verb_analogy", subtest: "verbal", name_en: "Verbal analogies", name_ar: "التناظر اللفظي" },
  { key: "verb_comprehension", subtest: "verbal", name_en: "Reading comprehension", name_ar: "الاستيعاب القرائي" },
  { key: "verb_vocab", subtest: "verbal", name_en: "Vocabulary in context", name_ar: "المفردات في السياق" },
  // inductive - the rule is DISCOVERED from examples
  { key: "ind_series", subtest: "inductive", name_en: "Number & letter series", name_ar: "المتسلسلات العددية والحرفية" },
  { key: "ind_oddoneout", subtest: "inductive", name_en: "Odd one out", name_ar: "الشاذ عن النمط" },
  { key: "ind_matrix", subtest: "inductive", name_en: "Figural matrices", name_ar: "المصفوفات الشكلية" },
  // deductive - apply GIVEN premises; the conclusion must follow necessarily
  { key: "ded_syllogism", subtest: "deductive", name_en: "Syllogisms", name_ar: "القياس المنطقي" },
  { key: "ded_conditional", subtest: "deductive", name_en: "Conditional logic", name_ar: "المنطق الشرطي" },
  { key: "ded_arrangement", subtest: "deductive", name_en: "Arrangements", name_ar: "الترتيب المنطقي" },
];

export const COGNITIVE_FACET_KEYS = new Set(COGNITIVE_FACETS.map((f) => f.key));

/** The 3 facet keys for a subtest, in canonical order. */
export function facetKeysForSubtest(subtest: string): string[] {
  return COGNITIVE_FACETS.filter((f) => f.subtest === subtest).map((f) => f.key);
}
/** The subtest a facet belongs to (null for an unknown facet). */
export function subtestForFacet(facet: string): string | null {
  return COGNITIVE_FACETS.find((f) => f.key === facet)?.subtest ?? null;
}
export function cognitiveFacetMeta(facet: string): CognitiveFacet | null {
  return COGNITIVE_FACETS.find((f) => f.key === facet) ?? null;
}

export const COGNITIVE_BLUEPRINT = {
  /** Items drawn per facet per difficulty for one served sitting (fixed form). */
  servedPerFacetByDifficulty: { easy: 1, medium: 1, hard: 1 } as Record<CognitiveDifficulty, number>,
  /** 3 facets x 3 difficulties = a fixed 9-item subtest (balanced 3E/3M/3H). */
  servedPerFacet: 3,
  servedPerSubtest: 9,
  /** Bank-depth target per facet (3-form rotation): 3 easy / 4 medium / 3 hard. */
  authorPerFacet: 10,
  authorPerFacetByDifficulty: { easy: 3, medium: 4, hard: 3 } as Record<CognitiveDifficulty, number>,
} as const;

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

/** General mental ability (g) - the composite - predicts broadly. */
export const COGNITIVE_G_COMPETENCIES = ["Critical Analysis", "Sound Judgement", "Navigating Complexity"];

// ── Bands (Tier 1 INDICATIVE - based on raw scores, not local norms) ──
export type PsyBand = "low" | "below" | "average" | "above" | "high";

/** Cognitive: % correct → indicative band. */
export function cognitiveBand(pct: number): PsyBand {
  if (pct < 40) return "low";
  if (pct < 60) return "below";
  if (pct < 75) return "average";
  if (pct < 90) return "above";
  return "high";
}

export const BAND_LABEL_EN: Record<PsyBand, string> = {
  low: "Low", below: "Below average", average: "Average", above: "Above average", high: "High",
};
export const BAND_LABEL_AR: Record<PsyBand, string> = {
  low: "منخفض", below: "دون المتوسط", average: "متوسط", above: "فوق المتوسط", high: "مرتفع",
};

export const COGNITIVE_INSTRUMENT = { code: "cog_v1", name_en: "Logica (indicative)", name_ar: "لوجيكا (استرشادي)" };
