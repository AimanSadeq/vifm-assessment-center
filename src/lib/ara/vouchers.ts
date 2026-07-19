import { createServiceClient } from "@/lib/supabase/server";

// ─────────────────────────────────────────────────────────────
// ARA voucher service - generate + redeem PRACTICE AI Readiness
// Compass (ARC) access codes. Server-only (uses the service-role
// client). Admin generation is gated by the calling server action;
// redemption is public (the delegate has no session) and validated
// atomically via the ara_voucher_claim RPC.
// ─────────────────────────────────────────────────────────────

export type VoucherTier = "snapshot" | "deep_dive";

// Unambiguous charset (no 0/O/1/I) for human-typed codes.
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomBlock(len: number): string {
  const bytes = new Uint8Array(len);
  globalThis.crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < len; i++) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return out;
}

/** Human-friendly, unguessable code, e.g. "VIFM-ARC-7K3M-9QX2". */
export function generateVoucherCode(): string {
  return `VIFM-ARC-${randomBlock(4)}-${randomBlock(4)}`;
}

/** Normalize a typed code for storage/lookup (uppercase, trimmed). */
export function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}

export type CreateBatchInput = {
  count: number;
  label?: string | null;
  organizationId?: string | null;
  clientName?: string | null;
  tier?: VoucherTier;
  region?: "uae" | "saudi";
  language?: "en" | "ar";
  maxUses?: number; // seat-pool size per code
  isPractice?: boolean;
  expiresAt?: string | null; // ISO
  createdBy?: string | null;
  /** Per-client ARC length: max individual-layer questions per factor a redeemed
   *  code serves. NULL/undefined = the full deep-dive (no cap). Migration 00143. */
  itemsPerFactor?: number | null;
  contactName?: string | null;
  contactTitle?: string | null;
  contactEmail?: string | null;
};

/**
 * Create a batch of voucher codes. Returns the generated codes. Retries code
 * generation on the (astronomically unlikely) unique-collision. Admin-gated by
 * the caller.
 */
export async function createVoucherBatch(
  input: CreateBatchInput
): Promise<{ ok: true; batchId: string; codes: string[] } | { ok: false; error: string }> {
  const count = Math.max(1, Math.min(500, Math.floor(input.count)));
  const sb = createServiceClient();
  const batchId = globalThis.crypto.randomUUID();

  // Only touch items_per_factor when a cap is set, so the common full-length
  // case still works on a DB where migration 00143 hasn't been applied yet.
  const ipf = input.itemsPerFactor ?? null;
  const rows = Array.from({ length: count }, () => ({
    code: generateVoucherCode(),
    label: input.label ?? null,
    batch_id: batchId,
    organization_id: input.organizationId ?? null,
    client_name: input.clientName ?? null,
    tier: input.tier ?? "snapshot",
    region: input.region ?? "uae",
    default_language: input.language ?? "en",
    max_uses: Math.max(1, input.maxUses ?? 1),
    is_practice: input.isPractice ?? true,
    expires_at: input.expiresAt ?? null,
    created_by: input.createdBy ?? null,
    contact_name: input.contactName ?? null,
    contact_title: input.contactTitle ?? null,
    contact_email: input.contactEmail ?? null,
    ...(ipf != null ? { items_per_factor: ipf } : {}),
  }));

  const { data, error } = await sb.from("ara_vouchers").insert(rows).select("code");
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
  /**
   * Respondent id from this browser's first-party redeem cookie (set by the
   * action on first redeem of THIS code). Used to resume an in-progress sitting
   * without minting a new one or burning a seat. It is a browser-bound
   * credential - NOT derived from the typed email - so re-opening the redeem
   * link on the same browser resumes, but nobody can reach another person's
   * sitting by guessing their email.
   */
  resumeRespondentId?: string | null;
};

const PRACTICE_ORG_NAME_EN = "AI Readiness Compass - Practice";
const PRACTICE_ORG_NAME_AR = "بوصلة الجاهزية للذكاء الاصطناعي - تدريب";

type ClaimedVoucher = {
  id: string;
  tier: string;
  region: string;
  default_language: string;
  organization_id: string | null;
  client_name: string | null;
  is_practice: boolean;
};

/**
 * Redeem a voucher: atomically claim a seat, then provision an individual ARA
 * run (sandbox/practice) and a respondent, record the redemption (with the
 * required company name), and return the respondent URL. Mirrors the consultant
 * deep-dive issuance recipe, minus the consultant.
 */
export async function redeemVoucher(
  input: RedeemInput
): Promise<{ ok: true; respondentUrl: string; respondentId: string } | { ok: false; error: string }> {
  const code = normalizeCode(input.code);
  if (!code) return { ok: false, error: "Enter a voucher code." };
  if (!input.redeemerName.trim() || !input.redeemerEmail.trim() || !input.companyName.trim()) {
    return { ok: false, error: "Name, email, and company are required." };
  }

  const sb = createServiceClient();

  // 0. Resume an IN-PROGRESS sitting bound to THIS browser. The action passes
  // resumeRespondentId from a first-party cookie it set when this browser first
  // redeemed this code - so re-opening the redeem link resumes instead of
  // minting a new sitting and burning another seat (the trial finding). Resume
  // is gated on the cookie, NOT the typed email, so nobody can reach another
  // person's sitting/results by guessing their email. Only in-progress sittings
  // resume (a completed one falls through to a fresh sitting, never exposing
  // results). Ownership is re-verified against this voucher's redemptions so a
  // forged id can't cross to another voucher.
  if (input.resumeRespondentId) {
    try {
      const { data: vlookup } = await sb
        .from("ara_vouchers")
        .select("id")
        .eq("code", code)
        .maybeSingle<{ id: string }>();
      if (vlookup?.id) {
        const { data: red } = await sb
          .from("ara_voucher_redemptions")
          .select("ara_respondent_id")
          .eq("voucher_id", vlookup.id)
          .eq("ara_respondent_id", input.resumeRespondentId)
          .maybeSingle<{ ara_respondent_id: string }>();
        if (red?.ara_respondent_id) {
          const { data: resp } = await sb
            .from("ara_respondents")
            .select("access_token, completed_at")
            .eq("id", input.resumeRespondentId)
            .maybeSingle<{ access_token: string; completed_at: string | null }>();
          if (resp?.access_token && !resp.completed_at) {
            return { ok: true, respondentUrl: `/ara/respond/${resp.access_token}`, respondentId: input.resumeRespondentId };
          }
        }
      }
    } catch (err) {
      // Best-effort - fall through to a fresh claim on any error. Logged so a
      // silent seat-burn from a transient lookup failure is observable rather
      // than invisible.
      console.error("[redeemVoucher] resume lookup failed, starting fresh sitting:", err);
    }
  }

  // 1. Atomic claim - consumes a seat only if the voucher is valid.
  const { data: claimed, error: claimErr } = await sb.rpc("ara_voucher_claim", { p_code: code });
  if (claimErr) return { ok: false, error: "Could not redeem this code. Please try again." };
  const voucher = (Array.isArray(claimed) ? claimed[0] : claimed) as ClaimedVoucher | undefined;
  if (!voucher) return { ok: false, error: "This code is invalid, expired, or fully used." };

  // The seat is now claimed. Any provisioning failure below must hand it back so
  // a failed redeem doesn't permanently burn a use (tolerant if 00158 isn't
  // applied yet). Use `fail()` for every post-claim early return.
  const fail = async (error: string): Promise<{ ok: false; error: string }> => {
    try { await sb.rpc("ara_voucher_release_seat", { p_code: code }); } catch { /* pre-00158: seat stays claimed */ }
    return { ok: false, error };
  };

  const tier = voucher.tier === "deep_dive" ? "deep_dive" : "snapshot";
  const region = voucher.region === "saudi" ? "saudi" : "uae";
  const language = voucher.default_language === "ar" ? "ar" : "en";

  // Per-client length cap (migration 00143). The claim RPC doesn't return it, so
  // fetch by id; tolerant of the column not existing yet (treated as no cap).
  let itemsPerFactor: number | null = null;
  try {
    const { data: vrow } = await sb
      .from("ara_vouchers")
      .select("items_per_factor")
      .eq("id", voucher.id)
      .maybeSingle<{ items_per_factor: number | null }>();
    itemsPerFactor = vrow?.items_per_factor ?? null;
  } catch {
    /* column absent pre-migration - no cap */
  }

  // 2. Org: the voucher's tagged client org, else the shared practice org.
  let orgId: string | null = voucher.organization_id ?? null;
  if (!orgId) {
    const { data: existing } = await sb
      .from("ara_organizations")
      .select("id")
      .eq("name", PRACTICE_ORG_NAME_EN)
      .maybeSingle<{ id: string }>();
    if (existing) {
      orgId = existing.id;
    } else {
      const { data: created, error: orgErr } = await sb
        .from("ara_organizations")
        .insert({ name: PRACTICE_ORG_NAME_EN, name_ar: PRACTICE_ORG_NAME_AR, region, sector: "general" })
        .select("id")
        .single<{ id: string }>();
      if (orgErr || !created) return fail("Could not start your assessment. Please try again.");
      orgId = created.id;
    }
  }

  // 3. Active question bank (the run pins to it).
  const { data: activeBank } = await sb
    .from("ara_question_bank_versions")
    .select("id")
    .eq("is_active", true)
    .maybeSingle<{ id: string }>();
  if (!activeBank) return fail("The assessment isn't available right now. Please contact VIFM.");

  // 4. Provision the individual run (sandbox/practice).
  const { data: assessment, error: assessErr } = await sb
    .from("ara_assessments")
    .insert({
      organization_id: orgId,
      consultant_id: null,
      region,
      sector: "general",
      default_language: language,
      is_sandbox: voucher.is_practice !== false,
      engagement_stage: "individual",
      assessment_tier: tier,
      include_individual_layer: false,
      ...(itemsPerFactor != null ? { items_per_factor: itemsPerFactor } : {}),
      scope_label: `${input.redeemerName.trim()} · ${input.companyName.trim()}`,
      question_bank_version_id: activeBank.id,
      status: "active",
      phase: "phase1",
    })
    .select("id")
    .single<{ id: string }>();
  if (assessErr || !assessment) return fail("Could not start your assessment. Please try again.");

  // 5. Respondent (carries the access token).
  const { data: respondent, error: respErr } = await sb
    .from("ara_respondents")
    .insert({
      assessment_id: assessment.id,
      name: input.redeemerName.trim(),
      email: input.redeemerEmail.trim(),
      language_preference: language,
    })
    .select("id, access_token")
    .single<{ id: string; access_token: string }>();
  if (respErr || !respondent) {
    await sb.from("ara_assessments").delete().eq("id", assessment.id);
    return fail("Could not start your assessment. Please try again.");
  }

  // 6. Record the redemption (company_name powers future per-company insights).
  await sb.from("ara_voucher_redemptions").insert({
    voucher_id: voucher.id,
    redeemer_name: input.redeemerName.trim(),
    redeemer_email: input.redeemerEmail.trim(),
    company_name: input.companyName.trim(),
    ara_assessment_id: assessment.id,
    ara_respondent_id: respondent.id,
    ip: input.ip ?? null,
    user_agent: input.userAgent ?? null,
  });

  return { ok: true, respondentUrl: `/ara/respond/${respondent.access_token}`, respondentId: respondent.id };
}
