export const dynamic = "force-dynamic";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { WashupForm } from "./_components/washup-form";
import { BackLink } from "@/components/shared/back-link";

type Props = {
  params: { engagementId: string; candidateId: string };
};

export default async function WashupCandidatePage({ params }: Props) {
  const supabase = await createClient();
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

  // Guard: wash-up consolidates the assessors' integration worksheets into
  // consensus ratings and an OAR. If competencies exist but NO worksheet has
  // been submitted, there is nothing to consolidate - show a clear "no
  // observations yet" state instead of a blank consensus grid that would invite
  // a baseless overall rating.
  if (competencies.length > 0 && (worksheetsResult.data ?? []).length === 0) {
    return (
      <div>
        <BackLink href="/assessor" label="Back" history />
        <div className="mx-auto mt-6 max-w-xl rounded-lg border border-amber-300 bg-amber-50 p-6">
          <h2 className="text-base font-semibold text-amber-900">No observations recorded yet</h2>
          <p className="mt-2 text-sm leading-relaxed text-amber-800">
            No assessor integration worksheets have been submitted for {candResult.data.full_name} yet.
            Wash-up consolidates those worksheets into the consensus ratings and the overall rating, so
            please wait until at least one assessor has completed their observations and integration
            worksheet before running the wash-up.
          </p>
          <Link
            href={`/assessor/assignments/${engagementId}`}
            className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline"
          >
            Go to assessor assignments
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <BackLink href="/assessor" label="Back" history />
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
