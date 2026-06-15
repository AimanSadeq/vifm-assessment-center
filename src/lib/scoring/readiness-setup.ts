// ─────────────────────────────────────────────────────────────
// Succession Readiness setup - the data behind the combined-mode panel on the
// AC engagement detail. Reports the engagement's mode + linked Reflect 360, the
// Reflect engagements available to link, and per-candidate readiness status
// (role bound? Persona done? 360 done? tier computed?). Tolerant of migration
// 00099 not being applied (reflect_engagement_id column absent).
// ─────────────────────────────────────────────────────────────
import { createServiceClient } from "@/lib/supabase/server";

export type AssessmentMode = "standalone" | "combined";

export type CandidateReadinessStatus = {
  candidateId: string;
  name: string;
  roleBound: boolean;
  persona: "not_started" | "in_progress" | "submitted";
  reflectLinked: boolean;
  reflectRatersDone: number;
  reflectRatersTotal: number;
  readinessTier: string | null;
};

export type ReadinessSetup = {
  mode: AssessmentMode;
  reflectEngagementId: string | null;
  reflectEngagementName: string | null;
  reflectOptions: { id: string; name: string }[];
  candidates: CandidateReadinessStatus[];
  linkColumnReady: boolean; // false when 00099 isn't applied yet
};

export async function loadReadinessSetup(engagementId: string): Promise<ReadinessSetup> {
  const sb = createServiceClient();

  // Engagement mode + link (tolerant of 00099 not applied).
  let mode: AssessmentMode = "standalone";
  let reflectEngagementId: string | null = null;
  let linkColumnReady = true;
  {
    const withLink = await sb
      .from("engagements")
      .select("assessment_mode, reflect_engagement_id")
      .eq("id", engagementId)
      .maybeSingle();
    if (withLink.error) {
      linkColumnReady = false;
      const fallback = await sb.from("engagements").select("assessment_mode").eq("id", engagementId).maybeSingle();
      mode = (fallback.data?.assessment_mode as AssessmentMode) ?? "standalone";
    } else {
      mode = (withLink.data?.assessment_mode as AssessmentMode) ?? "standalone";
      reflectEngagementId = (withLink.data?.reflect_engagement_id as string | null) ?? null;
    }
  }

  const { data: reflectEngs } = await sb
    .from("reflect_engagements")
    .select("id, name")
    .order("created_at", { ascending: false });
  const reflectOptions = (reflectEngs ?? []).map((e) => ({ id: e.id as string, name: (e.name as string) ?? "Untitled" }));
  const reflectEngagementName = reflectEngagementId
    ? reflectOptions.find((o) => o.id === reflectEngagementId)?.name ?? null
    : null;

  const { data: cands } = await sb
    .from("candidates")
    .select("id, full_name, role_profile_id")
    .eq("engagement_id", engagementId)
    .order("full_name");
  const candList = cands ?? [];
  const candIds = candList.map((c) => c.id as string);

  // Persona (behavioral) session status per candidate.
  const personaByCand = new Map<string, string>();
  if (candIds.length) {
    const { data: sessions } = await sb
      .from("behavioral_assessment_sessions")
      .select("candidate_id, status")
      .eq("engagement_id", engagementId)
      .in("candidate_id", candIds);
    for (const s of sessions ?? []) personaByCand.set(s.candidate_id as string, s.status as string);
  }

  // Reflect participants bridged to these candidates (within the linked Reflect engagement).
  const partByCand = new Map<string, string>();
  if (reflectEngagementId && candIds.length) {
    const { data: parts } = await sb
      .from("reflect_participants")
      .select("id, candidate_id")
      .eq("engagement_id", reflectEngagementId)
      .in("candidate_id", candIds);
    for (const p of parts ?? []) if (p.candidate_id) partByCand.set(p.candidate_id as string, p.id as string);
  }
  const ratersByPart = new Map<string, { done: number; total: number }>();
  const partIds = [...partByCand.values()];
  if (partIds.length) {
    const { data: raters } = await sb.from("reflect_raters").select("participant_id, status").in("participant_id", partIds);
    for (const r of raters ?? []) {
      const pid = r.participant_id as string;
      const cur = ratersByPart.get(pid) ?? { done: 0, total: 0 };
      cur.total++;
      if (r.status === "completed") cur.done++;
      ratersByPart.set(pid, cur);
    }
  }

  // Readiness tier snapshot per candidate.
  const tierByCand = new Map<string, string>();
  if (candIds.length) {
    const { data: rr } = await sb
      .from("readiness_results")
      .select("candidate_id, tier, status")
      .eq("engagement_id", engagementId)
      .in("candidate_id", candIds);
    for (const r of rr ?? []) {
      const tier = r.status === "insufficient_data" ? "insufficient_data" : (r.tier as string | null);
      if (tier) tierByCand.set(r.candidate_id as string, tier);
    }
  }

  const candidates: CandidateReadinessStatus[] = candList.map((c) => {
    const id = c.id as string;
    const partId = partByCand.get(id);
    const raters = partId ? ratersByPart.get(partId) ?? { done: 0, total: 0 } : { done: 0, total: 0 };
    return {
      candidateId: id,
      name: (c.full_name as string) ?? "-",
      roleBound: !!c.role_profile_id,
      persona: (personaByCand.get(id) as CandidateReadinessStatus["persona"]) ?? "not_started",
      reflectLinked: !!partId,
      reflectRatersDone: raters.done,
      reflectRatersTotal: raters.total,
      readinessTier: tierByCand.get(id) ?? null,
    };
  });

  return { mode, reflectEngagementId, reflectEngagementName, reflectOptions, candidates, linkColumnReady };
}
