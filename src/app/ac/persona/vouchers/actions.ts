"use server";

import { revalidatePath } from "next/cache";
import { requireRole, isAuthorizationError } from "@/lib/ara/auth-guards";
import { createServiceClient } from "@/lib/supabase/server";
import { createVoucherBatch } from "@/lib/persona/vouchers";
import { createClientOrganization } from "@/lib/clients/registry";

async function guard() {
  try {
    const caller = await requireRole(["admin"]);
    return { ok: true as const, caller };
  } catch (e) {
    if (isAuthorizationError(e)) return { ok: false as const, error: e.message };
    throw e;
  }
}

export async function generatePersonaVouchersAction(input: {
  count: number;
  label?: string;
  clientName?: string;
  maxUses?: number;
  expiresAt?: string | null;
  /** Admin-pinned scope (SD-1). purpose omitted = legacy/unpinned (candidate picks). */
  purpose?: "development" | "hiring";
  targetRoleProfileId?: string | null;
  /** Empty / omitted = full bank; non-empty = serve only these competencies. */
  scopedCompetencyIds?: string[];
}): Promise<{ ok: true; codes: string[] } | { error: string }> {
  const g = await guard();
  if (!g.ok) return { error: g.error };

  const purpose = input.purpose === "hiring" || input.purpose === "development" ? input.purpose : null;
  // A hiring voucher needs a target role for the fit; reject early so an admin
  // can't issue a hiring batch that produces no fit report.
  if (purpose === "hiring" && !input.targetRoleProfileId) {
    return { error: "Pick a target role profile for a hiring assessment." };
  }

  let organizationId: string | null = null;
  const clientName = input.clientName?.trim() || null;
  if (clientName) {
    try {
      const reg = await createClientOrganization({ name: clientName, createdBy: g.caller.isDev ? null : g.caller.uid });
      if (reg.ok) organizationId = reg.organizationId;
    } catch {
      /* keep the denormalized client_name tag */
    }
  }

  const res = await createVoucherBatch({
    count: input.count,
    label: input.label?.trim() || null,
    organizationId,
    clientName,
    maxUses: Math.max(1, input.maxUses ?? 1),
    expiresAt: input.expiresAt || null,
    createdBy: g.caller.isDev ? null : g.caller.uid,
    purpose,
    targetRoleProfileId: purpose === "hiring" ? input.targetRoleProfileId ?? null : null,
    scopedCompetencyIds: (input.scopedCompetencyIds ?? []).filter(Boolean),
  });
  if (!res.ok) return { error: res.error };
  revalidatePath("/ac/persona/vouchers");
  return { ok: true, codes: res.codes };
}

export async function disablePersonaVoucherAction(id: string): Promise<{ ok: true } | { error: string }> {
  const g = await guard();
  if (!g.ok) return { error: g.error };
  const sb = createServiceClient();
  const { error } = await sb.from("persona_vouchers").update({ status: "disabled" }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/ac/persona/vouchers");
  return { ok: true };
}
