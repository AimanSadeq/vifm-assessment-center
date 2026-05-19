"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import {
  requireRole,
  isAuthorizationError,
  AuthorizationError,
} from "@/lib/ara/auth-guards";

// ──────────────────────────────────────────────────────────────
// IDP shape — stored as jsonb on reflect_idps.top_priorities +
// action_plan so the schema doesn't need to change as we iterate
// the UI.
// ──────────────────────────────────────────────────────────────

export type IdpPriority = {
  competency_id: string | null;
  competency_name: string;
  why: string;
  target_behaviors: string[];
};

export type IdpAction = {
  action: string;
  owner: string;
  deadline: string | null; // ISO date
  support: string;
};

const REFLECT_IDP_STATUS = [
  "draft",
  "agreed",
  "in_progress",
  "reviewed",
  "closed",
] as const;
export type ReflectIdpStatus = (typeof REFLECT_IDP_STATUS)[number];

const priorityShape = z.object({
  competency_id: z.string().uuid().nullable(),
  competency_name: z.string().trim().min(2).max(200),
  why: z.string().trim().max(2000),
  target_behaviors: z.array(z.string().trim().min(1).max(400)).max(10),
});
const actionShape = z.object({
  action: z.string().trim().min(2).max(400),
  owner: z.string().trim().max(120),
  deadline: z.string().nullable(),
  support: z.string().trim().max(400),
});

const upsertIdpSchema = z.object({
  participant_id: z.string().uuid(),
  top_priorities: z.array(priorityShape).max(5),
  action_plan: z.array(actionShape).max(20),
  success_measures: z.string().trim().max(4000).nullable(),
  target_review_date: z.string().nullable(),
  status: z.enum(REFLECT_IDP_STATUS).default("draft"),
});

export type UpsertIdpPayload = z.infer<typeof upsertIdpSchema>;

function authErr(e: unknown) {
  if (isAuthorizationError(e)) return { ok: false as const, error: e.message };
  throw e;
}

async function requireParticipantOwner(participantId: string) {
  const caller = await requireRole(["admin", "consultant"]);
  if (caller.role === "admin") return caller;
  const sb = createServiceClient();
  const { data } = await sb
    .from("reflect_participants")
    .select("id, reflect_engagements!inner(consultant_id)")
    .eq("id", participantId)
    .maybeSingle<{
      id: string;
      reflect_engagements: { consultant_id: string | null };
    }>();
  if (!data) throw new AuthorizationError("Participant not found");
  if (data.reflect_engagements.consultant_id !== caller.uid) {
    throw new AuthorizationError("Not the engagement owner");
  }
  return caller;
}


// ──────────────────────────────────────────────────────────────
// Upsert IDP — one row per participant. Status defaults to 'draft';
// signing off flips it to 'agreed' via a separate action so the
// audit trail captures the moment.
// ──────────────────────────────────────────────────────────────

export async function upsertReflectIdp(payload: UpsertIdpPayload) {
  let caller;
  try {
    caller = await requireParticipantOwner(payload.participant_id);
  } catch (e) {
    return authErr(e);
  }

  const parsed = upsertIdpSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid IDP" };
  }
  const p = parsed.data;

  const sb = createServiceClient();
  const { error } = await sb.from("reflect_idps").upsert(
    {
      participant_id: p.participant_id,
      top_priorities: p.top_priorities,
      action_plan: p.action_plan,
      success_measures: p.success_measures,
      target_review_date: p.target_review_date,
      status: p.status,
    },
    { onConflict: "participant_id" }
  );
  if (error) return { ok: false, error: error.message };

  // Audit
  await sb.from("reflect_audit_log").insert({
    action: "idp.saved",
    target_table: "reflect_idps",
    target_id: p.participant_id,
    performed_by: caller.isDev ? null : caller.uid,
    metadata: {
      status: p.status,
      priority_count: p.top_priorities.length,
      action_count: p.action_plan.length,
    },
  });

  revalidatePath(`/reflect/consultant/participants/${p.participant_id}/idp`);
  return { ok: true };
}


export async function signOffReflectIdp(participantId: string) {
  let caller;
  try {
    caller = await requireParticipantOwner(participantId);
  } catch (e) {
    return authErr(e);
  }

  const sb = createServiceClient();
  const now = new Date().toISOString();
  const { error } = await sb
    .from("reflect_idps")
    .update({ status: "agreed", signed_off_at: now })
    .eq("participant_id", participantId);
  if (error) return { ok: false, error: error.message };

  await sb.from("reflect_audit_log").insert({
    action: "idp.signed_off",
    target_table: "reflect_idps",
    target_id: participantId,
    performed_by: caller.isDev ? null : caller.uid,
    metadata: { signed_off_at: now },
  });

  revalidatePath(`/reflect/consultant/participants/${participantId}/idp`);
  return { ok: true };
}


// ──────────────────────────────────────────────────────────────
// Debrief ops — assign coach, set scheduled date, set status.
// All three on the participant row, no separate table.
// ──────────────────────────────────────────────────────────────

const debriefUpdateSchema = z.object({
  participant_id: z.string().uuid(),
  debrief_status: z.enum(["not_scheduled", "scheduled", "completed", "no_show"]).optional(),
  debrief_scheduled_at: z.string().nullable().optional(),
  assigned_coach_email: z.string().trim().email().nullable().optional(),
});

export type DebriefUpdatePayload = z.infer<typeof debriefUpdateSchema>;

export async function updateReflectDebrief(payload: DebriefUpdatePayload) {
  let caller;
  try {
    caller = await requireParticipantOwner(payload.participant_id);
  } catch (e) {
    return authErr(e);
  }

  const parsed = debriefUpdateSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const p = parsed.data;

  const sb = createServiceClient();

  // Resolve coach email -> uid (if email provided). In dev mode the
  // profiles table may not exist or may be sparse; we fall back to
  // storing NULL when no match is found so the UI doesn't break.
  let assigned_coach_id: string | null | undefined = undefined;
  if (p.assigned_coach_email !== undefined) {
    if (p.assigned_coach_email === null) {
      assigned_coach_id = null;
    } else {
      const { data: profile } = await sb
        .from("profiles")
        .select("id")
        .eq("email", p.assigned_coach_email)
        .maybeSingle<{ id: string }>();
      assigned_coach_id = profile?.id ?? null;
    }
  }

  const update: Record<string, unknown> = {};
  if (p.debrief_status !== undefined) update.debrief_status = p.debrief_status;
  if (p.debrief_scheduled_at !== undefined) update.debrief_scheduled_at = p.debrief_scheduled_at;
  if (assigned_coach_id !== undefined) update.assigned_coach_id = assigned_coach_id;
  if (p.debrief_status === "completed" && !("debrief_completed_at" in update)) {
    update.debrief_completed_at = new Date().toISOString();
  }

  if (Object.keys(update).length === 0) {
    return { ok: false, error: "Nothing to update" };
  }

  const { error } = await sb
    .from("reflect_participants")
    .update(update)
    .eq("id", p.participant_id);
  if (error) return { ok: false, error: error.message };

  await sb.from("reflect_audit_log").insert({
    action: "debrief.updated",
    target_table: "reflect_participants",
    target_id: p.participant_id,
    performed_by: caller.isDev ? null : caller.uid,
    metadata: update,
  });

  // Revalidate the engagement detail page for the participant's engagement.
  const { data: part } = await sb
    .from("reflect_participants")
    .select("engagement_id")
    .eq("id", p.participant_id)
    .maybeSingle<{ engagement_id: string }>();
  if (part) revalidatePath(`/reflect/consultant/engagements/${part.engagement_id}`);

  return { ok: true };
}
