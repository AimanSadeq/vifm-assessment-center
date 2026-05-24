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
import { sendAraEmail, type AraEmailLanguage } from "@/lib/ara/email";

// Uniform auth-error unwrapper - server actions return a shape the UI
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
  // unreachable - redirect throws
  return { ok: true, id: data?.id };
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
  // Delete is strictly admin - cascades to all consultants' assessments.
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
  // Data-erasure is strictly admin - logged in ara_data_management_log.
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
  const rawStage = String(formData.get("engagement_stage") ?? "enterprise");
  const rawScope = String(formData.get("scope_label") ?? "").trim();
  const includeIndividual = formData.get("include_individual_layer") === "on";
  const includeAgentic = formData.get("include_agentic_layer") === "on";
  const rawTier = String(formData.get("assessment_tier") ?? "snapshot");
  // Pillars-in-scope override (migration 00029). Posted as multiple
  // form values under the same `pillars_in_scope` key. We collect them
  // into an array, dedupe, and validate cardinality against the stage.
  const rawPillars = formData.getAll("pillars_in_scope").map(String).filter(Boolean);
  const dedupedPillars = Array.from(new Set(rawPillars));
  const parsed = createAraAssessmentSchema.safeParse({
    organization_id: formData.get("organization_id"),
    region: formData.get("region"),
    sector: formData.get("sector"),
    default_language: formData.get("default_language"),
    is_sandbox: formData.get("is_sandbox") === "on",
    question_bank_version_id: formData.get("question_bank_version_id") || null,
    engagement_stage: rawStage,
    scope_label: rawScope.length > 0 ? rawScope : null,
    include_individual_layer: includeIndividual,
    include_agentic_layer: includeAgentic,
    // Tier only matters when the layer is on; default to snapshot otherwise.
    assessment_tier: includeIndividual && rawTier === "deep_dive" ? "deep_dive" : "snapshot",
    pillars_in_scope: dedupedPillars.length > 0 ? dedupedPillars : null,
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  // Cardinality enforcement per stage. department=4, division=6, and
  // enterprise ignores any user-submitted set (always all 8). individual
  // doesn't use pillars at all.
  let pillarsToStore: string[] | null = parsed.data.pillars_in_scope ?? null;
  if (parsed.data.engagement_stage === "department" && pillarsToStore && pillarsToStore.length !== 4) {
    return { ok: false, error: "Department assessments must include exactly 4 pillars." };
  }
  if (parsed.data.engagement_stage === "division" && pillarsToStore && pillarsToStore.length !== 6) {
    return { ok: false, error: "Division assessments must include exactly 6 pillars." };
  }
  if (parsed.data.engagement_stage === "enterprise" || parsed.data.engagement_stage === "individual") {
    pillarsToStore = null;
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
      engagement_stage: parsed.data.engagement_stage,
      scope_label: parsed.data.scope_label ?? null,
      status: "draft",
      phase: "phase1",
      // Owner is the creating consultant (or null when an admin creates).
      consultant_id: caller.role === "consultant" && !caller.isDev ? caller.uid : null,
      include_individual_layer: parsed.data.include_individual_layer,
      include_agentic_layer: parsed.data.include_agentic_layer,
      assessment_tier: parsed.data.assessment_tier,
      pillars_in_scope: pillarsToStore,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };

  revalidatePath("/ara/consultant");
  redirect(`/ara/consultant/assessments/${data?.id}`);
  return { ok: true, id: data?.id };
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

  // Mode C — individual-only respondents skip pillar assignments and
  // only answer the four-factor items. Honoured only when the parent
  // assessment has include_individual_layer=true (defensive).
  const individualOnly = formData.get("individual_only") === "on";

  const sb = createServiceClient();

  let layerEnabled = false;
  if (individualOnly) {
    const { data: a } = await sb
      .from("ara_assessments")
      .select("include_individual_layer")
      .eq("id", parsed.data.assessment_id)
      .maybeSingle<{ include_individual_layer: boolean }>();
    layerEnabled = !!a?.include_individual_layer;
  }
  const finalIndividualOnly = individualOnly && layerEnabled;

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
      individual_only: finalIndividualOnly,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };

  // Pillar assignments are skipped for individual-only respondents —
  // they don't answer pillar questions, so a pillar row would be
  // confusing data noise.
  if (!finalIndividualOnly && parsed.data.pillar_assignments.length > 0) {
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
// Bulk respondent CSV import
//
// Accepts CSV text with a header row. Recognised columns (case-
// insensitive, any subset is fine):
//   name              required
//   email             required (must be unique within the assessment)
//   name_ar           optional Arabic display name
//   role_label_en     optional role / title in EN
//   role_label_ar     optional role / title in AR
//   language          optional, "en" or "ar" (default: en)
//   pillars           optional, pipe-separated pillar IDs (e.g. data|talent)
//
// Returns a per-row result so the UI can show partial-success state.
// Idempotent on email collisions: rows with an email that already
// exists on this assessment are skipped with a "duplicate" error.
// ─────────────────────────────────────────────────────────────

/**
 * Quote-aware minimal CSV parser. Handles fields wrapped in double
 * quotes (with embedded commas) and escaped quotes (""). Does NOT
 * support multi-line quoted fields - sufficient for respondent lists.
 */
function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuote) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else { inQuote = false; }
      } else { cur += ch; }
    } else {
      if (ch === '"') { inQuote = true; }
      else if (ch === ",") { out.push(cur.trim()); cur = ""; }
      else { cur += ch; }
    }
  }
  out.push(cur.trim());
  return out;
}

export async function bulkImportAraRespondents(formData: FormData) {
  const assessmentId = String(formData.get("assessment_id") ?? "");
  if (!assessmentId) return { ok: false, error: "Missing assessment id" };
  try { await requireAssessmentOwner(assessmentId); } catch (e) { return authErr(e); }

  const csv = String(formData.get("csv") ?? "").trim();
  if (!csv) return { ok: false, error: "Paste at least one row of CSV." };

  const lines = csv.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return { ok: false, error: "CSV must include a header row plus at least one data row." };

  const header = parseCsvLine(lines[0]).map((h) => h.toLowerCase().trim());
  const idx = (...names: string[]): number => {
    for (const n of names) {
      const i = header.indexOf(n);
      if (i !== -1) return i;
    }
    return -1;
  };
  const iName     = idx("name", "full_name", "fullname");
  const iEmail    = idx("email", "email_address");
  const iNameAr   = idx("name_ar", "arabic_name");
  const iRoleEn   = idx("role", "role_label_en", "title");
  const iRoleAr   = idx("role_label_ar", "role_ar", "arabic_role");
  const iLang     = idx("language", "lang", "language_preference");
  const iPillars  = idx("pillars", "pillar_assignments");
  // Mode C — workforce-readiness only respondents (skip pillar questions).
  const iIndividualOnly = idx("individual_only", "individual", "personal_only");

  if (iName === -1 || iEmail === -1) {
    return { ok: false, error: "CSV header must include at least 'name' and 'email' columns." };
  }

  const sb = createServiceClient();

  // Look up the parent assessment's include_individual_layer flag once
  // — we only honour individual_only when the layer is actually on.
  const { data: parentAssessment } = await sb
    .from("ara_assessments")
    .select("include_individual_layer")
    .eq("id", assessmentId)
    .maybeSingle<{ include_individual_layer: boolean }>();
  const layerOn = !!parentAssessment?.include_individual_layer;

  // Pre-fetch existing emails on this assessment for duplicate detection.
  const { data: existing } = await sb
    .from("ara_respondents")
    .select("email")
    .eq("assessment_id", assessmentId);
  const existingEmails = new Set((existing ?? []).map((r: { email: string }) => r.email.toLowerCase()));

  const results: Array<{ row: number; email: string; ok: boolean; error?: string }> = [];
  const toInsert: Array<Record<string, unknown>> = [];
  const pillarsByEmail = new Map<string, string[]>();

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    const name = cols[iName] ?? "";
    const email = (cols[iEmail] ?? "").toLowerCase();

    if (!name || !email) {
      results.push({ row: i + 1, email, ok: false, error: "name and email are required" });
      continue;
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      results.push({ row: i + 1, email, ok: false, error: "invalid email format" });
      continue;
    }
    if (existingEmails.has(email)) {
      results.push({ row: i + 1, email, ok: false, error: "duplicate (email already on this assessment)" });
      continue;
    }
    existingEmails.add(email);

    const langRaw = (cols[iLang] ?? "en").toLowerCase();
    const language = langRaw === "ar" || langRaw === "arabic" ? "ar" : "en";

    // individual_only — accept yes/y/true/1 (case-insensitive). Honoured
    // only when the parent assessment has the individual layer on.
    const individualOnlyRaw = iIndividualOnly >= 0 ? (cols[iIndividualOnly] ?? "").trim().toLowerCase() : "";
    const individualOnly = layerOn && ["yes", "y", "true", "1", "on"].includes(individualOnlyRaw);

    toInsert.push({
      assessment_id: assessmentId,
      name,
      name_ar: iNameAr >= 0 ? (cols[iNameAr] || null) : null,
      email,
      role_label_en: iRoleEn >= 0 ? (cols[iRoleEn] || null) : null,
      role_label_ar: iRoleAr >= 0 ? (cols[iRoleAr] || null) : null,
      language_preference: language,
      individual_only: individualOnly,
    });

    // Pillar assignments are skipped for individual-only respondents
    // — they don't answer pillar questions.
    if (!individualOnly && iPillars >= 0 && cols[iPillars]) {
      pillarsByEmail.set(
        email,
        cols[iPillars].split("|").map((s) => s.trim()).filter(Boolean)
      );
    }

    results.push({ row: i + 1, email, ok: true });
  }

  if (toInsert.length === 0) {
    return { ok: false, error: "No valid rows to import.", results };
  }

  const { data: inserted, error } = await sb
    .from("ara_respondents")
    .insert(toInsert)
    .select("id, email");

  if (error) return { ok: false, error: error.message };

  // Wire up pillar assignments for any rows that supplied them.
  const assignmentRows: Array<{ respondent_id: string; pillar_id: string }> = [];
  for (const row of inserted ?? []) {
    const pillars = pillarsByEmail.get(row.email.toLowerCase()) ?? [];
    for (const p of pillars) assignmentRows.push({ respondent_id: row.id, pillar_id: p });
  }
  if (assignmentRows.length > 0) {
    await sb.from("ara_respondent_pillar_assignments").insert(assignmentRows);
  }

  revalidatePath(`/ara/consultant/assessments/${assessmentId}`);
  return {
    ok: true,
    imported: inserted?.length ?? 0,
    skipped: results.filter((r) => !r.ok).length,
    results,
  };
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
  redirect(`/ara/admin/questions/${data?.id}`);
  return { ok: true, id: data?.id };
}

export async function publishAraVersion(versionId: string) {
  try { await requireRole("admin"); } catch (e) { return authErr(e); }
  // Atomic publish via Postgres RPC - eliminates the race where two
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

/**
 * Bulk reorder questions inside a pillar. Accepts an array of question
 * IDs in the desired order; rewrites display_order to match the array
 * index. Used by the drag-and-drop UX on the question list page.
 *
 * Authorization: admin only. The IDs are validated to belong to the
 * given version + pillar + layer scope so a malicious caller cannot
 * splice in unrelated rows.
 */
export async function reorderAraQuestions(
  versionId: string,
  pillarId: string,
  layer: 1 | 2,
  orderedIds: string[]
) {
  try { await requireRole("admin"); } catch (e) { return authErr(e); }
  if (!versionId || !pillarId || orderedIds.length === 0) {
    return { ok: false, error: "Missing version, pillar, or ordering" };
  }

  const sb = createServiceClient();

  // Validate scope: every passed ID must belong to the given pillar/version/layer
  const { data: rows } = await sb
    .from("ara_questions")
    .select("id")
    .eq("version_id", versionId)
    .eq("pillar_id", pillarId)
    .eq("layer", layer)
    .in("id", orderedIds);
  const valid = new Set((rows ?? []).map((r) => r.id));
  if (valid.size !== orderedIds.length || orderedIds.some((id) => !valid.has(id))) {
    return { ok: false, error: "One or more questions are not part of this scope" };
  }

  // Two-pass write to dodge unique-constraint collisions if one exists on
  // (version_id, pillar_id, layer, display_order). First push every row
  // into a high-numbered range, then write the final positions.
  const offset = 1000;
  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await sb
      .from("ara_questions")
      .update({ display_order: offset + i })
      .eq("id", orderedIds[i]);
    if (error) return { ok: false, error: error.message };
  }
  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await sb
      .from("ara_questions")
      .update({ display_order: i })
      .eq("id", orderedIds[i]);
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath(`/ara/admin/questions/${versionId}`);
  return { ok: true };
}

// Reorder question - swap display_order with neighbour in same pillar
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

  if (!neighbour) return { ok: true }; // Already at edge - no-op

  // Swap. Use a temporary value to avoid unique-index collisions if one exists.
  await sb.from("ara_questions").update({ display_order: -1 }).eq("id", target.id);
  await sb.from("ara_questions").update({ display_order: target.display_order }).eq("id", neighbour.id);
  await sb.from("ara_questions").update({ display_order: neighbour.display_order }).eq("id", target.id);

  revalidatePath(`/ara/admin/questions/${target.version_id}`);
  return { ok: true };
}

// Update question (admin) - only editable fields; preserves scored responses
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
  // FormData interface simple - no client-server array serialization dance.
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

// ─────────────────────────────────────────────────────────────
// AI question authoring assistant
//
// Generates one question via the Anthropic API based on an admin
// brief, then inserts it into the requested version. The generated
// question is appended to the end of its pillar (highest existing
// question_number + 1) and marked is_active=true so it shows up
// immediately in the admin list. The framework reference cited by
// the model is stored in help_text_en for audit traceability.
// ─────────────────────────────────────────────────────────────

export async function aiAuthorAraQuestion(formData: FormData) {
  try { await requireRole("admin"); } catch (e) { return authErr(e); }

  const versionId = String(formData.get("version_id") ?? "");
  const pillarId  = String(formData.get("pillar_id") ?? "");
  const layer     = (Number(formData.get("layer") ?? 1) === 2 ? 2 : 1) as 1 | 2;
  const brief     = String(formData.get("brief") ?? "").trim();
  const similarTo = String(formData.get("similar_to") ?? "").trim() || undefined;

  if (!versionId || !pillarId || !brief) {
    return { ok: false as const, error: "version_id, pillar_id, and brief are required." };
  }

  // Lazy import so the AI SDK isn't loaded on every action call.
  const { generateAraQuestion } = await import("@/lib/ai/question-author");

  const result = await generateAraQuestion({
    brief,
    pillar: pillarId as Parameters<typeof generateAraQuestion>[0]["pillar"],
    layer,
    similarTo,
  });
  if (!result.ok) return { ok: false as const, error: result.error };

  const q = result.question;

  // Find the next question_number for this (version, pillar).
  const sb = createServiceClient();
  const { data: existing } = await sb
    .from("ara_questions")
    .select("question_number, display_order")
    .eq("version_id", versionId)
    .eq("pillar_id", pillarId)
    .order("question_number", { ascending: false })
    .limit(1)
    .maybeSingle<{ question_number: number; display_order: number }>();

  const nextNumber = (existing?.question_number ?? 0) + 1;
  const nextOrder  = (existing?.display_order ?? 0) + 1;

  const { data: created, error } = await sb
    .from("ara_questions")
    .insert({
      version_id: versionId,
      pillar_id: pillarId,
      question_number: nextNumber,
      question_text_en: q.en,
      question_text_ar: q.ar,
      question_type: q.type,
      options_en: q.options_en ?? null,
      options_ar: q.options_ar ?? null,
      score_map: q.score_map ?? null,
      help_text_en: `Reference: ${q.ref} · AI-authored draft - review before activation`,
      help_text_ar: `المرجع: ${q.ref} · مسودة مولدة - يرجى المراجعة قبل التفعيل`,
      region: "both",
      sector: "all",
      layer: q.layer,
      display_order: nextOrder,
      // AI-authored questions are inactive by default - admin must
      // review and explicitly activate them via the edit page. This
      // keeps human oversight in the loop per UAE AI Charter Principle 4.
      is_active: false,
    })
    .select("id")
    .single();

  if (error) return { ok: false as const, error: error.message };

  revalidatePath(`/ara/admin/questions/${versionId}`);
  return {
    ok: true as const,
    question_id: created.id,
    question_number: nextNumber,
    rationale: q.rationale,
  };
}

// ─────────────────────────────────────────────────────────────
// M2.1 — Send respondent invitation email
//
// Loads the respondent + assessment + organisation, renders the
// bilingual welcome template (language honours the respondent's own
// language_preference, with "bilingual" as the default fallback),
// fires through src/lib/ara/email.ts, and writes to ara_email_log.
//
// Honours assessment.is_sandbox: in sandbox mode the recipient is
// overridden to SANDBOX_EMAIL_REDIRECT (set via env var). The log row
// is flagged so the consultant knows it didn't reach the real address.
// ─────────────────────────────────────────────────────────────
function appBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
    "http://localhost:3000"
  );
}

export async function sendAraRespondentInvitation(respondentId: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(respondentId)) {
    return { ok: false as const, error: "Invalid respondent id" };
  }

  const sb = createServiceClient();
  const { data: r, error: rErr } = await sb
    .from("ara_respondents")
    .select(
      "id, name, name_ar, email, language_preference, access_token, assessment_id"
    )
    .eq("id", respondentId)
    .maybeSingle();
  if (rErr) return { ok: false as const, error: rErr.message };
  if (!r) return { ok: false as const, error: "Respondent not found" };

  // Authorise the caller as the assessment's consultant (or admin).
  try {
    await requireAssessmentOwner(r.assessment_id as string);
  } catch (e) {
    return authErr(e);
  }

  const { data: a } = await sb
    .from("ara_assessments")
    .select(
      "id, scope_label, scope_label_ar, is_sandbox, consultant_id, organization_id, ara_organizations(name, name_ar)"
    )
    .eq("id", r.assessment_id)
    .single();

  const org = a?.ara_organizations as unknown as { name: string; name_ar: string | null } | null;
  // Pick the consultant's display name from profiles for the salutation.
  let consultantName = "";
  if (a?.consultant_id) {
    const { data: p } = await sb
      .from("profiles")
      .select("full_name")
      .eq("id", a.consultant_id)
      .maybeSingle();
    consultantName = (p?.full_name as string | undefined) ?? "";
  }

  // language_preference is per-respondent; we honour it for the email
  // template choice. Fall back to bilingual when unset so the respondent
  // sees both halves rather than the wrong one.
  const langPref = (r.language_preference as string | null) ?? null;
  const language: AraEmailLanguage =
    langPref === "ar" ? "ar" : langPref === "en" ? "en" : "bilingual";

  const respondentUrl = `${appBaseUrl()}/ara/respond/${r.access_token}`;

  const result = await sendAraEmail({
    to: r.email as string,
    emailType: "ara_respondent_invitation",
    language,
    isSandbox: !!a?.is_sandbox,
    respondentId: r.id as string,
    assessmentId: r.assessment_id as string,
    data: {
      respondentName:
        language === "ar"
          ? (r.name_ar as string | null) || (r.name as string)
          : (r.name as string),
      assessmentName:
        language === "ar"
          ? (a?.scope_label_ar as string | null) || (a?.scope_label as string) || ""
          : (a?.scope_label as string) || "",
      organizationName:
        language === "ar"
          ? org?.name_ar || org?.name || ""
          : org?.name || "",
      consultantName,
      respondentUrl,
    },
  });

  if (!result.ok) return { ok: false as const, error: result.error ?? "Email failed" };

  revalidatePath(`/ara/consultant/assessments/${r.assessment_id}`);
  return { ok: true as const };
}

// ─────────────────────────────────────────────────────────────
// M3.3 — Notify the assessment's consultant when a respondent
// completes. Fire-and-forget from markAraRespondentComplete; failures
// are logged but never block the caller.
// ─────────────────────────────────────────────────────────────
export async function notifyConsultantOnRespondentComplete(respondentId: string) {
  const sb = createServiceClient();
  const { data: r } = await sb
    .from("ara_respondents")
    .select("id, name, name_ar, assessment_id")
    .eq("id", respondentId)
    .single();
  if (!r) return;

  const { data: a } = await sb
    .from("ara_assessments")
    .select(
      "id, scope_label, scope_label_ar, is_sandbox, consultant_id, ara_organizations(name, name_ar)"
    )
    .eq("id", r.assessment_id)
    .single();
  if (!a?.consultant_id) return;

  const { data: consultantProfile } = await sb
    .from("profiles")
    .select("email, full_name")
    .eq("id", a.consultant_id)
    .maybeSingle();
  const consultantEmail = (consultantProfile?.email as string | undefined) ?? "";
  if (!consultantEmail) return;

  // Tally completion progress for the body.
  const { count: totalCount } = await sb
    .from("ara_respondents")
    .select("*", { count: "exact", head: true })
    .eq("assessment_id", r.assessment_id);
  const { count: completedCount } = await sb
    .from("ara_respondents")
    .select("*", { count: "exact", head: true })
    .eq("assessment_id", r.assessment_id)
    .not("completed_at", "is", null);

  const org = a.ara_organizations as unknown as { name: string; name_ar: string | null } | null;

  await sendAraEmail({
    to: consultantEmail,
    emailType: "ara_consultant_completion",
    language: "en",
    isSandbox: !!a.is_sandbox,
    respondentId: r.id as string,
    assessmentId: r.assessment_id as string,
    data: {
      consultantName: (consultantProfile?.full_name as string | undefined) ?? "Consultant",
      respondentName: (r.name as string) || "A respondent",
      assessmentName: (a.scope_label as string) || "",
      organizationName: org?.name || "",
      assessmentUrl: `${appBaseUrl()}/ara/consultant/assessments/${r.assessment_id}`,
      completedCount: String(completedCount ?? 0),
      totalCount: String(totalCount ?? 0),
    },
  });
}

// ─────────────────────────────────────────────────────────────
// Per-item validation-evidence (migration 00028)
// ─────────────────────────────────────────────────────────────
//
// Two flows here:
//
//   suggestQuestionValidationEvidence(questionId)
//     - Calls Claude via the suggester
//     - Saves the proposal with review_status='ai_proposed'
//     - The admin UI surfaces it but does NOT show it in any
//       client-facing report
//
//   saveQuestionValidationEvidence(questionId, evidence)
//     - Admin endpoint
//     - Used after the admin reviewed/edited/rejected the AI proposal
//     - Sets review_status='verified' / 'edited' / 'rejected' and
//       stamps reviewed_by + reviewed_at
//     - Verified/edited evidence DOES propagate to client-facing
//       surfaces (report appendix, public bibliography)

import {
  ARA_INDIVIDUAL_FACTOR_MAP,
  type AraIndividualFactorId,
} from "@/lib/constants/ara-individual-factors";
import { ARA_PILLARS } from "@/lib/constants/ara-pillars";
import { suggestValidationEvidence } from "@/lib/ai/validation-evidence-suggester";
import type { AraQuestionValidationEvidence } from "@/types/ara";

export async function suggestQuestionValidationEvidence(questionId: string) {
  try { await requireRole("admin"); } catch (e) { return authErr(e); }

  const sb = createServiceClient();
  const { data: q, error } = await sb
    .from("ara_questions")
    .select("id, version_id, question_text_en, pillar_id, individual_factor_id")
    .eq("id", questionId)
    .maybeSingle<{
      id: string;
      version_id: string;
      question_text_en: string;
      pillar_id: string;
      individual_factor_id: AraIndividualFactorId | null;
    }>();
  if (error || !q) return { ok: false as const, error: "Question not found" };

  // Resolve construct context — prefer individual factor when set,
  // otherwise fall back to the pillar.
  let constructId: string;
  let constructName: string;
  let constructDescription: string;
  if (q.individual_factor_id) {
    const f = ARA_INDIVIDUAL_FACTOR_MAP[q.individual_factor_id];
    constructId = f.id;
    constructName = f.name_en;
    constructDescription = f.description_en;
  } else {
    const p = ARA_PILLARS.find((x) => x.id === q.pillar_id);
    constructId = q.pillar_id;
    constructName = p?.name_en ?? q.pillar_id;
    constructDescription = p?.description_en ?? "";
  }

  const proposed = await suggestValidationEvidence({
    question_text_en: q.question_text_en,
    construct_id: constructId,
    construct_name: constructName,
    construct_description: constructDescription,
  });

  if (!proposed) {
    return {
      ok: false as const,
      error:
        "AI suggester returned nothing. Check ANTHROPIC_API_KEY in .env.local and re-run.",
    };
  }

  const { error: upErr } = await sb
    .from("ara_questions")
    .update({ validation_evidence: proposed })
    .eq("id", questionId);
  if (upErr) return { ok: false as const, error: upErr.message };

  revalidatePath(`/ara/admin/questions/${q.version_id}/${questionId}`);
  return { ok: true as const, evidence: proposed };
}

/**
 * Save admin-reviewed evidence. Pass review_status='verified' to
 * accept the AI proposal as-is, 'edited' if the admin tweaked it, or
 * 'rejected' to suppress it from client-facing surfaces. Stamps the
 * reviewer email + timestamp from the current admin session.
 */
export async function saveQuestionValidationEvidence(
  questionId: string,
  evidence: AraQuestionValidationEvidence,
  reviewerEmail: string
) {
  try { await requireRole("admin"); } catch (e) { return authErr(e); }

  const sb = createServiceClient();
  const stamped: AraQuestionValidationEvidence = {
    ...evidence,
    reviewed_by: reviewerEmail,
    reviewed_at: new Date().toISOString(),
  };

  const { data: q, error } = await sb
    .from("ara_questions")
    .update({ validation_evidence: stamped })
    .eq("id", questionId)
    .select("version_id")
    .maybeSingle<{ version_id: string }>();
  if (error || !q) return { ok: false as const, error: error?.message ?? "Save failed" };

  revalidatePath(`/ara/admin/questions/${q.version_id}/${questionId}`);
  return { ok: true as const };
}
