/**
 * Technical Competency Assessment engine.
 *
 * Generates an INDICATIVE per-domain technical assessment (MCQ), grounded in the
 * domain's skills from the Technical Competency Framework. Mirrors the Fluent
 * engine's integrity model:
 *   • generateTechnicalAssessment() authors items WITH an answer key (held
 *     server-side; never sent to the browser — see stripAnswerKey()).
 *   • scoreTechnicalAssessment() grades server-side and maps the score to a
 *     1–5 proficiency band + per-skill breakdown.
 *
 * Positioning (honest by design): this is an INDICATIVE proficiency signal, not
 * a certified qualification. AI-authored items should be human-reviewed /
 * calibrated before any high-stakes use. Falls back to a small generic set when
 * ANTHROPIC_API_KEY is absent so the flow still renders end-to-end.
 */

import { getAIClient, AI_MODEL } from "./client";
import {
  techDomainByKey,
  proficiencyFromPercent,
  type TechDomainKey,
  type TechProficiency,
} from "@/lib/competencies/technical-framework";
import { technicalConfidenceBand, type TechBand } from "@/lib/scoring/tech-reliability";

/** Item format. `single` = one correct option (classic MCQ); `multi` = select-
 *  all-that-apply (2+ correct, all-or-nothing); `scenario` = a case stem + a
 *  single-best-answer MCQ grounded in it. */
export type TechItemType = "single" | "multi" | "scenario";
/** Bloom cognitive demand the item targets. */
export type CognitiveLevel = "recall" | "apply" | "analyze";

export type TechItem = {
  id: string;
  skill: string; // one of the domain's / function's skills
  type: TechItemType;
  /** Case context for a `scenario` item (shown above the question). */
  scenario?: string;
  question: string;
  options: string[]; // 4 for single/scenario; 4–6 for multi
  /** The correct option for single/scenario (the first correct one for multi). */
  correct_index: number;
  /** All correct options for a `multi` item. */
  correct_indices?: number[];
  cognitive?: CognitiveLevel;
  difficulty: "easy" | "medium" | "hard";
};

export type TechTest = {
  domain_key: string; // a TechDomainKey for a domain run, or a function key for a function run
  domain_name: string;
  items: TechItem[];
  ai_generated: boolean;
  /** True when assembled entirely from SME-approved bank items (Tier 2) — the
   *  only path eligible to issue a technical_proficiency credential. */
  certified?: boolean;
};

// Answer-key-stripped shape for the browser (both correct_index AND
// correct_indices are removed; type/scenario/cognitive are kept for rendering).
export type PublicTechItem = Omit<TechItem, "correct_index" | "correct_indices">;
export type PublicTechTest = {
  domain_key: string; // a TechDomainKey for a domain run, or a function key for a function run
  domain_name: string;
  items: PublicTechItem[];
  ai_generated: boolean;
  certified?: boolean;
};

export function stripAnswerKey(test: TechTest): PublicTechTest {
  return {
    domain_key: test.domain_key,
    domain_name: test.domain_name,
    ai_generated: test.ai_generated,
    certified: test.certified ?? false,
    items: test.items.map(({ id, skill, type, scenario, question, options, cognitive, difficulty }) => ({
      id,
      skill,
      type,
      ...(scenario ? { scenario } : {}),
      question,
      options,
      ...(cognitive ? { cognitive } : {}),
      difficulty,
    })),
  };
}

export type TechSkillBreakdown = { skill: string; correct: number; total: number };
export type TechResult = {
  domain_key: string; // a TechDomainKey for a domain run, or a function key for a function run
  domain_name: string;
  correct: number;
  total: number;
  pct: number;
  proficiency: TechProficiency; // level 1–5 + label + normalized
  band: TechBand; // indicative confidence range around the level
  perSkill: TechSkillBreakdown[];
  ai_generated: boolean;
  certified: boolean; // assembled from SME-approved items (credential-eligible)
};

const ITEM_COUNT = 8;

function fallbackTest(domainKey: TechDomainKey, language: "en" | "ar" = "en"): TechTest {
  const domain = techDomainByKey(domainKey);
  const name = domain?.name ?? domainKey;
  const skill = domain?.skills[0] ?? "Fundamentals";
  // Domain-neutral placeholder so the flow renders without an API key. Clearly
  // not AI-generated; never presented as a real measure.
  return {
    domain_key: domainKey,
    domain_name: name,
    ai_generated: false,
    items: [
      {
        id: "f1",
        skill,
        type: "single",
        question:
          language === "ar"
            ? `بند نموذجي لمجال ${name}. اربط ANTHROPIC_API_KEY للحصول على تقييم حقيقي خاص بالمجال. أي خيار هو الصحيح هنا؟`
            : `Placeholder item for ${name}. Wire ANTHROPIC_API_KEY for a real, domain-specific assessment. Which option is marked correct here?`,
        options:
          language === "ar"
            ? ["الخيار أ (صحيح)", "الخيار ب", "الخيار ج", "الخيار د"]
            : ["Option A (correct)", "Option B", "Option C", "Option D"],
        correct_index: 0,
        difficulty: "easy",
      },
    ],
  };
}

const cleanMcq = (r: { options?: string[]; correct_index?: number }): boolean =>
  Array.isArray(r.options) &&
  r.options.length === 4 &&
  typeof r.correct_index === "number" &&
  r.correct_index >= 0 &&
  r.correct_index < 4;

// Shared item-writer persona for both the domain and function generators.
const ITEM_WRITER_SYSTEM =
  `You are a subject-matter assessment item writer for VIFM, a GCC finance & ` +
  `management training institute. You write fair, unambiguous multiple-choice ` +
  `items that test genuine technical competence in a professional finance domain, ` +
  `each with exactly one defensible correct answer and three plausible distractors. ` +
  `You calibrate a difficulty ramp and never write trick questions.`;

// The Arabic-language preamble lines (empty in English). Keeps the EXACT English
// skill name as the tag axis even when question/options are written in Arabic.
const arabicLangLines = (language: "en" | "ar"): string[] =>
  language === "ar"
    ? [
        `LANGUAGE: Write every "question" and all four "options" in clear Modern Standard`,
        `Arabic suitable for GCC finance professionals. Keep standard finance acronyms`,
        `(IFRS, WACC, CAPM, DCF, EBITDA, REIT) and numeric/currency values as commonly`,
        `written. Keep each "skill" value as the EXACT English skill name listed below.`,
        ``,
      ]
    : [];

/** Fisher–Yates shuffle of the 4 options → new option order + the index the
 *  correct answer moved to. LLMs bias the correct answer toward option A;
 *  re-randomising per administration defeats "always pick A" + position memo —
 *  a defensibility/integrity must-fix. */
function shuffleMcq(origOptions: string[], origCorrect: number): { options: string[]; correct_index: number } {
  const order = [0, 1, 2, 3];
  for (let j = order.length - 1; j > 0; j--) {
    const k = Math.floor(Math.random() * (j + 1));
    [order[j], order[k]] = [order[k], order[j]];
  }
  return {
    options: order.map((idx) => origOptions[idx]),
    correct_index: order.indexOf(origCorrect),
  };
}

/** Generalized Fisher–Yates over N options carrying a SET of correct positions
 *  (handles multi-select). Returns the shuffled options + the correct positions
 *  in the new order. Same integrity purpose as shuffleMcq. */
function shuffleChoices(options: string[], correct: number[]): { options: string[]; correct: number[] } {
  const order = options.map((_, i) => i);
  for (let j = order.length - 1; j > 0; j--) {
    const k = Math.floor(Math.random() * (j + 1));
    [order[j], order[k]] = [order[k], order[j]];
  }
  const correctSet = new Set(correct);
  const newOptions = order.map((idx) => options[idx]);
  const newCorrect: number[] = [];
  order.forEach((origIdx, p) => {
    if (correctSet.has(origIdx)) newCorrect.push(p);
  });
  return { options: newOptions, correct: newCorrect.sort((a, b) => a - b) };
}

const asCognitive = (v: unknown): CognitiveLevel | undefined =>
  v === "recall" || v === "apply" || v === "analyze" ? v : undefined;
const asDifficulty = (v: unknown): "easy" | "medium" | "hard" =>
  v === "hard" ? "hard" : v === "medium" ? "medium" : "easy";

type RawRichItem = {
  id?: string;
  skill?: string;
  type?: string;
  scenario?: string;
  question?: string;
  options?: unknown;
  correct_index?: unknown;
  correct_indices?: unknown;
  cognitive?: string;
  difficulty?: string;
};

/**
 * Validate + normalize one raw model item into a typed TechItem (single / multi
 * / scenario), shuffling option positions. Returns null for malformed items so
 * the caller can drop them. `multi` needs ≥2 correct + ≥1 distractor; single /
 * scenario need exactly 4 options + one valid correct index; a `scenario` with
 * no case text degrades to `single`.
 */
function normalizeRichItem(raw: RawRichItem, i: number, skills: string[], skillSet: Set<string>): TechItem | null {
  if (typeof raw.question !== "string" || !raw.question.trim()) return null;
  const opts = Array.isArray(raw.options) ? (raw.options as unknown[]).map(String) : [];
  if (opts.length < 4 || opts.length > 6) return null;

  const declared: TechItemType = raw.type === "multi" ? "multi" : raw.type === "scenario" ? "scenario" : "single";
  const skill = typeof raw.skill === "string" && skillSet.has(raw.skill) ? raw.skill : skills[i % skills.length];
  const base = {
    id: raw.id || `t${i + 1}`,
    skill,
    question: String(raw.question),
    cognitive: asCognitive(raw.cognitive),
    difficulty: asDifficulty(raw.difficulty),
  };

  if (declared === "multi") {
    const ci = Array.isArray(raw.correct_indices)
      ? Array.from(
          new Set(
            (raw.correct_indices as unknown[])
              .map((n) => Number(n))
              .filter((n) => Number.isInteger(n) && n >= 0 && n < opts.length)
          )
        )
      : [];
    if (ci.length < 2 || ci.length >= opts.length) return null; // need 2+ correct AND a distractor
    const { options, correct } = shuffleChoices(opts, ci);
    return { ...base, type: "multi", options, correct_index: correct[0] ?? 0, correct_indices: correct };
  }

  // single / scenario — exactly 4 options, one correct
  if (opts.length !== 4) return null;
  const idx = typeof raw.correct_index === "number" ? raw.correct_index : Number(raw.correct_index);
  if (!Number.isInteger(idx) || idx < 0 || idx >= 4) return null;
  const { options, correct } = shuffleChoices(opts, [idx]);
  const hasScenario = declared === "scenario" && typeof raw.scenario === "string" && !!raw.scenario.trim();
  const item: TechItem = { ...base, type: hasScenario ? "scenario" : "single", options, correct_index: correct[0] ?? 0 };
  if (hasScenario) item.scenario = (raw.scenario as string).trim();
  return item;
}

export async function generateTechnicalAssessment(input: {
  domainKey: TechDomainKey;
  language?: "en" | "ar";
}): Promise<TechTest> {
  const language = input.language === "ar" ? "ar" : "en";
  const domain = techDomainByKey(input.domainKey);
  if (!domain) return fallbackTest(input.domainKey, language);

  const client = getAIClient();
  if (!client) return fallbackTest(input.domainKey, language);

  const system = ITEM_WRITER_SYSTEM;

  const user = [
    ...arabicLangLines(language),
    `Write exactly ${ITEM_COUNT} multiple-choice items assessing technical competence in:`,
    `DOMAIN: ${domain.name}`,
    `SKILLS (spread items across these): ${domain.skills.join("; ")}.`,
    ``,
    `Ramp difficulty: ~3 easy, ~3 medium, ~2 hard. Each item = a question + four`,
    `options (one correct). Tag each item with the single skill it best assesses`,
    `(use the exact skill names above).`,
    ``,
    `Return JSON ONLY (no markdown fences):`,
    `{ "items": [ { "id":"t1","skill":"<one of the skills>","question":"...",`,
    `  "options":["a","b","c","d"],"correct_index":0,"difficulty":"easy" } ] }`,
  ].join("\n");

  try {
    const res = await client.messages.create({
      model: AI_MODEL,
      max_tokens: 3500,
      system,
      messages: [{ role: "user", content: user }],
    });
    const block = res.content.find((b) => b.type === "text");
    if (!block || block.type !== "text") throw new Error("no text");
    const match = block.text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("no json");
    const parsed = JSON.parse(match[0]) as { items?: Array<Partial<TechItem>> };

    const skillSet = new Set(domain.skills);
    const items: TechItem[] = (parsed.items ?? [])
      .filter((r) => typeof r.question === "string" && cleanMcq(r))
      .map((r, i): TechItem => {
        const { options, correct_index } = shuffleMcq((r.options as string[]).map(String), r.correct_index as number);
        return {
          id: r.id || `t${i + 1}`,
          skill: typeof r.skill === "string" && skillSet.has(r.skill) ? r.skill : domain.skills[i % domain.skills.length],
          type: "single",
          question: String(r.question),
          options,
          correct_index,
          difficulty: r.difficulty === "hard" ? "hard" : r.difficulty === "medium" ? "medium" : "easy",
        };
      });

    if (items.length < 4) return fallbackTest(input.domainKey, language);
    return { domain_key: input.domainKey, domain_name: domain.name, items, ai_generated: true };
  } catch (err) {
    console.error("[technical-assessment] generate failed:", err);
    return fallbackTest(input.domainKey, language);
  }
}

// ── Function (blueprint) assessment ──────────────────────────────────────────
// A function is a weighted selection of technical skills (Accounts Payable =
// invoice match + vendor recon + payment controls + …). Unlike the domain run's
// 8 generic items, this assembles a DEEP, multi-skill test — ~itemsPerSkill
// items per blueprint skill — so the per-skill breakdown is real. Items are
// tagged by the EXACT English skill name (the grading/rollup axis), the test
// carries the function key in domain_key + the function name in domain_name.

const FUNCTION_ITEMS_PER_SKILL = 4;

function functionFallbackTest(
  functionKey: string,
  functionName: string,
  skillsEn: string[],
  language: "en" | "ar"
): TechTest {
  const skills = skillsEn.length > 0 ? skillsEn : ["Fundamentals"];
  // One placeholder per skill so the multi-skill structure still renders without
  // an API key. Clearly not AI-generated; never presented as a real measure.
  return {
    domain_key: functionKey,
    domain_name: functionName,
    ai_generated: false,
    items: skills.map((skill, i) => ({
      id: `f${i + 1}`,
      skill,
      type: "single" as const,
      question:
        language === "ar"
          ? `بند نموذجي لمهارة «${skill}» ضمن وظيفة ${functionName}. اربط ANTHROPIC_API_KEY للحصول على تقييم حقيقي. أي خيار هو الصحيح هنا؟`
          : `Placeholder item for the "${skill}" skill within ${functionName}. Wire ANTHROPIC_API_KEY for a real, function-specific assessment. Which option is marked correct here?`,
      options:
        language === "ar"
          ? ["الخيار أ (صحيح)", "الخيار ب", "الخيار ج", "الخيار د"]
          : ["Option A (correct)", "Option B", "Option C", "Option D"],
      correct_index: 0,
      difficulty: "easy" as const,
    })),
  };
}

export async function generateFunctionAssessment(input: {
  functionKey: string;
  functionName: string;
  skillsEn: string[];
  language?: "en" | "ar";
  itemsPerSkill?: number;
}): Promise<TechTest> {
  const language = input.language === "ar" ? "ar" : "en";
  const skills = input.skillsEn.filter((s) => typeof s === "string" && s.trim().length > 0);
  const perSkill = Math.max(2, Math.min(8, input.itemsPerSkill ?? FUNCTION_ITEMS_PER_SKILL));

  const client = getAIClient();
  if (!client || skills.length === 0) {
    return functionFallbackTest(input.functionKey, input.functionName, skills, language);
  }

  const target = skills.length * perSkill;
  const user = [
    ...arabicLangLines(language),
    `Write a DEEP technical-competency assessment for the finance function below.`,
    `FUNCTION: ${input.functionName}`,
    ``,
    `Write EXACTLY ${perSkill} items for EACH of these skills (${target} items total):`,
    ...skills.map((s, i) => `  ${i + 1}. ${s}`),
    ``,
    `MIX ITEM TYPES (vary across each skill's items):`,
    `  • "single"   — one question, four options, exactly ONE correct (correct_index).`,
    `  • "multi"    — select-all-that-apply: 4-6 options with 2-3 correct`,
    `                 (correct_indices array). At least one option must be wrong.`,
    `  • "scenario" — a short realistic case in "scenario" (2-4 sentences with`,
    `                 figures), then a single-best-answer question (four options,`,
    `                 correct_index). Use for higher-order items.`,
    `Aim for roughly 55% single, 25% multi, 20% scenario across the test.`,
    ``,
    `TAG COGNITIVE LEVEL ("cognitive"): "recall" (definition/fact), "apply"`,
    `(compute/use a rule), or "analyze" (judge/diagnose a situation). Ramp from`,
    `recall toward analyze; pair scenario items with apply/analyze.`,
    ``,
    `Ramp "difficulty" easy→medium→hard. Tag every item with the EXACT English`,
    `skill name it assesses (copied verbatim above) — even when the text is Arabic.`,
    ``,
    `Return JSON ONLY (no markdown fences):`,
    `{ "items": [`,
    `  { "skill":"<exact skill>","type":"single","question":"...",`,
    `    "options":["a","b","c","d"],"correct_index":0,"cognitive":"recall","difficulty":"easy" },`,
    `  { "skill":"<exact skill>","type":"multi","question":"Which apply?",`,
    `    "options":["a","b","c","d","e"],"correct_indices":[0,2],"cognitive":"apply","difficulty":"medium" },`,
    `  { "skill":"<exact skill>","type":"scenario","scenario":"<case with figures>",`,
    `    "question":"...","options":["a","b","c","d"],"correct_index":1,"cognitive":"analyze","difficulty":"hard" } ] }`,
  ].join("\n");

  try {
    const res = await client.messages.create({
      model: AI_MODEL,
      max_tokens: 8000,
      system: ITEM_WRITER_SYSTEM,
      messages: [{ role: "user", content: user }],
    });
    const block = res.content.find((b) => b.type === "text");
    if (!block || block.type !== "text") throw new Error("no text");
    const match = block.text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("no json");
    const parsed = JSON.parse(match[0]) as { items?: RawRichItem[] };

    const skillSet = new Set(skills);
    const items: TechItem[] = (parsed.items ?? [])
      .map((r, i) => normalizeRichItem(r, i, skills, skillSet))
      .filter((it): it is TechItem => it !== null)
      .map((it, i) => ({ ...it, id: `t${i + 1}` })); // stable, collision-free ids

    // Need enough coverage to be meaningful; fall back if the model under-delivered.
    if (items.length < Math.max(4, Math.ceil(target / 2))) {
      return functionFallbackTest(input.functionKey, input.functionName, skills, language);
    }
    return { domain_key: input.functionKey, domain_name: input.functionName, items, ai_generated: true };
  } catch (err) {
    console.error("[technical-assessment] function generate failed:", err);
    return functionFallbackTest(input.functionKey, input.functionName, skills, language);
  }
}

/** Did the taker get this item right? single/scenario = exact index; multi =
 *  the selected set exactly equals the correct set (all-or-nothing). */
function itemIsCorrect(item: TechItem, answer: number | number[] | undefined): boolean {
  if (item.type === "multi") {
    const want = item.correct_indices ?? [];
    const got = Array.isArray(answer) ? answer : typeof answer === "number" ? [answer] : [];
    if (got.length !== want.length) return false;
    const wantSet = new Set(want);
    return got.every((g) => wantSet.has(g));
  }
  const got = Array.isArray(answer) ? answer[0] : answer;
  return got === item.correct_index;
}

export function scoreTechnicalAssessment(input: {
  test: TechTest;
  answers: Record<string, number | number[]>;
}): TechResult {
  const { test, answers } = input;
  const bySkill = new Map<string, { correct: number; total: number }>();
  let correct = 0;
  for (const item of test.items) {
    const entry = bySkill.get(item.skill) ?? { correct: 0, total: 0 };
    entry.total += 1;
    if (itemIsCorrect(item, answers[item.id])) {
      correct += 1;
      entry.correct += 1;
    }
    bySkill.set(item.skill, entry);
  }
  const total = test.items.length || 1;
  const pct = Math.round((100 * correct) / total);
  const perSkill = Array.from(bySkill.entries()).map(([skill, v]) => ({ skill, correct: v.correct, total: v.total }));
  return {
    domain_key: test.domain_key,
    domain_name: test.domain_name,
    correct,
    total: test.items.length,
    pct,
    proficiency: proficiencyFromPercent(pct),
    band: technicalConfidenceBand({ correct, total: test.items.length, perSkill }),
    perSkill,
    ai_generated: test.ai_generated,
    certified: test.certified ?? false,
  };
}
