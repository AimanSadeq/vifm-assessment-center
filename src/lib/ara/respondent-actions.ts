"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { calculateQuestionScore, recalculateAssessmentScores } from "@/lib/ara/scoring";
import type { AraLanguage, AraQuestion, AraRespondent } from "@/types/ara";

// ─────────────────────────────────────────────────────────────
// Internal: validate token + return respondent. Never trust the
// client with a respondent_id - always derive from the token.
// ─────────────────────────────────────────────────────────────
async function requireRespondent(token: string): Promise<AraRespondent> {
  const sb = createServiceClient();
  const { data } = await sb
    .from("ara_respondents")
    .select("*")
    .eq("access_token", token)
    .maybeSingle<AraRespondent>();
  if (!data) throw new Error("Invalid access token");
  return data;
}

// ─────────────────────────────────────────────────────────────
// Mark first-open / last-active timestamp bumps
// ─────────────────────────────────────────────────────────────
export async function touchAraRespondent(token: string): Promise<void> {
  const sb = createServiceClient();
  const respondent = await requireRespondent(token);
  const now = new Date().toISOString();

  await sb
    .from("ara_respondents")
    .update({
      first_opened_at: respondent.first_opened_at ?? now,
      last_active_at: now,
    })
    .eq("id", respondent.id);
}

/**
 * Stamp `started_at` when the respondent first clicks Start - this anchors the
 * countdown so the deadline survives pausing + returning via the same link.
 * Idempotent: keeps the original start on resume. Returns the effective start
 * (ISO). Tolerant of migration 00084 not being applied (returns now; the client
 * then anchors locally).
 */
export async function markAraRespondentStarted(token: string): Promise<string> {
  const respondent = await requireRespondent(token);
  const existing = (respondent as { started_at?: string | null }).started_at;
  if (existing) return existing;
  const now = new Date().toISOString();
  try {
    const sb = createServiceClient();
    await sb.from("ara_respondents").update({ started_at: now, last_active_at: now }).eq("id", respondent.id);
  } catch {
    /* migration 00084 not applied - client anchors instead */
  }
  return now;
}

// ─────────────────────────────────────────────────────────────
// Save or update an answer (auto-save per question).
// Validates that the question belongs to this respondent's assessment
// and matches one of their assigned pillars.
// ─────────────────────────────────────────────────────────────
const saveAnswerSchema = z.object({
  token: z.string().min(1),
  questionId: z.string().uuid(),
  answerValue: z.string().nullable().optional(),
  answerText: z.string().nullable().optional(),
  needsVerification: z.boolean().optional(),
});

export type SaveAnswerResult =
  | { ok: true; score: number | null }
  | { ok: false; error: string };

export async function saveAraAnswer(input: z.infer<typeof saveAnswerSchema>): Promise<SaveAnswerResult> {
  const parsed = saveAnswerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };

  const sb = createServiceClient();
  const respondent = await requireRespondent(parsed.data.token);

  // Fetch the question with its score_map so we can derive the per-answer score
  const { data: question } = await sb
    .from("ara_questions")
    .select("id, version_id, pillar_id, individual_factor_id, question_type, score_map, layer")
    .eq("id", parsed.data.questionId)
    .maybeSingle<Pick<AraQuestion, "id" | "version_id" | "pillar_id" | "individual_factor_id" | "question_type" | "score_map" | "layer">>();

  if (!question) return { ok: false, error: "Question not found" };
  if (question.layer !== 1) return { ok: false, error: "Layer 2 questions are not respondent-facing" };

  // Authorisation: question must belong to this assessment's active version.
  // Pillar-assignment is enforced only for org-pillar questions; individual-
  // factor items (Mode A/B/C) are seeded with pillar_id='talent' but the
  // respondent never has a pillar assignment row, so a uniform check would
  // silently reject every Personal Snapshot answer.
  const { data: assessment } = await sb
    .from("ara_assessments")
    .select("question_bank_version_id, status")
    .eq("id", respondent.assessment_id)
    .maybeSingle<{ question_bank_version_id: string | null; status: string }>();

  if (!assessment || assessment.question_bank_version_id !== question.version_id) {
    return { ok: false, error: "Question is not part of this assessment" };
  }
  if (assessment.status === "frozen" || assessment.status === "archived") {
    return { ok: false, error: "This assessment is closed to further answers" };
  }

  if (!question.individual_factor_id) {
    const { data: assignment } = await sb
      .from("ara_respondent_pillar_assignments")
      .select("id")
      .eq("respondent_id", respondent.id)
      .eq("pillar_id", question.pillar_id)
      .maybeSingle<{ id: string }>();

    if (!assignment) return { ok: false, error: "You are not assigned to this section" };
  }

  const score = calculateQuestionScore(
    question.question_type,
    parsed.data.answerValue ?? null,
    question.score_map
  );

  const now = new Date().toISOString();
  const { error } = await sb
    .from("ara_responses")
    .upsert(
      {
        assessment_id: respondent.assessment_id,
        respondent_id: respondent.id,
        question_id: question.id,
        answer_value: parsed.data.answerValue ?? null,
        answer_text: parsed.data.answerText ?? null,
        question_score: score,
        needs_verification: parsed.data.needsVerification ?? false,
        answered_at: now,
        updated_at: now,
      },
      { onConflict: "respondent_id,question_id" }
    );

  if (error) return { ok: false, error: error.message };

  // Fire-and-await scoring recalculation. Small number of pillars, should
  // complete in <500ms; we await so the client can display updated totals
  // on the next re-render if desired.
  await recalculateAssessmentScores(respondent.assessment_id);

  // Update last-active timestamp opportunistically
  await sb
    .from("ara_respondents")
    .update({ last_active_at: now })
    .eq("id", respondent.id);

  revalidatePath(`/ara/respond/${parsed.data.token}`);
  return { ok: true, score };
}

// ─────────────────────────────────────────────────────────────
// Respondent changes their language preference from the form.
// ─────────────────────────────────────────────────────────────
export async function setAraRespondentLanguage(token: string, language: AraLanguage): Promise<void> {
  const sb = createServiceClient();
  const respondent = await requireRespondent(token);
  await sb
    .from("ara_respondents")
    .update({ language_preference: language })
    .eq("id", respondent.id);
  revalidatePath(`/ara/respond/${token}`);
}

// ─────────────────────────────────────────────────────────────
// Respondent marks themselves complete.
// ─────────────────────────────────────────────────────────────
export async function markAraRespondentComplete(token: string): Promise<void> {
  const sb = createServiceClient();
  const respondent = await requireRespondent(token);
  const now = new Date().toISOString();
  await sb
    .from("ara_respondents")
    .update({ completed_at: now, last_active_at: now })
    .eq("id", respondent.id);
  revalidatePath(`/ara/respond/${token}`);

  // Look up the assessment to decide which downstream notifications fire.
  // All branches are fire-and-forget - a Graph outage can't block the
  // respondent's completion.
  const { data: a } = await sb
    .from("ara_assessments")
    .select("engagement_stage, is_sandbox, default_language, include_individual_layer")
    .eq("id", respondent.assessment_id)
    .maybeSingle<{
      engagement_stage: string;
      is_sandbox: boolean;
      default_language: "en" | "ar";
      include_individual_layer: boolean;
    }>();

  // Personal results email - fires for any respondent whose assessment
  // produced individual-factor answers worth surfacing back to them:
  //   - engagement_stage='individual' (Modes A + B), OR
  //   - org stage with include_individual_layer=true (Mode C)
  // Org-only respondents on assessments without the layer don't get
  // the email (their results live in the consultant's report).
  const personalEmailApplies =
    a?.engagement_stage === "individual" ||
    (a?.include_individual_layer === true);

  if (personalEmailApplies) {
    // Issue the verifiable AI Readiness credential (best-effort, idempotent on
    // the respondent). No-ops cleanly until migration 00102 widens the
    // credential_type whitelist.
    try {
      const { issueAraReadinessCredential } = await import("@/lib/ara/readiness-credential");
      await issueAraReadinessCredential(token);
    } catch (err) {
      console.error("[markAraRespondentComplete] AI Readiness credential issue failed:", err);
    }

    try {
      const { sendAraEmail } = await import("@/lib/ara/email");
      const baseUrl =
        process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
        (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
      const resultsUrl = `${baseUrl}/ara/personal/results/${token}`;
      const pdfUrl = `${baseUrl}/api/ara/personal/${token}/pdf`;

      // Attach the results PDF to the email (best effort). Falls back to the
      // in-email PDF link if generation/fetch fails.
      let attachments: { filename: string; content: string }[] | undefined;
      try {
        const pdfRes = await fetch(pdfUrl);
        if (pdfRes.ok) {
          const buf = Buffer.from(await pdfRes.arrayBuffer());
          if (buf.length > 0) {
            attachments = [
              { filename: "AI-Readiness-Compass-Results.pdf", content: buf.toString("base64") },
            ];
          }
        }
      } catch (pdfErr) {
        console.error("[markAraRespondentComplete] results PDF fetch failed (sending link only):", pdfErr);
      }

      await sendAraEmail({
        to: respondent.email,
        emailType: "ara_personal_results_link",
        language: respondent.language_preference ?? a?.default_language ?? "en",
        data: {
          respondentName: respondent.name,
          resultsUrl,
          pdfUrl,
        },
        attachments,
        isSandbox: !!a?.is_sandbox,
        respondentId: respondent.id,
        assessmentId: respondent.assessment_id,
      });
    } catch (err) {
      console.error("[markAraRespondentComplete] personal results email failed:", err);
    }
  }

  // Consultant notification - fires for org-stage assessments. Mode C
  // assessments still get this on top of the personal email above
  // because the consultant cares about completion progress regardless
  // of whether the respondent also did the individual layer.
  if (a?.engagement_stage !== "individual") {
    try {
      const { notifyConsultantOnRespondentComplete } = await import("@/lib/ara/actions");
      await notifyConsultantOnRespondentComplete(respondent.id);
    } catch (err) {
      console.error("[markAraRespondentComplete] consultant notify failed:", err);
    }
  }
}
