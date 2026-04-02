"use server";

import { createServiceClient } from "@/lib/supabase/server";

export async function updateExerciseAction(exerciseId: string, data: Record<string, unknown>) {
  const supabase = createServiceClient();
  const { error } = await supabase
    .from("exercises")
    .update(data)
    .eq("id", exerciseId);
  if (error) return { error: error.message };
  return { success: true };
}

export async function saveRolePlayerPromptAction(data: {
  id?: string;
  exercise_id: string;
  prompt_text: string;
  trigger_behaviors?: string;
  character_name?: string;
  character_role?: string;
  character_attitude?: string;
  meeting_objectives?: string;
}) {
  const supabase = createServiceClient();

  if (data.id) {
    const { error } = await supabase
      .from("role_player_prompts")
      .update({
        prompt_text: data.prompt_text,
        trigger_behaviors: data.trigger_behaviors || null,
        character_name: data.character_name || null,
        character_role: data.character_role || null,
        character_attitude: data.character_attitude || null,
        meeting_objectives: data.meeting_objectives || null,
      })
      .eq("id", data.id);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase
      .from("role_player_prompts")
      .insert({
        exercise_id: data.exercise_id,
        prompt_text: data.prompt_text,
        trigger_behaviors: data.trigger_behaviors || null,
        character_name: data.character_name || null,
        character_role: data.character_role || null,
        character_attitude: data.character_attitude || null,
        meeting_objectives: data.meeting_objectives || null,
      });
    if (error) return { error: error.message };
  }
  return { success: true };
}
