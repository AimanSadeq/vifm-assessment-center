"use server";

import { submitEngagementSurvey } from "@/lib/hipo/engagement";

/** Token-gated submit for the manager engagement survey. Identity is the
 *  unguessable token; single-use is enforced in the lib (completed_at guard). */
export async function submitEngagementAction(input: {
  token: string;
  answers: Record<string, number>;
  contextNote?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  return submitEngagementSurvey(input.token, input.answers ?? {}, input.contextNote ?? null);
}
