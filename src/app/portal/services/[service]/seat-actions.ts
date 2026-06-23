"use server";

import { requireRole, isAuthorizationError } from "@/lib/ara/auth-guards";
import { getClientOrgId } from "@/lib/auth/get-org-id";
import { getAllocationsForOrg } from "@/lib/clients/allocations";
import { inviteSeatDelegates, isSeatService, type SeatDelegate } from "@/lib/clients/seat-issue";
import { issueArcVouchers, type IssueArcVouchersResult } from "@/lib/clients/seat/arc";
import { PORTAL_SERVICE_IDS, type CaliberService } from "@/lib/clients/portal-services";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_RE = /^[0-9a-fA-F-]{36}$/;

function parseDelegates(text: string): SeatDelegate[] {
  const out: SeatDelegate[] = [];
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
  if (!UUID_RE.test(orgParam)) return { error: "Invalid organisation id." };
  return { orgId: orgParam };
}

export type ClientSeatResult = { ok: true; invited: number; emailed: number } | { error: string };

export async function clientInviteSeatAction(input: {
  service: string;
  orgParam?: string;
  delegatesText: string;
}): Promise<ClientSeatResult> {
  if (!PORTAL_SERVICE_IDS.includes(input.service as CaliberService)) return { error: "Unknown service" };
  const service = input.service as CaliberService;
  if (!isSeatService(service)) return { error: "This service is self-serve, not a VIFM-managed programme." };

  const actor = await resolveActorOrg(input.orgParam);
  if ("error" in actor) return { error: actor.error };

  const delegates = parseDelegates(input.delegatesText);
  if (delegates.length === 0) return { error: "Add at least one valid email address." };
  if (delegates.length > 200) return { error: "Up to 200 people per batch." };

  const allocs = await getAllocationsForOrg(actor.orgId);
  const alloc = allocs.find((a) => a.service === service);
  if (!alloc) return { error: "No allocation for this service yet - ask VIFM to grant one." };

  // The allocation row carries the resolved ARA-store org id for ARC/Reflect.
  const araOrgId = alloc.ara_organization_id;

  const res = await inviteSeatDelegates({ service, orgId: actor.orgId, araOrgId, alloc, delegates });
  if ("error" in res) return { error: res.error };
  return { ok: true, invited: res.invited, emailed: res.emailed };
}

// ARC INDIVIDUAL track: issue individual single-use codes (one per recipient)
// OR one shared code with N seats, drawing from the same ARC seat allocation.
// (Department/Division/Organization cohorts stay on clientInviteSeatAction.)
export async function clientIssueArcVouchersAction(input: {
  orgParam?: string;
  mode: "individual" | "pool";
  delegatesText?: string;
  seats?: number;
}): Promise<IssueArcVouchersResult> {
  const actor = await resolveActorOrg(input.orgParam);
  if ("error" in actor) return { error: actor.error };

  const allocs = await getAllocationsForOrg(actor.orgId);
  const alloc = allocs.find((a) => a.service === "arc");
  if (!alloc) return { error: "No AI Readiness allocation yet - ask VIFM to grant one." };
  const araOrgId = alloc.ara_organization_id;

  if (input.mode === "individual") {
    const delegates = parseDelegates(input.delegatesText ?? "");
    if (delegates.length === 0) return { error: "Add at least one valid email address." };
    if (delegates.length > 500) return { error: "Up to 500 recipients per batch." };
    return issueArcVouchers({ orgId: actor.orgId, araOrgId, alloc, mode: "individual", delegates });
  }

  const seats = Math.floor(Number(input.seats));
  if (!Number.isFinite(seats) || seats < 1) return { error: "Enter at least 1 seat." };
  if (seats > 500) return { error: "Up to 500 seats per shared link." };
  return issueArcVouchers({ orgId: actor.orgId, araOrgId, alloc, mode: "pool", seats });
}
