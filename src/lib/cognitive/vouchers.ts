import { createServiceClient } from "@/lib/supabase/server";

// ─────────────────────────────────────────────────────────────
// Cognitive Ability voucher service - generate + redeem access codes for the
// standalone Cognitive runner. Server-only (service-role). Admin generation is
// gated by the calling action; redemption is public, validated atomically via
// the cognitive_voucher_claim RPC. Mirrors src/lib/fluent/vouchers.ts.
// ─────────────────────────────────────────────────────────────

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomBlock(len: number): string {
  const bytes = new Uint8Array(len);
  globalThis.crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < len; i++) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return out;
}

/** e.g. "VIFM-COG-7K3M-9QX2". */
export function generateVoucherCode(): string {
  return `VIFM-COG-${randomBlock(4)}-${randomBlock(4)}`;
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
  const code = normalizeCode(input.code);
  if (!code) return { ok: false, error: "Enter a voucher code." };
  if (!input.redeemerName.trim() || !input.redeemerEmail.trim() || !input.companyName.trim()) {
    return { ok: false, error: "Name, email, and company are required." };
  }

  const sb = createServiceClient();
  const { data: claimed, error: claimErr } = await sb.rpc("cognitive_voucher_claim", { p_code: code });
  if (claimErr) return { ok: false, error: "Could not redeem this code. Please try again." };
  const voucher = (Array.isArray(claimed) ? claimed[0] : claimed) as ClaimedVoucher | undefined;
  if (!voucher) return { ok: false, error: "This code is invalid, expired, or fully used." };

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
    redeemer_name: input.redeemerName.trim(),
    redeemer_email: input.redeemerEmail.trim(),
    company_name: input.companyName.trim(),
    organization_id: voucher.organization_id ?? null,
    ip: input.ip ?? null,
    user_agent: input.userAgent ?? null,
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

  return { ok: true, redemptionToken: redemption.redemption_token, language };
}
