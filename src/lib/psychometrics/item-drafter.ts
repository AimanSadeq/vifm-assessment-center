// VIFM Psychometrics - AI item drafter (Tier 2 bank). Drafts bilingual items for
// ONE scale at a time; the SME reviews → approves into the bank. Returns [] when
// no ANTHROPIC_API_KEY is set (the console then offers manual authoring instead).
//
// Cognitive → MCQs for a subtest (numerical/verbal/inductive/deductive) with one defensible
// key + difficulty. Personality → first-person Likert statements for one Big-Five
// trait, each flagged reverse/forward. Everything is drafted EN+AR together so
// locale parity holds from the start.

import { getAIClient, AI_MODEL } from "@/lib/ai/client";
import type { PsyKind, PsyItemKind } from "./bank";

export type DraftedItem = {
  kind: PsyItemKind;
  stem_en: string;
  stem_ar: string;
  options_en: string[] | null;
  options_ar: string[] | null;
  correct_index: number | null;
  reverse_keyed: boolean;
  difficulty: "easy" | "medium" | "hard" | null;
};

const SYSTEM =
  "You are a senior psychometric item writer for VIFM. You write clean, fair, single-construct " +
  "cognitive-ability items in parallel English + Modern Standard Arabic. Items MUST be culture-fair " +
  "and domain-neutral: everyday-life or abstract content, with NO finance, banking, accounting, " +
  "treasury, investment or specialist business framing or jargon - an educated non-specialist must " +
  "solve each with no domain knowledge. Output STRICT JSON only - no prose, no markdown fences.";

function cognitivePrompt(scaleKey: string, scaleName: string, count: number): string {
  const kind =
    scaleKey === "numerical" ? "numerical reasoning: ratio/proportion, percentage & change, or interpreting a small text-described table/chart - COMPUTATION ONLY (a number/letter series is inductive, not numerical)"
    : scaleKey === "verbal" ? "verbal reasoning: LANGUAGE only - reading comprehension, verbal analogies, or vocabulary-in-context. NEVER a syllogism, if-then logic, 'what necessarily follows', or an ordering puzzle (those are deductive)"
    : scaleKey === "inductive" ? "inductive reasoning: infer the rule from examples - number/letter series, odd-one-out, or a text-described figural matrix (the rule is discovered)"
    : scaleKey === "deductive" ? "deductive reasoning: apply GIVEN rules/premises to a necessarily valid conclusion - syllogisms, if-then (conditional) logic, or arrangements (all formal logic lives here)"
    // Defensive default: the four subtests above are the only valid cognitive
    // scales (resolveScaleId rejects others upstream).
    : "logical reasoning (a clean single-construct reasoning item)";
  return [
    `Write ${count} multiple-choice ${kind} items for the "${scaleName}" subtest.`,
    `Each item: 3–4 options, exactly one defensible correct answer, solvable in under a minute, no trick wording.`,
    `Content MUST be domain-neutral (no finance/banking/business framing) and culture-fair.`,
    `Return a JSON array. Each element:`,
    `{ "stem_en": "...", "stem_ar": "...", "options_en": ["..."], "options_ar": ["..."],`,
    `  "correct_index": <0-based int, same index valid for both languages>, "difficulty": "easy"|"medium"|"hard" }`,
    `options_en and options_ar MUST be the same length and in the same order.`,
  ].join("\n");
}

function personalityPrompt(scaleKey: string, scaleName: string, count: number): string {
  return [
    `Write ${count} first-person self-report statements measuring the Big-Five trait "${scaleName}" (key ${scaleKey}).`,
    `Mix forward-keyed (high agreement = more of the trait) and reverse-keyed statements.`,
    `Plain everyday language, one idea each, suitable for a 1–5 agree/disagree Likert. Avoid double-barrelled items.`,
    `Return a JSON array. Each element:`,
    `{ "stem_en": "...", "stem_ar": "...", "reverse_keyed": <true|false> }`,
  ].join("\n");
}

function stripFences(text: string): string {
  return text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
}

/** Draft `count` items for one scale. Returns [] without an AI key or on any failure. */
export async function draftScaleItems(input: {
  instrumentKind: PsyKind;
  scaleKey: string;
  scaleNameEn: string;
  count: number;
}): Promise<DraftedItem[]> {
  const ai = getAIClient();
  if (!ai) return [];
  const count = Math.max(1, Math.min(12, Math.floor(input.count) || 4));
  const isCog = input.instrumentKind === "cognitive";
  try {
    const res = await ai.messages.create({
      model: AI_MODEL,
      max_tokens: 4000,
      system: SYSTEM,
      messages: [{
        role: "user",
        content: isCog
          ? cognitivePrompt(input.scaleKey, input.scaleNameEn, count)
          : personalityPrompt(input.scaleKey, input.scaleNameEn, count),
      }],
    });
    const block = res.content[0];
    if (block?.type !== "text") return [];
    const parsed = JSON.parse(stripFences(block.text)) as unknown;
    if (!Array.isArray(parsed)) return [];

    const out: DraftedItem[] = [];
    for (const raw of parsed) {
      const q = raw as Record<string, unknown>;
      const stem_en = typeof q.stem_en === "string" ? q.stem_en.trim() : "";
      const stem_ar = typeof q.stem_ar === "string" ? q.stem_ar.trim() : "";
      if (!stem_en) continue;

      if (isCog) {
        const en = Array.isArray(q.options_en) ? q.options_en.map(String) : [];
        const ar = Array.isArray(q.options_ar) ? q.options_ar.map(String) : [];
        if (en.length < 2) continue;
        const ci = typeof q.correct_index === "number" ? q.correct_index : -1;
        if (ci < 0 || ci >= en.length) continue;
        const difficulty = (["easy", "medium", "hard"] as const).includes(q.difficulty as never)
          ? (q.difficulty as DraftedItem["difficulty"]) : "medium";
        out.push({
          kind: "mcq", stem_en, stem_ar: stem_ar || stem_en,
          options_en: en, options_ar: ar.length === en.length ? ar : en,
          correct_index: ci, reverse_keyed: false, difficulty,
        });
      } else {
        out.push({
          kind: "likert", stem_en, stem_ar: stem_ar || stem_en,
          options_en: null, options_ar: null, correct_index: null,
          reverse_keyed: q.reverse_keyed === true, difficulty: null,
        });
      }
    }
    return out;
  } catch {
    return [];
  }
}
