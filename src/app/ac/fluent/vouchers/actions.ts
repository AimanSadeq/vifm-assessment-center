"use server";

import { revalidatePath } from "next/cache";
import { requireRole, isAuthorizationError } from "@/lib/ara/auth-guards";
import { createServiceClient } from "@/lib/supabase/server";
import { createVoucherBatch } from "@/lib/fluent/vouchers";
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

export async function generateFluentVouchersAction(input: {
  count: number;
  label?: string;
  clientName?: string;
  language?: "en" | "ar";
  maxUses?: number;
  expiresAt?: string | null;
}): Promise<{ ok: true; codes: string[] } | { error: string }> {
  const g = await guard();
  if (!g.ok) return { error: g.error };

  // Register the tagged client first-class via the shared registry so the
  // voucher's org is a real, cross-service platform client (not a loose string).
  let organizationId: string | null = null;
  const clientName = input.clientName?.trim() || null;
  if (clientName) {
    try {
      const reg = await createClientOrganization({ name: clientName, createdBy: g.caller.isDev ? null : g.caller.uid });
      if (reg.ok) organizationId = reg.organizationId;
    } catch {
      /* registry hiccup - keep the denormalized client_name tag */
    }
  }

  const res = await createVoucherBatch({
    count: input.count,
    label: input.label?.trim() || null,
    organizationId,
    clientName,
    language: input.language === "ar" ? "ar" : "en",
    maxUses: Math.max(1, input.maxUses ?? 1),
    expiresAt: input.expiresAt || null,
    createdBy: g.caller.isDev ? null : g.caller.uid,
  });
  if (!res.ok) return { error: res.error };
  revalidatePath("/ac/fluent/vouchers");
  return { ok: true, codes: res.codes };
}

export async function disableFluentVoucherAction(id: string): Promise<{ ok: true } | { error: string }> {
  const g = await guard();
  if (!g.ok) return { error: g.error };
  const sb = createServiceClient();
  const { error } = await sb.from("eng_fluent_vouchers").update({ status: "disabled" }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/ac/fluent/vouchers");
  return { ok: true };
}
