/**
 * ARC individual "AI Readiness" credential.
 *
 * Issued when a person completes a personal AI-readiness assessment (Mode A
 * snapshot, Mode B deep-dive, or a Mode C individual respondent on an org
 * engagement). Parallels the Fluent CEFR + Technical credentials: an individual,
 * verifiable claim checkable at /verify/[code].
 *
 * The overall score mirrors the personal results page exactly (mean of the four
 * factor means, on the 1-5 scale) so the certificate and the results page agree.
 * Best-effort: never throws, idempotent on the respondent (source_id), and
 * no-ops cleanly until migration 00102 widens the credential_type whitelist.
 */
import { createServiceClient } from "@/lib/supabase/server";
import { loadRespondentByToken, loadQuestionsForRespondent } from "@/lib/ara/respondent-access";
import { calculateQuestionScore } from "@/lib/ara/scoring";
import {
  ARA_INDIVIDUAL_FACTOR_IDS,
  getIndividualMaturityStage,
  type AraIndividualFactorId,
} from "@/lib/constants/ara-individual-factors";
import { issueCredential } from "@/lib/credentials/issue";

export async function issueAraReadinessCredential(
  token: string,
): Promise<{ verificationCode: string } | null> {
  try {
    const ctx = await loadRespondentByToken(token);
    if (!ctx) return null;

    // Only individuals who answered the four-factor items earn the credential.
    const eligible =
      ctx.assessment.engagement_stage === "individual" || !!ctx.assessment.include_individual_layer;
    if (!eligible) return null;

    const sb = createServiceClient();

    // Idempotent: one credential per respondent. Re-completion returns the prior.
    const { data: existing } = await sb
      .from("vifm_credentials")
      .select("verification_code")
      .eq("source_id", ctx.respondent.id)
      .eq("credential_type", "ai_readiness")
      .maybeSingle();
    if (existing?.verification_code) {
      return { verificationCode: existing.verification_code as string };
    }

    // Per-factor mean, then overall = mean of the four factor means (mirrors
    // /ara/personal/results/[token]).
    const questions = await loadQuestionsForRespondent(ctx);
    const { data: answers } = await sb
      .from("ara_responses")
      .select("question_id, answer_value")
      .eq("respondent_id", ctx.respondent.id);
    const answerByQuestionId = new Map(
      (answers ?? []).map((a) => [a.question_id as string, a.answer_value]),
    );

    const totals: Record<AraIndividualFactorId, { sum: number; count: number }> = {
      thinking_sense_check: { sum: 0, count: 0 },
      results_working_practice: { sum: 0, count: 0 },
      people_collaboration: { sum: 0, count: 0 },
      self_adaptive_mindset: { sum: 0, count: 0 },
    };
    let answeredFactorItems = 0;
    for (const q of questions) {
      const factorId = q.individual_factor_id as AraIndividualFactorId | null;
      if (!factorId) continue;
      const numeric = calculateQuestionScore(q.question_type, answerByQuestionId.get(q.id) ?? null, q.score_map);
      if (numeric != null) {
        totals[factorId].sum += numeric;
        totals[factorId].count += 1;
        answeredFactorItems += 1;
      }
    }
    if (answeredFactorItems === 0) return null; // nothing to certify

    const overall =
      ARA_INDIVIDUAL_FACTOR_IDS.reduce((s, id) => {
        const t = totals[id];
        return s + (t.count > 0 ? t.sum / t.count : 0);
      }, 0) / ARA_INDIVIDUAL_FACTOR_IDS.length;

    const stage = getIndividualMaturityStage(overall);
    const scorePct = Math.round((overall / 5) * 100);

    return await issueCredential({
      candidateId: null,
      issuedToName: ctx.respondent.name,
      issuedToEmail: ctx.respondent.email ?? null,
      type: "ai_readiness",
      titleEn: "AI Readiness",
      titleAr: "الجاهزية للذكاء الاصطناعي",
      subtitleEn: stage.name_en,
      subtitleAr: stage.name_ar,
      scorePct,
      sourceId: ctx.respondent.id,
      metadata: {
        assessmentId: ctx.respondent.assessment_id,
        stage: stage.id,
        overall: Number(overall.toFixed(2)),
      },
    });
  } catch (e) {
    console.error("[ara] readiness credential issue error:", e);
    return null;
  }
}
