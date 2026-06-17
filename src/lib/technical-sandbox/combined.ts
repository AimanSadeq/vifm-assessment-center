// ─────────────────────────────────────────────────────────────
// Combined Technical Assessment: a knowledge (MCQ) section blended with the
// hands-on sandbox section. The MCQ % is a SCORE WEIGHT, not an item count -
// each section scores on its own 0-100 scale, then we blend
//   combined = mcq * (pct/100) + sandbox * (1 - pct/100)
// with a per-section floor + an overall bar gating the credential. mcq_pct = 0
// means sandbox-only (unchanged historical behaviour).
// ─────────────────────────────────────────────────────────────
import { createServiceClient } from "@/lib/supabase/server";
import { buildCertifiedFunctionTest } from "@/lib/competencies/technical-function-bank";
import {
  generateFunctionAssessment,
  scoreTechnicalAssessment,
  type TechTest,
} from "@/lib/ai/technical-assessment";
import { tierFor } from "./validators";
import type { ProficiencyTier } from "./types";

/** Each section must clear its own floor, and the blend must clear the bar,
 *  before a combined technical_proficiency credential is issued. */
export const MCQ_FLOOR = 50;
export const SANDBOX_FLOOR = 50;
export const OVERALL_BAR = 70;
/** Default MCQ section length when provisioning (kept modest; the % is a weight,
 *  not a count, so this is about reliability/coverage, not the split). */
export const MCQ_SECTION_SIZE = 10;

export type CombinedOutcome = {
  /** Blended 0-100 (sandbox-only when mcqPct = 0 / no MCQ section). */
  combinedPct: number;
  combinedBand: ProficiencyTier;
  mcqPassed: boolean;
  sandboxPassed: boolean;
  /** True only when both sections clear their floor AND the blend clears the bar. */
  passed: boolean;
};

/** Blend the two section scores by the MCQ weight and apply the floors + bar. */
export function combineScores(input: {
  mcqPct: number;
  mcqScorePct: number | null;
  sandboxScorePct: number;
}): CombinedOutcome {
  const w = Math.max(0, Math.min(100, input.mcqPct)) / 100;
  const hasMcq = input.mcqPct > 0 && input.mcqScorePct != null;
  const mcq = input.mcqScorePct ?? 0;
  const combinedPct = hasMcq
    ? Math.round(mcq * w + input.sandboxScorePct * (1 - w))
    : Math.round(input.sandboxScorePct);
  const mcqPassed = !hasMcq || mcq >= MCQ_FLOOR;
  const sandboxPassed = input.sandboxScorePct >= SANDBOX_FLOOR;
  const passed = mcqPassed && sandboxPassed && combinedPct >= OVERALL_BAR;
  return { combinedPct, combinedBand: tierFor(combinedPct), mcqPassed, sandboxPassed, passed };
}

/** Score the MCQ section server-side from the stored keyed test + the taker's
 *  answers. Returns 0-100, or null when there's no usable test. */
export function gradeMcqTest(
  test: TechTest | null,
  answers: Record<string, number | number[]>
): number | null {
  if (!test || !Array.isArray(test.items) || test.items.length === 0) return null;
  return scoreTechnicalAssessment({ test, answers }).pct;
}

/**
 * Provision the MCQ section's keyed test for a function (by its sandbox
 * function_id). Prefers the SME-approved certified bank; falls back to AI
 * generation. Returns the keyed TechTest (held server-side on the session) or
 * null when the function has no MCQ content (the sitting then runs sandbox-only).
 *
 * `skillsOverride` (a custom sitting) restricts the MCQ section to a subset of
 * the function's skills - intersected with the blueprint skills so a stale or
 * mistyped pick can never broaden coverage. Empty/undefined = the full blueprint.
 */
export async function buildMcqTestForFunction(
  functionId: string,
  language: "en" | "ar",
  skillsOverride?: string[] | null
): Promise<TechTest | null> {
  let key: string;
  let name: string;
  let skillsEn: string[];
  try {
    const sb = createServiceClient();
    const { data } = await sb
      .from("technical_functions")
      .select("id, key, name_en, skills_en")
      .eq("id", functionId)
      .maybeSingle<{ id: string; key: string; name_en: string; skills_en: string[] | null }>();
    if (!data) return null;
    key = data.key;
    name = data.name_en;
    skillsEn = (data.skills_en ?? []).filter(Boolean);
  } catch {
    return null;
  }

  // Custom sitting: keep only the chosen skills, intersected with the blueprint.
  // Apply the intersection unconditionally - if a stale/mistyped pick has no
  // overlap with the current blueprint, that yields zero skills, and the guard
  // below returns null (no knowledge section) rather than silently broadening
  // back to the full blueprint.
  if (skillsOverride && skillsOverride.length > 0) {
    const want = new Set(skillsOverride);
    skillsEn = skillsEn.filter((s) => want.has(s));
  }
  if (skillsEn.length === 0) return null;

  const certified = await buildCertifiedFunctionTest({
    functionKey: key,
    functionName: name,
    skillsEn,
    functionId,
    language,
  });
  if (certified) return certified.test;

  try {
    return await generateFunctionAssessment({ functionKey: key, functionName: name, skillsEn, language });
  } catch {
    return null;
  }
}
