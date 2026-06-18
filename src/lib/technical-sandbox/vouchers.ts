// ─────────────────────────────────────────────────────────────
// Technical sandbox voucher service (server-only). Mirrors the ARC
// voucher flow: admin generates a batch of codes bound to one function;
// a delegate redeems a code (name + email + company), which atomically
// consumes a seat (technical_sandbox_voucher_claim RPC), provisions a
// technical_sandbox_session, records the redemption, and returns the
// session token so the delegate proceeds to /tech-sandbox/{token}.
// ─────────────────────────────────────────────────────────────
import { createServiceClient } from "@/lib/supabase/server";
import { createSession, isMissingSchemaError } from "./service";

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

export interface Delegate {
  name: string;
  email: string;
}
export interface GenerateBatchInput {
  functionId: string;
  count: number;
  organizationName?: string | null;
  label?: string | null;
  maxUsesPerCode?: number; // 1 = single-use codes (default), >1 = seat-pool code
  expiresAt?: string | null;
  createdBy?: string | null;
  /** When provided, generate ONE named single-use code per delegate. */
  delegates?: Delegate[] | null;
  /** MCQ section weight (0-100) for sittings redeemed from this batch. 0 = sandbox-only. */
  mcqPct?: number | null;
  /** Talent lens (00136) copied onto the session at redemption. NULL = development. */
  talentLens?: "acquisition" | "development" | null;
}

/** Clamp a possibly-undefined MCQ weight into the 0-100 column range. */
function clampMcqPct(v: number | null | undefined): number {
  if (typeof v !== "number" || !Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(100, Math.round(v)));
}
export interface GeneratedAssignment {
  name: string;
  email: string;
  code: string;
}

/** Generate a batch of voucher codes for one function. Returns codes + (if named) assignments. */
export async function generateVoucherBatch(input: GenerateBatchInput) {
  const sb = createServiceClient();
  const batchId = crypto.randomUUID();
  const delegates = (input.delegates ?? []).filter((d) => d.name?.trim() && d.email?.trim());
  const mcqPct = clampMcqPct(input.mcqPct);
  const lens =
    input.talentLens === "acquisition" || input.talentLens === "development"
      ? input.talentLens
      : null;
  // Only carry talent_lens when set, so a NULL lens never references the 00136
  // column (no PGRST204 on a pending-00136 DB) and the peel below stays a no-op.
  const lensCol: Record<string, unknown> = lens ? { talent_lens: lens } : {};

  let rows: Record<string, unknown>[];
  if (delegates.length > 0) {
    // One named, single-use code per delegate.
    rows = delegates.slice(0, 1000).map((d) => ({
      code: generateVoucherCode(),
      label: input.label ?? null,
      batch_id: batchId,
      function_id: input.functionId,
      organization_name: input.organizationName ?? null,
      max_uses: 1,
      assigned_name: d.name.trim(),
      assigned_email: d.email.trim(),
      expires_at: input.expiresAt ?? null,
      created_by: input.createdBy ?? null,
      mcq_pct: mcqPct,
      ...lensCol,
    }));
  } else {
    const count = Math.max(1, Math.min(500, Math.floor(input.count)));
    const maxUses = Math.max(1, Math.floor(input.maxUsesPerCode ?? 1));
    rows = Array.from({ length: count }, () => ({
      code: generateVoucherCode(),
      label: input.label ?? null,
      batch_id: batchId,
      function_id: input.functionId,
      organization_name: input.organizationName ?? null,
      max_uses: maxUses,
      expires_at: input.expiresAt ?? null,
      created_by: input.createdBy ?? null,
      mcq_pct: mcqPct,
      ...lensCol,
    }));
  }

  // Newest-first peel: drop talent_lens (00136) then mcq_pct (00085) on a
  // missing-column error so a pending migration degrades gracefully.
  const stripLens = (r: Record<string, unknown>) => {
    const { talent_lens, ...rest } = r;
    void talent_lens;
    return rest;
  };
  const stripLensMcq = (r: Record<string, unknown>) => {
    const { talent_lens, mcq_pct, ...rest } = r;
    void talent_lens;
    void mcq_pct;
    return rest;
  };
  const attempts = [rows, rows.map(stripLens), rows.map(stripLensMcq)];
  type VoucherInsertRow = { code: string; assigned_name: string | null; assigned_email: string | null };
  let data: VoucherInsertRow[] | null = null;
  let error: { code?: string } | null = null;
  for (const attemptRows of attempts) {
    const res = await sb
      .from("technical_sandbox_vouchers")
      .insert(attemptRows)
      .select("code, assigned_name, assigned_email");
    data = res.data as VoucherInsertRow[] | null;
    error = res.error;
    if (!error) break;
    if (!isMissingSchemaError(error)) break;
  }
  if (error) throw error;
  const codes = (data ?? []).map((r) => r.code as string);
  const assignments: GeneratedAssignment[] = (data ?? [])
    .filter((r) => r.assigned_email)
    .map((r) => ({ name: r.assigned_name as string, email: r.assigned_email as string, code: r.code as string }));
  return { batchId, codes, assignments };
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

  // The claim RPC doesn't return mcq_pct / talent_lens; read them separately
  // (tolerant of 00085 / 00136 not applied - legacy vouchers have no MCQ section
  // i.e. mcq_pct 0, and a NULL lens = development framing).
  let mcqPct = 0;
  let talentLens: "acquisition" | "development" | null = null;
  try {
    const { data: vRow, error: vErr } = await sb
      .from("technical_sandbox_vouchers")
      .select("mcq_pct, talent_lens")
      .eq("id", voucher.id as string)
      .maybeSingle<{ mcq_pct: number | null; talent_lens: string | null }>();
    if (vErr) throw vErr;
    mcqPct = clampMcqPct(vRow?.mcq_pct ?? 0);
    const rawLens = vRow?.talent_lens;
    talentLens = rawLens === "acquisition" || rawLens === "development" ? rawLens : null;
  } catch {
    // 00136 pending: re-read mcq_pct alone so the MCQ section still works.
    try {
      const { data: vRow } = await sb
        .from("technical_sandbox_vouchers")
        .select("mcq_pct")
        .eq("id", voucher.id as string)
        .maybeSingle<{ mcq_pct: number | null }>();
      mcqPct = clampMcqPct(vRow?.mcq_pct ?? 0);
    } catch {
      mcqPct = 0;
    }
    talentLens = null;
  }

  try {
    const { id: sessionId, accessToken } = await createSession({
      functionId: voucher.function_id as string,
      candidateName: input.name.trim(),
      candidateEmail: input.email.trim(),
      organizationName: (input.company || voucher.organization_name || "").trim() || undefined,
      mcqPct,
      talentLens,
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
  assignedName: string | null;
  assignedEmail: string | null;
  createdAt: string;
}

// Columns common to every voucher row; assigned_name/assigned_email (migration
// 00079) are appended only when present so a pending 00079 degrades gracefully.
const VOUCHER_BASE_COLS =
  "id, code, label, organization_name, function_id, max_uses, used_count, status, expires_at, batch_id, created_at";

function mapVoucher(v: Record<string, unknown>): VoucherRow {
  return {
    id: v.id as string,
    code: v.code as string,
    label: (v.label as string) ?? null,
    organizationName: (v.organization_name as string) ?? null,
    functionId: v.function_id as string,
    maxUses: v.max_uses as number,
    usedCount: v.used_count as number,
    status: v.status as string,
    expiresAt: (v.expires_at as string) ?? null,
    batchId: (v.batch_id as string) ?? null,
    assignedName: (v.assigned_name as string) ?? null,
    assignedEmail: (v.assigned_email as string) ?? null,
    createdAt: v.created_at as string,
  };
}

/**
 * List vouchers (admin), newest first. Tolerant of a pending migration 00079:
 * if the assigned_* columns are missing it retries without them; if the whole
 * table is missing (00078 not applied) it returns []. The page renders either way.
 */
export async function listVouchers(): Promise<VoucherRow[]> {
  const sb = createServiceClient();
  const run = (cols: string) =>
    sb
      .from("technical_sandbox_vouchers")
      .select(cols)
      .order("created_at", { ascending: false })
      .limit(500);

  let { data, error } = await run(`${VOUCHER_BASE_COLS}, assigned_name, assigned_email`);
  if (error && isMissingSchemaError(error)) {
    // Retry without the 00079 columns (table exists, columns don't).
    ({ data, error } = await run(VOUCHER_BASE_COLS));
  }
  if (error) {
    if (isMissingSchemaError(error)) return []; // table absent (00078 not applied)
    throw error;
  }
  return ((data ?? []) as unknown as Record<string, unknown>[]).map(mapVoucher);
}

export async function setVoucherStatus(id: string, status: "active" | "disabled") {
  const sb = createServiceClient();
  const { error } = await sb.from("technical_sandbox_vouchers").update({ status }).eq("id", id);
  if (error) throw error;
}

export interface DelegateVoucher {
  code: string;
  assignedName: string | null;
  assignedEmail: string | null;
  functionId: string;
  organizationName: string | null;
}

/** Load vouchers by code (admin email-codes flow). Codes are normalized first. */
export async function getVouchersByCodes(codes: string[]): Promise<DelegateVoucher[]> {
  const sb = createServiceClient();
  const norm = Array.from(new Set(codes.map(normalizeCode).filter(Boolean)));
  if (norm.length === 0) return [];
  const { data, error } = await sb
    .from("technical_sandbox_vouchers")
    .select("code, assigned_name, assigned_email, function_id, organization_name")
    .in("code", norm);
  if (error) throw error;
  return (data ?? []).map((v) => ({
    code: v.code,
    assignedName: v.assigned_name,
    assignedEmail: v.assigned_email,
    functionId: v.function_id,
    organizationName: v.organization_name,
  }));
}
