"use server";

import { requireRole } from "@/lib/ara/auth-guards";
import { generatePrehireVoucherBatch, disablePrehireVoucher } from "@/lib/prehire/vouchers";

export async function createPrehireVoucherBatchAction(input: {
  requisitionId: string;
  label?: string;
  count: number;
  seatsPerCode: number;
  expiresAt?: string | null;
  organizationName?: string | null;
}): Promise<{ ok: true; created: number } | { ok: false; error: string }> {
  await requireRole(["admin"]);
  try {
    if (!input.requisitionId) return { ok: false, error: "Pick a requisition first." };
    const rows = await generatePrehireVoucherBatch({
      requisitionId: input.requisitionId,
      count: input.count,
      maxUsesPerCode: input.seatsPerCode,
      label: input.label,
      expiresAt: input.expiresAt ?? null,
      organizationName: input.organizationName ?? null,
    });
    return { ok: true, created: rows.length };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not create vouchers." };
  }
}

export async function disablePrehireVoucherAction(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireRole(["admin"]);
  try {
    await disablePrehireVoucher(id);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not disable the voucher." };
  }
}
