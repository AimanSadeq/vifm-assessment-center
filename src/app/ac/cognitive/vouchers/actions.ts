"use server";

import { revalidatePath } from "next/cache";
import { requireRole, isAuthorizationError } from "@/lib/ara/auth-guards";
import { createServiceClient } from "@/lib/supabase/server";
import { createVoucherBatch } from "@/lib/cognitive/vouchers";
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

export async function generateCognitiveVouchersAction(input: {
  count: number;
  label?: string;
  clientName?: string;
  maxUses?: number;
  expiresAt?: string | null;
}): Promise<{ ok: true; codes: string[] } | { error: string }> {
  const g = await guard();
  if (!g.ok) return { error: g.error };

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
  });
  if (!res.ok) return { error: res.error };
  revalidatePath("/ac/cognitive/vouchers");
  return { ok: true, codes: res.codes };
}

export async function disableCognitiveVoucherAction(id: string): Promise<{ ok: true } | { error: string }> {
  const g = await guard();
  if (!g.ok) return { error: g.error };
  const sb = createServiceClient();
  const { error } = await sb.from("cognitive_vouchers").update({ status: "disabled" }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/ac/cognitive/vouchers");
  return { ok: true };
}
