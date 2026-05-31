export const dynamic = "force-dynamic";

import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft, ClipboardCheck, PenLine, Mic } from "lucide-react";
import { createServiceClient } from "@/lib/supabase/server";
import { getServerT, type ServerT } from "@/lib/i18n/server";
import { CEFR_ORDER, type CefrLevel } from "@/lib/ai/fluent-english";
import { quadraticWeightedKappa, QWK_ACCEPTABLE } from "@/lib/scoring/qwk";
import { RatingForm } from "./_components/rating-form";

export const metadata = { title: "Fluent · Scoring calibration" };

type SkillScore = { cefr?: string; transcript?: string; attempted?: boolean };
type ResultRow = {
  id: string;
  taker_name: string | null;
  created_at: string;
  result: { writing?: SkillScore; speaking?: SkillScore } | null;
};
type Run = { result_id: string; skill: string; raw: { response?: string; transcript?: string } | null };
type Human = { result_id: string; skill: string; human_cefr: string };

const rank = (c: string) => CEFR_ORDER.indexOf(c as CefrLevel) + 1;

const CEFR_TONE: Record<string, string> = {
  A1: "bg-rose-100 text-rose-800", A2: "bg-amber-100 text-amber-800",
  B1: "bg-sky-100 text-sky-800", B2: "bg-blue-100 text-blue-800",
  C1: "bg-emerald-100 text-emerald-800", C2: "bg-emerald-200 text-emerald-900",
};

async function load() {
  try {
    const sb = createServiceClient();
    const r = (await sb
      .from("eng_fluent_results")
      .select("id, taker_name, created_at, result")
      .order("created_at", { ascending: false })
      .limit(50)) as unknown as { data: ResultRow[] | null; error: unknown };
    if (r.error || !r.data) return null;
    const results = r.data;
    const ids = results.map((x) => x.id);
    if (ids.length === 0) return { results, runs: [] as Run[], humans: [] as Human[] };
    const runRes = (await sb
      .from("eng_fluent_score_runs")
      .select("result_id, skill, raw")
      .in("result_id", ids)) as unknown as { data: Run[] | null };
    const humRes = (await sb
      .from("eng_fluent_human_ratings")
      .select("result_id, skill, human_cefr")
      .in("result_id", ids)) as unknown as { data: Human[] | null };
    return { results, runs: runRes.data ?? [], humans: humRes.data ?? [] };
  } catch {
    return null;
  }
}

export default async function FluentCalibrationPage() {
  const t = await getServerT("en"); // Fluent stays English regardless of locale cookie
  const data = await load();

  return (
    <div className="min-h-screen bg-[#F5F7FA]">
      <header className="border-b bg-white">
        <div className="mx-auto max-w-4xl px-6 py-5">
          <Link href="/ac/fluent" className="mb-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3 w-3" /> {t("acFluent.backToFluent")}
          </Link>
          <div className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-[#5391D5]" />
            <h1 className="text-xl font-semibold text-[#010131]">{t("acFluent.calibrationTitle")}</h1>
          </div>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            {t("acFluent.calibrationIntroPrefix")}{" "}
            <strong>{t("acFluent.calibrationQwkName")}</strong> {t("acFluent.calibrationIntroSuffix", { threshold: QWK_ACCEPTABLE.toFixed(2) })}
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-6 px-6 py-8">
        {!data && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <strong>{t("acFluent.calibrationNoStoreTitle")}</strong> {t("acFluent.calibrationNoStoreBodyPrefix")}{" "}
            <code className="text-xs">00042</code> + <code className="text-xs">00046</code> {t("acFluent.calibrationNoStoreBodySuffix")}
          </div>
        )}

        {data && <CalibrationBody {...data} t={t} />}
      </main>
    </div>
  );
}

function CalibrationBody({ results, runs, humans, t }: { results: ResultRow[]; runs: Run[]; humans: Human[]; t: ServerT }) {
  const responseByResult = new Map<string, string>();
  for (const run of runs) {
    if (run.skill === "writing" && run.raw?.response) responseByResult.set(run.result_id, run.raw.response);
  }
  const humanByKey = new Map<string, string>();
  for (const h of humans) humanByKey.set(`${h.result_id}:${h.skill}`, h.human_cefr);

  const qwkFor = (skill: "writing" | "speaking") => {
    const ai: number[] = [];
    const hum: number[] = [];
    for (const h of humans.filter((x) => x.skill === skill)) {
      const aiCefr = results.find((r) => r.id === h.result_id)?.result?.[skill]?.cefr;
      if (aiCefr) {
        ai.push(rank(aiCefr));
        hum.push(rank(h.human_cefr));
      }
    }
    return { q: quadraticWeightedKappa(ai, hum), n: ai.length };
  };
  const wQ = qwkFor("writing");
  const sQ = qwkFor("speaking");

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <QwkCard label={t("acFluent.skillWriting")} icon={<PenLine className="h-4 w-4" />} q={wQ.q} n={wQ.n} t={t} />
        <QwkCard label={t("acFluent.skillSpeaking")} icon={<Mic className="h-4 w-4" />} q={sQ.q} n={sQ.n} t={t} />
      </div>

      <section className="space-y-4">
        {results.length === 0 && (
          <div className="rounded-xl border bg-white p-6 text-center text-sm text-muted-foreground shadow-sm">
            {t("acFluent.calibrationNoResultsPrefix")} <Link href="/ac/fluent" className="text-[#5391D5] underline">/ac/fluent</Link>{t("acFluent.calibrationNoResultsSuffix")}
          </div>
        )}
        {results.map((res) => {
          const w = res.result?.writing;
          const s = res.result?.speaking;
          const response = responseByResult.get(res.id) ?? "";
          const transcript = s?.transcript ?? "";
          const hasSpeaking = !!s?.attempted;
          return (
            <div key={res.id} className="rounded-xl border bg-white p-5 shadow-sm">
              <div className="mb-3 flex items-center justify-between gap-2 text-xs text-slate-500">
                <span className="font-medium text-[#010131]">{res.taker_name || t("acFluent.anonymous")}</span>
                <span>{new Date(res.created_at).toLocaleString("en-GB")}</span>
              </div>

              <div className="space-y-3">
                <Block icon={<PenLine className="h-4 w-4 text-[#5391D5]" />} title={t("acFluent.skillWriting")} aiCefr={w?.cefr} text={response} t={t} />
                {hasSpeaking && (
                  <Block icon={<Mic className="h-4 w-4 text-[#5391D5]" />} title={t("acFluent.calibrationSpeakingTranscript")} aiCefr={s?.cefr} text={transcript} t={t} />
                )}
              </div>

              <RatingForm
                resultId={res.id}
                writingHuman={humanByKey.get(`${res.id}:writing`) ?? null}
                speakingHuman={humanByKey.get(`${res.id}:speaking`) ?? null}
                hasSpeaking={hasSpeaking}
              />
            </div>
          );
        })}
      </section>
    </>
  );
}

function QwkCard({ label, icon, q, n, t }: { label: string; icon: ReactNode; q: number; n: number; t: ServerT }) {
  const ok = !Number.isNaN(q) && q >= QWK_ACCEPTABLE;
  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm">
      <p className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-slate-500">{icon} {label} {t("acFluent.qwkSuffix")}</p>
      <p className={`mt-1 text-2xl font-bold ${Number.isNaN(q) ? "text-slate-400" : ok ? "text-emerald-600" : "text-amber-600"}`}>
        {Number.isNaN(q) ? "-" : q.toFixed(2)}
      </p>
      <p className="text-[11px] text-slate-500">
        {n === 0
          ? t("acFluent.qwkNoRatings")
          : ok
          ? t("acFluent.qwkRatedAcceptable", { count: n })
          : t("acFluent.qwkRatedBelow", { count: n })}
      </p>
    </div>
  );
}

function Block({ icon, title, aiCefr, text, t }: { icon: ReactNode; title: string; aiCefr?: string; text: string; t: ServerT }) {
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <div className="mb-1 flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#010131]">{icon} {title}</span>
        {aiCefr && (
          <span className={`rounded px-1.5 py-0.5 text-[11px] font-bold ${CEFR_TONE[aiCefr] ?? "bg-slate-100 text-slate-700"}`}>
            {t("acFluent.aiPrefix")} {aiCefr}
          </span>
        )}
      </div>
      <p dir="ltr" className="max-h-32 overflow-y-auto whitespace-pre-wrap text-xs leading-relaxed text-slate-700">
        {text || <span className="text-slate-400">{t("acFluent.calibrationNoTextCaptured")}</span>}
      </p>
    </div>
  );
}
