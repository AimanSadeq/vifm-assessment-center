"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { requireRole, isAuthorizationError } from "@/lib/ara/auth-guards";

function authErr(e: unknown) {
  if (isAuthorizationError(e)) return { ok: false as const, error: e.message };
  throw e;
}

// ─────────────────────────────────────────────────────────────
// Sandbox cleanup (handover §17.4)
// Admin must type "DELETE SANDBOX DATA" to confirm. Hard-deletes every
// sandbox assessment; cascades wipe respondents, answers, materials, etc.
// ─────────────────────────────────────────────────────────────
export async function clearAraSandboxData(formData: FormData) {
  try { await requireRole("admin"); } catch (e) { return authErr(e); }
  const confirmation = String(formData.get("confirmation") ?? "").trim();
  if (confirmation !== "DELETE SANDBOX DATA") {
    return { ok: false, error: 'Type "DELETE SANDBOX DATA" exactly to confirm.' };
  }

  const sb = createServiceClient();
  const { data: ids, error: findErr } = await sb
    .from("ara_assessments")
    .select("id")
    .eq("is_sandbox", true);
  if (findErr) return { ok: false, error: findErr.message };

  const count = ids?.length ?? 0;
  if (count === 0) {
    return { ok: true, deleted: 0 };
  }

  const { error: delErr } = await sb
    .from("ara_assessments")
    .delete()
    .eq("is_sandbox", true);
  if (delErr) return { ok: false, error: delErr.message };

  revalidatePath("/ara/admin");
  revalidatePath("/ara/admin/sandbox");
  revalidatePath("/ara/consultant");
  return { ok: true, deleted: count };
}

// ─────────────────────────────────────────────────────────────
// Retention engine - admin-triggered purge (handover §15.2)
// Hard-deletes archived assessments whose archived_at is older than
// RETENTION_YEARS. Generated reports are NOT deleted (§15.3).
// ─────────────────────────────────────────────────────────────
const RETENTION_YEARS = 3;

export async function purgeAraExpiredAssessments(formData: FormData) {
  try { await requireRole("admin"); } catch (e) { return authErr(e); }
  const confirmation = String(formData.get("confirmation") ?? "").trim();
  if (confirmation !== "PURGE EXPIRED DATA") {
    return { ok: false, error: 'Type "PURGE EXPIRED DATA" exactly to confirm.' };
  }

  const sb = createServiceClient();
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - RETENTION_YEARS);
  const cutoffIso = cutoff.toISOString();

  const { data: expired, error: findErr } = await sb
    .from("ara_assessments")
    .select("id, organization_id, archived_at")
    .eq("status", "archived")
    .lt("archived_at", cutoffIso);
  if (findErr) return { ok: false, error: findErr.message };

  const ids = (expired ?? []).map((e) => e.id);
  if (ids.length === 0) return { ok: true, deleted: 0 };

  // Detach reports so they survive the cascade delete - they are VIFM
  // business records per §15.3.
  await sb.from("ara_reports").update({ assessment_id: null }).in("assessment_id", ids);

  const { error: delErr } = await sb
    .from("ara_assessments")
    .delete()
    .in("id", ids);
  if (delErr) return { ok: false, error: delErr.message };

  // Audit log
  await sb.from("ara_data_management_log").insert(
    ids.map((id) => ({
      action: "retention_purge",
      target_table: "ara_assessments",
      target_id: id,
      reason: `Archived > ${RETENTION_YEARS} years`,
      client_request: false,
    }))
  );

  revalidatePath("/ara/admin/retention");
  revalidatePath("/ara/consultant");
  return { ok: true, deleted: ids.length };
}

