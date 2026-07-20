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
import { normalizeVoucherExpiry } from "@/lib/vouchers/expiry";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I
const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

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
  /** Authoritative org id (00190) - set by the client-portal issuance path from
   *  the caller's profile. Bound to each session at redeem as proof of issuance,
   *  so tenancy no longer relies on a redeemer-typed org label. NULL on the admin
   *  free-text path (name-resolution fallback). */
  organizationId?: string | null;
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
  /**
   * Custom (pick-and-choose) sitting design (00141), carried to the redeemed
   * session so the delegate sits the SAME custom assessment instead of the
   * function default. NULL/empty = ordinary voucher (full function default).
   */
  customConfig?: { skills: string[]; blockIds: string[]; title?: string | null } | null;
  contactName?: string | null;
  contactTitle?: string | null;
  contactEmail?: string | null;
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
  // Only carry custom_config (00141) when the sitting is actually customised, so
  // an ordinary voucher never references the column on a pending-00141 DB.
  const cc = input.customConfig;
  const hasCustom = !!cc && (((cc.skills?.length ?? 0) > 0) || ((cc.blockIds?.length ?? 0) > 0));
  const customCol: Record<string, unknown> = hasCustom
    ? { custom_config: { skills: cc!.skills ?? [], blockIds: cc!.blockIds ?? [], title: cc!.title ?? null } }
    : {};
  // 00168 client contact - peeled first below on a schema-cache miss.
  const contactCol: Record<string, unknown> = {
    contact_name: input.contactName ?? null,
    contact_title: input.contactTitle ?? null,
    contact_email: input.contactEmail ?? null,
  };
  // 00190 authoritative org id (newest column - peeled FIRST below). UUID-shape
  // guarded so a malformed value can't 22P02 the FK insert and break the peel loop
  // (that error is not a missing-schema error, so it would throw rather than degrade).
  const orgIdCol: Record<string, unknown> =
    input.organizationId && UUID_RE.test(input.organizationId) ? { organization_id: input.organizationId } : {};

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
      expires_at: normalizeVoucherExpiry(input.expiresAt),
      created_by: input.createdBy ?? null,
      mcq_pct: mcqPct,
      ...lensCol,
      ...customCol,
      ...contactCol,
      ...orgIdCol,
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
      expires_at: normalizeVoucherExpiry(input.expiresAt),
      created_by: input.createdBy ?? null,
      mcq_pct: mcqPct,
      ...lensCol,
      ...customCol,
      ...contactCol,
      ...orgIdCol,
    }));
  }

  // Newest-first peel: drop organization_id (00190), then contact_* (00168), then
  // custom_config (00141), then talent_lens (00136), then mcq_pct (00085) on a
  // missing-column error so a pending migration degrades gracefully. Each deeper
  // level also omits every newer column (a missing column stays missing).
  const stripOrg = (r: Record<string, unknown>) => {
    const { organization_id, ...rest } = r;
    void organization_id;
    return rest;
  };
  const stripOrgContact = (r: Record<string, unknown>) => {
    const { organization_id, contact_name, contact_title, contact_email, ...rest } = r;
    void organization_id; void contact_name; void contact_title; void contact_email;
    return rest;
  };
  const stripOrgContactCustom = (r: Record<string, unknown>) => {
    const { organization_id, contact_name, contact_title, contact_email, custom_config, ...rest } = r;
    void organization_id; void contact_name; void contact_title; void contact_email; void custom_config;
    return rest;
  };
  const stripOrgContactCustomLens = (r: Record<string, unknown>) => {
    const { organization_id, contact_name, contact_title, contact_email, custom_config, talent_lens, ...rest } = r;
    void organization_id; void contact_name; void contact_title; void contact_email; void custom_config; void talent_lens;
    return rest;
  };
  const stripOrgContactCustomLensMcq = (r: Record<string, unknown>) => {
    const { organization_id, contact_name, contact_title, contact_email, custom_config, talent_lens, mcq_pct, ...rest } = r;
    void organization_id; void contact_name; void contact_title; void contact_email; void custom_config; void talent_lens; void mcq_pct;
    return rest;
  };
  const attempts = [
    rows,
    rows.map(stripOrg),
    rows.map(stripOrgContact),
    rows.map(stripOrgContactCustom),
    rows.map(stripOrgContactCustomLens),
    rows.map(stripOrgContactCustomLensMcq),
  ];
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

  // The claim RPC doesn't return mcq_pct / talent_lens / custom_config; read
  // them separately. Progressive column set so a pending 00141 / 00136 / 00085
  // degrades gracefully (newest column first; first successful read wins).
  let mcqPct = 0;
  let talentLens: "acquisition" | "development" | null = null;
  let customConfig: { skills: string[]; blockIds: string[]; title: string | null } | null = null;
  for (const cols of ["mcq_pct, talent_lens, custom_config", "mcq_pct, talent_lens", "mcq_pct"]) {
    const { data: vRow, error: vErr } = await sb
      .from("technical_sandbox_vouchers")
      .select(cols)
      .eq("id", voucher.id as string)
      .maybeSingle<Record<string, unknown>>();
    if (vErr) continue; // column missing on this DB - try a smaller column set
    mcqPct = clampMcqPct((vRow?.mcq_pct as number) ?? 0);
    const rawLens = vRow?.talent_lens;
    talentLens = rawLens === "acquisition" || rawLens === "development" ? rawLens : null;
    const cc = vRow?.custom_config as
      | { skills?: string[]; blockIds?: string[]; title?: string | null }
      | null
      | undefined;
    if (cc && (Array.isArray(cc.skills) || Array.isArray(cc.blockIds))) {
      customConfig = { skills: cc.skills ?? [], blockIds: cc.blockIds ?? [], title: cc.title ?? null };
    }
    break;
  }

  // organization_id (00190) read STANDALONE - the security-critical tenancy column
  // must not be gated behind an older optional column's presence in the set above
  // (on a partially-migrated DB that has 00190 but lacks e.g. custom_config, a
  // coupled read would silently drop it and reopen the name-collision leak).
  let voucherOrgId: string | null = null;
  {
    const { data: oRow } = await sb
      .from("technical_sandbox_vouchers")
      .select("organization_id")
      .eq("id", voucher.id as string)
      .maybeSingle<{ organization_id: string | null }>();
    voucherOrgId = oRow?.organization_id ?? null;
  }

  try {
    const { id: sessionId, accessToken } = await createSession({
      functionId: voucher.function_id as string,
      candidateName: input.name.trim(),
      candidateEmail: input.email.trim(),
      // Display name: for a client-issued voucher (authoritative org id) prefer the
      // voucher's own org label so display matches tenancy; otherwise the redeemer's
      // typed company. Tenancy itself binds to organizationId when present, so a
      // redeemer can no longer type another org's name to cross the boundary.
      organizationName:
        ((voucherOrgId ? (voucher.organization_name as string) : input.company) || voucher.organization_name || "").trim() ||
        undefined,
      organizationId: voucherOrgId ?? undefined,
      mcqPct,
      talentLens,
      // A custom-builder voucher provisions the SAME custom sitting (00141).
      ...(customConfig
        ? {
            isCustom: true,
            selectedSkills: customConfig.skills,
            selectedBlockIds: customConfig.blockIds,
            assessmentTitle: customConfig.title ?? undefined,
          }
        : {}),
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
