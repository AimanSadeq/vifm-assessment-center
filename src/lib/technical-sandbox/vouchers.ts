// ─────────────────────────────────────────────────────────────
// Technical sandbox voucher service (server-only). Mirrors the ARC
// voucher flow: admin generates a batch of codes bound to one function;
// a delegate redeems a code (name + email + company), which atomically
// consumes a seat (technical_sandbox_voucher_claim RPC), provisions a
// technical_sandbox_session, records the redemption, and returns the
// session token so the delegate proceeds to /tech-sandbox/{token}.
// ─────────────────────────────────────────────────────────────
import { createServiceClient } from "@/lib/supabase/server";
import { createSession } from "./service";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I

function randomBlock(len: number): string {
  const bytes = new Uint8Array(len);
  globalThis.crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < len; i++) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return out;
}
export function generateVoucherCode(): string {
  return `VIFM-TECH-${randomBlock(4)}-${randomBlock(4)}`;
}
export function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}

export interface GenerateBatchInput {
  functionId: string;
  count: number;
  organizationName?: string | null;
  label?: string | null;
  maxUsesPerCode?: number; // 1 = single-use codes (default), >1 = seat-pool code
  expiresAt?: string | null;
  createdBy?: string | null;
}

/** Generate a batch of voucher codes for one function. Returns the codes. */
export async function generateVoucherBatch(input: GenerateBatchInput) {
  const sb = createServiceClient();
  const count = Math.max(1, Math.min(500, Math.floor(input.count)));
  const maxUses = Math.max(1, Math.floor(input.maxUsesPerCode ?? 1));
  const batchId = crypto.randomUUID();
  const rows = Array.from({ length: count }, () => ({
    code: generateVoucherCode(),
    label: input.label ?? null,
    batch_id: batchId,
    function_id: input.functionId,
    organization_name: input.organizationName ?? null,
    max_uses: maxUses,
    expires_at: input.expiresAt ?? null,
    created_by: input.createdBy ?? null,
  }));
  const { data, error } = await sb
    .from("technical_sandbox_vouchers")
    .insert(rows)
    .select("code");
  if (error) throw error;
  return { batchId, codes: (data ?? []).map((r) => r.code as string) };
}

export interface RedeemInput {
  code: string;
  name: string;
  email: string;
  company: string;
  ip?: string;
  userAgent?: string;
}
export type RedeemResult =
  | { ok: true; token: string }
  | { ok: false; error: string };

/** Redeem a code: claim a seat, provision a session, return its token. */
export async function redeemVoucher(input: RedeemInput): Promise<RedeemResult> {
  const sb = createServiceClient();
  const code = normalizeCode(input.code);
  if (!code) return { ok: false, error: "Enter a voucher code." };
  if (!input.name?.trim() || !input.email?.trim() || !input.company?.trim()) {
    return { ok: false, error: "Name, email and company are required." };
  }

  const { data: claimed, error: claimErr } = await sb.rpc(
    "technical_sandbox_voucher_claim",
    { p_code: code },
  );
  if (claimErr) return { ok: false, error: claimErr.message };
  const voucher = Array.isArray(claimed) ? claimed[0] : claimed;
  if (!voucher) {
    return { ok: false, error: "This code is invalid, disabled, expired, or fully used." };
  }

  try {
    const { id: sessionId, accessToken } = await createSession({
      functionId: voucher.function_id as string,
      candidateName: input.name.trim(),
      candidateEmail: input.email.trim(),
      organizationName: (input.company || voucher.organization_name || "").trim() || undefined,
    });
    await sb.from("technical_sandbox_voucher_redemptions").insert({
      voucher_id: voucher.id,
      redeemer_name: input.name.trim(),
      redeemer_email: input.email.trim(),
      company_name: input.company.trim(),
      session_id: sessionId,
      ip: input.ip ?? null,
      user_agent: input.userAgent ?? null,
    });
    return { ok: true, token: accessToken };
  } catch (e) {
    // Roll the seat back so a provisioning failure doesn't burn a seat.
    await sb.rpc("technical_sandbox_voucher_release", { p_id: voucher.id }).then(
      () => undefined,
      () => undefined,
    );
    return { ok: false, error: e instanceof Error ? e.message : "Could not provision the assessment." };
  }
}

export interface VoucherRow {
  id: string;
  code: string;
  label: string | null;
  organizationName: string | null;
  functionId: string;
  maxUses: number;
  usedCount: number;
  status: string;
  expiresAt: string | null;
  batchId: string | null;
  createdAt: string;
}

/** List vouchers (admin), newest first. */
export async function listVouchers(): Promise<VoucherRow[]> {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from("technical_sandbox_vouchers")
    .select("id, code, label, organization_name, function_id, max_uses, used_count, status, expires_at, batch_id, created_at")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw error;
  return (data ?? []).map((v) => ({
    id: v.id,
    code: v.code,
    label: v.label,
    organizationName: v.organization_name,
    functionId: v.function_id,
    maxUses: v.max_uses,
    usedCount: v.used_count,
    status: v.status,
    expiresAt: v.expires_at,
    batchId: v.batch_id,
    createdAt: v.created_at,
  }));
}

export async function setVoucherStatus(id: string, status: "active" | "disabled") {
  const sb = createServiceClient();
  const { error } = await sb.from("technical_sandbox_vouchers").update({ status }).eq("id", id);
  if (error) throw error;
}
