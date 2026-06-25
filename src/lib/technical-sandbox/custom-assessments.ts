// ─────────────────────────────────────────────────────────────
// Saved custom technical assessments (server-only). A reusable,
// named "pick-and-choose" sitting design: a subset of one function's
// knowledge skills and/or hands-on tasks (+ MCQ weight + talent lens)
// that an admin saves once and reuses when issuing vouchers / a trial
// link, instead of re-picking the custom_config each time.
//
// Backing table: technical_custom_assessments (migration 00166).
// Admin-only RLS; all writes go through the service-role client and
// are gated by requireRole(["admin"]) in the server actions. Every
// read/write is tolerant of an un-applied 00166 (isMissingSchemaError),
// mirroring the rest of the technical-sandbox lib.
// ─────────────────────────────────────────────────────────────
import { createServiceClient } from "@/lib/supabase/server";
import { isMissingSchemaError } from "./service";

export type TalentLens = "acquisition" | "development" | null;

export interface SavedCustomAssessment {
  id: string;
  name: string;
  functionId: string;
  /** Selected knowledge-skill keys/names (empty = knowledge section off). */
  skills: string[];
  /** Selected hands-on task (technical_skill_blocks) ids. */
  blockIds: string[];
  /** Knowledge-section score weight 0-100. */
  mcqPct: number;
  talentLens: TalentLens;
  createdAt: string;
}

const normLens = (v: unknown): TalentLens =>
  v === "acquisition" || v === "development" ? v : null;

export interface SaveCustomAssessmentInput {
  /** When provided, update that saved design; otherwise insert a new one. */
  id?: string | null;
  name: string;
  functionId: string;
  skills: string[];
  blockIds: string[];
  mcqPct: number;
  talentLens?: TalentLens;
  createdBy?: string | null;
}

export type SaveResult = { ok: true; id: string } | { ok: false; error: string };

/** Insert or update a saved custom-assessment design. Service-role. */
export async function saveCustomAssessment(input: SaveCustomAssessmentInput): Promise<SaveResult> {
  const name = input.name?.trim();
  if (!name) return { ok: false, error: "Name the assessment before saving." };
  if (!input.functionId) return { ok: false, error: "Select a function first." };

  // Preserve [] verbatim (an empty array is meaningful: knowledge-only vs
  // hands-on-only). Only drop falsy entries.
  const skills = (input.skills ?? []).filter(Boolean);
  const blockIds = (input.blockIds ?? []).filter(Boolean);
  const mcqPct = Math.max(0, Math.min(100, Math.round(input.mcqPct ?? 0)));
  // Must assess something - same rule the session/voucher actions enforce.
  if (blockIds.length === 0 && !(mcqPct > 0 && skills.length > 0)) {
    return { ok: false, error: "Pick at least one hands-on task, or knowledge skills with a knowledge weight." };
  }

  const sb = createServiceClient();
  const row = {
    name,
    function_id: input.functionId,
    skills,
    block_ids: blockIds,
    mcq_pct: mcqPct,
    talent_lens: normLens(input.talentLens),
    created_by: input.createdBy ?? null,
  };

  try {
    if (input.id) {
      const { data, error } = await sb
        .from("technical_custom_assessments")
        .update(row)
        .eq("id", input.id)
        .select("id")
        .maybeSingle<{ id: string }>();
      if (error) throw error;
      if (!data) return { ok: false, error: "That saved assessment no longer exists." };
      return { ok: true, id: data.id };
    }
    const { data, error } = await sb
      .from("technical_custom_assessments")
      .insert(row)
      .select("id")
      .single<{ id: string }>();
    if (error) throw error;
    return { ok: true, id: data.id };
  } catch (e) {
    if (isMissingSchemaError(e)) {
      return { ok: false, error: "Saving custom assessments needs migration 00166. Apply it, then try again." };
    }
    return { ok: false, error: e instanceof Error ? e.message : "Could not save the assessment." };
  }
}

/**
 * List saved designs, newest first. Optional functionId filter. Tolerant of an
 * un-applied 00166 (returns [] so the picker simply stays hidden).
 */
export async function listCustomAssessments(functionId?: string | null): Promise<SavedCustomAssessment[]> {
  const sb = createServiceClient();
  let q = sb
    .from("technical_custom_assessments")
    .select("id, name, function_id, skills, block_ids, mcq_pct, talent_lens, created_at")
    .order("created_at", { ascending: false })
    .limit(500);
  if (functionId) q = q.eq("function_id", functionId);
  const { data, error } = await q;
  if (error) {
    if (isMissingSchemaError(error)) return [];
    throw error;
  }
  return ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
    id: r.id as string,
    name: r.name as string,
    functionId: r.function_id as string,
    skills: (r.skills as string[]) ?? [],
    blockIds: (r.block_ids as string[]) ?? [],
    mcqPct: (r.mcq_pct as number) ?? 0,
    talentLens: normLens(r.talent_lens),
    createdAt: r.created_at as string,
  }));
}

/** Delete a saved design. No-ops gracefully if 00166 isn't applied. */
export async function deleteCustomAssessment(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!id) return { ok: false, error: "Missing id." };
  const sb = createServiceClient();
  try {
    const { error } = await sb.from("technical_custom_assessments").delete().eq("id", id);
    if (error) throw error;
    return { ok: true };
  } catch (e) {
    if (isMissingSchemaError(e)) return { ok: true };
    return { ok: false, error: e instanceof Error ? e.message : "Could not delete the assessment." };
  }
}
