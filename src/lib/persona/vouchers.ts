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
  /** Project/cohort label (00137); groups this batch with Cognitive for reporting. */
  projectLabel?: string | null;
  /** Item format pin (00140, SD-9): 'normative' / 'ipsative' / 'both' (default). */
  itemFormat?: "normative" | "ipsative" | "both" | null;
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
  // 00137 (newest) project label - only carried when set, peeled first below.
  const projectCol = input.projectLabel?.trim() ? { project_label: input.projectLabel.trim() } : {};
  // 00140 item format - only carried when narrowed (default 'both' applies via
  // the column DEFAULT otherwise), peeled first so a pending 00140 still inserts.
  const formatCol =
    input.itemFormat === "normative" || input.itemFormat === "ipsative"
      ? { item_format: input.itemFormat }
      : {};

  // Newest-first peel: item_format (00140) -> project_label (00137) -> scope
  // (00123) -> base. Each attempt builds fresh rows (each generates its own code).
  const build = (extra: Record<string, unknown>) =>
    Array.from({ length: count }, () => ({ ...baseRow(), ...extra }));
  const attempts = [
    () => build({ ...scopeCols, ...projectCol, ...formatCol }),
    () => build({ ...scopeCols, ...projectCol }),
    () => build(scopeCols),
    () => build({}),
  ];
  let data: { code: string }[] | null = null;
  let error: { code?: string; message?: string } | null = null;
  for (const make of attempts) {
    const res = await sb.from("persona_vouchers").insert(make()).select("code");
    data = res.data as { code: string }[] | null;
    error = res.error;
    if (!error) break;
    if (!isMissingColumnError(error)) break;
  }
  if (error) return { ok: false, error: error.message ?? "Could not create vouchers." };
  return { ok: true, batchId, codes: (data ?? []).map((r) => r.code as string) };
}

export type VoucherScope = {
  /** null = unpinned (legacy voucher) - the candidate picks purpose/role. */
  purpose: "development" | "hiring" | null;
  targetRoleProfileId: string | null;
  /** null/empty = full bank; non-empty = serve only these competencies. */
  scopedCompetencyIds: string[] | null;
  /** Pinned item format (00140); null = candidate chooses (default 'both'). */
  itemFormat: "normative" | "ipsative" | "both" | null;
};

/**
 * The admin-pinned scope for the voucher behind a redemption token (00123).
 * Read server-side so the candidate runner + session always derive scope from
 * the voucher, never from client input. Tolerant: returns an all-null
 * (unpinned) scope when 00123 isn't applied or anything is missing.
 */
export async function getVoucherScopeByRedemptionToken(token: string): Promise<VoucherScope> {
  const unpinned: VoucherScope = { purpose: null, targetRoleProfileId: null, scopedCompetencyIds: null, itemFormat: null };
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
    // item_format (00140) read separately so a pending migration can't drop the
    // scope above (mirrors the project_label pattern in the start action).
    let itemFormat: "normative" | "ipsative" | "both" | null = null;
    try {
      const { data: f } = await sb
        .from("persona_vouchers")
        .select("item_format")
        .eq("id", red.voucher_id)
        .maybeSingle<{ item_format: string | null }>();
      if (f?.item_format === "normative" || f?.item_format === "ipsative" || f?.item_format === "both") {
        itemFormat = f.item_format;
      }
    } catch {
      /* 00140 not applied - leave null (candidate default 'both') */
    }
    return {
      purpose: v.purpose === "hiring" || v.purpose === "development" ? v.purpose : null,
      targetRoleProfileId: v.target_role_profile_id ?? null,
      scopedCompetencyIds: scoped && scoped.length > 0 ? scoped : null,
      itemFormat,
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

  // Project label (00137) rides voucher -> redemption -> session, mirroring
  // organization_id. The claim RPC doesn't return it, so read it separately
  // (tolerant of 00137 not applied).
  let projectLabel: string | null = null;
  try {
    const { data: vRow } = await sb
      .from("persona_vouchers")
      .select("project_label")
      .eq("id", voucher.id)
      .maybeSingle<{ project_label: string | null }>();
    projectLabel = vRow?.project_label ?? null;
  } catch {
    projectLabel = null;
  }

  const redemptionBase = {
    voucher_id: voucher.id,
    redeemer_name: input.redeemerName.trim(),
    redeemer_email: input.redeemerEmail.trim(),
    company_name: input.companyName.trim(),
    organization_id: voucher.organization_id ?? null,
    ip: input.ip ?? null,
    user_agent: input.userAgent ?? null,
  };
  let { data: redemption, error: redErr } = await sb
    .from("persona_voucher_redemptions")
    .insert(projectLabel ? { ...redemptionBase, project_label: projectLabel } : redemptionBase)
    .select("redemption_token")
    .single<{ redemption_token: string }>();
  // Tolerant of 00137 not applied on the redemptions table: retry without it.
  if (redErr && projectLabel && isMissingColumnError(redErr)) {
    ({ data: redemption, error: redErr } = await sb
      .from("persona_voucher_redemptions")
      .insert(redemptionBase)
      .select("redemption_token")
      .single<{ redemption_token: string }>());
  }
  if (redErr || !redemption) {
    // The seat was already claimed atomically above; hand it back so a failed
    // redemption doesn't permanently burn a use (tolerant if 00157 isn't applied).
    try {
      await sb.rpc("persona_voucher_release_seat", { p_code: code });
    } catch {
      /* release RPC not migrated yet - seat stays claimed (pre-00157 behaviour) */
    }
    return { ok: false, error: "Could not start your assessment. Please try again." };
  }

  return { ok: true, redemptionToken: redemption.redemption_token, language };
}
