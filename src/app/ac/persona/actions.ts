"use server";

import {
  createAnonymousBehavioralSession,
  saveBehavioralAnswers,
  submitAnonymousBehavioral,
  type BehavioralAnswer,
} from "@/lib/scoring/behavioral";

/** Start a standalone (anonymous) Persona run. Name is an optional label. */
export async function startPersonaAction(name: string) {
  try {
    const session = await createAnonymousBehavioralSession(name.trim() || null);
    return { ok: true as const, sessionId: session.id };
  } catch (e) {
    // Most likely cause: migration 00098 not applied (candidate/engagement still NOT NULL).
    return {
      ok: false as const,
      error:
        e instanceof Error && /null value|not-null|violates/i.test(e.message)
          ? "Standalone Persona needs migration 00098 applied first."
          : "Could not start the Persona assessment.",
    };
  }
}

/** Autosave a batch of Likert answers (works on any session id). */
export async function savePersonaAnswersAction(sessionId: string, answers: BehavioralAnswer[]) {
  return saveBehavioralAnswers(sessionId, answers);
}

/** Finalize: score per competency and return the self-profile (no rollup write). */
export async function submitPersonaAction(sessionId: string) {
  return submitAnonymousBehavioral(sessionId);
}
