import { createClient } from "@/lib/supabase/server";
import { fetchAllPages } from "@/lib/ara/paginate";
import { getServerT, getServerLocale } from "@/lib/i18n/server";
import { notFound } from "next/navigation";
import { BackLink } from "@/components/shared/back-link";
import { EngagementDetail } from "./_components/engagement-detail";
import { RecommendedCoursesPanel } from "@/components/shared/recommended-courses-panel";
import {
  recommendCoursesForAcCohort,
  recommendCoursesForAcCandidate,
} from "@/lib/recommender/courses";
import { getEngagementTechProgram } from "@/lib/competencies/engagement-tech-program";
import { TechnicalCertPanel } from "./_components/technical-cert-panel";
import { CandidateFilterBar } from "./_components/candidate-filter-bar";
import { CentreRulesPanel } from "./_components/centre-rules-panel";
import { DeliveryLogPanel } from "./_components/delivery-log-panel";
import { ParticipantRightsPanel } from "./_components/participant-rights-panel";
import { JoiningPackPanel } from "./_components/joining-pack-panel";
import { CentreRolesPanel } from "./_components/centre-roles-panel";
import { reviewCentreRoles } from "@/lib/ac/centre-roles-review";
import { buildJoiningPack, type PackEngagement, type PackExercise } from "@/lib/ac/joining-pack";
import { loadReadinessSetup } from "@/lib/scoring/readiness-setup";
import { ReadinessSetupPanel } from "./_components/readiness-setup-panel";
import { computeAcObservedLens } from "@/lib/scoring/ac-observed-lens";
import { ObservedLensPanel } from "./_components/observed-lens-panel";

type Props = {
  params: { id: string };
  searchParams: { candidate?: string };
};

export default async function EngagementDetailPage({ params, searchParams }: Props) {
  const supabase = await createClient();
  const t = await getServerT();
  const { id } = params;
  const focusedCandidateId = searchParams.candidate ?? null;

  const [engResult, candsResult, exercisesResult, assessorsResult, matrixResult, profilesResult] =
    await Promise.all([
      supabase
        .from("engagements")
        .select("*, organizations(name)")
        .eq("id", id)
        .single(),
      supabase
        .from("candidates")
        .select("*, role_profiles(id, name_en, name_ar)")
        .eq("engagement_id", id)
        .order("full_name"),
      supabase
        .from("engagement_exercises")
        .select("exercise_id, exercises(id, name, exercise_type, duration_minutes)")
        .eq("engagement_id", id),
      supabase
        .from("profiles")
        .select("id, full_name, email, role")
        .in("role", ["lead_assessor", "associate_assessor"]),
      supabase
        .from("exercise_competency_matrix")
        .select("exercise_id, competency_id, competencies(name, name_ar)")
        .eq("engagement_id", id),
      supabase
        .from("role_profiles")
        .select("id, name_en, name_ar, target_role")
        .order("name_en"),
    ]);

  if (engResult.error || !engResult.data) return notFound();

  // Assignments (candidates x exercises x assessors) and integration_worksheets
  // (candidates x competencies x assessors) both scale past 1000 on a large
  // engagement, so they are paginated - an unpaginated read caps at 1000 and
  // would truncate the assignment grid + undercount integration progress.
  // Declared conflicts of interest (BPS 5.36); tolerant of migration 00206 not
  // being applied, so the page still renders on an older database.
  const conflicts = await supabase
    .from("ac_assessor_conflicts")
    .select("id, assessor_id, candidate_id, reason")
    .eq("engagement_id", id)
    .then((r) => (r.data ?? []) as Record<string, unknown>[], () => [] as Record<string, unknown>[]);

  // What happened during delivery (BPS 6.10); tolerant of migration 00208 not
  // being applied yet.
  const deliveryLog = await supabase
    .from("ac_delivery_log")
    .select("id, kind, summary, action_taken, occurred_at, candidate_id, affects_assessment, logged_by_name")
    .eq("engagement_id", id)
    .order("occurred_at", { ascending: false })
    .then((r) => (r.data ?? []) as Record<string, unknown>[], () => [] as Record<string, unknown>[]);

  // What participants have raised, and any re-assessment arranged for them
  // (BPS 5.44, 5.48, 5.50, 6.11). Tolerant of migration 00210 not being applied.
  const [concerns, reassessments] = await Promise.all([
    supabase
      .from("ac_participant_concerns")
      .select("id, candidate_id, kind, stage, body, status, response, raised_at, acknowledged_at, responded_by_name")
      .eq("engagement_id", id)
      .order("raised_at", { ascending: false })
      .then((r) => (r.data ?? []) as Record<string, unknown>[], () => [] as Record<string, unknown>[]),
    supabase
      .from("ac_reassessment_requests")
      .select("id, candidate_id, exercise_id, reason, status, scheduled_for, outcome_note, created_at")
      .eq("engagement_id", id)
      .order("created_at", { ascending: false })
      .then((r) => (r.data ?? []) as Record<string, unknown>[], () => [] as Record<string, unknown>[]),
  ]);

  // Requests to share a report outside the agreed recipients (BPS 8.13).
  // Tolerant of migration 00212 not being applied.
  const disclosures = await supabase
    .from("ac_report_disclosures")
    .select("id, candidate_id, recipient_name, recipient_role, reason, status, participant_note, decided_at, released_at")
    .eq("engagement_id", id)
    .order("requested_at", { ascending: false })
    .then((r) => (r.data ?? []) as Record<string, unknown>[], () => [] as Record<string, unknown>[]);

  // Who holds which centre role, and whether they are competent for it
  // (BPS 4.42, 5.16, 5.17, 5.22, 6.2). Tolerant of migration 00213.
  const centreRoleRows = await supabase
    .from("ac_engagement_roles")
    .select("id, role_key, profile_id, is_external, external_note")
    .eq("engagement_id", id)
    .then((r) => (r.data ?? []) as Record<string, unknown>[], () => [] as Record<string, unknown>[]);
  const competenceRows = centreRoleRows.length
    ? await supabase
        .from("ac_role_competence")
        .select("profile_id, role_key, status, evidence, trained_on, expires_on")
        .in("profile_id", Array.from(new Set(centreRoleRows.map((r) => r.profile_id as string))))
        .then((r) => (r.data ?? []) as Record<string, unknown>[], () => [] as Record<string, unknown>[])
    : [];
  // Anyone with a platform account can hold a centre role - an administrator is
  // not an assessor, and restricting the picker to assessors was how the
  // platform came to believe a centre was only ever staffed by assessors.
  const staffDirectory = await supabase
    .from("profiles")
    .select("id, full_name, email, role")
    .not("role", "in", "(candidate,client)")
    .order("full_name")
    .then((r) => (r.data ?? []) as Record<string, unknown>[], () => [] as Record<string, unknown>[]);

  const [assignments, integrationWorksheets] = await Promise.all([
    fetchAllPages<Record<string, unknown>>((from, to) =>
      supabase
        .from("assessor_assignments")
        .select("*, profiles(id, full_name, email), candidates(id, full_name), exercises(id, name)")
        .eq("engagement_id", id)
        .order("id")
        .range(from, to) as unknown as PromiseLike<{ data: Record<string, unknown>[] | null; error: { message: string } | null }>
    ).catch(() => [] as Record<string, unknown>[]),
    fetchAllPages<Record<string, unknown>>((from, to) =>
      supabase
        .from("integration_worksheets")
        .select("*, competencies(name, name_ar), profiles:assessor_id(full_name)")
        .eq("engagement_id", id)
        .order("id")
        .range(from, to) as unknown as PromiseLike<{ data: Record<string, unknown>[] | null; error: { message: string } | null }>
    ).catch(() => [] as Record<string, unknown>[]),
  ]);

  const engagement = engResult.data;
  const candidates = candsResult.data ?? [];
  const engExercises = exercisesResult.data ?? [];
  const assessors = assessorsResult.data ?? [];
  const matrix = matrixResult.data ?? [];
  const roleProfiles = profilesResult.data ?? [];

  // G7 - re-engagement deltas: when this engagement was seeded from a
  // prior one, fetch the prior OAR for each carried-over candidate so
  // the candidate row can show "↑1 vs prior" or "↓1" once the new run
  // produces its own OAR. Skipped (and the map stays empty) when this
  // is a fresh engagement, which keeps the cost zero on the common path.
  const priorCandidateIds = candidates
    .map((c) => c.prior_candidate_id as string | null)
    .filter((x): x is string => !!x);
  const priorOarMap: Record<string, number> = {};
  const currentOarMap: Record<string, number> = {};
  if (priorCandidateIds.length > 0) {
    const [{ data: priorOars }, { data: currOars }] = await Promise.all([
      supabase
        .from("overall_assessment_ratings")
        .select("candidate_id, overall_score")
        .in("candidate_id", priorCandidateIds),
      supabase
        .from("overall_assessment_ratings")
        .select("candidate_id, overall_score")
        .eq("engagement_id", id),
    ]);
    for (const row of priorOars ?? []) {
      priorOarMap[row.candidate_id as string] = row.overall_score as number;
    }
    for (const row of currOars ?? []) {
      currentOarMap[row.candidate_id as string] = row.overall_score as number;
    }
  }

  // Extract exercises from junction table
  const exercises = engExercises
    .map((ee: Record<string, unknown>) => ee.exercises)
    .filter(Boolean) as Record<string, unknown>[];

  // Day 3 - VIFM training-course recommendations. Cohort-aggregated
  // by default; if the URL carries ?candidate=<id>, focus on just
  // that candidate's gaps so the consultant can use the panel as a
  // 1:1 development plan instead of a group plan.
  let recommendedCourses: Awaited<ReturnType<typeof recommendCoursesForAcCohort>> = [];
  try {
    recommendedCourses = focusedCandidateId
      ? await recommendCoursesForAcCandidate({
          engagementId: id,
          candidateId: focusedCandidateId,
        })
      : await recommendCoursesForAcCohort({ engagementId: id });
  } catch (e) {
    console.error("[ac-engagement-detail] recommender failed:", e);
  }
  const focusedCandidate = focusedCandidateId
    ? candidates.find((c) => c.id === focusedCandidateId)
    : null;

  // B3 - observed-evidence DARE + EQ lens for the focused candidate. Null
  // (panel hidden) until the candidate has wash-up consensus scores.
  const observedLens = focusedCandidate
    ? await computeAcObservedLens(id, focusedCandidate.id as string)
    : null;

  // What the joining pack still lacks (BPS 5.41). Computed from the same
  // builder the participant's copy uses, so the checklist and the pack can
  // never disagree about what is missing.
  const packMissing = buildJoiningPack(engagement as PackEngagement, exercises as unknown as PackExercise[]).missing;

  // Technical certification program for this engagement (paid org layer).
  const techProgram = await getEngagementTechProgram(id, await getServerLocale());

  // Succession Readiness setup (combined-mode wiring + per-candidate status).
  const readinessSetup = await loadReadinessSetup(id);

  // Psychometric instruments in play mean a Test User is required (5.17); a
  // role-play means a role-player. Both are read from the design rather than
  // asked, so the requirement cannot be forgotten.
  const exerciseTypes = exercises
    .map((x) => (x as { exercise_type?: string }).exercise_type)
    .filter(Boolean) as string[];
  const centreRolesReview = reviewCentreRoles({
    purpose: (engagement as { purpose?: string | null }).purpose ?? null,
    usesRolePlay: exerciseTypes.includes("role_play"),
    usesFactFind: exerciseTypes.includes("case_study"),
    // Combined mode runs Persona (a self-report questionnaire) and a technical
    // programme runs knowledge tests: either makes a Test User necessary.
    usesPsychometrics: readinessSetup.mode === "combined" || Boolean(techProgram),
    assignments: centreRoleRows.map((r) => ({
      role_key: r.role_key as string,
      profile_id: r.profile_id as string,
      is_external: r.is_external as boolean | null,
      profiles: (() => {
        const p = staffDirectory.find((x) => x.id === r.profile_id);
        return p ? { full_name: p.full_name as string | null, email: p.email as string | null } : null;
      })(),
    })),
    competence: competenceRows.map((c) => ({
      profile_id: c.profile_id as string,
      role_key: c.role_key as string,
      status: c.status as string,
      expires_on: (c.expires_on as string | null) ?? null,
    })),
  });


  return (
    <div className="space-y-6">
      <BackLink href="/admin/engagements" label={t("adminEngagements.detail.backToProjects")} />
      <EngagementDetail
        engagement={engagement}
        candidates={candidates}
        exercises={exercises}
        assignments={assignments}
        assessors={assessors}
        matrix={matrix}
        integrationWorksheets={integrationWorksheets}
        roleProfiles={roleProfiles}
        priorOarMap={priorOarMap}
        currentOarMap={currentOarMap}
      />
      <CentreRulesPanel
        engagementId={id}
        candidates={candidates}
        assignments={assignments}
        assessors={assessors}
        conflicts={conflicts}
        overrideReason={(engagement as { staffing_override_reason?: string | null }).staffing_override_reason ?? null}
        contactName={(engagement as { participant_contact_name?: string | null }).participant_contact_name ?? ""}
        contactEmail={(engagement as { participant_contact_email?: string | null }).participant_contact_email ?? ""}
        appealsNote={(engagement as { appeals_note?: string | null }).appeals_note ?? ""}
        otherMethodsRule={(engagement as { other_methods_rule?: string | null }).other_methods_rule ?? ""}
        otherMethodsNote={(engagement as { other_methods_note?: string | null }).other_methods_note ?? ""}
        externalEvidenceRule={(engagement as { external_evidence_rule?: string | null }).external_evidence_rule ?? ""}
        externalEvidenceFramework={(engagement as { external_evidence_framework?: string | null }).external_evidence_framework ?? ""}
      />
      <CentreRolesPanel
        engagementId={id}
        people={staffDirectory}
        assignments={centreRoleRows}
        competence={competenceRows}
        required={centreRolesReview.required.map((r) => ({ key: r.key, name: r.name, clause: r.clause }))}
        blocking={centreRolesReview.blocking}
        cautions={centreRolesReview.cautions}
      />
      <JoiningPackPanel
        engagementId={id}
        engagement={engagement}
        candidates={candidates}
        missing={packMissing}
      />
      <DeliveryLogPanel engagementId={id} entries={deliveryLog} candidates={candidates} />
      <ParticipantRightsPanel
        engagementId={id}
        candidates={candidates}
        exercises={exercises}
        concerns={concerns}
        reassessments={reassessments}
        disclosures={disclosures}
        agreedRecipients={(engagement as { pack_report_recipients?: string | null }).pack_report_recipients ?? null}
      />
      <ReadinessSetupPanel engagementId={id} setup={readinessSetup} />
      <CandidateFilterBar
        engagementId={id}
        candidates={candidates.map((c) => ({
          id: c.id as string,
          full_name: c.full_name as string,
        }))}
        focused={focusedCandidateId}
      />
      <RecommendedCoursesPanel
        title={
          focusedCandidate
            ? t("adminEngagements.detail.coursesTitleCandidate", { name: focusedCandidate.full_name as string })
            : t("adminEngagements.detail.coursesTitleCohort")
        }
        description={
          focusedCandidate
            ? t("adminEngagements.detail.coursesDescCandidate")
            : t("adminEngagements.detail.coursesDescCohort")
        }
        emptyMessage={
          focusedCandidate
            ? t("adminEngagements.detail.coursesEmptyCandidate", { name: focusedCandidate.full_name as string })
            : t("adminEngagements.detail.coursesEmptyCohort")
        }
        courses={recommendedCourses}
        context="ac"
      />
      {observedLens && focusedCandidate && (
        <ObservedLensPanel
          lens={observedLens}
          candidateName={focusedCandidate.full_name as string}
        />
      )}
      <TechnicalCertPanel engagementId={id} program={techProgram} />
    </div>
  );
}
