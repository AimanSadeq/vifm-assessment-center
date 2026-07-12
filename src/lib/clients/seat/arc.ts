// Client self-service: ARC (AI Readiness Compass) SEAT service.
//
// A CLIENT MANAGER bound to one org runs ARC self-serve, drawing from an
// admin-granted seat allocation. The shell is a single per-org ara_assessments
// row (consultant_id NULL, organization_id = the ARA org); each invited
// delegate becomes an ara_respondents row bound to that shell, with pillar
// assignments derived from the shell's stage (faithfully replicating
// createAraRespondent in src/lib/ara/actions.ts).
//
// SERVER-ONLY. Auth + org are resolved by the CALLER and passed in; this module
// never reads the session. Org is forced on every insert; client input is never
// trusted for org. Seats are drawn BEFORE people are created and released on any
// failure so a seat is never lost. Every DB call is wrapped so a missing
// table/column yields an empty SeatActivity or a clean { error }, never a throw.

import { drawAllocation, releaseAllocation, type Allocation } from "../allocations";
import { createServiceClient } from "@/lib/supabase/server";
import { fetchAllPages } from "@/lib/ara/paginate";
import { sendAraEmail, type AraEmailLanguage } from "@/lib/ara/email";
import { getPillarsForAssessment } from "@/lib/constants/ara-stages";
import { createVoucherBatch as createArcVoucherBatch, type VoucherTier } from "@/lib/ara/vouchers";
import type { AraEngagementStage, AraLanguage, AraPillarId, AraRegion, AraSector } from "@/types/ara";

// ─────────────────────────────────────────────────────────────
// Shared seat-service contract (identical shape across services).
// ─────────────────────────────────────────────────────────────
export type SeatDelegate = { email: string; name?: string };
export type SeatActivityRow = { id: string; name: string; date: string; summary: string; reportPath: string };
export type SeatActivity = {
  shellId: string | null;
  invited: number;
  started: number;
  completed: number;
  rows: SeatActivityRow[];
};

// A stable marker on scope_label so the per-org self-service shell is
// find-or-creatable (and distinguishable from consultant-created assessments).
const SHELL_SENTINEL = "[client-portal] AI Readiness";

// ─────────────────────────────────────────────────────────────
// service_config resolution (sensible defaults when a key is unset).
// ─────────────────────────────────────────────────────────────
type ArcShellConfig = {
  engagement_stage: AraEngagementStage;
  region: AraRegion;
  sector: AraSector;
  default_language: AraLanguage;
};

function asString(v: unknown): string | null {
  return typeof v === "string" && v.trim().length > 0 ? v.trim() : null;
}

function resolveStage(v: unknown): AraEngagementStage {
  const s = asString(v);
  if (s === "department" || s === "division" || s === "enterprise" || s === "individual") return s;
  return "department"; // Stage 1 (4 pillars) - the default self-serve sample.
}

function resolveRegion(v: unknown): AraRegion {
  return asString(v) === "saudi" ? "saudi" : "uae";
}

function resolveSector(v: unknown): AraSector {
  const s = asString(v);
  return s === "government" || s === "banking" || s === "general" ? s : "general";
}

function resolveLanguage(v: unknown): AraLanguage {
  return asString(v) === "ar" ? "ar" : "en";
}

function resolveShellConfig(cfg: Record<string, unknown>): ArcShellConfig {
  return {
    engagement_stage: resolveStage(cfg.engagement_stage),
    region: resolveRegion(cfg.region),
    sector: resolveSector(cfg.sector),
    default_language: resolveLanguage(cfg.default_language),
  };
}

function appBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
    "http://localhost:3000"
  );
}

function emailLanguage(lang: AraLanguage): AraEmailLanguage {
  // The shell default language drives the template; bilingual is a safe
  // catch-all but the shell config only ever yields en/ar.
  return lang === "ar" ? "ar" : "en";
}

// ─────────────────────────────────────────────────────────────
// ensureArcShell - find-or-create the per-org self-service shell.
//   orgId    = AC organizations.id (caller profile) - kept for parity with the
//              other seat services; ARC keys its shell on the ARA org.
//   araOrgId = ara_organizations.id resolved from the allocation (null if unset).
// ─────────────────────────────────────────────────────────────
export async function ensureArcShell(
  orgId: string,
  araOrgId: string | null,
  alloc: Allocation
): Promise<{ shellId: string } | { error: string }> {
  void orgId; // ARC binds to the ARA org; the AC org id is not stored on the shell.
  if (!araOrgId) {
    return { error: "This client is not set up for AI Readiness yet. Ask VIFM to link an AI Readiness organisation." };
  }

  const cfg = resolveShellConfig(alloc.service_config ?? {});

  try {
    const sb = createServiceClient();

    // 1. Reuse an existing self-service shell for this org if one is still open.
    const { data: existing } = await sb
      .from("ara_assessments")
      .select("id")
      .eq("organization_id", araOrgId)
      .eq("scope_label", SHELL_SENTINEL)
      .is("consultant_id", null)
      .in("status", ["draft", "active"])
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle<{ id: string }>();
    if (existing?.id) return { shellId: existing.id };

    // 2. Region + sector are owned by the organisation (they decide which
    //    regulatory frameworks apply); derive from the org row, falling back
    //    to the allocation config only when the org has none.
    let region: AraRegion = cfg.region;
    let sector: AraSector = cfg.sector;
    {
      const { data: org } = await sb
        .from("ara_organizations")
        .select("region, sector")
        .eq("id", araOrgId)
        .maybeSingle<{ region: AraRegion | null; sector: AraSector | null }>();
      if (org?.region) region = org.region;
      if (org?.sector) sector = org.sector;
    }

    // 3. Pin the run to the active question bank version.
    const { data: activeBank } = await sb
      .from("ara_question_bank_versions")
      .select("id")
      .eq("is_active", true)
      .maybeSingle<{ id: string }>();
    if (!activeBank?.id) {
      return { error: "No active question bank version. Ask VIFM to activate one before issuing seats." };
    }

    // 4. Create the shell. organization_id is FORCED to the resolved ARA org;
    //    consultant_id stays null (it is a client-owned, self-service run that
    //    requireAssessmentOwner admits for a client_manager on the matching org).
    const { data: created, error: insErr } = await sb
      .from("ara_assessments")
      .insert({
        organization_id: araOrgId,
        consultant_id: null,
        region,
        sector,
        default_language: cfg.default_language,
        is_sandbox: false,
        engagement_stage: cfg.engagement_stage,
        scope_label: SHELL_SENTINEL,
        question_bank_version_id: activeBank.id,
        status: "active",
        phase: "phase1",
      })
      .select("id")
      .single<{ id: string }>();
    if (insErr || !created?.id) {
      return { error: insErr?.message ?? "Could not create the AI Readiness shell." };
    }
    return { shellId: created.id };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not create the AI Readiness shell." };
  }
}

// ─────────────────────────────────────────────────────────────
// inviteArc - ensure the shell, draw delegates.length seats, create the
// respondents (with derived pillar assignments) bound to the shell, and send
// invitation emails. Seats are released on any failure so they are never lost.
// ─────────────────────────────────────────────────────────────
export async function inviteArc(opts: {
  orgId: string;
  araOrgId: string | null;
  alloc: Allocation;
  delegates: SeatDelegate[];
}): Promise<{ ok: true; invited: number; emailed: number } | { error: string }> {
  const delegates = (opts.delegates ?? []).filter((d) => asString(d.email));
  if (delegates.length === 0) return { error: "Add at least one delegate email." };

  // 1. Ensure the shell up front (so a bad config fails before drawing seats).
  const shell = await ensureArcShell(opts.orgId, opts.araOrgId, opts.alloc);
  if ("error" in shell) return { error: shell.error };

  // 2. Draw seats BEFORE creating any people.
  const draw = await drawAllocation(opts.orgId, "arc", delegates.length);
  if (!draw.ok) {
    return {
      error:
        draw.reason === "over_quota"
          ? `Not enough AI Readiness seats remaining for ${delegates.length} delegate(s).`
          : draw.message ?? "Could not reserve seats.",
    };
  }

  let created = 0;
  let emailed = 0;
  try {
    const sb = createServiceClient();

    // Load the shell's stage + scope once so pillar assignments are derived
    // exactly as createAraRespondent does (department=4 / division=6 /
    // enterprise=8, honouring a pillars_in_scope override).
    const { data: a } = await sb
      .from("ara_assessments")
      .select("engagement_stage, pillars_in_scope, default_language, scope_label, scope_label_ar, is_sandbox, organization_id, ara_organizations(name, name_ar)")
      .eq("id", shell.shellId)
      .maybeSingle<{
        engagement_stage: AraEngagementStage;
        pillars_in_scope: AraPillarId[] | null;
        default_language: AraLanguage | null;
        scope_label: string | null;
        scope_label_ar: string | null;
        is_sandbox: boolean;
        organization_id: string;
        ara_organizations: { name: string; name_ar: string | null } | { name: string; name_ar: string | null }[] | null;
      }>();
    if (!a) {
      await releaseAllocation(opts.orgId, "arc", delegates.length);
      return { error: "The AI Readiness shell could not be loaded." };
    }

    const pillars =
      a.engagement_stage === "individual"
        ? []
        : getPillarsForAssessment({ engagement_stage: a.engagement_stage, pillars_in_scope: a.pillars_in_scope });

    const langDefault: AraLanguage = a.default_language === "ar" ? "ar" : "en";
    const orgRel = Array.isArray(a.ara_organizations) ? a.ara_organizations[0] : a.ara_organizations;
    const orgName = orgRel?.name ?? "";
    const orgNameAr = orgRel?.name_ar ?? orgRel?.name ?? "";

    for (const d of delegates) {
      const email = asString(d.email);
      if (!email) continue;
      const name = asString(d.name) ?? email;

      // 3a. Respondent bound to the shell.
      const { data: respondent, error: respErr } = await sb
        .from("ara_respondents")
        .insert({
          assessment_id: shell.shellId,
          name,
          email,
          language_preference: langDefault,
          individual_only: false,
        })
        .select("id, access_token")
        .single<{ id: string; access_token: string }>();
      if (respErr || !respondent) {
        console.error("[arc-seat] respondent insert failed:", respErr?.message);
        // A single failed respondent rolls back to free its seat below; keep
        // the loop going so partial success still lands the good ones.
        continue;
      }

      // 3b. Derived pillar assignments (replicates createAraRespondent).
      if (pillars.length > 0) {
        const { error: paErr } = await sb
          .from("ara_respondent_pillar_assignments")
          .insert(pillars.map((pillar_id) => ({ respondent_id: respondent.id, pillar_id })));
        if (paErr) {
          console.error("[arc-seat] pillar-assignment insert failed:", paErr.message);
          // Could not derive the test; remove the orphan respondent so its seat
          // is genuinely free. If the delete ITSELF fails the respondent persists,
          // so count it (created += 1) to keep its seat charged rather than
          // releasing a seat for a row that still exists (silent under-charge).
          const { error: delErr } = await sb.from("ara_respondents").delete().eq("id", respondent.id);
          if (delErr) {
            console.error("[arc-seat] orphan respondent delete failed; keeping seat charged:", delErr.message);
            created += 1;
          }
          continue;
        }
      }

      created += 1;

      // 3c. Invitation email (best-effort; never blocks the seat issuance).
      const lang = emailLanguage(langDefault);
      const respondentUrl = `${appBaseUrl()}/ara/respond/${respondent.access_token}`;
      try {
        const sent = await sendAraEmail({
          to: email,
          emailType: "ara_respondent_invitation",
          language: lang,
          isSandbox: !!a.is_sandbox,
          respondentId: respondent.id,
          assessmentId: shell.shellId,
          data: {
            respondentName: name,
            assessmentName: lang === "ar" ? a.scope_label_ar || a.scope_label || "" : a.scope_label || "",
            organizationName: lang === "ar" ? orgNameAr : orgName,
            consultantName: "",
            respondentUrl,
          },
        });
        // Count ONLY a real send - a console-mock (no transport) returns ok:true
        // but delivered:false, so we must not report it as emailed.
        if (sent.delivered) emailed += 1;
      } catch {
        /* email is a nicety, never a blocker */
      }
    }

    // 4. Release any seats whose respondent never landed (partial failure), so
    //    the ledger matches the people actually created.
    if (created < delegates.length) {
      await releaseAllocation(opts.orgId, "arc", delegates.length - created);
    }

    if (created === 0) {
      return { error: "Could not create any AI Readiness respondents." };
    }
    return { ok: true, invited: created, emailed };
  } catch (e) {
    console.error("[arc-seat] inviteArc failed:", e instanceof Error ? e.message : e);
    // Total failure - hand back the seats whose respondent never landed.
    await releaseAllocation(opts.orgId, "arc", delegates.length - created);
    if (created === 0) {
      return { error: e instanceof Error ? e.message : "Could not issue AI Readiness seats." };
    }
    // Some landed before the throw; report the partial success.
    return { ok: true, invited: created, emailed };
  }
}

// ─────────────────────────────────────────────────────────────
// arcSeatActivity - org-scoped monitor. Counts + completed rows for the
// per-org self-service shell. ARC reports are assessment-level, so every row
// links to the same cohort PDF for the shell assessment.
// ─────────────────────────────────────────────────────────────
export async function arcSeatActivity(orgId: string, araOrgId: string | null): Promise<SeatActivity> {
  void orgId;
  const empty: SeatActivity = { shellId: null, invited: 0, started: 0, completed: 0, rows: [] };
  if (!araOrgId) return empty;

  try {
    const sb = createServiceClient();

    // Resolve the shell (read-only; do not create one just to monitor).
    const { data: shell } = await sb
      .from("ara_assessments")
      .select("id")
      .eq("organization_id", araOrgId)
      .eq("scope_label", SHELL_SENTINEL)
      .is("consultant_id", null)
      .in("status", ["draft", "active"])
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle<{ id: string }>();
    if (!shell?.id) return empty;

    const reportPath = `/api/ara/reports/${shell.id}/pdf`;

    type Resp = {
      id: string;
      name: string | null;
      email: string | null;
      first_opened_at: string | null;
      completed_at: string | null;
    };
    // Page the respondent set (deterministic .order('id')): an unpaginated read
    // caps at 1000, so a large cohort's invited/started/completed counts would all
    // undercount past 1000 respondents.
    const list = await fetchAllPages<Resp>((from, to) =>
      sb
        .from("ara_respondents")
        .select("id, name, email, first_opened_at, completed_at")
        .eq("assessment_id", shell.id)
        .order("id")
        .range(from, to),
    ).catch(() => [] as Resp[]);

    let invited = 0;
    let started = 0;
    let completed = 0;
    let lastCompletedAt = "";

    for (const r of list) {
      invited += 1;
      if (r.first_opened_at) started += 1;
      if (r.completed_at) {
        completed += 1;
        if (r.completed_at > lastCompletedAt) lastCompletedAt = r.completed_at;
      }
    }

    // ARC reports are organisation-level (a single cohort PDF), so surface ONE
    // cohort-report row once anyone has completed - not one row per respondent
    // (which would misleadingly imply individual reports).
    const rows: SeatActivityRow[] =
      completed > 0
        ? [{
            id: shell.id,
            name: "Cohort AI Readiness report",
            date: lastCompletedAt,
            summary: `${completed} of ${invited} respondent(s) completed - organisation-level report`,
            reportPath,
          }]
        : [];

    return { shellId: shell.id, invited, started, completed, rows };
  } catch {
    return { ...empty, shellId: null };
  }
}

// ─────────────────────────────────────────────────────────────
// issueArcVouchers - the INDIVIDUAL track. ARC also measures an individual (the
// personal AI readiness), so the portal offers it as a voucher exactly like the
// other code-based services: N individual single-use codes (one per recipient),
// OR one shared code with N seats. Each draws from the same ARC allocation and
// mints ara_vouchers via the existing engine; the recipient redeems at
// /ara/redeem?code=... (self-identifies there) and gets an individual-stage run.
// The Department/Division/Organization cohort flow stays on inviteArc.
// The caller builds the absolute redeem URL from the request origin.
// ─────────────────────────────────────────────────────────────
export type ArcVoucherCode = { code: string; email?: string };
export type IssueArcVouchersResult =
  | { ok: true; mode: "individual" | "pool"; codes: ArcVoucherCode[]; seats: number }
  | { error: string };

export async function issueArcVouchers(opts: {
  orgId: string;
  araOrgId: string | null;
  alloc: Allocation;
  mode: "individual" | "pool";
  delegates?: SeatDelegate[];
  seats?: number;
}): Promise<IssueArcVouchersResult> {
  if (!opts.araOrgId) {
    return { error: "This client is not set up for AI Readiness yet. Ask VIFM to link an AI Readiness organisation." };
  }
  const cfg = resolveShellConfig(opts.alloc.service_config ?? {});
  // Individual ARC readiness defaults to the snapshot tier; a paid allocation
  // can pin the deep-dive via service_config.assessment_tier.
  const tierRaw = asString((opts.alloc.service_config as Record<string, unknown> | null)?.assessment_tier);
  const tier: VoucherTier = tierRaw === "deep_dive" ? "deep_dive" : "snapshot";

  const emails =
    opts.mode === "individual"
      ? (opts.delegates ?? []).map((d) => asString(d.email)).filter((e): e is string => !!e)
      : [];
  const n = opts.mode === "individual" ? emails.length : Math.floor(opts.seats ?? 0);
  if (!Number.isFinite(n) || n < 1) {
    return { error: opts.mode === "individual" ? "Add at least one recipient email." : "Enter at least 1 seat." };
  }
  if (n > 500) return { error: "Up to 500 per batch." };

  // Draw all N seats up front; release on failure so a seat is never lost.
  const draw = await drawAllocation(opts.orgId, "arc", n);
  if (!draw.ok) {
    return {
      error:
        draw.reason === "over_quota"
          ? "Not enough AI Readiness seats remaining (or the allocation has expired)."
          : draw.message ?? "Could not reserve seats.",
    };
  }

  const res = await createArcVoucherBatch({
    count: opts.mode === "individual" ? n : 1,
    organizationId: opts.araOrgId,
    tier,
    region: cfg.region,
    language: cfg.default_language,
    maxUses: opts.mode === "individual" ? 1 : n,
    isPractice: false, // a real client run, not a practice sandbox
  });
  if (!res.ok) {
    await releaseAllocation(opts.orgId, "arc", n);
    return { error: res.error };
  }

  if (opts.mode === "individual") {
    return {
      ok: true,
      mode: "individual",
      codes: res.codes.map((code, i) => ({ code, email: emails[i] })),
      seats: n,
    };
  }
  // Pool: guard the single code so an empty batch can't yield a `?code=undefined`
  // shared link (release the drawn seats rather than hand out a dead link).
  const poolCode = res.codes[0];
  if (!poolCode) {
    await releaseAllocation(opts.orgId, "arc", n);
    return { error: "No code was generated. Please try again." };
  }
  return { ok: true, mode: "pool", codes: [{ code: poolCode }], seats: n };
}
