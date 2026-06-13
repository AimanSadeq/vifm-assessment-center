"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireRole, isAuthorizationError } from "@/lib/ara/auth-guards";
import { createVoucherBatch } from "@/lib/ara/vouchers";
import { createServiceClient } from "@/lib/supabase/server";

async function requireAdmin() {
  try {
    await requireRole(["admin"]);
    return null;
  } catch (e) {
    if (isAuthorizationError(e)) return { ok: false as const, error: e.message };
    throw e;
  }
}

const batchSchema = z.object({
  count: z.coerce.number().int().min(1).max(500),
  label: z.string().max(200).optional(),
  organizationId: z.string().uuid().optional(),
  clientName: z.string().max(300).optional(),
  maxUses: z.coerce.number().int().min(1).max(10000).default(1),
  region: z.enum(["uae", "saudi"]).default("uae"),
  language: z.enum(["en", "ar"]).default("en"),
  expiresAt: z.string().optional(),
});

export async function createVoucherBatchAction(formData: FormData) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const parsed = batchSchema.safeParse({
    count: formData.get("count"),
    label: formData.get("label") || undefined,
    organizationId: formData.get("organizationId") || undefined,
    clientName: formData.get("clientName") || undefined,
    maxUses: formData.get("maxUses") || 1,
    region: formData.get("region") || "uae",
    language: formData.get("language") || "en",
    expiresAt: formData.get("expiresAt") || undefined,
  });
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const caller = await requireRole(["admin"]).catch(() => null);
  const res = await createVoucherBatch({
    count: parsed.data.count,
    label: parsed.data.label ?? null,
    organizationId: parsed.data.organizationId ?? null,
    clientName: parsed.data.clientName ?? null,
    tier: "snapshot", // snapshot-only by decision; column stays flexible
    region: parsed.data.region,
    language: parsed.data.language,
    maxUses: parsed.data.maxUses,
    isPractice: true,
    expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt).toISOString() : null,
    createdBy: caller?.uid ?? null,
  });
  if (!res.ok) return res;

  revalidatePath("/ara/admin/vouchers");
  return { ok: true as const, codes: res.codes, batchId: res.batchId };
}

export async function setVoucherStatusAction(id: string, status: "active" | "disabled") {
  const denied = await requireAdmin();
  if (denied) return denied;
  const sb = createServiceClient();
  const { error } = await sb.from("ara_vouchers").update({ status }).eq("id", id);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/ara/admin/vouchers");
  return { ok: true as const };
}
