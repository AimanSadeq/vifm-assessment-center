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
 * ANTHROPIC_API_KEY is absent so the dev flow still renders end-to-end; when a
 * key IS configured but generation fails, TechGenerationError is thrown so the
 * route can surface it — a taker is never silently served the placeholder deck.
 */

import type Anthropic from "@anthropic-ai/sdk";
import { getAIClient, AI_MODEL } from "./client";
import {
  techDomainByKey,
  proficiencyFromPercent,
  type TechDomainKey,
  type TechProficiency,
} from "@/lib/competencies/technical-framework";
import { technicalConfidenceBand, type TechBand } from "@/lib/scoring/tech-reliability";

/** Item format. `single` = one correct option (classic MCQ, 4 options); `multi` =
 *  select-all-that-apply (2+ correct, all-or-nothing, 4-6 options); `scenario` =
 *  a case stem + a single-best-answer MCQ grounded in it (4 options);
 *  `true_false` = a single proposition with exactly 2 options (True / False). */
export type TechItemType = "single" | "multi" | "scenario" | "true_false";
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

/** Thrown when AI generation was attempted (an API key IS configured) but no
 *  usable test could be produced — API failure, truncated/malformed output, or
 *  the model under-delivering. The route maps this to an explicit 5xx so a
 *  taker is never silently administered the placeholder deck. */
export class TechGenerationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TechGenerationError";
  }
}

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
        `LANGUAGE: Write every "question", "scenario", and all "options" in clear Modern Standard`,
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
 *  in the new order. Re-randomising per administration defeats "always pick A"
 *  + position memorisation - a defensibility/integrity must-fix. */
export function shuffleChoices(options: string[], correct: number[]): { options: string[]; correct: number[] } {
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

  const declared: TechItemType =
    raw.type === "multi" ? "multi" :
    raw.type === "scenario" ? "scenario" :
    raw.type === "true_false" ? "true_false" : "single";
  const skill = typeof raw.skill === "string" && skillSet.has(raw.skill) ? raw.skill : skills[i % skills.length];
  const base = {
    id: raw.id || `t${i + 1}`,
    skill,
    question: String(raw.question),
    cognitive: asCognitive(raw.cognitive),
    difficulty: asDifficulty(raw.difficulty),
  };

  if (declared === "true_false") {
    // Exactly 2 options, one correct. Option order is canonical (True / False),
    // so it is not shuffled - position carries no answer signal at n=2.
    if (opts.length !== 2) return null;
    const idx = typeof raw.correct_index === "number" ? raw.correct_index : Number(raw.correct_index);
    if (!Number.isInteger(idx) || idx < 0 || idx > 1) return null;
    return { ...base, type: "true_false", options: opts, correct_index: idx };
  }

  if (declared === "multi") {
    if (opts.length < 4 || opts.length > 6) return null;
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
    if (correct.length < 2) return null; // defensive: shuffle must preserve the correct set
    return { ...base, type: "multi", options, correct_index: correct[0], correct_indices: correct };
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
    `Write EXACTLY ${ITEM_COUNT} technical-competency assessment items for the finance`,
    `domain below, spread across its skills, and VARY the item format.`,
    `DOMAIN: ${domain.name}`,
    `SKILLS (use the EXACT English name as the "skill" tag): ${domain.skills.join("; ")}.`,
    ``,
    `TYPE MIX:`,
    `  • 4 × "single"     - one question, four options, exactly ONE correct (correct_index).`,
    `  • 1 × "true_false" - a single proposition; options ["True","False"]; correct_index 0 or 1.`,
    `  • 2 × "multi"      - select-all-that-apply: 4-6 options with 2-3 correct`,
    `                       (correct_indices array). At least one option must be wrong.`,
    `  • 1 × "scenario"   - a short realistic case in "scenario" (2-4 sentences with`,
    `                       figures), then a single-best-answer question (four options, correct_index).`,
    ``,
    `Tag COGNITIVE level ("cognitive"): "recall" / "apply" / "analyze". Ramp`,
    `"difficulty" across easy / medium / hard. Tag each item with the single skill`,
    `it best assesses (exact names above).`,
    ``,
    `Return JSON ONLY (no markdown fences):`,
    `{ "items": [`,
    `  { "skill":"<skill>","type":"single","question":"...","options":["a","b","c","d"],"correct_index":0,"cognitive":"recall","difficulty":"easy" },`,
    `  { "skill":"<skill>","type":"true_false","question":"...","options":["True","False"],"correct_index":0,"cognitive":"recall","difficulty":"easy" },`,
    `  { "skill":"<skill>","type":"multi","question":"Which apply?","options":["a","b","c","d","e"],"correct_indices":[0,2],"cognitive":"apply","difficulty":"medium" },`,
    `  { "skill":"<skill>","type":"scenario","scenario":"<case with figures>","question":"...","options":["a","b","c","d"],"correct_index":1,"cognitive":"analyze","difficulty":"hard" } ] }`,
  ].join("\n");

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await client.messages.create({
        model: AI_MODEL,
        max_tokens: 4000,
        system,
        messages: [{ role: "user", content: user }],
      });
      if (res.stop_reason === "max_tokens") throw new Error("output truncated at max_tokens");
      const block = res.content.find((b) => b.type === "text");
      if (!block || block.type !== "text") throw new Error("no text");
      const match = block.text.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("no json");
      const parsed = JSON.parse(match[0]) as { items?: RawRichItem[] };

      const skillSet = new Set(domain.skills);
      const items: TechItem[] = (parsed.items ?? [])
        .map((r, i) => normalizeRichItem(r, i, domain.skills, skillSet))
        .filter((it): it is TechItem => it !== null)
        .map((it, i) => ({ ...it, id: `t${i + 1}` })); // stable, collision-free ids

      if (items.length < 4) throw new Error(`only ${items.length} usable items (need 4+)`);
      return { domain_key: input.domainKey, domain_name: domain.name, items, ai_generated: true };
    } catch (err) {
      console.error(`[technical-assessment] domain generate attempt ${attempt} failed:`, err);
    }
  }
  // The key is configured but the model couldn't deliver — surface the failure
  // rather than silently administering the placeholder deck.
  throw new TechGenerationError(`AI generation failed for domain "${domain.name}"`);
}

// ── Function (blueprint) assessment ──────────────────────────────────────────
// A function is a weighted selection of technical skills (Accounts Payable =
// invoice match + vendor recon + payment controls + …). Unlike the domain run's
// 8 generic items, this assembles a DEEP, multi-skill test — ~itemsPerSkill
// items per blueprint skill — so the per-skill breakdown is real. Items are
// tagged by the EXACT English skill name (the grading/rollup axis), the test
// carries the function key in domain_key + the function name in domain_name.

// Items generated per blueprint skill (subcategory). 5 gives a more reliable
// per-subcategory read than the old 4 (a single careless answer swings a
// 4-item skill by 25%); callers may still override 2-8 via itemsPerSkill.
const FUNCTION_ITEMS_PER_SKILL = 5;

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

/** A 4-item chunk costs ~250 output tokens per item (scenario stems, multi
 *  options); 3000 gives ~3x headroom so truncation is a hard error, not a
 *  likelihood. */
const PER_SKILL_MAX_TOKENS = 3000;

/** One model call: `perSkill` items for ONE skill of the function. Returns []
 *  after exhausting retries so the caller can judge coverage across skills. */
async function generateSkillItems(
  client: Anthropic,
  input: { functionName: string; skill: string; perSkill: number; language: "en" | "ar" }
): Promise<TechItem[]> {
  const { functionName, skill, perSkill, language } = input;
  // Per-skill type mix, mirroring the old whole-test 55/25/20 target: for the
  // default 4 items/skill → 2 single + 1 multi + 1 scenario.
  const scenarioN = 1;
  const multiN = perSkill >= 3 ? 1 : 0;
  const singleN = perSkill - scenarioN - multiN;

  const user = [
    ...arabicLangLines(language),
    `Write EXACTLY ${perSkill} technical-competency assessment items for ONE skill`,
    `of the finance function below.`,
    `FUNCTION: ${functionName}`,
    `SKILL: ${skill}`,
    ``,
    `EXACT TYPE MIX:`,
    `  • ${singleN} × "single"   — one question, four options, exactly ONE correct (correct_index).`,
    ...(multiN > 0
      ? [
          `  • ${multiN} × "multi"    — select-all-that-apply: 4-6 options with 2-3 correct`,
          `                 (correct_indices array). At least one option must be wrong.`,
        ]
      : []),
    `  • ${scenarioN} × "scenario" — a short realistic case in "scenario" (2-4 sentences with`,
    `                 figures), then a single-best-answer question (four options,`,
    `                 correct_index).`,
    ``,
    `TAG COGNITIVE LEVEL ("cognitive"): "recall" (definition/fact), "apply"`,
    `(compute/use a rule), or "analyze" (judge/diagnose a situation). Ramp from`,
    `recall toward analyze; pair the scenario item with apply/analyze.`,
    ``,
    `Ramp "difficulty" easy→medium→hard across the ${perSkill} items. Set every`,
    `item's "skill" to EXACTLY this English string — even when the text is Arabic:`,
    `${skill}`,
    ``,
    `Return JSON ONLY (no markdown fences):`,
    `{ "items": [`,
    `  { "skill":${JSON.stringify(skill)},"type":"single","question":"...",`,
    `    "options":["a","b","c","d"],"correct_index":0,"cognitive":"recall","difficulty":"easy" },`,
    `  { "skill":${JSON.stringify(skill)},"type":"multi","question":"Which apply?",`,
    `    "options":["a","b","c","d","e"],"correct_indices":[0,2],"cognitive":"apply","difficulty":"medium" },`,
    `  { "skill":${JSON.stringify(skill)},"type":"scenario","scenario":"<case with figures>",`,
    `    "question":"...","options":["a","b","c","d"],"correct_index":1,"cognitive":"analyze","difficulty":"hard" } ] }`,
  ].join("\n");

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await client.messages.create({
        model: AI_MODEL,
        max_tokens: PER_SKILL_MAX_TOKENS,
        system: ITEM_WRITER_SYSTEM,
        messages: [{ role: "user", content: user }],
      });
      if (res.stop_reason === "max_tokens") throw new Error("output truncated at max_tokens");
      const block = res.content.find((b) => b.type === "text");
      if (!block || block.type !== "text") throw new Error("no text");
      const match = block.text.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("no json");
      const parsed = JSON.parse(match[0]) as { items?: RawRichItem[] };
      const items = (parsed.items ?? [])
        .map((r, i) => normalizeRichItem(r, i, [skill], new Set([skill])))
        .filter((it): it is TechItem => it !== null);
      if (items.length === 0) throw new Error("no usable items");
      return items.slice(0, perSkill);
    } catch (err) {
      console.error(`[technical-assessment] skill "${skill}" attempt ${attempt} failed:`, err);
    }
  }
  return [];
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

  // One small call per skill instead of one giant call for the whole blueprint:
  // a 6-skill × 4-item single request overruns its output budget (truncated
  // JSON) and streams longer than proxy timeouts — both of which used to fall
  // back, silently, to the placeholder deck. Chunks also fail independently,
  // so one bad skill can't void five good ones.
  const perSkillItems = await Promise.all(
    skills.map((skill) =>
      generateSkillItems(client, { functionName: input.functionName, skill, perSkill, language })
    )
  );

  const items = perSkillItems
    .flat()
    .map((it, i) => ({ ...it, id: `t${i + 1}` })); // stable, collision-free ids
  const target = skills.length * perSkill;

  // Need enough coverage to be meaningful; the key IS configured here, so an
  // under-delivery is surfaced — never swapped for the placeholder deck.
  if (items.length < Math.max(4, Math.ceil(target / 2))) {
    const failed = skills.filter((_, i) => perSkillItems[i].length === 0);
    throw new TechGenerationError(
      `AI generation under-delivered for function "${input.functionName}" ` +
        `(${items.length}/${target} items${failed.length > 0 ? `; failed skills: ${failed.join(", ")}` : ""})`
    );
  }
  return { domain_key: input.functionKey, domain_name: input.functionName, items, ai_generated: true };
}

/** Did the taker get this item right? single/scenario/true_false = exact index;
 *  multi = the selected set exactly equals the correct set (all-or-nothing). */
export function itemIsCorrect(item: TechItem, answer: number | number[] | undefined): boolean {
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
