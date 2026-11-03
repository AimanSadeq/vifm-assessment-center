import { createServiceClient } from "@/lib/supabase/server";
import { fetchAllPages, chunkIds } from "@/lib/ara/paginate";
import { loadPlatformClients, type PlatformClient } from "@/lib/clients/registry";
import { getAllocationsForOrg, type Allocation } from "@/lib/clients/allocations";
import { getServiceActivity, type PendingRow, type ReportLink } from "@/lib/clients/monitor";
import { PORTAL_SERVICES, type CaliberService } from "@/lib/clients/portal-services";
import { loadFiledReports } from "@/lib/bespoke/report-filing";

/**
 * Everything one client holds on Caliber, on one page (Ahmad, 3 Nov 2026):
 * instead of opening each solution's portal to find a client's people and
 * reports, the admin opens the client and sees every service it subscribes
 * to, the activity in each, the people who completed, and their reports,
 * with a download-all per service where one exists.
 *
 * Read-only aggregation over the two client stores: the AC store (Pre-Hire,
 * Fluent, Logica, Persona, Techno, bespoke bundles) keyed by `organizations.id`
 * and the ARA store (AI Readiness Compass, Reflect 360) keyed by
 * `ara_organizations.id`. Each section is best-effort: a missing table or an
 * empty service yields an empty section, never an error page.
 */

export type ReportRow = {
  id: string;
  name: string;
  date: string | null;
  summary: string;
  /** Admin-gated report route, or null when no report exists for this row. */
  reportPath: string | null;
  /** When a sitting yields several reports (Persona), each one; the page lists them all. */
  reports?: ReportLink[];
};

export type VoucherServiceSection = {
  service: CaliberService;
  label: string;
  accent: string;
  issued: number;
  redeemed: number;
  completed: number;
  rows: ReportRow[];
  /** Redeemed or started but never submitted. */
  pending: PendingRow[];
  zipPath: string | null;
  managePath: string;
};

export type ArcAssessmentSummary = {
  id: string;
  label: string;
  stage: string;
  status: string;
  isPractice: boolean;
  createdAt: string;
  respondents: number;
  completed: number;
  orgReportPath: string | null;
  managePath: string;
};

export type ArcSection = {
  assessments: ArcAssessmentSummary[];
  /** Completed delegates with a personal report. */
  delegates: ReportRow[];
  cohorts: { label: string; redeemed: number; insightsPath: string }[];
  zipPath: string | null;
};

export type ReflectSection = {
  engagements: { id: string; name: string; status: string; createdAt: string; participants: number; released: number; cohortReportPath: string; managePath: string }[];
  participants: ReportRow[];
};

export type PrehireSection = {
  engagements: { id: string; name: string; status: string; type: string | null; createdAt: string; candidates: number; completed: number; managePath: string }[];
  candidates: ReportRow[];
};

export type BundleSummary = {
  id: string;
  name: string;
  kind: string;
  status: string;
  createdAt: string;
  invited: number;
  inProgress: number;
  completed: number;
  scored: number;
  filedReports: number;
  zipPath: string | null;
  managePath: string;
};

export type Client360 = {
  client: PlatformClient;
  allocations: Allocation[];
  voucherServices: VoucherServiceSection[];
  arc: ArcSection | null;
  reflect: ReflectSection | null;
  prehire: PrehireSection | null;
  bundles: BundleSummary[] | null;
  /** Services with any activity, for the summary strip. */
  activeServices: string[];
};

const VOUCHER_SERVICES: CaliberService[] = ["fluent", "logica", "persona", "techno"];

/** The row key the clients list links with: the registry's case-insensitive name key. */
export async function findPlatformClient(key: string): Promise<PlatformClient | null> {
  const clients = await loadPlatformClients();
  return clients.find((c) => c.key === key) ?? null;
}

export async function loadClient360(key: string): Promise<Client360 | null> {
  const client = await findPlatformClient(key);
  if (!client) return null;

  const [allocations, voucherServices, arc, reflect, prehire, bundles] = await Promise.all([
    client.acId ? getAllocationsForOrg(client.acId).catch(() => [] as Allocation[]) : Promise.resolve([] as Allocation[]),
    client.acId ? loadVoucherServices(client.acId) : Promise.resolve([] as VoucherServiceSection[]),
    client.araId ? loadArc(client.araId) : Promise.resolve(null),
    client.araId ? loadReflect(client.araId) : Promise.resolve(null),
    client.acId ? loadPrehire(client.acId) : Promise.resolve(null),
    client.acId ? loadBundles(client.acId) : Promise.resolve(null),
  ]);

  const activeServices: string[] = [];
  for (const s of voucherServices) activeServices.push(s.label);
  if (arc && (arc.assessments.length > 0 || arc.cohorts.length > 0)) activeServices.push("AI Readiness Compass");
  if (reflect && reflect.engagements.length > 0) activeServices.push("Reflect 360");
  if (prehire && prehire.engagements.length > 0) activeServices.push("Pre-Hire / Assessment Center");
  if (bundles && bundles.length > 0) activeServices.push("Bespoke bundles");

  return { client, allocations, voucherServices, arc, reflect, prehire, bundles, activeServices };
}

async function loadVoucherServices(acId: string): Promise<VoucherServiceSection[]> {
  const out: VoucherServiceSection[] = [];
  for (const service of VOUCHER_SERVICES) {
    try {
      const act = await getServiceActivity(service, acId);
      const pending = act.pending ?? [];
      if (act.issued + act.redeemed + act.completed + pending.length === 0) continue;
      const meta = PORTAL_SERVICES.find((s) => s.id === service)!;
      const rows: ReportRow[] = act.rows.map((r) => ({
        id: r.id,
        name: r.name,
        date: r.date || null,
        summary: r.summary,
        // Techno's portal row links to the results page; the PDF lives on the report route.
        reportPath: service === "techno" ? `/api/tech-sandbox/${r.id}/report` : r.reportPath,
        reports: r.reports,
      }));
      out.push({
        service,
        label: meta.label,
        accent: meta.accent,
        issued: act.issued,
        redeemed: act.redeemed,
        completed: act.completed,
        rows,
        pending,
        zipPath: rows.length > 0 ? `/api/admin/clients/reports-zip?service=${service}&org=${acId}` : null,
        managePath: `/portal/services/${service}?org=${acId}`,
      });
    } catch (e) {
      console.error(`[client-360] ${service} activity failed:`, e instanceof Error ? e.message : e);
    }
  }
  return out;
}

async function loadArc(araId: string): Promise<ArcSection | null> {
  try {
    const sb = createServiceClient();
    type ARow = { id: string; scope_label: string | null; engagement_stage: string; status: string; is_sandbox: boolean; created_at: string; include_individual_layer: boolean | null };
    const assessments = await fetchAllPages<ARow>((from, to) =>
      sb
        .from("ara_assessments")
        .select("id, scope_label, engagement_stage, status, is_sandbox, created_at, include_individual_layer")
        .eq("organization_id", araId)
        .order("created_at", { ascending: false })
        .order("id")
        .range(from, to),
    );
    type RRow = { id: string; assessment_id: string; name: string; completed_at: string | null; access_token: string | null };
    const respondents: RRow[] = [];
    for (const ids of chunkIds(assessments.map((a) => a.id))) {
      respondents.push(
        ...(await fetchAllPages<RRow>((from, to) =>
          sb
            .from("ara_respondents")
            .select("id, assessment_id, name, completed_at, access_token")
            .in("assessment_id", ids)
            .order("id")
            .range(from, to),
        )),
      );
    }
    const byAssessment = new Map<string, RRow[]>();
    for (const r of respondents) byAssessment.set(r.assessment_id, [...(byAssessment.get(r.assessment_id) ?? []), r]);

    const personalEligible = new Set(assessments.filter((a) => a.engagement_stage === "individual" || !!a.include_individual_layer).map((a) => a.id));
    const summaries: ArcAssessmentSummary[] = assessments.map((a) => {
      const rs = byAssessment.get(a.id) ?? [];
      return {
        id: a.id,
        label: a.scope_label?.trim() || `${a.engagement_stage} assessment`,
        stage: a.engagement_stage,
        status: a.status,
        isPractice: a.is_sandbox,
        createdAt: a.created_at,
        respondents: rs.length,
        completed: rs.filter((r) => r.completed_at).length,
        orgReportPath: a.engagement_stage !== "individual" ? `/api/ara/reports/${a.id}/pdf` : null,
        managePath: `/ara/consultant/assessments/${a.id}`,
      };
    });

    const delegates: ReportRow[] = respondents
      .filter((r) => r.completed_at && personalEligible.has(r.assessment_id))
      .sort((a, b) => (b.completed_at ?? "").localeCompare(a.completed_at ?? ""))
      .map((r) => ({
        id: r.id,
        name: r.name,
        date: r.completed_at,
        summary: "Personal AI Readiness Report",
        reportPath: r.access_token ? `/api/ara/personal/${r.access_token}/pdf` : null,
      }));

    // Voucher cohorts tagged to this client, grouped the way the insights page groups them.
    const vouchers = await fetchAllPages<{ id: string }>((from, to) =>
      sb.from("ara_vouchers").select("id").eq("organization_id", araId).order("id").range(from, to),
    );
    const cohortCount = new Map<string, number>();
    for (const ids of chunkIds(vouchers.map((v) => v.id))) {
      const reds = await fetchAllPages<{ company_name: string | null; excluded_at: string | null }>((from, to) =>
        sb.from("ara_voucher_redemptions").select("company_name, excluded_at").in("voucher_id", ids).order("id").range(from, to),
      );
      for (const r of reds) {
        if (r.excluded_at) continue;
        const label = (r.company_name ?? "").trim();
        if (!label) continue;
        cohortCount.set(label, (cohortCount.get(label) ?? 0) + 1);
      }
    }
    const cohorts = Array.from(cohortCount, ([label, redeemed]) => ({
      label,
      redeemed,
      insightsPath: `/ara/admin/vouchers/insights?company=${encodeURIComponent(label)}`,
    })).sort((a, b) => b.redeemed - a.redeemed);

    if (summaries.length === 0 && cohorts.length === 0) return { assessments: [], delegates: [], cohorts: [], zipPath: null };
    return {
      assessments: summaries,
      delegates,
      cohorts,
      zipPath: delegates.length > 0 ? `/api/ara/admin/vouchers/zip?org=${araId}` : null,
    };
  } catch (e) {
    console.error("[client-360] ARC section failed:", e instanceof Error ? e.message : e);
    return null;
  }
}

async function loadReflect(araId: string): Promise<ReflectSection | null> {
  try {
    const sb = createServiceClient();
    type ERow = { id: string; name: string; status: string; created_at: string };
    const engagements = await fetchAllPages<ERow>((from, to) =>
      sb.from("reflect_engagements").select("id, name, status, created_at").eq("organization_id", araId).order("created_at", { ascending: false }).order("id").range(from, to),
    );
    type PRow = { id: string; engagement_id: string; full_name: string; status: string; updated_at: string };
    const participants: PRow[] = [];
    for (const ids of chunkIds(engagements.map((e) => e.id))) {
      participants.push(
        ...(await fetchAllPages<PRow>((from, to) =>
          sb.from("reflect_participants").select("id, engagement_id, full_name, status, updated_at").in("engagement_id", ids).order("id").range(from, to),
        )),
      );
    }
    const released = (s: string) => s === "closed" || s === "report_released";
    return {
      engagements: engagements.map((e) => {
        const ps = participants.filter((p) => p.engagement_id === e.id);
        return {
          id: e.id,
          name: e.name,
          status: e.status,
          createdAt: e.created_at,
          participants: ps.length,
          released: ps.filter((p) => released(p.status)).length,
          cohortReportPath: `/api/reflect/reports/cohort/${e.id}/pdf`,
          managePath: `/reflect/consultant/engagements/${e.id}`,
        };
      }),
      participants: participants
        .filter((p) => released(p.status))
        .map((p) => ({ id: p.id, name: p.full_name, date: p.updated_at, summary: "Reflect 360 report", reportPath: `/api/reflect/reports/${p.id}/pdf` })),
    };
  } catch (e) {
    console.error("[client-360] Reflect section failed:", e instanceof Error ? e.message : e);
    return null;
  }
}

async function loadPrehire(acId: string): Promise<PrehireSection | null> {
  try {
    const sb = createServiceClient();
    type ERow = { id: string; name: string; status: string; assessment_type: string | null; project_type: string | null; created_at: string };
    const engagements = await fetchAllPages<ERow>((from, to) =>
      sb.from("engagements").select("id, name, status, assessment_type, project_type, created_at").eq("organization_id", acId).order("created_at", { ascending: false }).order("id").range(from, to),
    );
    type CRow = { id: string; engagement_id: string; full_name: string; status: string; updated_at: string };
    const candidates: CRow[] = [];
    for (const ids of chunkIds(engagements.map((e) => e.id))) {
      candidates.push(
        ...(await fetchAllPages<CRow>((from, to) =>
          sb.from("candidates").select("id, engagement_id, full_name, status, updated_at").in("engagement_id", ids).order("id").range(from, to),
        )),
      );
    }
    return {
      engagements: engagements.map((e) => {
        const cs = candidates.filter((c) => c.engagement_id === e.id);
        return {
          id: e.id,
          name: e.name,
          status: e.status,
          type: e.assessment_type ?? e.project_type ?? null,
          createdAt: e.created_at,
          candidates: cs.length,
          completed: cs.filter((c) => c.status === "completed").length,
          managePath: `/admin/engagements/${e.id}`,
        };
      }),
      candidates: candidates
        .filter((c) => c.status === "completed")
        .map((c) => ({
          id: c.id,
          name: c.full_name,
          date: c.updated_at,
          summary: "Candidate report",
          reportPath: `/api/admin/prehire/${c.engagement_id}/candidate/${c.id}/report`,
        })),
    };
  } catch (e) {
    console.error("[client-360] Pre-Hire section failed:", e instanceof Error ? e.message : e);
    return null;
  }
}

async function loadBundles(acId: string): Promise<BundleSummary[] | null> {
  try {
    const sb = createServiceClient();
    type BRow = { id: string; name_en: string; kind: string; status: string; created_at: string };
    const bundles = await fetchAllPages<BRow>((from, to) =>
      sb.from("bespoke_services").select("id, name_en, kind, status, created_at").eq("organization_id", acId).eq("is_sample", false).order("created_at", { ascending: false }).order("id").range(from, to),
    );
    if (bundles.length === 0) return [];
    type CRow = { bespoke_service_id: string; status: string; scored_at: string | null; email: string };
    const candidates: CRow[] = [];
    for (const ids of chunkIds(bundles.map((b) => b.id))) {
      candidates.push(
        ...(await fetchAllPages<CRow>((from, to) =>
          sb.from("bundle_candidates").select("bespoke_service_id, status, scored_at, email").in("bespoke_service_id", ids).order("id").range(from, to),
        )),
      );
    }
    const out: BundleSummary[] = [];
    for (const b of bundles) {
      // VIFM testers (viftraining.com) are never counted as the client's people.
      const cs = candidates.filter((c) => c.bespoke_service_id === b.id && !/@viftraining\.com$/i.test(c.email ?? ""));
      let filed = 0;
      try {
        filed = (await loadFiledReports({ bundleId: b.id })).length;
      } catch {
        filed = 0;
      }
      out.push({
        id: b.id,
        name: b.name_en,
        kind: b.kind,
        status: b.status,
        createdAt: b.created_at,
        invited: cs.filter((c) => c.status === "invited").length,
        inProgress: cs.filter((c) => c.status === "in_progress").length,
        completed: cs.filter((c) => c.status === "completed").length,
        scored: cs.filter((c) => c.scored_at).length,
        filedReports: filed,
        zipPath: filed > 0 ? `/api/admin/bundle-reports/zip?bundle=${b.id}` : null,
        managePath: `/admin/bespoke/${b.id}`,
      });
    }
    return out;
  } catch (e) {
    console.error("[client-360] bundles section failed:", e instanceof Error ? e.message : e);
    return null;
  }
}
