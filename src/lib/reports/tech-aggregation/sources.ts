/**
 * Technical-assessment aggregation - data access (portal adapters).
 *
 * Two portals produce individual technical results; this module normalises both
 * into the single `RawTechResult` shape so the metric/insight engines are
 * portal-agnostic:
 *
 *   - Sandbox (PRIMARY, the live SDAIA/KAFD path): technical_sandbox_sessions.
 *     Domain = the function taken; score = overall_score_pct; company =
 *     organization_name; project = the voucher batch the session was redeemed
 *     from (else a per-function "direct" bucket).
 *   - MCQ (secondary): tech_assessment_results. Domain = domain_key; score =
 *     score_pct; company/project resolved from the standalone program or the
 *     bound engagement (a result with neither has no company and is skipped).
 *
 * Service-role only (these tables are admin-SELECT under RLS); every read is
 * best-effort + tolerant of a portal's tables not being present (returns []).
 */
import { createServiceClient } from "@/lib/supabase/server";
import type { RawTechResult } from "./types";

/** Canonical company grouping key: trim, lowercase, collapse whitespace. */
export function normalizeKey(name: string | null | undefined): string {
  return (name ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

type Sb = ReturnType<typeof createServiceClient>;

function firstOf<T>(v: T[] | T | null | undefined): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

const SESSION_LIMIT = 20000;

// ── Sandbox adapter ──────────────────────────────────────────────
type SandboxSessionRow = {
  id: string;
  function_id: string;
  candidate_name: string | null;
  candidate_email: string | null;
  organization_name: string | null;
  status: string;
  overall_score_pct: number | string | null;
  submitted_at: string | null;
  started_at: string | null;
};

async function loadFunctionNames(sb: Sb): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  try {
    const { data } = await sb.from("technical_functions").select("id, name_en");
    for (const f of (data ?? []) as Array<{ id: string; name_en: string | null }>) {
      map.set(f.id, f.name_en ?? f.id);
    }
  } catch {
    /* table absent - domain labels fall back to the id */
  }
  return map;
}

/**
 * session_id -> { batchId, label } from the voucher redemptions, so a session's
 * project is the cohort (voucher batch) it was redeemed from. Direct admin-issued
 * sessions have no redemption and fall back to a per-function bucket.
 */
async function loadSandboxProjectBySession(
  sb: Sb
): Promise<Map<string, { batchId: string | null; label: string | null }>> {
  const map = new Map<string, { batchId: string | null; label: string | null }>();
  try {
    const { data: reds } = await sb
      .from("technical_sandbox_voucher_redemptions")
      .select("session_id, voucher_id")
      .not("session_id", "is", null)
      .limit(SESSION_LIMIT);
    const redemptions = (reds ?? []) as Array<{ session_id: string; voucher_id: string }>;
    if (redemptions.length === 0) return map;
    const voucherIds = Array.from(new Set(redemptions.map((r) => r.voucher_id)));
    const { data: vouchers } = await sb
      .from("technical_sandbox_vouchers")
      .select("id, batch_id, label")
      .in("id", voucherIds);
    const voucherById = new Map(
      ((vouchers ?? []) as Array<{ id: string; batch_id: string | null; label: string | null }>).map(
        (v) => [v.id, v]
      )
    );
    for (const r of redemptions) {
      const v = voucherById.get(r.voucher_id);
      map.set(r.session_id, { batchId: v?.batch_id ?? r.voucher_id, label: v?.label ?? null });
    }
  } catch {
    /* voucher tables absent - all sandbox sessions treated as direct */
  }
  return map;
}

async function fromSandbox(): Promise<RawTechResult[]> {
  try {
    const sb = createServiceClient();
    const { data, error } = await sb
      .from("technical_sandbox_sessions")
      .select(
        "id, function_id, candidate_name, candidate_email, organization_name, status, overall_score_pct, submitted_at, started_at"
      )
      .limit(SESSION_LIMIT);
    if (error || !data) return [];
    const rows = data as SandboxSessionRow[];
    const [functionNames, projectBySession] = await Promise.all([
      loadFunctionNames(sb),
      loadSandboxProjectBySession(sb),
    ]);

    const out: RawTechResult[] = [];
    for (const r of rows) {
      const companyLabel = (r.organization_name ?? "").trim();
      if (!companyLabel) continue; // can't group an org-less session into a company
      const completed = r.status === "submitted";
      const domainLabel = functionNames.get(r.function_id) ?? r.function_id;
      const proj = projectBySession.get(r.id);
      const projectKey = proj ? `batch:${proj.batchId}` : `direct:${r.function_id}`;
      const projectLabel = proj?.label || (proj ? "Voucher cohort" : `${domainLabel} (direct)`);
      const scorePct =
        completed && r.overall_score_pct != null ? Number(r.overall_score_pct) : null;
      out.push({
        portal: "sandbox",
        candidateKey: (r.candidate_email || r.candidate_name || r.id).trim().toLowerCase(),
        candidateName: r.candidate_name ?? r.candidate_email ?? "Delegate",
        candidateEmail: r.candidate_email,
        companyKey: normalizeKey(companyLabel),
        companyLabel,
        projectKey,
        projectLabel,
        domainKey: `fn:${r.function_id}`,
        domainLabel,
        scorePct: scorePct != null && Number.isFinite(scorePct) ? scorePct : null,
        completed,
        takenAt: r.submitted_at ?? r.started_at ?? null,
      });
    }
    return out;
  } catch (e) {
    console.error("[tech-aggregation] fromSandbox error:", e);
    return [];
  }
}

// ── MCQ adapter ──────────────────────────────────────────────────
type McqResultRow = {
  taker_name: string | null;
  taker_email: string | null;
  domain_key: string;
  score_pct: number | string | null;
  candidate_id: string | null;
  engagement_id: string | null;
  program_id: string | null;
  created_at: string | null;
};

async function loadDomainNames(sb: Sb): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  try {
    const { data } = await sb.from("technical_domains").select("key, name_en");
    for (const d of (data ?? []) as Array<{ key: string; name_en: string | null }>) {
      map.set(d.key, d.name_en ?? d.key);
    }
  } catch {
    /* table absent - domain labels fall back to the key */
  }
  return map;
}

async function fromMcq(): Promise<RawTechResult[]> {
  try {
    const sb = createServiceClient();
    // program_id may be absent pre-00057; retry without it on a missing-column error.
    let rows: McqResultRow[] | null = null;
    {
      const full = await sb
        .from("tech_assessment_results")
        .select("taker_name, taker_email, domain_key, score_pct, candidate_id, engagement_id, program_id, created_at")
        .limit(SESSION_LIMIT);
      if (full.error) {
        const base = await sb
          .from("tech_assessment_results")
          .select("taker_name, taker_email, domain_key, score_pct, candidate_id, engagement_id, created_at")
          .limit(SESSION_LIMIT);
        if (base.error) return [];
        rows = (base.data as Array<Omit<McqResultRow, "program_id">>).map((r) => ({ ...r, program_id: null }));
      } else {
        rows = full.data as McqResultRow[];
      }
    }
    if (!rows || rows.length === 0) return [];

    // Resolve company + project for the engagement / program linkages.
    const engIds = Array.from(new Set(rows.map((r) => r.engagement_id).filter(Boolean) as string[]));
    const progIds = Array.from(new Set(rows.map((r) => r.program_id).filter(Boolean) as string[]));

    const engInfo = new Map<string, { company: string; project: string }>();
    if (engIds.length) {
      try {
        const { data: engs } = await sb
          .from("engagements")
          .select("id, name, organization_id, organizations(name)")
          .in("id", engIds);
        for (const e of (engs ?? []) as Array<{
          id: string; name: string | null; organization_id: string | null;
          organizations: { name: string }[] | { name: string } | null;
        }>) {
          const org = firstOf(e.organizations);
          if (org?.name) engInfo.set(e.id, { company: org.name, project: e.name ?? "Engagement" });
        }
      } catch {
        /* engagements/organizations shape differs - skip eng-linked rows */
      }
    }
    const progInfo = new Map<string, { company: string; project: string }>();
    if (progIds.length) {
      try {
        const { data: progs } = await sb
          .from("technical_programs")
          .select("id, name, organization_name")
          .in("id", progIds);
        for (const p of (progs ?? []) as Array<{ id: string; name: string | null; organization_name: string | null }>) {
          if (p.organization_name) progInfo.set(p.id, { company: p.organization_name, project: p.name ?? "Program" });
        }
      } catch {
        /* technical_programs absent - skip program-linked rows */
      }
    }

    const domainNames = await loadDomainNames(sb);
    const out: RawTechResult[] = [];
    for (const r of rows) {
      // Company precedence: program org -> engagement org. No link = no company.
      const link = (r.program_id && progInfo.get(r.program_id)) || (r.engagement_id && engInfo.get(r.engagement_id)) || null;
      if (!link) continue;
      const projectKey = r.program_id ? `program:${r.program_id}` : `engagement:${r.engagement_id}`;
      const score = r.score_pct != null ? Number(r.score_pct) : null;
      out.push({
        portal: "mcq",
        candidateKey: (r.taker_email || r.taker_name || `${projectKey}:${r.domain_key}`).trim().toLowerCase(),
        candidateName: r.taker_name ?? r.taker_email ?? "Delegate",
        candidateEmail: r.taker_email,
        companyKey: normalizeKey(link.company),
        companyLabel: link.company.trim(),
        projectKey,
        projectLabel: link.project,
        domainKey: r.domain_key,
        domainLabel: domainNames.get(r.domain_key) ?? r.domain_key,
        // MCQ results only exist on completion - every row is completed + invited.
        scorePct: score != null && Number.isFinite(score) ? score : null,
        completed: true,
        takenAt: r.created_at,
      });
    }
    return out;
  } catch (e) {
    console.error("[tech-aggregation] fromMcq error:", e);
    return [];
  }
}

/**
 * Every individual technical result across all portals, normalised. The
 * aggregator groups these by company then project. Each adapter is independent
 * and tolerant, so one portal being unavailable never breaks the other.
 */
export async function loadAllTechResults(): Promise<RawTechResult[]> {
  const [sandbox, mcq] = await Promise.all([fromSandbox(), fromMcq()]);
  return [...sandbox, ...mcq];
}
