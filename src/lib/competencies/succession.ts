// Competency succession from the database (00225 competencies.superseded_by).
// The code-side twin for the Persona bank is BEHAVIORAL_SUPERSEDED_BY in
// behavioral-framework.ts; both change together on the day a new framework
// version goes live. Server-only helper for copying stored competency sets
// (re-engagements, requisitions) onto the live framework.

import type { SupabaseClient } from "@supabase/supabase-js";

/** Retired competency id -> the id that absorbed it. Empty until a switch, and
 *  empty (never throws) on a database without migration 00225. */
export async function loadCompetencySuccessorMap(sb: SupabaseClient): Promise<Record<string, string>> {
  try {
    const { data, error } = await sb
      .from("competencies")
      .select("id, superseded_by")
      .not("superseded_by", "is", null);
    if (error) return {};
    const map: Record<string, string> = {};
    for (const r of (data ?? []) as Array<{ id: string; superseded_by: string | null }>) {
      if (r.superseded_by) map[r.id] = r.superseded_by;
    }
    return map;
  } catch {
    return {};
  }
}
