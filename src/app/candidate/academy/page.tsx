export const dynamic = "force-dynamic";

import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BackLink } from "@/components/shared/back-link";
import {
  GraduationCap,
  BookOpen,
  CheckCircle2,
  ArrowRight,
  Clock,
  Sparkles,
  Library,
} from "lucide-react";
import { VIFM_VERTICAL_LABELS } from "@/types/database";
import type { VifmVertical, VifmCourseOutlineSection } from "@/types/database";
import { recommendCoursesForAcCandidate } from "@/lib/recommender/courses";
import { EnrollButton } from "./_components/enroll-button";
import { getServerT, type ServerT } from "@/lib/i18n/server";

type Props = { searchParams: { candidateId?: string } };

type CourseLite = {
  id: string;
  code: string | null;
  title_en: string;
  title_ar: string | null;
  vertical: VifmVertical;
  level: string;
  outline_en: VifmCourseOutlineSection[] | null;
  default_duration_days: number | null;
};

type EnrollmentJoin = {
  id: string;
  course_id: string;
  status: "enrolled" | "in_progress" | "completed" | "withdrawn";
  enrolled_at: string;
  vifm_courses: CourseLite | null;
};

type EnrollmentView = {
  enrollmentId: string;
  course: CourseLite;
  status: EnrollmentJoin["status"];
  lessonCount: number;
  doneCount: number;
};

/** Empty outlines collapse to a single virtual "Overview" lesson. */
function lessonCountOf(course: CourseLite): number {
  return (course.outline_en?.length ?? 0) || 1;
}

export default async function MyLearningPage({ searchParams }: Props) {
  const t = await getServerT();
  const candidateId = searchParams.candidateId?.trim() ?? "";

  let candidateName = "";
  let engagementId: string | null = null;
  let inProgress: EnrollmentView[] = [];
  let completed: EnrollmentView[] = [];
  let enrolledCourseIds = new Set<string>();

  if (candidateId) {
    try {
      const sb = createServiceClient();

      const candRes = (await sb
        .from("candidates")
        .select("full_name, engagement_id")
        .eq("id", candidateId)
        .maybeSingle()) as {
        data: { full_name: string; engagement_id: string | null } | null;
      };
      candidateName = candRes.data?.full_name ?? "";
      engagementId = candRes.data?.engagement_id ?? null;

      const enrRes = (await sb
        .from("vifm_enrollments")
        .select(
          "id, course_id, status, enrolled_at, " +
            "vifm_courses(id, code, title_en, title_ar, vertical, level, outline_en, default_duration_days)"
        )
        .eq("candidate_id", candidateId)
        .neq("status", "withdrawn")
        .order("enrolled_at", { ascending: false })) as {
        data: EnrollmentJoin[] | null;
      };
      const enrollments = enrRes.data ?? [];
      enrolledCourseIds = new Set(enrollments.map((e) => e.course_id));

      // One round-trip for completed-lesson counts across every enrollment.
      const ids = enrollments.map((e) => e.id);
      const doneByEnrollment = new Map<string, number>();
      if (ids.length > 0) {
        const attemptsRes = (await sb
          .from("academy_lesson_attempts")
          .select("enrollment_id")
          .in("enrollment_id", ids)
          .eq("status", "completed")) as {
          data: { enrollment_id: string }[] | null;
        };
        for (const row of attemptsRes.data ?? []) {
          doneByEnrollment.set(
            row.enrollment_id,
            (doneByEnrollment.get(row.enrollment_id) ?? 0) + 1
          );
        }
      }

      for (const e of enrollments) {
        if (!e.vifm_courses) continue;
        const view: EnrollmentView = {
          enrollmentId: e.id,
          course: e.vifm_courses,
          status: e.status,
          lessonCount: lessonCountOf(e.vifm_courses),
          doneCount: doneByEnrollment.get(e.id) ?? 0,
        };
        if (e.status === "completed") completed.push(view);
        else inProgress.push(view);
      }
    } catch {
      // Tables not migrated yet - render the empty state below.
    }
  }

  // Recommendations (best-effort): gap-driven courses the learner is not
  // already enrolled in. Empty when there are no scored gaps (e.g. in dev).
  let recommendations: Awaited<
    ReturnType<typeof recommendCoursesForAcCandidate>
  > = [];
  if (candidateId && engagementId) {
    try {
      const recs = await recommendCoursesForAcCandidate({
        engagementId,
        candidateId,
        limit: 8,
      });
      recommendations = recs
        .filter((r) => !enrolledCourseIds.has(r.course_id))
        .slice(0, 4);
    } catch {
      recommendations = [];
    }
  }

  const hasEnrollments = inProgress.length > 0 || completed.length > 0;
  const skillsHref = candidateId
    ? `/candidate/skills/${candidateId}`
    : "/candidate";

  return (
    <div className="space-y-6">
      <BackLink href={skillsHref} label={t("academy.mySkills")} />

      {/* Header */}
      <div className="rounded-md border bg-gradient-to-r from-[#010131] to-[#121140] text-white p-5">
        <div className="flex flex-wrap items-center gap-3">
          <GraduationCap className="h-8 w-8 text-[#5391D5] shrink-0" />
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wide text-white/70">
              {t("academy.vifmAcademy")}
            </p>
            <h1 className="text-2xl font-bold leading-tight">{t("academy.myLearning")}</h1>
            {candidateName && (
              <p className="text-sm text-white/80 mt-0.5">{candidateName}</p>
            )}
          </div>
          <Link
            href="/courses"
            className="ms-auto inline-flex items-center gap-2 rounded-md bg-white/10 px-3 py-2 text-sm font-medium text-white hover:bg-white/20"
          >
            <Library className="h-4 w-4" />
            {t("academy.browseCatalogue")}
          </Link>
        </div>
      </div>

      {/* In progress */}
      {inProgress.length > 0 && (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            <BookOpen className="h-4 w-4 text-[#5391D5]" />
            {t("academy.inProgress")}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {inProgress.map((e) => (
              <EnrollmentCard key={e.enrollmentId} view={e} t={t} />
            ))}
          </div>
        </section>
      )}

      {/* Completed */}
      {completed.length > 0 && (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            {t("academy.completed")}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {completed.map((e) => (
              <EnrollmentCard key={e.enrollmentId} view={e} t={t} />
            ))}
          </div>
        </section>
      )}

      {/* Recommended */}
      {recommendations.length > 0 && (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            <Sparkles className="h-4 w-4 text-[#5391D5]" />
            {t("academy.recommendedForYou")}
          </h2>
          <p className="text-xs text-muted-foreground -mt-1">
            {t("academy.recommendedBlurb")}
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {recommendations.map((r) => (
              <Card key={r.course_id} className="flex flex-col">
                <CardContent className="flex flex-1 flex-col gap-3 p-4">
                  <div className="flex items-start gap-2">
                    <span className="rounded-md bg-[#5391D5]/10 p-1.5">
                      <GraduationCap className="h-4 w-4 text-[#5391D5]" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold leading-tight text-[#010131]">
                        {r.title_en}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {VIFM_VERTICAL_LABELS[r.vertical]} · {r.level}
                      </p>
                    </div>
                  </div>
                  {r.drivers[0] && (
                    <div className="flex flex-wrap gap-1">
                      {r.drivers.slice(0, 3).map((d, i) => (
                        <span
                          key={i}
                          className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
                        >
                          {d.label}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="mt-auto pt-1">
                    <EnrollButton
                      candidateId={candidateId}
                      courseId={r.course_id}
                      label={t("academy.enrollAndStart")}
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Empty state */}
      {!hasEnrollments && recommendations.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <span className="rounded-full bg-[#5391D5]/10 p-3">
              <GraduationCap className="h-7 w-7 text-[#5391D5]" />
            </span>
            <div>
              <p className="font-semibold text-[#010131]">
                {t("academy.notEnrolledTitle")}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("academy.notEnrolledBody")}
              </p>
            </div>
            <Link
              href="/courses"
              className="inline-flex items-center gap-2 rounded-md bg-[#010131] px-4 py-2 text-sm font-medium text-white hover:bg-[#121140]"
            >
              <Library className="h-4 w-4" />
              {t("academy.browseTheCatalogue")}
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/** A single enrolled-course card with a progress bar and a resume link. */
function EnrollmentCard({ view, t }: { view: EnrollmentView; t: ServerT }) {
  const { course, lessonCount, doneCount, status } = view;
  const pct =
    lessonCount > 0 ? Math.round((doneCount / lessonCount) * 100) : 0;
  const isDone = status === "completed";

  return (
    <Link
      href={`/candidate/academy/${view.enrollmentId}`}
      className="group block"
    >
      <Card className="h-full transition-colors group-hover:border-[#5391D5]">
        <CardContent className="flex h-full flex-col gap-3 p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-tight text-[#010131]">
                {course.title_en}
              </p>
              {course.title_ar && (
                <p
                  dir="rtl"
                  className="text-xs text-muted-foreground mt-0.5 truncate"
                >
                  {course.title_ar}
                </p>
              )}
              <p className="text-[11px] text-muted-foreground mt-1">
                {VIFM_VERTICAL_LABELS[course.vertical]} · {course.level}
              </p>
            </div>
            {isDone ? (
              <Badge className="shrink-0 gap-1 bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                <CheckCircle2 className="h-3 w-3" />
                {t("academy.done")}
              </Badge>
            ) : (
              <Badge variant="secondary" className="shrink-0 gap-1">
                <Clock className="h-3 w-3" />
                {pct}%
              </Badge>
            )}
          </div>

          {/* Progress bar */}
          <div className="mt-auto space-y-1.5">
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>
                {t("academy.lessonsCount", { done: doneCount, total: lessonCount })}
              </span>
              <span className="inline-flex items-center gap-1 font-medium text-[#5391D5] group-hover:underline">
                {isDone ? t("academy.review") : doneCount === 0 ? t("academy.start") : t("academy.continue")}
                <ArrowRight className="h-3 w-3" />
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full rounded-full transition-all ${
                  isDone ? "bg-emerald-500" : "bg-[#5391D5]"
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
