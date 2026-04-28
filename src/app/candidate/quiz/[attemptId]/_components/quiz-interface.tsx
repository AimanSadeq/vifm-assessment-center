"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Clock, AlertTriangle, Loader2 } from "lucide-react";
import {
  abandonQuizAttemptAction,
  completeQuizAttemptAction,
  saveQuizAnswerAction,
} from "../../actions";
import type { QuizAnswer, QuizQuestion } from "@/types/database";

const QUIZ_DURATION_SECONDS = 5 * 60;

const DIFFICULTY_TONES: Record<
  QuizQuestion["difficulty"],
  { bg: string; fg: string; border: string }
> = {
  easy:   { bg: "#ecfdf5", fg: "#047857", border: "#a7f3d0" },
  medium: { bg: "#fffbeb", fg: "#a16207", border: "#fde68a" },
  hard:   { bg: "#fef2f2", fg: "#b91c1c", border: "#fecaca" },
};

type Props = {
  attemptId: string;
  competencyName: string;
  questions: QuizQuestion[];
  initialAnswers: QuizAnswer[];
  startedAt: string;
};

export function QuizInterface({
  attemptId,
  competencyName,
  questions,
  initialAnswers,
  startedAt,
}: Props) {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === "ar";

  // Locale-aware prompt + options. The quiz generator now writes both
  // *_en and *_ar (since we passed bilingual:true); fall back to en
  // when ar is missing (rare but graceful).
  const promptFor = (q: QuizQuestion): string =>
    isAr && q.prompt_ar ? q.prompt_ar : q.prompt_en;
  const optionsFor = (q: QuizQuestion): string[] =>
    isAr && q.options_ar && q.options_ar.length === q.options_en.length
      ? q.options_ar
      : q.options_en;
  const [picks, setPicks] = useState<(number | null)[]>(
    initialAnswers.map((a) => a.picked_index)
  );
  const [currentIdx, setCurrentIdx] = useState<number>(() => {
    // Resume on the first unanswered question
    const i = initialAnswers.findIndex((a) => a.picked_index === null);
    return i === -1 ? questions.length - 1 : i;
  });
  const [submitting, startTransition] = useTransition();
  const [savingPick, setSavingPick] = useState(false);

  // Countdown timer driven off started_at so a refresh doesn't reset it.
  const startedTime = useMemo(() => new Date(startedAt).getTime(), [startedAt]);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const elapsed = Math.floor((now - startedTime) / 1000);
  const remaining = Math.max(0, QUIZ_DURATION_SECONDS - elapsed);
  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const timerLabel = `${mins}:${secs.toString().padStart(2, "0")}`;
  const lowTime = remaining <= 30;

  const q = questions[currentIdx];
  const isFinal = currentIdx === questions.length - 1;
  const allAnswered = picks.every((p) => p !== null);

  const handlePick = (optionIdx: number) => {
    if (submitting || savingPick) return;
    const next = picks.slice();
    next[currentIdx] = optionIdx;
    setPicks(next);
    setSavingPick(true);
    saveQuizAnswerAction({
      attemptId,
      questionIndex: currentIdx,
      pickedIndex: optionIdx,
    }).then((result) => {
      setSavingPick(false);
      if ("error" in result && result.error) {
        const msg = typeof result.error === "string" ? result.error : t("quiz.saveFailed");
        toast.error(msg);
      }
    });
  };

  const handleNext = () => {
    if (picks[currentIdx] === null) {
      toast.error(t("quiz.pickAnswer"));
      return;
    }
    if (isFinal) {
      handleComplete();
      return;
    }
    setCurrentIdx((i) => Math.min(i + 1, questions.length - 1));
  };

  const handlePrev = () => {
    setCurrentIdx((i) => Math.max(i - 1, 0));
  };

  const handleComplete = () => {
    startTransition(async () => {
      const result = await completeQuizAttemptAction({ attemptId });
      if ("error" in result && result.error) {
        toast.error(typeof result.error === "string" ? result.error : t("quiz.completeFail"));
        return;
      }
      router.push(`/candidate/quiz/${attemptId}/results`);
    });
  };

  const handleEndSession = () => {
    if (!window.confirm(t("quiz.endSessionConfirm"))) {
      return;
    }
    startTransition(async () => {
      const result = await abandonQuizAttemptAction({ attemptId });
      if ("error" in result && result.error) {
        toast.error(typeof result.error === "string" ? result.error : t("quiz.endSessionFail"));
        return;
      }
      router.push(`/candidate/quiz/${attemptId}/results`);
    });
  };

  // Auto-finalise when timer hits zero
  useEffect(() => {
    if (remaining > 0) return;
    handleComplete();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining]);

  const tone = DIFFICULTY_TONES[q.difficulty];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-md border bg-gradient-to-r from-primary to-navy-blue text-white p-4 flex flex-wrap items-center gap-3">
        <Badge className="bg-white/15 text-white border-white/20 gap-1">
          <Sparkles className="h-3 w-3" />
          {t("quiz.aiPowered")}
        </Badge>
        <p className="text-sm font-medium truncate me-auto">{competencyName}</p>
        <div
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-mono tabular-nums ${
            lowTime ? "bg-rose-500/20 border-rose-200/50" : "bg-white/10 border-white/20"
          }`}
        >
          <Clock className="h-3.5 w-3.5" />
          {timerLabel}
        </div>
      </div>

      {/* Question */}
      <Card>
        <CardContent className="p-6 space-y-5">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {t("quiz.questionOfTotal", { n: currentIdx + 1, total: questions.length })}
            </p>
            <span
              className="inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold"
              style={{ backgroundColor: tone.bg, color: tone.fg, borderColor: tone.border }}
            >
              {t(`quiz.difficulty.${q.difficulty}`)}
            </span>
            <Badge variant="secondary" className="text-[11px]">
              {t("quiz.points", { n: q.points })}
            </Badge>
            {q.type === "pattern_recognition" && (
              <Badge variant="outline" className="text-[11px]">
                {t("quiz.patternBadge")}
              </Badge>
            )}
          </div>

          <p className="text-base leading-relaxed">{promptFor(q)}</p>

          {q.type === "pattern_recognition" && q.sequence && (
            <div className="flex flex-wrap items-center gap-2">
              {q.sequence.map((cell, i) => (
                <div
                  key={i}
                  className={`flex items-center justify-center min-w-[56px] h-14 rounded-md border text-lg font-semibold ${
                    cell === null ? "bg-amber-50 border-amber-300 text-amber-700" : "bg-muted/50"
                  }`}
                >
                  {cell === null ? "?" : String(cell)}
                </div>
              ))}
            </div>
          )}

          {/* Options */}
          <div className="grid gap-2">
            {optionsFor(q).map((opt, i) => {
              const picked = picks[currentIdx] === i;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => handlePick(i)}
                  disabled={submitting}
                  className={`text-left rounded-md border px-4 py-3 transition-colors ${
                    picked
                      ? "bg-accent/10 border-accent text-foreground"
                      : "bg-card hover:bg-muted/40"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`h-4 w-4 rounded-full border-2 shrink-0 grid place-items-center ${
                        picked ? "border-accent" : "border-muted-foreground/40"
                      }`}
                    >
                      {picked && <span className="h-2 w-2 rounded-full bg-accent" />}
                    </span>
                    <span className="text-sm">{opt}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Footer */}
      <div className="flex items-center gap-2">
        <Button
          variant="destructive"
          onClick={handleEndSession}
          disabled={submitting}
          className="gap-2"
        >
          <AlertTriangle className="h-4 w-4" />
          {t("quiz.endSession")}
        </Button>

        <div className="ms-auto flex items-center gap-2">
          {currentIdx > 0 && (
            <Button variant="ghost" onClick={handlePrev} disabled={submitting}>
              {t("quiz.previous")}
            </Button>
          )}
          <Button onClick={handleNext} disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 me-2 animate-spin" />}
            {isFinal
              ? allAnswered
                ? t("quiz.submit")
                : t("quiz.submitSkipping")
              : t("quiz.next")}
          </Button>
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground text-center">
        {t("quiz.autoSavedHint")}
      </p>
    </div>
  );
}
