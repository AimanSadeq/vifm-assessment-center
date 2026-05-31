"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { requireRole, isAuthorizationError } from "@/lib/ara/auth-guards";

type ActionResult = { ok?: true; error?: string };

/**
 * Add or remove a technical domain from an engagement's certification program.
 * Admin-gated; writes via the service client (RLS-bypassing, guarded by the role
 * check). Tolerant of the 00056 table being absent.
 */
export async function setEngagementTechDomainAction(input: {
  engagementId: string;
  domainKey: string;
  inScope: boolean;
}): Promise<ActionResult> {
  try {
    await requireRole(["admin"]);
  } catch (e) {
    if (isAuthorizationError(e)) return { error: e.message };
    throw e;
  }

  const sb = createServiceClient();
  try {
    if (input.inScope) {
      const { error } = await sb
        .from("engagement_technical_domains")
        .upsert(
          { engagement_id: input.engagementId, domain_key: input.domainKey },
          { onConflict: "engagement_id,domain_key" }
        );
      if (error) return { error: error.message };
    } else {
      const { error } = await sb
        .from("engagement_technical_domains")
        .delete()
        .eq("engagement_id", input.engagementId)
        .eq("domain_key", input.domainKey);
      if (error) return { error: error.message };
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to update technical scope" };
  }

  revalidatePath(`/admin/engagements/${input.engagementId}`);
  return { ok: true };
}
