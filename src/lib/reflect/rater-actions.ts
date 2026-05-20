"use server";

import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { findRaterByToken } from "./rater-access";
import { sendReflectEmail, roleLabel } from "./email";

// ──────────────────────────────────────────────────────────────
// Internal: validate token + return the rater row. Never trust
// the client to send rater_id — always derive from the token.
// Also enforces that the engagement is in 'live' status, so we
// can't accept new responses once the field window has closed.
// ──────────────────────────────────────────────────────────────

async function requireRater(token: string) {
  const rater = await findRaterByToken(token);
  if (!rater) throw new Error("Invalid access token");
  if (rater.status === "completed") {
    throw new Error("This response has already been submitted");
  }
  const sb = createServiceClient();
  const { data: participant } = await sb
    .from("reflect_participants")
    .select("id, engagement_id")
    .eq("id", rater.participant_id)
    .maybeSingle<{ id: string; engagement_id: string }>();
  if (!participant) throw new Error("Participant missing");

  const { data: engagement } = await sb
    .from("reflect_engagements")
    .select("id, status")
    .eq("id", participant.engagement_id)
    .maybeSingle<{ id: string; status: string }>();
  if (!engagement) throw new Error("Engagement missing");
  if (!["draft", "live"].includes(engagement.status)) {
    throw new Error(`Engagement is ${engagement.status} — cannot accept new responses`);
  }

  return { rater, participantId: participant.id, engagementId: engagement.id };
}

// ──────────────────────────────────────────────────────────────
// Touch: bump first_opened_at + last_active_at when the rater
// opens the form. Idempotent.
// ──────────────────────────────────────────────────────────────

export async function touchReflectRater(token: string): Promise<void> {
  let rater;
  try {
    rater = (await requireRater(token)).rater;
  } catch {
    return;
  }
  const sb = createServiceClient();
  const now = new Date().toISOString();
  await sb
    .from("reflect_raters")
    .update({
      first_opened_at: rater.first_opened_at ?? now,
      last_active_at: now,
      status: rater.status === "pending" ? "started" : rater.status,
    })
    .eq("id", rater.id);
}

// ──────────────────────────────────────────────────────────────
// Save a single response. Validates behavior_id belongs to the
// framework of the rater's engagement. is_na rules: if is_na is
// true, score must be null; otherwise score is required and in
// [1, 5]. comment_text is always optional.
// ──────────────────────────────────────────────────────────────

const saveResponseSchema = z.object({
  token: z.string().min(1),
  behavior_id: z.string().uuid(),
  score: z.number().int().min(1).max(5).nullable(),
  is_na: z.boolean(),
  comment_text: z.string().trim().max(2000).nullable().optional(),
});

export type SaveResponseResult =
  | { ok: true }
  | { ok: false; error: string };

export async function saveReflectResponse(
  input: z.infer<typeof saveResponseSchema>
): Promise<SaveResponseResult> {
  const parsed = saveResponseSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const p = parsed.data;

  // Self-consistency: is_na true ⇒ score null
  if (p.is_na && p.score !== null) {
    return { ok: false, error: "N/A responses cannot have a score" };
  }
  if (!p.is_na && p.score === null) {
    return { ok: false, error: "Score required when not N/A" };
  }

  let ctx;
  try {
    ctx = await requireRater(p.token);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Token failed" };
  }

  // Validate behavior_id belongs to the rater's engagement framework
  const sb = createServiceClient();
  const { data: beh } = await sb
    .from("reflect_behaviors")
    .select("id, reflect_competencies!inner(framework_id, reflect_frameworks!inner(engagement_id))")
    .eq("id", p.behavior_id)
    .maybeSingle<{
      id: string;
      reflect_competencies: {
        framework_id: string;
        reflect_frameworks: { engagement_id: string };
      };
    }>();

  if (!beh) return { ok: false, error: "Behaviour not found" };
  if (beh.reflect_competencies.reflect_frameworks.engagement_id !== ctx.engagementId) {
    return { ok: false, error: "Behaviour does not belong to this engagement" };
  }

  const { error } = await sb
    .from("reflect_responses")
    .upsert(
      {
        rater_id: ctx.rater.id,
        behavior_id: p.behavior_id,
        score: p.is_na ? null : p.score,
        is_na: p.is_na,
        comment_text: p.comment_text ?? null,
        answered_at: new Date().toISOString(),
      },
      { onConflict: "rater_id,behavior_id" }
    );
  if (error) return { ok: false, error: error.message };

  // Bump last_active_at only. Do NOT write `status` here — touchReflectRater
  // owns the pending → started transition, and markReflectRaterComplete owns
  // the started → completed transition. Writing status from every save can
  // race with markComplete and silently revert a completed rater back to
  // started if a slow save finishes after the submit gate.
  await sb
    .from("reflect_raters")
    .update({ last_active_at: new Date().toISOString() })
    .eq("id", ctx.rater.id)
    .neq("status", "completed");

  return { ok: true };
}

// ──────────────────────────────────────────────────────────────
// Save Start / Stop / Continue open-ended answer. Each kind maps
// to its own column on reflect_raters. Empty string clears the
// column to NULL so the report never renders blank verbatims.
// Same lifecycle rules as saveReflectResponse: token must be valid
// and the rater not yet completed. Bumps last_active_at without
// writing status.
// ──────────────────────────────────────────────────────────────

const saveOpenResponseSchema = z.object({
  token: z.string().min(1),
  kind: z.enum(["start", "stop", "continue"]),
  text: z.string().max(2000),
});

export type SaveOpenResponseResult =
  | { ok: true }
  | { ok: false; error: string };

export async function saveReflectOpenResponse(
  input: z.infer<typeof saveOpenResponseSchema>
): Promise<SaveOpenResponseResult> {
  const parsed = saveOpenResponseSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const p = parsed.data;

  let ctx;
  try {
    ctx = await requireRater(p.token);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Token failed" };
  }

  const colByKind = {
    start: "open_start",
    stop: "open_stop",
    continue: "open_continue",
  } as const;
  const col = colByKind[p.kind];
  const trimmed = p.text.trim();

  const sb = createServiceClient();
  const { error } = await sb
    .from("reflect_raters")
    .update({
      [col]: trimmed.length === 0 ? null : trimmed,
      last_active_at: new Date().toISOString(),
    })
    .eq("id", ctx.rater.id)
    .neq("status", "completed");

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}


// ──────────────────────────────────────────────────────────────
// Save the rater's tenure (P2 parity pass). "How long have you
// worked with this person?" — one of four buckets. NULL clears
// the value if the rater changes their mind.
// ──────────────────────────────────────────────────────────────

const saveTenureSchema = z.object({
  token: z.string().min(1),
  tenure: z
    .enum(["less_than_6mo", "six_mo_to_2yr", "two_to_5yr", "over_5yr"])
    .nullable(),
});

export type SaveTenureResult = { ok: true } | { ok: false; error: string };

export async function saveReflectRaterTenure(
  input: z.infer<typeof saveTenureSchema>
): Promise<SaveTenureResult> {
  const parsed = saveTenureSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const p = parsed.data;

  let ctx;
  try {
    ctx = await requireRater(p.token);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Token failed" };
  }

  const sb = createServiceClient();
  const { error } = await sb
    .from("reflect_raters")
    .update({
      tenure: p.tenure,
      last_active_at: new Date().toISOString(),
    })
    .eq("id", ctx.rater.id)
    .neq("status", "completed");
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}


// ──────────────────────────────────────────────────────────────
// Save the Self/Manager rater's critical-competency picks (P1
// parity pass). Validates every pick is a real competency_id from
// THIS engagement's framework. Refuses the call when the rater is
// not self or manager — those are the only two roles a 360
// typically asks "what's role-critical?".
// ──────────────────────────────────────────────────────────────

const saveCriticalPicksSchema = z.object({
  token: z.string().min(1),
  competency_ids: z.array(z.string().uuid()),
});

export type SaveCriticalPicksResult =
  | { ok: true }
  | { ok: false; error: string };

export async function saveReflectCriticalPicks(
  input: z.infer<typeof saveCriticalPicksSchema>
): Promise<SaveCriticalPicksResult> {
  const parsed = saveCriticalPicksSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const p = parsed.data;

  let ctx;
  try {
    ctx = await requireRater(p.token);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Token failed" };
  }

  // Critical-competency picks only make sense for Self + Manager. Block
  // peer / direct_report / skip_level / other so we never store noise
  // that would skew the alignment % computation.
  if (ctx.rater.rater_role !== "self" && ctx.rater.rater_role !== "manager") {
    return { ok: false, error: "Critical-competency picks are only collected from Self and Manager raters" };
  }

  const sb = createServiceClient();

  // Validate every pick really belongs to THIS engagement's framework.
  if (p.competency_ids.length > 0) {
    const { data: validIds } = await sb
      .from("reflect_competencies")
      .select("id, reflect_frameworks!inner(engagement_id)")
      .in("id", p.competency_ids)
      .returns<Array<{ id: string; reflect_frameworks: { engagement_id: string } }>>();
    const okIds = new Set(
      (validIds ?? [])
        .filter((c) => c.reflect_frameworks.engagement_id === ctx.engagementId)
        .map((c) => c.id)
    );
    if (okIds.size !== p.competency_ids.length) {
      return { ok: false, error: "One or more picks don't belong to this engagement" };
    }
  }

  const { error } = await sb
    .from("reflect_raters")
    .update({
      critical_competency_ids: p.competency_ids,
      last_active_at: new Date().toISOString(),
    })
    .eq("id", ctx.rater.id)
    .neq("status", "completed");
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}


// ──────────────────────────────────────────────────────────────
// Mark the rater as complete. Idempotent — calling twice on an
// already-completed rater is a no-op success.
// ──────────────────────────────────────────────────────────────

export async function markReflectRaterComplete(
  token: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  let ctx;
  try {
    ctx = await requireRater(token);
  } catch (err) {
    // If already-completed, treat as success — common race when the
    // submit-flush gate fires after a slow autosave.
    if (err instanceof Error && err.message.includes("already been submitted")) {
      return { ok: true };
    }
    return { ok: false, error: err instanceof Error ? err.message : "Token failed" };
  }

  const sb = createServiceClient();
  const now = new Date().toISOString();
  const { error } = await sb
    .from("reflect_raters")
    .update({ status: "completed", completed_at: now, last_active_at: now })
    .eq("id", ctx.rater.id);
  if (error) return { ok: false, error: error.message };

  // Audit row so the consultant dashboard can trace completions.
  await sb.from("reflect_audit_log").insert({
    action: "rater.completed",
    target_table: "reflect_raters",
    target_id: ctx.rater.id,
    metadata: {
      participant_id: ctx.participantId,
      engagement_id: ctx.engagementId,
      rater_role: ctx.rater.rater_role,
    },
  });

  // Best-effort consultant completion notice. Failures never roll back
  // the completion. Skipped silently when the engagement has no
  // resolvable consultant email (AUTH_ENABLED=false dev mode).
  await sendCompletionNoticeForRater(ctx.rater.id);

  return { ok: true };
}


// ──────────────────────────────────────────────────────────────
// Fire the consultant-facing completion notice for a single rater.
// Best-effort: silently swallows any error. Used by markComplete.
// ──────────────────────────────────────────────────────────────

async function sendCompletionNoticeForRater(raterId: string): Promise<void> {
  try {
    const sb = createServiceClient();
    const { data: rater } = await sb
      .from("reflect_raters")
      .select(
        "id, rater_role, full_name, participant_id, reflect_participants!inner(id, full_name, full_name_ar, engagement_id)"
      )
      .eq("id", raterId)
      .maybeSingle<{
        id: string;
        rater_role: "self" | "manager" | "peer" | "direct_report" | "skip_level" | "other";
        full_name: string;
        participant_id: string;
        reflect_participants: {
          id: string;
          full_name: string;
          full_name_ar: string | null;
          engagement_id: string;
        };
      }>();
    if (!rater) return;

    const { data: eng } = await sb
      .from("reflect_engagements")
      .select(
        "id, name, is_sandbox, consultant_id, default_language, ara_organizations(name, name_ar)"
      )
      .eq("id", rater.reflect_participants.engagement_id)
      .maybeSingle<{
        id: string;
        name: string;
        is_sandbox: boolean;
        consultant_id: string | null;
        default_language: "en" | "ar";
        ara_organizations: { name: string; name_ar: string | null } | null;
      }>();
    if (!eng) return;

    // Resolve the consultant's email. In dev (AUTH_ENABLED=false) the
    // engagement.consultant_id is NULL — nothing to send.
    if (!eng.consultant_id) return;
    const { data: profile } = await sb
      .from("profiles")
      .select("email, full_name")
      .eq("id", eng.consultant_id)
      .maybeSingle<{ email: string | null; full_name: string | null }>();
    if (!profile?.email) return;

    // Rollup: how many of this participant's raters are complete vs total
    const { data: siblingStatuses } = await sb
      .from("reflect_raters")
      .select("status")
      .eq("participant_id", rater.participant_id)
      .returns<Array<{ status: string }>>();
    const total = siblingStatuses?.length ?? 0;
    const completed = (siblingStatuses ?? []).filter((r) => r.status === "completed").length;

    const lang = eng.default_language;
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "";

    await sendReflectEmail({
      to: profile.email,
      emailType: "reflect_completion_notice",
      language: lang,
      isSandbox: eng.is_sandbox,
      engagementId: eng.id,
      participantId: rater.participant_id,
      raterId: rater.id,
      data: {
        consultantName: profile.full_name ?? "",
        raterName: rater.full_name,
        raterRoleLabel: roleLabel(rater.rater_role, lang),
        participantName:
          lang === "ar"
            ? rater.reflect_participants.full_name_ar ?? rater.reflect_participants.full_name
            : rater.reflect_participants.full_name,
        engagementName: eng.name,
        organizationName:
          lang === "ar"
            ? eng.ara_organizations?.name_ar ?? eng.ara_organizations?.name ?? ""
            : eng.ara_organizations?.name ?? "",
        completedCount: String(completed),
        totalCount: String(total),
        engagementUrl: `${baseUrl}/reflect/consultant/engagements/${eng.id}`,
      },
    });
  } catch (err) {
    console.error("[reflect:completion-notice] failed", err);
  }
}


// ──────────────────────────────────────────────────────────────
// Send a reminder to a single rater. Caller decides who to remind.
// ──────────────────────────────────────────────────────────────

export async function sendReflectRaterReminder(
  raterId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const sb = createServiceClient();
  const { data: rater } = await sb
    .from("reflect_raters")
    .select(
      "id, rater_role, full_name, email, language_preference, access_token, status, last_reminder_at, reminder_count, reflect_participants!inner(id, full_name, full_name_ar, engagement_id)"
    )
    .eq("id", raterId)
    .maybeSingle<{
      id: string;
      rater_role: "self" | "manager" | "peer" | "direct_report" | "skip_level" | "other";
      full_name: string;
      email: string;
      language_preference: "en" | "ar";
      access_token: string;
      status: string;
      last_reminder_at: string | null;
      reminder_count: number;
      reflect_participants: {
        id: string;
        full_name: string;
        full_name_ar: string | null;
        engagement_id: string;
      };
    }>();
  if (!rater) return { ok: false, error: "Rater not found" };
  if (rater.status === "completed" || rater.status === "declined") {
    return { ok: false, error: `Rater is ${rater.status}; no reminder needed` };
  }

  const { data: eng } = await sb
    .from("reflect_engagements")
    .select("id, name, is_sandbox, field_window_end")
    .eq("id", rater.reflect_participants.engagement_id)
    .maybeSingle<{ id: string; name: string; is_sandbox: boolean; field_window_end: string | null }>();
  if (!eng) return { ok: false, error: "Engagement not found" };

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "";

  const res = await sendReflectEmail({
    to: rater.email,
    emailType: "reflect_rater_reminder",
    language: rater.language_preference,
    isSandbox: eng.is_sandbox,
    engagementId: eng.id,
    participantId: rater.reflect_participants.id,
    raterId: rater.id,
    data: {
      raterName: rater.full_name,
      participantName:
        rater.language_preference === "ar"
          ? rater.reflect_participants.full_name_ar ?? rater.reflect_participants.full_name
          : rater.reflect_participants.full_name,
      respondentUrl: `${baseUrl}/reflect/respond/${rater.access_token}`,
      fieldWindowEnd: eng.field_window_end ?? "TBD",
    },
  });
  if (!res.ok) return { ok: false, error: res.error ?? "Send failed" };

  await sb
    .from("reflect_raters")
    .update({
      last_reminder_at: new Date().toISOString(),
      reminder_count: rater.reminder_count + 1,
    })
    .eq("id", rater.id);

  return { ok: true };
}


// ──────────────────────────────────────────────────────────────
// Bulk reminders for an engagement: every rater whose status is in
// ('pending', 'started') and who has been silent for `staleHours` hours.
// Returns counts so a cron / admin button can summarise.
// ──────────────────────────────────────────────────────────────

export async function sendReflectRemindersForEngagement(
  engagementId: string,
  options: { staleHours?: number } = {}
): Promise<{ ok: true; sent: number; skipped: number } | { ok: false; error: string }> {
  const staleHours = options.staleHours ?? 72;
  const cutoff = new Date(Date.now() - staleHours * 60 * 60 * 1000).toISOString();

  const sb = createServiceClient();
  const { data: raters } = await sb
    .from("reflect_raters")
    .select("id, status, last_active_at, last_reminder_at, reflect_participants!inner(engagement_id)")
    .eq("reflect_participants.engagement_id", engagementId)
    .in("status", ["pending", "started"])
    .returns<
      Array<{
        id: string;
        status: string;
        last_active_at: string | null;
        last_reminder_at: string | null;
      }>
    >();
  if (!raters || raters.length === 0) return { ok: true, sent: 0, skipped: 0 };

  let sent = 0;
  let skipped = 0;
  for (const r of raters) {
    // Skip if reminded recently
    if (r.last_reminder_at && r.last_reminder_at > cutoff) {
      skipped += 1;
      continue;
    }
    // Skip if active recently (no need to nag)
    if (r.last_active_at && r.last_active_at > cutoff) {
      skipped += 1;
      continue;
    }
    const res = await sendReflectRaterReminder(r.id);
    if (res.ok) sent += 1;
    else skipped += 1;
  }

  return { ok: true, sent, skipped };
}
