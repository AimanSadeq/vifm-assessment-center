export const dynamic = "force-dynamic";
import { createServiceClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { WashupForm } from "./_components/washup-form";

type Props = {
  params: { engagementId: string; candidateId: string };
};

export default async function WashupCandidatePage({ params }: Props) {
  const supabase = createServiceClient();
  const { engagementId, candidateId } = params;

  const [engResult, candResult, compResult, worksheetsResult, consensusResult, oarResult] =
    await Promise.all([
      supabase.from("engagements").select("id, name").eq("id", engagementId).single(),
      supabase.from("candidates").select("id, full_name").eq("id", candidateId).single(),
      supabase
        .from("engagement_competencies")
        .select("competency_id, weight, competencies(id, name, description)")
        .eq("engagement_id", engagementId),
      // All assessors' integration worksheets for this candidate
      supabase
        .from("integration_worksheets")
        .select("*, profiles(full_name)")
        .eq("engagement_id", engagementId)
        .eq("candidate_id", candidateId),
      // Existing consensus ratings
      supabase
        .from("consensus_ratings")
        .select("*")
        .eq("engagement_id", engagementId)
        .eq("candidate_id", candidateId),
      // Existing OAR
      supabase
        .from("overall_assessment_ratings")
        .select("*")
        .eq("engagement_id", engagementId)
        .eq("candidate_id", candidateId)
        .maybeSingle(),
    ]);

  if (engResult.error || !engResult.data || candResult.error || !candResult.data) {
    return notFound();
  }

  const competencies = (compResult.data ?? []).map((c) => ({
    ...(c.competencies as unknown as { id: string; name: string; description: string | null }),
    weight: c.weight,
  }));

  return (
    <div>
      <WashupForm
        engagementId={engagementId}
        engagementName={engResult.data.name}
        candidateId={candidateId}
        candidateName={candResult.data.full_name}
        competencies={competencies}
        worksheets={worksheetsResult.data ?? []}
        existingConsensus={consensusResult.data ?? []}
        existingOar={oarResult.data}
      />
    </div>
  );
}
