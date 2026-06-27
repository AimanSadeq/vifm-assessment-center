"use server";

import { revalidatePath } from "next/cache";
import { requireRole, isAuthorizationError } from "@/lib/ara/auth-guards";
import { createServiceClient } from "@/lib/supabase/server";
import { createVoucherBatch } from "@/lib/persona/vouchers";
import { emailVoucherLink, appOrigin } from "@/lib/persona/email";
import { createClientOrganization } from "@/lib/clients/registry";

async function guard() {
  try {
    const caller = await requireRole(["admin"]);
    return { ok: true as const, caller };
  } catch (e) {
    if (isAuthorizationError(e)) return { ok: false as const, error: e.message };
    throw e;
  }
}

export async function generatePersonaVouchersAction(input: {
  count: number;
  label?: string;
  clientName?: string;
  maxUses?: number;
  expiresAt?: string | null;
  /** Admin-pinned scope (SD-1). purpose omitted = legacy/unpinned (candidate picks). */
  purpose?: "development" | "hiring";
  targetRoleProfileId?: string | null;
  /** Empty / omitted = full bank; non-empty = serve only these competencies. */
  scopedCompetencyIds?: string[];
  /** Project/cohort label (00137) - groups this batch with Cognitive for reporting. */
  projectLabel?: string;
  /** Item format pin (00140, SD-9): 'normative' / 'ipsative' / 'both' (default). */
  itemFormat?: "normative" | "ipsative" | "both";
  contactName?: string;
  contactTitle?: string;
  contactEmail?: string;
}): Promise<{ ok: true; codes: string[] } | { error: string }> {
  const g = await guard();
  if (!g.ok) return { error: g.error };

  const purpose = input.purpose === "hiring" || input.purpose === "development" ? input.purpose : null;
  const itemFormat =
    input.itemFormat === "normative" || input.itemFormat === "ipsative" ? input.itemFormat : "both";
  // A hiring voucher needs a target role for the fit; reject early so an admin
  // can't issue a hiring batch that produces no fit report.
  if (purpose === "hiring" && !input.targetRoleProfileId) {
    return { error: "Pick a target role profile for a hiring assessment." };
  }

  let organizationId: string | null = null;
  const clientName = input.clientName?.trim() || null;
  if (clientName) {
    try {
      const reg = await createClientOrganization({ name: clientName, createdBy: g.caller.isDev ? null : g.caller.uid });
      if (reg.ok) organizationId = reg.organizationId;
    } catch {
      /* keep the denormalized client_name tag */
    }
  }

  const res = await createVoucherBatch({
    count: input.count,
    label: input.label?.trim() || null,
    organizationId,
    clientName,
    maxUses: Math.max(1, input.maxUses ?? 1),
    expiresAt: input.expiresAt || null,
    createdBy: g.caller.isDev ? null : g.caller.uid,
    purpose,
    targetRoleProfileId: purpose === "hiring" ? input.targetRoleProfileId ?? null : null,
    scopedCompetencyIds: (input.scopedCompetencyIds ?? []).filter(Boolean),
    projectLabel: input.projectLabel?.trim() || null,
    itemFormat,
    contactName: input.contactName?.trim() || null,
    contactTitle: input.contactTitle?.trim() || null,
    contactEmail: input.contactEmail?.trim() || null,
  });
  if (!res.ok) return { error: res.error };
  revalidatePath("/ac/persona/vouchers");
  return { ok: true, codes: res.codes };
}

/** Undefined column - migration 00130 (assigned_email) not applied yet.
 *  Postgres raises 42703 on a read; PostgREST raises PGRST204 on a write. */
function isMissingColumnError(err: { code?: string } | null): boolean {
  return err?.code === "42703" || err?.code === "PGRST204";
}

/** Best-effort stamp of which delegate a code was emailed to. Tolerant of
 *  migration 00130 not being applied (silently no-ops). */
async function stampAssignedEmail(code: string, email: string): Promise<void> {
  try {
    const sb = createServiceClient();
    const { error } = await sb.from("persona_vouchers").update({ assigned_email: email }).eq("code", code);
    if (error && !isMissingColumnError(error)) {
      // Non-schema errors are non-fatal here; the email still goes out.
      console.warn("persona stampAssignedEmail:", error.message);
    }
  } catch {
    /* best-effort */
  }
}

export type DelegateInput = { email: string; name?: string };
export type DelegateResult = { email: string; ok: boolean; code?: string; error?: string };

/**
 * Generate one single-use Persona voucher per delegate and email each a one-click
 * redeem link (code baked into the URL). Inherits the batch scope from the same
 * options the generate action takes. Admin-only. Returns per-delegate results.
 */
export async function emailVoucherDelegatesAction(input: {
  delegates: DelegateInput[];
  label?: string;
  clientName?: string;
  language?: "en" | "ar";
  expiresAt?: string | null;
  purpose?: "development" | "hiring";
  targetRoleProfileId?: string | null;
  scopedCompetencyIds?: string[];
  projectLabel?: string;
  itemFormat?: "normative" | "ipsative" | "both";
}): Promise<{ ok: true; results: DelegateResult[] } | { error: string }> {
  const g = await guard();
  if (!g.ok) return { error: g.error };
  const itemFormat =
    input.itemFormat === "normative" || input.itemFormat === "ipsative" ? input.itemFormat : "both";

  // Dedupe + validate the delegate list.
  const seen = new Set<string>();
  const delegates: DelegateInput[] = [];
  for (const d of input.delegates ?? []) {
    const email = d.email?.trim().toLowerCase();
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) continue;
    if (seen.has(email)) continue;
    seen.add(email);
    delegates.push({ email, name: d.name?.trim() || undefined });
  }
  if (delegates.length === 0) return { error: "No valid email addresses found." };
  if (delegates.length > 200) return { error: "Max 200 delegates per send." };

  const purpose = input.purpose === "hiring" || input.purpose === "development" ? input.purpose : null;
  if (purpose === "hiring" && !input.targetRoleProfileId) {
    return { error: "Pick a target role profile for a hiring assessment." };
  }

  let organizationId: string | null = null;
  const clientName = input.clientName?.trim() || null;
  if (clientName) {
    try {
      const reg = await createClientOrganization({ name: clientName, createdBy: g.caller.isDev ? null : g.caller.uid });
      if (reg.ok) organizationId = reg.organizationId;
    } catch {
      /* keep the denormalized client_name tag */
    }
  }

  const language: "en" | "ar" = input.language === "ar" ? "ar" : "en";
  const scopedCompetencyIds = (input.scopedCompetencyIds ?? []).filter(Boolean);
  const results: DelegateResult[] = [];

  for (const d of delegates) {
    const batch = await createVoucherBatch({
      count: 1,
      label: input.label?.trim() || d.email,
      organizationId,
      clientName,
      language,
      maxUses: 1,
      expiresAt: input.expiresAt || null,
      createdBy: g.caller.isDev ? null : g.caller.uid,
      purpose,
      targetRoleProfileId: purpose === "hiring" ? input.targetRoleProfileId ?? null : null,
      scopedCompetencyIds,
      projectLabel: input.projectLabel?.trim() || null,
      itemFormat,
    });
    if (!batch.ok) {
      results.push({ email: d.email, ok: false, error: batch.error });
      continue;
    }
    const code = batch.codes[0];
    await stampAssignedEmail(code, d.email);
    const url = `${appOrigin()}/ac/persona/redeem?code=${encodeURIComponent(code)}&email=${encodeURIComponent(d.email)}`;
    const sent = await emailVoucherLink({ to: d.email, name: d.name, code, url, lang: language });
    results.push({ email: d.email, ok: sent.ok, code, error: sent.error });
  }

  revalidatePath("/ac/persona/vouchers");
  return { ok: true, results };
}

/**
 * Email an already-generated Persona code to a delegate (per-row "Email" button).
 * Best-effort stamps assigned_email, builds the redeem link, and sends.
 */
export async function emailExistingVoucherCodeAction(input: {
  code: string;
  email: string;
  name?: string;
  language?: "en" | "ar";
}): Promise<{ ok: true } | { error: string }> {
  const g = await guard();
  if (!g.ok) return { error: g.error };

  const code = input.code?.trim();
  const email = input.email?.trim().toLowerCase();
  if (!code) return { error: "Missing voucher code." };
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "Enter a valid email address." };

  const language: "en" | "ar" = input.language === "ar" ? "ar" : "en";
  await stampAssignedEmail(code, email);
  const url = `${appOrigin()}/ac/persona/redeem?code=${encodeURIComponent(code)}&email=${encodeURIComponent(email)}`;
  const sent = await emailVoucherLink({ to: email, name: input.name?.trim() || undefined, code, url, lang: language });
  if (!sent.ok) return { error: sent.error || "Could not send the email." };

  revalidatePath("/ac/persona/vouchers");
  return { ok: true };
}

export async function disablePersonaVoucherAction(id: string): Promise<{ ok: true } | { error: string }> {
  const g = await guard();
  if (!g.ok) return { error: g.error };
  const sb = createServiceClient();
  const { error } = await sb.from("persona_vouchers").update({ status: "disabled" }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/ac/persona/vouchers");
  return { ok: true };
}
