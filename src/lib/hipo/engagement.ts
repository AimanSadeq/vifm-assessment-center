// ─────────────────────────────────────────────────────────────
// HiPo Engagement pillar - manager-rated mini-survey.
//
// Spec: docs/hipo-engagement-pillar-spec.md. Six observable manager judgements
// on a 1-5 Likert (item 4 reverse-keyed), scored as the mean on the shared
// 1-5 scale with the same band cuts as Aspiration/Ability. Server-only
// (service role); the unguessable access_token is the manager's sole
// credential, mirroring the Reflect rater pattern.
// ─────────────────────────────────────────────────────────────

import { createServiceClient } from "@/lib/supabase/server";
import { HIPO_CUTS, hipoBand, HIPO_BAND_LABEL, type HipoBand } from "@/lib/reports/persona-hipo-model";
import {
  HIPO_ENGAGEMENT_ITEMS,
  ENGAGEMENT_MIN_ANSWERED,
  scoreEngagement,
  type EngagementItem,
} from "@/lib/hipo/engagement-items";

const TOKEN_RE = /^[0-9a-fA-F-]{36}$/;

// Re-export the client-safe half so server callers keep one import surface.
export { HIPO_ENGAGEMENT_ITEMS, ENGAGEMENT_MIN_ANSWERED, scoreEngagement };
export type { EngagementItem };

export type EngagementSurveyRow = {
  id: string;
  bundle_candidate_id: string;
  manager_name: string;
  manager_email: string;
  access_token: string;
  answers: Record<string, number> | null;
  context_note: string | null;
  score: number | null;
  completed_at: string | null;
  created_at: string;
};

export type EngagementSurveyContext = {
  survey: EngagementSurveyRow;
  candidateName: string;
};

/** Token lookup for the manager form. Returns null on bad/unknown tokens. */
export async function findEngagementSurveyByToken(token: string): Promise<EngagementSurveyContext | null> {
  if (!TOKEN_RE.test(token)) return null;
  const sb = createServiceClient();
  const { data } = await sb
    .from("hipo_engagement_surveys")
    .select("id, bundle_candidate_id, manager_name, manager_email, access_token, answers, context_note, score, completed_at, created_at")
    .eq("access_token", token)
    .maybeSingle<EngagementSurveyRow>();
  if (!data) return null;
  const { data: cand } = await sb
    .from("bundle_candidates")
    .select("full_name")
    .eq("id", data.bundle_candidate_id)
    .maybeSingle<{ full_name: string }>();
  return { survey: data, candidateName: cand?.full_name ?? "the candidate" };
}

/** Submit the manager's answers. Single-use: refuses an already-completed
 *  survey (the completed_at IS NULL guard makes the write race-safe). */
export async function submitEngagementSurvey(
  token: string,
  answers: Record<string, number>,
  contextNote: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const ctx = await findEngagementSurveyByToken(token);
  if (!ctx) return { ok: false, error: "This link is not valid." };
  if (ctx.survey.completed_at) return { ok: false, error: "This survey was already submitted." };

  // Keep only known keys with valid values.
  const clean: Record<string, number> = {};
  for (const item of HIPO_ENGAGEMENT_ITEMS) {
    const v = answers[item.key];
    if (typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 5) clean[item.key] = v;
  }
  const score = scoreEngagement(clean);
  if (score == null) {
    return { ok: false, error: `Please answer at least ${ENGAGEMENT_MIN_ANSWERED} of the ${HIPO_ENGAGEMENT_ITEMS.length} statements.` };
  }

  const sb = createServiceClient();
  const { data, error } = await sb
    .from("hipo_engagement_surveys")
    .update({
      answers: clean,
      context_note: (contextNote ?? "").trim().slice(0, 2000) || null,
      score,
      completed_at: new Date().toISOString(),
    })
    .eq("id", ctx.survey.id)
    .is("completed_at", null)
    .select("id");
  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0) return { ok: false, error: "This survey was already submitted." };
  return { ok: true };
}

export type EngagementResult = {
  score: number;
  band: HipoBand;
  bandLabel: string;
  managerName: string;
  completedAt: string;
  items: { label: string; labelAr: string; reverse: boolean; answer: number; scored: number }[];
};

/** Latest completed survey for a candidate - feeds the report's third gauge. */
export async function latestEngagementForCandidate(bundleCandidateId: string): Promise<EngagementResult | null> {
  const sb = createServiceClient();
  const { data } = await sb
    .from("hipo_engagement_surveys")
    .select("manager_name, answers, score, completed_at")
    .eq("bundle_candidate_id", bundleCandidateId)
    .not("completed_at", "is", null)
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ manager_name: string; answers: Record<string, number> | null; score: number | null; completed_at: string }>();
  if (!data || data.score == null) return null;
  const answers = data.answers ?? {};
  const items = HIPO_ENGAGEMENT_ITEMS.filter((i) => typeof answers[i.key] === "number").map((i) => ({
    label: i.en,
    labelAr: i.ar,
    reverse: !!i.reverse,
    answer: answers[i.key],
    scored: i.reverse ? 6 - answers[i.key] : answers[i.key],
  }));
  const band = hipoBand(Number(data.score));
  return {
    score: Number(data.score),
    band,
    bandLabel: HIPO_BAND_LABEL[band],
    managerName: data.manager_name,
    completedAt: data.completed_at,
    items,
  };
}

export { HIPO_CUTS };
