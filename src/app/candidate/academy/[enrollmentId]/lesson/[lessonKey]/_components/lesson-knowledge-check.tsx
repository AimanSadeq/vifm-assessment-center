"use client";

/**
 * Academy per-lesson knowledge check.
 *
 * This mirrors the candidate quiz UX (src/app/candidate/quiz/.../quiz-interface.tsx)
 * but is wired to the Academy attempt APIs instead of the candidate_quiz
 * server actions. The shared QuizInterface component imports its save/complete
 * actions directly from the quiz route ("../../actions"), which write to
 * candidate_quiz_attempts and redirect to /candidate/quiz/[id]/results - so it
 * cannot be reused verbatim for an academy_lesson_attempts row without
 * corrupting the data path. We therefore reproduce the same look-and-feel
 * here and POST to /api/academy/lesson/[attemptId]/{save,complete}.
 *
 * On complete it reveals the score inline and surfaces the next step (next
 * lesson, or "Complete course" / credential when this was the final lesson).
 */

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BookOpen,
  Loader2,
  CheckCircle2,
  ArrowRight,
  Award,
} from "lucide-react";
import type { QuizAnswer, QuizQuestion } from "@/types/database";

const DIFFICULTY_TONES: Record<
  QuizQuestion["difficulty"],
  { bg: string; fg: string; border: string }
> = {
  easy: { bg: "#ecfdf5", fg: "#047857", border: "#a7f3d0" },
  medium: { bg: "#fffbeb", fg: "#a16207", border: "#fde68a" },
  hard: { bg: "#fef2f2", fg: "#b91c1c", border: "#fecaca" },
};

type Props = {
  attemptId: string;
  enrollmentId: string;
  lessonTitle: string;
  questions: QuizQuestion[];
  initialAnswers: QuizAnswer[];
  passingScorePct: number;
  /** Lesson key of the next lesson, or null when this is the final lesson. */
  nextLessonKey: string | null;
};

type CompleteResponse = {
  passed?: boolean;
  scorePct?: number;
  correctCount?: number;
  totalCount?: number;
  allComplete?: boolean;
  verificationCode?: string | null;
  error?: string;
};

export function LessonKnowledgeCheck({
  attemptId,
  enrollmentId,
  lessonTitle,
  questions,
  initialAnswers,
  passingScorePct,
  nextLessonKey,
}: Props) {
  const router = useRouter();

  const [picks, setPicks] = useState<(number | null)[]>(
    questions.map((_, i) => initialAnswers[i]?.picked_index ?? null)
  );
  const [currentIdx, setCurrentIdx] = useState<number>(() => {
    const i = questions.findIndex((_, idx) => (initialAnswers[idx]?.picked_index ?? null) === null);
    return i === -1 ? 0 : i;
  });
  const [savingPick, setSavingPick] = useState(false);
  const [submitting, startTransition] = useTransition();
  const [result, setResult] = useState<CompleteResponse | null>(null);

  const q = questions[currentIdx];
  const isFinal = currentIdx === questions.length - 1;
  const allAnswered = useMemo(() => picks.every((p) => p !== null), [picks]);

  const handlePick = (optionIdx: number) => {
    if (submitting || savingPick || result) return;
    const next = picks.slice();
    next[currentIdx] = optionIdx;
    setPicks(next);
    setSavingPick(true);
    fetch(`/api/academy/lesson/${attemptId}/save`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questionIndex: currentIdx, pickedIndex: optionIdx }),
    })
      .then(async (res) => {
        setSavingPick(false);
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          toast.error(data.error ?? "Could not save your answer.");
        }
      })
      .catch(() => {
        setSavingPick(false);
        toast.error("Could not save your answer.");
      });
  };

  const handleNext = () => {
    if (picks[currentIdx] === null) {
      toast.error("Pick an answer to continue.");
      return;
    }
    if (isFinal) {
      handleComplete();
      return;
    }
    setCurrentIdx((i) => Math.min(i + 1, questions.length - 1));
  };

  const handlePrev = () => setCurrentIdx((i) => Math.max(i - 1, 0));

  const handleComplete = () => {
    startTransition(async () => {
      try {
        const res = await fetch(`/api/academy/lesson/${attemptId}/complete`, {
          method: "POST",
        });
        const data = (await res.json()) as CompleteResponse;
        if (!res.ok) {
          toast.error(data.error ?? "Could not submit the knowledge check.");
          return;
        }
        setResult(data);
        router.refresh();
      } catch {
        toast.error("Could not submit the knowledge check.");
      }
    });
  };

  // Result view -------------------------------------------------------------
  if (result) {
    const passed = !!result.passed;
    const tone = passed
      ? { bg: "#ecfdf5", fg: "#047857", border: "#a7f3d0" }
      : { bg: "#fef2f2", fg: "#b91c1c", border: "#fecaca" };
    return (
      <Card>
        <CardContent className="p-6 space-y-4">
          <div
            className="rounded-md border p-4 flex items-center gap-3"
            style={{ backgroundColor: tone.bg, borderColor: tone.border }}
          >
            {passed ? (
              <CheckCircle2 className="h-6 w-6 shrink-0" style={{ color: tone.fg }} />
            ) : (
              <BookOpen className="h-6 w-6 shrink-0" style={{ color: tone.fg }} />
            )}
            <div>
              <p className="text-lg font-bold" style={{ color: tone.fg }}>
                {passed ? "Lesson passed" : "Keep going"}
              </p>
              <p className="text-sm" style={{ color: tone.fg, opacity: 0.85 }}>
                You scored {Math.round(result.scorePct ?? 0)}% ({result.correctCount ?? 0}/
                {result.totalCount ?? questions.length}). Passing is {Math.round(passingScorePct)}%.
              </p>
            </div>
          </div>

          {/* Per-question explanations (the highest-value learning moment). */}
          <div className="space-y-3">
            {questions.map((qq, i) => {
              const picked = picks[i];
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

          <div className="flex flex-wrap items-center gap-3 pt-1">
            {result.allComplete ? (
              <>
                <div className="flex items-center gap-2 text-sm font-medium text-[#010131]">
                  <Award className="h-4 w-4 text-[#5391D5]" />
                  {result.verificationCode
                    ? "Course complete - credential issued."
                    : "Course complete."}
                </div>
                <Button
                  className="ms-auto gap-1.5 bg-[#010131] hover:bg-[#111232]"
                  onClick={() => router.push(`/candidate/academy/${enrollmentId}`)}
                >
                  Back to course
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </>
            ) : nextLessonKey ? (
              <Button
                className="ms-auto gap-1.5 bg-[#5391D5] hover:bg-[#4380c4]"
                onClick={() =>
                  router.push(
                    `/candidate/academy/${enrollmentId}/lesson/${nextLessonKey}`
                  )
                }
              >
                Next lesson
                <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                variant="outline"
                className="ms-auto gap-1.5"
                onClick={() => router.push(`/candidate/academy/${enrollmentId}`)}
              >
                Back to course
                <ArrowRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Question view -----------------------------------------------------------
  const tone = DIFFICULTY_TONES[q.difficulty];
  return (
    <div className="space-y-4">
      <div className="rounded-md border bg-gradient-to-r from-[#010131] to-[#121140] text-white p-4 flex flex-wrap items-center gap-3">
        <Badge className="bg-white/15 text-white border-white/20 gap-1">
          <BookOpen className="h-3 w-3" />
          Knowledge check
        </Badge>
        <p className="text-sm font-medium truncate me-auto">{lessonTitle}</p>
        <span className="text-xs text-white/80 tabular-nums">
          {currentIdx + 1} / {questions.length}
        </span>
      </div>

      <Card>
        <CardContent className="p-6 space-y-5">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Question {currentIdx + 1} of {questions.length}
            </p>
            <span
              className="inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold capitalize"
              style={{ backgroundColor: tone.bg, color: tone.fg, borderColor: tone.border }}
            >
              {q.difficulty}
            </span>
            <Badge variant="secondary" className="text-[11px]">
              {q.points} pts
            </Badge>
          </div>

          <div className="space-y-1">
            <p className="text-base leading-relaxed">{q.prompt_en}</p>
            {q.prompt_ar && (
              <p dir="rtl" className="text-sm text-muted-foreground leading-relaxed">
                {q.prompt_ar}
              </p>
            )}
          </div>

          {q.type === "pattern_recognition" && q.sequence && (
            <div className="flex flex-wrap items-center gap-2">
              {q.sequence.map((cell, i) => (
                <div
                  key={i}
                  className={`flex items-center justify-center min-w-[56px] h-14 rounded-md border text-lg font-semibold ${
                    cell === null
                      ? "bg-amber-50 border-amber-300 text-amber-700"
                      : "bg-muted/50"
                  }`}
                >
                  {cell === null ? "?" : String(cell)}
                </div>
              ))}
            </div>
          )}

          <div className="grid gap-2">
            {q.options_en.map((opt, i) => {
              const picked = picks[currentIdx] === i;
              const optAr =
                q.options_ar && q.options_ar.length === q.options_en.length
                  ? q.options_ar[i]
                  : null;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => handlePick(i)}
                  disabled={submitting || savingPick}
                  className={`text-left rounded-md border px-4 py-3 transition-colors ${
                    picked
                      ? "bg-[#5391D5]/10 border-[#5391D5] text-foreground"
                      : "bg-card hover:bg-muted/40"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`h-4 w-4 rounded-full border-2 shrink-0 grid place-items-center ${
                        picked ? "border-[#5391D5]" : "border-muted-foreground/40"
                      }`}
                    >
                      {picked && <span className="h-2 w-2 rounded-full bg-[#5391D5]" />}
                    </span>
                    <span className="text-sm">
                      {opt}
                      {optAr && (
                        <span dir="rtl" className="block text-xs text-muted-foreground">
                          {optAr}
                        </span>
                      )}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-2">
        {currentIdx > 0 && (
          <Button variant="ghost" onClick={handlePrev} disabled={submitting}>
            Previous
          </Button>
        )}
        <div className="ms-auto">
          <Button
            onClick={handleNext}
            disabled={submitting}
            className="gap-2 bg-[#010131] hover:bg-[#111232]"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {isFinal ? (allAnswered ? "Submit" : "Submit (skipping unanswered)") : "Next"}
          </Button>
        </div>
      </div>
    </div>
  );
}
