import "server-only";

// Client self-service: Pre-Hire seat service. A CLIENT MANAGER bound to one org
// runs a screening requisition self-serve, drawing seats from an admin-granted
// allocation. The CALLER (the portal server action) has already resolved + gated
// role and org; this module NEVER reads the session and NEVER trusts client input
// for the org - it forces orgId onto every write and verifies the shell's
// organization_id matches before touching it.
//
// Pre-Hire shell = a prehire_requisitions row keyed on the AC `organizations`
// store (organization_id), NOT the ara_organizations store. Candidates are
// provisioned on the requisition exactly as the admin addCandidateAction does
// (status "invited", invited_at null until the invite sends) and invited exactly
// as the admin sendPrehireInvite helper does (those actions are admin-gated via
// requireRole(["admin"]), so the candidate-insert + invitation logic is
// replicated here with the org gate enforced in THIS module instead).
//
// PII discipline: the monitor never selects or surfaces the voluntary demographic
// fields (gender / age_band / nationality_group) - only names, scores, and the
// advisory recommendation, plus a reportPath the portal links to.

import { drawAllocation, releaseAllocation, type Allocation } from "../allocations";
import { fetchAllPages } from "@/lib/ara/paginate";
import { createServiceClient } from "@/lib/supabase/server";
import { sendEmail, isEmailConfigured } from "@/lib/integrations/email";
import { logPrehireEvent } from "@/lib/prehire/audit";
import type { PrehireStagePlanEntry, PrehireStageKind } from "@/types/prehire";

// ── Shared seat-service contract ─────────────────────────────────
export type SeatDelegate = { email: string; name?: string };
export type SeatActivityRow = { id: string; name: string; date: string; summary: string; reportPath: string };
export type SeatActivity = {
  shellId: string | null;
  invited: number;
  started: number;
  completed: number;
  rows: SeatActivityRow[];
};

// Default stage plan when the allocation pins no service_config (mirrors the
// admin demo plan: quiz 0.4 / fluent 0.3 / cbi 0.3).
const DEFAULT_STAGE_PLAN: PrehireStagePlanEntry[] = [
  { kind: "quiz", weight: 0.4, cut_score: 60, required: true },
  { kind: "fluent", weight: 0.3, cut_score: 50, required: true },
  { kind: "cbi", weight: 0.3, cut_score: 60, required: false },
];

// Stable per-org self-serve requisition title (find-or-create key).
const SELF_SERVE_TITLE = "Self-Service Screening";

const STAGE_MINUTES: Record<PrehireStageKind, number> = {
  quiz: 5,
  fluent: 15,
  cbi: 10,
  assessment_center: 0,
};

const VALID_STAGE_KINDS: PrehireStageKind[] = ["fluent", "quiz", "cbi", "assessment_center"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function appBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://caliber.viftraining.com"
  ).replace(/\/+$/, "");
}

/** Validate + normalize a stage plan coming from service_config (untyped jsonb). */
function normalizeStagePlan(raw: unknown): PrehireStagePlanEntry[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const out: PrehireStagePlanEntry[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null) return null;
    const rec = item as Record<string, unknown>;
    const kind = rec.kind;
    if (typeof kind !== "string" || !VALID_STAGE_KINDS.includes(kind as PrehireStageKind)) return null;
    const weight = typeof rec.weight === "number" ? rec.weight : 0;
    const cut = rec.cut_score;
    const cutScore = typeof cut === "number" ? cut : null;
    const required = rec.required === true;
    out.push({ kind: kind as PrehireStageKind, weight, cut_score: cutScore, required });
  }
  return out.length > 0 ? out : null;
}

/** Resolve the requisition shape from the allocation's service_config, falling
 *  back to the default plan when unset/invalid. */
function resolveShellConfig(alloc: Allocation): {
  title: string;
  stagePlan: PrehireStagePlanEntry[];
  roleProfileId: string | null;
} {
  const cfg = (alloc.service_config ?? {}) as {
    title?: unknown;
    stage_config?: unknown;
    stagePlan?: unknown;
    role_profile_id?: unknown;
    roleProfileId?: unknown;
  };
  const title =
    typeof cfg.title === "string" && cfg.title.trim().length >= 2 ? cfg.title.trim() : SELF_SERVE_TITLE;
  const stagePlan =
    normalizeStagePlan(cfg.stage_config) ?? normalizeStagePlan(cfg.stagePlan) ?? DEFAULT_STAGE_PLAN;
  const rawProfile = cfg.role_profile_id ?? cfg.roleProfileId;
  const roleProfileId = typeof rawProfile === "string" && rawProfile.trim() ? rawProfile.trim() : null;
  return { title, stagePlan, roleProfileId };
}

// ── ensurePrehireShell ───────────────────────────────────────────
/**
 * Find-or-create the per-org self-serve requisition (the Pre-Hire "shell").
 * orgId is the AC organizations.id from the caller's profile; araOrgId is unused
 * for Pre-Hire (it lives in the AC org store) and accepted only for signature
 * parity with the other seat services. Returns the requisition id.
 */
export async function ensurePrehireShell(
  orgId: string,
  araOrgId: string | null,
  alloc: Allocation,
): Promise<{ shellId: string } | { error: string }> {
  void araOrgId; // Pre-Hire shells live in the AC org store, not ara_organizations.
  if (!orgId) return { error: "Missing organization." };

  const { title, stagePlan, roleProfileId } = resolveShellConfig(alloc);

  try {
    const svc = createServiceClient();

    // Reuse an existing self-serve requisition for this org (idempotent on the
    // org-forced title) so repeat invites all land on one shell.
    const { data: existing } = await svc
      .from("prehire_requisitions")
      .select("id, organization_id")
      .eq("organization_id", orgId)
      .eq("title", title)
      .limit(1)
      .maybeSingle<{ id: string; organization_id: string | null }>();
    if (existing?.id && existing.organization_id === orgId) {
      return { shellId: existing.id };
    }

    const insertPayload: Record<string, unknown> = {
      organization_id: orgId, // forced - never from client input
      title,
      role_profile_id: roleProfileId,
      english_required: false,
      stage_config: stagePlan,
      status: "open",
    };

    let res = await svc.from("prehire_requisitions").insert(insertPayload).select("id").single();
    // Tolerate a DB without role_profile_id support: strip + retry.
    if (res.error) {
      const code = (res.error as { code?: string }).code;
      if (code === "42703" || code === "PGRST204") {
        const { role_profile_id: _omit, ...core } = insertPayload;
        void _omit;
        res = await svc.from("prehire_requisitions").insert(core).select("id").single();
      }
    }
    if (res.error || !res.data) {
      return { error: res.error?.message ?? "Could not create the screening requisition." };
    }

    const shellId = (res.data as { id: string }).id;
    await logPrehireEvent({
      action: "requisition_created",
      requisitionId: shellId,
      actorLabel: "client_manager",
      detail: { title, stages: stagePlan.map((s) => s.kind), source: "client_self_serve" },
    });
    return { shellId };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not prepare the screening shell." };
  }
}

// ── Candidate provisioning + invite (replicated from the admin-gated actions) ──

/** Add one candidate to the shell exactly as addCandidateAction does (status
 *  "invited", invited_at null = not yet invited). Returns the new candidate's
 *  id + access_token. */
async function provisionCandidate(
  svc: ReturnType<typeof createServiceClient>,
  requisitionId: string,
  delegate: SeatDelegate,
): Promise<{ id: string; access_token: string } | { error: string }> {
  const email = (delegate.email ?? "").trim();
  const name = (delegate.name ?? "").trim() || email;
  const { data, error } = await svc
    .from("prehire_candidates")
    .insert({
      requisition_id: requisitionId,
      full_name: name,
      email,
      status: "invited",
      invited_at: null,
    })
    .select("id, access_token")
    .single();
  if (error || !data) return { error: error?.message ?? "Could not add candidate." };
  return { id: (data as { id: string }).id, access_token: (data as { access_token: string }).access_token };
}

/** Send the invitation email + stamp invited_at, replicating sendPrehireInvite.
 *  Best-effort: returns true only when email is configured AND the send
 *  succeeded; never throws. */
async function inviteCandidate(
  svc: ReturnType<typeof createServiceClient>,
  candidateId: string,
): Promise<boolean> {
  try {
    const { data: cand } = await svc
      .from("prehire_candidates")
      .select("id, full_name, email, access_token, requisition_id")
      .eq("id", candidateId)
      .maybeSingle<{
        id: string;
        full_name: string | null;
        email: string | null;
        access_token: string | null;
        requisition_id: string;
      }>();
    if (!cand?.email || !cand.access_token) return false;

    const { data: req } = await svc
      .from("prehire_requisitions")
      .select("title, stage_config, organizations(name)")
      .eq("id", cand.requisition_id)
      .maybeSingle<{
        title: string | null;
        stage_config: PrehireStagePlanEntry[] | null;
        organizations: { name: string } | null;
      }>();
    if (!req) return false;

    const orgName = (req.organizations as { name: string } | null)?.name ?? null;
    const plan = (req.stage_config ?? []) as PrehireStagePlanEntry[];
    const minutes = plan.reduce((sum, s) => sum + (STAGE_MINUTES[s.kind] ?? 0), 0);
    const duration = minutes > 0 ? `${minutes} minutes` : "a few minutes";
    const applyUrl = `${appBaseUrl()}/prehire/apply/${cand.access_token}`;

    const ok = await sendEmail({
      to: cand.email,
      template: "prehire_invitation",
      data: {
        candidateName: (cand.full_name ?? "").split(" ")[0] || "there",
        roleTitle: req.title ?? "the role",
        orgName: orgName ?? "the hiring organization",
        orgClause: orgName ? ` with ${orgName}` : "",
        duration,
        applyUrl,
      },
    });

    await svc
      .from("prehire_candidates")
      .update({ invited_at: new Date().toISOString() })
      .eq("id", cand.id);

    const emailed = isEmailConfigured() && ok;
    await logPrehireEvent({
      action: "invitation_sent",
      requisitionId: cand.requisition_id,
      candidateId: cand.id,
      actorLabel: "client_manager",
      detail: { channel: emailed ? "email" : "link", emailConfigured: isEmailConfigured() },
    });
    return emailed;
  } catch {
    return false;
  }
}

// ── invitePrehire ────────────────────────────────────────────────
/**
 * Ensure the shell, draw delegates.length seats, provision each candidate on the
 * shell, and send their invitation. Seats are drawn BEFORE any candidate is
 * created and released on any failure so they are never lost. Org is forced onto
 * the shell and re-verified before any candidate write.
 */
export async function invitePrehire(opts: {
  orgId: string;
  araOrgId: string | null;
  alloc: Allocation;
  delegates: SeatDelegate[];
}): Promise<{ ok: true; invited: number; emailed: number } | { error: string }> {
  const { orgId, araOrgId, alloc, delegates } = opts;
  if (!orgId) return { error: "Missing organization." };

  // De-dupe + validate recipients before touching seats.
  const seen = new Set<string>();
  const clean: SeatDelegate[] = [];
  for (const d of delegates ?? []) {
    const email = (d?.email ?? "").trim().toLowerCase();
    if (!email || !EMAIL_RE.test(email) || seen.has(email)) continue;
    seen.add(email);
    clean.push({ email: (d.email ?? "").trim(), name: d.name?.trim() || undefined });
  }
  const count = clean.length;
  if (count === 0) return { error: "Add at least one valid recipient." };

  // 1. Prepare the shell (find-or-create, org forced).
  const shell = await ensurePrehireShell(orgId, araOrgId, alloc);
  if ("error" in shell) return { error: shell.error };

  // 2. Reserve seats atomically (over-quota / expired -> refused).
  const draw = await drawAllocation(orgId, "prehire", count);
  if (!draw.ok) {
    return {
      error:
        draw.reason === "over_quota"
          ? "Not enough seats remaining (or the allocation has expired)."
          : draw.message || "Could not reserve seats.",
    };
  }

  // 3. Provision + invite. A provisioning failure releases only the seats whose
  //    candidate never landed - the partial successes keep their seat so the ledger
  //    matches actual consumption. createdIds is hoisted above the try so the outer
  //    catch (a THROWN insert error mid-loop) also releases only the uncommitted
  //    seats, not the whole draw (which would decrement seats_used below true
  //    consumption and let the org re-draw already-consumed seats).
  const createdIds: string[] = [];
  try {
    const svc = createServiceClient();

    // Re-verify the shell still belongs to this org before writing candidates.
    const { data: shellRow } = await svc
      .from("prehire_requisitions")
      .select("organization_id")
      .eq("id", shell.shellId)
      .maybeSingle<{ organization_id: string | null }>();
    if (!shellRow || shellRow.organization_id !== orgId) {
      await releaseAllocation(orgId, "prehire", count);
      return { error: "Screening shell does not belong to this organization." };
    }

    for (const d of clean) {
      const c = await provisionCandidate(svc, shell.shellId, d);
      if ("error" in c) {
        // Skip this one and keep the batch going; its seat is reclaimed below so
        // the ledger matches exactly the candidates that actually landed.
        continue;
      }
      createdIds.push(c.id);
      await logPrehireEvent({
        action: "candidate_added",
        requisitionId: shell.shellId,
        candidateId: c.id,
        actorLabel: "client_manager",
      });
    }

    // Reclaim seats for any candidate that did not land (release only the
    // difference, never the whole draw - the created ones keep their seat).
    if (createdIds.length < count) {
      await releaseAllocation(orgId, "prehire", count - createdIds.length);
    }
    if (createdIds.length === 0) {
      return { error: "Could not add any candidates." };
    }

    let emailed = 0;
    for (const id of createdIds) {
      if (await inviteCandidate(svc, id)) emailed += 1;
    }

    return { ok: true, invited: createdIds.length, emailed };
  } catch (e) {
    // Release only the uncommitted seats - candidates already inserted keep theirs.
    if (count - createdIds.length > 0) {
      await releaseAllocation(orgId, "prehire", count - createdIds.length);
    }
    return { error: e instanceof Error ? e.message : "Could not invite candidates." };
  }
}

// ── prehireSeatActivity ──────────────────────────────────────────
type StageResultLite = { status: string | null; completed_at: string | null };
type CandidateLite = {
  id: string;
  full_name: string | null;
  invited_at: string | null;
  completed_at: string | null;
  composite_score: number | null;
  recommendation: string | null;
  // NOTE: deliberately NO demographic columns (gender / age_band /
  // nationality_group) - those never leave the admin-only adverse-impact view.
  prehire_stage_results: StageResultLite[] | null;
};

function recommendationLabel(rec: string | null): string {
  switch ((rec ?? "").toLowerCase()) {
    case "advance":
      return "Advance";
    case "review":
      return "Review";
    case "hold":
      return "Hold";
    case "incomplete":
      return "Incomplete";
    default:
      return rec ? rec : "Pending";
  }
}

/**
 * Org-scoped monitor for the client portal. Resolves the org's self-serve shell,
 * then counts invited / started / completed candidates and returns a row per
 * completed candidate (name, score summary, recommendation) with a reportPath the
 * portal links to (the /api/admin/prehire report route already admits a
 * client_manager whose org matches). Tolerant: a missing table/column yields an
 * empty SeatActivity, never a throw.
 */
export async function prehireSeatActivity(
  orgId: string,
  araOrgId: string | null,
): Promise<SeatActivity> {
  void araOrgId; // unused for Pre-Hire (AC org store)
  const empty: SeatActivity = { shellId: null, invited: 0, started: 0, completed: 0, rows: [] };
  if (!orgId) return empty;

  try {
    const svc = createServiceClient();

    // Find this org's self-serve shell (do NOT create one for a read).
    const { data: shellRow } = await svc
      .from("prehire_requisitions")
      .select("id, organization_id")
      .eq("organization_id", orgId)
      .eq("title", SELF_SERVE_TITLE)
      .limit(1)
      .maybeSingle<{ id: string; organization_id: string | null }>();
    if (!shellRow?.id || shellRow.organization_id !== orgId) return empty;
    const shellId = shellRow.id;

    // Page the candidate set (deterministic .order('id')): an unpaginated read
    // caps at 1000, so a large shell's invited/started/completed counts + rows
    // would all undercount past 1000 candidates.
    const candidates = await fetchAllPages<CandidateLite>((from, to) =>
      svc
        .from("prehire_candidates")
        .select(
          "id, full_name, invited_at, completed_at, composite_score, recommendation, prehire_stage_results(status, completed_at)",
        )
        .eq("requisition_id", shellId)
        .order("id")
        .range(from, to),
    ).catch(() => null);
    if (!candidates) return { ...empty, shellId };
    let invited = 0;
    let started = 0;
    let completed = 0;
    const rows: SeatActivityRow[] = [];

    for (const c of candidates) {
      if (c.invited_at) invited += 1;
      const stages = c.prehire_stage_results ?? [];
      const anyStarted = stages.length > 0 || c.completed_at !== null;
      const allDoneFlag = c.completed_at !== null;
      const anyCompletedStage = stages.some((s) => s.status === "completed");
      if (anyStarted) started += 1;

      const isComplete = allDoneFlag || anyCompletedStage;
      if (isComplete) {
        completed += 1;
        const score =
          typeof c.composite_score === "number" ? `${Math.round(c.composite_score)}/100` : "score pending";
        const completedDates = stages
          .map((s) => s.completed_at)
          .filter((d): d is string => typeof d === "string");
        const date =
          c.completed_at ??
          (completedDates.length > 0
            ? completedDates.sort().slice(-1)[0]
            : new Date().toISOString());
        rows.push({
          id: c.id,
          name: c.full_name ?? "Candidate",
          date,
          // Names + scores + advisory recommendation only - never demographics.
          summary: `${score} - ${recommendationLabel(c.recommendation)}`,
          reportPath: `/api/admin/prehire/${shellId}/candidate/${c.id}/report`,
        });
      }
    }

    // Counts are exact (computed over the full paged set); cap the PII display list
    // at 100 newest-first so a very large shell doesn't ship an unbounded payload.
    const displayRows = rows.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "")).slice(0, 100);
    return { shellId, invited, started, completed, rows: displayRows };
  } catch {
    return empty;
  }
}