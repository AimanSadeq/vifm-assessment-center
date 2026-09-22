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
import { issueReadyNowForEngagement } from "@/lib/credentials/ac-ready-now";
import { reviewStaffing } from "@/lib/ac/staffing";
import { buildJoiningPack, type PackEngagement, type PackExercise } from "@/lib/ac/joining-pack";
import { CENTRE_ROLE_MAP } from "@/lib/ac/centre-roles";
import { reviewCentreRoles, competenceIsCurrent } from "@/lib/ac/centre-roles-review";
import { provisionCandidateLogin, generateCandidateSetupLink } from "@/lib/auth/provision-candidate";
import { sendEmail } from "@/lib/integrations/email";

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
  // thrown - never block the assignment save on a notification glitch.
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
  const denied = await requireAdmin();
  if (denied) return denied;
  const parsed = createAssignmentSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const supabase = await createClient();

  // An assessor who knows the participant must not assess them (BPS 5.36). The
  // conflict is declared once per pair and enforced here, so it cannot be
  // forgotten when the grid is filled in.
  const { data: conflict } = await createServiceClient()
    .from("ac_assessor_conflicts")
    .select("reason")
    .eq("engagement_id", parsed.data.engagementId)
    .eq("assessor_id", parsed.data.assessorId)
    .eq("candidate_id", parsed.data.candidateId)
    .maybeSingle();
  if (conflict) {
    return {
      error:
        "A conflict of interest is recorded for this assessor and participant"
        + (conflict.reason ? `: ${conflict.reason}.` : ".")
        + " Assign a different assessor.",
    };
  }

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
  const denied = await requireAdmin();
  if (denied) return denied;
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

/**
 * Provision a portal login for a candidate and email them a set-password link.
 * Idempotent: re-inviting reuses the existing auth user and just re-sends the
 * link. Creates the auth user + profiles(role=candidate) + sets profile_id on
 * the candidate's rows. The actual account creation runs under the admin's
 * action (service-role), mirroring addDemoAssessorAction.
 */
export async function inviteCandidateToPortalAction(candidateId: string) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const sb = createServiceClient();
  const { data: cand } = await sb
    .from("candidates")
    .select(
      "id, full_name, email, engagement_id, engagements(name, target_role, organization_id, start_date, end_date, organizations(name))",
    )
    .eq("id", candidateId)
    .maybeSingle<{
      id: string;
      full_name: string;
      email: string | null;
      engagement_id: string;
      engagements:
        | {
            name: string;
            target_role: string | null;
            organization_id: string | null;
            start_date: string | null;
            end_date: string | null;
            organizations: { name: string } | { name: string }[] | null;
          }
        | {
            name: string;
            target_role: string | null;
            organization_id: string | null;
            start_date: string | null;
            end_date: string | null;
            organizations: { name: string } | { name: string }[] | null;
          }[]
        | null;
    }>();

  if (!cand) return { error: "Candidate not found" };
  if (!cand.email) return { error: "This candidate has no email on file." };

  const eng = Array.isArray(cand.engagements) ? cand.engagements[0] : cand.engagements;
  const orgRel = eng?.organizations;
  const orgName =
    (Array.isArray(orgRel) ? orgRel[0]?.name : orgRel?.name) ?? "your organization";

  const prov = await provisionCandidateLogin({
    email: cand.email,
    fullName: cand.full_name,
    organizationId: eng?.organization_id ?? null,
  });
  if (!prov.ok) {
    return {
      error: prov.roleMismatch
        ? `This email already has a ${prov.existingRole} account, so a candidate login was not created.`
        : prov.error ?? "Could not provision the login.",
    };
  }

  const link = await generateCandidateSetupLink(cand.email);
  const portalUrl =
    link ?? `${process.env.NEXT_PUBLIC_SITE_URL || "https://caliber.viftraining.com"}/login`;

  const dates =
    eng?.start_date && eng?.end_date
      ? `${eng.start_date} to ${eng.end_date}`
      : "See the portal for your schedule.";

  const emailed = await sendEmail({
    to: cand.email,
    template: "candidate_invitation",
    data: {
      candidateName: cand.full_name,
      engagementName: eng?.name ?? "your assessment",
      organizationName: orgName,
      assessmentDates: dates,
      targetRole: eng?.target_role ?? "-",
      portalUrl,
    },
  });

  return {
    ok: true as const,
    emailed,
    portalUrl,
    created: prov.created ?? false,
    linkedCandidateCount: prov.linkedCandidateCount ?? 0,
  };
}

export async function removeCandidateAction(candidateId: string) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const supabase = await createClient();
  const { error } = await supabase.from("candidates").delete().eq("id", candidateId);
  if (error) return { error: error.message };
  return { success: true };
}

export async function deleteAssignmentAction(assignmentId: string) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const supabase = await createClient();
  const { error } = await supabase.from("assessor_assignments").delete().eq("id", assignmentId);
  if (error) return { error: error.message };
  return { success: true };
}

export async function updateEngagementStatusAction(engagementId: string, status: string) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const supabase = await createClient();
  const validStatuses = ["draft", "active", "completed", "archived"];
  if (!validStatuses.includes(status)) return { error: "Invalid status" };

  // Guard: an engagement may only go 'active' once it has observable content -
  // at least one competency AND one exercise. Without this, an engagement
  // created outside the validated wizard (or edited down to empty) could be
  // flipped active and then present candidates a blank schedule with nothing to
  // observe or score - producing meaningless (or null) OARs downstream.
  if (status === "active") {
    const [{ count: compCount }, { count: exCount }] = await Promise.all([
      supabase
        .from("engagement_competencies")
        .select("competency_id", { count: "exact", head: true })
        .eq("engagement_id", engagementId),
      supabase
        .from("engagement_exercises")
        .select("id", { count: "exact", head: true })
        .eq("engagement_id", engagementId),
    ]);
    if (!compCount || compCount === 0 || !exCount || exCount === 0) {
      return {
        error:
          "This engagement has no competencies or exercises yet. Add at least one competency and one exercise before activating it.",
      };
    }

    // Staffing floors: more than one assessor per participant, and at least one
    // assessor per three (BPS 5.18, 5.21). A centre may still be activated with
    // a recorded reason, but never by default and never silently.
    const svc = createServiceClient();
    const [{ data: cands }, { data: asgs }, { data: engRow }] = await Promise.all([
      svc.from("candidates").select("id, full_name").eq("engagement_id", engagementId),
      svc.from("assessor_assignments").select("assessor_id, candidate_id").eq("engagement_id", engagementId),
      svc.from("engagements").select("staffing_override_reason").eq("id", engagementId).maybeSingle(),
    ]);
    const staffing = reviewStaffing({
      candidateIds: (cands ?? []).map((c) => c.id as string),
      candidateNames: Object.fromEntries((cands ?? []).map((c) => [c.id as string, c.full_name as string])),
      assignments: (asgs ?? []).map((a) => ({
        assessorId: a.assessor_id as string,
        candidateId: a.candidate_id as string,
      })),
    });
    const overridden = Boolean((engRow as { staffing_override_reason?: string | null } | null)?.staffing_override_reason);
    if (!staffing.meetsFloors && !overridden) {
      return {
        error:
          "This centre does not meet the assessor staffing rules: "
          + staffing.blocking.join(" ")
          + " Fix the assignments, or record a reason for proceeding anyway.",
        staffing: staffing.blocking,
      };
    }

    // Centre roles and competence (BPS 5.16, 5.17, 5.22, 6.2). Only staff
    // deemed competent may be used, and that has to be confirmed BEFORE the
    // centre starts - which is exactly here. The same recorded-reason override
    // applies: a centre can proceed, but never silently.
    const [{ data: roleRows }, { data: engRoleCtx }, { data: exRows }] = await Promise.all([
      svc
        .from("ac_engagement_roles")
        .select("role_key, profile_id, is_external, profiles(full_name, email)")
        .eq("engagement_id", engagementId)
        .then((r) => r, () => ({ data: null })),
      svc.from("engagements").select("purpose").eq("id", engagementId).maybeSingle(),
      svc
        .from("engagement_exercises")
        .select("exercises(exercise_type)")
        .eq("engagement_id", engagementId),
    ]);

    // Only ask the competence table about the people actually assigned.
    const roleAssignments = (roleRows ?? []) as unknown as {
      role_key: string;
      profile_id: string;
      is_external: boolean | null;
      profiles: { full_name?: string | null; email?: string | null } | null;
    }[];
    let competence: { profile_id: string; role_key: string; status: string; expires_on: string | null }[] = [];
    if (roleAssignments.length > 0) {
      const { data: comp } = await svc
        .from("ac_role_competence")
        .select("profile_id, role_key, status, expires_on")
        .in("profile_id", Array.from(new Set(roleAssignments.map((r) => r.profile_id))))
        .then((r) => r, () => ({ data: null }));
      competence = (comp ?? []) as typeof competence;
    }

    const exerciseTypes = (exRows ?? [])
      .map((r) => (r.exercises as unknown as { exercise_type?: string } | null)?.exercise_type)
      .filter(Boolean) as string[];
    const roles = reviewCentreRoles({
      purpose: (engRoleCtx as { purpose?: string | null } | null)?.purpose ?? null,
      usesRolePlay: exerciseTypes.includes("role_play"),
      usesFactFind: exerciseTypes.includes("case_study"),
      assignments: roleAssignments,
      competence,
    });
    if (roles.blocking.length > 0 && !overridden) {
      return {
        error:
          "This centre is not staffed to the standard yet: "
          + roles.blocking.join(" ")
          + " Assign the missing roles and confirm competence, or record a reason for proceeding anyway.",
        staffing: roles.blocking,
      };
    }
  }

  const { error } = await supabase
    .from("engagements")
    .update({ status })
    .eq("id", engagementId);

  if (error) return { error: error.message };

  // Closing out the engagement is the deliberate "assessment is final" gate:
  // issue an ac_ready_now credential for every ready_now candidate. Idempotent
  // and best-effort - never block the status change on credential issuance.
  if (status === "completed") {
    await issueReadyNowForEngagement(engagementId);
  }

  return { success: true };
}

// Report release. The candidate report viewer (/candidate/report/[id]) and the
// client results view only show a report once a candidate_reports row exists
// with status='released' (RLS enforces this for candidates + clients). Nothing
// else writes that table, so without this action a finalised report is never
// visible in-app. Admin-gated; service-role write (mirrors other admin writes).
// candidate_reports has no unique(engagement,candidate), so we update-or-insert.
async function releaseReportsFor(engagementId: string, candidateIds: string[]): Promise<number> {
  const sb = createServiceClient();
  const nowIso = new Date().toISOString();
  let released = 0;

  // Releasing IS the accuracy check the standard requires before a
  // computer-generated report reaches anyone (BPS 8.10), so record who did it.
  // Without a name against it, "the report was checked" cannot be evidenced.
  let checkedBy: string | null = null;
  let checkedByName: string | null = null;
  try {
    const caller = await requireRole(["admin"]);
    checkedBy = caller.isDev ? null : caller.uid;
    if (checkedBy) {
      const { data: who } = await sb.from("profiles").select("full_name, email").eq("id", checkedBy).maybeSingle();
      checkedByName = (who?.full_name as string | null) ?? (who?.email as string | null) ?? null;
    }
  } catch {
    /* gated by the calling action; leave the check unattributed rather than fail the release */
  }
  const check = { checked_by: checkedBy, checked_by_name: checkedByName, checked_at: nowIso };
  for (const candidateId of candidateIds) {
    const { data: updated } = await sb
      .from("candidate_reports")
      .update({ status: "released", released_at: nowIso, ...check })
      .eq("engagement_id", engagementId)
      .eq("candidate_id", candidateId)
      .select("id");
    if (updated && updated.length > 0) {
      released += updated.length;
    } else {
      const { error: insErr } = await sb
        .from("candidate_reports")
        .insert({ engagement_id: engagementId, candidate_id: candidateId, status: "released", released_at: nowIso, ...check });
      if (!insErr) released += 1;
    }
    // Best-effort: notify the candidate their report is available.
    try {
      const { data: cand } = await sb.from("candidates").select("profile_id, full_name").eq("id", candidateId).maybeSingle();
      const pid = (cand as { profile_id?: string | null } | null)?.profile_id;
      if (pid) {
        await publishNotification({
          profileId: pid,
          kind: "report_released",
          title: "Your assessment report is ready",
          body: "Your assessment center report has been released and is now available to view.",
          link: `/candidate/report/${candidateId}`,
        });
      }
    } catch { /* notifications optional */ }
  }
  return released;
}

/** Release one candidate's report (admin-gated). */
export async function releaseReportAction(engagementId: string, candidateId: string) {
  const denied = await requireAdmin();
  if (denied) return denied;
  if (!engagementId || !candidateId) return { error: "Missing engagement or candidate id" };
  try {
    const released = await releaseReportsFor(engagementId, [candidateId]);
    return { ok: true as const, released };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not release the report" };
  }
}

/** Release all of an engagement's candidate reports (admin-gated). */
export async function releaseAllReportsAction(engagementId: string) {
  const denied = await requireAdmin();
  if (denied) return denied;
  if (!engagementId) return { error: "Missing engagement id" };
  try {
    const sb = createServiceClient();
    const { data: cands } = await sb.from("candidates").select("id").eq("engagement_id", engagementId);
    const ids = (cands ?? []).map((c) => c.id as string);
    if (ids.length === 0) return { ok: true as const, released: 0 };
    const released = await releaseReportsFor(engagementId, ids);
    return { ok: true as const, released };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not release reports" };
  }
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

// ─────────────────────────────────────────────────────────────
// Succession Readiness - combined-mode wiring (the "self lever").
// These are the setters the engine has always read but nothing wrote.
// ─────────────────────────────────────────────────────────────
const ASSESSMENT_MODES = ["standalone", "combined"] as const;
type AssessmentMode = (typeof ASSESSMENT_MODES)[number];

/** Flip an engagement between standalone (360 self) and combined (Persona self). */
/**
 * Confirm the competency weights for an engagement.
 *
 * A selection centre reaches its overall rating by weighted average, so the
 * weights decide the answer. The JD extractor only PROPOSES them; the BPS
 * standard requires weighting to come from the job analysis and be agreed with
 * the client (clause 7.3). Until someone confirms them here, the wash-up refuses
 * to calculate an overall rating.
 */
export async function confirmEngagementWeightsAction(engagementId: string) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const sb = createServiceClient();

  // Partial weighting is ambiguous, so refuse it rather than average around it.
  const { data: comps, error: readErr } = await sb
    .from("engagement_competencies")
    .select("competency_id, weight")
    .eq("engagement_id", engagementId);
  if (readErr) return { error: readErr.message };
  if (!comps || comps.length === 0) return { error: "This engagement has no competencies to weight." };
  const weighted = comps.filter((c) => c.weight != null && Number(c.weight) > 0);
  if (weighted.length > 0 && weighted.length < comps.length) {
    return {
      error: `${weighted.length} of ${comps.length} competencies carry a weight. Weight all of them, or none, before confirming.`,
    };
  }

  let confirmedBy: string | null = null;
  try {
    const caller = await requireRole(["admin"]);
    confirmedBy = caller.isDev ? null : caller.uid;
  } catch {
    confirmedBy = null;
  }

  const { error } = await sb
    .from("engagements")
    .update({ weights_confirmed_at: new Date().toISOString(), weights_confirmed_by: confirmedBy })
    .eq("id", engagementId);
  if (error) return { error: error.message };
  return { ok: true, equalWeighted: weighted.length === 0 };
}

/**
 * Record that an assessor must not assess a particular participant (BPS 5.36).
 * Existing assignments for the pair are removed, otherwise declaring a conflict
 * would leave the very assignment it forbids in place.
 */
export async function declareAssessorConflictAction(values: {
  engagementId: string;
  assessorId: string;
  candidateId: string;
  reason?: string;
}) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const sb = createServiceClient();

  let declaredBy: string | null = null;
  try {
    const caller = await requireRole(["admin"]);
    declaredBy = caller.isDev ? null : caller.uid;
  } catch {
    declaredBy = null;
  }

  const { error } = await sb.from("ac_assessor_conflicts").upsert(
    {
      engagement_id: values.engagementId,
      assessor_id: values.assessorId,
      candidate_id: values.candidateId,
      reason: values.reason || null,
      declared_by: declaredBy,
    },
    { onConflict: "engagement_id,assessor_id,candidate_id" }
  );
  if (error) return { error: error.message };

  const { count } = await sb
    .from("assessor_assignments")
    .delete({ count: "exact" })
    .eq("engagement_id", values.engagementId)
    .eq("assessor_id", values.assessorId)
    .eq("candidate_id", values.candidateId);
  return { ok: true, assignmentsRemoved: count ?? 0 };
}

export async function removeAssessorConflictAction(conflictId: string) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const sb = createServiceClient();
  const { error } = await sb.from("ac_assessor_conflicts").delete().eq("id", conflictId);
  if (error) return { error: error.message };
  return { ok: true };
}

/**
 * Activate a centre that does not meet the staffing floors, with the reason
 * recorded. The standard expects the floors to be met; where a client insists on
 * proceeding, the deviation belongs in the record rather than nowhere.
 */
export async function recordStaffingOverrideAction(engagementId: string, reason: string) {
  const denied = await requireAdmin();
  if (denied) return denied;
  if (!reason || reason.trim().length < 10) {
    return { error: "Give a reason of at least a few words. It is kept with the engagement record." };
  }
  const sb = createServiceClient();

  let by: string | null = null;
  try {
    const caller = await requireRole(["admin"]);
    by = caller.isDev ? null : caller.uid;
  } catch {
    by = null;
  }

  const { error } = await sb
    .from("engagements")
    .update({
      staffing_override_reason: reason.trim(),
      staffing_override_at: new Date().toISOString(),
      staffing_override_by: by,
    })
    .eq("id", engagementId);
  if (error) return { error: error.message };
  return { ok: true };
}

/**
 * The person a participant contacts about their assessment, and how a result may
 * be challenged. Both are printed on the report (BPS 5.43, 8.20, 5.49); without
 * them the report falls back to generic wording that names nobody.
 */
export async function setParticipantContactAction(values: {
  engagementId: string;
  contactName?: string;
  contactEmail?: string;
  appealsNote?: string;
}) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const email = (values.contactEmail ?? "").trim();
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { error: "That does not look like an email address." };
  }
  const sb = createServiceClient();
  const { error } = await sb
    .from("engagements")
    .update({
      participant_contact_name: (values.contactName ?? "").trim() || null,
      participant_contact_email: email || null,
      appeals_note: (values.appealsNote ?? "").trim() || null,
    })
    .eq("id", values.engagementId);
  if (error) return { error: error.message };
  return { ok: true };
}

/**
 * Record something that happened during delivery, and what was done about it
 * (BPS 6.7, 6.8, 6.10, 6.13). Entries cannot be edited: a correction is another
 * entry, so the record cannot be tidied up after the fact.
 */
export async function addDeliveryLogEntryAction(values: {
  engagementId: string;
  kind: "incident" | "deviation" | "staff" | "other";
  summary: string;
  actionTaken?: string;
  candidateId?: string | null;
  affectsAssessment?: boolean;
  occurredAt?: string;
}) {
  // Assessors are the people in the room, so they may log too, not just admins.
  let logged_by: string | null = null;
  let logged_by_name: string | null = null;
  try {
    const caller = await requireRole(["admin", "lead_assessor", "associate_assessor"]);
    logged_by = caller.isDev ? null : caller.uid;
  } catch (e) {
    if (isAuthorizationError(e)) return { error: e.message };
    throw e;
  }
  if (!values.summary || values.summary.trim().length < 5) {
    return { error: "Describe what happened in a few words." };
  }

  const sb = createServiceClient();
  if (logged_by) {
    const { data: who } = await sb.from("profiles").select("full_name, email").eq("id", logged_by).maybeSingle();
    logged_by_name = (who?.full_name as string | null) ?? (who?.email as string | null) ?? null;
  }

  const { error } = await sb.from("ac_delivery_log").insert({
    engagement_id: values.engagementId,
    candidate_id: values.candidateId || null,
    kind: values.kind,
    summary: values.summary.trim(),
    action_taken: (values.actionTaken ?? "").trim() || null,
    affects_assessment: values.affectsAssessment ?? false,
    occurred_at: values.occurredAt || new Date().toISOString(),
    logged_by,
    logged_by_name,
  });
  if (error) return { error: error.message };
  return { ok: true };
}

/**
 * What a result from a test, questionnaire, interview or 360 may do to a
 * competency rating (BPS 4.32). Recorded per centre and shown to assessors at
 * the wash-up, so the answer is the same for every participant.
 */
export async function setOtherMethodsRuleAction(values: {
  engagementId: string;
  rule: "context_only" | "documented_conversion";
  note?: string;
}) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const note = (values.note ?? "").trim();
  if (values.rule === "documented_conversion" && note.length < 15) {
    return { error: "Write the conversion rule itself. 'Converted by a stated rule' with no rule stated is not one." };
  }
  const sb = createServiceClient();
  const { error } = await sb
    .from("engagements")
    .update({ other_methods_rule: values.rule, other_methods_note: note || null })
    .eq("id", values.engagementId);
  if (error) return { error: error.message };
  return { ok: true };
}

export async function setAssessmentModeAction(engagementId: string, mode: AssessmentMode) {
  const denied = await requireAdmin();
  if (denied) return denied;
  if (!ASSESSMENT_MODES.includes(mode)) return { error: "Invalid assessment mode" };
  const sb = createServiceClient();
  const { error } = await sb.from("engagements").update({ assessment_mode: mode }).eq("id", engagementId);
  if (error) return { error: error.message };
  return { ok: true };
}

/**
 * Link an AC engagement to a Reflect 360 engagement (the "others" source) and
 * turn on combined mode. On link, best-effort wiring:
 *   1. bridge reflect_participants.candidate_id by email/name match within the
 *      Reflect engagement (so readiness finds each candidate's 360 reliably),
 *   2. map reflect_competencies.ac_competency_id by name (so 360 scores land on
 *      the role-profile competencies), and
 *   3. suppress the 360 self-rater on bridged participants (Persona is self).
 * Pass reflectEngagementId=null to unlink (mode is left as-is for the admin to flip).
 */
export async function linkReflectEngagementAction(
  engagementId: string,
  reflectEngagementId: string | null,
) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const sb = createServiceClient();

  const update: Record<string, unknown> = { reflect_engagement_id: reflectEngagementId };
  if (reflectEngagementId) update.assessment_mode = "combined";
  const { error } = await sb.from("engagements").update(update).eq("id", engagementId);
  if (error) return { error: error.message };
  if (!reflectEngagementId) return { ok: true, linked: 0, mapped: 0 };

  const norm = (v: unknown) => (v == null ? "" : String(v).trim().toLowerCase());

  // (1) bridge participants -> candidates by email, else exact name.
  const [{ data: cands }, { data: parts }] = await Promise.all([
    sb.from("candidates").select("id, full_name, email").eq("engagement_id", engagementId),
    sb.from("reflect_participants").select("id, full_name, email, candidate_id").eq("engagement_id", reflectEngagementId),
  ]);
  let linked = 0;
  const bridgedPartIds: string[] = [];
  for (const p of parts ?? []) {
    if (p.candidate_id) { bridgedPartIds.push(p.id as string); continue; }
    const pe = norm(p.email);
    const pn = norm(p.full_name);
    const match = (cands ?? []).find((c) => (pe && norm(c.email) === pe) || (pn && norm(c.full_name) === pn));
    if (match) {
      const r = await sb.from("reflect_participants").update({ candidate_id: match.id }).eq("id", p.id);
      if (!r.error) { linked++; bridgedPartIds.push(p.id as string); }
    }
  }

  // (3) suppress the 360 self-rater on bridged participants (best-effort; needs 00099).
  if (bridgedPartIds.length > 0) {
    await sb.from("reflect_participants").update({ suppress_self: true }).in("id", bridgedPartIds);
  }

  // (2) map reflect competencies -> AC competencies by name (framework aligned to AC names).
  let mapped = 0;
  const { data: fws } = await sb
    .from("reflect_frameworks")
    .select("id")
    .eq("engagement_id", reflectEngagementId)
    .eq("is_template", false)
    .limit(1);
  const fw = fws?.[0];
  if (fw) {
    const [{ data: acComps }, { data: rComps }] = await Promise.all([
      sb.from("competencies").select("id, name"),
      sb.from("reflect_competencies").select("id, name_en, ac_competency_id").eq("framework_id", fw.id),
    ]);
    const acByName = new Map((acComps ?? []).map((c) => [norm(c.name), c.id as string]));
    for (const rc of rComps ?? []) {
      if (rc.ac_competency_id) continue;
      const acId = acByName.get(norm(rc.name_en));
      if (acId) {
        const r = await sb.from("reflect_competencies").update({ ac_competency_id: acId }).eq("id", rc.id);
        if (!r.error) mapped++;
      }
    }
  }

  return { ok: true, linked, mapped };
}

/**
 * Answering a participant.
 *
 * A concern about how the centre was run, or an appeal against a result, has to
 * be dealt with and the dealing recorded (BPS 5.44, 5.48, 6.11). The database
 * refuses to let an answer be rewritten once given, so this writes it once and
 * stamps who gave it.
 */
export async function respondToConcernAction(values: {
  concernId: string;
  response: string;
  status: "acknowledged" | "resolved";
}) {
  let uid: string | null = null;
  try {
    const caller = await requireRole(["admin"]);
    uid = caller.isDev ? null : caller.uid;
  } catch (e) {
    if (isAuthorizationError(e)) return { error: e.message };
    throw e;
  }
  const response = (values.response ?? "").trim();
  if (response.length < 10) {
    return { error: "Write the answer the participant will read. A status change on its own is not a reply." };
  }

  const sb = createServiceClient();
  let responded_by_name: string | null = null;
  if (uid) {
    const { data: who } = await sb.from("profiles").select("full_name, email").eq("id", uid).maybeSingle();
    responded_by_name = (who?.full_name as string | null) ?? (who?.email as string | null) ?? null;
  }

  const now = new Date().toISOString();
  const { data: row, error } = await sb
    .from("ac_participant_concerns")
    .update({
      response,
      status: values.status,
      responded_by: uid,
      responded_by_name,
      acknowledged_at: now,
      resolved_at: values.status === "resolved" ? now : null,
    })
    .eq("id", values.concernId)
    .select("candidate_id, kind")
    .single();
  if (error) return { error: error.message };

  // Tell them there is an answer waiting rather than making them come back and look.
  const { data: cand } = await sb
    .from("candidates")
    .select("profile_id, engagement_id")
    .eq("id", row.candidate_id as string)
    .maybeSingle();
  if (cand?.profile_id) {
    await publishNotification({
      profileId: cand.profile_id as string,
      kind: "concern_answered",
      title: row.kind === "appeal" ? "Your appeal has been answered" : "Your concern has been answered",
      body: response.slice(0, 180),
      link: `/candidate/concerns/${row.candidate_id as string}`,
    });
  }
  return { ok: true };
}

/**
 * Re-assessment for a participant disturbed or taken ill (BPS 5.50). Creating
 * the record is the offer; declined is a legitimate outcome and is kept,
 * because "we offered and they said no" is the part that gets questioned later.
 */
export async function requestReassessmentAction(values: {
  engagementId: string;
  candidateId: string;
  reason: string;
  exerciseId?: string | null;
  deliveryLogId?: string | null;
}) {
  let uid: string | null = null;
  try {
    const caller = await requireRole(["admin", "lead_assessor", "associate_assessor"]);
    uid = caller.isDev ? null : caller.uid;
  } catch (e) {
    if (isAuthorizationError(e)) return { error: e.message };
    throw e;
  }
  const reason = (values.reason ?? "").trim();
  if (reason.length < 5) return { error: "Say what happened that makes re-assessment necessary." };

  const sb = createServiceClient();
  let requested_by_name: string | null = null;
  if (uid) {
    const { data: who } = await sb.from("profiles").select("full_name, email").eq("id", uid).maybeSingle();
    requested_by_name = (who?.full_name as string | null) ?? (who?.email as string | null) ?? null;
  }

  const { error } = await sb.from("ac_reassessment_requests").insert({
    engagement_id: values.engagementId,
    candidate_id: values.candidateId,
    exercise_id: values.exerciseId || null,
    delivery_log_id: values.deliveryLogId || null,
    reason,
    requested_by: uid,
    requested_by_name,
  });
  if (error) return { error: error.message };
  return { ok: true };
}

export async function updateReassessmentAction(values: {
  requestId: string;
  status: "requested" | "scheduled" | "completed" | "declined";
  scheduledFor?: string | null;
  outcomeNote?: string;
}) {
  const denied = await requireAdmin();
  if (denied) return denied;
  if (values.status === "scheduled" && !values.scheduledFor) {
    return { error: "A re-assessment marked as scheduled needs the date it is scheduled for." };
  }
  if (values.status === "declined" && (values.outcomeNote ?? "").trim().length < 5) {
    return { error: "Record why it was declined. An offer turned down is the part that gets questioned later." };
  }

  const sb = createServiceClient();
  const { error } = await sb
    .from("ac_reassessment_requests")
    .update({
      status: values.status,
      scheduled_for: values.scheduledFor || null,
      outcome_note: (values.outcomeNote ?? "").trim() || null,
    })
    .eq("id", values.requestId);
  if (error) return { error: error.message };
  return { ok: true };
}

/**
 * The decision, and telling the participant about it (BPS 5.9).
 *
 * VIFM assesses; the client decides. This records what the client decided and
 * when, so the participant can be told - which is the duty the standard puts on
 * the centre, and the one thing a participant most reliably complains about not
 * getting.
 */
export async function recordCandidateDecisionAction(values: {
  candidateId: string;
  outcome: string;
  decidedOn?: string | null;
  note?: string;
}) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const outcome = (values.outcome ?? "").trim();
  if (outcome.length < 2) return { error: "Record what the client decided." };

  const sb = createServiceClient();
  const { error } = await sb
    .from("candidates")
    .update({
      decision_outcome: outcome,
      decision_made_at: values.decidedOn || null,
      decision_note: (values.note ?? "").trim() || null,
    })
    .eq("id", values.candidateId);
  if (error) return { error: error.message };
  return { ok: true };
}

export async function notifyCandidateOfDecisionAction(candidateId: string) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const sb = createServiceClient();
  const { data: cand, error: readErr } = await sb
    .from("candidates")
    .select("id, full_name, profile_id, decision_outcome, decision_made_at, decision_communicated_at")
    .eq("id", candidateId)
    .maybeSingle();
  if (readErr) return { error: readErr.message };
  if (!cand) return { error: "Candidate not found." };
  if (!cand.decision_outcome) {
    return { error: "Record the decision before telling the participant about it." };
  }
  if (cand.decision_communicated_at) {
    return { error: "This participant has already been told." };
  }

  const decidedOn = cand.decision_made_at
    ? new Date(cand.decision_made_at as string).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
    : null;
  if (cand.profile_id) {
    await publishNotification({
      profileId: cand.profile_id as string,
      kind: "decision_recorded",
      title: "A decision has been recorded on your assessment",
      body: decidedOn
        ? `${cand.decision_outcome as string}. Decided on ${decidedOn}.`
        : (cand.decision_outcome as string),
      link: `/candidate/welcome/${candidateId}`,
    });
  }

  const { error } = await sb
    .from("candidates")
    .update({ decision_communicated_at: new Date().toISOString() })
    .eq("id", candidateId);
  if (error) return { error: error.message };
  // A participant with no portal account cannot be told in the app, so say so
  // rather than let the stamp imply they were.
  return { ok: true, inApp: Boolean(cand.profile_id) };
}

/**
 * The joining pack (BPS 5.38-5.41).
 *
 * Saving is free-form; publishing is not. A pack that does not say how long
 * results are kept, or who sees them, cannot support informed consent, so
 * publication is refused until every clause item has an answer.
 */
export async function saveJoiningPackAction(values: {
  engagementId: string;
  purposeStatement?: string;
  location?: string;
  preparation?: string;
  resultsUse?: string;
  decisions?: string;
  decisionTiming?: string;
  reportRecipients?: string;
  feedbackOffer?: "written_report" | "verbal_debrief" | "both" | "none" | "";
  feedbackWhen?: string;
  retentionMonths?: number;
  researchUse?: boolean;
  adjustmentsNote?: string;
}) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const months = values.retentionMonths ?? 24;
  if (!Number.isInteger(months) || months < 1 || months > 120) {
    return { error: "Retention has to be a whole number of months, between 1 and 120." };
  }

  const text = (v?: string) => (v ?? "").trim() || null;
  const sb = createServiceClient();
  const { error } = await sb
    .from("engagements")
    .update({
      pack_purpose_statement: text(values.purposeStatement),
      pack_location: text(values.location),
      pack_preparation: text(values.preparation),
      pack_results_use: text(values.resultsUse),
      pack_decisions: text(values.decisions),
      pack_decision_timing: text(values.decisionTiming),
      pack_report_recipients: text(values.reportRecipients),
      pack_feedback_offer: values.feedbackOffer || null,
      pack_feedback_when: text(values.feedbackWhen),
      retention_months: months,
      research_use: values.researchUse ?? false,
      pack_adjustments_note: text(values.adjustmentsNote),
    })
    .eq("id", values.engagementId);
  if (error) return { error: error.message };
  return { ok: true };
}

export async function publishJoiningPackAction(engagementId: string) {
  let uid: string | null = null;
  try {
    const caller = await requireRole(["admin"]);
    uid = caller.isDev ? null : caller.uid;
  } catch (e) {
    if (isAuthorizationError(e)) return { error: e.message };
    throw e;
  }

  const sb = createServiceClient();
  const [{ data: eng }, { data: exRows }] = await Promise.all([
    sb.from("engagements").select("*, organizations(name)").eq("id", engagementId).maybeSingle(),
    sb
      .from("engagement_exercises")
      .select("exercises(name, exercise_type, duration_minutes)")
      .eq("engagement_id", engagementId),
  ]);
  if (!eng) return { error: "Engagement not found." };

  const exercises = (exRows ?? [])
    .map((r) => r.exercises as unknown as PackExercise | null)
    .filter(Boolean) as PackExercise[];
  const pack = buildJoiningPack(eng as PackEngagement, exercises);
  if (pack.missing.length > 0) {
    return {
      error:
        "The pack is not complete yet: " +
        pack.missing.map((m) => `${m.label} (${m.clause})`).join("; ") +
        ". A participant cannot give informed consent against a pack that leaves these out.",
    };
  }

  const { error } = await sb
    .from("engagements")
    .update({ pack_published_at: new Date().toISOString(), pack_published_by: uid })
    .eq("id", engagementId);
  if (error) return { error: error.message };
  return { ok: true };
}

/**
 * Reasonable adjustments (BPS 5.45-5.47). The decision and what was actually
 * put in place both belong on the record: an adjustment agreed and not
 * delivered is worse than one refused.
 */
export async function decideAdjustmentAction(values: {
  candidateId: string;
  status: "agreed" | "declined";
  agreed?: string;
  extraMinutes?: number | null;
}) {
  let uid: string | null = null;
  try {
    const caller = await requireRole(["admin"]);
    uid = caller.isDev ? null : caller.uid;
  } catch (e) {
    if (isAuthorizationError(e)) return { error: e.message };
    throw e;
  }
  const agreed = (values.agreed ?? "").trim();
  if (agreed.length < 5) {
    return {
      error:
        values.status === "agreed"
          ? "Write what will actually be put in place, so the people running the centre can deliver it."
          : "Record why the adjustment was not made. A refusal with no reason is the one that gets challenged.",
    };
  }
  if (values.extraMinutes != null && (!Number.isInteger(values.extraMinutes) || values.extraMinutes < 0 || values.extraMinutes > 240)) {
    return { error: "Extra time has to be a whole number of minutes, up to 240." };
  }

  const sb = createServiceClient();
  const { data: row, error } = await sb
    .from("candidates")
    .update({
      adjustment_status: values.status,
      adjustment_agreed: agreed,
      adjustment_extra_minutes: values.status === "agreed" ? values.extraMinutes ?? null : null,
      adjustment_decided_at: new Date().toISOString(),
      adjustment_decided_by: uid,
    })
    .eq("id", values.candidateId)
    .select("profile_id")
    .single();
  if (error) return { error: error.message };

  if (row?.profile_id) {
    await publishNotification({
      profileId: row.profile_id as string,
      kind: "adjustment_decided",
      title:
        values.status === "agreed"
          ? "Your adjustment request has been agreed"
          : "Your adjustment request has been answered",
      body: agreed.slice(0, 180),
      link: `/candidate/pack/${values.candidateId}`,
    });
  }
  return { ok: true };
}

/**
 * Asking a participant to let someone else see their report (BPS 8.13).
 *
 * The joining pack names who receives reports and the participant agreed to
 * that list before attending (5.13). Anyone outside it is a fresh decision that
 * belongs to the participant, not to us, so this only ever creates a question.
 */
export async function requestReportDisclosureAction(values: {
  engagementId: string;
  candidateId: string;
  recipientName: string;
  recipientRole?: string;
  reason: string;
}) {
  let uid: string | null = null;
  try {
    const caller = await requireRole(["admin"]);
    uid = caller.isDev ? null : caller.uid;
  } catch (e) {
    if (isAuthorizationError(e)) return { error: e.message };
    throw e;
  }
  const recipient = (values.recipientName ?? "").trim();
  const reason = (values.reason ?? "").trim();
  if (recipient.length < 2) return { error: "Name who wants the report." };
  if (reason.length < 10) {
    return { error: "Say why they want it. The participant is being asked to decide and is owed the reason." };
  }

  const sb = createServiceClient();
  let requested_by_name: string | null = null;
  if (uid) {
    const { data: who } = await sb.from("profiles").select("full_name, email").eq("id", uid).maybeSingle();
    requested_by_name = (who?.full_name as string | null) ?? (who?.email as string | null) ?? null;
  }

  const { error } = await sb.from("ac_report_disclosures").insert({
    engagement_id: values.engagementId,
    candidate_id: values.candidateId,
    recipient_name: recipient,
    recipient_role: (values.recipientRole ?? "").trim() || null,
    reason,
    requested_by: uid,
    requested_by_name,
  });
  if (error) return { error: error.message };

  const { data: cand } = await sb
    .from("candidates")
    .select("profile_id")
    .eq("id", values.candidateId)
    .maybeSingle();
  if (cand?.profile_id) {
    await publishNotification({
      profileId: cand.profile_id as string,
      kind: "disclosure_requested",
      title: "Someone has asked to see your assessment report",
      body: `${recipient} has asked for your report. You decide whether they get it.`,
      link: `/candidate/welcome/${values.candidateId}`,
    });
  }
  return { ok: true };
}

/**
 * Handing the report over, once permission exists. Refused stays refused: the
 * database will not let a refusal be overwritten with a grant, and this will
 * not let a report go out without one.
 */
export async function markDisclosureReleasedAction(disclosureId: string) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const sb = createServiceClient();
  const { data: row, error: readErr } = await sb
    .from("ac_report_disclosures")
    .select("status, released_at, recipient_name")
    .eq("id", disclosureId)
    .maybeSingle();
  if (readErr) return { error: readErr.message };
  if (!row) return { error: "Request not found." };
  if (row.status !== "granted") {
    return {
      error:
        "The participant has not given permission for this, so the report cannot be shared. "
        + "A refusal is not an obstacle to work around.",
    };
  }
  if (row.released_at) return { error: "Already recorded as handed over." };

  const { error } = await sb
    .from("ac_report_disclosures")
    .update({ released_at: new Date().toISOString() })
    .eq("id", disclosureId);
  if (error) return { error: error.message };
  return { ok: true };
}

/**
 * Who works this centre (BPS 4.42, 5.14, 5.16, 5.17, 6.1).
 *
 * Assigning is not the same as confirming competence: the assignment is a plan,
 * the competence record is the evidence behind it, and the activation gate
 * checks both. Someone from outside VIFM can hold a role - 3.12 still makes us
 * responsible for specifying what they have to be able to do.
 */
export async function assignCentreRoleAction(values: {
  engagementId: string;
  roleKey: string;
  profileId: string;
  isExternal?: boolean;
  externalNote?: string;
}) {
  let uid: string | null = null;
  try {
    const caller = await requireRole(["admin"]);
    uid = caller.isDev ? null : caller.uid;
  } catch (e) {
    if (isAuthorizationError(e)) return { error: e.message };
    throw e;
  }
  if (!CENTRE_ROLE_MAP[values.roleKey]) return { error: "That is not a centre role." };

  const sb = createServiceClient();
  const { error } = await sb.from("ac_engagement_roles").insert({
    engagement_id: values.engagementId,
    role_key: values.roleKey,
    profile_id: values.profileId,
    is_external: values.isExternal ?? false,
    external_note: (values.externalNote ?? "").trim() || null,
    assigned_by: uid,
  });
  // The unique constraint means "already in that role", which is not an error
  // worth showing anyone.
  if (error && !/duplicate key/i.test(error.message)) return { error: error.message };
  return { ok: true };
}

export async function removeCentreRoleAction(rowId: string) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const sb = createServiceClient();
  const { error } = await sb.from("ac_engagement_roles").delete().eq("id", rowId);
  if (error) return { error: error.message };
  return { ok: true };
}

/**
 * Confirming that someone has DEMONSTRATED competence for a role (BPS 5.22).
 *
 * The evidence field is required for a confirmation because 5.22 asks us to
 * confirm competence was demonstrated, and "we sent them on a course" is not
 * that. Withdrawing competence needs a reason for the same reason.
 */
export async function setRoleCompetenceAction(values: {
  profileId: string;
  roleKey: string;
  status: "in_training" | "competent" | "withdrawn";
  evidence?: string;
  trainedOn?: string | null;
  expiresOn?: string | null;
  notes?: string;
}) {
  let uid: string | null = null;
  try {
    const caller = await requireRole(["admin"]);
    uid = caller.isDev ? null : caller.uid;
  } catch (e) {
    if (isAuthorizationError(e)) return { error: e.message };
    throw e;
  }
  if (!CENTRE_ROLE_MAP[values.roleKey]) return { error: "That is not a centre role." };

  const evidence = (values.evidence ?? "").trim();
  if (values.status === "competent" && evidence.length < 10) {
    return {
      error:
        "Record what was actually seen. The standard asks us to confirm competence was demonstrated, "
        + "so an entry with no evidence behind it is not a confirmation.",
    };
  }
  if (values.status === "withdrawn" && evidence.length < 5) {
    return { error: "Say why competence is being withdrawn." };
  }

  const sb = createServiceClient();
  let confirmed_by_name: string | null = null;
  if (uid) {
    const { data: who } = await sb.from("profiles").select("full_name, email").eq("id", uid).maybeSingle();
    confirmed_by_name = (who?.full_name as string | null) ?? (who?.email as string | null) ?? null;
  }

  const { error } = await sb.from("ac_role_competence").upsert(
    {
      profile_id: values.profileId,
      role_key: values.roleKey,
      status: values.status,
      evidence: evidence || null,
      trained_on: values.trainedOn || null,
      expires_on: values.expiresOn || null,
      notes: (values.notes ?? "").trim() || null,
      confirmed_by: uid,
      confirmed_by_name,
      confirmed_at: values.status === "competent" ? new Date().toISOString() : null,
    },
    { onConflict: "profile_id,role_key" }
  );
  if (error) return { error: error.message };
  return { ok: true };
}

/**
 * Whether evidence from outside the centre may count towards a rating
 * (BPS 7.14 to 7.16).
 *
 * "Not at all" is a complete answer to 7.14 and the safer one: what the clause
 * forbids is silence, because then assessors decide in the room, case by case,
 * differently for different participants. Permitting it requires the framework
 * for integrating it to be written down at design time (7.16), and that the
 * three conditions in 7.15 have been considered - relevant data for EVERY
 * participant, mappable to the criteria, collected with care.
 */
export async function setExternalEvidenceRuleAction(values: {
  engagementId: string;
  rule: "not_permitted" | "permitted";
  framework?: string;
}) {
  let uid: string | null = null;
  try {
    const caller = await requireRole(["admin"]);
    uid = caller.isDev ? null : caller.uid;
  } catch (e) {
    if (isAuthorizationError(e)) return { error: e.message };
    throw e;
  }

  const framework = (values.framework ?? "").trim();
  if (values.rule === "permitted" && framework.length < 30) {
    return {
      error:
        "Write the framework for integrating it: which evidence, how it maps onto the assessment criteria, and "
        + "what it may do to a rating. It must also exist for every participant, or it cannot count towards any "
        + "of them.",
    };
  }

  const sb = createServiceClient();
  const { error } = await sb
    .from("engagements")
    .update({
      external_evidence_rule: values.rule,
      external_evidence_framework: values.rule === "permitted" ? framework : null,
      external_evidence_confirmed_at: new Date().toISOString(),
      external_evidence_confirmed_by: uid,
    })
    .eq("id", values.engagementId);
  if (error) return { error: error.message };
  return { ok: true };
}

/**
 * How participants were allocated to this centre and to groups within it, and
 * why (BPS 5.37). The clause says the rationale "should be documented", so it
 * is prose on the design rather than a checkbox - group composition affects
 * what a participant gets the chance to show, particularly in a group exercise.
 */
export async function setGroupingRationaleAction(values: { engagementId: string; rationale: string }) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const sb = createServiceClient();
  const { error } = await sb
    .from("engagements")
    .update({ grouping_rationale: (values.rationale ?? "").trim() || null })
    .eq("id", values.engagementId);
  if (error) return { error: error.message };
  return { ok: true };
}

/**
 * The design record (BPS section 4) and the plan sign-off (3.26).
 *
 * These are the reasons behind decisions Caliber already makes. Recording them
 * is what turns a matrix into an argument a centre can be defended with.
 */
export async function saveDesignRecordAction(values: {
  engagementId: string;
  designRationale?: string;
  alternativesConsidered?: string;
  jobAnalysisMethod?: string;
  jobAnalysisNote?: string;
  workContext?: string;
  smeReviewNote?: string;
  exerciseIndependenceNote?: string;
  existingExercisesNote?: string;
  criteriaLoadAck?: string;
  facilitiesNote?: string;
}) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const text = (v?: string) => (v ?? "").trim() || null;
  const method = values.jobAnalysisMethod || null;
  const allowed = ["jd_extraction", "role_profile", "interviews", "observation", "workshop", "other"];
  if (method && !allowed.includes(method)) return { error: "That is not a job-analysis method." };

  const sb = createServiceClient();
  const { error } = await sb
    .from("engagements")
    .update({
      design_rationale: text(values.designRationale),
      alternatives_considered: text(values.alternativesConsidered),
      job_analysis_method: method,
      job_analysis_note: text(values.jobAnalysisNote),
      work_context: text(values.workContext),
      sme_review_note: text(values.smeReviewNote),
      exercise_independence_note: text(values.exerciseIndependenceNote),
      existing_exercises_note: text(values.existingExercisesNote),
      criteria_load_ack: text(values.criteriaLoadAck),
      facilities_note: text(values.facilitiesNote),
    })
    .eq("id", values.engagementId);
  if (error) return { error: error.message };
  return { ok: true };
}

/** Why a single criterion is assessed here (BPS 4.4). */
export async function setCompetencyRationaleAction(values: {
  engagementId: string;
  competencyId: string;
  rationale: string;
}) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const sb = createServiceClient();
  const { error } = await sb
    .from("engagement_competencies")
    .update({ rationale: (values.rationale ?? "").trim() || null, source: "manual" })
    .eq("engagement_id", values.engagementId)
    .eq("competency_id", values.competencyId);
  if (error) return { error: error.message };
  return { ok: true };
}

/**
 * Agreeing the plan with the client (BPS 3.26).
 *
 * The clause says the plan is agreed WITH the client, so this asks who at the
 * client agreed it. An internal tick would record that we approved our own
 * plan, which is not what was asked for.
 */
export async function approveCentrePlanAction(values: { engagementId: string; clientName: string }) {
  let uid: string | null = null;
  try {
    const caller = await requireRole(["admin"]);
    uid = caller.isDev ? null : caller.uid;
  } catch (e) {
    if (isAuthorizationError(e)) return { error: e.message };
    throw e;
  }
  const clientName = (values.clientName ?? "").trim();
  if (clientName.length < 2) {
    return { error: "Name who at the client agreed this plan. The standard asks for agreement with them, not just by us." };
  }
  const sb = createServiceClient();
  const { error } = await sb
    .from("engagements")
    .update({
      plan_approved_at: new Date().toISOString(),
      plan_approved_by: uid,
      plan_approved_client_name: clientName,
    })
    .eq("id", values.engagementId);
  if (error) return { error: error.message };
  return { ok: true };
}

/**
 * Recording that a manual went to somebody (BPS 4.41, 5.33, 6.9).
 *
 * The PDF is generated on demand, so this does not store a document - it
 * stores the distribution. Secure distribution with no record of who holds a
 * copy is not secure, it is only quiet, and a manual carries the exercise
 * material the centre depends on being unseen.
 */
export async function recordManualIssueAction(values: {
  engagementId: string;
  variant: string;
  issuedToProfileId?: string | null;
  issuedToName: string;
  issuedToEmail?: string | null;
  confidential?: boolean;
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
  const name = (values.issuedToName ?? "").trim();
  if (name.length < 2) return { error: "Record who the manual was given to." };
  if (values.variant !== "full" && !CENTRE_ROLE_MAP[values.variant]) {
    return { error: "That is not a manual variant." };
  }

  const sb = createServiceClient();
  const { data: eng } = await sb
    .from("engagements")
    .select("manual_version")
    .eq("id", values.engagementId)
    .maybeSingle();

  let issued_by_name: string | null = null;
  if (uid) {
    const { data: who } = await sb.from("profiles").select("full_name, email").eq("id", uid).maybeSingle();
    issued_by_name = (who?.full_name as string | null) ?? (who?.email as string | null) ?? null;
  }

  const { error } = await sb.from("ac_manual_issues").insert({
    engagement_id: values.engagementId,
    variant: values.variant,
    version: (eng?.manual_version as number) ?? 1,
    issued_to: values.issuedToProfileId || null,
    issued_to_name: name,
    issued_to_email: (values.issuedToEmail ?? "").trim() || null,
    confidential: values.confidential ?? true,
    issued_by: uid,
    issued_by_name,
    note: (values.note ?? "").trim() || null,
  });
  if (error) return { error: error.message };
  return { ok: true };
}

/** A copy confirmed returned or destroyed after the centre (BPS 6.9). */
export async function markManualReturnedAction(issueId: string) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const sb = createServiceClient();
  const { error } = await sb
    .from("ac_manual_issues")
    .update({ returned_at: new Date().toISOString() })
    .eq("id", issueId);
  if (error) return { error: error.message };
  return { ok: true };
}

/**
 * The design changed after manuals went out (BPS 4.41).
 *
 * Bumping the version does not recall anything - it makes the discrepancy
 * visible, so the holder of an older cut can be found and re-issued. A silent
 * change is how someone ends up running yesterday's exercise.
 */
export async function bumpManualVersionAction(engagementId: string) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const sb = createServiceClient();
  const { data: eng } = await sb
    .from("engagements")
    .select("manual_version")
    .eq("id", engagementId)
    .maybeSingle();
  const next = ((eng?.manual_version as number) ?? 1) + 1;
  const { error } = await sb.from("engagements").update({ manual_version: next }).eq("id", engagementId);
  if (error) return { error: error.message };
  return { ok: true, version: next };
}

/**
 * The Centre Manager confirming the centre is ready to run (BPS 6.3): venue,
 * equipment and documentation. Deliberately a person's confirmation rather
 * than a derived flag - the clause asks someone to have checked, and no query
 * can tell whether the room has a working clock in it.
 */
export async function confirmCentreReadinessAction(values: { engagementId: string; note?: string }) {
  let uid: string | null = null;
  try {
    const caller = await requireRole(["admin"]);
    uid = caller.isDev ? null : caller.uid;
  } catch (e) {
    if (isAuthorizationError(e)) return { error: e.message };
    throw e;
  }
  const sb = createServiceClient();
  let name: string | null = null;
  if (uid) {
    const { data: who } = await sb.from("profiles").select("full_name, email").eq("id", uid).maybeSingle();
    name = (who?.full_name as string | null) ?? (who?.email as string | null) ?? null;
  }
  const { error } = await sb
    .from("engagements")
    .update({
      readiness_confirmed_at: new Date().toISOString(),
      readiness_confirmed_by: uid,
      readiness_confirmed_name: name,
      readiness_note: (values.note ?? "").trim() || null,
    })
    .eq("id", values.engagementId);
  if (error) return { error: error.message };
  return { ok: true };
}

/**
 * Recording that a participant was actually told their results (BPS 8.3, 8.14
 * to 8.24).
 *
 * Deliberately NOT blocked when the person giving feedback has no recorded
 * training (8.17). Refusing would withhold from the participant the most
 * useful thing the centre produces in order to protect a paperwork state -
 * harming the person the clause exists for. Instead the record carries whether
 * the deliverer was trained AT THE TIME, and the engagement reports it.
 */
export async function recordFeedbackAction(values: {
  engagementId: string;
  candidateId: string;
  form: "written_report" | "oral" | "both";
  deliveredByProfileId?: string | null;
  deliveredByName?: string;
  summary?: string;
}) {
  let uid: string | null = null;
  try {
    const caller = await requireRole(["admin", "lead_assessor", "associate_assessor"]);
    uid = caller.isDev ? null : caller.uid;
  } catch (e) {
    if (isAuthorizationError(e)) return { error: e.message };
    throw e;
  }

  const summary = (values.summary ?? "").trim();
  // 8.21: an oral session the participant cannot refer back to is not a record.
  if ((values.form === "oral" || values.form === "both") && summary.length < 20) {
    return {
      error:
        "Write what was discussed. The participant is entitled to a written record of an oral session, and a "
        + "conversation nobody wrote down is one they cannot refer back to or challenge.",
    };
  }

  const sb = createServiceClient();
  const deliveredBy = values.deliveredByProfileId || uid;
  let name = (values.deliveredByName ?? "").trim();
  if (!name && deliveredBy) {
    const { data: who } = await sb.from("profiles").select("full_name, email").eq("id", deliveredBy).maybeSingle();
    name = (who?.full_name as string | null) ?? (who?.email as string | null) ?? "";
  }
  if (!name) return { error: "Record who gave the feedback." };

  // Whether they were feedback-trained at this moment (8.17). Stored, not
  // derived later: competence records change, and this is a statement about
  // the session that happened.
  let trained = false;
  if (deliveredBy) {
    const { data: comp } = await sb
      .from("ac_role_competence")
      .select("status, expires_on")
      .eq("profile_id", deliveredBy)
      .eq("role_key", "feedback_generator")
      .maybeSingle()
      .then((r) => r, () => ({ data: null }));
    trained = competenceIsCurrent(
      comp
        ? {
            profile_id: deliveredBy,
            role_key: "feedback_generator",
            status: comp.status as string,
            expires_on: (comp.expires_on as string | null) ?? null,
          }
        : undefined
    );
  }

  const { error } = await sb.from("ac_feedback_records").insert({
    engagement_id: values.engagementId,
    candidate_id: values.candidateId,
    form: values.form,
    delivered_by: deliveredBy,
    delivered_by_name: name,
    summary: summary || null,
    deliverer_trained: trained,
  });
  if (error) return { error: error.message };

  const { data: cand } = await sb
    .from("candidates")
    .select("profile_id")
    .eq("id", values.candidateId)
    .maybeSingle();
  if (cand?.profile_id) {
    await publishNotification({
      profileId: cand.profile_id as string,
      kind: "feedback_recorded",
      title: "Your assessment feedback has been recorded",
      body: summary ? summary.slice(0, 180) : "A written report has been provided.",
      link: `/candidate/welcome/${values.candidateId}`,
    });
  }
  return { ok: true, trained };
}

/**
 * A slot on the centre timetable (BPS 5.35).
 *
 * Breaks and briefings are slots, not gaps between them: 5.35.5 asks whether
 * the timetable compromises anyone's performance, and that cannot be checked
 * against breaks nobody wrote down.
 */
export async function addScheduleSlotAction(values: {
  engagementId: string;
  kind: "exercise" | "briefing" | "break" | "lunch" | "washup" | "feedback" | "other";
  exerciseId?: string | null;
  candidateId?: string | null;
  assessorId?: string | null;
  startsAt: string;
  endsAt: string;
  room?: string;
  note?: string;
}) {
  const denied = await requireAdmin();
  if (denied) return denied;
  if (!values.startsAt || !values.endsAt) return { error: "A slot needs a start and an end." };
  if (new Date(values.endsAt) <= new Date(values.startsAt)) {
    return { error: "A slot has to end after it starts." };
  }

  const sb = createServiceClient();
  const { error } = await sb.from("ac_schedule_slots").insert({
    engagement_id: values.engagementId,
    kind: values.kind,
    exercise_id: values.exerciseId || null,
    candidate_id: values.candidateId || null,
    assessor_id: values.assessorId || null,
    starts_at: values.startsAt,
    ends_at: values.endsAt,
    room: (values.room ?? "").trim() || null,
    note: (values.note ?? "").trim() || null,
  });
  if (error) return { error: error.message };
  return { ok: true };
}

export async function removeScheduleSlotAction(slotId: string) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const sb = createServiceClient();
  const { error } = await sb.from("ac_schedule_slots").delete().eq("id", slotId);
  if (error) return { error: error.message };
  return { ok: true };
}

/**
 * Lay out every assessor assignment as slots, back to back, from a start time.
 *
 * The assignments already say who assesses whom in which exercise - the matrix
 * 5.35.2 asks for - so the tedious half of a timetable is derivable. What it
 * cannot know is rooms and real-world constraints, which is why this produces a
 * starting point the clash checks then argue with, rather than a finished
 * timetable.
 */
export async function generateTimetableDraftAction(values: {
  engagementId: string;
  dayStart: string;
  gapMinutes?: number;
}) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const start = new Date(values.dayStart);
  if (Number.isNaN(start.getTime())) return { error: "That start time is not a date." };

  const sb = createServiceClient();
  const [{ data: assignments }, { data: existing }] = await Promise.all([
    sb
      .from("assessor_assignments")
      .select("candidate_id, assessor_id, exercise_id, exercises(duration_minutes)")
      .eq("engagement_id", values.engagementId),
    sb.from("ac_schedule_slots").select("id").eq("engagement_id", values.engagementId).limit(1),
  ]);
  if (existing && existing.length > 0) {
    return { error: "This centre already has a timetable. Clear it first, or add slots by hand." };
  }
  if (!assignments || assignments.length === 0) {
    return { error: "No assessor assignments yet, so there is nothing to lay out." };
  }

  // One track per participant: their exercises run in sequence. Assessors are
  // taken from the assignment, so two participants sharing an assessor will
  // collide - deliberately, because that is a real conflict for a person to
  // resolve rather than something to paper over silently.
  const gap = values.gapMinutes ?? 15;
  const byCandidate = new Map<string, typeof assignments>();
  for (const a of assignments) {
    const arr = byCandidate.get(a.candidate_id as string) ?? [];
    arr.push(a);
    byCandidate.set(a.candidate_id as string, arr);
  }

  const rows: Record<string, unknown>[] = [];
  for (const [candidateId, list] of Array.from(byCandidate.entries())) {
    let cursor = new Date(start);
    for (const a of list) {
      const ex = a.exercises as unknown as { duration_minutes?: number | null } | null;
      const minutes = ex?.duration_minutes ?? 60;
      const ends = new Date(cursor.getTime() + minutes * 60000);
      rows.push({
        engagement_id: values.engagementId,
        kind: "exercise",
        exercise_id: a.exercise_id,
        candidate_id: candidateId,
        assessor_id: a.assessor_id,
        starts_at: cursor.toISOString(),
        ends_at: ends.toISOString(),
      });
      cursor = new Date(ends.getTime() + gap * 60000);
    }
  }

  const { error } = await sb.from("ac_schedule_slots").insert(rows);
  if (error) return { error: error.message };
  return { ok: true, created: rows.length };
}
