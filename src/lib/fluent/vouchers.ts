import { createServiceClient } from "@/lib/supabase/server";

// ─────────────────────────────────────────────────────────────
// Fluent voucher service - generate + redeem English-placement
// access codes. Server-only (service-role client). Admin generation is
// gated by the calling server action; redemption is public and validated
// atomically via the eng_fluent_voucher_claim RPC. Mirrors the ARC voucher
// service (src/lib/ara/vouchers.ts).
// ─────────────────────────────────────────────────────────────

// Unambiguous charset (no 0/O/1/I) for human-typed codes.
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomBlock(len: number): string {
  const bytes = new Uint8Array(len);
  globalThis.crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < len; i++) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return out;
}

/** Human-friendly, unguessable code, e.g. "VIFM-ENG-7K3M-9QX2". */
export function generateVoucherCode(): string {
  return `VIFM-ENG-${randomBlock(4)}-${randomBlock(4)}`;
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
  /** When true, candidates redeeming this voucher are camera-proctored (migration 00149). */
  proctorEnabled?: boolean;
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
    expires_at: input.expiresAt ?? null,
    created_by: input.createdBy ?? null,
    proctor_enabled: input.proctorEnabled ?? false,
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
  const code = normalizeCode(input.code);
  if (!code) return { ok: false, error: "Enter a voucher code." };
  if (!input.redeemerName.trim() || !input.redeemerEmail.trim() || !input.companyName.trim()) {
    return { ok: false, error: "Name, email, and company are required." };
  }

  const sb = createServiceClient();

  const { data: claimed, error: claimErr } = await sb.rpc("eng_fluent_voucher_claim", { p_code: code });
  if (claimErr) return { ok: false, error: "Could not redeem this code. Please try again." };
  const voucher = (Array.isArray(claimed) ? claimed[0] : claimed) as ClaimedVoucher | undefined;
  if (!voucher) return { ok: false, error: "This code is invalid, expired, or fully used." };

  const language = voucher.default_language === "ar" ? "ar" : "en";

  const { data: redemption, error: redErr } = await sb
    .from("eng_fluent_voucher_redemptions")
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
  if (redErr || !redemption) return { ok: false, error: "Could not start your test. Please try again." };

  return { ok: true, redemptionToken: redemption.redemption_token, language };
}
