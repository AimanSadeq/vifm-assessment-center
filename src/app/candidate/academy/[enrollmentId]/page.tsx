export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BackLink } from "@/components/shared/back-link";
import {
  BookOpen,
  CheckCircle2,
  ArrowRight,
  GraduationCap,
  Award,
  Lock,
} from "lucide-react";
import { lessonKeyFor } from "@/lib/academy/lesson-key";
import { VIFM_VERTICAL_LABELS } from "@/types/database";
import type { VifmCourse, VifmCourseOutlineSection } from "@/types/database";
import { CompleteCourseButton } from "../_components/complete-course-button";

type Props = { params: { enrollmentId: string } };

type EnrollmentRow = {
  id: string;
  candidate_id: string;
  course_id: string;
  status: "enrolled" | "in_progress" | "completed" | "withdrawn";
};

export default async function AcademyCoursePage({ params }: Props) {
  const { enrollmentId } = params;

  let enrollment: EnrollmentRow | null = null;
  let course: VifmCourse | null = null;
  let completedKeys = new Set<string>();
  let credentialCode: string | null = null;

  try {
    const sb = createServiceClient();

    const enrRes = (await sb
      .from("vifm_enrollments")
      .select("id, candidate_id, course_id, status")
      .eq("id", enrollmentId)
      .maybeSingle()) as { data: EnrollmentRow | null };
    enrollment = enrRes.data;

    if (enrollment) {
      const courseRes = (await sb
        .from("vifm_courses")
        .select("*")
        .eq("id", enrollment.course_id)
        .maybeSingle()) as { data: VifmCourse | null };
      course = courseRes.data;

      const attemptsRes = (await sb
        .from("academy_lesson_attempts")
        .select("lesson_key, status")
        .eq("enrollment_id", enrollmentId)
        .eq("status", "completed")) as {
        data: { lesson_key: string; status: string }[] | null;
      };
      completedKeys = new Set((attemptsRes.data ?? []).map((r) => r.lesson_key));

      // Surface an already-issued credential, if any.
      const credRes = await sb
        .from("vifm_credentials")
        .select("verification_code")
        .eq("source_id", enrollmentId)
        .eq("credential_type", "academy_completion")
        .maybeSingle();
      credentialCode = (credRes.data?.verification_code as string | undefined) ?? null;
    }
  } catch {
    // Tables not migrated yet - fall through to notFound below.
  }

  if (!enrollment || !course) return notFound();

  const outline = course.outline_en ?? [];
  const hasOutline = outline.length > 0;

  // Build the lesson list. Empty-outline courses collapse to a single virtual
  // "Overview" lesson (keyed off "Overview" at index 0).
  type LessonNav = {
    key: string;
    title: string;
    titleAr: string | null;
    index: number;
    done: boolean;
  };
  const lessons: LessonNav[] = hasOutline
    ? outline.map((s, i) => ({
        key: lessonKeyFor(s.main_header, i),
        title: s.main_header,
        titleAr: course!.outline_ar?.[i]?.main_header ?? null,
        index: i,
        done: completedKeys.has(lessonKeyFor(s.main_header, i)),
      }))
    : [
        {
          key: lessonKeyFor("Overview", 0),
          title: "Overview",
          titleAr: null,
          index: 0,
          done: completedKeys.has(lessonKeyFor("Overview", 0)),
        },
      ];

  const doneCount = lessons.filter((l) => l.done).length;
  const allComplete = doneCount >= lessons.length;
  const pct = lessons.length > 0 ? Math.round((doneCount / lessons.length) * 100) : 0;
  const firstUnfinished = lessons.find((l) => !l.done) ?? lessons[0];

  return (
    <div className="space-y-6">
      <BackLink href={`/candidate/academy?candidateId=${enrollment.candidate_id}`} label="My Learning" />

      {/* Header */}
      <div className="rounded-md border bg-gradient-to-r from-[#010131] to-[#121140] text-white p-5">
        <div className="flex flex-wrap items-start gap-3">
          <GraduationCap className="h-8 w-8 text-[#5391D5] shrink-0" />
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wide text-white/70">
              {VIFM_VERTICAL_LABELS[course.vertical]} · {course.level}
            </p>
            <h1 className="text-2xl font-bold leading-tight">{course.title_en}</h1>
            {course.title_ar && (
              <p dir="rtl" className="text-sm text-white/80 mt-0.5">
                {course.title_ar}
              </p>
            )}
          </div>
          {enrollment.status === "completed" && (
            <Badge className="bg-emerald-500/20 text-emerald-100 border-emerald-300/30 gap-1 ms-auto">
              <CheckCircle2 className="h-3 w-3" />
              Completed
            </Badge>
          )}
        </div>

        {/* Progress bar */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs text-white/80 mb-1">
            <span>
              {doneCount} of {lessons.length} lessons complete
            </span>
            <span className="tabular-nums">{pct}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-white/15 overflow-hidden">
            <div
              className="h-full rounded-full bg-[#5391D5] transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Course content blocks */}
        <div className="lg:col-span-2 space-y-5">
          {course.overview_en && (
            <ContentBlock title="Course overview">
              <p className="text-sm leading-relaxed text-foreground/90">
                {course.overview_en}
              </p>
              {course.overview_ar && (
                <p dir="rtl" className="text-sm leading-relaxed text-muted-foreground mt-2">
                  {course.overview_ar}
                </p>
              )}
            </ContentBlock>
          )}

          {(course.objectives_en ?? []).length > 0 && (
            <ContentBlock title="Course objectives">
              <ul className="space-y-1.5">
                {(course.objectives_en ?? []).map((o, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-[#5391D5] shrink-0 mt-0.5" />
                    <span>{o}</span>
                  </li>
                ))}
              </ul>
            </ContentBlock>
          )}

          {course.audience_en && (
            <ContentBlock title="Who this is for">
              <p className="text-sm leading-relaxed text-foreground/90">
                {course.audience_en}
              </p>
              {course.audience_ar && (
                <p dir="rtl" className="text-sm leading-relaxed text-muted-foreground mt-2">
                  {course.audience_ar}
                </p>
              )}
            </ContentBlock>
          )}

          {course.methodology_en && (
            <ContentBlock title="How you will learn">
              <p className="text-sm leading-relaxed text-foreground/90">
                {course.methodology_en}
              </p>
            </ContentBlock>
          )}

          {hasOutline && (
            <ContentBlock title="Course outline">
              <ol className="space-y-3">
                {outline.map((s, i) => (
                  <li key={i} className="rounded-md border p-3">
                    <p className="text-sm font-semibold text-[#010131]">
                      {i + 1}. {s.main_header}
                    </p>
                    <OutlinePreview section={s} />
                  </li>
                ))}
              </ol>
            </ContentBlock>
          )}
        </div>

        {/* Progress / lesson nav */}
        <div className="space-y-4">
          <Card className="sticky top-4">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-[#5391D5]" />
                Course progress
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {lessons.map((l) => (
                <Link
                  key={l.key}
                  href={`/candidate/academy/${enrollmentId}/lesson/${l.key}`}
                  className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors ${
                    l.done
                      ? "border-emerald-200 bg-emerald-50/60 hover:bg-emerald-50"
                      : "hover:bg-muted/40"
                  }`}
                >
                  {l.done ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  ) : (
                    <span className="h-4 w-4 rounded-full border-2 border-muted-foreground/40 shrink-0" />
                  )}
                  <span className="min-w-0">
                    <span className="block truncate font-medium">
                      {l.index + 1}. {l.title}
                    </span>
                    {l.titleAr && (
                      <span dir="rtl" className="block truncate text-[11px] text-muted-foreground">
                        {l.titleAr}
                      </span>
                    )}
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground ms-auto shrink-0" />
                </Link>
              ))}

              {/* Primary CTA */}
              <div className="pt-2">
                {allComplete ? (
                  <CompleteCourseButton
                    enrollmentId={enrollmentId}
                    alreadyCompleted={enrollment.status === "completed"}
                    initialVerificationCode={credentialCode}
                  />
                ) : (
                  <Link
                    href={`/candidate/academy/${enrollmentId}/lesson/${firstUnfinished.key}`}
                    className="block"
                  >
                    <div className="flex items-center justify-center gap-2 rounded-md bg-[#5391D5] px-4 py-2 text-sm font-medium text-white hover:bg-[#4380c4]">
                      {doneCount === 0 ? "Start first lesson" : "Continue learning"}
                      <ArrowRight className="h-4 w-4" />
                    </div>
                  </Link>
                )}
              </div>

              {!allComplete && (
                <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground pt-1">
                  <Lock className="h-3 w-3" />
                  Complete every lesson to earn your credential.
                </p>
              )}
              {allComplete && enrollment.status !== "completed" && (
                <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground pt-1">
                  <Award className="h-3 w-3 text-[#5391D5]" />
                  All lessons done - claim your credential.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function ContentBlock({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base text-[#010131]">{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

/** Compact preview of an outline section's first few bullets. */
function OutlinePreview({ section }: { section: VifmCourseOutlineSection }) {
  const texts: string[] = [];
  for (const b of section.bullets ?? []) {
    if (b.text) texts.push(b.text);
  }
  for (const sub of section.subsections ?? []) {
    if (sub.sub_header) texts.push(sub.sub_header);
  }
  const shown = texts.slice(0, 4);
  if (shown.length === 0) return null;
  return (
    <ul className="mt-1.5 space-y-1">
      {shown.map((t, i) => (
        <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
          <span className="mt-1.5 h-1 w-1 rounded-full bg-muted-foreground/50 shrink-0" />
          <span>{t}</span>
        </li>
      ))}
      {texts.length > shown.length && (
        <li className="text-[11px] text-muted-foreground/70 ps-3">
          + {texts.length - shown.length} more
        </li>
      )}
    </ul>
  );
}
