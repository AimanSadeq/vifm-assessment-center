"use server";

import { createServiceClient } from "@/lib/supabase/server";
import {
  createAnonymousBehavioralSession,
  saveBehavioralAnswers,
  submitAnonymousBehavioral,
  type BehavioralAnswer,
} from "@/lib/scoring/behavioral";
import { getVoucherScopeByRedemptionToken } from "@/lib/persona/vouchers";
import { buildPersonaPdfData } from "@/lib/reports/persona-report-data";

export type StartPersonaOptions = {
  /** 'development' (narrative + suggestions) or 'hiring' (fit vs a target role). */
  purpose?: "development" | "hiring";
  /** Target role profile for a hiring fit read. */
  targetRoleProfileId?: string | null;
  /** Seed for the reproducible (randomized, section-hidden) item layout. */
  seed?: number | null;
  /** Taker email (CAL-PER-403); lead capture + results delivery. Required by the
   *  runner for hiring, optional for development. Persisted best-effort. */
  email?: string | null;
  /** SD-9: which item format(s) to serve - 'normative' (Likert), 'ipsative'
   *  (most/least), or 'both' (default). Overridden by a voucher pin. */
  itemFormat?: "normative" | "ipsative" | "both";
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
    let projectLabel: string | null = null;
    // Scope (purpose/role/competencies) defaults to whatever the client sent
    // (standalone admin run). For a voucher delegate it is OVERRIDDEN by the
    // admin-pinned scope on the voucher, derived server-side - the candidate
    // can never widen or change a pinned assessment.
    // The target role drives scope + the report for BOTH purposes (hiring fit
    // and the development plan), so it is honoured regardless of purpose.
    let purpose: "development" | "hiring" = opts?.purpose === "hiring" ? "hiring" : "development";
    let targetRoleProfileId: string | null = opts?.targetRoleProfileId ?? null;
    let scopedCompetencyIds: string[] | null = null;
    let itemFormat: "normative" | "ipsative" | "both" =
      opts?.itemFormat === "normative" || opts?.itemFormat === "ipsative" ? opts.itemFormat : "both";

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
          // Project label (00137) read separately so a pending migration can't
          // drop the org/redemption linkage above.
          try {
            const { data: pr } = await sb
              .from("persona_voucher_redemptions")
              .select("project_label")
              .eq("id", r.id)
              .maybeSingle<{ project_label: string | null }>();
            projectLabel = pr?.project_label ?? null;
          } catch {
            projectLabel = null;
          }
        }
        // Pinned scope wins over anything the client sent.
        const scope = await getVoucherScopeByRedemptionToken(redemptionToken);
        if (scope.purpose) {
          purpose = scope.purpose;
          // A pinned role applies to both hiring and development vouchers.
          targetRoleProfileId = scope.targetRoleProfileId;
          scopedCompetencyIds = scope.scopedCompetencyIds;
        }
        // Item format is pinned by the voucher when set (server-authoritative).
        if (scope.itemFormat) itemFormat = scope.itemFormat;
      } catch {
        /* voucher tables not migrated - proceed as a plain anonymous run */
      }
    }

    const session = await createAnonymousBehavioralSession(name.trim() || null, {
      organizationId,
      voucherRedemptionId: redemptionId,
      takerEmail: opts?.email?.trim() || null,
      purpose,
      targetRoleProfileId,
      seed: opts?.seed ?? null,
      scopedCompetencyIds,
      projectLabel,
      itemFormat,
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

/** Finalize: score per competency, then build the FULL report payload
 *  (PersonaPdfData) via the same builder the PDF uses - so the on-screen result
 *  and the downloaded PDF render identical content (interview guide, decision
 *  block, role-critical markers, watch areas, summary, planning scaffold,
 *  coaching, overused, consistency, percentiles, course plan). The builder
 *  lazily generates + caches the AI artefacts and is fully tolerant; on any
 *  failure the caller still gets the scored profile. `lang` selects EN/AR copy. */
export async function submitPersonaAction(sessionId: string, lang: "en" | "ar" = "en") {
  const res = await submitAnonymousBehavioral(sessionId);
  if (!res.ok || !res.profile) return res;
  try {
    const built = await buildPersonaPdfData(sessionId, lang);
    if (built.ok) return { ...res, report: built.data };
  } catch {
    /* fall back to the plain scored profile */
  }
  return res;
}
