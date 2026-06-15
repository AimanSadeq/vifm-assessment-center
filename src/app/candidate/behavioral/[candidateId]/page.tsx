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

  return (
    <BehavioralRunner
      candidateId={cand.id as string}
      engagementId={cand.engagement_id as string}
      sessionId={session.id}
      initialStatus={session.status}
      competencies={BEHAVIORAL_COMPETENCIES}
      saved={saved}
    />
  );
}
