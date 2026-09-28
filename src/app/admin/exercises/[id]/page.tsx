import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { ExerciseDetail } from "./_components/exercise-detail";
import { ExerciseQualityPanel } from "./_components/exercise-quality-panel";
import { ExerciseExamplesPanel, type ExerciseExampleRow } from "./_components/exercise-examples-panel";
import { BackLink } from "@/components/shared/back-link";
import { reviewExerciseQuality } from "@/lib/ac/exercise-quality";

type Props = { params: { id: string } };

export default async function ExerciseDetailPage({ params }: Props) {
  const supabase = await createClient();

  const [exResult, promptsResult, checksResult, trialsResult, usageResult] = await Promise.all([
    supabase.from("exercises").select("*").eq("id", params.id).single(),
    supabase.from("role_player_prompts").select("*").eq("exercise_id", params.id),
    // The eight checks of BPS 4.36 and any trials (4.37). Tolerant of 00222.
    supabase
      .from("ac_exercise_checks")
      .select("check_key, status, note, checked_by_name, checked_at")
      .eq("exercise_id", params.id)
      .then((r) => (r.data ?? []) as Record<string, unknown>[], () => [] as Record<string, unknown>[]),
    supabase
      .from("ac_exercise_trials")
      .select("id, trialled_on, participant_count, representative_note, findings, changes_made, was_pilot")
      .eq("exercise_id", params.id)
      .order("trialled_on", { ascending: false })
      .then((r) => (r.data ?? []) as Record<string, unknown>[], () => [] as Record<string, unknown>[]),
    // "New" in 4.37 means not yet used at a centre that has run. An engagement
    // still in draft does not count - trialling is what happens BEFORE that.
    supabase
      .from("engagement_exercises")
      .select("engagement_id, engagements(status)")
      .eq("exercise_id", params.id)
      .then((r) => (r.data ?? []) as Record<string, unknown>[], () => [] as Record<string, unknown>[]),
  ]);

  if (exResult.error || !exResult.data) return notFound();

  // B19 (BPS 4.24): examples per competency for this exercise, the active
  // framework to pick from, and which competencies it has observed before.
  const [activeComps, exampleRows, observedRows] = await Promise.all([
    supabase.from("competencies").select("id, name, sort_order").is("retired_at", null).order("sort_order")
      .then((r) => (r.data ?? []) as { id: string; name: string }[], () => [] as { id: string; name: string }[]),
    supabase.from("exercise_indicator_examples").select("id, competency_id, polarity, example_en, sme_status, source, sort_order").eq("exercise_id", params.id).order("sort_order")
      .then((r) => (r.data ?? []) as ExerciseExampleRow[], () => [] as ExerciseExampleRow[]),
    supabase.from("exercise_competency_matrix").select("competency_id").eq("exercise_id", params.id)
      .then((r) => (r.data ?? []) as { competency_id: string }[], () => [] as { competency_id: string }[]),
  ]);
  const activeIds = new Set(activeComps.map((c) => c.id));
  const commonlyObserved = Array.from(new Set(observedRows.map((r) => r.competency_id))).filter((id) => activeIds.has(id));

  const usedLive = usageResult.some((u) => {
    const e = u.engagements as unknown as { status?: string } | null;
    return e?.status === "active" || e?.status === "completed" || e?.status === "archived";
  });

  const qualityReview = reviewExerciseQuality({
    exerciseName: exResult.data.name as string,
    checks: checksResult.map((c) => ({
      checkKey: c.check_key as string,
      status: c.status as "pass" | "concern" | "not_applicable",
      note: (c.note as string | null) ?? null,
    })),
    trials: trialsResult.map((t) => ({
      trialledOn: t.trialled_on as string,
      participantCount: (t.participant_count as number | null) ?? null,
      representativeNote: (t.representative_note as string | null) ?? null,
      wasPilot: Boolean(t.was_pilot),
    })),
    usedLive,
  });

  return (
    <>
      <BackLink href="/admin/exercises" label="Back" history />
      <ExerciseDetail
        exercise={exResult.data}
        rolePlayerPrompts={promptsResult.data ?? []}
      />
      <ExerciseQualityPanel
        exerciseId={params.id}
        checks={checksResult}
        trials={trialsResult}
        review={qualityReview}
      />
      <ExerciseExamplesPanel
        exerciseId={params.id}
        competencies={activeComps}
        examples={exampleRows}
        commonlyObserved={commonlyObserved}
      />
    </>
  );
}
