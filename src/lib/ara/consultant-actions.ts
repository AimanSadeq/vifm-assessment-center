"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { recalculateAssessmentCompliance, complianceStatusLabel } from "@/lib/ara/compliance";
import { recalculateAssessmentScores } from "@/lib/ara/scoring";
import { requireAssessmentOwner, isAuthorizationError } from "@/lib/ara/auth-guards";
import type { AraComplianceStatus } from "@/types/ara";

function authErr(e: unknown) {
  if (isAuthorizationError(e)) return { ok: false as const, error: e.message };
  throw e;
}

// ─────────────────────────────────────────────────────────────
// Phase 2 consultant notes
// ─────────────────────────────────────────────────────────────
const noteSchema = z.object({
  assessment_id: z.string().uuid(),
  pillar_id: z.string().min(1).nullable().optional(),
  note_text: z.string().min(1, "Note text required").max(5000),
  include_in_report: z.boolean().default(false),
  note_language: z.enum(["en", "ar"]).default("en"),
});

export async function createConsultantNote(formData: FormData) {
  const assessmentId = String(formData.get("assessment_id") ?? "");
  if (!assessmentId) return { ok: false, error: "Missing assessment id" };
  try { await requireAssessmentOwner(assessmentId); } catch (e) { return authErr(e); }
  const parsed = noteSchema.safeParse({
    assessment_id: formData.get("assessment_id"),
    pillar_id: formData.get("pillar_id") || null,
    note_text: formData.get("note_text"),
    include_in_report: formData.get("include_in_report") === "on",
    note_language: formData.get("note_language") || "en",
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  // Best-effort translation. If ANTHROPIC_API_KEY is missing or the
  // call fails, we save the note without a translation; the AR side
  // of the bilingual report will show a "translation pending" caption.
  const { translateConsultantNote } = await import("@/lib/ai/translate");
  const noteTextAr =
    parsed.data.note_language === "en"
      ? await translateConsultantNote(parsed.data.note_text, "en", "ar")
      : parsed.data.note_text; // already in AR

  const sb = createServiceClient();
  const { error } = await sb.from("ara_consultant_notes").insert({
    assessment_id: parsed.data.assessment_id,
    pillar_id: parsed.data.pillar_id,
    note_text: parsed.data.note_text,
    note_text_ar: noteTextAr,
    include_in_report: parsed.data.include_in_report,
    note_language: parsed.data.note_language,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/ara/consultant/assessments/${parsed.data.assessment_id}`);
  return { ok: true };
}

export async function deleteConsultantNote(noteId: string, assessmentId: string) {
  try { await requireAssessmentOwner(assessmentId); } catch (e) { return authErr(e); }
  const sb = createServiceClient();
  // Verify the note actually belongs to this assessment
  const { data: note } = await sb
    .from("ara_consultant_notes")
    .select("id")
    .eq("id", noteId)
    .eq("assessment_id", assessmentId)
    .maybeSingle<{ id: string }>();
  if (!note) return { ok: false, error: "Note not found on this assessment" };
  const { error } = await sb.from("ara_consultant_notes").delete().eq("id", noteId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/ara/consultant/assessments/${assessmentId}`);
  return { ok: true };
}

export async function toggleNoteIncludeInReport(noteId: string, assessmentId: string, include: boolean) {
  try { await requireAssessmentOwner(assessmentId); } catch (e) { return authErr(e); }
  const sb = createServiceClient();
  const { error } = await sb
    .from("ara_consultant_notes")
    .update({ include_in_report: include })
    .eq("id", noteId)
    .eq("assessment_id", assessmentId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/ara/consultant/assessments/${assessmentId}`);
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────
// Score freeze / unfreeze
// ─────────────────────────────────────────────────────────────
export async function freezeAssessmentScores(assessmentId: string) {
  try { await requireAssessmentOwner(assessmentId); } catch (e) { return authErr(e); }
  const sb = createServiceClient();

  // Recalculate fresh right before freezing + compliance
  await recalculateAssessmentScores(assessmentId);
  await recalculateAssessmentCompliance(assessmentId);

  const now = new Date().toISOString();

  // Snapshot pillar + overall scores into the next report row
  const [{ data: pillarScores }, { data: overallScore }] = await Promise.all([
    sb.from("ara_pillar_scores").select("*").eq("assessment_id", assessmentId),
    sb.from("ara_assessment_scores").select("*").eq("assessment_id", assessmentId).maybeSingle(),
  ]);

  const snapshot = {
    frozen_at: now,
    pillar_scores: pillarScores ?? [],
    overall: overallScore ?? null,
  };

  await sb
    .from("ara_assessment_scores")
    .update({ score_frozen_at: now })
    .eq("assessment_id", assessmentId);

  await sb
    .from("ara_assessments")
    .update({ status: "frozen", frozen_at: now, phase: "report" })
    .eq("id", assessmentId);

  // Store snapshot on a draft report row (gets overwritten when report generates)
  await sb.from("ara_reports").insert({
    assessment_id: assessmentId,
    language: "bilingual",
    scores_snapshot: snapshot,
    version: 1,
  });

  revalidatePath(`/ara/consultant/assessments/${assessmentId}`);
  return { ok: true };
}

export async function unfreezeAssessmentScores(assessmentId: string) {
  try { await requireAssessmentOwner(assessmentId); } catch (e) { return authErr(e); }
  const sb = createServiceClient();
  await sb
    .from("ara_assessment_scores")
    .update({ score_frozen_at: null })
    .eq("assessment_id", assessmentId);
  await sb
    .from("ara_assessments")
    .update({ status: "active", frozen_at: null, phase: "phase2" })
    .eq("id", assessmentId);

  revalidatePath(`/ara/consultant/assessments/${assessmentId}`);
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────
// Full recalc - scores + compliance (explicit button)
// ─────────────────────────────────────────────────────────────
export async function recalculateCompliance(assessmentId: string) {
  try { await requireAssessmentOwner(assessmentId); } catch (e) { return authErr(e); }
  await recalculateAssessmentScores(assessmentId);
  await recalculateAssessmentCompliance(assessmentId);
  revalidatePath(`/ara/consultant/assessments/${assessmentId}`);
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────
// Pillar weight editor (Level 4 inputs).
// Weights must sum to 100. On success recalculates scores so the
// weighted totals reflect the new distribution immediately.
// ─────────────────────────────────────────────────────────────
const PILLAR_IDS = [
  "strategy", "data", "technology", "talent", "culture",
  "governance", "operations", "model_management",
] as const;

const pillarWeightsSchema = z
  .object(
    Object.fromEntries(
      PILLAR_IDS.map((p) => [p, z.coerce.number().min(0).max(100)])
    ) as Record<(typeof PILLAR_IDS)[number], z.ZodNumber>
  )
  .refine(
    (obj) => {
      const total = PILLAR_IDS.reduce((sum, p) => sum + (obj[p] ?? 0), 0);
      return Math.abs(total - 100) < 0.01;
    },
    { message: "Pillar weights must sum to 100" }
  );

export async function updatePillarWeights(formData: FormData) {
  const assessmentId = String(formData.get("assessment_id") ?? "");
  if (!assessmentId) return { ok: false, error: "Missing assessment id" };
  try { await requireAssessmentOwner(assessmentId); } catch (e) { return authErr(e); }

  const raw: Record<string, number> = {};
  for (const p of PILLAR_IDS) raw[p] = Number(formData.get(`weight_${p}`) ?? 0);

  const parsed = pillarWeightsSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid weights" };

  const sb = createServiceClient();
  const { error } = await sb
    .from("ara_assessments")
    .update({ pillar_weights: parsed.data })
    .eq("id", assessmentId);
  if (error) return { ok: false, error: error.message };

  // Recalculate so the new weights take effect immediately.
  await recalculateAssessmentScores(assessmentId);

  revalidatePath(`/ara/consultant/assessments/${assessmentId}`);
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────
// Perception vs Reality - consultant enters their validated pillar
// score in Phase 2. On first save we snapshot the current raw_score
// as the client self_assessment score so the gap is preserved even
// if respondents update answers later.
// ─────────────────────────────────────────────────────────────
const validatedScoreSchema = z.object({
  assessment_id: z.string().uuid(),
  pillar_id: z.string().min(1),
  consultant_validated_score: z.coerce.number().min(1).max(5),
});

export async function setConsultantValidatedScore(formData: FormData) {
  const assessmentId = String(formData.get("assessment_id") ?? "");
  if (!assessmentId) return { ok: false, error: "Missing assessment id" };
  try { await requireAssessmentOwner(assessmentId); } catch (e) { return authErr(e); }
  const parsed = validatedScoreSchema.safeParse({
    assessment_id: formData.get("assessment_id"),
    pillar_id: formData.get("pillar_id"),
    consultant_validated_score: formData.get("consultant_validated_score"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const sb = createServiceClient();

  // Fetch existing row to know the current raw_score (self-assessment snapshot)
  // and whether the self_assessment_score has already been captured.
  const { data: existing } = await sb
    .from("ara_pillar_scores")
    .select("raw_score, self_assessment_score")
    .eq("assessment_id", parsed.data.assessment_id)
    .eq("pillar_id", parsed.data.pillar_id)
    .maybeSingle<{ raw_score: number | null; self_assessment_score: number | null }>();

  // Preserve the first-captured self-assessment snapshot. If none yet,
  // snapshot whatever raw_score the engine has right now.
  const selfAssessment =
    existing?.self_assessment_score ?? existing?.raw_score ?? null;

  const validated = parsed.data.consultant_validated_score;
  const gap = selfAssessment != null ? Number((selfAssessment - validated).toFixed(2)) : null;

  const { error } = await sb
    .from("ara_pillar_scores")
    .update({
      self_assessment_score: selfAssessment,
      consultant_validated_score: validated,
      perception_gap: gap,
      calculated_at: new Date().toISOString(),
    })
    .eq("assessment_id", parsed.data.assessment_id)
    .eq("pillar_id", parsed.data.pillar_id);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/ara/consultant/assessments/${parsed.data.assessment_id}`);
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────
// Assessment lifecycle controls - archive, reopen
// ─────────────────────────────────────────────────────────────
export async function archiveAssessment(assessmentId: string) {
  try { await requireAssessmentOwner(assessmentId); } catch (e) { return authErr(e); }
  const sb = createServiceClient();
  const now = new Date().toISOString();
  await sb
    .from("ara_assessments")
    .update({ status: "archived", archived_at: now })
    .eq("id", assessmentId);
  revalidatePath(`/ara/consultant/assessments/${assessmentId}`);
  revalidatePath("/ara/consultant");
  return { ok: true };
}

export async function reopenAssessment(assessmentId: string) {
  try { await requireAssessmentOwner(assessmentId); } catch (e) { return authErr(e); }
  const sb = createServiceClient();
  await sb
    .from("ara_assessments")
    .update({
      status: "active",
      phase: "phase1",
      frozen_at: null,
      completed_at: null,
      archived_at: null,
    })
    .eq("id", assessmentId);
  await sb
    .from("ara_assessment_scores")
    .update({ score_frozen_at: null })
    .eq("assessment_id", assessmentId);
  revalidatePath(`/ara/consultant/assessments/${assessmentId}`);
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────
// M6 - Annual reassessment workflow.
//
// Spawns a new assessment for the same organisation seeded from a prior
// completed/frozen/archived one. Carries forward identity (region,
// sector, stage, scope, default language, sandbox flag) and pillar
// weights so the consultant doesn't re-enter them. Question bank
// version is *not* copied - we deliberately pick the active version at
// reassessment time so the new year starts on the latest framework.
//
// Respondent carry-over is opt-in (carryRespondents): a typical year-2
// reassessment re-invites the same stakeholders, but each respondent
// gets a fresh access_token and fresh invited_at=null so the consultant
// must explicitly send the new invitations.
// ─────────────────────────────────────────────────────────────
export async function createReassessmentFromPrior(
  priorAssessmentId: string,
  options: { carryRespondents: boolean } = { carryRespondents: true }
) {
  try { await requireAssessmentOwner(priorAssessmentId); } catch (e) { return authErr(e); }
  const sb = createServiceClient();

  const { data: prior, error: priorErr } = await sb
    .from("ara_assessments")
    .select(
      "id, organization_id, consultant_id, region, sector, default_language, is_sandbox, " +
      "engagement_stage, scope_label, scope_label_ar, status, pillar_weights, assessment_year"
    )
    .eq("id", priorAssessmentId)
    .maybeSingle<{
      id: string;
      organization_id: string;
      consultant_id: string | null;
      region: string;
      sector: string;
      default_language: "en" | "ar";
      is_sandbox: boolean;
      engagement_stage: string;
      scope_label: string | null;
      scope_label_ar: string | null;
      status: string;
      pillar_weights: Record<string, number> | null;
      assessment_year: number;
    }>();
  if (priorErr || !prior) return { ok: false, error: priorErr?.message ?? "Prior assessment not found" };

  // Reassessment only makes sense once the prior has reached an end state.
  // Allowing it from a draft/active prior would let a consultant fork an
  // assessment mid-flight and produce a confusing parallel record.
  if (!["completed", "frozen", "archived"].includes(prior.status)) {
    return {
      ok: false,
      error: "Only completed, frozen, or archived assessments can be reassessed.",
    };
  }

  const { data: activeBank, error: bankErr } = await sb
    .from("ara_question_bank_versions")
    .select("id")
    .eq("is_active", true)
    .maybeSingle<{ id: string }>();
  if (bankErr || !activeBank) {
    return { ok: false, error: "No active question bank version. Activate one in /ara/admin/questions first." };
  }

  const nextYear = Math.max(prior.assessment_year + 1, new Date().getUTCFullYear());

  // Re-derive region + sector from the organisation (source of truth for which
  // regulatory frameworks apply) rather than copying the prior assessment's
  // stored values, which could carry a stale/mis-picked sector that would
  // silently exclude sector-scoped frameworks (e.g. SAMA CSF for Saudi banking).
  let effectiveRegion = prior.region;
  let effectiveSector = prior.sector;
  {
    const { data: org } = await sb
      .from("ara_organizations")
      .select("region, sector")
      .eq("id", prior.organization_id)
      .maybeSingle<{ region: string | null; sector: string | null }>();
    if (org?.region) effectiveRegion = org.region;
    if (org?.sector) effectiveSector = org.sector;
  }

  const { data: created, error: insertErr } = await sb
    .from("ara_assessments")
    .insert({
      organization_id: prior.organization_id,
      consultant_id: prior.consultant_id,
      region: effectiveRegion,
      sector: effectiveSector,
      default_language: prior.default_language,
      is_sandbox: prior.is_sandbox,
      engagement_stage: prior.engagement_stage,
      scope_label: prior.scope_label,
      scope_label_ar: prior.scope_label_ar,
      pillar_weights: prior.pillar_weights ?? null,
      assessment_year: nextYear,
      question_bank_version_id: activeBank.id,
      status: "draft",
      phase: "phase1",
      prior_assessment_id: prior.id,
    })
    .select("id")
    .single<{ id: string }>();
  if (insertErr || !created) {
    return { ok: false, error: insertErr?.message ?? "Failed to create reassessment" };
  }

  if (options.carryRespondents) {
    const { data: priorRespondents } = await sb
      .from("ara_respondents")
      .select("id, name, name_ar, email, role_label_en, role_label_ar, language_preference")
      .eq("assessment_id", prior.id);

    if (priorRespondents && priorRespondents.length > 0) {
      const newRows = priorRespondents.map((r) => ({
        assessment_id: created.id,
        name: r.name,
        name_ar: r.name_ar,
        email: r.email,
        role_label_en: r.role_label_en,
        role_label_ar: r.role_label_ar,
        language_preference: r.language_preference,
      }));
      const { data: insertedRespondents, error: respErr } = await sb
        .from("ara_respondents")
        .insert(newRows)
        .select("id, email");
      if (respErr) {
        // Clean up the assessment if respondent copy failed - otherwise
        // the consultant would be left with an empty draft tied to the
        // wrong baseline.
        await sb.from("ara_assessments").delete().eq("id", created.id);
        return { ok: false, error: `Respondent copy: ${respErr.message}` };
      }

      // Pillar assignments need a prior→new respondent ID map.
      const idByEmail = new Map(priorRespondents.map((r) => [r.email, r.id]));
      const newIdByEmail = new Map((insertedRespondents ?? []).map((r) => [r.email, r.id]));
      const { data: priorAssignments } = await sb
        .from("ara_respondent_pillar_assignments")
        .select("respondent_id, pillar_id")
        .in("respondent_id", Array.from(idByEmail.values()));
      if (priorAssignments && priorAssignments.length > 0) {
        const priorIdToEmail = new Map(priorRespondents.map((r) => [r.id, r.email]));
        const assignmentRows = priorAssignments
          .map((a) => {
            const email = priorIdToEmail.get(a.respondent_id);
            const newId = email ? newIdByEmail.get(email) : null;
            return newId ? { respondent_id: newId, pillar_id: a.pillar_id } : null;
          })
          .filter(<T>(x: T | null): x is T => x !== null);
        if (assignmentRows.length > 0) {
          await sb.from("ara_respondent_pillar_assignments").insert(assignmentRows);
        }
      }
    }
  }

  revalidatePath("/ara/consultant");
  revalidatePath(`/ara/consultant/assessments/${priorAssessmentId}`);
  return { ok: true, assessmentId: created.id };
}

// ─────────────────────────────────────────────────────────────
// Compliance override (consultant manually sets status + evidence)
// ─────────────────────────────────────────────────────────────
const overrideSchema = z.object({
  assessment_id: z.string().uuid(),
  requirement_id: z.string().uuid(),
  status: z.enum(["met", "partial", "not_met", "unknown"]),
  evidence_note: z.string().max(2000).optional().or(z.literal("")),
});

export async function overrideComplianceStatus(formData: FormData) {
  const assessmentId = String(formData.get("assessment_id") ?? "");
  if (!assessmentId) return { ok: false, error: "Missing assessment id" };
  try { await requireAssessmentOwner(assessmentId); } catch (e) { return authErr(e); }
  const parsed = overrideSchema.safeParse({
    assessment_id: formData.get("assessment_id"),
    requirement_id: formData.get("requirement_id"),
    status: formData.get("status"),
    evidence_note: formData.get("evidence_note") || "",
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const sb = createServiceClient();
  const score: Record<AraComplianceStatus, number | null> = {
    met: 1.0, partial: 0.5, not_met: 0.0, unknown: null,
  };
  const labels = complianceStatusLabel(parsed.data.status);

  const { error } = await sb
    .from("ara_compliance_results")
    .upsert(
      {
        assessment_id: parsed.data.assessment_id,
        requirement_id: parsed.data.requirement_id,
        status: parsed.data.status,
        compliance_score: score[parsed.data.status],
        status_label_en: labels.en,
        status_label_ar: labels.ar,
        evidence_note: parsed.data.evidence_note || null,
        evaluated_at: new Date().toISOString(),
      },
      { onConflict: "assessment_id,requirement_id" }
    );
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/ara/consultant/assessments/${parsed.data.assessment_id}`);
  return { ok: true };
}
