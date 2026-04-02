import { createServiceClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { EngagementDetail } from "./_components/engagement-detail";

type Props = {
  params: { id: string };
};

export default async function EngagementDetailPage({ params }: Props) {
  const supabase = createServiceClient();
  const { id } = params;

  const [engResult, candsResult, exercisesResult, assignmentsResult, assessorsResult, matrixResult] =
    await Promise.all([
      supabase
        .from("engagements")
        .select("*, organizations(name)")
        .eq("id", id)
        .single(),
      supabase
        .from("candidates")
        .select("*")
        .eq("engagement_id", id)
        .order("full_name"),
      supabase
        .from("engagement_exercises")
        .select("exercise_id, exercises(id, name, exercise_type, duration_minutes)")
        .eq("engagement_id", id),
      supabase
        .from("assessor_assignments")
        .select("*, profiles(id, full_name, email), candidates(id, full_name), exercises(id, name)")
        .eq("engagement_id", id),
      supabase
        .from("profiles")
        .select("id, full_name, email, role")
        .in("role", ["lead_assessor", "associate_assessor"]),
      supabase
        .from("exercise_competency_matrix")
        .select("exercise_id, competency_id, competencies(name)")
        .eq("engagement_id", id),
    ]);

  if (engResult.error || !engResult.data) return notFound();

  const engagement = engResult.data;
  const candidates = candsResult.data ?? [];
  const engExercises = exercisesResult.data ?? [];
  const assignments = assignmentsResult.data ?? [];
  const assessors = assessorsResult.data ?? [];
  const matrix = matrixResult.data ?? [];

  // Extract exercises from junction table
  const exercises = engExercises
    .map((ee: Record<string, unknown>) => ee.exercises)
    .filter(Boolean) as Record<string, unknown>[];

  return (
    <div>
      <EngagementDetail
        engagement={engagement}
        candidates={candidates}
        exercises={exercises}
        assignments={assignments}
        assessors={assessors}
        matrix={matrix}
      />
    </div>
  );
}
