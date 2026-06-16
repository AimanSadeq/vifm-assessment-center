export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { requireCandidateAccessOrNotFound } from "@/lib/auth/candidate-access";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BackLink } from "@/components/shared/back-link";
import {
  BookOpen,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Award,
} from "lucide-react";
import {
  indexFromLessonKey,
  lessonKeyFor,
} from "@/lib/academy/lesson-key";
import type {
  QuizAnswer,
  QuizQuestion,
  VifmCourseOutlineSection,
} from "@/types/database";
import { LessonKnowledgeCheck } from "./_components/lesson-knowledge-check";
import { StartCheckButton } from "./_components/start-check-button";
import { getServerT, type ServerT } from "@/lib/i18n/server";

type Props = { params: { enrollmentId: string; lessonKey: string } };

type EnrollmentRow = {
  id: string;
  candidate_id: string;
  course_id: string;
};

type CourseRow = {
  id: string;
  title_en: string;
  title_ar: string | null;
  overview_en: string | null;
  overview_ar: string | null;
  objectives_en: string[] | null;
  outline_en: VifmCourseOutlineSection[] | null;
};

type AttemptRow = {
  id: string;
  status: "in_progress" | "completed" | "abandoned";
  questions: QuizQuestion[];
  answers: QuizAnswer[];
  score_pct: number | null;
  correct_count: number | null;
  total_count: number;
  passing_score_pct: number;
};

export default async function AcademyLessonPage({ params }: Props) {
  const { enrollmentId, lessonKey } = params;
  const t = await getServerT();

  let enrollment: EnrollmentRow | null = null;
  let course: CourseRow | null = null;
  let attempt: AttemptRow | null = null;

  try {
    const sb = createServiceClient();

    const enrRes = (await sb
      .from("vifm_enrollments")
      .select("id, candidate_id, course_id")
      .eq("id", enrollmentId)
      .maybeSingle()) as { data: EnrollmentRow | null };
    enrollment = enrRes.data;

    if (enrollment) {
      const courseRes = (await sb
        .from("vifm_courses")
        .select(
          "id, title_en, title_ar, overview_en, overview_ar, objectives_en, outline_en"
        )
        .eq("id", enrollment.course_id)
        .maybeSingle()) as { data: CourseRow | null };
      course = courseRes.data;

      const attRes = (await sb
        .from("academy_lesson_attempts")
        .select(
          "id, status, questions, answers, score_pct, correct_count, total_count, passing_score_pct"
        )
        .eq("enrollment_id", enrollmentId)
        .eq("lesson_key", lessonKey)
        .maybeSingle()) as { data: AttemptRow | null };
      attempt = attRes.data;
    }
  } catch {
    // Tables not migrated yet - fall through to notFound below if no data.
  }

  if (!enrollment || !course) return notFound();

  // Ownership is keyed off the enrollment's candidate, resolved above.
  await requireCandidateAccessOrNotFound(enrollment.candidate_id);

  const outline = course.outline_en ?? [];
  const hasOutline = outline.length > 0;
  const idx = indexFromLessonKey(lessonKey);

  // Resolve the section. Empty-outline courses use a single virtual lesson
  // ("Overview") rendered from overview_en.
  const section = hasOutline && idx >= 0 && idx < outline.length ? outline[idx] : null;
  if (hasOutline && !section) return notFound();

  const lessonTitle = section?.main_header ?? t("academy.lesson.overview");
  const lessonCount = Math.max(1, outline.length);
  const lessonNumber = hasOutline ? idx + 1 : 1;
  const isLast = lessonNumber >= lessonCount;

  // Next / previous lesson keys for navigation.
  const nextLessonKey =
    hasOutline && idx + 1 < outline.length
      ? lessonKeyFor(outline[idx + 1].main_header, idx + 1)
      : null;
  const prevLessonKey =
    hasOutline && idx - 1 >= 0
      ? lessonKeyFor(outline[idx - 1].main_header, idx - 1)
      : null;

  const passed =
    attempt?.status === "completed" &&
    (attempt.score_pct ?? 0) >= attempt.passing_score_pct;

  return (
    <div className="space-y-6">
      <BackLink href={`/candidate/academy/${enrollmentId}`} label={t("academy.lesson.backToCourse")} />

      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          {course.title_en} · {t("academy.lesson.lessonOf", { n: lessonNumber, total: lessonCount })}
        </p>
        <h1 className="mt-1 text-2xl font-bold text-[#010131]">{lessonTitle}</h1>
        {section ? null : course.overview_ar ? (
          <p dir="rtl" className="mt-1 text-sm text-muted-foreground">
            {course.overview_ar}
          </p>
        ) : null}
      </div>

      {/* Lesson content */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-[#5391D5]" />
            {t("academy.lesson.lessonContent")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {section ? (
            <OutlineSectionBody section={section} t={t} />
          ) : (
            <div className="space-y-3">
              {course.overview_en && (
                <p className="text-sm leading-relaxed text-foreground/90">
                  {course.overview_en}
                </p>
              )}
              {(course.objectives_en ?? []).length > 0 && (
                <ul className="space-y-1.5">
                  {(course.objectives_en ?? []).map((o, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-[#5391D5] shrink-0 mt-0.5" />
                      <span>{o}</span>
                    </li>
                  ))}
                </ul>
              )}
              {!course.overview_en && (course.objectives_en ?? []).length === 0 && (
                <p className="text-sm text-muted-foreground">
                  {t("academy.lesson.noContent")}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Knowledge check */}
      <div>
        <h2 className="text-lg font-semibold text-[#010131] mb-3">{t("academy.lesson.knowledgeCheck")}</h2>

        {!attempt && (
          <Card>
            <CardContent className="p-6 flex flex-col items-start gap-3">
              <p className="text-sm text-muted-foreground max-w-xl">
                {t("academy.lesson.checkIntro", { pct: Math.round(70) })}
              </p>
              <StartCheckButton enrollmentId={enrollmentId} lessonKey={lessonKey} />
            </CardContent>
          </Card>
        )}

        {attempt?.status === "in_progress" && (
          <LessonKnowledgeCheck
            attemptId={attempt.id}
            enrollmentId={enrollmentId}
            lessonTitle={lessonTitle}
            questions={attempt.questions}
            initialAnswers={attempt.answers}
            passingScorePct={Number(attempt.passing_score_pct)}
            nextLessonKey={nextLessonKey}
          />
        )}

        {attempt && attempt.status !== "in_progress" && (
          <Card>
            <CardContent className="p-6 space-y-4">
              <div
                className="rounded-md border p-4 flex items-center gap-3"
                style={{
                  backgroundColor: passed ? "#ecfdf5" : "#fef2f2",
                  borderColor: passed ? "#a7f3d0" : "#fecaca",
                }}
              >
                {passed ? (
                  <CheckCircle2 className="h-6 w-6 text-emerald-700 shrink-0" />
                ) : (
                  <BookOpen className="h-6 w-6 text-rose-700 shrink-0" />
                )}
                <div>
                  <p
                    className="text-lg font-bold"
                    style={{ color: passed ? "#047857" : "#b91c1c" }}
                  >
                    {passed ? t("academy.lesson.lessonPassed") : t("academy.lesson.notPassedYet")}
                  </p>
                  <p
                    className="text-sm"
                    style={{ color: passed ? "#047857" : "#b91c1c", opacity: 0.85 }}
                  >
                    {t("academy.lesson.scoreLine", {
                      pct: Math.round(attempt.score_pct ?? 0),
                      correct: attempt.correct_count ?? 0,
                      total: attempt.total_count,
                      passing: Math.round(attempt.passing_score_pct),
                    })}
                  </p>
                </div>
              </div>

              {/* Review with explanations */}
              <div className="space-y-3">
                {attempt.questions.map((qq, i) => {
                  const picked = attempt!.answers[i]?.picked_index;
                  const correct = picked === qq.correct_index;
                  return (
                    <div key={qq.id} className="rounded-md border p-3 space-y-1.5">
                      <div className="flex items-center gap-2">
                        {correct ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                        ) : (
                          <span className="h-4 w-4 rounded-full bg-rose-100 text-rose-700 text-[10px] grid place-items-center shrink-0">
                            ×
                          </span>
                        )}
                        <p className="text-sm font-medium">{qq.prompt_en}</p>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed ps-6">
                        {qq.explanation_en}
                      </p>
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <StartCheckButton enrollmentId={enrollmentId} lessonKey={lessonKey} />
                {prevLessonKey && (
                  <Link
                    href={`/candidate/academy/${enrollmentId}/lesson/${prevLessonKey}`}
                  >
                    <Button variant="ghost" className="gap-1.5">
                      <ArrowLeft className="h-4 w-4" />
                      {t("academy.lesson.previousLesson")}
                    </Button>
                  </Link>
                )}
                {!isLast && nextLessonKey ? (
                  <Link
                    href={`/candidate/academy/${enrollmentId}/lesson/${nextLessonKey}`}
                    className="ms-auto"
                  >
                    <Button className="gap-1.5 bg-[#5391D5] hover:bg-[#4380c4]">
                      {t("academy.lesson.nextLesson")}
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                ) : (
                  <Link href={`/candidate/academy/${enrollmentId}`} className="ms-auto">
                    <Button className="gap-1.5 bg-[#010131] hover:bg-[#111232]">
                      <Award className="h-4 w-4" />
                      {t("academy.lesson.finishCourse")}
                    </Button>
                  </Link>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {attempt && attempt.status !== "in_progress" && (
          <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Badge variant="outline">{t("academy.lesson.tip")}</Badge>
            <span>
              {t("academy.lesson.retakeTip")}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

/** Renders one outline section's body, recursing into nested bullets. */
function OutlineSectionBody({ section, t }: { section: VifmCourseOutlineSection; t: ServerT }) {
  const flatBullets = section.bullets ?? [];
  const subsections = section.subsections ?? [];

  if (flatBullets.length === 0 && subsections.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {t("academy.lesson.reviewTopic")}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {flatBullets.length > 0 && (
        <ul className="space-y-1.5">
          {flatBullets.map((b, i) => (
            <li key={i} className="space-y-1.5">
              <div className="flex items-start gap-2 text-sm">
                <span className="mt-2 h-1.5 w-1.5 rounded-full bg-[#5391D5] shrink-0" />
                <span>{b.text}</span>
              </div>
              {(b.sub_bullets ?? []).length > 0 && (
                <ul className="ms-6 space-y-1">
                  {(b.sub_bullets ?? []).map((sb, j) => (
                    <li key={j} className="flex items-start gap-2 text-xs text-muted-foreground">
                      <span className="mt-1.5 h-1 w-1 rounded-full bg-muted-foreground/60 shrink-0" />
                      <span>{sb}</span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}

      {subsections.map((sub, i) => (
        <div key={i} className="space-y-1.5">
          <p className="text-sm font-semibold text-foreground">{sub.sub_header}</p>
          <ul className="space-y-1.5">
            {sub.bullets.map((b, j) => (
              <li key={j} className="space-y-1.5">
                <div className="flex items-start gap-2 text-sm">
                  <span className="mt-2 h-1.5 w-1.5 rounded-full bg-[#5391D5] shrink-0" />
                  <span>{b.text}</span>
                </div>
                {(b.sub_bullets ?? []).length > 0 && (
                  <ul className="ms-6 space-y-1">
                    {(b.sub_bullets ?? []).map((sb, k) => (
                      <li
                        key={k}
                        className="flex items-start gap-2 text-xs text-muted-foreground"
                      >
                        <span className="mt-1.5 h-1 w-1 rounded-full bg-muted-foreground/60 shrink-0" />
                        <span>{sb}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
