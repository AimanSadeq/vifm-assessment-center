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

// ──────────────────────────────────────────────────────────────
// Sandbox purge — irreversibly deletes every reflect_engagement with
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
// Retention purge — irreversibly deletes archived engagements whose
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
