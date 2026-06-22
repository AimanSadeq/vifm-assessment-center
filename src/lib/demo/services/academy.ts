// Demo-data module for VIFM Academy (learning delivery).
//
// Academy rows are not org-scoped directly: an enrollment hangs off a
// candidate (which hangs off an engagement of the demo org) + a course (one of
// the 127 catalogue rows). So this module is downstream of the Assessment
// Center seeder - it finds a demo candidate (a candidates row under an
// engagement of org.organizationId) and a vifm_courses row, then enrolls them.
//
// Tolerant: if the AC seeder has not run (no demo candidate) or the catalogue is
// empty (no courses), it returns created 0 with a note. Idempotent: a count
// check on the demo candidates' enrollments short-circuits a re-seed.

import type { DemoServiceModule, DemoSb, DemoOrgIds } from "./types";
import type { DemoSeedOutcome, DemoServiceCount } from "../constants";

const SERVICE = "academy";
const LABEL = "VIFM Academy";

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

/** Candidate ids for candidates under an engagement of the demo org. */
async function demoCandidateIds(sb: DemoSb, orgId: string): Promise<string[]> {
  const engRes = await sb.from("engagements").select("id").eq("organization_id", orgId);
  const engIds = ((engRes.data ?? []) as { id: string }[]).map((r) => r.id);
  if (engIds.length === 0) return [];
  const candRes = await sb.from("candidates").select("id").in("engagement_id", engIds);
  return ((candRes.data ?? []) as { id: string }[]).map((r) => r.id);
}

/** One representative completed lesson attempt so the credential pass-gate is met
 *  (markEnrollmentComplete needs every outline lesson passed). The questions /
 *  answers JSONB mirror the G3 quiz engine shape just enough to render. */
function lessonAttemptRows(
  enrollmentId: string,
  candidateId: string,
  courseId: string,
  outline: unknown[] | null
): Record<string, unknown>[] {
  const sections = (outline ?? []).length > 0 ? (outline as { title?: string }[]) : [{ title: "Overview" }];
  return sections.map((section, i) => {
    const title = section?.title ?? `Section ${i + 1}`;
    const questions = [
      {
        id: `q${i}-1`,
        type: "multiple_choice",
        difficulty: "medium",
        prompt_en: `Which of the following best reflects the key takeaway of "${title}"?`,
        options_en: ["A targeted, evidence-based practice", "An unrelated control", "A deprecated approach", "None of the above"],
        correct_index: 0,
        explanation_en: "The section emphasises applying the practice in a GCC finance context.",
      },
      {
        id: `q${i}-2`,
        type: "true_false",
        difficulty: "easy",
        prompt_en: `"${title}" is intended to be applied on the job, not only in theory.`,
        options_en: ["True", "False"],
        correct_index: 0,
        explanation_en: "Academy lessons are workplace-applied by design.",
      },
    ];
    const answers = questions.map((q) => ({ question_id: q.id, selected_index: q.correct_index, correct: true }));
    return {
      enrollment_id: enrollmentId,
      candidate_id: candidateId,
      course_id: courseId,
      lesson_key: `${i}-lesson`,
      status: "completed",
      questions,
      answers,
      score_pct: 90,
      correct_count: questions.length,
      total_count: questions.length,
      passing_score_pct: 70,
      time_taken_seconds: 240,
      started_at: daysAgo(5),
      completed_at: daysAgo(5),
    };
  });
}

const mod: DemoServiceModule = {
  id: SERVICE,
  label: LABEL,

  async seed(sb: DemoSb, org: DemoOrgIds): Promise<DemoSeedOutcome> {
    const candIds = await demoCandidateIds(sb, org.organizationId);
    if (candIds.length === 0) {
      return { service: SERVICE, label: LABEL, created: 0, note: "no demo candidate yet (seed Assessment Center first)" };
    }

    // Idempotent: any enrollment for a demo candidate means we have already run.
    const existing = await sb.from("vifm_enrollments").select("id").in("candidate_id", candIds).limit(1);
    if (existing.error) {
      // Table missing (un-applied migration) or other hard failure.
      throw new Error(`Academy enrollments: ${existing.error.message}`);
    }
    if (existing.data && existing.data.length > 0) {
      return { service: SERVICE, label: LABEL, created: 0, note: "already present" };
    }

    // Pick up to two active courses from the catalogue (127 exist).
    const courseRes = await sb
      .from("vifm_courses")
      .select("id, title_en, outline_en")
      .eq("is_active", true)
      .limit(2);
    const courses = (courseRes.data ?? []) as { id: string; title_en: string; outline_en: unknown[] | null }[];
    if (courses.length === 0) {
      return { service: SERVICE, label: LABEL, created: 0, note: "no courses in catalogue to enrol into" };
    }

    const candidateId = candIds[0];

    // Enrollment 1: completed (so the certificate / credential screen has data).
    const e1 = await sb
      .from("vifm_enrollments")
      .insert({
        candidate_id: candidateId,
        course_id: courses[0].id,
        source: "recommender",
        status: "completed",
        enrolled_at: daysAgo(6),
        started_at: daysAgo(5),
        completed_at: daysAgo(4),
      })
      .select("id")
      .single();
    if (e1.error || !e1.data) throw new Error(`Academy enrollment 1: ${e1.error?.message}`);

    // Lesson attempts so "completed" is backed by passed knowledge-checks.
    const attempts = lessonAttemptRows(e1.data.id as string, candidateId, courses[0].id, courses[0].outline_en);
    const at = await sb.from("academy_lesson_attempts").insert(attempts);
    if (at.error) throw new Error(`Academy lesson attempts: ${at.error.message}`);

    let created = 1;
    // Enrollment 2 (optional second course): in_progress, so "My Learning" shows a mix.
    if (courses[1]) {
      const e2 = await sb.from("vifm_enrollments").insert({
        candidate_id: candidateId,
        course_id: courses[1].id,
        source: "self",
        status: "in_progress",
        enrolled_at: daysAgo(3),
        started_at: daysAgo(2),
      });
      if (!e2.error) created += 1;
    }

    return {
      service: SERVICE,
      label: LABEL,
      created,
      note: `${created} enrollment(s) for a demo candidate (1 completed + ${attempts.length} lesson check(s)${created > 1 ? ", 1 in progress" : ""})`,
    };
  },

  async purge(sb: DemoSb, org: DemoOrgIds): Promise<string> {
    const candIds = await demoCandidateIds(sb, org.organizationId);
    if (candIds.length === 0) return "no demo candidates (nothing to purge)";

    // Enrollment ids for the demo candidates - the FK anchor for everything.
    const enrRes = await sb.from("vifm_enrollments").select("id").in("candidate_id", candIds);
    const enrIds = ((enrRes.data ?? []) as { id: string }[]).map((r) => r.id);

    // Children first. academy_lesson_attempts FK enrollment_id (and would cascade
    // anyway, but be explicit + FK-safe). vifm_credentials.source_id is untyped
    // (not a FK), so delete the Academy credentials we issued by candidate + type.
    if (enrIds.length) await sb.from("academy_lesson_attempts").delete().in("enrollment_id", enrIds);
    await sb.from("vifm_credentials").delete().in("candidate_id", candIds).eq("credential_type", "academy_completion");
    if (enrIds.length) await sb.from("vifm_enrollments").delete().in("id", enrIds);

    return `enrollments removed (${enrIds.length})`;
  },

  async count(sb: DemoSb, org: DemoOrgIds): Promise<DemoServiceCount | null> {
    try {
      const candIds = await demoCandidateIds(sb, org.organizationId);
      if (candIds.length === 0) return { service: SERVICE, label: LABEL, count: 0 };
      const res = await sb
        .from("vifm_enrollments")
        .select("id", { count: "exact", head: true })
        .in("candidate_id", candIds);
      if (res.error) return null; // table missing / un-applied migration
      return { service: SERVICE, label: LABEL, count: res.count ?? 0 };
    } catch {
      return null;
    }
  },
};

export default mod;
