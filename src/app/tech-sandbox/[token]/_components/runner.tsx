"use client";
// Candidate runner: timed, autosaving sandbox sitting for one function. Steps
// through every active skill block (spreadsheet / logic_input / sql), autosaves
// work, auto-submits on expiry, and shows the banded result.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import type { PublicBlueprint, PublicSkillBlock } from "@/lib/technical-sandbox/service";
import { proficiencyTier, proficiencyTierLabel } from "@/lib/competencies/proficiency-tier";
import { LogicInputEngine } from "./logic-input-engine";
import { SqlEngine } from "./sql-engine";
import type { SpreadsheetHandle } from "./spreadsheet-engine";

const SpreadsheetEngine = dynamic(
  () => import("./spreadsheet-engine").then((m) => m.SpreadsheetEngine),
  { ssr: false, loading: () => <div className="h-[460px] animate-pulse rounded-md bg-muted" /> },
);

type Work = Record<string, unknown>;
interface SubmitResult {
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
        blocks: { nameEn: string; scorePct: number; tier: "basic" | "intermediate" | "advanced" }[];
      }[];
    };
  };
}

export function Runner({
  token,
  blueprint,
  initialStatus,
}: {
  token: string;
  blueprint: PublicBlueprint;
  initialStatus: string;
}) {
  const blocks = useMemo<PublicSkillBlock[]>(
    () => blueprint.pillars.flatMap((p) => p.blocks),
    [blueprint],
  );
  const [locale, setLocale] = useState<"en" | "ar">("en");
  const [started, setStarted] = useState(initialStatus === "in_progress");
  const [submitted, setSubmitted] = useState(initialStatus === "submitted");
  const [result, setResult] = useState<SubmitResult["result"] | null>(null);
  const [idx, setIdx] = useState(0);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);

  const workRef = useRef<Record<string, Work>>({});
  const sheetRef = useRef<SpreadsheetHandle | null>(null);
  const ar = locale === "ar";
  const current = blocks[idx];

  const captureCurrentWork = useCallback(() => {
    if (!current) return;
    if (
      (current.engineType === "spreadsheet" || current.engineType === "advanced_spreadsheet") &&
      sheetRef.current
    ) {
      workRef.current[current.id] = sheetRef.current.readWork();
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
    captureCurrentWork();
    if (current) await save(current.id);
    const res = await fetch(`/api/tech-sandbox/${token}/submit`, { method: "POST" });
    const json = (await res.json()) as { ok: boolean } & SubmitResult;
    if (json.ok) {
      setSubmitted(true);
      setResult(json.result ?? null);
    }
  }, [captureCurrentWork, current, save, token]);

  // Start the sitting (stamps expiry).
  useEffect(() => {
    if (started || submitted) return;
    (async () => {
      const res = await fetch(`/api/tech-sandbox/${token}/start`, { method: "POST" });
      const json = (await res.json()) as { ok: boolean; expiresAt?: string };
      if (json.ok && json.expiresAt) {
        setExpiresAt(new Date(json.expiresAt).getTime());
        setStarted(true);
      }
    })();
  }, [started, submitted, token]);

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

  if (submitted) {
    return <Results blueprint={blueprint} result={result} locale={locale} />;
  }

  const fmt = (s: number | null) =>
    s == null ? "--:--" : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

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
                ref={sheetRef as never}
                config={current.engineConfig as never}
                locale={locale}
              />
            )}
          </div>

          <div className="flex items-center justify-between pt-3">
            <button
              disabled={idx === 0}
              onClick={() => goTo(idx - 1)}
              className="rounded-md border border-border px-4 py-2 text-sm text-foreground disabled:opacity-40 hover:bg-muted"
            >
              {ar ? "السابق" : "Previous"}
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
                className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:opacity-90"
              >
                {ar ? "إنهاء وتسليم" : "Finish & submit"}
              </button>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

function Results({
  blueprint,
  result,
  locale,
}: {
  blueprint: PublicBlueprint;
  result: SubmitResult["result"] | null;
  locale: "en" | "ar";
}) {
  const ar = locale === "ar";
  const score = result?.score;
  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <Link href="/" className="text-sm text-[#5391D5] hover:underline">
        {ar ? "الرئيسية" : "Home"}
      </Link>
      <div className="rounded-lg border border-border bg-card p-6 text-center">
        <h1 className="text-lg font-semibold text-foreground">
          {ar ? "اكتمل التقييم" : "Assessment complete"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {ar ? blueprint.nameAr ?? blueprint.nameEn : blueprint.nameEn}
        </p>
        {score && (
          <div className="mt-4">
            <div className="text-4xl font-bold text-foreground">{score.overallPct}%</div>
            <span
              className={`mt-2 inline-block rounded-full border px-3 py-1 text-sm ${proficiencyTier(score.overallPct).tone}`}
            >
              {proficiencyTierLabel(score.overallTier, locale)}
            </span>
          </div>
        )}
      </div>
      {score?.pillars.map((p) => (
        <div key={p.nameEn} className="rounded-lg border border-border bg-card p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-medium text-foreground">{ar ? p.nameAr ?? p.nameEn : p.nameEn}</h2>
            <span className="text-xs text-muted-foreground">
              {p.advancedCount} adv · {p.intermediateCount} int · {p.basicCount} basic
            </span>
          </div>
          <ul className="space-y-2">
            {p.blocks.map((b) => (
              <li key={b.nameEn} className="flex items-center justify-between text-sm">
                <span className="text-foreground">{b.nameEn}</span>
                <span className="flex items-center gap-2">
                  <span className="text-muted-foreground">{b.scorePct}%</span>
                  <span className={`rounded-full border px-2 py-0.5 text-xs ${proficiencyTier(b.scorePct).tone}`}>
                    {proficiencyTierLabel(b.tier, locale)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
