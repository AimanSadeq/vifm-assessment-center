import "server-only";

// SDC High-Potential reports: reads for one candidate and for a bundle's
// cohort, with the service client (the routes are admin-only). Rows are turned
// into report data by assemble.ts.

import { createServiceClient } from "@/lib/supabase/server";
import { fetchAllPages, fetchAllByIdChunks } from "@/lib/ara/paginate";
import { isSdcFramework, type SdcCompetency } from "./rules";
import {
  assembleCandidate, assembleCohort, DONE_STATUSES,
  type AssembleResult, type CandidateRow, type RosterLite, type SjtResultLite, type PsyLite, type SessionLite,
} from "./assemble";
import type { SdcCandidateReport, SdcCohortReport } from "./html";

const CAND_COLS = "id, full_name, email, completed_at, status, bespoke_service_id, organization_id, cognitive_result_id, cognitive_session_id";
// Submission time and question counts for the reasoning sitting check.
const PSY_COLS = "id, scales, created_at, result";
const ROSTER_COLS = "bundle_candidate_id, grade, position, business_unit, is_tester";

type BundleInfo = { id: string; name: string | null; orgName: string | null; comps: SdcCompetency[] };

/** The bundle's name, client name and competencies; an error when it is not an SDC report bundle. */
async function loadSdcBundle(bundleId: string): Promise<AssembleResult<BundleInfo>> {
  const sb = createServiceClient();
  const { data: bundle } = await sb
    .from("bespoke_services")
    .select("id, name_en, organization_id")
    .eq("id", bundleId)
    .maybeSingle<{ id: string; name_en: string | null; organization_id: string | null }>();
  if (!bundle) return { ok: false, status: 404, error: "Assessment not found." };

  const [{ data: comps }, org] = await Promise.all([
    sb
      .from("bundle_competencies")
      .select("code, name, category, definition, required_levels, sort_order")
      .eq("bespoke_service_id", bundleId)
      .order("sort_order"),
    bundle.organization_id
      ? sb.from("organizations").select("name").eq("id", bundle.organization_id).maybeSingle<{ name: string | null }>()
      : Promise.resolve({ data: null }),
  ]);
  const list = ((comps ?? []) as SdcCompetency[]).map((c) => ({ ...c, required_levels: c.required_levels ?? {} }));
  if (!isSdcFramework(list.map((c) => c.code))) {
    return { ok: false, status: 400, error: "These reports are only for assessments that use the SDC competency framework." };
  }
  return { ok: true, data: { id: bundle.id, name: bundle.name_en, orgName: org.data?.name ?? null, comps: list } };
}

export async function loadSdcCandidateReport(
  candidateId: string,
): Promise<AssembleResult<SdcCandidateReport & { candidateId: string; bundleId: string }>> {
  const sb = createServiceClient();
  const { data: cand } = await sb.from("bundle_candidates").select(CAND_COLS).eq("id", candidateId).maybeSingle<CandidateRow>();
  if (!cand) return { ok: false, status: 404, error: "Candidate not found." };

  const bundle = await loadSdcBundle(cand.bespoke_service_id);
  if (!bundle.ok) return bundle;

  const [roster, sjt, psy, session] = await Promise.all([
    sb
      .from("bundle_roster")
      .select(ROSTER_COLS)
      .eq("bespoke_service_id", cand.bespoke_service_id)
      .eq("bundle_candidate_id", cand.id)
      .maybeSingle<RosterLite>(),
    sb
      .from("bundle_sjt_results")
      .select("bundle_candidate_id, scores, submitted_at")
      .eq("bundle_candidate_id", cand.id)
      .maybeSingle<SjtResultLite>(),
    cand.cognitive_result_id
      ? sb.from("psy_results").select(PSY_COLS).eq("id", cand.cognitive_result_id).maybeSingle<PsyLite>()
      : Promise.resolve({ data: null }),
    cand.cognitive_session_id
      ? sb.from("psy_sessions").select("id, created_at").eq("id", cand.cognitive_session_id).maybeSingle<SessionLite>()
      : Promise.resolve({ data: null }),
  ]);

  const built = assembleCandidate({
    cand,
    roster: roster.data ?? null,
    sjt: sjt.data ?? null,
    psy: psy.data ?? null,
    session: session.data ?? null,
    comps: bundle.data.comps,
    orgName: bundle.data.orgName,
  });
  if (!built.ok) return built;
  return { ok: true, data: { ...built.data, candidateId: cand.id, bundleId: cand.bespoke_service_id } };
}

export async function loadSdcCohortReport(bundleId: string): Promise<AssembleResult<SdcCohortReport & { bundleName: string | null }>> {
  const bundle = await loadSdcBundle(bundleId);
  if (!bundle.ok) return bundle;
  const sb = createServiceClient();

  const [cands, roster] = await Promise.all([
    fetchAllPages<CandidateRow>((from, to) =>
      sb.from("bundle_candidates").select(CAND_COLS).eq("bespoke_service_id", bundleId).in("status", DONE_STATUSES).order("id").range(from, to),
    ),
    fetchAllPages<RosterLite & { id: string }>((from, to) =>
      sb.from("bundle_roster").select(`id, ${ROSTER_COLS}`).eq("bespoke_service_id", bundleId).order("id").range(from, to),
    ),
  ]);
  const candIds = cands.map((c) => c.id);
  const psyIds = cands.map((c) => c.cognitive_result_id).filter((x): x is string => !!x);
  const sessionIds = cands.map((c) => c.cognitive_session_id).filter((x): x is string => !!x);
  const [sjt, psy, sessions] = await Promise.all([
    fetchAllByIdChunks<SjtResultLite>(candIds, (chunk, from, to) =>
      sb.from("bundle_sjt_results").select("bundle_candidate_id, scores, submitted_at").in("bundle_candidate_id", chunk).order("bundle_candidate_id").range(from, to),
    ),
    fetchAllByIdChunks<PsyLite>(psyIds, (chunk, from, to) =>
      sb.from("psy_results").select(PSY_COLS).in("id", chunk).order("id").range(from, to),
    ),
    fetchAllByIdChunks<SessionLite>(sessionIds, (chunk, from, to) =>
      sb.from("psy_sessions").select("id, created_at").in("id", chunk).order("id").range(from, to),
    ),
  ]);

  const report = assembleCohort({ cands, roster, sjt, psy, sessions, comps: bundle.data.comps, orgName: bundle.data.orgName });
  return { ok: true, data: { ...report, bundleName: bundle.data.name } };
}
