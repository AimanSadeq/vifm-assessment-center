"use server";

import { createClient, createServiceClient } from "@/lib/supabase/server";
import { requireRole, isAuthorizationError } from "@/lib/ara/auth-guards";
import { EXERCISE_CHECK_MAP } from "@/lib/ac/exercise-quality";
import { draftExerciseExamples } from "@/lib/ai/scale-anchor-drafter";

export async function updateExerciseAction(exerciseId: string, data: Record<string, unknown>) {
  const supabase = await createClient();
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
  const supabase = await createClient();

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

/**
 * The eight checks BPS 4.36 requires of an exercise, recorded one at a time.
 *
 * A pass with no note is an assertion rather than a check, so the note is
 * required for a pass - the point of the exercise is to have looked, and what
 * you looked at is the evidence that you did.
 */
export async function saveExerciseCheckAction(values: {
  exerciseId: string;
  checkKey: string;
  status: "pass" | "concern" | "not_applicable";
  note?: string;
}) {
  let uid: string | null = null;
  try {
    const caller = await requireRole(["admin"]);
    uid = caller.isDev ? null : caller.uid;
  } catch (e) {
    if (isAuthorizationError(e)) return { error: e.message };
    throw e;
  }
  if (!EXERCISE_CHECK_MAP[values.checkKey]) return { error: "That is not one of the checks." };

  const note = (values.note ?? "").trim();
  if (values.status !== "not_applicable" && note.length < 10) {
    return {
      error:
        "Say what you looked at. A pass with nothing behind it is an assertion, not a check, and this is the "
        + "record that the check was made.",
    };
  }

  const sb = createServiceClient();
  let name: string | null = null;
  if (uid) {
    const { data: who } = await sb.from("profiles").select("full_name, email").eq("id", uid).maybeSingle();
    name = (who?.full_name as string | null) ?? (who?.email as string | null) ?? null;
  }

  const { error } = await sb.from("ac_exercise_checks").upsert(
    {
      exercise_id: values.exerciseId,
      check_key: values.checkKey,
      status: values.status,
      note: note || null,
      checked_by: uid,
      checked_by_name: name,
      checked_at: new Date().toISOString(),
    },
    { onConflict: "exercise_id,check_key" }
  );
  if (error) return { error: error.message };
  return { ok: true };
}

/**
 * Trialling a new exercise before it is used on anyone (BPS 4.37).
 *
 * Who it was tried on is required, because 4.37 is specific: people
 * representative of the intended participants, who will not themselves be
 * participants. "We tried it on the team" fails both halves of that.
 */
export async function recordExerciseTrialAction(values: {
  exerciseId: string;
  trialledOn: string;
  participantCount?: number | null;
  representativeNote?: string;
  findings?: string;
  changesMade?: string;
  wasPilot?: boolean;
}) {
  let uid: string | null = null;
  try {
    const caller = await requireRole(["admin"]);
    uid = caller.isDev ? null : caller.uid;
  } catch (e) {
    if (isAuthorizationError(e)) return { error: e.message };
    throw e;
  }
  if (!values.trialledOn) return { error: "When was it trialled?" };
  const who = (values.representativeNote ?? "").trim();
  if (who.length < 10) {
    return {
      error:
        "Record who it was tried on. The standard asks for people representative of the intended participants "
        + "who will not themselves be participants, and that is the part worth being able to show.",
    };
  }

  const sb = createServiceClient();
  let name: string | null = null;
  if (uid) {
    const { data: p } = await sb.from("profiles").select("full_name, email").eq("id", uid).maybeSingle();
    name = (p?.full_name as string | null) ?? (p?.email as string | null) ?? null;
  }

  const { error } = await sb.from("ac_exercise_trials").insert({
    exercise_id: values.exerciseId,
    trialled_on: values.trialledOn,
    participant_count: values.participantCount ?? null,
    representative_note: who,
    findings: (values.findings ?? "").trim() || null,
    changes_made: (values.changesMade ?? "").trim() || null,
    was_pilot: values.wasPilot ?? false,
    recorded_by: uid,
    recorded_by_name: name,
  });
  if (error) return { error: error.message };
  return { ok: true };
}

// ── B19 (BPS 4.24): exercise-specific indicator examples ──────────
// What the evidence of a competency can look like IN this exercise, shown to
// assessors on the observation screen. AI drafts land as 'pending'; admins
// approve, reject, add or delete. All writes admin-only.


const EXAMPLE_UUID = /^[0-9a-f-]{36}$/i;

async function exampleReviewer(uid: string): Promise<string> {
  const sb = createServiceClient();
  const { data } = await sb.from("profiles").select("full_name, email").eq("id", uid).maybeSingle<{ full_name: string | null; email: string | null }>();
  return data?.full_name?.trim() || data?.email || "VIFM admin";
}

export async function draftExerciseExamplesAction(input: { exerciseId: string; competencyId: string }) {
  try {
    await requireRole(["admin"]);
  } catch (e) {
    if (isAuthorizationError(e)) return { error: "Only an admin can draft examples." };
    throw e;
  }
  if (!EXAMPLE_UUID.test(input.exerciseId) || !EXAMPLE_UUID.test(input.competencyId)) return { error: "Unknown exercise or competency." };
  const sb = createServiceClient();
  const [{ data: ex }, { data: comp }, { data: inds }] = await Promise.all([
    sb.from("exercises").select("name, exercise_type, scenario_context, participant_brief").eq("id", input.exerciseId).maybeSingle(),
    sb.from("competencies").select("name, description").eq("id", input.competencyId).is("retired_at", null).maybeSingle(),
    sb.from("behavioral_indicators").select("indicator_type, description").neq("sme_status", "rejected").eq("competency_id", input.competencyId).eq("indicator_type", "positive"),
  ]);
  if (!ex || !comp) return { error: "Unknown exercise or competency." };
  const drafts = await draftExerciseExamples({
    exerciseName: ex.name as string,
    exerciseType: ex.exercise_type as string,
    scenario: ((ex.scenario_context as string | null) || (ex.participant_brief as string | null)) ?? null,
    competencyName: comp.name as string,
    definition: (comp.description as string | null) ?? null,
    positives: (inds ?? []).map((i) => i.description as string).filter((d) => !d.startsWith("[DEV TIP]")),
  });
  if (!drafts) return { error: "No AI draft came back. Check the AI key, or add examples by hand." };
  // Replace only the PENDING drafts for this pair; approved examples stay.
  await sb.from("exercise_indicator_examples").delete().eq("exercise_id", input.exerciseId).eq("competency_id", input.competencyId).eq("sme_status", "pending").eq("source", "ai_draft");
  const { error } = await sb.from("exercise_indicator_examples").insert(
    drafts.map((d, i) => ({ exercise_id: input.exerciseId, competency_id: input.competencyId, polarity: d.polarity, example_en: d.example_en, example_ar: d.example_ar, sort_order: i + 1, source: "ai_draft", sme_status: "pending" })),
  );
  if (error) return { error: error.message };
  return { success: true, count: drafts.length };
}

export async function addExerciseExampleAction(input: { exerciseId: string; competencyId: string; polarity: "positive" | "negative"; exampleEn: string; exampleAr?: string }) {
  try {
    await requireRole(["admin"]);
  } catch (e) {
    if (isAuthorizationError(e)) return { error: "Only an admin can add examples." };
    throw e;
  }
  const en = input.exampleEn?.trim() ?? "";
  if (!EXAMPLE_UUID.test(input.exerciseId) || !EXAMPLE_UUID.test(input.competencyId)) return { error: "Unknown exercise or competency." };
  if (en.length < 8 || en.length > 400) return { error: "An example needs 8-400 characters." };
  if (input.polarity !== "positive" && input.polarity !== "negative") return { error: "Choose positive or negative." };
  const sb = createServiceClient();
  const { error } = await sb.from("exercise_indicator_examples").insert({
    exercise_id: input.exerciseId, competency_id: input.competencyId, polarity: input.polarity,
    example_en: en, example_ar: input.exampleAr?.trim() || null, sort_order: 99, source: "manual", sme_status: "pending",
  });
  if (error) return { error: error.message };
  return { success: true };
}

export async function reviewExerciseExampleAction(input: { id: string; status: "approved" | "rejected" | "delete" }) {
  let caller;
  try {
    caller = await requireRole(["admin"]);
  } catch (e) {
    if (isAuthorizationError(e)) return { error: "Only an admin can review examples." };
    throw e;
  }
  if (!EXAMPLE_UUID.test(input.id)) return { error: "Unknown example." };
  const sb = createServiceClient();
  if (input.status === "delete") {
    const { error } = await sb.from("exercise_indicator_examples").delete().eq("id", input.id);
    return error ? { error: error.message } : { success: true };
  }
  const { error } = await sb
    .from("exercise_indicator_examples")
    .update({ sme_status: input.status, sme_reviewer_name: await exampleReviewer(caller.uid), sme_reviewed_at: new Date().toISOString() })
    .eq("id", input.id);
  return error ? { error: error.message } : { success: true };
}
