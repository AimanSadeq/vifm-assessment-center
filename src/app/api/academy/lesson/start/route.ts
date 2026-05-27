/**
 * Academy lesson knowledge-check start. POST { enrollmentId, lessonKey }.
 *
 * Resolves the lesson section from the course outline, asks the shared
 * quiz-generator for ~5 grounded questions about that lesson, and inserts
 * one academy_lesson_attempts row (status in_progress). Idempotent on
 * (enrollment_id, lesson_key): a re-POST returns the existing attempt
 * rather than regenerating, so a refresh mid-check never loses progress.
 *
 * The AI call is best-effort. When ANTHROPIC_API_KEY is absent (dev) or
 * the model returns nothing usable, we fall back to a small deterministic
 * comprehension deck built from the lesson content so the flow still works
 * end-to-end. Uses createServiceClient throughout (untyped; bypasses RLS),
 * matching every other new-table code path here.
 */
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { generateQuizQuestions } from "@/lib/ai/quiz-generator";
import { indexFromLessonKey } from "@/lib/academy/lesson-key";
import type {
  QuizAnswer,
  QuizQuestion,
  VifmCourseOutlineSection,
} from "@/types/database";

export const dynamic = "force-dynamic";

type CourseRow = {
  id: string;
  title_en: string;
  title_ar: string | null;
  overview_en: string | null;
  objectives_en: string[] | null;
  outline_en: VifmCourseOutlineSection[] | null;
};

type EnrollmentRow = {
  id: string;
  candidate_id: string;
  course_id: string;
};

/** Flatten an outline section's bullets (both shapes) into plain strings. */
function bulletTexts(section: VifmCourseOutlineSection): string[] {
  const out: string[] = [];
  for (const b of section.bullets ?? []) {
    if (b.text) out.push(b.text);
    for (const sb of b.sub_bullets ?? []) out.push(sb);
  }
  for (const sub of section.subsections ?? []) {
    if (sub.sub_header) out.push(sub.sub_header);
    for (const b of sub.bullets ?? []) {
      if (b.text) out.push(b.text);
      for (const sb of b.sub_bullets ?? []) out.push(sb);
    }
  }
  return out.filter((s) => s && s.trim().length > 0);
}

/**
 * Deterministic fallback deck. Builds true/false comprehension items from
 * the lesson's own bullets so a learner without AI configured still gets a
 * working knowledge check. Always returns at least 3 questions.
 */
function fallbackQuestions(
  lessonTitle: string,
  courseTitle: string,
  bullets: string[]
): QuizQuestion[] {
  const source = bullets.length > 0 ? bullets : [
    `${lessonTitle} is a core part of ${courseTitle}.`,
    `Applying ${lessonTitle} on the job reinforces the learning.`,
    `Reviewing ${lessonTitle} supports long-term retention.`,
  ];
  const picked = source.slice(0, 5);
  return picked.map((stmt, i) => ({
    id: `q-${i + 1}`,
    type: "true_false" as const,
    prompt_en: `True or False: "${stmt}" is covered in this lesson.`,
    prompt_ar: null,
    options_en: ["True", "False"],
    options_ar: null,
    correct_index: 0,
    points: 10,
    difficulty: "easy" as const,
    explanation_en: `This statement reflects content from the "${lessonTitle}" lesson, so it is True.`,
    explanation_ar: null,
  }));
}

export async function POST(req: Request) {
  let body: { enrollmentId?: string; lessonKey?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const enrollmentId = body.enrollmentId?.trim();
  const lessonKey = body.lessonKey?.trim();
  if (!enrollmentId || !lessonKey) {
    return NextResponse.json(
      { error: "enrollmentId and lessonKey are required" },
      { status: 400 }
    );
  }

  try {
    const sb = createServiceClient();

    // Idempotent: return the existing attempt for this lesson if present.
    const { data: existing } = await sb
      .from("academy_lesson_attempts")
      .select("id")
      .eq("enrollment_id", enrollmentId)
      .eq("lesson_key", lessonKey)
      .maybeSingle();
    if (existing) {
      return NextResponse.json({ attemptId: existing.id, existing: true });
    }

    // Load the enrollment, then its course.
    const { data: enrollment } = (await sb
      .from("vifm_enrollments")
      .select("id, candidate_id, course_id")
      .eq("id", enrollmentId)
      .maybeSingle()) as { data: EnrollmentRow | null };
    if (!enrollment) {
      return NextResponse.json({ error: "enrollment not found" }, { status: 404 });
    }

    const { data: course } = (await sb
      .from("vifm_courses")
      .select("id, title_en, title_ar, overview_en, objectives_en, outline_en")
      .eq("id", enrollment.course_id)
      .maybeSingle()) as { data: CourseRow | null };
    if (!course) {
      return NextResponse.json({ error: "course not found" }, { status: 404 });
    }

    // Resolve the lesson section. Empty-outline courses collapse to a single
    // virtual "Overview" lesson whose content is the course overview.
    const outline = course.outline_en ?? [];
    const idx = indexFromLessonKey(lessonKey);
    const section = idx >= 0 && idx < outline.length ? outline[idx] : null;

    const lessonTitle = section?.main_header ?? "Overview";
    const bullets = section
      ? bulletTexts(section)
      : [course.overview_en ?? "", ...(course.objectives_en ?? [])].filter(
          (s) => s && s.trim().length > 0
        );

    // Ask Claude for a grounded deck. The generator is competency-shaped, so
    // we pass the lesson as a pseudo-competency: name = lesson title, the
    // description = course + lesson context, and the bullets as positive
    // behavioural indicators. currentScore null biases toward medium.
    const indicatorPool = bullets.slice(0, 8).map((d) => ({
      indicator_type: "positive" as const,
      description: d,
    }));

    let questions: QuizQuestion[] | null = null;
    try {
      questions = await generateQuizQuestions({
        competency: {
          id: course.id,
          name: lessonTitle,
          description:
            `Knowledge check for the "${lessonTitle}" lesson of the VIFM course ` +
            `"${course.title_en}". ${course.overview_en ?? ""}`.trim(),
        },
        indicators: indicatorPool,
        developmentTips: [],
        currentScore: null,
        targetScore: 4,
        bilingual: true,
      });
    } catch {
      questions = null;
    }

    // Trim an AI deck to ~5 and fall back if AI is absent / returned nothing.
    if (questions && questions.length > 5) {
      questions = questions.slice(0, 5);
    }
    if (!questions || questions.length === 0) {
      questions = fallbackQuestions(lessonTitle, course.title_en, bullets);
    }

    const initialAnswers: QuizAnswer[] = questions.map((q) => ({
      question_id: q.id,
      picked_index: null,
      answered_at: new Date().toISOString(),
    }));

    const { data: attempt, error: insertErr } = await sb
      .from("academy_lesson_attempts")
      .insert({
        enrollment_id: enrollment.id,
        candidate_id: enrollment.candidate_id,
        course_id: enrollment.course_id,
        lesson_key: lessonKey,
        status: "in_progress",
        questions,
        answers: initialAnswers,
        total_count: questions.length,
      })
      .select("id")
      .single();

    if (insertErr || !attempt) {
      // Unique-violation race: another request created it between our check
      // and insert. Re-read and return that one.
      const { data: raced } = await sb
        .from("academy_lesson_attempts")
        .select("id")
        .eq("enrollment_id", enrollmentId)
        .eq("lesson_key", lessonKey)
        .maybeSingle();
      if (raced) return NextResponse.json({ attemptId: raced.id, existing: true });
      console.error("[academy] lesson start insert failed:", insertErr?.message?.slice(0, 120));
      return NextResponse.json({ error: "could not start lesson" }, { status: 500 });
    }

    // Mark the enrollment in_progress on first lesson start (best-effort).
    await sb
      .from("vifm_enrollments")
      .update({ status: "in_progress", started_at: new Date().toISOString() })
      .eq("id", enrollmentId)
      .eq("status", "enrolled");

    return NextResponse.json({ attemptId: attempt.id, existing: false });
  } catch (e) {
    console.error("[academy] lesson start error:", e);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
