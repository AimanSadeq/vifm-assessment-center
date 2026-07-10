"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Check, Loader2, AlertCircle, HelpCircle, Zap, Save } from "lucide-react";
import { AssessmentIntro, type IntroPoint } from "@/components/shared/assessment-intro";
import { saveAraAnswer, markAraRespondentStarted, markAraRespondentComplete, simulateAraAnswers } from "@/lib/ara/respondent-actions";
import { ARA_PILLARS } from "@/lib/constants/ara-pillars";
import {
  ARA_INDIVIDUAL_FACTORS,
  type AraIndividualFactorId,
} from "@/lib/constants/ara-individual-factors";
import {
  ARA_AGENTIC_DIMENSIONS,
  type AraAgenticDimensionId,
} from "@/lib/constants/ara-agentic-dimensions";
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
  /**
   * Fires every debounced save, awaits everything in flight, re-tries any
   * answer whose earlier save exhausted its retries, and returns the number
   * of answers that STILL failed to persist. Submit must refuse when this is
   * non-zero - completing anyway silently dropped the failed answers while
   * showing the respondent a success screen.
   */
  flushPendingSaves: () => Promise<number>;
};
const FORM_GATES = new Map<string, FormSaveGate>();

/**
 * Whether every required (scored) question has an answer. QuestionsForm owns the
 * answer state; CompleteButton is passed in as a child (from the server page) so
 * it reads this through context to dim/disable Submit until the form is complete.
 * Default true so the button is never permanently stuck if a provider is absent.
 * Optional open_text reflections are NOT required (they would otherwise block
 * submission forever).
 */
const CompletionContext = createContext<boolean>(true);

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
  /** Per-instance time limit (minutes); null = no limit (migration 00084). */
  timeLimitMinutes?: number | null;
  /** Persisted start (ISO) if the respondent already began; anchors the countdown. */
  startedAt?: string | null;
  /**
   * Staff-only demo control. True when the viewer is signed-in staff (any run) -
   * so the "Randomize answers" shortcut reaches an admin demoing to a client but
   * never the candidate sitting the assessment. The server action re-checks staff
   * and the button confirms before overwriting, so this only controls visibility.
   */
  canSimulate?: boolean;
  /**
   * Lens-aware route back to the ARC landing (Selection / Development). Used by
   * the "Save & finish later" control so leaving the assessment returns the
   * issuer to a known home rather than a dead end. Defaults to /ara.
   */
  backHref?: string;
  /**
   * Trailing content (optional sections + the Submit button) rendered ONLY
   * after the respondent has started. Kept out of the pre-start intro screen
   * so the "Submit assessment" button never appears under the Start button on
   * the landing page (the stray-submit bug). The page passes server-rendered
   * children; this component just gates their visibility on `started`.
   */
  children?: ReactNode;
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

export function QuestionsForm({ token, questions, answers, language, timeLimitMinutes = null, startedAt = null, canSimulate = false, backHref = "/ara", children }: QuestionsFormProps) {
  const rtl = language === "ar";
  const router = useRouter();
  // Resume: a respondent returning to their link with answers already saved
  // skips the intro and lands straight back in the form (answers auto-save, so
  // they continue where they left off). Computed once from the server-seeded
  // answers; first-timers (no answers) still see the intro.
  const hadSavedProgress = useMemo(
    () => answers.some((a) => a.answer_value != null || (a.answer_text != null && a.answer_text.length > 0)),
    [answers]
  );
  // Demo-only: auto-fill every answer and go straight to the report.
  const [simulating, setSimulating] = useState(false);
  const [simError, setSimError] = useState<string | null>(null);
  // "Save & finish later" - flush pending saves, then return to the ARC landing.
  const [exiting, setExiting] = useState(false);
  const handleSaveAndExit = async () => {
    if (exiting) return;
    setExiting(true);
    try {
      const stillFailing = (await FORM_GATES.get(token)?.flushPendingSaves()) ?? 0;
      if (stillFailing > 0) {
        // Don't leave silently with unsaved answers - let the respondent choose.
        const leaveAnyway = window.confirm(
          rtl
            ? `تعذّر حفظ ${stillFailing} من الإجابات. المغادرة الآن قد تفقد هذه الإجابات - هل تريد المغادرة على أي حال؟`
            : `${stillFailing} answer${stillFailing === 1 ? "" : "s"} could not be saved. Leaving now may lose them - leave anyway?`
        );
        if (!leaveAnyway) {
          setExiting(false);
          return;
        }
      }
    } catch {
      /* answers already auto-save; navigate regardless so the user isn't stuck */
    }
    router.push(backHref);
  };

  const handleSimulate = async () => {
    if (simulating) return;
    // Confirm first - this overwrites any existing answers and works on real
    // (non-sandbox) runs now, so an accidental click shouldn't wipe a session.
    if (
      !window.confirm(
        rtl
          ? "تعبئة جميع الإجابات بقيم عشوائية والانتقال إلى التقرير؟ سيستبدل ذلك أي إجابات حالية - لأغراض العرض الإداري فقط."
          : "Randomize all answers and jump to the report? This overwrites any existing answers - for admin demos only."
      )
    ) {
      return;
    }
    setSimError(null);
    setSimulating(true);
    try {
      const result = await simulateAraAnswers(token);
      if (!result.ok) {
        setSimError(result.error);
        setSimulating(false);
        return;
      }
      // Individual stage redirects to the personal results page once complete;
      // a refresh re-runs the server page which performs that redirect.
      router.push(`/ara/personal/results/${token}`);
    } catch {
      setSimError(rtl ? "تعذّرت محاكاة الإجابات." : "Could not simulate answers.");
      setSimulating(false);
    }
  };
  // Intro is rendered in the ASSESSMENT's language (en/ar), not the UI cookie.
  const { i18n } = useTranslation();
  const at = useMemo(() => i18n.getFixedT(language === "ar" ? "ar" : "en"), [i18n, language]);
  // Resume straight into the form when there are already saved answers.
  const [started, setStarted] = useState(hadSavedProgress);
  const [starting, setStarting] = useState(false);
  // Countdown (only when a per-instance limit is set), anchored to started_at.
  const [deadline, setDeadline] = useState<number | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [finishing, setFinishing] = useState(false);

  // On resume into a TIMED assessment, re-anchor the countdown from the server
  // started_at so the deadline survives leaving and returning. No-op for the
  // untimed personal deep-dive (timeLimitMinutes null).
  useEffect(() => {
    if (started && timeLimitMinutes && timeLimitMinutes > 0 && startedAt && deadline == null) {
      const dl = new Date(startedAt).getTime() + timeLimitMinutes * 60 * 1000;
      setDeadline(dl);
      setRemaining(Math.max(0, Math.round((dl - Date.now()) / 1000)));
    }
    // Mount-only: anchors once on resume; the onStart handler anchors first runs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Split questions into pillar-only and individual-factor groups.
  // Items with individual_factor_id set belong to the personal factor
  // sections (AI Sense-Check etc.); items without belong to the org
  // pillar sections (Strategy etc.). A Mode B/C respondent gets both;
  // a Mode A (pure personal) respondent gets only the factor sections.
  //
  // displayNumberById renumbers personal items 1..N in factor-then-
  // question-number order, so a Mode A respondent sees Q1..Q24 instead
  // of the org-style Q101..Q124 internal numbering.
  const { byPillar, byFactor, byAgentic, displayNumberById } = useMemo(() => {
    const byPillar = new Map<AraPillarId, AraQuestion[]>();
    const byFactor = new Map<AraIndividualFactorId, AraQuestion[]>();
    const byAgentic = new Map<AraAgenticDimensionId, AraQuestion[]>();
    for (const q of questions) {
      if (q.agentic_dimension_id) {
        // Agentic-AI items reuse a storage pillar_id, so they must be routed
        // by agentic_dimension_id FIRST or they would fall into a pillar
        // section (e.g. Governance) instead of their own dimension section.
        const aid = q.agentic_dimension_id as AraAgenticDimensionId;
        const arr = byAgentic.get(aid) ?? [];
        arr.push(q);
        byAgentic.set(aid, arr);
      } else if (q.individual_factor_id) {
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
    [byPillar, byFactor, byAgentic].forEach((m) =>
      Array.from(m.values()).forEach((arr: AraQuestion[]) =>
        arr.sort((a, b) => a.question_number - b.question_number)
      )
    );
    const displayNumberById = new Map<string, number>();
    let counter = 0;
    ARA_INDIVIDUAL_FACTORS.forEach((factor) => {
      const arr = byFactor.get(factor.id) ?? [];
      arr.forEach((q) => {
        counter += 1;
        displayNumberById.set(q.id, counter);
      });
    });
    return { byPillar, byFactor, byAgentic, displayNumberById };
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
  // Question ids whose save exhausted its retries. Synchronously maintained
  // (unlike React state, which only reaches stateRef on the next render) so
  // the submit flush can re-try and then COUNT what is still unsaved.
  const failedIdsRef = useRef<Set<string>>(new Set());

  // Runs the actual save (no debounce; called by both the timer
  // callback and the flush path). Returns a promise that resolves
  // when the save has either succeeded or exhausted retries.
  const runSave = (questionId: string): Promise<void> => {
    if (!stateRef.current[questionId]) return Promise.resolve();
    setState((prev) => ({ ...prev, [questionId]: { ...prev[questionId], state: "saving" } }));
    const promise = (async () => {
      // Auto-retry up to 3 times. Handles both action-level errors
      // (result.ok === false) and network/thrown errors.
      const MAX_ATTEMPTS = 3;
      let lastError: string | undefined;
      let saved = false;
      for (let attempt = 1; attempt <= MAX_ATTEMPTS && !saved; attempt++) {
        // Re-read the LATEST values on every attempt: a respondent who
        // changes the same answer during the retry backoff previously had
        // the stale captured value re-sent afterwards, overwriting the newer
        // saved answer while the UI showed the new one.
        const current = stateRef.current[questionId];
        if (!current) break;
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
      if (saved) failedIdsRef.current.delete(questionId);
      else failedIdsRef.current.add(questionId);
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

        // Answers whose earlier save exhausted its retries are NOT in either
        // queue - they settled in 'error' state and were previously dropped
        // silently by Submit. Give them one more full retry cycle now, then
        // report what is still unsaved so the caller can refuse to complete.
        const errored = Array.from(failedIdsRef.current);
        if (errored.length > 0) {
          await Promise.allSettled(errored.map((id) => runSave(id)));
        }
        return failedIdsRef.current.size;
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

  // Auto-submit when the per-instance time limit runs out: flush pending saves
  // (reusing the same gate Submit uses), mark complete, then refresh so the page
  // renders the completed state.
  const finishOnExpiry = async () => {
    if (finishing) return;
    setFinishing(true);
    try {
      // Time is up: completion proceeds even if some saves still fail (the
      // server refuses late saves anyway, so a retry loop can't rescue them),
      // but the loss is logged rather than silent.
      const stillFailing = (await FORM_GATES.get(token)?.flushPendingSaves()) ?? 0;
      if (stillFailing > 0) {
        console.error(`[ara] time-limit expiry: ${stillFailing} answer(s) could not be persisted before auto-submit`);
      }
      await markAraRespondentComplete(token);
      router.refresh();
    } catch {
      setFinishing(false);
    }
  };

  useEffect(() => {
    if (!started || deadline == null) return;
    const id = setInterval(() => {
      const secs = Math.max(0, Math.round((deadline - Date.now()) / 1000));
      setRemaining(secs);
      if (secs <= 0) {
        clearInterval(id);
        void finishOnExpiry();
      }
    }, 1000);
    return () => clearInterval(id);
    // finishOnExpiry is a stable closure; started/deadline drive the timer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, deadline]);

  // Progress metrics
  const answeredCount = questions.filter((q) => {
    const a = state[q.id];
    return a && (a.value !== null || (q.question_type === "open_text" && a.text));
  }).length;
  const progress = questions.length === 0 ? 0 : Math.round((answeredCount / questions.length) * 100);

  // Submit stays dimmed until every REQUIRED (scored) question is answered.
  // Optional open_text reflections do not gate submission.
  const requiredUnanswered = questions.filter((q) => {
    if (q.question_type === "open_text") return false;
    const a = state[q.id];
    return !(a && a.value !== null);
  }).length;
  const allRequiredAnswered = questions.length > 0 && requiredUnanswered === 0;

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
        guidance={[
          at("aintro.arc.g1"),
          at("aintro.arc.g2"),
          ...(timeLimitMinutes ? [at("aintro.arc.timed", { min: timeLimitMinutes })] : []),
        ]}
        startLabel={at("aintro.arc.start")}
        busy={starting}
        onStart={async () => {
          if (timeLimitMinutes && timeLimitMinutes > 0) {
            setStarting(true);
            try {
              const startIso = await markAraRespondentStarted(token);
              const dl = new Date(startIso).getTime() + timeLimitMinutes * 60 * 1000;
              setDeadline(dl);
              setRemaining(Math.max(0, Math.round((dl - Date.now()) / 1000)));
            } finally {
              setStarting(false);
            }
          }
          setStarted(true);
        }}
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
          <span className="flex items-center gap-3">
            {remaining != null && (
              <span
                className={`font-mono font-semibold tabular-nums ${remaining <= 60 ? "text-rose-600" : "text-muted-foreground"}`}
              >
                {at("aintro.timeRemaining")} {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, "0")}
              </span>
            )}
            <span className="text-muted-foreground">{progress}%</span>
          </span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-accent transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Save & finish later - answers already auto-save; this flushes any
            in-flight save, then returns to the ARC landing so leaving is a
            deliberate, reassured action rather than just closing the tab. */}
        <div className="mt-3 flex items-center justify-between gap-3 border-t pt-3">
          <span className="text-[11px] text-muted-foreground">
            {rtl
              ? "تُحفظ إجاباتك تلقائياً - عُد عبر الرابط نفسه لإكمالها لاحقاً."
              : "Your answers save automatically - return via the same link to continue later."}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleSaveAndExit}
            disabled={exiting}
            className="shrink-0 gap-1.5"
          >
            {exiting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            {exiting ? (rtl ? "جارٍ الحفظ..." : "Saving...") : (rtl ? "احفظ وأكمل لاحقاً" : "Save & finish later")}
          </Button>
        </div>
      </div>

      {/* Resume note - shown when the respondent returned to saved progress. */}
      {hadSavedProgress && (
        <div className="rounded-md border border-accent/30 bg-accent/5 px-3 py-2 text-[12px] text-muted-foreground">
          {rtl
            ? `مرحباً بعودتك - أكملت ${answeredCount} من ${questions.length}. تابع من حيث توقفت.`
            : `Welcome back - you've answered ${answeredCount} of ${questions.length}. Pick up where you left off.`}
        </div>
      )}

      {/* Staff-only demo shortcut: randomize every answer and jump to the report.
          Rendered only when the viewer is signed-in staff (never the candidate),
          on any run; the action re-checks staff + confirms before overwriting. */}
      {canSimulate && (
        <div className="rounded-lg border-2 border-dashed border-amber-300 bg-amber-50 p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="text-sm">
              <p className="font-semibold text-amber-900 flex items-center gap-1.5">
                <Zap className="h-4 w-4" />
                {rtl ? "وضع العرض التوضيحي" : "Demo mode"}
              </p>
              <p className="text-xs text-amber-900/80 mt-0.5">
                {rtl
                  ? "للمسؤول فقط: عبّئ جميع الأسئلة بإجابات عشوائية وانتقل مباشرة إلى التقرير."
                  : "Admin only: randomize every answer and jump straight to the report."}
              </p>
            </div>
            <Button
              type="button"
              onClick={handleSimulate}
              disabled={simulating}
              className="shrink-0 gap-2 bg-amber-600 hover:bg-amber-700 text-white"
            >
              {simulating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
              {simulating
                ? (rtl ? "جارٍ التعبئة..." : "Randomizing...")
                : (rtl ? "عشوِ الإجابات وعرض التقرير" : "Randomize answers & view report")}
            </Button>
          </div>
          {simError && (
            <p className="mt-2 text-xs text-destructive flex items-center gap-1.5">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {simError}
            </p>
          )}
        </div>
      )}

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

      {/* Agentic-AI Readiness sections - one per dimension, after the pillar
           and personal-factor sections. Only present when the assessment
           opted into the agentic layer (include_agentic_layer). */}
      {ARA_AGENTIC_DIMENSIONS.map((dim) => {
        const qs = byAgentic.get(dim.id) ?? [];
        if (qs.length === 0) return null;

        const dimAnswered = qs.filter((q) => {
          const a = state[q.id];
          return a && (a.value !== null || (q.question_type === "open_text" && a.text));
        }).length;

        return (
          <section key={dim.id} id={`agentic-${dim.id}`} className="rounded-lg border bg-card">
            <header className="border-b px-6 py-4 flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full mt-2 shrink-0"
                  style={{ backgroundColor: dim.color }}
                  aria-hidden="true"
                />
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                    {rtl ? "الذكاء الاصطناعي الوكيل" : "Agentic AI"}
                  </span>
                  <h2 className="text-lg font-semibold text-primary">
                    {rtl ? dim.name_ar : dim.name_en}
                  </h2>
                  <p className="text-sm text-muted-foreground" dir={rtl ? "ltr" : "rtl"}>
                    {rtl ? dim.name_en : dim.name_ar}
                  </p>
                </div>
              </div>
              <Badge variant="outline" className="shrink-0">
                {dimAnswered} / {qs.length}
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

      {/* Trailing content (optional sections + Submit) - only after Start, so it
          never shows on the intro/landing screen (the stray-submit bug). The
          CompletionContext lets the (server-passed) CompleteButton dim Submit
          until every required question is answered. */}
      <CompletionContext.Provider value={allRequiredAnswered}>
        {children}
      </CompletionContext.Provider>
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

  // Every question shows its response type so respondents can tell a
  // self-rating apart from an objective scenario / knowledge-check item
  // (a section can mix all three).
  const gradedLabel =
    question.question_type === "situational_judgment"
      ? rtl ? "سيناريو" : "Scenario"
      : question.question_type === "knowledge_check"
        ? rtl ? "اختبار معرفي" : "Knowledge check"
        : question.question_type === "rating"
          ? rtl ? "تقييم ذاتي" : "Self-rating"
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
          {rtl ? "١ = لا أوافق بشدة • ٥ = أوافق بشدة" : "1 = Strongly disagree • 5 = Strongly agree"}
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
  // Dim Submit until every required question is answered (read from the form
  // via context). Default true so a missing provider never traps the button.
  const allAnswered = useContext(CompletionContext);
  const [pending, start] = useTransition();
  // Distinct flushing state so the button label can show a more
  // honest "saving your answers" before it flips to "submitting"
  // - this is the gap the audit caught (clicks fired in <200ms
  // outran the debounce, click→submit was instant and left answers
  // unsaved).
  const [flushing, setFlushing] = useState(false);
  // Count of answers that could not be persisted even after the flush's
  // extra retry cycle. Submit REFUSES while this is non-zero - completing
  // anyway silently dropped those answers behind a success screen.
  const [unsavedCount, setUnsavedCount] = useState(0);

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
      // ALWAYS flush (not only when saves are pending): answers whose earlier
      // save exhausted its retries sit in 'error' state with nothing queued,
      // so a pending-only check skipped exactly the answers that needed help.
      const gate = FORM_GATES.get(token);
      let stillFailing = 0;
      if (gate) {
        setFlushing(true);
        try {
          stillFailing = await gate.flushPendingSaves();
        } finally {
          setFlushing(false);
        }
      }
      if (stillFailing > 0) {
        setUnsavedCount(stillFailing);
        return; // do NOT complete - the failed answers would be lost
      }
      setUnsavedCount(0);
      await onComplete();
    });
  };

  const label = pending
    ? (flushing
        ? (rtl ? "جارٍ حفظ إجاباتك..." : "Saving your answers…")
        : (rtl ? "جارٍ الإرسال..." : "Submitting…"))
    : (rtl ? "إرسال التقييم" : "Submit assessment");

  return (
    <div className="space-y-2">
      <Button
        onClick={handleClick}
        disabled={pending || !allAnswered}
        className="w-full"
      >
        {label}
      </Button>
      {unsavedCount > 0 && (
        <p className="rounded-md border border-rose-300 bg-rose-50 p-2 text-center text-xs text-rose-800">
          {rtl
            ? `تعذّر حفظ ${unsavedCount} من الإجابات. تحقق من اتصالك بالإنترنت ثم اضغط "إرسال التقييم" مرة أخرى.`
            : `${unsavedCount} answer${unsavedCount === 1 ? "" : "s"} could not be saved. Check your connection and press Submit again - nothing has been submitted yet.`}
        </p>
      )}
      {!allAnswered && (
        <p className="text-center text-xs text-muted-foreground">
          {rtl ? "أجب عن جميع الأسئلة لتفعيل الإرسال." : "Answer all questions to enable submit."}
        </p>
      )}
    </div>
  );
}
