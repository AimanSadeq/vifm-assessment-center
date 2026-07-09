"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import {
  requireRole,
  isAuthorizationError,
} from "@/lib/ara/auth-guards";

function authErr(e: unknown) {
  if (isAuthorizationError(e)) return { ok: false as const, error: e.message };
  throw e;
}

type EditResult = { ok: true } | { ok: false; error: string };

/** Edit a library-template behaviour's EN/AR wording (the rater "question").
 *  Templates are the master content cloned per engagement, so an edit just
 *  updates the wording - the review gate is per-engagement, not per-template. */
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
  const { error } = await sb.from("reflect_behaviors").update(patch).eq("id", input.behaviourId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/reflect/admin/templates/[id]", "page");
  return { ok: true };
}

/** Edit a library-template competency's EN/AR name. */
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
  const { error } = await sb.from("reflect_competencies").update(patch).eq("id", input.competencyId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/reflect/admin/templates/[id]", "page");
  return { ok: true };
}

// ──────────────────────────────────────────────────────────────
// Sandbox purge - irreversibly deletes every reflect_engagement with
// is_sandbox=true. Cascades drop the framework, participants, raters,
// responses, IDPs, reports, and email/audit log rows. Same posture as
// /ara/admin/sandbox: require a typed confirmation phrase so the
// destructive button can't be triggered by accident.
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
  const { data, error } = await sb
    .from("reflect_engagements")
    .delete()
    .eq("is_sandbox", true)
    .select("id");
  if (error) return { ok: false, error: error.message };

  const deleted = data?.length ?? 0;

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
  const { data, error } = await sb
    .from("reflect_engagements")
    .delete()
    .eq("status", "archived")
    .lt("archived_at", cutoff)
    .select("id");
  if (error) return { ok: false, error: error.message };

  const deleted = data?.length ?? 0;

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
