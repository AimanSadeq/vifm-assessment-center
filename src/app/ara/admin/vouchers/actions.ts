"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireRole, isAuthorizationError } from "@/lib/ara/auth-guards";
import { createVoucherBatch } from "@/lib/ara/vouchers";
import { createServiceClient } from "@/lib/supabase/server";
import { sendViaResend } from "@/lib/integrations/resend";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://caliber.viftraining.com").replace(/\/+$/, "");

function inviteEmailHtml(link: string, code: string): string {
  return `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#111">
    <h2 style="color:#010131">VIFM AI Readiness Compass</h2>
    <p>You have been invited to take the AI Readiness Compass - a short, confidential assessment.</p>
    <p style="margin:24px 0">
      <a href="${link}" style="background:#5391D5;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:bold">Start your assessment</a>
    </p>
    <p style="font-size:13px;color:#555">If the button does not work, open this link:<br/>
      <a href="${link}">${link}</a></p>
    <p style="font-size:13px;color:#555">Your access code: <strong>${code}</strong></p>
    <p style="font-size:12px;color:#888">This assessment is private to you. Your results are emailed to you on completion.</p>
  </div>`;
}

/**
 * The expiry picker is an `<input type="date">`, so it yields a date-only
 * string ("2026-06-30"). `new Date("2026-06-30")` parses as UTC midnight, which
 * makes the voucher expire at the *start* of that day - so a code is rejected
 * for the whole day the admin picked. Treat a picked date as valid through the
 * end of that UTC day. Strings that already carry a time component (contain "T")
 * are passed through unchanged.
 */
function toEndOfDayIso(value: string | null | undefined): string | null {
  if (!value) return null;
  const raw = value.trim();
  if (!raw) return null;
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T23:59:59.999Z` : raw;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

async function requireAdmin() {
  try {
    await requireRole(["admin"]);
    return null;
  } catch (e) {
    if (isAuthorizationError(e)) return { ok: false as const, error: e.message };
    throw e;
  }
}

// scope = which assessment a redeemed code provisions:
//   "full"     -> the complete 60-question Personal ARC deep-dive, a REAL run
//                 (what selection / job-applicant vouchers need). Default.
//   "practice" -> the 36-question snapshot as a sandbox practice run (sampling).
const voucherScopeSchema = z.enum(["full", "practice"]).default("full");
const scopeToTier = (scope: "full" | "practice") =>
  ({ tier: scope === "practice" ? ("snapshot" as const) : ("deep_dive" as const), isPractice: scope === "practice" });

const batchSchema = z.object({
  count: z.coerce.number().int().min(1).max(500),
  label: z.string().max(200).optional(),
  organizationId: z.string().uuid().optional(),
  clientName: z.string().max(300).optional(),
  maxUses: z.coerce.number().int().min(1).max(10000).default(1),
  region: z.enum(["uae", "saudi"]).default("uae"),
  language: z.enum(["en", "ar"]).default("en"),
  scope: voucherScopeSchema,
  expiresAt: z.string().optional(),
});

export async function createVoucherBatchAction(formData: FormData) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const parsed = batchSchema.safeParse({
    count: formData.get("count"),
    label: formData.get("label") || undefined,
    organizationId: formData.get("organizationId") || undefined,
    clientName: formData.get("clientName") || undefined,
    maxUses: formData.get("maxUses") || 1,
    region: formData.get("region") || "uae",
    language: formData.get("language") || "en",
    scope: formData.get("scope") || "full",
    expiresAt: formData.get("expiresAt") || undefined,
  });
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { tier, isPractice } = scopeToTier(parsed.data.scope);
  const caller = await requireRole(["admin"]).catch(() => null);

  // Region (and client_name) are inherited from the tagged client org when one
  // is selected - the client's own fields are authoritative. The form region is
  // only used when no client is tagged.
  let region = parsed.data.region;
  let clientName = parsed.data.clientName ?? null;
  if (parsed.data.organizationId) {
    const sb = createServiceClient();
    const { data: org } = await sb
      .from("ara_organizations")
      .select("name, region")
      .eq("id", parsed.data.organizationId)
      .maybeSingle<{ name: string; region: string }>();
    if (org) {
      region = org.region === "saudi" ? "saudi" : "uae";
      clientName = clientName ?? org.name;
    }
  }

  const res = await createVoucherBatch({
    count: parsed.data.count,
    label: parsed.data.label ?? null,
    organizationId: parsed.data.organizationId ?? null,
    clientName,
    tier, // "deep_dive" (full 60) for selection, "snapshot" (36) for practice
    region,
    language: parsed.data.language,
    maxUses: parsed.data.maxUses,
    isPractice,
    expiresAt: toEndOfDayIso(parsed.data.expiresAt),
    createdBy: caller?.uid ?? null,
  });
  if (!res.ok) return res;

  revalidatePath("/ara/admin/vouchers");
  return { ok: true as const, codes: res.codes, batchId: res.batchId };
}

const emailDelegatesSchema = z.object({
  emails: z.string().min(3),
  organizationId: z.string().uuid().optional(),
  clientName: z.string().max(300).optional(),
  scope: voucherScopeSchema,
  expiresAt: z.string().optional(),
});

/**
 * Generate one single-use voucher per delegate email and send each a one-click
 * redeem link (code baked into the URL). Region/client are inherited from the
 * tagged org. Admin-only. Returns per-email results.
 */
export async function emailVouchersToDelegatesAction(formData: FormData) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const parsed = emailDelegatesSchema.safeParse({
    emails: formData.get("emails"),
    organizationId: formData.get("organizationId") || undefined,
    clientName: formData.get("clientName") || undefined,
    scope: formData.get("scope") || "full",
    expiresAt: formData.get("expiresAt") || undefined,
  });
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const { tier, isPractice } = scopeToTier(parsed.data.scope);

  // Parse the email list (one per line; tolerate commas/semicolons).
  const emails = Array.from(
    new Set(
      parsed.data.emails
        .split(/[\n,;]+/)
        .map((e) => e.trim().toLowerCase())
        .filter((e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e))
    )
  );
  if (emails.length === 0) return { ok: false as const, error: "No valid email addresses found." };
  if (emails.length > 200) return { ok: false as const, error: "Max 200 delegates per send." };

  // Inherit region + client name from the tagged org.
  let region: "uae" | "saudi" = "uae";
  let clientName = parsed.data.clientName ?? null;
  if (parsed.data.organizationId) {
    const sb = createServiceClient();
    const { data: org } = await sb
      .from("ara_organizations")
      .select("name, region")
      .eq("id", parsed.data.organizationId)
      .maybeSingle<{ name: string; region: string }>();
    if (org) {
      region = org.region === "saudi" ? "saudi" : "uae";
      clientName = clientName ?? org.name;
    }
  }

  const caller = await requireRole(["admin"]).catch(() => null);
  const expiresAt = toEndOfDayIso(parsed.data.expiresAt);
  const results: Array<{ email: string; ok: boolean; error?: string }> = [];

  for (const email of emails) {
    const batch = await createVoucherBatch({
      count: 1,
      label: email, // track which delegate this code is for
      organizationId: parsed.data.organizationId ?? null,
      clientName,
      tier,
      region,
      maxUses: 1,
      isPractice,
      expiresAt,
      createdBy: caller?.uid ?? null,
    });
    if (!batch.ok) {
      results.push({ email, ok: false, error: batch.error });
      continue;
    }
    const code = batch.codes[0];
    const link = `${SITE_URL}/ara/redeem?code=${encodeURIComponent(code)}&email=${encodeURIComponent(email)}`;
    const sent = await sendViaResend({
      to: email,
      subject: "Your VIFM AI Readiness Compass access",
      html: inviteEmailHtml(link, code),
    });
    results.push({ email, ok: sent.ok, error: sent.error });
  }

  revalidatePath("/ara/admin/vouchers");
  const sentCount = results.filter((r) => r.ok).length;
  return { ok: true as const, sent: sentCount, total: results.length, results };
}

export async function setVoucherStatusAction(id: string, status: "active" | "disabled") {
  const denied = await requireAdmin();
  if (denied) return denied;
  const sb = createServiceClient();
  const { error } = await sb.from("ara_vouchers").update({ status }).eq("id", id);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/ara/admin/vouchers");
  return { ok: true as const };
}

const clientSchema = z.object({
  name: z.string().min(2).max(300),
  nameAr: z.string().max(300).optional(),
  region: z.enum(["uae", "saudi"]).default("uae"),
  sector: z.enum(["government", "banking", "general"]).default("general"),
});

/** Create a client org (ara_organizations) inline from the vouchers screen so a
 *  batch can be tagged to it without leaving the page. Admin-only. */
export async function createClientOrgAction(
  formData: FormData
): Promise<{ ok: true; org: { id: string; name: string; region: string } } | { ok: false; error: string }> {
  const denied = await requireAdmin();
  if (denied) return denied;

  const parsed = clientSchema.safeParse({
    name: formData.get("name"),
    nameAr: formData.get("nameAr") || undefined,
    region: formData.get("region") || "uae",
    sector: formData.get("sector") || "general",
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const sb = createServiceClient();
  const { data, error } = await sb
    .from("ara_organizations")
    .insert({
      name: parsed.data.name,
      name_ar: parsed.data.nameAr ?? null,
      region: parsed.data.region,
      sector: parsed.data.sector,
    })
    .select("id, name, region")
    .single<{ id: string; name: string; region: string }>();
  if (error || !data) return { ok: false, error: error?.message ?? "Could not create client" };

  revalidatePath("/ara/admin/vouchers");
  return { ok: true, org: data };
}
