import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { ExerciseDetail } from "./_components/exercise-detail";
import { BackLink } from "@/components/shared/back-link";

type Props = { params: { id: string } };

export default async function ExerciseDetailPage({ params }: Props) {
  const supabase = await createClient();

  const [exResult, promptsResult] = await Promise.all([
    supabase.from("exercises").select("*").eq("id", params.id).single(),
    supabase.from("role_player_prompts").select("*").eq("exercise_id", params.id),
  ]);

  if (exResult.error || !exResult.data) return notFound();

  return (
    <>
      <BackLink href="/admin/exercises" label="Back" history />
      <ExerciseDetail
        exercise={exResult.data}
        rolePlayerPrompts={promptsResult.data ?? []}
      />
    </>
  );
}
