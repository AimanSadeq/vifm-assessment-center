// ARA retention-purge core - a PLAIN module, deliberately NOT "use server".
//
// runRetentionPurge used to live in admin-actions.ts ("use server"), where
// every export compiles into a callable server-action endpoint - and this
// function intentionally carries no auth check (its callers gate it: the admin
// form action via requireRole + typed confirmation, the cron route via a
// CRON_SECRET bearer). Moving it here removes the unguarded endpoint without
// changing either legitimate caller.
//
// The purge also owns the two "deletes too little" gaps the review found:
//   - uploaded supporting-material FILES in the private ara-materials Storage
//     bucket (the DB rows cascade away with the assessment, orphaning the
//     blobs - the most sensitive artifacts survive the PDPL purge), and
//   - ara_email_log rows, whose assessment_id FK is ON DELETE SET NULL while
//     recipient_email is NOT NULL - so purged assessments left orphaned rows
//     carrying real respondent email addresses forever.

import { createServiceClient } from "@/lib/supabase/server";
import { fetchAllPages, chunkIds } from "@/lib/ara/paginate";
import { ARA_RETENTION_YEARS } from "@/lib/constants/ara-retention";

const MATERIALS_BUCKET = "ara-materials";

/**
 * Delete the collateral that does NOT cascade with ara_assessments:
 * Storage files for uploaded supporting materials + email-log rows.
 * Best-effort per step (a Storage hiccup must not abort the purge - the
 * DB delete is the compliance-critical part), but loudly logged.
 * MUST run BEFORE the assessments are deleted: the materials rows (which
 * hold the file paths) cascade away, and the email-log FKs null out.
 */
export async function deleteAssessmentCollateral(
  sb: ReturnType<typeof createServiceClient>,
  assessmentIds: string[]
): Promise<void> {
  if (assessmentIds.length === 0) return;

  // 1. Storage files: collect the stored paths (file_url is the bucket path
  //    for non-url materials), then remove in batches.
  try {
    const paths: string[] = [];
    for (const ids of chunkIds(assessmentIds)) {
      const rows = await fetchAllPages<{ file_url: string | null; material_type: string }>((from, to) =>
        sb
          .from("ara_supporting_materials")
          .select("file_url, material_type")
          .in("assessment_id", ids)
          .order("id")
          .range(from, to)
      );
      for (const r of rows) {
        if (r.material_type !== "url" && r.file_url) paths.push(r.file_url);
      }
    }
    for (const batch of chunkIds(paths, 100)) {
      const { error } = await sb.storage.from(MATERIALS_BUCKET).remove(batch);
      if (error) console.error("[ara retention] storage removal failed for a batch:", error.message);
    }
  } catch (e) {
    console.error("[ara retention] supporting-material storage cleanup failed:", e);
  }

  // 2. Email log: delete outright - the assessment (and its respondents'
  //    PII) is being erased, so the send log's recipient addresses go too.
  try {
    for (const ids of chunkIds(assessmentIds)) {
      const { error } = await sb.from("ara_email_log").delete().in("assessment_id", ids);
      if (error) console.error("[ara retention] email-log cleanup failed:", error.message);
    }
  } catch (e) {
    console.error("[ara retention] email-log cleanup failed:", e);
  }
}

/**
 * Core retention-purge logic - no auth check inside, so it can be called from
 * BOTH the admin form action (which gates on requireRole + confirmation
 * string) AND the cron route (which gates on a CRON_SECRET bearer). Always
 * uses service-role + audit-logs every deletion regardless of trigger.
 *
 * Hard-deletes archived assessments whose archived_at is older than
 * ARA_RETENTION_YEARS (2-year PDPL max). Generated reports are detached, not
 * deleted (§15.3 - VIFM business records). Supporting-material Storage files
 * and email-log rows are removed (see deleteAssessmentCollateral).
 */
export async function runRetentionPurge(
  trigger: "admin" | "cron"
): Promise<{ ok: true; deleted: number } | { ok: false; error: string }> {
  const sb = createServiceClient();
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - ARA_RETENTION_YEARS);
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

  // Storage files + email-log rows BEFORE the cascade erases the pointers.
  await deleteAssessmentCollateral(sb, ids);

  const { error: delErr } = await sb
    .from("ara_assessments")
    .delete()
    .in("id", ids);
  if (delErr) return { ok: false, error: delErr.message };

  // Audit log - record trigger so admin-triggered vs cron-triggered
  // runs are distinguishable downstream.
  const { error: auditErr } = await sb.from("ara_data_management_log").insert(
    ids.map((id) => ({
      action: "retention_purge",
      target_table: "ara_assessments",
      target_id: id,
      reason: `Archived > ${ARA_RETENTION_YEARS} years (trigger: ${trigger})`,
      client_request: false,
    }))
  );
  if (auditErr) console.error("[ara retention] audit-log write failed:", auditErr.message);

  return { ok: true, deleted: ids.length };
}
