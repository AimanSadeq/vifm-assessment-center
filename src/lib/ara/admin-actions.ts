"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { requireRole, isAuthorizationError } from "@/lib/ara/auth-guards";

function authErr(e: unknown) {
  if (isAuthorizationError(e)) return { ok: false as const, error: e.message };
  throw e;
}

// ─────────────────────────────────────────────────────────────
// Regulatory document upload + Claude requirement extraction (M4.6)
// Admin uploads a PDF policy document; Claude reads it and emits
// structured requirements which we insert under the chosen framework.
// ─────────────────────────────────────────────────────────────
export async function uploadAraRegulatoryDocument(formData: FormData) {
  try { await requireRole("admin"); } catch (e) { return authErr(e); }

  const frameworkId = String(formData.get("framework_id") ?? "");
  const documentName = String(formData.get("document_name") ?? "").trim();
  const file = formData.get("file");

  if (!frameworkId) return { ok: false, error: "Choose a framework" };
  if (!documentName) return { ok: false, error: "Document name is required" };
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choose a PDF file" };
  if (!file.name.toLowerCase().endsWith(".pdf")) return { ok: false, error: "File must be a PDF" };
  // 32MB is the Claude API document block limit.
  if (file.size > 32 * 1024 * 1024) return { ok: false, error: "PDF must be 32MB or smaller" };

  const sb = createServiceClient();

  // Look up the framework so we know region + framework_code for the
  // Claude prompt and for the requirement codes.
  const { data: framework } = await sb
    .from("ara_regulatory_frameworks")
    .select("id, region, framework_code")
    .eq("id", frameworkId)
    .maybeSingle<{ id: string; region: "uae" | "saudi"; framework_code: string }>();
  if (!framework) return { ok: false, error: "Framework not found" };

  // Insert the document row first so it appears in the list while we
  // process. status starts at 'processing' and flips to 'review' on
  // success or 'rejected' on failure.
  const { data: docRow, error: docErr } = await sb
    .from("ara_regulatory_documents")
    .insert({
      region: framework.region,
      document_name_en: documentName,
      framework_category: null,
      file_name: file.name,
      processing_status: "processing",
      is_active: true,
    })
    .select("id")
    .single<{ id: string }>();
  if (docErr || !docRow) return { ok: false, error: docErr?.message ?? "Insert failed" };

  // Read PDF as base64 for Claude's document block. ArrayBuffer →
  // Buffer → base64. Server-side only.
  const buffer = Buffer.from(await file.arrayBuffer());
  const pdfBase64 = buffer.toString("base64");

  const { extractRegulatoryRequirementsFromPdf } = await import("@/lib/ai/regulatory-extractor");
  const extracted = await extractRegulatoryRequirementsFromPdf(
    pdfBase64,
    framework.framework_code,
    framework.region
  );

  if (!extracted) {
    await sb
      .from("ara_regulatory_documents")
      .update({ processing_status: "rejected", notes: "Claude API key missing or extraction failed" })
      .eq("id", docRow.id);
    revalidatePath("/ara/admin/regulatory");
    return {
      ok: false,
      error: "Extraction unavailable. Set ANTHROPIC_API_KEY in .env.local and retry.",
    };
  }

  if (extracted.length === 0) {
    await sb
      .from("ara_regulatory_documents")
      .update({ processing_status: "review", notes: "No extractable requirements detected" })
      .eq("id", docRow.id);
    revalidatePath("/ara/admin/regulatory");
    return { ok: true, inserted: 0, document_id: docRow.id };
  }

  // Insert each requirement against the chosen framework. We swallow
  // unique-constraint collisions on requirement_code (existing requirement
  // already imported) by upserting on the unique key.
  const rows = extracted.map((r, i) => ({
    framework_id: framework.id,
    requirement_code: r.requirement_code,
    requirement_text_en: r.requirement_text_en,
    requirement_text_ar: r.requirement_text_ar,
    requirement_category: r.requirement_category,
    pillar_id: r.pillar_id,
    severity: r.severity,
    display_order: i,
  }));
  const { error: reqErr } = await sb
    .from("ara_regulatory_requirements")
    .upsert(rows, { onConflict: "requirement_code" });
  if (reqErr) {
    await sb
      .from("ara_regulatory_documents")
      .update({ processing_status: "rejected", notes: `Insert failed: ${reqErr.message}` })
      .eq("id", docRow.id);
    return { ok: false, error: reqErr.message };
  }

  await sb
    .from("ara_regulatory_documents")
    .update({
      processing_status: "review",
      notes: `Extracted ${rows.length} requirement(s). Review before approving.`,
    })
    .eq("id", docRow.id);

  revalidatePath("/ara/admin/regulatory");
  return { ok: true, inserted: rows.length, document_id: docRow.id };
}

export async function deleteAraRegulatoryDocument(documentId: string) {
  try { await requireRole("admin"); } catch (e) { return authErr(e); }
  const sb = createServiceClient();
  const { error } = await sb.from("ara_regulatory_documents").delete().eq("id", documentId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/ara/admin/regulatory");
  return { ok: true };
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

/**
 * Core retention-purge logic - no auth check inside, so it can be
 * called from BOTH the admin form action (which gates on
 * requireRole + confirmation string) AND a system-triggered cron
 * route (which gates on a CRON_SECRET bearer header). Always uses
 * service-role + audit-logs every deletion regardless of trigger.
 *
 * The `trigger` param distinguishes admin vs cron in the audit log
 * so we can later trace which run touched what.
 */
export async function runRetentionPurge(
  trigger: "admin" | "cron"
): Promise<{ ok: true; deleted: number } | { ok: false; error: string }> {
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

  // Audit log - record trigger so admin-triggered vs cron-triggered
  // runs are distinguishable downstream.
  await sb.from("ara_data_management_log").insert(
    ids.map((id) => ({
      action: "retention_purge",
      target_table: "ara_assessments",
      target_id: id,
      reason: `Archived > ${RETENTION_YEARS} years (trigger: ${trigger})`,
      client_request: false,
    }))
  );

  return { ok: true, deleted: ids.length };
}

export async function purgeAraExpiredAssessments(formData: FormData) {
  try { await requireRole("admin"); } catch (e) { return authErr(e); }
  const confirmation = String(formData.get("confirmation") ?? "").trim();
  if (confirmation !== "PURGE EXPIRED DATA") {
    return { ok: false, error: 'Type "PURGE EXPIRED DATA" exactly to confirm.' };
  }

  const result = await runRetentionPurge("admin");
  if (!result.ok) return result;

  revalidatePath("/ara/admin/retention");
  revalidatePath("/ara/consultant");
  return { ok: true, deleted: result.deleted };
}

