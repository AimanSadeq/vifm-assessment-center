// ─────────────────────────────────────────────────────────────
// Slice 5 - readiness → IDP linkage.
//
// Turns a readiness verdict into a development-plan draft on Reflect's
// reflect_idps (keyed by reflect_participants.id, resolved via the
// candidate↔participant bridge). Priorities are chosen from the engine's
// per-competency gaps + knockouts + blind spots (handover B.2); behaviours
// come from the catalogue's development tips. The draft is left for a coach
// to finalise - never auto-agreed, and an already-edited (non-draft) IDP is
// not overwritten.
// ─────────────────────────────────────────────────────────────
import { createServiceClient } from "@/lib/supabase/server";
import { computeCandidateReadiness } from "@/lib/scoring/readiness-data";

const MAX_PRIORITIES = 5;
const PRIORITY_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };

export type GenerateIdpResult =
  | { ok: true; participantId: string; priorities: number; reused: boolean }
  | { ok: false; error: "no_participant" | "insufficient" | "save_failed"; message: string };

/** Resolve the Reflect participant for a candidate (candidate_id bridge, else email). */
async function resolveParticipantId(
  sb: ReturnType<typeof createServiceClient>,
  candidateId: string,
  email: string | null,
): Promise<string | null> {
  try {
    const { data } = await sb
      .from("reflect_participants")
      .select("id, created_at")
      .eq("candidate_id", candidateId)
      .order("created_at", { ascending: false })
      .limit(1);
    if (data && data.length) return data[0].id as string;
  } catch {
    /* candidate_id column not migrated - fall back to email */
  }
  if (email) {
    const { data } = await sb
      .from("reflect_participants")
      .select("id, created_at")
      .ilike("email", email)
      .order("created_at", { ascending: false })
      .limit(1);
    if (data && data.length) return data[0].id as string;
  }
  return null;
}

/** Build + upsert a draft IDP from the candidate's readiness result. */
export async function generateIdpFromReadiness(
  engagementId: string,
  candidateId: string,
): Promise<GenerateIdpResult> {
  const sb = createServiceClient();

  const { data: cand } = await sb
    .from("candidates")
    .select("email")
    .eq("id", candidateId)
    .maybeSingle();
  const participantId = await resolveParticipantId(sb, candidateId, (cand?.email as string) ?? null);
  if (!participantId) {
    return { ok: false, error: "no_participant", message: "No linked Reflect participant for this candidate." };
  }

  const r = await computeCandidateReadiness(engagementId, candidateId, null, false);
  if (r.status === "insufficient_data") {
    return { ok: false, error: "insufficient", message: "Not enough 360 data to build a plan." };
  }

  // ── Priority selection (handover B.2) ──
  // 1) knockouts first; 2) largest below-target gaps (most negative, high-prio
  // tie-break); 3) blind spots. Skip at/above target. Cap MAX_PRIORITIES.
  const chosen: typeof r.competencies = [];
  const seen = new Set<string>();
  const add = (c: (typeof r.competencies)[number]) => {
    if (seen.has(c.competencyId) || chosen.length >= MAX_PRIORITIES) return;
    seen.add(c.competencyId);
    chosen.push(c);
  };
  r.competencies.filter((c) => c.covered && c.knockoutTriggered).forEach(add);
  r.competencies
    .filter((c) => c.covered && c.gap != null && c.gap < 0)
    .sort((a, b) => (a.gap as number) - (b.gap as number) || PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority])
    .forEach(add);
  r.competencies.filter((c) => c.selfFlag === "blind_spot").forEach(add);

  if (chosen.length === 0) {
    return { ok: false, error: "insufficient", message: "No below-bar competencies - nothing to develop." };
  }

  // Development tips per chosen competency (catalogue behavioral_indicators).
  const ids = chosen.map((c) => c.competencyId);
  const tipsByComp = new Map<string, string[]>();
  const { data: tips } = await sb
    .from("behavioral_indicators")
    .select("competency_id, description, sort_order")
    .in("competency_id", ids)
    .ilike("description", "[DEV TIP]%")
    .order("sort_order");
  for (const t of tips ?? []) {
    const cid = t.competency_id as string;
    const text = String(t.description).replace(/^\[DEV TIP\]\s*/, "").trim();
    const arr = tipsByComp.get(cid) ?? [];
    if (arr.length < 3) arr.push(text);
    tipsByComp.set(cid, arr);
  }

  const whyFor = (c: (typeof chosen)[number]): string => {
    const gapTxt = c.gap == null ? "" : `${c.gap.toFixed(1)} below the role bar`;
    if (c.knockoutTriggered) return `High-priority must-have - ${gapTxt}.`;
    if (c.selfFlag === "blind_spot")
      return `Blind spot - others rate ${c.othersMean?.toFixed(1)} vs self ${c.selfMean?.toFixed(1)} (target ${c.target.toFixed(0)}).`;
    return `${gapTxt}.`;
  };

  const topPriorities = chosen.map((c) => ({
    competency_id: c.competencyId,
    behaviors: tipsByComp.get(c.competencyId) ?? [],
    why: whyFor(c),
  }));
  const actionPlan = chosen.map((c) => ({
    action: `Strengthen ${c.name}`,
    owner: "",
    deadline: "",
    support: "",
  }));
  const reviewDate = new Date();
  reviewDate.setDate(reviewDate.getDate() + 90);

  // Don't clobber a coach-edited plan: only write when none exists or it's still a draft.
  const { data: existing } = await sb
    .from("reflect_idps")
    .select("id, status")
    .eq("participant_id", participantId)
    .maybeSingle();
  if (existing && existing.status !== "draft") {
    return { ok: true, participantId, priorities: chosen.length, reused: true };
  }

  const { error } = await sb.from("reflect_idps").upsert(
    {
      participant_id: participantId,
      top_priorities: topPriorities,
      action_plan: actionPlan,
      success_measures:
        "Re-rate the priority competencies at the next 360; target each at or above the role bar.",
      target_review_date: reviewDate.toISOString().slice(0, 10),
      status: "draft",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "participant_id" },
  );
  if (error) return { ok: false, error: "save_failed", message: error.message };

  return { ok: true, participantId, priorities: chosen.length, reused: false };
}
