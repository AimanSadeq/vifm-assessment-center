"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { calculateQuestionScore, recalculateAssessmentScores } from "@/lib/ara/scoring";
import { loadRespondentByToken, loadQuestionsForRespondent, capPerFactor } from "@/lib/ara/respondent-access";
import { isStaffCaller } from "@/lib/ara/auth-guards";
import { getPillarsForAssessment } from "@/lib/constants/ara-stages";
import type { AraLanguage, AraPillarId, AraQuestion, AraRespondent } from "@/types/ara";

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

  // Submission lock: once completed_at is stamped the token must not accept
  // further answer writes. Without this a respondent could keep rewriting
  // graded answers from devtools AFTER submitting - and the results page,
  // PDF, cohort rollups and the next score recalculation all recompute from
  // ara_responses, so the tampered rows would be silently consumed. The
  // submit flush awaits every in-flight autosave BEFORE calling
  // markAraRespondentComplete, so no legitimate save arrives after this.
  if (respondent.completed_at) {
    return { ok: false, error: "This assessment has already been submitted." };
  }

  // Fetch the question with its score_map so we can derive the per-answer score
  const { data: question } = await sb
    .from("ara_questions")
    .select("id, version_id, pillar_id, individual_factor_id, agentic_dimension_id, question_type, score_map, layer, tier, region, sector, is_active")
    .eq("id", parsed.data.questionId)
    .maybeSingle<Pick<AraQuestion, "id" | "version_id" | "pillar_id" | "individual_factor_id" | "agentic_dimension_id" | "question_type" | "score_map" | "layer" | "tier" | "region" | "sector" | "is_active">>();

  if (!question) return { ok: false, error: "Question not found" };
  // Retired questions are never served (the read path filters is_active=true on
  // every layer) - refusing them here keeps the mirror faithful and stops a
  // crafted call probing graded retired items for their key.
  if (!question.is_active) return { ok: false, error: "Question is not part of this assessment" };
  // Layer 2 is consultant-only. Agentic items are exempt: the read path serves
  // them layer-agnostically (identified purely by agentic_dimension_id), so a
  // bank whose agentic items sit on layer 2 must stay saveable.
  if (question.layer !== 1 && !question.agentic_dimension_id) {
    return { ok: false, error: "Layer 2 questions are not respondent-facing" };
  }

  const { data: assessment } = await sb
    .from("ara_assessments")
    .select(
      "question_bank_version_id, status, time_limit_minutes, engagement_stage, include_individual_layer, include_agentic_layer, assessment_tier, items_per_factor, pillars_in_scope, region, sector"
    )
    .eq("id", respondent.assessment_id)
    .maybeSingle<{
      question_bank_version_id: string | null;
      status: string;
      time_limit_minutes: number | null;
      engagement_stage: string;
      include_individual_layer: boolean | null;
      include_agentic_layer: boolean | null;
      assessment_tier: string | null;
      items_per_factor: number | null;
      pillars_in_scope: string[] | null;
      region: string;
      sector: string;
    }>();
  if (!assessment) return { ok: false, error: "Question is not part of this assessment" };

  // Version check MIRRORS the read path (loadQuestionsForRespondent): a legacy /
  // reassessment row with a null question_bank_version_id is served from the
  // currently-active bank version, so the write path must accept that same
  // version - a strict equality against null rejected EVERY answer on a form
  // the respondent could see and fill.
  let effectiveVersionId = assessment.question_bank_version_id;
  if (!effectiveVersionId) {
    const { data: activeVersion } = await sb
      .from("ara_question_bank_versions")
      .select("id")
      .eq("is_active", true)
      .maybeSingle<{ id: string }>();
    effectiveVersionId = activeVersion?.id ?? null;
  }
  if (!effectiveVersionId || effectiveVersionId !== question.version_id) {
    return { ok: false, error: "Question is not part of this assessment" };
  }

  if (assessment.status === "frozen" || assessment.status === "archived") {
    return { ok: false, error: "This assessment is closed to further answers" };
  }

  // Server-side time-limit enforcement (TIMER-05): the countdown + auto-submit
  // are client-only, so a manipulated client could keep saving after the
  // deadline. The anchor is started_at (stamped by the Start button) FALLING
  // BACK to first_opened_at (stamped server-side the moment the respond page -
  // and therefore the full question set - is served). Without the fallback a
  // crafted client could simply never call markAraRespondentStarted, read every
  // question from the page payload, and answer with no clock running at all.
  // FAIL CLOSED when BOTH are null (a client that never rendered the page,
  // saving with question ids obtained out-of-band): the clock starts at the
  // first accepted write instead of never starting.
  // A grace buffer absorbs clock drift + the in-flight autosave that fires as
  // the timer hits zero, so a legitimate last-second answer isn't lost.
  const GRACE_MS = 60_000;
  if (assessment.time_limit_minutes && assessment.time_limit_minutes > 0) {
    let anchor =
      (respondent as { started_at?: string | null }).started_at ??
      respondent.first_opened_at ??
      null;
    if (!anchor) {
      const now = new Date().toISOString();
      try {
        // Guarded stamp so a concurrent first write can't move the anchor.
        await sb
          .from("ara_respondents")
          .update({ started_at: now })
          .eq("id", respondent.id)
          .is("started_at", null);
      } catch {
        /* migration 00084 not applied - anchor still applies to this request */
      }
      anchor = now;
    }
    const deadline = new Date(anchor).getTime() + assessment.time_limit_minutes * 60_000 + GRACE_MS;
    if (Date.now() > deadline) {
      return { ok: false, error: "The time limit for this assessment has passed." };
    }
  }

  // Layer authorisation MIRRORS the serve rules in loadQuestionsForRespondent,
  // so the write path accepts exactly what the read path serves - no more
  // (a crafted call can't inject agentic/deep-dive answers into an assessment
  // that never serves that layer) and no less (a served question is always
  // saveable). Region/sector must match the assessment's isolation filter too.
  const isIndividualStage = assessment.engagement_stage === "individual";
  const individualOnly = !!(respondent as { individual_only?: boolean | null }).individual_only;

  if (!(question.region === "both" || question.region === assessment.region)) {
    return { ok: false, error: "Question is not part of this assessment" };
  }
  if (!(question.sector === "all" || question.sector === assessment.sector)) {
    return { ok: false, error: "Question is not part of this assessment" };
  }

  if (question.individual_factor_id) {
    // Individual-factor item: only when the personal layer is served.
    const wantsIndividual = isIndividualStage || !!assessment.include_individual_layer;
    if (!wantsIndividual) return { ok: false, error: "You are not assigned to this section" };
    // Snapshot-tier assessments never serve deep-dive-only items.
    if (assessment.assessment_tier === "snapshot" && question.tier && question.tier !== "snapshot") {
      return { ok: false, error: "You are not assigned to this section" };
    }
    // Per-client length lever (items_per_factor, migration 00143): the read
    // path caps each factor to N items via capPerFactor, so the write path
    // must accept only the KEPT set - otherwise a crafted call could answer
    // the capped-out items a shortened ARC deliberately never serves and
    // dilute the factor means the rollups recompute from ara_responses.
    const cap = assessment.items_per_factor;
    if (typeof cap === "number" && cap > 0) {
      let factorQuery = sb
        .from("ara_questions")
        .select("id, individual_factor_id, question_type, question_number")
        .eq("version_id", effectiveVersionId)
        .eq("layer", 1)
        .eq("is_active", true)
        .eq("individual_factor_id", question.individual_factor_id);
      if (assessment.assessment_tier === "snapshot") {
        factorQuery = factorQuery.eq("tier", "snapshot");
      }
      const { data: factorItems } = await factorQuery;
      const kept = new Set(
        capPerFactor((factorItems ?? []) as AraQuestion[], cap).map((q) => q.id)
      );
      if (!kept.has(question.id)) {
        return { ok: false, error: "You are not assigned to this section" };
      }
    }
  } else if (question.agentic_dimension_id) {
    // Agentic item: org respondents on an opted-in assessment only.
    const wantsAgentic = !isIndividualStage && !!assessment.include_agentic_layer && !individualOnly;
    if (!wantsAgentic) return { ok: false, error: "You are not assigned to this section" };
  } else {
    // Org-pillar item: never served on individual-stage / individual-only.
    if (isIndividualStage || individualOnly) {
      return { ok: false, error: "You are not assigned to this section" };
    }
    // Pillar-assignment check MIRRORS the read path: explicit assignment rows
    // when they exist, else the assessment's resolved in-scope pillars (the
    // same fallback that serves the form when assignment rows are missing -
    // a write-side hard requirement rejected every answer on those forms).
    const { data: assignments } = await sb
      .from("ara_respondent_pillar_assignments")
      .select("pillar_id")
      .eq("respondent_id", respondent.id);
    const assigned = (assignments ?? []).map((a) => a.pillar_id as AraPillarId);
    const effectivePillars: AraPillarId[] =
      assigned.length > 0
        ? assigned
        : (getPillarsForAssessment({
            engagement_stage: assessment.engagement_stage,
            pillars_in_scope: assessment.pillars_in_scope,
          } as Parameters<typeof getPillarsForAssessment>[0]) as AraPillarId[]);
    if (!question.pillar_id || !effectivePillars.includes(question.pillar_id as AraPillarId)) {
      return { ok: false, error: "You are not assigned to this section" };
    }
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

  // NOTE: scores are recalculated ONCE at submit (markAraRespondentComplete),
  // not on every auto-save. Per-save recalcs serialised several full
  // recalculations into the final submit flush, which is the main reason Submit
  // felt slow. Totals aren't shown to the respondent while answering, so
  // deferring the recalc to submit is invisible to them and keeps saves fast.

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

  // Idempotent: a re-submit (double-click, retry, auto-submit racing a manual
  // submit) must not re-stamp, re-score, or re-fire the one-shot background tasks
  // (credential issue + send-to-client email).
  if (respondent.completed_at) {
    revalidatePath(`/ara/respond/${token}`);
    return;
  }

  // Completion eligibility (defence-in-depth behind the form's client gate): a
  // respondent with zero answers cannot be marked complete, so a crafted call
  // can't inject an empty "completed" respondent and dilute the cohort scores.
  const { count: answeredCount } = await sb
    .from("ara_responses")
    .select("id", { count: "exact", head: true })
    .eq("respondent_id", respondent.id);
  if ((answeredCount ?? 0) === 0) return;

  // AUTHZ-04 (defense-in-depth): refuse completion on a frozen/archived
  // assessment, matching saveAraAnswer. A consultant freeze locks the run to
  // further answers, so it must also lock the completion stamp. Silent no-op
  // (not a throw) so an auto-submit-on-expiry that races a freeze fails safe.
  const { data: lockCheck } = await sb
    .from("ara_assessments")
    .select("status")
    .eq("id", respondent.assessment_id)
    .maybeSingle<{ status: string }>();
  if (lockCheck?.status === "frozen" || lockCheck?.status === "archived") return;

  const now = new Date().toISOString();
  await sb
    .from("ara_respondents")
    .update({ completed_at: now, last_active_at: now })
    .eq("id", respondent.id);

  // Final score calculation runs once here (every answer is persisted by the
  // submit flush) instead of on every auto-save - fast Submit, accurate scores.
  await recalculateAssessmentScores(respondent.assessment_id);

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
      const { getOrgResultsPrefs, delegateCanSeeOwnResults } = await import("@/lib/ara/results-visibility");
      const prefs = await getOrgResultsPrefs(a?.organization_id);

      // The delegate's own deliverables (credential + results email) fire only
      // for a SELF-SERVE run - the same delegateCanSeeOwnResults rule the
      // results page and PDF route enforce. R1: once a client contact is
      // configured on the org (a delegated/client engagement - the consultant
      // sends the assessment and the CLIENT receives the results, directly via
      // send-to-client or collected via the org "Collect all results" action),
      // the delegate does NOT receive their own results. Mode A (anonymous, no
      // org -> clientEmail null) keeps them, as does an explicit
      // respondent_can_view_results=false override.
      const delegateGetsOwnResults = delegateCanSeeOwnResults(prefs);
      if (delegateGetsOwnResults) {
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

        // XP-13: the taker no longer receives a results email. Results are not
        // shown to the taker on any portal; an admin/consultant views, downloads
        // and sends the report (the results page + PDF route are staff-gated, so
        // a taker-facing link/attachment would only 403 or show a thank-you).
        // The completion credential above still issues.
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
                  // Template flips its "attached as a PDF" sentence when the
                  // fetch failed, so the client is never told to look for an
                  // attachment that is not there.
                  pdfAttached: attachments && attachments.length > 0 ? "yes" : "no",
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

    // Org-stage post-completion work (incl. Mode C). Individual-stage
    // assessments have no org pillars / regulatory frameworks, so they skip
    // both the consultant notification and the compliance recalc.
    if (a?.engagement_stage !== "individual") {
      // Consultant notification - the consultant tracks completion progress.
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

      // Refresh regulatory compliance so a framework's card populates as
      // respondents finish, instead of showing a blank "-" / 0 state until
      // the consultant manually clicks Recalculate (or freezes). Idempotent
      // and override-preserving, so re-running per completion is safe.
      tasks.push(
        (async () => {
          try {
            const { recalculateAssessmentCompliance } = await import("@/lib/ara/compliance");
            await recalculateAssessmentCompliance(respondent.assessment_id);
          } catch (err) {
            console.error("[markAraRespondentComplete] compliance recalc failed:", err);
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

// ─────────────────────────────────────────────────────────────
// Admin demo: randomize every answer + complete, so a signed-in admin can skip
// the full questionnaire during a live client demo and jump straight to the
// report. STAFF-ONLY (isStaffCaller below) - the candidate sitting the
// assessment never sees the trigger and can never call this. Works on ANY run
// (no sandbox requirement), so a Full-ARC voucher run can be demoed too; because
// it OVERWRITES answers, the UI confirms first.
//
// Answers are randomized: self-ratings fall in the 3-5 band (credible + varied)
// and graded items pick a random option, so the report looks like a real, mixed
// submission. Writes go through the same ara_responses shape + scoring the live
// flow uses, then markAraRespondentComplete runs the normal recalculation.
// ─────────────────────────────────────────────────────────────

/** Random self-rating in the 3-5 band - a credible but varied demo profile. */
function randomRating(): string {
  return String(3 + Math.floor(Math.random() * 3));
}

export async function simulateAraAnswers(
  token: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const ctx = await loadRespondentByToken(token);
  if (!ctx) return { ok: false, error: "Invalid access token" };

  // Staff-only: the candidate sitting the assessment must never be able to
  // auto-fill it - only signed-in VIFM staff demoing to a client. Defence in
  // depth behind the UI gate (the button is hidden from the candidate).
  if (!(await isStaffCaller())) {
    return { ok: false, error: "Answer simulation is restricted to VIFM staff." };
  }
  if (ctx.assessment.status === "frozen" || ctx.assessment.status === "archived") {
    return { ok: false, error: "This assessment is closed to further answers." };
  }

  const questions = await loadQuestionsForRespondent(ctx);
  if (questions.length === 0) {
    return { ok: false, error: "No questions to simulate for this respondent." };
  }

  const sb = createServiceClient();
  const now = new Date().toISOString();

  const rows = questions
    .map((q) => {
      let answerValue: string | null = null;
      let answerText: string | null = null;

      if (q.question_type === "rating") {
        answerValue = randomRating();
      } else if (q.question_type === "open_text") {
        answerText = "Sample response provided for demonstration purposes.";
      } else {
        // Graded item (multiple_choice / yes_no / situational_judgment /
        // knowledge_check): pick a RANDOM option from the key (or the listed
        // options), so the demo's objective score is mixed - which reads like a
        // real submission and exercises the calibration / risk-flag features.
        const scoreMap = (q.score_map ?? null) as Record<string, number> | null;
        const keys =
          scoreMap && Object.keys(scoreMap).length > 0
            ? Object.keys(scoreMap)
            : ((q.options_en ?? []) as Array<{ value: string }>).map((o) => o.value);
        answerValue = keys.length > 0 ? keys[Math.floor(Math.random() * keys.length)] : null;
      }

      const score = calculateQuestionScore(
        q.question_type,
        answerValue,
        (q.score_map ?? null) as Record<string, number> | null
      );

      return {
        assessment_id: ctx.respondent.assessment_id,
        respondent_id: ctx.respondent.id,
        question_id: q.id,
        answer_value: answerValue,
        answer_text: answerText,
        question_score: score,
        needs_verification: false,
        answered_at: now,
        updated_at: now,
      };
    })
    .filter((r) => r.answer_value !== null || r.answer_text !== null);

  const { error } = await sb
    .from("ara_responses")
    .upsert(rows, { onConflict: "respondent_id,question_id" });
  if (error) return { ok: false, error: error.message };

  // Reuse the normal completion path (score recalc + downstream tasks).
  await markAraRespondentComplete(token);

  revalidatePath(`/ara/respond/${token}`);
  return { ok: true };
}
