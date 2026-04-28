"use server";

import { createClient, createServiceClient } from "@/lib/supabase/server";
import {
  addCandidateSchema,
  type AddCandidateValues,
  createAssignmentSchema,
  type CreateAssignmentValues,
  setCandidateRoleProfileSchema,
  type SetCandidateRoleProfileValues,
} from "@/lib/validations/assessor";
import { publishNotification, publishToAllAdmins } from "@/lib/notifications/publish";

export async function addCandidateAction(values: AddCandidateValues & {
  department?: string;
  gender?: string;
  ageRange?: string;
  seniorityLevel?: string;
}) {
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
      department: values.department || null,
      gender: values.gender || null,
      age_range: values.ageRange || null,
      seniority_level: values.seniorityLevel || null,
      role_profile_id: parsed.data.roleProfileId ?? null,
      status: "invited",
    })
    .select()
    .single();

  if (error) return { error: error.message };
  return { data };
}

export async function setCandidateRoleProfileAction(values: SetCandidateRoleProfileValues) {
  const parsed = setCandidateRoleProfileSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const supabase = await createClient();
  const { error } = await supabase
    .from("candidates")
    .update({ role_profile_id: parsed.data.roleProfileId })
    .eq("id", parsed.data.candidateId);

  if (error) return { error: error.message };

  // H3: notify the candidate when their role profile gets bound. Use the
  // service client through publishNotification so the admin's session can
  // write to a row owned by another profile. Failures are logged but never
  // thrown — never block the assignment save on a notification glitch.
  if (parsed.data.roleProfileId) {
    const service = createServiceClient();
    const { data: cand } = await service
      .from("candidates")
      .select("profile_id, full_name")
      .eq("id", parsed.data.candidateId)
      .single();
    const { data: rp } = await service
      .from("role_profiles")
      .select("name_en")
      .eq("id", parsed.data.roleProfileId)
      .single();
    if (cand?.profile_id) {
      await publishNotification({
        profileId: cand.profile_id as string,
        kind: "role_profile_assigned",
        title: "A role profile was assigned to your assessment",
        body: rp?.name_en
          ? `Your skills will be measured against the "${rp.name_en}" profile.`
          : null,
        link: `/candidate/skills/${parsed.data.candidateId}`,
        data: { roleProfileId: parsed.data.roleProfileId },
      });
    }
  }

  return { success: true };
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
