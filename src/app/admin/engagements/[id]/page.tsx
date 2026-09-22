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
import { DesignRecordPanel } from "./_components/design-record-panel";
import { CentreManualPanel } from "./_components/centre-manual-panel";
import { FeedbackPanel } from "./_components/feedback-panel";
import { TimetablePanel } from "./_components/timetable-panel";
import { PostCentreReviewPanel } from "./_components/post-centre-review-panel";
import { reviewSeriesConsistency, type SeriesCentre } from "@/lib/ac/series-consistency";
import { reviewTimetable } from "@/lib/ac/timetable";
import { reviewFeedback } from "@/lib/ac/feedback";
import { reviewDesignRecord } from "@/lib/ac/design-record";
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

  // The post-centre review and what people said about the centre (BPS 9.1-9.4).
  // Tolerant of migration 00221.
  const [centreReview, centreFeedback] = await Promise.all([
    supabase
      .from("ac_centre_reviews")
      .select("*")
      .eq("engagement_id", id)
      .maybeSingle()
      .then((r) => (r.data ?? null) as Record<string, unknown> | null, () => null),
    supabase
      .from("ac_centre_feedback")
      .select("id, source, author_name, went_well, could_improve, rating, submitted_at")
      .eq("engagement_id", id)
      .then((r) => (r.data ?? []) as Record<string, unknown>[], () => [] as Record<string, unknown>[]),
  ]);

  // The centre timetable (BPS 5.35). Tolerant of migration 00220.
  const slotRows = await supabase
    .from("ac_schedule_slots")
    .select("id, kind, exercise_id, candidate_id, assessor_id, starts_at, ends_at, room, note")
    .eq("engagement_id", id)
    .order("starts_at")
    .then((r) => (r.data ?? []) as Record<string, unknown>[], () => [] as Record<string, unknown>[]);

  // What each participant was told, and by whom (BPS 8.14-8.24). Tolerant of 00219.
  const feedbackRows = await supabase
    .from("ac_feedback_records")
    .select("id, candidate_id, form, delivered_at, delivered_by_name, deliverer_trained, summary, acknowledged_at")
    .eq("engagement_id", id)
    .order("delivered_at", { ascending: false })
    .then((r) => (r.data ?? []) as Record<string, unknown>[], () => [] as Record<string, unknown>[]);

  // Who holds a copy of the centre manual (BPS 4.41). Tolerant of 00218.
  const manualIssues = await supabase
    .from("ac_manual_issues")
    .select("id, variant, version, issued_to_name, issued_at, returned_at, confidential")
    .eq("engagement_id", id)
    .order("issued_at", { ascending: false })
    .then((r) => (r.data ?? []) as Record<string, unknown>[], () => [] as Record<string, unknown>[]);

  // The design record (BPS section 4): why these criteria, why these exercises.
  // Indicator counts drive the 4.20 check - a criterion with nothing concrete
  // behind it is one assessors cannot rate consistently.
  const engCompetencies = await supabase
    .from("engagement_competencies")
    .select("competency_id, weight, rationale, source, competencies(name)")
    .eq("engagement_id", id)
    .then((r) => (r.data ?? []) as Record<string, unknown>[], () => [] as Record<string, unknown>[]);

  const competencyIds = engCompetencies.map((c) => c.competency_id as string);
  const indicatorCounts = new Map<string, number>();
  if (competencyIds.length > 0) {
    const inds = await supabase
      .from("behavioral_indicators")
      .select("competency_id")
      .in("competency_id", competencyIds)
      .then((r) => (r.data ?? []) as { competency_id: string }[], () => [] as { competency_id: string }[]);
    for (const i of inds) indicatorCounts.set(i.competency_id, (indicatorCounts.get(i.competency_id) ?? 0) + 1);
  }

  const designCompetencies = engCompetencies.map((c) => {
    const comp = c.competencies as unknown as { name?: string } | { name?: string }[] | null;
    return {
      competencyId: c.competency_id as string,
      name: (Array.isArray(comp) ? comp[0]?.name : comp?.name) ?? "Unnamed criterion",
      rationale: (c.rationale as string | null) ?? null,
      source: (c.source as string | null) ?? null,
      indicatorCount: indicatorCounts.get(c.competency_id as string) ?? 0,
    };
  });

  // Role-player briefs live in role_player_prompts, one row per prompt - not on
  // the exercise. A role play with none is an exercise nobody can run.
  const exerciseIdList = exercises.map((x) => x.id as string);
  const promptCounts = new Map<string, number>();
  if (exerciseIdList.length > 0) {
    const prompts = await supabase
      .from("role_player_prompts")
      .select("exercise_id")
      .in("exercise_id", exerciseIdList)
      .then((r) => (r.data ?? []) as { exercise_id: string }[], () => [] as { exercise_id: string }[]);
    for (const p of prompts) promptCounts.set(p.exercise_id, (promptCounts.get(p.exercise_id) ?? 0) + 1);
  }

  const designReview = reviewDesignRecord({
    engagement: engagement as Record<string, string | null>,
    competencies: designCompetencies,
    exercises: exercises.map((x) => ({
      id: x.id as string,
      name: x.name as string,
      exerciseType: (x.exercise_type as string | null) ?? null,
      durationMinutes: (x.duration_minutes as number | null) ?? null,
      rolePlayerPromptCount: promptCounts.get(x.id as string) ?? 0,
    })),
    matrix: matrix.map((m) => ({
      exerciseId: m.exercise_id as string,
      competencyId: m.competency_id as string,
    })),
  });

  // What the joining pack still lacks (BPS 5.41). Computed from the same
  // builder the participant's copy uses, so the checklist and the pack can
  // never disagree about what is missing.
  const packMissing = buildJoiningPack(engagement as PackEngagement, exercises as unknown as PackExercise[]).missing;

  // Technical certification program for this engagement (paid org layer).
  const techProgram = await getEngagementTechProgram(id, await getServerLocale());

  // Succession Readiness setup (combined-mode wiring + per-candidate status).
  const readinessSetup = await loadReadinessSetup(id);

  // Consistency across a declared series (BPS 5.19). Only runs when this centre
  // has been put in one, because comparing centres never meant to match would
  // be worse than not comparing at all.
  const seriesName = (engagement as { series_name?: string | null }).series_name ?? null;
  let seriesConsistency: ReturnType<typeof reviewSeriesConsistency> | null = null;
  if (seriesName) {
    const siblings = await supabase
      .from("engagements")
      .select("id, name, start_date, purpose, integration_method, other_methods_rule, external_evidence_rule")
      .eq("series_name", seriesName)
      .then((r) => (r.data ?? []) as Record<string, unknown>[], () => [] as Record<string, unknown>[]);
    const ids = siblings.map((x) => x.id as string);
    const [sibComps, sibExercises, sibReviews] = await Promise.all([
      supabase
        .from("engagement_competencies")
        .select("engagement_id, weight, competency_id, competencies(name)")
        .in("engagement_id", ids)
        .then((r) => (r.data ?? []) as Record<string, unknown>[], () => [] as Record<string, unknown>[]),
      supabase
        .from("engagement_exercises")
        .select("engagement_id, exercise_id, exercises(name)")
        .in("engagement_id", ids)
        .then((r) => (r.data ?? []) as Record<string, unknown>[], () => [] as Record<string, unknown>[]),
      supabase
        .from("ac_centre_reviews")
        .select("engagement_id")
        .in("engagement_id", ids)
        .then((r) => (r.data ?? []) as Record<string, unknown>[], () => [] as Record<string, unknown>[]),
    ]);
    const reviewed = new Set(sibReviews.map((r) => r.engagement_id as string));
    const centres: SeriesCentre[] = siblings.map((e) => {
      const comps = sibComps.filter((c) => c.engagement_id === e.id);
      const exs = sibExercises.filter((x) => x.engagement_id === e.id);
      const nameOf = (row: unknown) => {
        const c = row as { name?: string } | { name?: string }[] | null;
        return (Array.isArray(c) ? c[0]?.name : c?.name) ?? "Unnamed";
      };
      return {
        engagementId: e.id as string,
        name: e.name as string,
        startDate: (e.start_date as string | null) ?? null,
        purpose: (e.purpose as string | null) ?? null,
        integrationMethod: (e.integration_method as string | null) ?? null,
        otherMethodsRule: (e.other_methods_rule as string | null) ?? null,
        externalEvidenceRule: (e.external_evidence_rule as string | null) ?? null,
        competencies: comps.map((c) => ({
          id: c.competency_id as string,
          name: nameOf(c.competencies),
          weight: (c.weight as number | null) ?? null,
        })),
        exerciseIds: exs.map((x) => x.exercise_id as string),
        exerciseNames: exs.map((x) => nameOf(x.exercises)),
        hasReview: reviewed.has(e.id as string),
      };
    });
    seriesConsistency = reviewSeriesConsistency(centres);
  }

  // 5.35.5 is the clause worth checking: a person in two rooms at once, or a
  // participant running for hours with no break, is what a hand-built
  // timetable gets wrong.
  const timetableReview = reviewTimetable({
    slots: slotRows.map((s) => ({
      id: s.id as string,
      kind: s.kind as "exercise" | "briefing" | "break" | "lunch" | "washup" | "feedback" | "other",
      exerciseId: (s.exercise_id as string | null) ?? null,
      exerciseName:
        (exercises.find((x) => x.id === s.exercise_id)?.name as string | undefined) ?? null,
      candidateId: (s.candidate_id as string | null) ?? null,
      candidateName:
        (candidates.find((c) => c.id === s.candidate_id)?.full_name as string | undefined) ?? null,
      assessorId: (s.assessor_id as string | null) ?? null,
      assessorName: (() => {
        const p = staffDirectory.find((x) => x.id === s.assessor_id);
        return (p?.full_name as string) ?? (p?.email as string) ?? null;
      })(),
      startsAt: s.starts_at as string,
      endsAt: s.ends_at as string,
      room: (s.room as string | null) ?? null,
      note: (s.note as string | null) ?? null,
    })),
    participants: candidates.map((c) => ({ id: c.id as string, name: c.full_name as string })),
    assessors: assessors.map((a) => ({
      id: a.id as string,
      name: (a.full_name as string) ?? (a.email as string) ?? "Unnamed",
    })),
    designExercises: exercises.map((x) => ({ id: x.id as string, name: x.name as string })),
  });

  // Feedback is owed once a participant has a finalised result, so the review
  // needs to know who has one. Read here rather than reusing currentOarMap,
  // which is only populated for a re-engagement.
  const ratedIds = await supabase
    .from("overall_assessment_ratings")
    .select("candidate_id")
    .eq("engagement_id", id)
    .then(
      (r) => new Set(((r.data ?? []) as { candidate_id: string }[]).map((x) => x.candidate_id)),
      () => new Set<string>()
    );
  const feedbackReview = reviewFeedback({
    purpose: (engagement as { purpose?: string | null }).purpose ?? null,
    centreEndDate: (engagement as { end_date?: string | null }).end_date ?? null,
    participants: candidates.map((c) => ({
      candidateId: c.id as string,
      name: c.full_name as string,
      rated: ratedIds.has(c.id as string),
    })),
    records: feedbackRows.map((f) => ({
      candidateId: f.candidate_id as string,
      form: f.form as "written_report" | "oral" | "both",
      deliveredAt: f.delivered_at as string,
      deliveredByName: f.delivered_by_name as string,
      delivererTrained: Boolean(f.deliverer_trained),
      hasSummary: Boolean(f.summary),
      acknowledgedAt: (f.acknowledged_at as string | null) ?? null,
    })),
  });

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
        groupingRationale={(engagement as { grouping_rationale?: string | null }).grouping_rationale ?? ""}
      />
      <DesignRecordPanel
        engagementId={id}
        engagement={engagement}
        review={designReview}
        competencies={designCompetencies.map((c) => ({
          competencyId: c.competencyId,
          name: c.name,
          rationale: c.rationale,
        }))}
      />
      <PostCentreReviewPanel
        engagementId={id}
        review={centreReview}
        feedback={centreFeedback}
        seriesName={seriesName ?? ""}
        seriesNote={(engagement as { series_note?: string | null }).series_note ?? ""}
        consistency={seriesConsistency}
      />
      <TimetablePanel
        engagementId={id}
        slots={slotRows}
        review={timetableReview}
        candidates={candidates}
        assessors={assessors}
        exercises={exercises}
      />
      <FeedbackPanel
        engagementId={id}
        candidates={candidates}
        records={feedbackRows}
        review={feedbackReview}
      />
      <CentreManualPanel
        engagementId={id}
        engagement={engagement}
        issues={manualIssues}
        staffedRoles={centreRoleRows.map((r) => {
          const p = staffDirectory.find((x) => x.id === r.profile_id);
          return {
            roleKey: r.role_key as string,
            profileId: r.profile_id as string,
            name: (p?.full_name as string) ?? (p?.email as string) ?? "Unnamed",
            email: (p?.email as string) ?? null,
          };
        })}
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
      <div className="text-sm">
        <a
          href={`/admin/engagements/${id}/fairness`}
          className="inline-flex items-center gap-1 text-accent hover:underline"
        >
          Fairness monitoring for this centre
        </a>
        <span className="ms-2 text-xs text-muted-foreground">
          Whether outcomes fell differently on any group (BPS 3.19, 4.22).
        </span>
      </div>
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
