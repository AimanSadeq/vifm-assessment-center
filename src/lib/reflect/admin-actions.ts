"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { fetchAllPages, chunkIds } from "@/lib/ara/paginate";
import {
  requireRole,
  isAuthorizationError,
} from "@/lib/ara/auth-guards";

function authErr(e: unknown) {
  if (isAuthorizationError(e)) return { ok: false as const, error: e.message };
  throw e;
}

type EditResult = { ok: true } | { ok: false; error: string };

/**
 * True when a framework id is a LIBRARY TEMPLATE (engagement_id IS NULL AND
 * is_template). The admin template editor must only touch template content -
 * without this a raw competency/behaviour id from a LIVE engagement's copied
 * framework could be rewritten under already-recorded rater responses,
 * bypassing the per-engagement FRAMEWORK_LOCKED + completed-response
 * immutability gates in actions.ts.
 */
async function isTemplateFramework(
  sb: ReturnType<typeof createServiceClient>,
  frameworkId: string | null | undefined,
): Promise<boolean> {
  if (!frameworkId) return false;
  const { data } = await sb
    .from("reflect_frameworks")
    .select("engagement_id, is_template")
    .eq("id", frameworkId)
    .maybeSingle<{ engagement_id: string | null; is_template: boolean }>();
  return !!data && data.engagement_id === null && data.is_template === true;
}

/** Edit a library-template behaviour's EN/AR wording (the rater "question").
 *  Templates are the master content cloned per engagement, so an edit just
 *  updates the wording - the review gate is per-engagement, not per-template.
 *  SCOPED to template frameworks: a behaviour belonging to a live engagement's
 *  copied framework is refused (its responses are immutable). */
export async function updateReflectBehaviourAction(input: {
  behaviourId: string;
  text_en?: string;
  text_ar?: string;
}): Promise<EditResult> {
  try {
    await requireRole("admin");
  } catch (e) {
    return authErr(e);
  }
  const patch: Record<string, unknown> = {};
  if (typeof input.text_en === "string" && input.text_en.trim()) patch.text_en = input.text_en.trim();
  if (typeof input.text_ar === "string") patch.text_ar = input.text_ar.trim() || null;
  if (Object.keys(patch).length === 0) return { ok: false, error: "Nothing to update." };

  const sb = createServiceClient();
  // Resolve behaviour -> competency -> framework and confirm it's a template.
  const { data: beh } = await sb
    .from("reflect_behaviors")
    .select("competency_id")
    .eq("id", input.behaviourId)
    .maybeSingle<{ competency_id: string }>();
  const { data: comp } = beh
    ? await sb.from("reflect_competencies").select("framework_id").eq("id", beh.competency_id).maybeSingle<{ framework_id: string }>()
    : { data: null };
  if (!(await isTemplateFramework(sb, comp?.framework_id))) {
    return { ok: false, error: "Only library-template content can be edited here." };
  }

  const { error } = await sb.from("reflect_behaviors").update(patch).eq("id", input.behaviourId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/reflect/admin/templates/[id]", "page");
  return { ok: true };
}

/** Edit a library-template competency's EN/AR name. SCOPED to templates. */
export async function updateReflectCompetencyAction(input: {
  competencyId: string;
  name_en?: string;
  name_ar?: string;
}): Promise<EditResult> {
  try {
    await requireRole("admin");
  } catch (e) {
    return authErr(e);
  }
  const patch: Record<string, unknown> = {};
  if (typeof input.name_en === "string" && input.name_en.trim()) patch.name_en = input.name_en.trim();
  if (typeof input.name_ar === "string") patch.name_ar = input.name_ar.trim() || null;
  if (Object.keys(patch).length === 0) return { ok: false, error: "Nothing to update." };

  const sb = createServiceClient();
  const { data: comp } = await sb
    .from("reflect_competencies")
    .select("framework_id")
    .eq("id", input.competencyId)
    .maybeSingle<{ framework_id: string }>();
  if (!(await isTemplateFramework(sb, comp?.framework_id))) {
    return { ok: false, error: "Only library-template content can be edited here." };
  }

  const { error } = await sb.from("reflect_competencies").update(patch).eq("id", input.competencyId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/reflect/admin/templates/[id]", "page");
  return { ok: true };
}

/**
 * Delete the collateral that does NOT cascade with a reflect_engagement.
 * reflect_email_log's engagement/participant/rater FKs are ON DELETE SET NULL
 * (migration 00032), so its rows - carrying recipient_email rater PII - would
 * otherwise SURVIVE the purge forever with nulled FKs, becoming orphaned PII
 * readable by every consultant (the log's RLS grants SELECT on NULL
 * engagement_id). MUST run BEFORE the engagement delete, while the FK still
 * points at it. Best-effort per step (a log hiccup must not abort the purge),
 * loudly logged.
 */
async function deleteReflectEngagementCollateral(
  sb: ReturnType<typeof createServiceClient>,
  engagementIds: string[],
): Promise<void> {
  if (engagementIds.length === 0) return;
  for (const ids of chunkIds(engagementIds)) {
    const { error } = await sb.from("reflect_email_log").delete().in("engagement_id", ids);
    if (error) console.error("[reflect purge] email-log cleanup failed:", error.message);
  }
}

/**
 * Delete the engagements (+ their non-cascading collateral) for a set of ids
 * that may exceed the 1000-row cap. The id-capture is paginated by the caller;
 * this chunks both the collateral scrub and the delete-by-id (a 1000-uuid
 * in() is also a ~37KB URL). Returns the total deleted count. Mirrors the
 * old direct delete().eq() which had no cap - the select-ids-first refactor
 * must not silently cap at 1000.
 */
async function purgeReflectEngagementsByIds(
  sb: ReturnType<typeof createServiceClient>,
  engagementIds: string[],
): Promise<{ deleted: number; error?: string }> {
  await deleteReflectEngagementCollateral(sb, engagementIds);
  let deleted = 0;
  for (const ids of chunkIds(engagementIds)) {
    const { data, error } = await sb
      .from("reflect_engagements")
      .delete()
      .in("id", ids)
      .select("id");
    if (error) return { deleted, error: error.message };
    deleted += data?.length ?? 0;
  }
  return { deleted };
}

// ──────────────────────────────────────────────────────────────
// Sandbox purge - irreversibly deletes every reflect_engagement with
// is_sandbox=true. Cascades drop the framework, participants, raters,
// responses, IDPs, reports, and the AUDIT log; the email log is deleted
// explicitly first (its FK is SET NULL, not CASCADE - see above). Same
// posture as /ara/admin/sandbox: require a typed confirmation phrase.
// ──────────────────────────────────────────────────────────────

const purgeSandboxSchema = z.object({
  confirmation: z.literal("DELETE SANDBOX DATA"),
});

export async function purgeReflectSandboxEngagements(
  confirmation: string
): Promise<
  | { ok: true; deleted: number }
  | { ok: false; error: string }
> {
  let caller;
  try {
    caller = await requireRole("admin");
  } catch (e) {
    return authErr(e);
  }

  const parsed = purgeSandboxSchema.safeParse({ confirmation });
  if (!parsed.success) {
    return { ok: false, error: "Type DELETE SANDBOX DATA to confirm" };
  }

  const sb = createServiceClient();
  // Capture the target ids first (PAGINATED - the driving select is itself
  // capped at 1000, so an unpaginated capture would under-delete + mis-count
  // a >1000 purge) so we can scrub the non-cascading email-log PII before the
  // delete nulls its FKs.
  const ids = (
    await fetchAllPages<{ id: string }>((from, to) =>
      sb.from("reflect_engagements").select("id").eq("is_sandbox", true).order("id").range(from, to)
    ).catch((): { id: string }[] => [])
  ).map((r) => r.id);
  if (ids.length === 0) return { ok: true, deleted: 0 };

  const res = await purgeReflectEngagementsByIds(sb, ids);
  if (res.error) return { ok: false, error: res.error };
  const deleted = res.deleted;

  await sb.from("reflect_audit_log").insert({
    action: "admin.sandbox_purged",
    target_table: "reflect_engagements",
    target_id: "00000000-0000-0000-0000-000000000000",
    performed_by: caller.isDev ? null : caller.uid,
    metadata: { deleted_count: deleted },
  });

  revalidatePath("/reflect/admin");
  return { ok: true, deleted };
}


// ──────────────────────────────────────────────────────────────
// Retention purge - irreversibly deletes archived engagements whose
// archived_at is older than N years. Default 2 to match the project's
// retention policy. Same typed-confirmation pattern.
// ──────────────────────────────────────────────────────────────

const purgeRetentionSchema = z.object({
  confirmation: z.literal("DELETE OLD ENGAGEMENTS"),
  olderThanYears: z.number().int().min(1).max(10).default(2),
});

export async function purgeReflectArchivedEngagements(input: {
  confirmation: string;
  olderThanYears?: number;
}): Promise<
  | { ok: true; deleted: number }
  | { ok: false; error: string }
> {
  let caller;
  try {
    caller = await requireRole("admin");
  } catch (e) {
    return authErr(e);
  }

  const parsed = purgeRetentionSchema.safeParse({
    confirmation: input.confirmation,
    olderThanYears: input.olderThanYears ?? 2,
  });
  if (!parsed.success) {
    return { ok: false, error: "Type DELETE OLD ENGAGEMENTS to confirm" };
  }

  const cutoff = new Date(
    Date.now() - parsed.data.olderThanYears * 365 * 24 * 60 * 60 * 1000
  ).toISOString();

  const sb = createServiceClient();
  // Paginated id-capture (see the sandbox purge) so a >1000 retention purge
  // deletes everything + reports the true count.
  const ids = (
    await fetchAllPages<{ id: string }>((from, to) =>
      sb
        .from("reflect_engagements")
        .select("id")
        .eq("status", "archived")
        .lt("archived_at", cutoff)
        .order("id")
        .range(from, to)
    ).catch((): { id: string }[] => [])
  ).map((r) => r.id);
  if (ids.length === 0) return { ok: true, deleted: 0 };

  const res = await purgeReflectEngagementsByIds(sb, ids);
  if (res.error) return { ok: false, error: res.error };
  const deleted = res.deleted;

  await sb.from("reflect_audit_log").insert({
    action: "admin.retention_purged",
    target_table: "reflect_engagements",
    target_id: "00000000-0000-0000-0000-000000000000",
    performed_by: caller.isDev ? null : caller.uid,
    metadata: { deleted_count: deleted, older_than_years: parsed.data.olderThanYears },
  });

  revalidatePath("/reflect/admin");
  return { ok: true, deleted };
}
