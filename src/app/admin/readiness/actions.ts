"use server";

import { createServiceClient } from "@/lib/supabase/server";
import { requireRole, isAuthorizationError } from "@/lib/ara/auth-guards";

/**
 * Thin front door for Succession Readiness: create an engagement already set to
 * combined mode, so the consultant starts from the Readiness service rather than
 * the Assessment Center. Candidates, agreed competencies and the Reflect 360 link
 * are then set on the engagement detail (the setup panel already lives there).
 */
export async function createReadinessProgramAction(input: {
  organizationId: string;
  name: string;
  targetRole?: string;
}): Promise<{ ok: true; id: string } | { error: string }> {
  try {
    await requireRole(["admin"]);
  } catch (e) {
    if (isAuthorizationError(e)) return { error: e.message };
    throw e;
  }

  const name = input.name?.trim();
  if (!input.organizationId) return { error: "Pick a client organisation." };
  if (!name) return { error: "Enter a programme name." };

  const sb = createServiceClient();
  const { data, error } = await sb
    .from("engagements")
    .insert({
      organization_id: input.organizationId,
      name,
      target_role: input.targetRole?.trim() || null,
      status: "draft",
      assessment_mode: "combined",
    })
    .select("id")
    .single();
  if (error || !data) return { error: error?.message ?? "Could not create the programme." };
  return { ok: true, id: data.id as string };
}
