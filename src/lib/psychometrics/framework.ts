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
  competencies: string[];
};
export const COGNITIVE_SUBTESTS: CognitiveSubtest[] = [
  {
    key: "numerical",
    name_en: "Numerical reasoning",
    name_ar: "الاستدلال العددي",
    desc_en: "Interpreting data, ratios, percentages and trends.",
    competencies: ["Financial Acumen", "Analytical Reasoning", "Decision Quality"],
  },
  {
    key: "verbal",
    name_en: "Verbal reasoning",
    name_ar: "الاستدلال اللفظي",
    desc_en: "Comprehension and critical reasoning from text.",
    competencies: ["Communicates Effectively", "Analytical Reasoning"],
  },
  {
    key: "abstract",
    name_en: "Abstract reasoning",
    name_ar: "الاستدلال المجرد",
    desc_en: "Pattern recognition independent of language (culture-fair).",
    competencies: ["Manages Complexity", "Cultivates Innovation"],
  },
];

/** General mental ability (g) — the composite — predicts broadly. */
export const COGNITIVE_G_COMPETENCIES = ["Analytical Reasoning", "Decision Quality", "Manages Complexity"];

// ── Big-Five (OCEAN) personality ─────────────────────────────────
export type BigFiveTrait = {
  key: "O" | "C" | "E" | "A" | "S";
  name_en: string;
  name_ar: string;
  desc_en: string;
  competencies: string[];
};
export const BIG_FIVE: BigFiveTrait[] = [
  { key: "O", name_en: "Openness", name_ar: "الانفتاح على التجارب", desc_en: "Curiosity, imagination, openness to new ideas.", competencies: ["Cultivates Innovation", "Nimble Learning", "Manages Complexity"] },
  { key: "C", name_en: "Conscientiousness", name_ar: "يقظة الضمير", desc_en: "Organisation, diligence, follow-through.", competencies: ["Drives Results", "Plans and Aligns", "Action Oriented"] },
  { key: "E", name_en: "Extraversion", name_ar: "الانبساط", desc_en: "Sociability, assertiveness, energy.", competencies: ["Communicates Effectively", "Persuades", "Builds Networks"] },
  { key: "A", name_en: "Agreeableness", name_ar: "المقبولية", desc_en: "Empathy, cooperation, trust.", competencies: ["Collaboration", "Develops Talent", "Emotional Intelligence"] },
  { key: "S", name_en: "Emotional Stability", name_ar: "الاتزان الانفعالي", desc_en: "Calm and resilience under pressure (low neuroticism).", competencies: ["Being Resilient", "Manages Ambiguity", "Self-Awareness"] },
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
