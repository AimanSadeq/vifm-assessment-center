"use server";

import { createClient, createServiceClient } from "@/lib/supabase/server";
import {
  addCandidateSchema,
  type AddCandidateValues,
  createAssignmentSchema,
  type CreateAssignmentValues,
} from "@/lib/validations/assessor";

export async function addCandidateAction(values: AddCandidateValues) {
  const parsed = addCandidateSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("candidates")
    .insert({
      engagement_id: parsed.data.engagementId,
      full_name: parsed.data.fullName,
      email: parsed.data.email,
      phone: parsed.data.phone || null,
      status: "invited",
    })
    .select()
    .single();

  if (error) return { error: error.message };
  return { data };
}

export async function createAssignmentAction(values: CreateAssignmentValues) {
  const parsed = createAssignmentSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("assessor_assignments")
    .insert({
      engagement_id: parsed.data.engagementId,
      assessor_id: parsed.data.assessorId,
      candidate_id: parsed.data.candidateId,
      exercise_id: parsed.data.exerciseId,
    })
    .select()
    .single();

  if (error) return { error: error.message };
  return { data };
}

export async function addDemoAssessorAction(values: {
  fullName: string;
  email: string;
}) {
  const supabase = createServiceClient();

  // Create auth user first, then profile
  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
    email: values.email,
    email_confirm: true,
    user_metadata: { full_name: values.fullName },
  });

  if (authError) return { error: authError.message };

  const { data, error } = await supabase
    .from("profiles")
    .insert({
      id: authUser.user.id,
      role: "lead_assessor",
      full_name: values.fullName,
      email: values.email,
    })
    .select()
    .single();

  if (error) {
    // Clean up orphaned auth user if profile insert fails
    await supabase.auth.admin.deleteUser(authUser.user.id);
    return { error: error.message };
  }

  return { data };
}

export async function removeCandidateAction(candidateId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("candidates").delete().eq("id", candidateId);
  if (error) return { error: error.message };
  return { success: true };
}

export async function deleteAssignmentAction(assignmentId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("assessor_assignments").delete().eq("id", assignmentId);
  if (error) return { error: error.message };
  return { success: true };
}

export async function updateEngagementStatusAction(engagementId: string, status: string) {
  const supabase = await createClient();
  const validStatuses = ["draft", "active", "completed", "archived"];
  if (!validStatuses.includes(status)) return { error: "Invalid status" };

  const { error } = await supabase
    .from("engagements")
    .update({ status })
    .eq("id", engagementId);

  if (error) return { error: error.message };
  return { success: true };
}
