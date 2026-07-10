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
import { isStaffCaller } from "@/lib/ara/auth-guards";

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
          // One voucher seat = one sitting. If a session already exists for this
          // redemption, do NOT silently create a new one (which would overwrite
          // the recruiter-visible result_id and let a delegate retake forever):
          //  - submitted  -> refuse; the completed result stands.
          //  - in progress -> resume it, returning the saved answers so a reload
          //                    doesn't discard progress on a 164-item test.
          // Scan ALL sessions for this redemption, newest first. A transient
          // double-begin (two tabs / a slow-network re-fire on the shareable
          // take/[token] URL) can seed >1 session row here; using .maybeSingle()
          // would ERROR on 2+ rows and - the error being dropped - null out
          // `existing`, permanently re-opening the submitted-refuse gate and
          // letting the delegate retake + overwrite the recruiter result. So
          // refuse if ANY row is submitted, else resume the newest in-progress.
          // NB: the seed column is `randomization_seed` (00110), NOT `seed`. The
          // prior guard selected a non-existent `seed`, so PostgREST 42703'd the
          // whole request; the dropped error nulled existingRows and the retake
          // gate was INERT in production - a delegate could resit + overwrite the
          // recruiter result. Selecting the real column restores the gate.
          const { data: existingRows } = await sb
            .from("behavioral_assessment_sessions")
            .select("id, status, randomization_seed, item_format")
            .eq("voucher_redemption_id", r.id)
            .order("created_at", { ascending: false });
          const rows = (existingRows ?? []) as Array<{
            id: string; status: string; randomization_seed: number | null; item_format: string | null;
          }>;
          if (rows.some((x) => x.status === "submitted")) {
            return { ok: false as const, completed: true as const, error: "This assessment has already been completed." };
          }
          const existing = rows[0] ?? null;
          if (existing) {
            // Restore only the NORMATIVE (Likert) answers - ipsative choices live
            // in separate client state and are quick to redo. Keyed by item_key.
            const { data: prior } = await sb
              .from("behavioral_assessment_responses")
              .select("item_key, raw_score, item_type")
              .eq("session_id", existing.id);
            const answers: Record<string, number> = {};
            for (const row of prior ?? []) {
              if (row.item_type === "ipsative") continue;
              answers[row.item_key as string] = Number(row.raw_score);
            }
            return {
              ok: true as const,
              sessionId: existing.id,
              resumed: true as const,
              answers,
              seed: existing.randomization_seed ?? null,
              itemFormat: (existing.item_format as "normative" | "ipsative" | "both" | null) ?? null,
            };
          }
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

/**
 * Ownership guard for mutating a session. A standalone (admin) run has no voucher
 * link - the /ac/persona route is staff-authed, so allow it. A voucher/delegate
 * session (voucher_redemption_id set) requires the matching redemption token, so
 * a crafted call with someone else's session id cannot inject/finalise answers.
 */
async function ownsSession(sessionId: string, redemptionToken?: string | null): Promise<boolean> {
  try {
    const sb = createServiceClient();
    const { data: s } = await sb
      .from("behavioral_assessment_sessions")
      .select("voucher_redemption_id")
      .eq("id", sessionId)
      .maybeSingle<{ voucher_redemption_id: string | null }>();
    if (!s) return false;
    if (!s.voucher_redemption_id) return true; // standalone, staff-authed route
    if (!redemptionToken) return false;
    const { data: r } = await sb
      .from("persona_voucher_redemptions")
      .select("id")
      .eq("redemption_token", redemptionToken)
      .maybeSingle<{ id: string }>();
    return !!r && r.id === s.voucher_redemption_id;
  } catch {
    // Tolerant of voucher tables not migrated: treat as standalone (allow).
    return true;
  }
}

/** Autosave a batch of Likert answers. Voucher sessions require the redemption token. */
export async function savePersonaAnswersAction(
  sessionId: string,
  answers: BehavioralAnswer[],
  redemptionToken?: string | null,
) {
  if (!(await ownsSession(sessionId, redemptionToken))) {
    return { ok: false as const, error: "Not authorized for this session." };
  }
  return saveBehavioralAnswers(sessionId, answers);
}

/** Finalize: score per competency, then build the FULL report payload
 *  (PersonaPdfData) via the same builder the PDF uses - so the on-screen result
 *  and the downloaded PDF render identical content (interview guide, decision
 *  block, role-critical markers, watch areas, summary, planning scaffold,
 *  coaching, overused, consistency, percentiles, course plan). The builder
 *  lazily generates + caches the AI artefacts and is fully tolerant; on any
 *  failure the caller still gets the scored profile. `lang` selects EN/AR copy. */
export async function submitPersonaAction(
  sessionId: string,
  lang: "en" | "ar" = "en",
  redemptionToken?: string | null,
) {
  // XP-13: only VIFM staff see the report on-screen; a taker gets a thank-you.
  const isStaff = await isStaffCaller();
  // A non-staff delegate may only finalise their own voucher session.
  if (!isStaff && !(await ownsSession(sessionId, redemptionToken))) {
    return { ok: false as const, error: "Not authorized for this session.", isStaff };
  }
  const res = await submitAnonymousBehavioral(sessionId);
  if (!res.ok) return { ...res, isStaff };
  // XP-13: the per-competency score profile is a staff-only deliverable. Strip
  // it from a non-staff (delegate) response so the numeric self-scores the UI
  // withholds can't be read straight out of the network payload. The taker's
  // client only needs ok/isStaff to show its thank-you.
  if (!isStaff) return { ok: res.ok, isStaff };
  if (!res.profile) return { ...res, isStaff };
  // PER-11: building the report runs several AI calls (insights, summary,
  // courses, interview probes) - the cause of "scoring takes a long time". Only
  // staff see the report on submit, so skip that build for takers (their submit
  // is then near-instant). An admin builds it on demand from the report route /
  // cohort view (insights are cached on the session for reuse).
  try {
    const built = await buildPersonaPdfData(sessionId, lang);
    if (built.ok) return { ...res, report: built.data, isStaff };
  } catch {
    /* fall back to the plain scored profile */
  }
  return { ...res, isStaff };
}
