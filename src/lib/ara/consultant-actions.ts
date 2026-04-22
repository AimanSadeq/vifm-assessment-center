"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { recalculateAssessmentCompliance, complianceStatusLabel } from "@/lib/ara/compliance";
import { recalculateAssessmentScores } from "@/lib/ara/scoring";
import type { AraComplianceStatus } from "@/types/ara";

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
  const parsed = noteSchema.safeParse({
    assessment_id: formData.get("assessment_id"),
    pillar_id: formData.get("pillar_id") || null,
    note_text: formData.get("note_text"),
    include_in_report: formData.get("include_in_report") === "on",
    note_language: formData.get("note_language") || "en",
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const sb = createServiceClient();
  const { error } = await sb.from("ara_consultant_notes").insert({
    assessment_id: parsed.data.assessment_id,
    pillar_id: parsed.data.pillar_id,
    note_text: parsed.data.note_text,
    include_in_report: parsed.data.include_in_report,
    note_language: parsed.data.note_language,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/ara/consultant/assessments/${parsed.data.assessment_id}`);
  return { ok: true };
}

export async function deleteConsultantNote(noteId: string, assessmentId: string) {
  const sb = createServiceClient();
  const { error } = await sb.from("ara_consultant_notes").delete().eq("id", noteId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/ara/consultant/assessments/${assessmentId}`);
  return { ok: true };
}

export async function toggleNoteIncludeInReport(noteId: string, assessmentId: string, include: boolean) {
  const sb = createServiceClient();
  const { error } = await sb
    .from("ara_consultant_notes")
    .update({ include_in_report: include })
    .eq("id", noteId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/ara/consultant/assessments/${assessmentId}`);
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────
// Score freeze / unfreeze
// ─────────────────────────────────────────────────────────────
export async function freezeAssessmentScores(assessmentId: string) {
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
// Full recalc — scores + compliance (explicit button)
// ─────────────────────────────────────────────────────────────
export async function recalculateCompliance(assessmentId: string) {
  await recalculateAssessmentScores(assessmentId);
  await recalculateAssessmentCompliance(assessmentId);
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
