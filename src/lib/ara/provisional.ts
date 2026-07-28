// ARC "provisional content" status (Option 2 gate).
//
// ARC serves seeded questions with no live-AI fallback, so we never hard-gate the
// respondent form (that would blank the assessment). Instead every ARC result /
// report is flagged "provisional - content pending SME review" whenever it served
// a question an SME has not approved (ara_questions.sme_status != 'approved').
// The flag is computed from the questions actually ANSWERED, so it reflects
// exactly what the respondent saw, and clears per-pillar as the SME approves.

import { createServiceClient } from "@/lib/supabase/server";
import { fetchAllPages } from "@/lib/ara/paginate";

export type ProvisionalStatus = {
  provisional: boolean;
  pending: number; // answered questions not yet SME-approved
  total: number; // distinct answered questions checked
};

const CLEAR: ProvisionalStatus = { provisional: false, pending: 0, total: 0 };

/** Tolerant: a missing sme_status column (migration 00184 unapplied) reads as
 *  not-provisional, so a legacy environment is never spuriously flagged. */
async function statusFromQuestionIds(
  sb: ReturnType<typeof createServiceClient>,
  questionIds: string[],
): Promise<ProvisionalStatus> {
  if (questionIds.length === 0) return CLEAR;
  const { data, error } = await sb.from("ara_questions").select("sme_status").in("id", questionIds);
  if (error || !data) return CLEAR;
  const pending = data.filter((q) => (q as { sme_status?: string }).sme_status !== "approved").length;
  return { provisional: pending > 0, pending, total: data.length };
}

async function distinctAnsweredQuestionIds(
  sb: ReturnType<typeof createServiceClient>,
  column: "respondent_id" | "assessment_id",
  id: string,
): Promise<string[]> {
  // PAGINATED: assessment-scoped response rows exceed the 1000-row cap on real
  // cohorts; truncation could hide an unapproved question from the banner.
  const data = await fetchAllPages<{ question_id: string }>((from, to) =>
    sb.from("ara_responses").select("question_id").eq(column, id).order("id").range(from, to)
  ).catch((): { question_id: string }[] => []);
  return [...new Set(data.map((r) => String(r.question_id)))];
}

/** Provisional status for one respondent's result (personal results page + PDF). */
export async function araRespondentProvisional(respondentId: string): Promise<ProvisionalStatus> {
  const sb = createServiceClient();
  return statusFromQuestionIds(sb, await distinctAnsweredQuestionIds(sb, "respondent_id", respondentId));
}

/** Provisional status for a whole assessment (org report PDF + consultant view). */
export async function araAssessmentProvisional(assessmentId: string): Promise<ProvisionalStatus> {
  const sb = createServiceClient();
  return statusFromQuestionIds(sb, await distinctAnsweredQuestionIds(sb, "assessment_id", assessmentId));
}

/** Bilingual banner copy - one source of truth for pages + PDFs.
 *  CLIENT-facing surfaces (respondent results, delivered reports) get the
 *  softened "preliminary" framing - the internal QA pipeline is not the
 *  client's concern. INTERNAL surfaces (consultant/admin views) keep the
 *  honest detail so the team knows exactly why the flag is up. */
export const PROVISIONAL_COPY = {
  en: {
    title: "Preliminary results",
    body: "These are preliminary results and may be refined as the assessment is finalised. Treat them as indicative for now.",
  },
  ar: {
    title: "نتائج أولية",
    body: "هذه نتائج أولية وقد تُحدَّث مع استكمال التقييم في صيغته النهائية. يُرجى اعتبارها استرشادية في الوقت الحالي.",
  },
} as const;

export const PROVISIONAL_COPY_INTERNAL = {
  en: {
    title: "Provisional results - content pending SME review",
    body: "Some assessment questions have not yet been reviewed and approved by a subject-matter expert. Treat these results as indicative until the content review is complete. (Internal note - client surfaces show a plain 'Preliminary results' line.)",
  },
  ar: {
    title: "نتائج مبدئية - المحتوى قيد مراجعة خبير الموضوع",
    body: "لم تتم بعد مراجعة بعض أسئلة التقييم واعتمادها من قبل خبير في الموضوع. يُرجى اعتبار هذه النتائج استرشادية حتى اكتمال مراجعة المحتوى.",
  },
} as const;
