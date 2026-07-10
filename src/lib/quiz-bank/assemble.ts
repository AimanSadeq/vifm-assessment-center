// Competency quiz bank - assembly (server-only).
//
// Draws SME-APPROVED items from competency_quiz_items for a given competency,
// least-administered-first, so a Pre-Hire screen (and, later, the candidate
// skill quizzes + Academy checks) can be assembled from vetted items instead of
// minted live. Returns [] when the approved pool is empty, so the caller falls
// back to the live generator (generateQuizQuestions) - non-breaking.
//
// Tolerant: every path no-ops (returns []) if migration 00180 isn't applied.

import { createServiceClient } from "@/lib/supabase/server";
import type { QuizQuestion } from "@/types/database";

type Row = {
  id: string;
  type: string;
  prompt_en: string;
  prompt_ar: string | null;
  options_en: unknown;
  options_ar: unknown;
  correct_index: number;
  points: number | null;
  difficulty: string | null;
  explanation_en: string | null;
  explanation_ar: string | null;
  sequence: unknown;
  times_administered: number;
};

const asStrArr = (v: unknown): string[] | null => (Array.isArray(v) ? v.map(String) : null);
const VALID_TYPE = new Set(["multiple_choice", "true_false", "pattern_recognition"]);

/** A well-formed, servable approved item (valid EN options + in-range key). */
function usable(r: Row): boolean {
  if (!VALID_TYPE.has(r.type)) return false;
  const oe = asStrArr(r.options_en);
  if (!oe || oe.length < 2) return false;
  if (r.correct_index == null || r.correct_index < 0 || r.correct_index >= oe.length) return false;
  if (r.type === "pattern_recognition") {
    const seq = Array.isArray(r.sequence) ? r.sequence : null;
    if (!seq || seq.filter((c) => c === null).length !== 1) return false;
  }
  return true;
}

function toQuizQuestion(r: Row): QuizQuestion {
  const oe = asStrArr(r.options_en) as string[];
  const oa = asStrArr(r.options_ar);
  return {
    id: r.id,
    type: r.type as QuizQuestion["type"],
    prompt_en: r.prompt_en,
    prompt_ar: r.prompt_ar && r.prompt_ar.trim() ? r.prompt_ar : null,
    options_en: oe,
    options_ar: oa && oa.length === oe.length ? oa : null,
    correct_index: r.correct_index,
    points: typeof r.points === "number" ? r.points : 15,
    difficulty: (["easy", "medium", "hard"] as const).includes(r.difficulty as never)
      ? (r.difficulty as QuizQuestion["difficulty"])
      : "medium",
    explanation_en: r.explanation_en ?? "",
    explanation_ar: r.explanation_ar ?? null,
    sequence:
      r.type === "pattern_recognition" && Array.isArray(r.sequence)
        ? (r.sequence as (string | number | null)[])
        : undefined,
  };
}

/**
 * Draw up to `wanted` APPROVED items for a competency from the bank,
 * least-administered-first, preferring items not in `excludeIds` (a retaker's
 * previously-seen items). Bumps times_administered on the drawn items so the
 * rotation actually rotates. Returns [] if the bank has none (caller falls back).
 */
export async function drawCompetencyQuizItems(
  competencyId: string,
  wanted: number,
  excludeIds?: Set<string>
): Promise<QuizQuestion[]> {
  if (wanted <= 0) return [];
  try {
    const svc = createServiceClient();
    const { data } = await svc
      .from("competency_quiz_items")
      .select(
        "id, type, prompt_en, prompt_ar, options_en, options_ar, correct_index, points, difficulty, explanation_en, explanation_ar, sequence, times_administered"
      )
      .eq("competency_id", competencyId)
      // Serve the FIXED authored bank (approved OR in_review) before ever
      // live-generating: we already have the questions. approved items are vetted;
      // in_review items are fixed-but-provisional. Only a competency with NO
      // authored items at all lets the caller fall back to live-AI.
      .in("status", ["approved", "in_review"])
      .order("times_administered", { ascending: true })
      .limit(60);
    const rows = ((data ?? []) as Row[]).filter(usable);
    if (rows.length === 0) return [];

    // Prefer unseen items (exclusion soft: never blocks serving).
    const ordered = excludeIds
      ? [...rows.filter((r) => !excludeIds.has(r.id)), ...rows.filter((r) => excludeIds.has(r.id))]
      : rows;
    const picked = ordered.slice(0, wanted);

    // Exposure counter (best-effort; needs 00180's cqi_increment_administered).
    const ids = picked.map((r) => r.id);
    if (ids.length) {
      try { await svc.rpc("cqi_increment_administered", { ids }); } catch { /* fn absent */ }
    }
    return picked.map(toQuizQuestion);
  } catch {
    return [];
  }
}

/** How many APPROVED items exist per competency (for the assembler + readiness). */
export async function approvedCountByCompetency(): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  try {
    const svc = createServiceClient();
    const { data } = await svc.from("competency_quiz_items").select("competency_id").eq("status", "approved");
    for (const r of (data as { competency_id: string }[] | null) ?? []) {
      out[r.competency_id] = (out[r.competency_id] ?? 0) + 1;
    }
  } catch {
    /* not migrated */
  }
  return out;
}
