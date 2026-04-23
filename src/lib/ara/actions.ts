"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import {
  createAraOrganizationSchema,
  createAraAssessmentSchema,
  createAraRespondentSchema,
  createAraVersionSchema,
  createAraQuestionSchema,
} from "@/lib/validations/ara";
import {
  requireRole, requireOrgAccess, requireAssessmentOwner,
  isAuthorizationError,
} from "@/lib/ara/auth-guards";

// Uniform auth-error unwrapper — server actions return a shape the UI
// can render as a toast instead of a Next error screen.
function authErr(e: unknown) {
  if (isAuthorizationError(e)) return { ok: false as const, error: e.message };
  throw e; // non-auth errors propagate to Next's error boundary
}

// ─────────────────────────────────────────────────────────────
// Organizations
// ─────────────────────────────────────────────────────────────
export async function createAraOrganization(formData: FormData) {
  let caller;
  try { caller = await requireRole(["admin", "consultant"]); } catch (e) { return authErr(e); }
  const parsed = createAraOrganizationSchema.safeParse({
    name: formData.get("name"),
    name_ar: formData.get("name_ar") || "",
    sector: formData.get("sector"),
    region: formData.get("region"),
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const sb = createServiceClient();
  const { data, error } = await sb
    .from("ara_organizations")
    .insert({
      name: parsed.data.name,
      name_ar: parsed.data.name_ar || null,
      sector: parsed.data.sector,
      region: parsed.data.region,
      // Track the creator so RLS can scope future reads per consultant.
      created_by: caller.isDev ? null : caller.uid,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };

  revalidatePath("/ara/admin/organizations");
  redirect(`/ara/admin/organizations`);
  // unreachable — redirect throws
  return { ok: true, id: data.id };
}

export async function updateAraOrganization(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, error: "Missing organization id" };
  try { await requireOrgAccess(id); } catch (e) { return authErr(e); }

  const parsed = createAraOrganizationSchema.safeParse({
    name: formData.get("name"),
    name_ar: formData.get("name_ar") || "",
    sector: formData.get("sector"),
    region: formData.get("region"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const sb = createServiceClient();
  const { error } = await sb
    .from("ara_organizations")
    .update({
      name: parsed.data.name,
      name_ar: parsed.data.name_ar || null,
      sector: parsed.data.sector,
      region: parsed.data.region,
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/ara/admin/organizations");
  revalidatePath(`/ara/admin/organizations/${id}`);
  redirect("/ara/admin/organizations");
  return { ok: true };
}

export async function deleteAraOrganization(orgId: string) {
  // Delete is strictly admin — cascades to all consultants' assessments.
  try { await requireRole("admin"); } catch (e) { return authErr(e); }
  const sb = createServiceClient();
  const { error } = await sb.from("ara_organizations").delete().eq("id", orgId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/ara/admin/organizations");
  redirect("/ara/admin/organizations");
  return { ok: true };
}

/**
 * Data-erasure operation required by UAE PDPL / Saudi PDPL / GDPR.
 * Replaces identifying fields on the organization AND all its
 * respondents with "[ANONYMIZED]", preserving structural data for
 * VIFM analytics. Writes an entry to the data management audit log.
 */
export async function anonymizeAraOrganization(orgId: string, reason: string) {
  // Data-erasure is strictly admin — logged in ara_data_management_log.
  try { await requireRole("admin"); } catch (e) { return authErr(e); }
  const sb = createServiceClient();
  const now = new Date().toISOString();

  // 1. Anonymize organization name fields
  const { error: orgErr } = await sb
    .from("ara_organizations")
    .update({
      name: "[ANONYMIZED]",
      name_ar: "[ANONYMIZED]",
      data_anonymized: true,
      data_anonymized_at: now,
    })
    .eq("id", orgId);
  if (orgErr) return { ok: false, error: orgErr.message };

  // 2. Find all assessments for this org, then anonymize their respondents
  const { data: assessments } = await sb
    .from("ara_assessments")
    .select("id")
    .eq("organization_id", orgId);

  const assessmentIds = (assessments ?? []).map((a) => a.id);
  if (assessmentIds.length > 0) {
    await sb
      .from("ara_respondents")
      .update({
        name: "[ANONYMIZED]",
        name_ar: "[ANONYMIZED]",
        email: "anonymized@example.invalid",
      })
      .in("assessment_id", assessmentIds);
  }

  // 3. Audit log
  await sb.from("ara_data_management_log").insert({
    action: "anonymize_organization",
    target_table: "ara_organizations",
    target_id: orgId,
    reason,
    client_request: true,
    performed_at: now,
  });

  revalidatePath("/ara/admin/organizations");
  revalidatePath(`/ara/admin/organizations/${orgId}`);
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────
// Assessments
// ─────────────────────────────────────────────────────────────
export async function createAraAssessment(formData: FormData) {
  let caller;
  try { caller = await requireRole(["admin", "consultant"]); } catch (e) { return authErr(e); }
  const parsed = createAraAssessmentSchema.safeParse({
    organization_id: formData.get("organization_id"),
    region: formData.get("region"),
    sector: formData.get("sector"),
    default_language: formData.get("default_language"),
    is_sandbox: formData.get("is_sandbox") === "on",
    question_bank_version_id: formData.get("question_bank_version_id") || null,
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const sb = createServiceClient();
  const { data, error } = await sb
    .from("ara_assessments")
    .insert({
      organization_id: parsed.data.organization_id,
      region: parsed.data.region,
      sector: parsed.data.sector,
      default_language: parsed.data.default_language,
      is_sandbox: parsed.data.is_sandbox,
      question_bank_version_id: parsed.data.question_bank_version_id || null,
      status: "draft",
      phase: "phase1",
      // Owner is the creating consultant (or null when an admin creates).
      consultant_id: caller.role === "consultant" && !caller.isDev ? caller.uid : null,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };

  revalidatePath("/ara/consultant");
  redirect(`/ara/consultant/assessments/${data.id}`);
  return { ok: true, id: data.id };
}

// ─────────────────────────────────────────────────────────────
// Respondents
// ─────────────────────────────────────────────────────────────
export async function createAraRespondent(formData: FormData) {
  const assessmentId = String(formData.get("assessment_id") ?? "");
  if (!assessmentId) return { ok: false, error: "Missing assessment id" };
  try { await requireAssessmentOwner(assessmentId); } catch (e) { return authErr(e); }
  const pillars = formData.getAll("pillar_assignments") as string[];

  const parsed = createAraRespondentSchema.safeParse({
    assessment_id: formData.get("assessment_id"),
    name: formData.get("name"),
    name_ar: formData.get("name_ar") || "",
    email: formData.get("email"),
    role_key: formData.get("role_key") || "",
    role_label_en: formData.get("role_label_en") || "",
    role_label_ar: formData.get("role_label_ar") || "",
    language_preference: formData.get("language_preference"),
    pillar_assignments: pillars,
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const sb = createServiceClient();
  const { data: respondent, error } = await sb
    .from("ara_respondents")
    .insert({
      assessment_id: parsed.data.assessment_id,
      name: parsed.data.name,
      name_ar: parsed.data.name_ar || null,
      email: parsed.data.email,
      role_key: parsed.data.role_key || null,
      role_label_en: parsed.data.role_label_en || null,
      role_label_ar: parsed.data.role_label_ar || null,
      language_preference: parsed.data.language_preference,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };

  if (parsed.data.pillar_assignments.length > 0) {
    const { error: paError } = await sb
      .from("ara_respondent_pillar_assignments")
      .insert(
        parsed.data.pillar_assignments.map((pillar_id) => ({
          respondent_id: respondent.id,
          pillar_id,
        }))
      );
    if (paError) return { ok: false, error: paError.message };
  }

  revalidatePath(`/ara/consultant/assessments/${parsed.data.assessment_id}`);
  return { ok: true, id: respondent.id };
}

export async function deleteAraRespondent(respondentId: string, assessmentId: string) {
  try { await requireAssessmentOwner(assessmentId); } catch (e) { return authErr(e); }
  // Belt-and-braces: verify the respondent actually belongs to this
  // assessment (caller could have mismatched IDs).
  const check = createServiceClient();
  const { data: r } = await check
    .from("ara_respondents")
    .select("id")
    .eq("id", respondentId)
    .eq("assessment_id", assessmentId)
    .maybeSingle<{ id: string }>();
  if (!r) return { ok: false, error: "Respondent not found on this assessment" };

  const sb = createServiceClient();
  const { error } = await sb.from("ara_respondents").delete().eq("id", respondentId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/ara/consultant/assessments/${assessmentId}`);
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────
// Question bank versions
// ─────────────────────────────────────────────────────────────
export async function createAraVersion(formData: FormData) {
  try { await requireRole("admin"); } catch (e) { return authErr(e); }
  const parsed = createAraVersionSchema.safeParse({
    version_number: formData.get("version_number"),
    version_label: formData.get("version_label") || "",
    release_notes: formData.get("release_notes") || "",
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const sb = createServiceClient();
  const { data, error } = await sb
    .from("ara_question_bank_versions")
    .insert({
      version_number: parsed.data.version_number,
      version_label: parsed.data.version_label || null,
      release_notes: parsed.data.release_notes || null,
      is_active: false,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };

  revalidatePath("/ara/admin/questions");
  redirect(`/ara/admin/questions/${data.id}`);
  return { ok: true, id: data.id };
}

export async function publishAraVersion(versionId: string) {
  try { await requireRole("admin"); } catch (e) { return authErr(e); }
  // Atomic publish via Postgres RPC — eliminates the race where two
  // concurrent publishes could leave the DB with zero or two active
  // versions. See migration 00011.
  const sb = createServiceClient();
  const { error } = await sb.rpc("ara_publish_version", { p_version_id: versionId });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/ara/admin/questions");
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────
// Questions
// ─────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────
// Question CSV bulk import
// Expected columns (case-sensitive, in any order):
//   pillar_id, question_number, question_text_en, question_text_ar,
//   question_type, options_en, options_ar, score_map, help_text_en,
//   help_text_ar, region, sector, layer, display_order
// JSON fields (options_*, score_map) should be valid JSON or empty.
// ─────────────────────────────────────────────────────────────
function parseCsv(raw: string): Record<string, string>[] {
  // Minimal quote-aware CSV parser. Handles "" escapes and fields that
  // contain commas/newlines inside double quotes. No dependency on an
  // external csv library.
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (inQuotes) {
      if (c === '"') {
        if (raw[i + 1] === '"') { field += '"'; i++; }
        else { inQuotes = false; }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field); field = "";
    } else if (c === "\n" || c === "\r") {
      if (field !== "" || row.length > 0) { row.push(field); rows.push(row); row = []; field = ""; }
      if (c === "\r" && raw[i + 1] === "\n") i++;
    } else {
      field += c;
    }
  }
  if (field !== "" || row.length > 0) { row.push(field); rows.push(row); }
  if (rows.length === 0) return [];
  const headers = rows[0].map((h) => h.trim());
  return rows.slice(1).filter((r) => r.some((c) => c !== "")).map((r) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = (r[i] ?? "").trim(); });
    return obj;
  });
}

export async function importAraQuestionsCsv(formData: FormData) {
  try { await requireRole("admin"); } catch (e) { return authErr(e); }
  const versionId = String(formData.get("version_id") ?? "");
  const file = formData.get("file");
  if (!versionId) return { ok: false, error: "Missing version id" };
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choose a CSV file" };
  if (!file.name.toLowerCase().endsWith(".csv")) return { ok: false, error: "File must be .csv" };

  const text = await file.text();
  const rows = parseCsv(text);
  if (rows.length === 0) return { ok: false, error: "CSV is empty" };

  const required = [
    "pillar_id", "question_number", "question_text_en", "question_text_ar",
    "question_type",
  ];
  const missing = required.filter((c) => !(c in rows[0]));
  if (missing.length) return { ok: false, error: `Missing required columns: ${missing.join(", ")}` };

  const parseJsonField = (raw: string | undefined) => {
    if (!raw || raw.trim() === "") return null;
    try { return JSON.parse(raw); } catch { return null; }
  };

  const inserts: any[] = [];
  const errors: string[] = [];
  rows.forEach((r, idx) => {
    const rowNum = idx + 2; // +1 for header, +1 for 1-based
    const parsed = createAraQuestionSchema.safeParse({
      version_id: versionId,
      pillar_id: r.pillar_id,
      question_number: r.question_number,
      question_text_en: r.question_text_en,
      question_text_ar: r.question_text_ar,
      question_type: r.question_type,
      options_en: parseJsonField(r.options_en),
      options_ar: parseJsonField(r.options_ar),
      score_map: parseJsonField(r.score_map),
      help_text_en: r.help_text_en || "",
      help_text_ar: r.help_text_ar || "",
      region: r.region || "both",
      sector: r.sector || "all",
      layer: Number(r.layer || 1) as 1 | 2,
      display_order: r.display_order || 0,
    });
    if (!parsed.success) {
      errors.push(`Row ${rowNum}: ${parsed.error.issues[0]?.message ?? "invalid"}`);
      return;
    }
    inserts.push({
      version_id: parsed.data.version_id,
      pillar_id: parsed.data.pillar_id,
      question_number: parsed.data.question_number,
      question_text_en: parsed.data.question_text_en,
      question_text_ar: parsed.data.question_text_ar,
      question_type: parsed.data.question_type,
      options_en: parsed.data.options_en,
      options_ar: parsed.data.options_ar,
      score_map: parsed.data.score_map,
      help_text_en: parsed.data.help_text_en || null,
      help_text_ar: parsed.data.help_text_ar || null,
      region: parsed.data.region,
      sector: parsed.data.sector,
      layer: parsed.data.layer,
      display_order: parsed.data.display_order,
    });
  });

  if (errors.length) {
    return { ok: false, error: `${errors.length} row(s) failed validation: ${errors.slice(0, 5).join("; ")}${errors.length > 5 ? "…" : ""}` };
  }

  const sb = createServiceClient();
  const { error } = await sb.from("ara_questions").insert(inserts);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/ara/admin/questions/${versionId}`);
  return { ok: true, imported: inserts.length };
}

// Delete question (admin)
export async function deleteAraQuestion(questionId: string, versionId: string) {
  try { await requireRole("admin"); } catch (e) { return authErr(e); }
  const sb = createServiceClient();
  const { error } = await sb.from("ara_questions").delete().eq("id", questionId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/ara/admin/questions/${versionId}`);
  return { ok: true };
}

// Reorder question — swap display_order with neighbour in same pillar
export async function moveAraQuestion(questionId: string, direction: "up" | "down") {
  try { await requireRole("admin"); } catch (e) { return authErr(e); }
  const sb = createServiceClient();
  const { data: target } = await sb
    .from("ara_questions")
    .select("id, version_id, pillar_id, display_order, layer")
    .eq("id", questionId)
    .maybeSingle<{ id: string; version_id: string; pillar_id: string; display_order: number; layer: number }>();
  if (!target) return { ok: false, error: "Question not found" };

  // Find the neighbour in same version + pillar + layer
  const { data: neighbour } = await sb
    .from("ara_questions")
    .select("id, display_order")
    .eq("version_id", target.version_id)
    .eq("pillar_id", target.pillar_id)
    .eq("layer", target.layer)
    .eq("is_active", true)
    [direction === "up" ? "lt" : "gt"]("display_order", target.display_order)
    .order("display_order", { ascending: direction !== "up" })
    .limit(1)
    .maybeSingle<{ id: string; display_order: number }>();

  if (!neighbour) return { ok: true }; // Already at edge — no-op

  // Swap. Use a temporary value to avoid unique-index collisions if one exists.
  await sb.from("ara_questions").update({ display_order: -1 }).eq("id", target.id);
  await sb.from("ara_questions").update({ display_order: target.display_order }).eq("id", neighbour.id);
  await sb.from("ara_questions").update({ display_order: neighbour.display_order }).eq("id", target.id);

  revalidatePath(`/ara/admin/questions/${target.version_id}`);
  return { ok: true };
}

// Update question (admin) — only editable fields; preserves scored responses
export async function updateAraQuestion(formData: FormData) {
  try { await requireRole("admin"); } catch (e) { return authErr(e); }
  const questionId = String(formData.get("id") ?? "");
  if (!questionId) return { ok: false, error: "Missing question id" };

  const optionsEnRaw = formData.get("options_en") as string | null;
  const optionsArRaw = formData.get("options_ar") as string | null;
  const scoreMapRaw = formData.get("score_map") as string | null;
  const parseJson = <T,>(raw: string | null): T | null => {
    if (!raw) return null;
    try { return JSON.parse(raw) as T; } catch { return null; }
  };

  const parsed = createAraQuestionSchema.safeParse({
    version_id: formData.get("version_id"),
    pillar_id: formData.get("pillar_id"),
    question_number: formData.get("question_number"),
    question_text_en: formData.get("question_text_en"),
    question_text_ar: formData.get("question_text_ar"),
    question_type: formData.get("question_type"),
    options_en: parseJson(optionsEnRaw),
    options_ar: parseJson(optionsArRaw),
    score_map: parseJson(scoreMapRaw),
    help_text_en: formData.get("help_text_en") || "",
    help_text_ar: formData.get("help_text_ar") || "",
    region: formData.get("region") || "both",
    sector: formData.get("sector") || "all",
    layer: Number(formData.get("layer") || 1) as 1 | 2,
    display_order: formData.get("display_order") || 0,
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const sb = createServiceClient();
  const { error } = await sb
    .from("ara_questions")
    .update({
      pillar_id: parsed.data.pillar_id,
      question_number: parsed.data.question_number,
      question_text_en: parsed.data.question_text_en,
      question_text_ar: parsed.data.question_text_ar,
      question_type: parsed.data.question_type,
      options_en: parsed.data.options_en,
      options_ar: parsed.data.options_ar,
      score_map: parsed.data.score_map,
      help_text_en: parsed.data.help_text_en || null,
      help_text_ar: parsed.data.help_text_ar || null,
      region: parsed.data.region,
      sector: parsed.data.sector,
      layer: parsed.data.layer,
      display_order: parsed.data.display_order,
    })
    .eq("id", questionId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/ara/admin/questions/${parsed.data.version_id}`);
  redirect(`/ara/admin/questions/${parsed.data.version_id}`);
}

export async function createAraQuestion(formData: FormData) {
  try { await requireRole("admin"); } catch (e) { return authErr(e); }
  // Options come in as JSON strings from the client form to keep the
  // FormData interface simple — no client-server array serialization dance.
  const optionsEnRaw = formData.get("options_en") as string | null;
  const optionsArRaw = formData.get("options_ar") as string | null;
  const scoreMapRaw = formData.get("score_map") as string | null;

  const parseJson = <T,>(raw: string | null): T | null => {
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  };

  const parsed = createAraQuestionSchema.safeParse({
    version_id: formData.get("version_id"),
    pillar_id: formData.get("pillar_id"),
    question_number: formData.get("question_number"),
    question_text_en: formData.get("question_text_en"),
    question_text_ar: formData.get("question_text_ar"),
    question_type: formData.get("question_type"),
    options_en: parseJson(optionsEnRaw),
    options_ar: parseJson(optionsArRaw),
    score_map: parseJson(scoreMapRaw),
    help_text_en: formData.get("help_text_en") || "",
    help_text_ar: formData.get("help_text_ar") || "",
    region: formData.get("region") || "both",
    sector: formData.get("sector") || "all",
    layer: Number(formData.get("layer") || 1) as 1 | 2,
    display_order: formData.get("display_order") || 0,
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const sb = createServiceClient();
  const { error } = await sb.from("ara_questions").insert({
    version_id: parsed.data.version_id,
    pillar_id: parsed.data.pillar_id,
    question_number: parsed.data.question_number,
    question_text_en: parsed.data.question_text_en,
    question_text_ar: parsed.data.question_text_ar,
    question_type: parsed.data.question_type,
    options_en: parsed.data.options_en,
    options_ar: parsed.data.options_ar,
    score_map: parsed.data.score_map,
    help_text_en: parsed.data.help_text_en || null,
    help_text_ar: parsed.data.help_text_ar || null,
    region: parsed.data.region,
    sector: parsed.data.sector,
    layer: parsed.data.layer,
    display_order: parsed.data.display_order,
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/ara/admin/questions/${parsed.data.version_id}`);
  return { ok: true };
}
