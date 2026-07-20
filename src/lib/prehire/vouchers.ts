import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { normalizeVoucherExpiry } from "@/lib/vouchers/expiry";

// Pre-Hire vouchers: a client-distributable code (or seat-pool batch) tied to a
// requisition. A no-account applicant self-redeems at /prehire/redeem; the
// redemption creates a prehire_candidate on the requisition and returns its
// access_token, dropping the applicant straight into the existing apply flow
// (consent -> quiz -> fluent -> cbi -> demographics). Mirrors the Techno voucher
// lib: atomic claim RPC consumes a seat, release RPC rolls it back on failure.

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I to avoid confusion

function randomBlock(len: number): string {
  const bytes = new Uint8Array(len);
  globalThis.crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < len; i++) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return out;
}

export function generatePrehireVoucherCode(): string {
  return `VIFM-HIRE-${randomBlock(4)}-${randomBlock(4)}`;
}

export function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}

export type PrehireDelegate = { name: string; email: string };

export interface GeneratePrehireBatchInput {
  requisitionId: string;
  count: number;
  organizationName?: string | null;
  label?: string | null;
  /** Seats per code (1 = single-use, default). Ignored when delegates are given. */
  maxUsesPerCode?: number;
  expiresAt?: string | null;
  createdBy?: string | null;
  /** When provided, generate ONE named single-use code per delegate. */
  delegates?: PrehireDelegate[] | null;
  contactName?: string | null;
  contactTitle?: string | null;
  contactEmail?: string | null;
}

export interface PrehireVoucherRow {
  id: string;
  code: string;
  label: string | null;
  requisition_id: string;
  organization_name: string | null;
  max_uses: number;
  used_count: number;
  expires_at: string | null;
  status: string;
  assigned_name: string | null;
  assigned_email: string | null;
  created_at: string;
}

export async function generatePrehireVoucherBatch(
  input: GeneratePrehireBatchInput,
): Promise<PrehireVoucherRow[]> {
  const sb = createServiceClient();
  const batchId = globalThis.crypto.randomUUID();
  const expiresAt = normalizeVoucherExpiry(input.expiresAt);
  const org = input.organizationName?.trim() || null;
  const label = input.label?.trim() || null;

  const rows: Record<string, unknown>[] = [];
  if (input.delegates && input.delegates.length > 0) {
    for (const d of input.delegates) {
      const name = d.name.trim();
      const email = d.email.trim();
      if (!email) continue;
      rows.push({
        code: generatePrehireVoucherCode(),
        batch_id: batchId,
        requisition_id: input.requisitionId,
        organization_name: org,
        label,
        max_uses: 1,
        assigned_name: name || null,
        assigned_email: email,
        expires_at: expiresAt,
        created_by: input.createdBy ?? null,
        contact_name: input.contactName ?? null,
        contact_title: input.contactTitle ?? null,
        contact_email: input.contactEmail ?? null,
      });
    }
  } else {
    const n = Math.max(1, Math.min(input.count || 1, 500));
    const maxUses = Math.max(1, input.maxUsesPerCode ?? 1);
    for (let i = 0; i < n; i++) {
      rows.push({
        code: generatePrehireVoucherCode(),
        batch_id: batchId,
        requisition_id: input.requisitionId,
        organization_name: org,
        label,
        max_uses: maxUses,
        expires_at: expiresAt,
        created_by: input.createdBy ?? null,
        contact_name: input.contactName ?? null,
        contact_title: input.contactTitle ?? null,
        contact_email: input.contactEmail ?? null,
      });
    }
  }

  if (rows.length === 0) throw new Error("No voucher codes to create.");
  const { data, error } = await sb.from("prehire_vouchers").insert(rows).select("*");
  if (error) throw new Error(error.message);
  return (data ?? []) as PrehireVoucherRow[];
}

export interface PrehireRedeemInput {
  code: string;
  name: string;
  email: string;
  company?: string;
  ip?: string;
  userAgent?: string;
}
export type PrehireRedeemResult = { ok: true; token: string } | { ok: false; error: string };

export async function redeemPrehireVoucher(input: PrehireRedeemInput): Promise<PrehireRedeemResult> {
  const sb = createServiceClient();
  const code = normalizeCode(input.code);
  const name = input.name.trim();
  const email = input.email.trim();
  if (!code) return { ok: false, error: "Enter your access code." };
  if (!name || !email) return { ok: false, error: "Your name and email are required." };

  // Atomic seat claim: consumes a seat iff active, not expired, seats remain.
  const { data: claimed, error: claimErr } = await sb.rpc("prehire_voucher_claim", { p_code: code });
  if (claimErr) return { ok: false, error: "Could not validate the code. Please try again." };
  const voucher = (Array.isArray(claimed) ? claimed[0] : claimed) as
    | { id: string; requisition_id: string; organization_name: string | null }
    | undefined;
  if (!voucher) return { ok: false, error: "This code is invalid, disabled, expired, or fully used." };

  try {
    // Provision a candidate on the requisition. invited_at is stamped now (they
    // self-redeemed and proceed immediately), so they never show as "uninvited".
    const { data: cand, error: candErr } = await sb
      .from("prehire_candidates")
      .insert({
        requisition_id: voucher.requisition_id,
        full_name: name,
        email,
        status: "invited",
        invited_at: new Date().toISOString(),
      })
      .select("id, access_token")
      .single();
    if (candErr || !cand) throw new Error(candErr?.message || "Could not create the candidate record.");

    // Audit the redemption (best-effort; never blocks the applicant).
    await sb
      .from("prehire_voucher_redemptions")
      .insert({
        voucher_id: voucher.id,
        redeemer_name: name,
        redeemer_email: email,
        company_name: input.company?.trim() || voucher.organization_name || null,
        candidate_id: cand.id as string,
        ip: input.ip ?? null,
        user_agent: input.userAgent ?? null,
      })
      .then(undefined, () => {});

    return { ok: true, token: cand.access_token as string };
  } catch (e) {
    // Roll the claimed seat back so it is not lost on a provisioning failure.
    await sb.rpc("prehire_voucher_release", { p_id: voucher.id }).then(undefined, () => {});
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not start your assessment. Please try again.",
    };
  }
}

// ---- Admin hub helpers ----

export interface PrehireVoucherListItem extends PrehireVoucherRow {
  requisition_title: string | null;
}

export async function listPrehireVouchers(): Promise<PrehireVoucherListItem[]> {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from("prehire_vouchers")
    .select("*, prehire_requisitions(title)")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message); // lets the hub show "Not set up" when 00144 is absent
  return (data ?? []).map((v: Record<string, unknown>) => ({
    ...(v as unknown as PrehireVoucherRow),
    requisition_title: (v.prehire_requisitions as { title?: string } | null)?.title ?? null,
  }));
}

export interface PrehireRequisitionOption {
  id: string;
  title: string;
  organization_name: string | null;
}

export async function listPrehireRequisitionsForVoucher(): Promise<PrehireRequisitionOption[]> {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from("prehire_requisitions")
    .select("id, title, organizations(name)")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) return [];
  return (data ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    title: r.title as string,
    organization_name: (r.organizations as { name?: string } | null)?.name ?? null,
  }));
}

export async function disablePrehireVoucher(id: string): Promise<void> {
  const sb = createServiceClient();
  await sb
    .from("prehire_vouchers")
    .update({ status: "disabled", updated_at: new Date().toISOString() })
    .eq("id", id);
}
