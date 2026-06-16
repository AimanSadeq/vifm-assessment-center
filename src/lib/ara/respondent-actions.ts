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
  const { data: a } = await sb
    .from("ara_assessments")
    .select("engagement_stage, is_sandbox, default_language, include_individual_layer, organization_id")
    .eq("id", respondent.assessment_id)
    .maybeSingle<{
      engagement_stage: string;
      is_sandbox: boolean;
      default_language: "en" | "ar";
      include_individual_layer: boolean;
      organization_id: string | null;
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

  // ── Post-completion work runs in the BACKGROUND ──────────────────
  // Credential issuance, the results email + PDF render, and the consultant
  // notification are slow (Puppeteer PDF + email I/O + count queries = several
  // seconds) and the respondent needs none of them to land on their results
  // page. We kick them off without awaiting so Submit returns immediately.
  // Render runs a long-lived Node server, so these promises keep running after
  // the action returns. Each branch is independently best-effort.
  const runPostCompletion = async () => {
    const tasks: Promise<unknown>[] = [];
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

    if (personalEmailApplies) {
      // Client-level results-delivery prefs (migration 00108). Tolerant: no org
      // / un-migrated -> permissive (delegate sees results, no client send).
      const { getOrgResultsPrefs } = await import("@/lib/ara/results-visibility");
      const prefs = await getOrgResultsPrefs(a?.organization_id);

      // The delegate's own deliverables (credential + results email) only fire
      // when the client lets the delegate see their results.
      if (prefs.respondentCanView) {
        // Verifiable AI Readiness credential (best-effort, idempotent on the
        // respondent; no-ops until migration 00102 widens the type whitelist).
        tasks.push(
          (async () => {
            try {
              const { issueAraReadinessCredential } = await import("@/lib/ara/readiness-credential");
              await issueAraReadinessCredential(token);
            } catch (err) {
              console.error("[markAraRespondentComplete] AI Readiness credential issue failed:", err);
            }
          })(),
        );

        // Personal results email with the PDF attached (best effort; falls back
        // to the in-email link if PDF generation fails).
        tasks.push(
          (async () => {
            try {
              const { sendAraEmail } = await import("@/lib/ara/email");
              const resultsUrl = `${baseUrl}/ara/personal/results/${token}`;
              const pdfUrl = `${baseUrl}/api/ara/personal/${token}/pdf`;

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
                data: { respondentName: respondent.name, resultsUrl, pdfUrl },
                attachments,
                isSandbox: !!a?.is_sandbox,
                respondentId: respondent.id,
                assessmentId: respondent.assessment_id,
              });
            } catch (err) {
              console.error("[markAraRespondentComplete] personal results email failed:", err);
            }
          })(),
        );
      }

      // Send-to-client: email the delegate's results PDF to the client contact.
      // The PDF route is gated when the delegate can't view, so the fetch carries
      // a server-only header (CRON_SECRET) to bypass that gate.
      if (prefs.sendToClient && prefs.clientEmail) {
        tasks.push(
          (async () => {
            try {
              const { sendAraEmail } = await import("@/lib/ara/email");

              // Best-effort display labels for the client email.
              let clientName = "your organisation";
              let assessmentLabel = "AI Readiness";
              try {
                const { data: lbl } = await sb
                  .from("ara_assessments")
                  .select("scope_label, organization:ara_organizations(name)")
                  .eq("id", respondent.assessment_id)
                  .maybeSingle<{
                    scope_label: string | null;
                    organization: { name: string } | { name: string }[] | null;
                  }>();
                const orgRel = lbl?.organization;
                clientName = (Array.isArray(orgRel) ? orgRel[0]?.name : orgRel?.name) || clientName;
                if (lbl?.scope_label) assessmentLabel = lbl.scope_label;
              } catch { /* labels stay generic */ }

              let attachments: { filename: string; content: string }[] | undefined;
              try {
                const pdfRes = await fetch(`${baseUrl}/api/ara/personal/${token}/pdf`, {
                  headers: { "x-ara-internal": process.env.CRON_SECRET ?? "" },
                });
                if (pdfRes.ok) {
                  const buf = Buffer.from(await pdfRes.arrayBuffer());
                  if (buf.length > 0) {
                    const safe = respondent.name.replace(/[^a-zA-Z0-9\s]/g, "").replace(/\s+/g, "-") || "respondent";
                    attachments = [{ filename: `AI-Readiness-${safe}.pdf`, content: buf.toString("base64") }];
                  }
                }
              } catch (pdfErr) {
                console.error("[markAraRespondentComplete] client PDF fetch failed:", pdfErr);
              }

              await sendAraEmail({
                to: prefs.clientEmail!,
                emailType: "ara_personal_results_to_client",
                language: a?.default_language ?? "en",
                data: {
                  clientName,
                  respondentName: respondent.name,
                  respondentEmail: respondent.email,
                  assessmentName: assessmentLabel,
                },
                attachments,
                isSandbox: !!a?.is_sandbox,
                respondentId: respondent.id,
                assessmentId: respondent.assessment_id,
              });
            } catch (err) {
              console.error("[markAraRespondentComplete] client results email failed:", err);
            }
          })(),
        );
      }
    }

    // Consultant notification - fires for org-stage assessments (incl. Mode C,
    // where the consultant tracks completion progress regardless of the layer).
    if (a?.engagement_stage !== "individual") {
      tasks.push(
        (async () => {
          try {
            const { notifyConsultantOnRespondentComplete } = await import("@/lib/ara/actions");
            await notifyConsultantOnRespondentComplete(respondent.id);
          } catch (err) {
            console.error("[markAraRespondentComplete] consultant notify failed:", err);
          }
        })(),
      );
    }

    await Promise.allSettled(tasks);
  };

  // Fire-and-forget: do not await. Submit returns now.
  void runPostCompletion().catch((err) =>
    console.error("[markAraRespondentComplete] background tasks failed:", err),
  );
}
