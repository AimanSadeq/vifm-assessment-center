"use server";

import { createServiceClient } from "@/lib/supabase/server";
import {
  createAnonymousBehavioralSession,
  saveBehavioralAnswers,
  submitAnonymousBehavioral,
  type BehavioralAnswer,
} from "@/lib/scoring/behavioral";

export type StartPersonaOptions = {
  /** 'development' (narrative + suggestions) or 'hiring' (fit vs a target role). */
  purpose?: "development" | "hiring";
  /** Target role profile for a hiring fit read. */
  targetRoleProfileId?: string | null;
  /** Seed for the reproducible (randomized, section-hidden) item layout. */
  seed?: number | null;
};

/**
 * Start a standalone (anonymous) Persona run. Name is an optional label.
 * If a voucher redemptionToken is supplied (delegate flow), the session is
 * stamped with the voucher's client org + redemption, and the redemption is
 * back-linked to the session - best-effort, so the non-voucher path is unchanged.
 * `opts` carries the purpose (development/hiring), target role + the layout seed.
 */
export async function startPersonaAction(
  name: string,
  redemptionToken?: string | null,
  opts?: StartPersonaOptions,
) {
  try {
    let organizationId: string | null = null;
    let redemptionId: string | null = null;
    if (redemptionToken) {
      try {
        const sb = createServiceClient();
        const { data: r } = await sb
          .from("persona_voucher_redemptions")
          .select("id, organization_id")
          .eq("redemption_token", redemptionToken)
          .maybeSingle<{ id: string; organization_id: string | null }>();
        if (r) {
          organizationId = r.organization_id;
          redemptionId = r.id;
        }
      } catch {
        /* voucher tables not migrated - proceed as a plain anonymous run */
      }
    }

    const session = await createAnonymousBehavioralSession(name.trim() || null, {
      organizationId,
      voucherRedemptionId: redemptionId,
      purpose: opts?.purpose === "hiring" ? "hiring" : "development",
      targetRoleProfileId: opts?.purpose === "hiring" ? opts?.targetRoleProfileId ?? null : null,
      seed: opts?.seed ?? null,
    });

    if (redemptionId) {
      try {
        const sb = createServiceClient();
        await sb.from("persona_voucher_redemptions").update({ result_id: session.id }).eq("id", redemptionId);
      } catch {
        /* ignore */
      }
    }

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
