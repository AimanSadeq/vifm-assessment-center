"use server";

import { requireRole, isAuthorizationError } from "@/lib/ara/auth-guards";
import { generateIdpFromReadiness, type GenerateIdpResult } from "@/lib/scoring/readiness-idp";

/** Admin/coach-gated: build a draft IDP from the candidate's readiness result. */
export async function generateIdpAction(
  engagementId: string,
  candidateId: string,
): Promise<GenerateIdpResult> {
  try {
    await requireRole(["admin"]);
  } catch (e) {
    if (isAuthorizationError(e)) return { ok: false, error: "save_failed", message: e.message };
    throw e;
  }
  return generateIdpFromReadiness(engagementId, candidateId);
}
