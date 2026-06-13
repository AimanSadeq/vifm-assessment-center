import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { ObservationForm } from "./_components/observation-form";
import { BackLink } from "@/components/shared/back-link";

type Props = {
  params: { assignmentId: string };
};

export default async function ObservationPage({ params }: Props) {
  const supabase = await createClient();
  const { assignmentId } = params;

  // Fetch the assignment with related data
  const { data: assignment, error: assignError } = await supabase
    .from("assessor_assignments")
    .select("*, candidates(id, full_name), exercises(id, name, exercise_type, duration_minutes, prep_minutes, meeting_minutes, scenario_context, assessor_notes), profiles(id, full_name)")
    .eq("id", assignmentId)
    .single();

  if (assignError || !assignment) return notFound();

  // Get competencies mapped to this exercise in this engagement
  const { data: matrixEntries } = await supabase
    .from("exercise_competency_matrix")
    .select("competency_id, competencies(id, name, description, tags, qa_questions)")
    .eq("engagement_id", assignment.engagement_id)
    .eq("exercise_id", assignment.exercise_id);

  const competencies = (matrixEntries ?? [])
    .map((m) => m.competencies)
    .filter(Boolean) as unknown as { id: string; name: string; description: string | null; tags: string[] | null; qa_questions: string[] | null }[];

  // Fetch behavioral indicators for these competencies
  const compIds = competencies.map((c) => c.id);
  const { data: indicators } = await supabase
    .from("behavioral_indicators")
    .select("id, competency_id, indicator_type, description, sort_order")
    .in("competency_id", compIds.length > 0 ? compIds : ["none"])
    .order("sort_order");

  // Fetch existing observations for this assignment
  const { data: observations } = await supabase
    .from("observations")
    .select("*")
    .eq("assessor_assignment_id", assignmentId)
    .order("observed_at", { ascending: false });

  // Fetch existing ratings for this assignment
  const { data: ratings } = await supabase
    .from("ratings")
    .select("*")
    .eq("assessor_assignment_id", assignmentId);

  const candidate = assignment.candidates as unknown as { id: string; full_name: string };
  const exercise = assignment.exercises as unknown as {
    id: string; name: string; exercise_type: string; duration_minutes: number | null;
    prep_minutes: number | null; meeting_minutes: number | null;
    scenario_context: string | null; assessor_notes: string | null;
  };

  return (
    <div>
      <BackLink href="/assessor" label="Back" history />
      <ObservationForm
        assignmentId={assignmentId}
        engagementId={assignment.engagement_id}
        candidateName={candidate.full_name}
        exerciseName={exercise.name}
        exerciseType={exercise.exercise_type}
        durationMinutes={exercise.duration_minutes}
        prepMinutes={exercise.prep_minutes}
        meetingMinutes={exercise.meeting_minutes}
        scenarioContext={exercise.scenario_context}
        assessorNotes={exercise.assessor_notes}
        competencies={competencies}
        behavioralIndicators={indicators ?? []}
        existingObservations={observations ?? []}
        existingRatings={ratings ?? []}
      />
    </div>
  );
}
