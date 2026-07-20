import { createServiceClient } from "@/lib/supabase/server";
import { makeVoucherCode } from "@/lib/vouchers/codegen";
import { redeemViaDescriptor } from "@/lib/vouchers/core";
import { VOUCHER_DESCRIPTORS } from "@/lib/vouchers/descriptor";
import { normalizeVoucherExpiry } from "@/lib/vouchers/expiry";

// ─────────────────────────────────────────────────────────────
// Fluent voucher service - generate + redeem English-placement access codes.
// Server-only (service-role client). Redeem delegates to the SHARED voucher
// core (src/lib/vouchers/core.ts) - claim + compensate-on-failure live there
// once; code-gen + normalize are shared too. (Voucher consolidation.)
// ─────────────────────────────────────────────────────────────

export { normalizeCode } from "@/lib/vouchers/codegen";

/** Human-friendly, unguessable code, e.g. "VIFM-ENG-7K3M-9QX2" (shared codegen). */
export function generateVoucherCode(): string {
  return makeVoucherCode("ENG");
}

export type CreateBatchInput = {
  count: number;
  label?: string | null;
  organizationId?: string | null;
  clientName?: string | null;
  language?: "en" | "ar";
  maxUses?: number;
  expiresAt?: string | null;
  createdBy?: string | null;
  /** When true, candidates redeeming this voucher are camera-proctored (migration 00149). */
  proctorEnabled?: boolean;
  contactName?: string | null;
  contactTitle?: string | null;
  contactEmail?: string | null;
};

export async function createVoucherBatch(
  input: CreateBatchInput,
): Promise<{ ok: true; batchId: string; codes: string[] } | { ok: false; error: string }> {
  const count = Math.max(1, Math.min(500, Math.floor(input.count)));
  const sb = createServiceClient();
  const batchId = globalThis.crypto.randomUUID();

  const rows = Array.from({ length: count }, () => ({
    code: generateVoucherCode(),
    label: input.label ?? null,
    batch_id: batchId,
    organization_id: input.organizationId ?? null,
    client_name: input.clientName ?? null,
    default_language: input.language ?? "en",
    max_uses: Math.max(1, input.maxUses ?? 1),
    expires_at: normalizeVoucherExpiry(input.expiresAt),
    created_by: input.createdBy ?? null,
    proctor_enabled: input.proctorEnabled ?? false,
    contact_name: input.contactName ?? null,
    contact_title: input.contactTitle ?? null,
    contact_email: input.contactEmail ?? null,
  }));

  const { data, error } = await sb.from("eng_fluent_vouchers").insert(rows).select("code");
  if (error) return { ok: false, error: error.message };
  return { ok: true, batchId, codes: (data ?? []).map((r) => r.code as string) };
}

export type RedeemInput = {
  code: string;
  redeemerName: string;
  redeemerEmail: string;
  companyName: string;
  ip?: string | null;
  userAgent?: string | null;
};

type ClaimedVoucher = {
  id: string;
  organization_id: string | null;
  client_name: string | null;
  default_language: string;
};

/**
 * Redeem a voucher: atomically claim a seat, record the redemption (with the
 * required company name + the voucher's tagged org), and return a redemption
 * token. The runner carries `?redemption=<token>`; on completion the score
 * route stamps the result with the org + this redemption.
 */
export async function redeemVoucher(
  input: RedeemInput,
): Promise<{ ok: true; redemptionToken: string; language: "en" | "ar" } | { ok: false; error: string }> {
  // Validate up front so an invalid form never claims (then releases) a seat.
  if (!input.code.trim()) return { ok: false, error: "Enter a voucher code." };
  if (!input.redeemerName.trim() || !input.redeemerEmail.trim() || !input.companyName.trim()) {
    return { ok: false, error: "Name, email, and company are required." };
  }

  // Claim + compensate-on-failure handled by the shared core; the Fluent-specific
  // work (record the redemption) is the provision step.
  const out = await redeemViaDescriptor<ClaimedVoucher>(
    VOUCHER_DESCRIPTORS.fluent,
    {
      code: input.code,
      redeemerName: input.redeemerName,
      redeemerEmail: input.redeemerEmail,
      companyName: input.companyName,
      ip: input.ip,
      userAgent: input.userAgent,
    },
    async ({ sb, voucher, redeemer }) => {
      const language = voucher.default_language === "ar" ? "ar" : "en";
      const { data: redemption, error: redErr } = await sb
        .from("eng_fluent_voucher_redemptions")
        .insert({
          voucher_id: voucher.id,
          redeemer_name: redeemer.redeemerName.trim(),
          redeemer_email: redeemer.redeemerEmail.trim(),
          company_name: (redeemer.companyName ?? "").trim(),
          organization_id: voucher.organization_id ?? null,
          ip: redeemer.ip ?? null,
          user_agent: redeemer.userAgent ?? null,
        })
        .select("redemption_token")
        .single<{ redemption_token: string }>();
      if (redErr || !redemption) return { ok: false, error: "Could not start your test. Please try again." };
      return { ok: true, token: redemption.redemption_token, language };
    },
  );

  if (!out.ok) return { ok: false, error: out.error };
  return { ok: true, redemptionToken: out.token as string, language: out.language as "en" | "ar" };
}
