"use server";

import { revalidatePath } from "next/cache";
import { requireRole, isAuthorizationError } from "@/lib/ara/auth-guards";
import { createServiceClient } from "@/lib/supabase/server";

const CEFR = new Set(["A1", "A2", "B1", "B2", "C1", "C2"]);

/**
 * Save a human rater's CEFR for a result's writing and/or speaking, used to
 * compute Claude-vs-human QWK. Upserts on (result_id, skill, rater_id) so a
 * rater can revise. Writes via the service client (eng_fluent_human_ratings
 * RLS is admin-only); the page lives in the admin area.
 */
export async function submitHumanRating(
  formData: FormData
): Promise<{ ok: boolean; error?: string }> {
  // Server action = independently invocable POST; gate it the same way the page
  // is (staff only) so a non-staff caller can't corrupt the calibration data.
  try {
    await requireRole(["admin", "consultant", "lead_assessor", "associate_assessor"]);
  } catch (e) {
    if (isAuthorizationError(e)) return { ok: false, error: "Not authorised." };
    throw e;
  }

  const resultId = String(formData.get("resultId") || "").trim();
  const raterId = String(formData.get("raterId") || "").trim() || "rater";
  if (!resultId) return { ok: false, error: "missing result" };

  const rows: Array<Record<string, unknown>> = [];
  for (const skill of ["writing", "speaking"] as const) {
    const cefr = String(formData.get(`${skill}_cefr`) || "").trim();
    if (cefr && CEFR.has(cefr)) {
      rows.push({ result_id: resultId, skill, rater_id: raterId, human_cefr: cefr });
    }
  }
  if (rows.length === 0) return { ok: false, error: "select at least one CEFR level" };

  try {
    const sb = createServiceClient();
    const { error } = await sb
      .from("eng_fluent_human_ratings")
      .upsert(rows, { onConflict: "result_id,skill,rater_id" });
    if (error) return { ok: false, error: error.message };
    revalidatePath("/ac/fluent/calibration");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "save failed" };
  }
}
