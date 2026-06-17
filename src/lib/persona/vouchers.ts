import { createServiceClient } from "@/lib/supabase/server";

// ─────────────────────────────────────────────────────────────
// Persona voucher service - generate + redeem access codes for the standalone
// Persona behavioural self-assessment. Server-only. Mirrors the Cognitive/Fluent
// services; validated atomically via the persona_voucher_claim RPC.
// ─────────────────────────────────────────────────────────────

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomBlock(len: number): string {
  const bytes = new Uint8Array(len);
  globalThis.crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < len; i++) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return out;
}

/** e.g. "VIFM-PER-7K3M-9QX2". */
export function generateVoucherCode(): string {
  return `VIFM-PER-${randomBlock(4)}-${randomBlock(4)}`;
}

export function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
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
  /** Admin-pinned scope (00123). purpose null = legacy/unpinned (candidate picks). */
  purpose?: "development" | "hiring" | null;
  targetRoleProfileId?: string | null;
  /** Competency scope; null/empty = full bank, non-empty = serve only these. */
  scopedCompetencyIds?: string[] | null;
};

/** Undefined column - migration 00123 not applied yet. Postgres raises 42703
 *  on a read; PostgREST raises PGRST204 on a write (schema-cache miss). */
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
  const scoped = (input.scopedCompetencyIds ?? []).filter(Boolean);
  const scopeCols = {
    purpose: input.purpose ?? null,
    target_role_profile_id: input.targetRoleProfileId ?? null,
    scoped_competency_ids: scoped.length > 0 ? scoped : null,
  };

  const rows = Array.from({ length: count }, () => ({ ...baseRow(), ...scopeCols }));
  let { data, error } = await sb.from("persona_vouchers").insert(rows).select("code");
  // Tolerant of migration 00123 not applied: insert without the scope columns.
  if (error && isMissingColumnError(error)) {
    const plainRows = Array.from({ length: count }, () => baseRow());
    ({ data, error } = await sb.from("persona_vouchers").insert(plainRows).select("code"));
  }
  if (error) return { ok: false, error: error.message };
  return { ok: true, batchId, codes: (data ?? []).map((r) => r.code as string) };
}

export type VoucherScope = {
  /** null = unpinned (legacy voucher) - the candidate picks purpose/role. */
  purpose: "development" | "hiring" | null;
  targetRoleProfileId: string | null;
  /** null/empty = full bank; non-empty = serve only these competencies. */
  scopedCompetencyIds: string[] | null;
};

/**
 * The admin-pinned scope for the voucher behind a redemption token (00123).
 * Read server-side so the candidate runner + session always derive scope from
 * the voucher, never from client input. Tolerant: returns an all-null
 * (unpinned) scope when 00123 isn't applied or anything is missing.
 */
export async function getVoucherScopeByRedemptionToken(token: string): Promise<VoucherScope> {
  const unpinned: VoucherScope = { purpose: null, targetRoleProfileId: null, scopedCompetencyIds: null };
  try {
    const sb = createServiceClient();
    const { data: red } = await sb
      .from("persona_voucher_redemptions")
      .select("voucher_id")
      .eq("redemption_token", token)
      .maybeSingle<{ voucher_id: string }>();
    if (!red?.voucher_id) return unpinned;
    const { data: v, error } = await sb
      .from("persona_vouchers")
      .select("purpose, target_role_profile_id, scoped_competency_ids")
      .eq("id", red.voucher_id)
      .maybeSingle<{
        purpose: string | null;
        target_role_profile_id: string | null;
        scoped_competency_ids: string[] | null;
      }>();
    if (error || !v) return unpinned;
    const scoped = Array.isArray(v.scoped_competency_ids) ? v.scoped_competency_ids.filter(Boolean) : null;
    return {
      purpose: v.purpose === "hiring" || v.purpose === "development" ? v.purpose : null,
      targetRoleProfileId: v.target_role_profile_id ?? null,
      scopedCompetencyIds: scoped && scoped.length > 0 ? scoped : null,
    };
  } catch {
    return unpinned;
  }
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
  const code = normalizeCode(input.code);
  if (!code) return { ok: false, error: "Enter a voucher code." };
  if (!input.redeemerName.trim() || !input.redeemerEmail.trim() || !input.companyName.trim()) {
    return { ok: false, error: "Name, email, and company are required." };
  }

  const sb = createServiceClient();
  const { data: claimed, error: claimErr } = await sb.rpc("persona_voucher_claim", { p_code: code });
  if (claimErr) return { ok: false, error: "Could not redeem this code. Please try again." };
  const voucher = (Array.isArray(claimed) ? claimed[0] : claimed) as ClaimedVoucher | undefined;
  if (!voucher) return { ok: false, error: "This code is invalid, expired, or fully used." };

  const language = voucher.default_language === "ar" ? "ar" : "en";

  const { data: redemption, error: redErr } = await sb
    .from("persona_voucher_redemptions")
    .insert({
      voucher_id: voucher.id,
      redeemer_name: input.redeemerName.trim(),
      redeemer_email: input.redeemerEmail.trim(),
      company_name: input.companyName.trim(),
      organization_id: voucher.organization_id ?? null,
      ip: input.ip ?? null,
      user_agent: input.userAgent ?? null,
    })
    .select("redemption_token")
    .single<{ redemption_token: string }>();
  if (redErr || !redemption) return { ok: false, error: "Could not start your assessment. Please try again." };

  return { ok: true, redemptionToken: redemption.redemption_token, language };
}
