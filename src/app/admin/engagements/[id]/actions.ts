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
  for (const candidateId of candidateIds) {
    const { data: updated } = await sb
      .from("candidate_reports")
      .update({ status: "released", released_at: nowIso })
      .eq("engagement_id", engagementId)
      .eq("candidate_id", candidateId)
      .select("id");
    if (updated && updated.length > 0) {
      released += updated.length;
    } else {
      const { error: insErr } = await sb
        .from("candidate_reports")
        .insert({ engagement_id: engagementId, candidate_id: candidateId, status: "released", released_at: nowIso });
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
