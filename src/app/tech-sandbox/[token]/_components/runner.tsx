"use client";
// Candidate runner: timed, autosaving sandbox sitting for one function. Steps
// through every active skill block (spreadsheet / logic_input / sql), autosaves
// work, auto-submits on expiry, and shows the banded result.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import dynamic from "next/dynamic";
import Link from "next/link";
import { AssessmentIntro, type IntroPoint } from "@/components/shared/assessment-intro";
import type { PublicBlueprint, PublicSkillBlock } from "@/lib/technical-sandbox/service";
import type { PublicTechTest } from "@/lib/ai/technical-assessment";
import { proficiencyTier, proficiencyTierLabel } from "@/lib/competencies/proficiency-tier";
import { ScoreMethodology } from "./score-methodology";
import { LogicInputEngine } from "./logic-input-engine";
import { SqlEngine } from "./sql-engine";
import type { SpreadsheetReader } from "./spreadsheet-engine";

type McqAnswer = number | number[];
type McqAnswers = Record<string, McqAnswer>;

const SpreadsheetEngine = dynamic(
  () => import("./spreadsheet-engine").then((m) => m.SpreadsheetEngine),
  { ssr: false, loading: () => <div className="h-[460px] animate-pulse rounded-md bg-muted" /> },
);

type Work = Record<string, unknown>;
interface CombinedSummary {
  mcqPct: number;
  hasMcqSection: boolean;
  mcqScorePct: number | null;
  sandboxScorePct: number;
  combinedPct: number;
  combinedBand: "basic" | "intermediate" | "advanced";
  mcqPassed: boolean;
  sandboxPassed: boolean;
  passed: boolean;
  certified: boolean;
  credentialCode: string | null;
}
export interface SubmitResult {
  result?: {
    score?: {
      overallPct: number;
      overallTier: "basic" | "intermediate" | "advanced";
      pillars: {
        nameEn: string;
        nameAr?: string | null;
        advancedCount: number;
        intermediateCount: number;
        basicCount: number;
        blocks: {
          nameEn: string;
          scorePct: number;
          tier: "basic" | "intermediate" | "advanced";
          checkpointResults?: { id: string; passed: boolean; label_en?: string; label_ar?: string }[];
        }[];
      }[];
    };
    combined?: CombinedSummary;
  };
}

export function Runner({
  token,
  blueprint,
  initialStatus,
  mcqPct = 0,
  mcqTest = null,
  initialResult = null,
  initialExpiresAt = null,
}: {
  token: string;
  blueprint: PublicBlueprint;
  initialStatus: string;
  mcqPct?: number;
  mcqTest?: PublicTechTest | null;
  initialResult?: SubmitResult["result"] | null;
  initialExpiresAt?: string | null;
}) {
  const blocks = useMemo<PublicSkillBlock[]>(
    () => blueprint.pillars.flatMap((p) => p.blocks),
    [blueprint],
  );
  const mcqItems = useMemo(() => mcqTest?.items ?? [], [mcqTest]);
  const hasMcq = mcqPct > 0 && mcqItems.length > 0;
  const [locale, setLocale] = useState<"en" | "ar">("en");
  const [started, setStarted] = useState(initialStatus === "in_progress");
  const [submitted, setSubmitted] = useState(initialStatus === "submitted");
  // Candidate-side result state is retained only so the submit handler can no-op
  // safely. The candidate is NOT shown results (see the `submitted` branch); the
  // scored report goes to the client / VIFM admin, never the taker.
  const [, setResult] = useState<SubmitResult["result"] | null>(initialResult);
  // Two-phase combined flow: knowledge (MCQ) section first, then hands-on blocks.
  const [phase, setPhase] = useState<"mcq" | "sandbox">(hasMcq ? "mcq" : "sandbox");
  // MCQ answers are client-side until submit; mirror to sessionStorage so a
  // mid-section reload doesn't wipe them.
  const [mcqAnswers, setMcqAnswers] = useState<McqAnswers>(() => {
    if (typeof window === "undefined" || !hasMcq) return {};
    try {
      const raw = window.sessionStorage.getItem(`mcq:${token}`);
      return raw ? (JSON.parse(raw) as McqAnswers) : {};
    } catch {
      return {};
    }
  });
  const [idx, setIdx] = useState(0);
  // Rehydrate the countdown across reloads from the persisted expiry (the
  // timer is otherwise only stamped in begin(), which a reload skips).
  const [expiresAt, setExpiresAt] = useState<number | null>(() =>
    initialStatus === "in_progress" && initialExpiresAt ? new Date(initialExpiresAt).getTime() : null,
  );
  const [remaining, setRemaining] = useState<number | null>(null);
  const [beginning, setBeginning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { i18n } = useTranslation();
  const at = useMemo(() => i18n.getFixedT(locale), [i18n, locale]);

  const workRef = useRef<Record<string, Work>>({});
  // Keep the latest MCQ answers available to the (memoized) submit callback
  // without forcing it to re-create on every keystroke.
  const mcqAnswersRef = useRef<McqAnswers>({});
  mcqAnswersRef.current = mcqAnswers;
  // Guards against a double-submit (manual "Finish" click racing the
  // auto-submit-on-expiry timer) firing two POSTs.
  const submittingRef = useRef(false);
  const sheetReaderRef = useRef<SpreadsheetReader | null>(null);
  const ar = locale === "ar";
  const current = blocks[idx];

  const captureCurrentWork = useCallback(() => {
    if (!current) return;
    if (
      (current.engineType === "spreadsheet" || current.engineType === "advanced_spreadsheet") &&
      sheetReaderRef.current
    ) {
      workRef.current[current.id] = sheetReaderRef.current();
    }
  }, [current]);

  const save = useCallback(
    async (blockId: string) => {
      const work = workRef.current[blockId] ?? {};
      try {
        await fetch(`/api/tech-sandbox/${token}/save`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ skillBlockId: blockId, work }),
        });
      } catch {
        /* autosave is best-effort */
      }
    },
    [token],
  );

  const submit = useCallback(async () => {
    if (submittingRef.current || submitted) return;
    submittingRef.current = true;
    setSubmitting(true);
    try {
      captureCurrentWork();
      if (current) await save(current.id);
      const res = await fetch(`/api/tech-sandbox/${token}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mcqAnswers: mcqAnswersRef.current }),
      });
      const json = (await res.json()) as { ok: boolean } & SubmitResult;
      if (json.ok) {
        setSubmitted(true);
        // Only adopt a result that carries scores; an already-submitted replay
        // returns { alreadySubmitted } and must not clobber a real result.
        if (json.result && json.result.score) setResult(json.result);
      }
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }, [captureCurrentWork, current, save, token, submitted]);

  const setMcqAnswer = useCallback(
    (id: string, value: McqAnswer) => {
      setMcqAnswers((prev) => {
        const next = { ...prev, [id]: value };
        try {
          if (typeof window !== "undefined") window.sessionStorage.setItem(`mcq:${token}`, JSON.stringify(next));
        } catch {
          /* sessionStorage best-effort */
        }
        return next;
      });
    },
    [token],
  );

  // Start the sitting (stamps expiry) - triggered from the intro's Start button
  // so the timer begins when the taker is ready, not on page load.
  const begin = useCallback(async () => {
    if (started || submitted || beginning) return;
    setBeginning(true);
    try {
      const res = await fetch(`/api/tech-sandbox/${token}/start`, { method: "POST" });
      const json = (await res.json()) as { ok: boolean; expiresAt?: string };
      if (json.ok && json.expiresAt) {
        setExpiresAt(new Date(json.expiresAt).getTime());
        setStarted(true);
      }
    } finally {
      setBeginning(false);
    }
  }, [started, submitted, beginning, token]);

  // Countdown + auto-submit.
  useEffect(() => {
    if (!started || submitted || !expiresAt) return;
    const t = setInterval(() => {
      const secs = Math.max(0, Math.round((expiresAt - Date.now()) / 1000));
      setRemaining(secs);
      if (secs <= 0) {
        clearInterval(t);
        void submit();
      }
    }, 1000);
    return () => clearInterval(t);
  }, [started, submitted, expiresAt, submit]);

  // Periodic autosave of the current block.
  useEffect(() => {
    if (!started || submitted) return;
    const t = setInterval(() => {
      captureCurrentWork();
      if (current) void save(current.id);
    }, 20000);
    return () => clearInterval(t);
  }, [started, submitted, current, captureCurrentWork, save]);

  function goTo(next: number) {
    captureCurrentWork();
    if (current) void save(current.id);
    setIdx(next);
  }

  // Results are intentionally HIDDEN from the candidate. On completion they see
  // only a confirmation; the scored report is delivered to the client / VIFM
  // admin (admin results view + the admin-gated PDF). Never render scores here.
  if (submitted) {
    const ar = locale === "ar";
    return (
      <div className="mx-auto max-w-md p-10 text-center" dir={ar ? "rtl" : "ltr"}>
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-2xl text-emerald-700">
          ✓
        </div>
        <h1 className="text-lg font-semibold text-[#010131]">
          {ar ? "تم إرسال تقييمك" : "Your assessment has been submitted"}
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {ar
            ? "شكراً لك. ستتم مشاركة نتائجك مع المؤسسة الطالبة للتقييم، ولا تُعرض هنا."
            : "Thank you. Your results will be shared with the requesting organization and are not shown here."}
        </p>
      </div>
    );
  }

  if (!started) {
    const engines = new Set(blocks.map((b) => b.engineType));
    const howTo: IntroPoint[] = [];
    if (hasMcq)
      howTo.push({
        label: ar ? "قسم المعرفة" : "Knowledge section",
        text: ar
          ? `${mcqItems.length} سؤال اختيار من متعدد يقيس معرفتك، يليه المهام العملية.`
          : `${mcqItems.length} multiple-choice questions test your knowledge, followed by the hands-on tasks.`,
      });
    if (engines.has("spreadsheet") || engines.has("advanced_spreadsheet"))
      howTo.push({ label: at("aintro.sandbox.spreadsheet.label"), text: at("aintro.sandbox.spreadsheet.text") });
    if (engines.has("sql")) howTo.push({ label: at("aintro.sandbox.sql.label"), text: at("aintro.sandbox.sql.text") });
    if (engines.has("logic_input")) howTo.push({ label: at("aintro.sandbox.logic.label"), text: at("aintro.sandbox.logic.text") });
    return (
      <div className="mx-auto max-w-4xl space-y-4 p-4">
        <div className="flex items-center justify-between">
          <Link href="/" className="text-sm text-[#5391D5] hover:underline">{ar ? "الرئيسية" : "Home"}</Link>
          <button
            onClick={() => setLocale(ar ? "en" : "ar")}
            className="rounded-md border border-border px-3 py-1 text-sm text-foreground hover:bg-muted"
          >
            {ar ? "English" : "العربية"}
          </button>
        </div>
        <AssessmentIntro
          dir={ar ? "rtl" : "ltr"}
          eyebrow={at("aintro.eyebrow")}
          title={at("aintro.title")}
          intro={at("aintro.sandbox.intro", { function: ar ? blueprint.nameAr ?? blueprint.nameEn : blueprint.nameEn })}
          howToTitle={at("aintro.howTo")}
          howTo={howTo}
          guidance={[at("aintro.sandbox.g1")]}
          note={{ tone: "amber", text: at("aintro.sandbox.g2") }}
          startLabel={at("aintro.sandbox.start")}
          onStart={begin}
          busy={beginning}
        />
      </div>
    );
  }

  const fmt = (s: number | null) =>
    s == null ? "--:--" : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  // ── Knowledge (MCQ) phase: runs first when the sitting carries a knowledge section ──
  if (hasMcq && phase === "mcq") {
    const answeredCount = mcqItems.filter((it) => {
      const a = mcqAnswers[it.id];
      return Array.isArray(a) ? a.length > 0 : a != null;
    }).length;
    return (
      <div className="mx-auto max-w-3xl space-y-4 p-4" dir={ar ? "rtl" : "ltr"}>
        <div className="flex items-center justify-between">
          <Link href="/" className="text-sm text-[#5391D5] hover:underline">{ar ? "الرئيسية" : "Home"}</Link>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setLocale(ar ? "en" : "ar")}
              className="rounded-md border border-border px-3 py-1 text-sm text-foreground hover:bg-muted"
            >
              {ar ? "English" : "العربية"}
            </button>
            <div className="text-right">
              <div className="text-xs text-muted-foreground">{ar ? "الوقت المتبقي" : "Time left"}</div>
              <div className="font-mono text-base text-foreground">{fmt(remaining)}</div>
            </div>
          </div>
        </div>

        <header className="rounded-lg border border-border bg-card p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            {ar ? "القسم الأول · المعرفة" : "Section 1 · Knowledge"}
            {blueprint.nodeId ? ` · ${blueprint.nodeId}` : ""}
          </div>
          <h1 className="text-lg font-semibold text-foreground">
            {ar ? blueprint.nameAr ?? blueprint.nameEn : blueprint.nameEn}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {ar
              ? "أجب عن أسئلة الاختيار من متعدد التالية. بعد ذلك تنتقل إلى المهام العملية."
              : "Answer the multiple-choice questions below. You then move on to the hands-on tasks."}
          </p>
          <div className="mt-2 text-xs text-muted-foreground">
            {ar ? `${answeredCount} / ${mcqItems.length} تمت الإجابة` : `${answeredCount} / ${mcqItems.length} answered`}
          </div>
        </header>

        <ol className="space-y-3">
          {mcqItems.map((item, i) => (
            <McqQuestion
              key={item.id}
              index={i}
              item={item}
              value={mcqAnswers[item.id]}
              onChange={(v) => setMcqAnswer(item.id, v)}
              ar={ar}
            />
          ))}
        </ol>

        <div className="flex items-center justify-between pt-2">
          <span className="text-xs text-muted-foreground">
            {ar
              ? "يمكنك ترك أي سؤال دون إجابة، لكن ذلك يخفض درجتك."
              : "You may leave any question blank, but unanswered questions lower your score."}
          </span>
          <button
            onClick={() => {
              setIdx(0);
              setPhase("sandbox");
            }}
            className="rounded-md bg-[#010131] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            {ar ? "المتابعة إلى المهام العملية" : "Continue to hands-on tasks"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4">
      <div className="flex items-center justify-between">
        <Link href="/" className="text-sm text-[#5391D5] hover:underline">
          {ar ? "الرئيسية" : "Home"}
        </Link>
        <button
          onClick={() => setLocale(ar ? "en" : "ar")}
          className="rounded-md border border-border px-3 py-1 text-sm text-foreground hover:bg-muted"
        >
          {ar ? "English" : "العربية"}
        </button>
      </div>

      <header className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              {ar ? "تقييم تقني" : "Technical Assessment"}
              {hasMcq ? (ar ? " · القسم الثاني · العملي" : " · Section 2 · Hands-on") : ""}
              {blueprint.nodeId ? ` · ${blueprint.nodeId}` : ""}
            </div>
            <h1 className="text-lg font-semibold text-foreground">
              {ar ? blueprint.nameAr ?? blueprint.nameEn : blueprint.nameEn}
            </h1>
          </div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground">{ar ? "الوقت المتبقي" : "Time left"}</div>
            <div className="font-mono text-lg text-foreground">{fmt(remaining)}</div>
          </div>
        </div>
      </header>

      {/* Knowledge-only custom sitting: no hands-on tasks - go straight to submit. */}
      {blocks.length === 0 && (
        <section className="space-y-4 rounded-lg border border-border bg-card p-6 text-center">
          <p className="text-sm text-muted-foreground">
            {ar
              ? "لا توجد مهام عملية في هذا التقييم. اضغط للإنهاء والتسليم."
              : "This assessment has no hands-on tasks. Press to finish and submit."}
          </p>
          <button
            onClick={() => void submit()}
            disabled={submitting}
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? (ar ? "جارٍ التسليم…" : "Submitting…") : ar ? "إنهاء وتسليم" : "Finish & submit"}
          </button>
        </section>
      )}

      {current && (
        <section className="space-y-3 rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              {ar ? "المهمة" : "Task"} {idx + 1} / {blocks.length}
            </span>
            {current.frameworkRef && <span className="text-xs">{current.frameworkRef}</span>}
          </div>
          <h2 className="text-base font-semibold text-foreground">
            {ar ? current.nameAr ?? current.nameEn : current.nameEn}
          </h2>
          {(current.promptEn || current.promptAr) && (
            <p className="text-sm text-muted-foreground">
              {ar ? current.promptAr ?? current.promptEn : current.promptEn}
            </p>
          )}

          <div className="pt-2">
            {current.engineType === "logic_input" && (
              <LogicInputEngine
                config={current.engineConfig as never}
                locale={locale}
                initialWork={workRef.current[current.id] as never}
                onChange={(w) => (workRef.current[current.id] = w)}
              />
            )}
            {current.engineType === "sql" && (
              <SqlEngine
                config={current.engineConfig as never}
                locale={locale}
                initialWork={workRef.current[current.id] as never}
                onChange={(w) => (workRef.current[current.id] = w)}
              />
            )}
            {(current.engineType === "spreadsheet" || current.engineType === "advanced_spreadsheet") && (
              <SpreadsheetEngine
                key={current.id}
                config={current.engineConfig as never}
                locale={locale}
                onRegister={(reader) => (sheetReaderRef.current = reader)}
              />
            )}
          </div>

          <div className="flex items-center justify-between pt-3">
            <button
              disabled={idx === 0 && !hasMcq}
              onClick={() => {
                if (idx === 0) {
                  if (hasMcq) {
                    captureCurrentWork();
                    if (current) void save(current.id);
                    setPhase("mcq");
                  }
                  return;
                }
                goTo(idx - 1);
              }}
              className="rounded-md border border-border px-4 py-2 text-sm text-foreground disabled:opacity-40 hover:bg-muted"
            >
              {idx === 0 && hasMcq ? (ar ? "العودة إلى المعرفة" : "Back to knowledge") : ar ? "السابق" : "Previous"}
            </button>
            {idx < blocks.length - 1 ? (
              <button
                onClick={() => goTo(idx + 1)}
                className="rounded-md bg-[#010131] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
              >
                {ar ? "التالي" : "Next"}
              </button>
            ) : (
              <button
                onClick={() => void submit()}
                disabled={submitting}
                className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                {submitting ? (ar ? "جارٍ التسليم…" : "Submitting…") : ar ? "إنهاء وتسليم" : "Finish & submit"}
              </button>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

function Results({
  token,
  blueprint,
  result,
  locale,
}: {
  token: string;
  blueprint: PublicBlueprint;
  result: SubmitResult["result"] | null;
  locale: "en" | "ar";
}) {
  const ar = locale === "ar";
  const score = result?.score;
  const combined = result?.combined;
  const showCombined = !!combined?.hasMcqSection;
  // The headline number is the blended score when there's a knowledge section,
  // else the sandbox overall (unchanged sandbox-only behaviour).
  const headlinePct = showCombined ? combined!.combinedPct : score?.overallPct ?? 0;
  const headlineBand = showCombined ? combined!.combinedBand : score?.overallTier ?? "basic";
  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4" dir={ar ? "rtl" : "ltr"}>
      <div className="flex items-center justify-between">
        <Link href="/" className="text-sm text-[#5391D5] hover:underline">
          {ar ? "الرئيسية" : "Home"}
        </Link>
        <a
          href={`/api/tech-sandbox/${token}/report`}
          className="rounded-md bg-[#010131] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          {ar ? "تنزيل التقرير PDF" : "Download PDF report"}
        </a>
      </div>
      <div className="rounded-lg border border-border bg-card p-6 text-center">
        <h1 className="text-lg font-semibold text-foreground">
          {ar ? "اكتمل التقييم" : "Assessment complete"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {ar ? blueprint.nameAr ?? blueprint.nameEn : blueprint.nameEn}
        </p>
        {(score || showCombined) && (
          <div className="mt-4">
            <div className="text-4xl font-bold text-foreground">{headlinePct}%</div>
            <span
              className={`mt-2 inline-block rounded-full border px-3 py-1 text-sm ${proficiencyTier(headlinePct).tone}`}
            >
              {proficiencyTierLabel(headlineBand, locale)}
            </span>
            {showCombined && (
              <p className="mt-2 text-xs text-muted-foreground">
                {ar
                  ? `الدرجة المجمعة · المعرفة ${combined!.mcqPct}% + العملي ${100 - combined!.mcqPct}%`
                  : `Combined score · knowledge ${combined!.mcqPct}% + hands-on ${100 - combined!.mcqPct}%`}
              </p>
            )}
          </div>
        )}
      </div>

      {score && (
        <ScoreMethodology
          overallPct={score.overallPct}
          overallTier={score.overallTier}
          pillars={score.pillars}
          ar={ar}
          showCombined={showCombined}
          mcqPct={combined?.mcqPct ?? 0}
        />
      )}

      {showCombined && (
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-border bg-card p-4 text-center">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              {ar ? "المعرفة" : "Knowledge"}
            </div>
            <div className="mt-1 text-2xl font-semibold text-foreground">
              {combined!.mcqScorePct == null ? "--" : `${combined!.mcqScorePct}%`}
            </div>
            <div className={`mt-1 text-xs ${combined!.mcqPassed ? "text-emerald-600" : "text-red-500"}`}>
              {combined!.mcqPassed ? (ar ? "اجتاز الحد الأدنى" : "Met the floor") : ar ? "دون الحد الأدنى" : "Below the floor"}
            </div>
          </div>
          <div className="rounded-lg border border-border bg-card p-4 text-center">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              {ar ? "العملي" : "Hands-on"}
            </div>
            <div className="mt-1 text-2xl font-semibold text-foreground">{combined!.sandboxScorePct}%</div>
            <div className={`mt-1 text-xs ${combined!.sandboxPassed ? "text-emerald-600" : "text-red-500"}`}>
              {combined!.sandboxPassed ? (ar ? "اجتاز الحد الأدنى" : "Met the floor") : ar ? "دون الحد الأدنى" : "Below the floor"}
            </div>
          </div>
        </div>
      )}

      {combined?.credentialCode ? (
        <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-center dark:border-emerald-900 dark:bg-emerald-950/30">
          <div className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
            {ar ? "تم إصدار شهادة الكفاءة الفنية" : "Technical Proficiency credential issued"}
          </div>
          <a
            href={`/verify/${combined.credentialCode}`}
            className="mt-1 inline-block text-xs text-[#5391D5] hover:underline"
          >
            {ar ? "تحقق من الشهادة" : "Verify this credential"}
          </a>
        </div>
      ) : showCombined ? (
        <div className="rounded-lg border border-border bg-muted/40 p-4 text-center text-xs text-muted-foreground">
          {combined!.certified
            ? ar
              ? "لم تُصدر شهادة: يجب اجتياز كلا القسمين وتجاوز الحد العام."
              : "No credential issued: both sections must clear their floor and the overall bar."
            : ar
              ? "نتيجة إرشادية: قسم المعرفة لم يُجمَّع من بنك معتمد، لذا لا تُصدر شهادة."
              : "Indicative result: the knowledge section was not assembled from the approved bank, so no credential is issued."}
        </div>
      ) : null}
      {score?.pillars.map((p) => (
        <div key={p.nameEn} className="rounded-lg border border-border bg-card p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-medium text-foreground">{ar ? p.nameAr ?? p.nameEn : p.nameEn}</h2>
            <span className="text-xs text-muted-foreground">
              {p.advancedCount} adv · {p.intermediateCount} int · {p.basicCount} basic
            </span>
          </div>
          <ul className="space-y-3">
            {p.blocks.map((b) => (
              <li key={b.nameEn} className="text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-foreground">{b.nameEn}</span>
                  <span className="flex items-center gap-2">
                    <span className="text-muted-foreground">{b.scorePct}%</span>
                    <span className={`rounded-full border px-2 py-0.5 text-xs ${proficiencyTier(b.scorePct).tone}`}>
                      {proficiencyTierLabel(b.tier, locale)}
                    </span>
                  </span>
                </div>
                {b.checkpointResults && b.checkpointResults.length > 0 && (
                  <ul className="mt-1.5 space-y-0.5 ps-1">
                    {b.checkpointResults.map((c) => (
                      <li key={c.id} className="flex items-start gap-1.5 text-xs">
                        <span className={c.passed ? "text-emerald-600" : "text-red-500"}>
                          {c.passed ? "✓" : "✗"}
                        </span>
                        <span className="text-muted-foreground">
                          {(ar ? c.label_ar ?? c.label_en : c.label_en) ?? c.id}
                        </span>
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

type McqItem = NonNullable<PublicTechTest["items"]>[number];

/** One MCQ knowledge item: single / scenario / true_false render as radios;
 *  multi renders as checkboxes (select-all-that-apply). Answers are indices. */
function McqQuestion({
  index,
  item,
  value,
  onChange,
  ar,
}: {
  index: number;
  item: McqItem;
  value: McqAnswer | undefined;
  onChange: (v: McqAnswer) => void;
  ar: boolean;
}) {
  const isMulti = item.type === "multi";
  const selected = Array.isArray(value) ? value : value != null ? [value] : [];
  const typeChip =
    item.type === "multi"
      ? ar ? "اختر كل ما ينطبق" : "Select all that apply"
      : item.type === "scenario"
        ? ar ? "سيناريو" : "Scenario"
        : item.type === "true_false"
          ? ar ? "صح / خطأ" : "True / False"
          : ar ? "اختيار واحد" : "Single answer";

  function toggle(i: number) {
    if (isMulti) {
      const set = new Set(selected);
      if (set.has(i)) set.delete(i);
      else set.add(i);
      onChange(Array.from(set).sort((a, b) => a - b));
    } else {
      onChange(i);
    }
  }

  return (
    <li className="rounded-lg border border-border bg-card p-4">
      <div className="mb-1 flex items-center gap-2">
        <span className="text-sm font-semibold text-foreground">{index + 1}.</span>
        <span className="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
          {typeChip}
        </span>
      </div>
      {item.scenario && (
        <div className="mb-2 rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground whitespace-pre-wrap">
          {item.scenario}
        </div>
      )}
      <p className="text-sm font-medium text-foreground">{item.question}</p>
      <div className="mt-3 space-y-2">
        {item.options.map((opt, i) => {
          const checked = selected.includes(i);
          return (
            <label
              key={i}
              className={`flex cursor-pointer items-start gap-2 rounded-md border px-3 py-2 text-sm ${
                checked ? "border-[#5391D5] bg-[#5391D5]/10" : "border-border hover:bg-muted"
              }`}
            >
              <input
                type={isMulti ? "checkbox" : "radio"}
                name={`mcq-${item.id}`}
                checked={checked}
                onChange={() => toggle(i)}
                className="mt-0.5"
              />
              <span className="text-foreground">{opt}</span>
            </label>
          );
        })}
      </div>
    </li>
  );
}
