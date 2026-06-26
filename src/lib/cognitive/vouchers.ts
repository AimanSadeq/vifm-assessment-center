import { createServiceClient } from "@/lib/supabase/server";
import { makeVoucherCode } from "@/lib/vouchers/codegen";
import { redeemViaDescriptor } from "@/lib/vouchers/core";
import { VOUCHER_DESCRIPTORS } from "@/lib/vouchers/descriptor";

// ─────────────────────────────────────────────────────────────
// Cognitive Ability voucher service - generate + redeem access codes for the
// standalone Cognitive runner. Server-only (service-role). Admin generation is
// gated by the calling action; redemption is public, validated atomically via
// the cognitive_voucher_claim RPC. Redeem now delegates to the SHARED voucher
// core (src/lib/vouchers/core.ts) - claim + compensate live there once;
// code-gen + normalize are shared too. (Phase 1 proof of the consolidation.)
// ─────────────────────────────────────────────────────────────

export { normalizeCode } from "@/lib/vouchers/codegen";

/** e.g. "VIFM-COG-7K3M-9QX2" (shared codegen). */
export function generateVoucherCode(): string {
  return makeVoucherCode("COG");
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
  /** Project/cohort label (00137); groups this batch with Persona for reporting. */
  projectLabel?: string | null;
};

/** Undefined column - migration 00137 (project_label) not applied yet. Postgres
 *  raises 42703 on a read; PostgREST raises PGRST204 on a write (schema-cache miss). */
function isMissingColumnError(err: { code?: string } | null): boolean {
  return err?.code === "42703" || err?.code === "PGRST204";
}

export async function createVoucherBatch(
  input: CreateBatchInput,
): Promise<{ ok: true; batchId: string; codes: string[] } | { ok: false; error: string }> {
  const count = Math.max(1, Math.min(500, Math.floor(input.count)));
  const sb = createServiceClient();
  const batchId = globalThis.crypto.randomUUID();

  const baseRow = () => ({
    code: generateVoucherCode(),
    label: input.label ?? null,
    batch_id: batchId,
    organization_id: input.organizationId ?? null,
    client_name: input.clientName ?? null,
    default_language: input.language ?? "en",
    max_uses: Math.max(1, input.maxUses ?? 1),
    expires_at: input.expiresAt ?? null,
    created_by: input.createdBy ?? null,
  });
  // 00137 (newest) project label - only carried when set, peeled first below.
  const projectCol = input.projectLabel?.trim() ? { project_label: input.projectLabel.trim() } : {};

  // Newest-first peel: project_label (00137) -> base. Each attempt builds fresh
  // rows (each row generates its own code).
  const build = (extra: Record<string, unknown>) =>
    Array.from({ length: count }, () => ({ ...baseRow(), ...extra }));
  const attempts = [() => build(projectCol), () => build({})];
  let data: { code: string }[] | null = null;
  let error: { code?: string; message?: string } | null = null;
  for (const make of attempts) {
    const res = await sb.from("cognitive_vouchers").insert(make()).select("code");
    data = res.data as { code: string }[] | null;
    error = res.error;
    if (!error) break;
    if (!isMissingColumnError(error)) break;
  }
  if (error) return { ok: false, error: error.message ?? "Could not create vouchers." };
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

export async function redeemVoucher(
  input: RedeemInput,
): Promise<{ ok: true; redemptionToken: string; language: "en" | "ar" } | { ok: false; error: string }> {
  // Validate up front so an invalid form never claims (then releases) a seat.
  if (!input.code.trim()) return { ok: false, error: "Enter a voucher code." };
  if (!input.redeemerName.trim() || !input.redeemerEmail.trim() || !input.companyName.trim()) {
    return { ok: false, error: "Name, email, and company are required." };
  }

  // Claim + compensate-on-failure handled by the shared core; the cognitive-
  // specific work (project-label carry + redemption record) is the provision step.
  const out = await redeemViaDescriptor<ClaimedVoucher>(
    VOUCHER_DESCRIPTORS.cognitive,
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

      // Project label (00137) rides voucher -> redemption -> result, mirroring
      // organization_id. The claim RPC doesn't return it, so read it separately
      // (tolerant of 00137 not applied).
      let projectLabel: string | null = null;
      try {
        const { data: vRow } = await sb
          .from("cognitive_vouchers")
          .select("project_label")
          .eq("id", voucher.id)
          .maybeSingle<{ project_label: string | null }>();
        projectLabel = vRow?.project_label ?? null;
      } catch {
        projectLabel = null;
      }

      const redemptionBase = {
        voucher_id: voucher.id,
        redeemer_name: redeemer.redeemerName.trim(),
        redeemer_email: redeemer.redeemerEmail.trim(),
        company_name: (redeemer.companyName ?? "").trim(),
        organization_id: voucher.organization_id ?? null,
        ip: redeemer.ip ?? null,
        user_agent: redeemer.userAgent ?? null,
      };
      let { data: redemption, error: redErr } = await sb
        .from("cognitive_voucher_redemptions")
        .insert(projectLabel ? { ...redemptionBase, project_label: projectLabel } : redemptionBase)
        .select("redemption_token")
        .single<{ redemption_token: string }>();
      // Tolerant of 00137 not applied on the redemptions table: retry without it.
      if (redErr && projectLabel && isMissingColumnError(redErr)) {
        ({ data: redemption, error: redErr } = await sb
          .from("cognitive_voucher_redemptions")
          .insert(redemptionBase)
          .select("redemption_token")
          .single<{ redemption_token: string }>());
      }
      if (redErr || !redemption) return { ok: false, error: "Could not start your test. Please try again." };
      return { ok: true, token: redemption.redemption_token, language };
    },
  );

  if (!out.ok) return { ok: false, error: out.error };
  return { ok: true, redemptionToken: out.token as string, language: out.language as "en" | "ar" };
}
