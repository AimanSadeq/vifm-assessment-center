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

export type TechItem = {
  id: string;
  skill: string; // one of the domain's skills
  question: string;
  options: string[]; // exactly 4
  correct_index: number;
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

// Answer-key-stripped shape for the browser.
export type PublicTechItem = Omit<TechItem, "correct_index">;
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
    items: test.items.map(({ id, skill, question, options, difficulty }) => ({
      id,
      skill,
      question,
      options,
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
    `Write EXACTLY ${perSkill} multiple-choice items for EACH of these skills (${target} items total):`,
    ...skills.map((s, i) => `  ${i + 1}. ${s}`),
    ``,
    `Within each skill, ramp difficulty (for ${perSkill} items: roughly half easy,`,
    `the rest medium/hard). Tag every item with the EXACT English skill name it`,
    `assesses (copied verbatim from the list above) — even when the question text is`,
    `Arabic. Each item = a question + four options with exactly one correct answer.`,
    ``,
    `Return JSON ONLY (no markdown fences):`,
    `{ "items": [ { "id":"t1","skill":"<exact skill name>","question":"...",`,
    `  "options":["a","b","c","d"],"correct_index":0,"difficulty":"easy" } ] }`,
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
    const parsed = JSON.parse(match[0]) as { items?: Array<Partial<TechItem>> };

    const skillSet = new Set(skills);
    const items: TechItem[] = (parsed.items ?? [])
      .filter((r) => typeof r.question === "string" && cleanMcq(r))
      .map((r, i): TechItem => {
        const { options, correct_index } = shuffleMcq((r.options as string[]).map(String), r.correct_index as number);
        return {
          id: r.id || `t${i + 1}`,
          skill: typeof r.skill === "string" && skillSet.has(r.skill) ? r.skill : skills[i % skills.length],
          question: String(r.question),
          options,
          correct_index,
          difficulty: r.difficulty === "hard" ? "hard" : r.difficulty === "medium" ? "medium" : "easy",
        };
      });

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

export function scoreTechnicalAssessment(input: {
  test: TechTest;
  answers: Record<string, number>;
}): TechResult {
  const { test, answers } = input;
  const bySkill = new Map<string, { correct: number; total: number }>();
  let correct = 0;
  for (const item of test.items) {
    const entry = bySkill.get(item.skill) ?? { correct: 0, total: 0 };
    entry.total += 1;
    if (answers[item.id] === item.correct_index) {
      correct += 1;
      entry.correct += 1;
    }
    bySkill.set(item.skill, entry);
  }
  const total = test.items.length || 1;
  const pct = Math.round((100 * correct) / total);
  return {
    domain_key: test.domain_key,
    domain_name: test.domain_name,
    correct,
    total: test.items.length,
    pct,
    proficiency: proficiencyFromPercent(pct),
    perSkill: Array.from(bySkill.entries()).map(([skill, v]) => ({ skill, correct: v.correct, total: v.total })),
    ai_generated: test.ai_generated,
    certified: test.certified ?? false,
  };
}
