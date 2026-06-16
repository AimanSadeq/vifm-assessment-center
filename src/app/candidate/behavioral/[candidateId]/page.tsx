export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { getOrCreateBehavioralSession, loadBehavioralResponses } from "@/lib/scoring/behavioral";
import { BEHAVIORAL_COMPETENCIES } from "@/lib/scoring/behavioral-items";
import { BehavioralRunner } from "./_components/behavioral-runner";

type Props = { params: { candidateId: string } };

export default async function BehavioralAssessmentPage({ params }: Props) {
  const sb = createServiceClient();
  const { data: cand } = await sb
    .from("candidates")
    .select("id, full_name, engagement_id")
    .eq("id", params.candidateId)
    .maybeSingle();
  if (!cand) return notFound();

  const session = await getOrCreateBehavioralSession(cand.engagement_id as string, cand.id as string);
  const saved = await loadBehavioralResponses(session.id);

  // Scope Persona to the engagement's agreed competencies (engagement_competencies).
  // This is the set the consultant agreed with the client; if none were chosen,
  // fall back to the full 38-competency bank.
  const { data: engComps } = await sb
    .from("engagement_competencies")
    .select("competency_id")
    .eq("engagement_id", cand.engagement_id as string);
  const scopedIds = new Set((engComps ?? []).map((r) => r.competency_id as string));
  const competencies =
    scopedIds.size > 0
      ? BEHAVIORAL_COMPETENCIES.filter((c) => scopedIds.has(c.acCompetencyId))
      : BEHAVIORAL_COMPETENCIES;

  return (
    <BehavioralRunner
      candidateId={cand.id as string}
      engagementId={cand.engagement_id as string}
      sessionId={session.id}
      initialStatus={session.status}
      competencies={competencies}
      saved={saved}
    />
  );
}
