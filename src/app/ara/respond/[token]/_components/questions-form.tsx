"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useTranslation } from "react-i18next";
import { Check, Loader2, AlertCircle, HelpCircle } from "lucide-react";
import { AssessmentIntro, type IntroPoint } from "@/components/shared/assessment-intro";
import { saveAraAnswer } from "@/lib/ara/respondent-actions";
import { ARA_PILLARS } from "@/lib/constants/ara-pillars";
import {
  ARA_INDIVIDUAL_FACTORS,
  type AraIndividualFactorId,
} from "@/lib/constants/ara-individual-factors";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type {
  AraLanguage, AraPillarId, AraQuestion, AraQuestionType,
} from "@/types/ara";

/**
 * Cross-component signal so the CompleteButton can flush any pending
 * auto-saves before firing markAraRespondentComplete. Without this gate
 * a respondent who clicks Submit while the last 1-2 answers are still
 * debounced in client state ends up with completed_at set but only
 * N-of-24 responses persisted - the audit on 2026-05-15 hit this in a
 * fast-click scripted run. Keyed by respondent token so multiple forms
 * on the same page (would only happen in dev) don't collide.
 */
type FormSaveGate = {
  hasPendingSaves: () => boolean;
  flushPendingSaves: () => Promise<void>;
};
const FORM_GATES = new Map<string, FormSaveGate>();

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
  // Intro is rendered in the ASSESSMENT's language (en/ar), not the UI cookie.
  const { i18n } = useTranslation();
  const at = useMemo(() => i18n.getFixedT(language === "ar" ? "ar" : "en"), [i18n, language]);
  const [started, setStarted] = useState(false);

  // Split questions into pillar-only and individual-factor groups.
  // Items with individual_factor_id set belong to the personal factor
  // sections (AI Sense-Check etc.); items without belong to the org
  // pillar sections (Strategy etc.). A Mode B/C respondent gets both;
  // a Mode A (pure personal) respondent gets only the factor sections.
  //
  // displayNumberById renumbers personal items 1..N in factor-then-
  // question-number order, so a Mode A respondent sees Q1..Q24 instead
  // of the org-style Q101..Q124 internal numbering.
  const { byPillar, byFactor, displayNumberById } = useMemo(() => {
    const byPillar = new Map<AraPillarId, AraQuestion[]>();
    const byFactor = new Map<AraIndividualFactorId, AraQuestion[]>();
    for (const q of questions) {
      if (q.individual_factor_id) {
        const fid = q.individual_factor_id as AraIndividualFactorId;
        const arr = byFactor.get(fid) ?? [];
        arr.push(q);
        byFactor.set(fid, arr);
      } else {
        const arr = byPillar.get(q.pillar_id) ?? [];
        arr.push(q);
        byPillar.set(q.pillar_id, arr);
      }
    }
    Array.from(byPillar.values()).forEach((arr: AraQuestion[]) => {
      arr.sort((a, b) => a.question_number - b.question_number);
    });
    Array.from(byFactor.values()).forEach((arr: AraQuestion[]) => {
      arr.sort((a, b) => a.question_number - b.question_number);
    });
    const displayNumberById = new Map<string, number>();
    let counter = 0;
    ARA_INDIVIDUAL_FACTORS.forEach((factor) => {
      const arr = byFactor.get(factor.id) ?? [];
      arr.forEach((q) => {
        counter += 1;
        displayNumberById.set(q.id, counter);
      });
    });
    return { byPillar, byFactor, displayNumberById };
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
  // Tracks each in-flight save promise so the gate can await all of
  // them when Submit needs to wait for stragglers to land.
  const inFlightRef = useRef<Set<Promise<void>>>(new Set());

  // Runs the actual save (no debounce; called by both the timer
  // callback and the flush path). Returns a promise that resolves
  // when the save has either succeeded or exhausted retries.
  const runSave = (questionId: string): Promise<void> => {
    const current = stateRef.current[questionId];
    if (!current) return Promise.resolve();
    setState((prev) => ({ ...prev, [questionId]: { ...prev[questionId], state: "saving" } }));
    const promise = (async () => {
      // Auto-retry up to 3 times. Handles both action-level errors
      // (result.ok === false) and network/thrown errors.
      const MAX_ATTEMPTS = 3;
      let lastError: string | undefined;
      let saved = false;
      for (let attempt = 1; attempt <= MAX_ATTEMPTS && !saved; attempt++) {
        try {
          const result = await saveAraAnswer({
            token,
            questionId,
            answerValue: current.value,
            answerText: current.text,
            needsVerification: current.needsVerification,
          });
          if (result.ok) { saved = true; break; }
          lastError = result.error;
        } catch (err) {
          lastError = err instanceof Error ? err.message : "Network error";
        }
        if (attempt < MAX_ATTEMPTS) {
          // Backoff: 500ms, 1500ms before final attempt
          await new Promise((r) => setTimeout(r, 500 * attempt));
        }
      }
      setState((prev) => ({
        ...prev,
        [questionId]: {
          ...prev[questionId],
          state: saved ? "saved" : "error",
          error: saved ? undefined : lastError,
        },
      }));
      if (saved) {
        setTimeout(() => {
          setState((prev) => ({
            ...prev,
            [questionId]: { ...prev[questionId], state: "idle" },
          }));
        }, 1500);
      }
    })();
    inFlightRef.current.add(promise);
    promise.finally(() => { inFlightRef.current.delete(promise); });
    return promise;
  };

  const scheduleSave = (questionId: string) => {
    const existing = timers.get(questionId);
    if (existing) clearTimeout(existing);
    const handle = setTimeout(() => {
      timers.delete(questionId);
      startTransition(() => { void runSave(questionId); });
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

  // Register / unregister this form's save gate so the sibling
  // CompleteButton can flush before firing the completion server
  // action. Captures the timers Map and inFlightRef by closure.
  useEffect(() => {
    const gate: FormSaveGate = {
      hasPendingSaves: () => timers.size > 0 || inFlightRef.current.size > 0,
      flushPendingSaves: async () => {
        // Yield one macrotask before reading state. The audit on
        // 2026-05-15 caught a real-world reproducer: a respondent
        // who clicks Submit in the same React event-batch as the
        // last answer-click (e.g. fast-tab + Enter on the rating
        // buttons, or our scripted-click test) is in the middle of
        // a single synthetic event when this function runs. React
        // hasn't flushed the queued setStates yet, so stateRef.current
        // still holds the pre-click answer values (null for any
        // unanswered factor). Without this yield, every runSave
        // call reads stale state and writes null answer_values to
        // the DB - opposite of what the gate is meant to fix. A
        // setTimeout(0) yield gives React one macrotask to commit
        // the batched updates, after which stateRef.current is
        // current and the saves carry real values.
        await new Promise<void>((resolve) => setTimeout(resolve, 0));

        // Fire every debounced save immediately, then wait for it +
        // anything already in flight to settle. Loop until both queues
        // are empty in case a save scheduled while we were awaiting.
        const guard = Date.now() + 30_000; // hard 30s safety
        while (Date.now() < guard) {
          const pendingIds = Array.from(timers.keys());
          for (const id of pendingIds) {
            const t = timers.get(id);
            if (t) clearTimeout(t);
            timers.delete(id);
            void runSave(id);
          }
          if (inFlightRef.current.size === 0 && timers.size === 0) break;
          await Promise.allSettled(Array.from(inFlightRef.current));
        }
      },
    };
    FORM_GATES.set(token, gate);
    return () => {
      FORM_GATES.delete(token);
    };
    // runSave is stable across renders (no deps that change identity);
    // we deliberately don't include it to avoid re-registering the gate
    // on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, timers]);

  // Progress metrics
  const answeredCount = questions.filter((q) => {
    const a = state[q.id];
    return a && (a.value !== null || (q.question_type === "open_text" && a.text));
  }).length;
  const progress = questions.length === 0 ? 0 : Math.round((answeredCount / questions.length) * 100);

  if (!started) {
    const present = new Set<AraQuestionType>(questions.map((q) => q.question_type));
    const order: Array<[AraQuestionType, string]> = [
      ["rating", "rating"],
      ["multiple_choice", "choice"],
      ["situational_judgment", "judgment"],
      ["knowledge_check", "knowledge"],
      ["open_text", "open"],
    ];
    const howTo: IntroPoint[] = order
      .filter(([qt]) => present.has(qt))
      .map(([, key]) => ({ label: at(`aintro.arc.${key}.label`), text: at(`aintro.arc.${key}.text`) }));
    return (
      <AssessmentIntro
        dir={rtl ? "rtl" : "ltr"}
        eyebrow={at("aintro.eyebrow")}
        title={at("aintro.title")}
        intro={at("aintro.arc.intro")}
        howToTitle={at("aintro.howTo")}
        howTo={howTo}
        guidance={[at("aintro.arc.g1"), at("aintro.arc.g2")]}
        startLabel={at("aintro.arc.start")}
        onStart={() => setStarted(true)}
      />
    );
  }

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
        const qs = byPillar.get(pillar.id) ?? [];
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
                {/* Opposite-language pillar name as a secondary label so a
                    respondent reading in one language sees the other on every
                    pillar header. Intentional dir flip. */}
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

      {/* Personal / individual-factor sections - render after any pillar
           sections so a Mode B/C respondent sees pillars first then
           personal factors. Pure Mode A respondents (Personal Snapshot)
           only have factor questions, so this is the only rendered group. */}
      {ARA_INDIVIDUAL_FACTORS.map((factor) => {
        const qs = byFactor.get(factor.id) ?? [];
        if (qs.length === 0) return null;

        const factorAnswered = qs.filter((q) => {
          const a = state[q.id];
          return a && (a.value !== null || (q.question_type === "open_text" && a.text));
        }).length;

        return (
          <section key={factor.id} id={`factor-${factor.id}`} className="rounded-lg border bg-card">
            <header className="border-b px-6 py-4 flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full mt-2 shrink-0"
                  style={{ backgroundColor: factor.color }}
                  aria-hidden="true"
                />
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                    {factor.domain}
                  </span>
                  <h2 className="text-lg font-semibold text-primary">
                    {rtl ? factor.name_ar : factor.name_en}
                  </h2>
                  <p className="text-sm text-muted-foreground" dir={rtl ? "ltr" : "rtl"}>
                    {rtl ? factor.name_en : factor.name_ar}
                  </p>
                </div>
              </div>
              <Badge variant="outline" className="shrink-0">
                {factorAnswered} / {qs.length}
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
                  displayNumber={displayNumberById.get(q.id)}
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
  displayNumber,
}: {
  question: AraQuestion;
  answer: LocalAnswer | undefined;
  language: AraLanguage;
  onAnswer: (id: string, patch: Partial<Omit<LocalAnswer, "state">>) => void;
  /** Override for the visible Q code; falls back to question_number. */
  displayNumber?: number;
}) {
  const rtl = language === "ar";
  const text = rtl ? question.question_text_ar : question.question_text_en;
  const helpText = rtl ? question.help_text_ar : question.help_text_en;
  const [helpOpen, setHelpOpen] = useState(false);
  const codeNumber = displayNumber ?? question.question_number;

  // Graded items get a distinct chip so respondents know it's a scenario /
  // knowledge check (an objective item), not a self-rating.
  const gradedLabel =
    question.question_type === "situational_judgment"
      ? rtl ? "سيناريو" : "Scenario"
      : question.question_type === "knowledge_check"
        ? rtl ? "اختبار معرفي" : "Knowledge check"
        : null;

  return (
    <div className="px-6 py-5" dir={rtl ? "rtl" : "ltr"}>
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex-1">
          {gradedLabel && (
            <span className="mb-1.5 inline-block rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent">
              {gradedLabel}
            </span>
          )}
          <p className="text-sm font-medium leading-relaxed">
            <span className="text-muted-foreground me-2">Q{codeNumber}.</span>
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

      {/* Flag-for-follow-up toggle. Was previously labelled "Need to
           verify", which read ambiguously to respondents - verify what,
           by whom? Reframed as a self-flag for items the respondent
           wants to revisit later. */}
      <label
        className="mt-3 inline-flex items-start gap-2 text-xs text-muted-foreground cursor-pointer"
        title={rtl
          ? "ضع علامة على البنود التي لست متأكداً منها أو تريد مراجعتها قبل التسليم."
          : "Mark items you're unsure about or want to revisit before you finish."}
      >
        <input
          type="checkbox"
          className="h-3.5 w-3.5 rounded border-input mt-0.5"
          checked={answer?.needsVerification ?? false}
          onChange={(e) => onAnswer(question.id, { needsVerification: e.target.checked })}
        />
        <span>
          {rtl ? "تحديد للمراجعة لاحقاً" : "Flag for follow-up"}
          <span className="ms-1 opacity-70">
            {rtl ? "- غير متأكد، أراجع لاحقاً" : "- I'm not sure, I'll revisit"}
          </span>
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
    const groupLabel = rtl ? "التقييم من ١ إلى ٥" : "Rating scale from 1 to 5";
    return (
      <div
        className="flex items-center gap-2"
        dir="ltr"
        role="radiogroup"
        aria-label={groupLabel}
      >
        {[1, 2, 3, 4, 5].map((n) => {
          const selected = currentValue === String(n);
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onAnswer(question.id, { value: String(n) })}
              className={`h-10 w-10 rounded-md border text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                selected
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-input hover:bg-muted"
              }`}
            >
              {n}
            </button>
          );
        })}
        {/* Use Arabic-Indic digits in the Arabic legend so the
             "digit = label" pairs read naturally in RTL flow. Without
             this, Western digits inside an RTL paragraph render LTR-
             isolated by Unicode BiDi rules and the visual order looks
             reversed (ضعيف 5 • ممتاز 1), which respondents misread as
             5=weak / 1=excellent. */}
        <span className="ms-3 text-xs text-muted-foreground" dir={rtl ? "rtl" : "ltr"}>
          {rtl ? "١ = ضعيف • ٥ = ممتاز" : "1 = Low • 5 = High"}
        </span>
      </div>
    );
  }

  if (
    type === "yes_no" ||
    type === "multiple_choice" ||
    type === "situational_judgment" ||
    type === "knowledge_check"
  ) {
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
  // Distinct flushing state so the button label can show a more
  // honest "saving your answers" before it flips to "submitting"
  // - this is the gap the audit caught (clicks fired in <200ms
  // outran the debounce, click→submit was instant and left answers
  // unsaved).
  const [flushing, setFlushing] = useState(false);

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

  const handleClick = () => {
    start(async () => {
      const gate = FORM_GATES.get(token);
      if (gate && gate.hasPendingSaves()) {
        setFlushing(true);
        try {
          await gate.flushPendingSaves();
        } finally {
          setFlushing(false);
        }
      }
      await onComplete();
    });
  };

  const label = pending
    ? (flushing
        ? (rtl ? "جارٍ حفظ إجاباتك..." : "Saving your answers…")
        : (rtl ? "جارٍ الإرسال..." : "Submitting…"))
    : (rtl ? "إرسال التقييم" : "Submit assessment");

  return (
    <Button
      onClick={handleClick}
      disabled={pending}
      className="w-full"
    >
      {label}
    </Button>
  );
}
