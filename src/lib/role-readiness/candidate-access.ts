// Token-based access for the Role Readiness candidate flow. Identity is derived
// server-side from rr_candidates.access_token (no account). Service-role reads,
// mirroring the Pre-Hire / ARA respondent model.

import { createServiceClient } from "@/lib/supabase/server";
import { loadRoleConfig, type RoleReadinessConfig } from "./config";

const TOKEN_RE = /^[0-9a-fA-F-]{36}$/;

export type RrSectionView = {
  section: "persona" | "technical";
  passed: boolean | null;
  score_pct: number | null;
  completed_at: string | null;
};

export type RrCandidateContext = {
  candidate: {
    id: string;
    full_name: string;
    email: string;
    status: string;
    verdict: string;
    consent_at: string | null;
    persona_session_id: string | null;
    role_config_id: string;
    organization_id: string | null;
    is_sample: boolean;
  };
  config: RoleReadinessConfig;
  sections: RrSectionView[];
};

export async function findRrCandidateByToken(token: string): Promise<RrCandidateContext | null> {
  if (!token || !TOKEN_RE.test(token)) return null;
  const svc = createServiceClient();

  const { data: cand } = await svc
    .from("rr_candidates")
    .select(
      "id, full_name, email, status, verdict, consent_at, persona_session_id, role_config_id, organization_id, is_sample, rr_section_results(section, passed, score_pct, completed_at)"
    )
    .eq("access_token", token)
    .maybeSingle();
  if (!cand) return null;

  const config = await loadRoleConfig(cand.role_config_id as string);
  if (!config) return null;

  return {
    candidate: {
      id: cand.id as string,
      full_name: cand.full_name as string,
      email: cand.email as string,
      status: cand.status as string,
      verdict: cand.verdict as string,
      consent_at: (cand.consent_at as string | null) ?? null,
      persona_session_id: (cand.persona_session_id as string | null) ?? null,
      role_config_id: cand.role_config_id as string,
      organization_id: (cand.organization_id as string | null) ?? null,
      is_sample: !!cand.is_sample,
    },
    config,
    sections: ((cand.rr_section_results ?? []) as RrSectionView[]).map((s) => ({
      section: s.section,
      passed: s.passed,
      score_pct: s.score_pct,
      completed_at: s.completed_at,
    })),
  };
}
