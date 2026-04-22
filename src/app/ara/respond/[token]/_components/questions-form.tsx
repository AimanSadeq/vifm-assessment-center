"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { Check, Loader2, AlertCircle, HelpCircle } from "lucide-react";
import { saveAraAnswer } from "@/lib/ara/respondent-actions";
import { ARA_PILLARS } from "@/lib/constants/ara-pillars";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type {
  AraLanguage, AraPillarId, AraQuestion, AraQuestionType,
} from "@/types/ara";

type ExistingAnswer = {
  question_id: string;
  answer_value: string | null;
  answer_text: string | null;
  needs_verification: boolean;
};

type QuestionsFormProps = {
  token: string;
  questions: AraQuestion[];
  answers: ExistingAnswer[];
  language: AraLanguage;
};

type SaveState = "idle" | "saving" | "saved" | "error";

type LocalAnswer = {
  value: string | null;
  text: string | null;
  needsVerification: boolean;
  state: SaveState;
  error?: string;
};

const DEBOUNCE_MS = 600;

export function QuestionsForm({ token, questions, answers, language }: QuestionsFormProps) {
  const rtl = language === "ar";

  // Group questions by pillar in the order defined by ARA_PILLARS.
  const grouped = useMemo(() => {
    const byPillar = new Map<AraPillarId, AraQuestion[]>();
    for (const q of questions) {
      const arr = byPillar.get(q.pillar_id) ?? [];
      arr.push(q);
      byPillar.set(q.pillar_id, arr);
    }
    for (const arr of byPillar.values()) {
      arr.sort((a, b) => a.question_number - b.question_number);
    }
    return byPillar;
  }, [questions]);

  // Seed local state from existing answers.
  const [state, setState] = useState<Record<string, LocalAnswer>>(() => {
    const s: Record<string, LocalAnswer> = {};
    for (const q of questions) {
      const existing = answers.find((a) => a.question_id === q.id);
      s[q.id] = {
        value: existing?.answer_value ?? null,
        text: existing?.answer_text ?? null,
        needsVerification: existing?.needs_verification ?? false,
        state: "idle",
      };
    }
    return s;
  });

  // Ref mirrors state so debounced save reads the latest values, not the
  // stale closure from the render that scheduled the timer.
  const stateRef = useRef(state);
  stateRef.current = state;

  const [, startTransition] = useTransition();
  const [timers] = useState<Map<string, ReturnType<typeof setTimeout>>>(() => new Map());

  const scheduleSave = (questionId: string) => {
    const existing = timers.get(questionId);
    if (existing) clearTimeout(existing);
    const handle = setTimeout(() => {
      const current = stateRef.current[questionId];
      if (!current) return;
      setState((prev) => ({ ...prev, [questionId]: { ...prev[questionId], state: "saving" } }));
      startTransition(async () => {
        const result = await saveAraAnswer({
          token,
          questionId,
          answerValue: current.value,
          answerText: current.text,
          needsVerification: current.needsVerification,
        });
        setState((prev) => ({
          ...prev,
          [questionId]: {
            ...prev[questionId],
            state: result.ok ? "saved" : "error",
            error: result.ok ? undefined : result.error,
          },
        }));
        if (result.ok) {
          setTimeout(() => {
            setState((prev) => ({
              ...prev,
              [questionId]: { ...prev[questionId], state: "idle" },
            }));
          }, 1500);
        }
      });
    }, DEBOUNCE_MS);
    timers.set(questionId, handle);
  };

  const updateAnswer = (questionId: string, patch: Partial<Omit<LocalAnswer, "state">>) => {
    setState((prev) => {
      const next = { ...prev, [questionId]: { ...prev[questionId], ...patch } };
      stateRef.current = next; // keep ref in sync for immediate debounce reads
      return next;
    });
    scheduleSave(questionId);
  };

  // Progress metrics
  const answeredCount = questions.filter((q) => {
    const a = state[q.id];
    return a && (a.value !== null || (q.question_type === "open_text" && a.text));
  }).length;
  const progress = questions.length === 0 ? 0 : Math.round((answeredCount / questions.length) * 100);

  return (
    <div className="space-y-8">
      {/* Progress summary */}
      <div className="rounded-lg border bg-card p-4 sticky top-0 z-10">
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="font-medium">
            {rtl ? "التقدم" : "Progress"}:{" "}
            {answeredCount} / {questions.length} {rtl ? "إجابة" : "answered"}
          </span>
          <span className="text-muted-foreground">{progress}%</span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-accent transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {ARA_PILLARS.map((pillar) => {
        const qs = grouped.get(pillar.id) ?? [];
        if (qs.length === 0) return null;

        const pillarAnswered = qs.filter((q) => {
          const a = state[q.id];
          return a && (a.value !== null || (q.question_type === "open_text" && a.text));
        }).length;

        return (
          <section key={pillar.id} id={`pillar-${pillar.id}`} className="rounded-lg border bg-card">
            <header className="border-b px-6 py-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-primary">
                  {rtl ? pillar.name_ar : pillar.name_en}
                </h2>
                <p className="text-sm text-muted-foreground" dir={rtl ? "ltr" : "rtl"}>
                  {rtl ? pillar.name_en : pillar.name_ar}
                </p>
              </div>
              <Badge variant="outline" className="shrink-0">
                {pillarAnswered} / {qs.length}
              </Badge>
            </header>

            <div className="divide-y">
              {qs.map((q) => (
                <QuestionRow
                  key={q.id}
                  question={q}
                  answer={state[q.id]}
                  language={language}
                  onAnswer={updateAnswer}
                />
              ))}
            </div>
          </section>
        );
      })}

      {questions.length === 0 && (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-muted-foreground">
            {rtl
              ? "لا توجد أسئلة متاحة بعد. يرجى التواصل مع المستشار."
              : "No questions are available for you yet. Please contact your consultant."}
          </p>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Question row
// ─────────────────────────────────────────────────────────────
function QuestionRow({
  question,
  answer,
  language,
  onAnswer,
}: {
  question: AraQuestion;
  answer: LocalAnswer | undefined;
  language: AraLanguage;
  onAnswer: (id: string, patch: Partial<Omit<LocalAnswer, "state">>) => void;
}) {
  const rtl = language === "ar";
  const text = rtl ? question.question_text_ar : question.question_text_en;
  const helpText = rtl ? question.help_text_ar : question.help_text_en;
  const [helpOpen, setHelpOpen] = useState(false);

  return (
    <div className="px-6 py-5" dir={rtl ? "rtl" : "ltr"}>
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex-1">
          <p className="text-sm font-medium leading-relaxed">
            <span className="text-muted-foreground me-2">Q{question.question_number}.</span>
            {text}
          </p>
          {helpText && (
            <button
              type="button"
              onClick={() => setHelpOpen((v) => !v)}
              className="mt-1 text-xs text-accent hover:underline inline-flex items-center gap-1"
            >
              <HelpCircle className="h-3 w-3" />
              {helpOpen ? (rtl ? "إخفاء التلميح" : "Hide hint") : (rtl ? "عرض التلميح" : "Show hint")}
            </button>
          )}
          {helpOpen && helpText && (
            <p className="mt-2 text-xs text-muted-foreground bg-muted/50 rounded-md p-2">
              {helpText}
            </p>
          )}
        </div>
        <SaveIndicator state={answer?.state ?? "idle"} error={answer?.error} rtl={rtl} />
      </div>

      <QuestionInput
        question={question}
        answer={answer}
        language={language}
        onAnswer={onAnswer}
      />

      {/* Need to verify toggle */}
      <label className="mt-3 inline-flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
        <input
          type="checkbox"
          className="h-3.5 w-3.5 rounded border-input"
          checked={answer?.needsVerification ?? false}
          onChange={(e) => onAnswer(question.id, { needsVerification: e.target.checked })}
        />
        <span>
          {rtl ? "يحتاج إلى التحقق" : "Need to verify"}
        </span>
      </label>
    </div>
  );
}

function QuestionInput({
  question,
  answer,
  language,
  onAnswer,
}: {
  question: AraQuestion;
  answer: LocalAnswer | undefined;
  language: AraLanguage;
  onAnswer: (id: string, patch: Partial<Omit<LocalAnswer, "state">>) => void;
}) {
  const rtl = language === "ar";
  const type: AraQuestionType = question.question_type;
  const options = rtl ? question.options_ar : question.options_en;
  const currentValue = answer?.value ?? null;

  if (type === "rating") {
    return (
      <div className="flex items-center gap-2" dir="ltr">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onAnswer(question.id, { value: String(n) })}
            className={`h-10 w-10 rounded-md border text-sm font-medium transition-colors ${
              currentValue === String(n)
                ? "bg-primary text-primary-foreground border-primary"
                : "border-input hover:bg-muted"
            }`}
          >
            {n}
          </button>
        ))}
        <span className="ms-3 text-xs text-muted-foreground">
          1 = {rtl ? "ضعيف" : "Low"} • 5 = {rtl ? "ممتاز" : "High"}
        </span>
      </div>
    );
  }

  if (type === "yes_no" || type === "multiple_choice") {
    const opts =
      options && Array.isArray(options) && options.length > 0
        ? options
        : type === "yes_no"
          ? [
              { value: "yes", label: rtl ? "نعم" : "Yes" },
              { value: "no", label: rtl ? "لا" : "No" },
            ]
          : [];

    if (opts.length === 0) {
      return (
        <p className="text-xs text-amber-600">
          {rtl
            ? "لم يتم تكوين خيارات هذا السؤال بعد."
            : "Options for this question have not been configured yet."}
        </p>
      );
    }

    return (
      <div className="space-y-1.5">
        {opts.map((o) => (
          <label
            key={o.value}
            className={`flex items-center gap-2 rounded-md border px-3 py-2 cursor-pointer text-sm transition-colors ${
              currentValue === o.value
                ? "border-primary bg-primary/5"
                : "border-input hover:bg-muted"
            }`}
          >
            <input
              type="radio"
              name={question.id}
              value={o.value}
              checked={currentValue === o.value}
              onChange={() => onAnswer(question.id, { value: o.value })}
              className="h-4 w-4"
            />
            <span>{o.label}</span>
          </label>
        ))}
      </div>
    );
  }

  if (type === "open_text") {
    return (
      <textarea
        rows={3}
        value={answer?.text ?? ""}
        onChange={(e) => onAnswer(question.id, { text: e.target.value, value: null })}
        placeholder={rtl ? "أدخل إجابتك هنا..." : "Type your answer…"}
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        dir={rtl ? "rtl" : "ltr"}
        maxLength={2000}
      />
    );
  }

  return null;
}

function SaveIndicator({
  state,
  error,
  rtl,
}: {
  state: SaveState;
  error?: string;
  rtl: boolean;
}) {
  if (state === "saving") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        {rtl ? "جارٍ الحفظ..." : "Saving…"}
      </span>
    );
  }
  if (state === "saved") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
        <Check className="h-3 w-3" />
        {rtl ? "محفوظ" : "Saved"}
      </span>
    );
  }
  if (state === "error") {
    return (
      <span
        className="inline-flex items-center gap-1 text-xs text-destructive"
        title={error}
      >
        <AlertCircle className="h-3 w-3" />
        {rtl ? "خطأ" : "Error"}
      </span>
    );
  }
  return null;
}

// ─────────────────────────────────────────────────────────────
// Complete button
// ─────────────────────────────────────────────────────────────
export function CompleteButton({
  token,
  alreadyComplete,
  language,
  onComplete,
}: {
  token: string;
  alreadyComplete: boolean;
  language: AraLanguage;
  onComplete: () => Promise<void>;
}) {
  const rtl = language === "ar";
  const [pending, start] = useTransition();

  if (alreadyComplete) {
    return (
      <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900">
        <Check className="inline h-4 w-4 me-1" />
        {rtl
          ? "لقد أكملت تقييمك. شكراً لك."
          : "You have submitted your assessment. Thank you."}
      </div>
    );
  }

  return (
    <Button
      onClick={() => start(() => onComplete())}
      disabled={pending}
      className="w-full"
    >
      {pending ? (rtl ? "جارٍ الإرسال..." : "Submitting…") : rtl ? "إرسال التقييم" : "Submit assessment"}
    </Button>
  );
}
