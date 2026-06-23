"use server";

import { requireRole, isAuthorizationError } from "@/lib/ara/auth-guards";
import { getClientOrgId } from "@/lib/auth/get-org-id";
import { createServiceClient } from "@/lib/supabase/server";
import { getAllocationsForOrg } from "@/lib/clients/allocations";
import { issueClientVouchers, issueClientPoolVoucher, isVoucherService, type Delegate } from "@/lib/clients/voucher-issue";
import { PORTAL_SERVICE_IDS, type CaliberService } from "@/lib/clients/portal-services";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Parse a pasted roster: one delegate per line, "email", "email,name" or
 *  "name,email" (comma/tab/semicolon separated). Deduped by email. */
function parseDelegates(text: string): Delegate[] {
  const out: Delegate[] = [];
  const seen = new Set<string>();
  for (const raw of (text || "").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const parts = line.split(/[,\t;]/).map((p) => p.trim()).filter(Boolean);
    const email = parts.find((p) => EMAIL_RE.test(p));
    if (!email) continue;
    const key = email.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ email, name: parts.find((p) => p !== email) });
  }
  return out;
}

/** Resolve the acting org: a client_manager is locked to their own org (from the
 *  profile, never input); an admin may target an org via orgParam (preview). */
async function resolveActorOrg(orgParam?: string): Promise<{ orgId: string } | { error: string }> {
  let caller;
  try {
    caller = await requireRole(["admin", "client_manager"]);
  } catch (e) {
    if (isAuthorizationError(e)) return { error: e.message };
    throw e;
  }
  if (caller.role === "client_manager") {
    const orgId = await getClientOrgId();
    if (!orgId) return { error: "Your account is not linked to an organisation." };
    return { orgId };
  }
  if (!orgParam) return { error: "Select a client organisation." };
  return { orgId: orgParam };
}

export type ClientIssueResult =
  | { ok: true; issued: number; emailed: number; codes: { email: string; name?: string; code: string; url: string; emailed: boolean }[] }
  | { error: string };

export async function clientIssueVouchersAction(input: {
  service: string;
  orgParam?: string;
  delegatesText: string;
}): Promise<ClientIssueResult> {
  if (!PORTAL_SERVICE_IDS.includes(input.service as CaliberService)) return { error: "Unknown service" };
  const service = input.service as CaliberService;
  if (!isVoucherService(service)) return { error: "This service is set up by VIFM (not self-serve voucher issuance)." };

  const actor = await resolveActorOrg(input.orgParam);
  if ("error" in actor) return { error: actor.error };

  const delegates = parseDelegates(input.delegatesText);
  if (delegates.length === 0) return { error: "Add at least one valid email address." };
  if (delegates.length > 200) return { error: "Up to 200 recipients per batch." };

  const allocs = await getAllocationsForOrg(actor.orgId);
  const alloc = allocs.find((a) => a.service === service);
  if (!alloc) return { error: "No allocation for this service yet - ask VIFM to grant one." };

  const sb = createServiceClient();
  const { data: org } = await sb.from("organizations").select("name").eq("id", actor.orgId).maybeSingle<{ name: string }>();

  const res = await issueClientVouchers({
    service,
    orgId: actor.orgId,
    clientName: org?.name ?? null,
    lang: "en",
    delegates,
    alloc,
  });
  if (!res.ok) return { error: res.error ?? "Could not issue vouchers" };
  return { ok: true, issued: res.issued, emailed: res.emailed, codes: res.codes ?? [] };
}

export type ClientPoolIssueResult =
  | { ok: true; code: string; url: string; seats: number }
  | { error: string };

/** Issue ONE shared link carrying N seats, drawn from the caller's allocation.
 *  The org is resolved from the caller's profile (client_manager) - never input. */
export async function clientIssuePoolVoucherAction(input: {
  service: string;
  orgParam?: string;
  seats: number;
}): Promise<ClientPoolIssueResult> {
  if (!PORTAL_SERVICE_IDS.includes(input.service as CaliberService)) return { error: "Unknown service" };
  const service = input.service as CaliberService;
  if (!isVoucherService(service)) return { error: "This service is set up by VIFM (not self-serve voucher issuance)." };

  const actor = await resolveActorOrg(input.orgParam);
  if ("error" in actor) return { error: actor.error };

  const seats = Math.floor(Number(input.seats));
  if (!Number.isFinite(seats) || seats < 1) return { error: "Enter at least 1 seat." };
  if (seats > 500) return { error: "Up to 500 seats per shared link." };

  const allocs = await getAllocationsForOrg(actor.orgId);
  const alloc = allocs.find((a) => a.service === service);
  if (!alloc) return { error: "No allocation for this service yet - ask VIFM to grant one." };

  const sb = createServiceClient();
  const { data: org } = await sb.from("organizations").select("name").eq("id", actor.orgId).maybeSingle<{ name: string }>();

  const res = await issueClientPoolVoucher({
    service,
    orgId: actor.orgId,
    clientName: org?.name ?? null,
    lang: "en",
    seats,
    alloc,
  });
  if (!res.ok) return { error: res.error ?? "Could not issue the shared link" };
  return { ok: true, code: res.code!, url: res.url!, seats: res.seats! };
}
