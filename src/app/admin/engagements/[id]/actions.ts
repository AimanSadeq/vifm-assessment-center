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
import { requireRole, isAuthorizationError } from "@/lib/ara/auth-guards";

// Defence-in-depth: every admin-only mutating action runs through this.
// Under AUTH_ENABLED=false the helper returns a synthetic admin so dev
// still works; under auth=true it throws AuthorizationError if the
// caller isn't admin. RLS still backs us up at the DB layer regardless.
async function requireAdmin() {
  try {
    await requireRole(["admin"]);
    return null;
  } catch (e) {
    if (isAuthorizationError(e)) {
      return { error: e.message };
    }
    throw e;
  }
}

export async function addCandidateAction(values: AddCandidateValues & {
  department?: string;
  gender?: string;
  ageRange?: string;
  seniorityLevel?: string;
}) {
  const denied = await requireAdmin();
  if (denied) return denied;

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
  const denied = await requireAdmin();
  if (denied) return denied;

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

// G7 - re-engages a cohort against the same role profile after a prior
// engagement has completed. Pulls forward the design (competencies,
// exercises, matrix) and the people (candidates with their role-profile
// binding + demographics) so the admin doesn't rebuild from scratch.
//
// Deliberately NOT copied: assessor_assignments, consensus_ratings,
// observations, integration_worksheets, bars_ratings - the new run
// starts fresh and earns its own scores. The prior_candidate_id link
// on each new candidate row is what the delta UI uses to compare
// "OAR Δ vs prior".
export async function createReengagementAction(input: {
  priorEngagementId: string;
  carryCandidates: boolean;
}) {
  const denied = await requireAdmin();
  if (denied) return denied;

  // Service client because the admin's RLS-bounded client may not be able
  // to read every nested row across an org, and we're explicitly checked
  // for admin role above. Same pattern as bulk role-profile assign.
  const sb = createServiceClient();

  const { data: prior, error: priorErr } = await sb
    .from("engagements")
    .select("id, organization_id, name, target_role, status")
    .eq("id", input.priorEngagementId)
    .maybeSingle();
  if (priorErr || !prior) return { error: priorErr?.message ?? "Prior engagement not found" };

  if (!["completed", "archived"].includes(prior.status as string)) {
    return {
      error: "Re-engagement is only available once the prior engagement is completed or archived.",
    };
  }

  const { data: created, error: insertErr } = await sb
    .from("engagements")
    .insert({
      organization_id: prior.organization_id,
      name: `${prior.name} (Re-engagement)`,
      target_role: prior.target_role,
      status: "draft",
      prior_engagement_id: prior.id,
    })
    .select("id")
    .single();
  if (insertErr || !created) return { error: insertErr?.message ?? "Failed to create re-engagement" };

  const newId = created.id as string;

  const rollback = async () => {
    await sb.from("exercise_competency_matrix").delete().eq("engagement_id", newId);
    await sb.from("engagement_exercises").delete().eq("engagement_id", newId);
    await sb.from("engagement_competencies").delete().eq("engagement_id", newId);
    await sb.from("candidates").delete().eq("engagement_id", newId);
    await sb.from("engagements").delete().eq("id", newId);
  };

  const [{ data: comps }, { data: exercises }, { data: matrix }] = await Promise.all([
    sb
      .from("engagement_competencies")
      .select("competency_id, weight")
      .eq("engagement_id", prior.id),
    sb
      .from("engagement_exercises")
      .select("exercise_id")
      .eq("engagement_id", prior.id),
    sb
      .from("exercise_competency_matrix")
      .select("exercise_id, competency_id")
      .eq("engagement_id", prior.id),
  ]);

  if (comps && comps.length > 0) {
    const { error } = await sb
      .from("engagement_competencies")
      .insert(comps.map((c) => ({ engagement_id: newId, competency_id: c.competency_id, weight: c.weight })));
    if (error) {
      await rollback();
      return { error: `Competencies: ${error.message}` };
    }
  }
  if (exercises && exercises.length > 0) {
    const { error } = await sb
      .from("engagement_exercises")
      .insert(exercises.map((e) => ({ engagement_id: newId, exercise_id: e.exercise_id })));
    if (error) {
      await rollback();
      return { error: `Exercises: ${error.message}` };
    }
  }
  if (matrix && matrix.length > 0) {
    const { error } = await sb
      .from("exercise_competency_matrix")
      .insert(matrix.map((m) => ({
        engagement_id: newId,
        exercise_id: m.exercise_id,
        competency_id: m.competency_id,
      })));
    if (error) {
      await rollback();
      return { error: `Matrix: ${error.message}` };
    }
  }

  if (input.carryCandidates) {
    // Core columns only - the demographic columns from migration
    // 00008_stakeholder_feedback (department/gender/age_range/seniority_level)
    // are optional and may be absent on some environments. We try them
    // first and gracefully fall back to the always-present columns if
    // the schema rejects the SELECT.
    let priorCands: Array<{
      id: string; full_name: string; email: string; phone: string | null;
      profile_id: string | null; role_profile_id: string | null;
      department?: string | null; gender?: string | null;
      age_range?: string | null; seniority_level?: string | null;
    }> | null = null;
    {
      const richSelect = await sb
        .from("candidates")
        .select("id, full_name, email, phone, profile_id, role_profile_id, department, gender, age_range, seniority_level")
        .eq("engagement_id", prior.id);
      if (!richSelect.error) {
        priorCands = richSelect.data;
      } else {
        const coreSelect = await sb
          .from("candidates")
          .select("id, full_name, email, phone, profile_id, role_profile_id")
          .eq("engagement_id", prior.id);
        if (coreSelect.error) {
          await rollback();
          return { error: `Candidates fetch: ${coreSelect.error.message}` };
        }
        priorCands = coreSelect.data;
      }
    }
    if (priorCands && priorCands.length > 0) {
      const tryRow = (c: typeof priorCands[number], includeDemos: boolean) => ({
        engagement_id: newId,
        full_name: c.full_name,
        email: c.email,
        phone: c.phone,
        profile_id: c.profile_id,
        role_profile_id: c.role_profile_id,
        status: "invited",
        prior_candidate_id: c.id,
        ...(includeDemos
          ? {
              department: c.department ?? null,
              gender: c.gender ?? null,
              age_range: c.age_range ?? null,
              seniority_level: c.seniority_level ?? null,
            }
          : {}),
      });
      let insertErr: { message: string } | null = null;
      const richInsert = await sb.from("candidates").insert(priorCands.map((c) => tryRow(c, true)));
      if (richInsert.error) {
        const coreInsert = await sb.from("candidates").insert(priorCands.map((c) => tryRow(c, false)));
        insertErr = coreInsert.error;
      }
      if (insertErr) {
        await rollback();
        return { error: `Candidates: ${insertErr.message}` };
      }
    }
  }

  return { data: { id: newId } };
}
