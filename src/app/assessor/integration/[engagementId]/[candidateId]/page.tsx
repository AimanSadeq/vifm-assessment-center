export const dynamic = "force-dynamic";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { IntegrationForm } from "./_components/integration-form";
import { BackLink } from "@/components/shared/back-link";

type Props = {
  params: { engagementId: string; candidateId: string };
};

export default async function IntegrationWorksheetPage({ params }: Props) {
  const supabase = await createClient();
  const { engagementId, candidateId } = params;

  const [engResult, candResult, compResult, obsResult, ratingsResult, worksheetResult, assessorsResult] =
    await Promise.all([
      supabase.from("engagements").select("id, name").eq("id", engagementId).single(),
      supabase.from("candidates").select("id, full_name").eq("id", candidateId).single(),
      supabase
        .from("engagement_competencies")
        .select("competency_id, competencies(id, name, description)")
        .eq("engagement_id", engagementId),
      supabase
        .from("observations")
        .select("*, assessor_assignments!inner(engagement_id, candidate_id, exercise_id, exercises(name))")
        .eq("assessor_assignments.engagement_id", engagementId)
        .eq("assessor_assignments.candidate_id", candidateId),
      supabase
        .from("ratings")
        .select("*, assessor_assignments!inner(engagement_id, candidate_id, exercise_id, exercises(name))")
        .eq("assessor_assignments.engagement_id", engagementId)
        .eq("assessor_assignments.candidate_id", candidateId),
      supabase
        .from("integration_worksheets")
        .select("*")
        .eq("engagement_id", engagementId)
        .eq("candidate_id", candidateId),
      // Get all assessors for this engagement (for the assessor_id field - in dev we pick first)
      supabase
        .from("assessor_assignments")
        .select("assessor_id")
        .eq("engagement_id", engagementId)
        .limit(1),
    ]);

  if (engResult.error || !engResult.data || candResult.error || !candResult.data) {
    return notFound();
  }

  const competencies = (compResult.data ?? [])
    .map((c) => c.competencies)
    .filter(Boolean) as unknown as { id: string; name: string; description: string | null }[];

  // Get the logged-in assessor's ID from the session
  const { data: { user } } = await supabase.auth.getUser();
  const assessorId = user?.id;
  if (!assessorId) {
    return notFound(); // Not authenticated
  }

  return (
    <div>
      <BackLink href="/assessor" label="Back" history />
      <IntegrationForm
        engagementId={engagementId}
        engagementName={engResult.data.name}
        candidateId={candidateId}
        candidateName={candResult.data.full_name}
        assessorId={assessorId}
        competencies={competencies}
        observations={obsResult.data ?? []}
        ratings={ratingsResult.data ?? []}
        existingWorksheets={worksheetResult.data ?? []}
      />
    </div>
  );
}
