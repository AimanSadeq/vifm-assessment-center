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
