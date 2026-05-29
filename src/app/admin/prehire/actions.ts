"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { requireRole, isAuthorizationError } from "@/lib/ara/auth-guards";
import { sendEmail, isEmailConfigured } from "@/lib/integrations/email";
import { logPrehireEvent } from "@/lib/prehire/audit";
import type { PrehireStagePlanEntry, PrehireStageKind, PrehireDecision } from "@/types/prehire";

// Admin-only gate. Under AUTH_ENABLED=false the guard returns a synthetic admin
// (dev keeps working); under auth=on it refuses non-admin callers. Writes go
// through the service client so RLS doesn't block the legitimate admin path.
async function gateAdmin(): Promise<{ error: string } | null> {
  try {
    await requireRole(["admin"]);
    return null;
  } catch (e) {
    if (isAuthorizationError(e)) return { error: e.message };
    throw e;
  }
}

const stageEntrySchema = z.object({
  kind: z.enum(["fluent", "quiz", "cbi", "assessment_center"]),
  weight: z.coerce.number().min(0).max(1),
  cut_score: z.coerce.number().min(0).max(100).nullable(),
  required: z.boolean(),
});

const requisitionSchema = z.object({
  organization_id: z.string().uuid("Select a client organization"),
  title: z.string().min(2, "Title is required").max(160),
  role_profile_id: z.string().uuid().nullable().optional(),
  level: z.string().max(60).optional(),
  english_required: z.boolean().optional(),
  stage_config: z.array(stageEntrySchema).min(1, "Pick at least one screening stage"),
});

export async function createRequisitionAction(input: unknown) {
  const gate = await gateAdmin();
  if (gate) return gate;

  const parsed = requisitionSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.flatten().formErrors.join("; ") || "Invalid requisition" };
  }

  const svc = createServiceClient();
  const { data, error } = await svc
    .from("prehire_requisitions")
    .insert({
      organization_id: parsed.data.organization_id,
      title: parsed.data.title,
      role_profile_id: parsed.data.role_profile_id ?? null,
      level: parsed.data.level || null,
      english_required: parsed.data.english_required ?? false,
      stage_config: parsed.data.stage_config,
      status: "open",
    })
    .select("id")
    .single();

  if (error || !data) return { error: error?.message ?? "Could not create requisition" };

  await logPrehireEvent({
    action: "requisition_created",
    requisitionId: data.id as string,
    actorLabel: "admin",
    detail: { title: parsed.data.title, stages: parsed.data.stage_config.map((s) => s.kind) },
  });

  revalidatePath("/admin/prehire");
  return { data: { id: data.id as string } };
}

const candidateSchema = z.object({
  requisition_id: z.string().uuid(),
  full_name: z.string().min(2, "Name is required").max(160),
  email: z.string().email("Valid email required"),
  phone: z.string().max(40).optional(),
});

export async function addCandidateAction(input: unknown) {
  const gate = await gateAdmin();
  if (gate) return gate;

  const parsed = candidateSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.flatten().formErrors.join("; ") || "Invalid candidate" };
  }

  const svc = createServiceClient();
  const { data, error } = await svc
    .from("prehire_candidates")
    .insert({
      requisition_id: parsed.data.requisition_id,
      full_name: parsed.data.full_name,
      email: parsed.data.email,
      phone: parsed.data.phone || null,
      status: "invited",
      invited_at: new Date().toISOString(),
    })
    .select("id, access_token")
    .single();

  if (error || !data) return { error: error?.message ?? "Could not add candidate" };

  await logPrehireEvent({
    action: "candidate_added",
    requisitionId: parsed.data.requisition_id,
    candidateId: data.id as string,
    actorLabel: "admin",
  });

  // Best-effort: email the invite immediately. Never block adding the candidate
  // on email — the recruiter can always copy the link or resend.
  const emailed = await sendPrehireInvite(data.id as string);

  revalidatePath(`/admin/prehire/${parsed.data.requisition_id}`);
  return { data: { id: data.id as string, access_token: data.access_token as string, emailed } };
}

/** Resend the invitation email to an existing candidate (admin-gated). */
export async function resendPrehireInviteAction(candidateId: string) {
  const gate = await gateAdmin();
  if (gate) return gate;
  if (typeof candidateId !== "string" || !candidateId) return { error: "Missing candidate" };

  const emailed = await sendPrehireInvite(candidateId);
  return emailed
    ? { data: { emailed: true } }
    : isEmailConfigured()
    ? { error: "Couldn't send the invitation email. Please try again." }
    : { data: { emailed: false } }; // not configured — UI falls back to the copy link
}

// ── Invitation email helper ──────────────────────────────────────
// Loads the candidate + requisition + org, builds the token apply URL, sends
// the bilingual-free invitation, and stamps invited_at. Returns true only when
// Graph is configured AND the send succeeded (so the UI can distinguish a real
// send from the console-mock fallback). Best-effort: never throws.
const STAGE_MINUTES: Record<PrehireStageKind, number> = {
  quiz: 5,
  fluent: 15,
  cbi: 10,
  assessment_center: 0, // run elsewhere, not part of the self-served apply flow
};

function appBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://caliber.viftraining.com"
  ).replace(/\/+$/, "");
}

async function sendPrehireInvite(candidateId: string): Promise<boolean> {
  try {
    const svc = createServiceClient();
    const { data: cand } = await svc
      .from("prehire_candidates")
      .select("id, full_name, email, access_token, requisition_id")
      .eq("id", candidateId)
      .maybeSingle();
    if (!cand?.email || !cand.access_token) return false;

    const { data: req } = await svc
      .from("prehire_requisitions")
      .select("title, stage_config, organizations(name)")
      .eq("id", cand.requisition_id)
      .maybeSingle();
    if (!req) return false;

    const orgName = (req.organizations as unknown as { name: string } | null)?.name ?? null;
    const plan = (req.stage_config ?? []) as PrehireStagePlanEntry[];
    const minutes = plan.reduce((sum, s) => sum + (STAGE_MINUTES[s.kind] ?? 0), 0);
    const duration = minutes > 0 ? `${minutes} minutes` : "a few minutes";

    const applyUrl = `${appBaseUrl()}/prehire/apply/${cand.access_token}`;

    const ok = await sendEmail({
      to: cand.email as string,
      template: "prehire_invitation",
      data: {
        candidateName: (cand.full_name as string)?.split(" ")[0] || "there",
        roleTitle: (req.title as string) ?? "the role",
        orgName: orgName ?? "the hiring organization",
        orgClause: orgName ? ` with ${orgName}` : "",
        duration,
        applyUrl,
      },
    });

    await svc
      .from("prehire_candidates")
      .update({ invited_at: new Date().toISOString() })
      .eq("id", cand.id);

    const emailed = isEmailConfigured() && ok;
    await logPrehireEvent({
      action: "invitation_sent",
      requisitionId: cand.requisition_id as string,
      candidateId: cand.id as string,
      actorLabel: "admin",
      detail: { channel: emailed ? "email" : "link", emailConfigured: isEmailConfigured() },
    });
    return emailed;
  } catch (e) {
    console.error("[prehire] invite email failed:", e);
    return false;
  }
}

const DECISION_TO_STATUS: Record<PrehireDecision, string> = {
  advanced: "shortlisted",
  rejected: "declined",
  hold: "hold",
  withdrawn: "withdrawn",
};

/**
 * Record the HUMAN hiring decision for a candidate (admin-gated). This is
 * distinct from the AI `recommendation` signal — it's where the
 * human-in-the-loop is captured, with a job-related reason, an actor, and a
 * timestamp, and written to the immutable audit trail. The pipeline never
 * auto-decides; a person always does, here.
 */
export async function setPrehireDecisionAction(input: {
  candidateId: string;
  decision: PrehireDecision;
  reason?: string;
}) {
  let caller;
  try {
    caller = await requireRole(["admin"]);
  } catch (e) {
    if (isAuthorizationError(e)) return { error: e.message };
    throw e;
  }

  const { candidateId, decision } = input ?? {};
  if (typeof candidateId !== "string" || !candidateId) return { error: "Missing candidate" };
  if (!(decision in DECISION_TO_STATUS)) return { error: "Invalid decision" };
  const reason = (input.reason ?? "").toString().trim().slice(0, 2000) || null;

  const svc = createServiceClient();
  const { data: cand } = await svc
    .from("prehire_candidates")
    .select("id, requisition_id")
    .eq("id", candidateId)
    .maybeSingle();
  if (!cand) return { error: "Candidate not found" };

  const { error } = await svc
    .from("prehire_candidates")
    .update({
      decision,
      decision_reason: reason,
      // The dev-admin stub uses an all-zero uid that isn't a real profile row —
      // null it out so the decided_by FK doesn't fail under AUTH_ENABLED=false.
      decided_by: caller.isDev ? null : caller.uid,
      decided_at: new Date().toISOString(),
      status: DECISION_TO_STATUS[decision],
    })
    .eq("id", candidateId);
  if (error) return { error: error.message };

  await logPrehireEvent({
    action: "decision_recorded",
    requisitionId: cand.requisition_id as string,
    candidateId,
    actorId: caller.isDev ? null : caller.uid,
    actorLabel: "admin",
    detail: { decision, hasReason: !!reason }, // never log the reason text into the client-readable trail
  });

  revalidatePath(`/admin/prehire/${cand.requisition_id}`);
  return { data: { decision } };
}
