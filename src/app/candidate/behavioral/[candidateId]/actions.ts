"use server";

import {
  saveBehavioralAnswers,
  submitBehavioralAssessment,
  type BehavioralAnswer,
} from "@/lib/scoring/behavioral";

/** Autosave a batch of Likert answers for a behavioral self-assessment session. */
export async function saveBehavioralAnswersAction(sessionId: string, answers: BehavioralAnswer[]) {
  return saveBehavioralAnswers(sessionId, answers);
}

/** Finalize: score per competency (reverse mapped 6 − raw) + mark submitted. */
export async function submitBehavioralAction(engagementId: string, candidateId: string) {
  return submitBehavioralAssessment(engagementId, candidateId);
}
