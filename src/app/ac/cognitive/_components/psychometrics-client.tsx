"use client";

import { useState, useEffect, useRef } from "react";
import { BrainCircuit, Sparkles, Loader2, CheckCircle2, RotateCcw, AlertTriangle, Download, Clock, Ticket } from "lucide-react";
import type { PsyTestPublic, PsyResult, ScaleScore } from "@/lib/psychometrics/scoring";
import { COGNITIVE_SUBTESTS, COGNITIVE_SUBTEST_KEYS, cognitiveNarrative } from "@/lib/psychometrics/framework";

type Lang = "en" | "ar";

export type EngagementOption = {
  id: string;
  name: string;
  candidates: { id: string; full_name: string }[];
};

const BAND_TONE: Record<string, string> = {
  low: "bg-rose-100 text-rose-800",
  below: "bg-amber-100 text-amber-800",
  average: "bg-sky-100 text-sky-800",
  above: "bg-emerald-100 text-emerald-800",
  high: "bg-emerald-200 text-emerald-900",
};

const scaleName = (key: string): string =>
  COGNITIVE_SUBTESTS.find((s) => s.key === key)?.name_en ?? key;
const scaleDesc = (key: string): string =>
  COGNITIVE_SUBTESTS.find((s) => s.key === key)?.desc_en ?? "";
const scaleDefinition = (key: string): string =>
  COGNITIVE_SUBTESTS.find((s) => s.key === key)?.definition_en ?? "";

export function PsychometricsClient({
  candidateId, engagementId, engagements = [], redemptionToken = null, prefillName, timerMinutes, lockedSubtests = null, onDark = false,
}: {
  candidateId: string | null;
  engagementId: string | null;
  engagements?: EngagementOption[];
  /** Voucher redemption token (delegate flow); stamps the result with the client org. */
  redemptionToken?: string | null;
  prefillName?: string;
  /** Admin-configurable time limit (minutes); null/0 = no limit. */
  timerMinutes?: number | null;
  /** When set (e.g. an admin-pinned voucher), the subtest set is fixed and the
   *  picker is hidden. null = taker chooses. */
  lockedSubtests?: string[] | null;
  /** The take page overlaps the component's header onto its dark hero banner -
   *  render the title + subtitle light so they stay readable. */
  onDark?: boolean;
}) {
  const limitMinutes = timerMinutes && timerMinutes > 0 ? timerMinutes : null;
  const [phase, setPhase] = useState<"intro" | "test" | "result">("intro");
  const [lang, setLang] = useState<Lang>("en");
  // SD-4: which cognitive subtests to run. Defaults to all four; the taker can
  // narrow on the intro screen unless an admin has locked the set.
  const lockedSet =
    lockedSubtests && lockedSubtests.length > 0
      ? COGNITIVE_SUBTEST_KEYS.filter((k) => lockedSubtests.includes(k))
      : null;
  const [selectedSubtests, setSelectedSubtests] = useState<string[]>(
    lockedSet && lockedSet.length > 0 ? lockedSet : [...COGNITIVE_SUBTEST_KEYS]
  );
  const toggleSubtest = (key: string) =>
    setSelectedSubtests((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...COGNITIVE_SUBTEST_KEYS.filter((k) => prev.includes(k) || k === key)]
    );
  // The instrument description reflects the ACTUAL scope (a locked voucher set
  // or the taker's live selection) instead of always naming all four subtests.
  const activeSubtests = selectedSubtests.length > 0 ? selectedSubtests : [...COGNITIVE_SUBTEST_KEYS];
  const subtestPhrase =
    activeSubtests.length === COGNITIVE_SUBTEST_KEYS.length
      ? "Numerical, verbal, inductive and deductive reasoning"
      : activeSubtests.map(scaleName).join(" · ");
  // Countdown: deadline stamped when the test starts; on expiry, auto-submit.
  const [deadline, setDeadline] = useState<number | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  // Cognitive candidate picker - optional binding. Blank = anonymous.
  const [cogEng, setCogEng] = useState("");
  const [cogCand, setCogCand] = useState("");
  const [takerName, setTakerName] = useState(prefillName ?? "");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [test, setTest] = useState<PsyTestPublic | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<PsyResult | null>(null);
  const [resultId, setResultId] = useState<string | null>(null);
  // XP-13: only VIFM staff see results on-screen; a taker gets a thank-you.
  const [canView, setCanView] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const start = async () => {
    setBusy(true); setError("");
    try {
      // URL binding wins; otherwise honour the optional candidate picker (blank = anonymous).
      const boundCandidateId = candidateId ?? (cogCand || null);
      const boundEngagementId = engagementId ?? (cogEng || null);
      const res = await fetch("/api/ac/cognitive", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start", language: lang, candidateId: boundCandidateId, engagementId: boundEngagementId, takerEmail: null, subtests: selectedSubtests, redemptionToken }),
      });
      const d = await res.json();
      if (!res.ok || !d.test) { setError(d.error || "Could not start."); return; }
      setSessionId(d.session_id); setTest(d.test as PsyTestPublic); setAnswers({}); setResult(null); setResultId(null);
      setDeadline(limitMinutes ? Date.now() + limitMinutes * 60_000 : null);
      setPhase("test");
    } catch { setError("Could not start."); } finally { setBusy(false); }
  };

  const submit = async () => {
    if (!test || !sessionId) return;
    setBusy(true); setError("");
    try {
      const res = await fetch("/api/ac/cognitive", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "score", session_id: sessionId, answers, takerName: takerName.trim() || null, language: lang, redemptionToken }),
      });
      const d = await res.json();
      // XP-13: a NON-STAFF taker's successful response deliberately carries
      // result=null (no score data over the wire), so success is res.ok alone -
      // requiring d.result here mislabelled every voucher taker's successful
      // submit as "Could not score." (and their retry hit the single-use guard).
      if (!res.ok) { setError(d.error || "Could not score."); return; }
      setResult((d.result as PsyResult | null) ?? null);
      setResultId(d.result_id ?? null);
      setCanView(d.isStaff === true && !!d.result);
      setPhase("result");
    } catch { setError("Could not score."); } finally { setBusy(false); }
  };

  const reset = () => {
    setPhase("intro"); setTest(null); setSessionId(null); setAnswers({});
    setResult(null); setResultId(null); setError(""); setDeadline(null); setRemaining(null);
  };

  // Countdown + auto-submit on expiry. firedRef guards against a double submit
  // if a tick lands while the async submit is still in flight.
  const submitRef = useRef(submit);
  submitRef.current = submit;
  const firedRef = useRef(false);
  useEffect(() => {
    if (phase !== "test" || deadline == null) { firedRef.current = false; return; }
    const tick = () => {
      const ms = deadline - Date.now();
      if (ms <= 0) {
        setRemaining(0);
        if (!firedRef.current) { firedRef.current = true; submitRef.current(); }
      } else {
        setRemaining(Math.ceil(ms / 1000));
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [phase, deadline]);

  // Guard against losing answers: while the test is open, answers live only in
  // component state (no autosave), so warn before a refresh / close / navigation.
  useEffect(() => {
    if (phase !== "test") return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [phase]);

  const total = test ? test.items.length : 0;
  const answered = Object.keys(answers).length;
  const canSubmit = total > 0 && answered === total && !busy;

  return (
    <div dir={lang === "ar" ? "rtl" : "ltr"} className="space-y-5">
      <div>
        <h1 className={`inline-flex items-center gap-2 text-2xl font-bold ${onDark ? "text-white" : "text-[#010131]"}`}>
          <BrainCircuit className="h-6 w-6 text-[#5391D5]" /> Logica®
        </h1>
        <p className={`mt-1 text-sm ${onDark ? "text-white/80" : "text-muted-foreground"}`}>
          {subtestPhrase} - an <strong>indicative</strong> developmental read,
          not a norm-referenced or high-stakes score.
        </p>
      </div>

      {error && <div className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}

      {phase === "intro" && (
        <div className="space-y-5 rounded-xl border bg-card p-6">
          <div className="rounded-lg border border-[#5391D5] bg-[#5391D5]/5 p-4">
            <p className="font-semibold text-[#010131]">Logica®</p>
            <p className="mt-1 text-xs text-muted-foreground">{subtestPhrase} (timed-style MCQs).</p>
          </div>

          {/* SD-4: subtest selection. Hidden when an admin has locked the set. */}
          {!lockedSet && (
            <div className="rounded-lg border border-slate-200 p-3">
              <p className="text-xs font-medium text-[#010131]">
                {lang === "ar" ? "اختر الاختبارات الفرعية" : "Choose subtests"}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {lang === "ar"
                  ? "اختر اختبارًا واحدًا أو أكثر. الافتراضي هو الأربعة جميعًا."
                  : "Pick one or more. The default is all four."}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {COGNITIVE_SUBTESTS.map((s) => {
                  const on = selectedSubtests.includes(s.key);
                  return (
                    <button
                      key={s.key}
                      type="button"
                      onClick={() => toggleSubtest(s.key)}
                      aria-pressed={on}
                      className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                        on
                          ? "border-[#5391D5] bg-[#5391D5] text-white"
                          : "border-slate-300 text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      {lang === "ar" ? s.name_ar : s.name_en}
                    </button>
                  );
                })}
              </div>
              {selectedSubtests.length === 0 && (
                <p className="mt-2 text-xs text-rose-600">
                  {lang === "ar" ? "اختر اختبارًا فرعيًا واحدًا على الأقل." : "Select at least one subtest."}
                </p>
              )}
              {/* Admin surface only (voucher takers arrive with a token/locked set):
                  issue a voucher scoped to exactly this selection. */}
              {!redemptionToken && selectedSubtests.length > 0 && (
                <a
                  href={`/ac/cognitive/vouchers?subtests=${selectedSubtests.join(",")}`}
                  className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[#5391D5] hover:underline"
                >
                  <Ticket className="h-3.5 w-3.5" />
                  {lang === "ar"
                    ? "أصدر قسيمة لهذا الاختيار"
                    : `Issue a voucher for this selection (${selectedSubtests.length === COGNITIVE_SUBTEST_KEYS.length ? "full battery" : selectedSubtests.map(scaleName).join(" · ")})`}
                </a>
              )}
            </div>
          )}
          {!candidateId && engagements.length > 0 && (
            <div className="rounded-lg border border-slate-200 p-3">
              <p className="text-xs font-medium text-[#010131]">Run for a specific candidate (optional)</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Bind this result to a candidate record, or leave blank for an anonymous run.</p>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                <label className="text-sm">
                  <span className="text-xs font-medium text-slate-500">Engagement</span>
                  <select
                    value={cogEng}
                    onChange={(e) => { setCogEng(e.target.value); setCogCand(""); }}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="">Anonymous (no candidate)</option>
                    {engagements.map((e) => (
                      <option key={e.id} value={e.id}>{e.name} ({e.candidates.length})</option>
                    ))}
                  </select>
                </label>
                <label className="text-sm">
                  <span className="text-xs font-medium text-slate-500">Candidate</span>
                  <select
                    value={cogCand}
                    onChange={(e) => setCogCand(e.target.value)}
                    disabled={!cogEng}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-400"
                  >
                    <option value="">{cogEng ? "Select a candidate…" : "Anonymous"}</option>
                    {(engagements.find((e) => e.id === cogEng)?.candidates ?? []).map((c) => (
                      <option key={c.id} value={c.id}>{c.full_name}</option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
          )}
          <div className="flex flex-wrap items-end gap-4">
            <label className="flex-1 min-w-[12rem]">
              <span className="text-xs font-medium text-slate-500">Your name (optional)</span>
              <input value={takerName} onChange={(e) => setTakerName(e.target.value)} dir="ltr"
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="e.g. Sara Al Mansoori" />
            </label>
            <div className="flex items-center gap-2">
              <span className="text-[11px] uppercase tracking-wide text-slate-400">Language</span>
              <div className="inline-flex rounded-lg border border-slate-200 p-0.5">
                {(["en", "ar"] as Lang[]).map((l) => (
                  <button key={l} onClick={() => setLang(l)}
                    className={`rounded-md px-3 py-1.5 text-sm font-medium ${lang === l ? "bg-[#5391D5] text-white" : "text-slate-600 hover:bg-slate-100"}`}>
                    {l === "en" ? "English" : "العربية"}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <button onClick={start} disabled={busy || selectedSubtests.length === 0}
            className="inline-flex items-center gap-2 rounded-lg bg-[#010131] px-6 py-3 text-sm font-semibold text-white hover:bg-[#121140] disabled:opacity-60">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {busy ? "Preparing…" : "Begin cognitive assessment"}
          </button>
        </div>
      )}

      {phase === "test" && test && (
        <div className="space-y-4">
          {test.kind === "cognitive"
            ? test.items.map((item, i) => (
                <section key={item.id} className="rounded-lg border bg-white p-4">
                  <p className="text-sm font-semibold text-[#010131]">{i + 1}. {item.stem}</p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {item.options.map((opt, oi) => (
                      <label key={oi} className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm ${answers[item.id] === oi ? "border-[#5391D5] bg-[#5391D5]/5" : "border-slate-200 hover:bg-slate-50"}`}>
                        <input type="radio" name={item.id} checked={answers[item.id] === oi}
                          onChange={() => setAnswers((a) => ({ ...a, [item.id]: oi }))} className="accent-[#5391D5]" />
                        <span>{opt}</span>
                      </label>
                    ))}
                  </div>
                </section>
              ))
            : null}

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">{answered}/{total} answered</span>
              {remaining != null && (
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums ${remaining <= 60 ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-600"}`}>
                  <Clock className="h-3 w-3" />
                  {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, "0")}
                </span>
              )}
            </div>
            <button onClick={submit} disabled={!canSubmit}
              className="inline-flex items-center gap-2 rounded-md bg-[#047857] px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {busy ? "Scoring…" : "Submit"}
            </button>
          </div>
        </div>
      )}

      {/* XP-13: takers do not see results - a thank-you only. Staff see scores.
          The non-staff response carries result=null (no score data over the wire),
          so this branch must not depend on `result` being present. */}
      {phase === "result" && !canView && (
        <div className="rounded-xl border bg-white p-8 text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
          <h2 className="mt-3 text-xl font-bold text-[#010131]">
            {lang === "ar" ? "تم إرسال تقييمك" : "Your assessment has been submitted"}
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
            {lang === "ar"
              ? "تمت مشاركة نتائجك مع الجهة الطالبة ولا تُعرض هنا. شكرًا لك."
              : "Your results have been shared with the requesting organisation and are not shown here. Thank you."}
          </p>
          <button onClick={reset} className="mt-5 inline-flex items-center gap-2 rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
            <RotateCcw className="h-4 w-4" /> {lang === "ar" ? "البدء من جديد" : "Start over"}
          </button>
        </div>
      )}

      {phase === "result" && result && canView && (
        <div className="space-y-5 rounded-xl border bg-white p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            {takerName.trim()
              ? <p className="text-sm text-slate-500">Result for <span className="font-semibold text-[#010131]">{takerName.trim()}</span></p>
              : <span />}
            <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${result.tier === "calibrated" ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>
              {result.tier === "calibrated" ? "Tier 2 · Norm-referenced" : "Tier 1 · Indicative"}
            </span>
          </div>

          {result.overall && (
            <div className="flex items-center gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-wider text-slate-500">Overall (general ability)</p>
                <span className={`mt-1 inline-block rounded-lg px-4 py-2 text-2xl font-bold ${BAND_TONE[result.overall.band]}`}>{result.overall.bandLabel}</span>
                {result.overall.percentile != null && (
                  <span className="ms-2 text-sm font-medium text-slate-500">{Math.round(result.overall.percentile)}th percentile</span>
                )}
              </div>
            </div>
          )}

          <div className="space-y-3">
            {result.scales.map((s: ScaleScore) => (
              <div key={s.key} className="rounded-lg border border-slate-100 bg-slate-50/40 p-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-[#010131]">{scaleName(s.key)}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${BAND_TONE[s.band]}`}>
                    {s.bandLabel}{s.sten ? ` · sten ${s.sten}` : ""}
                  </span>
                </div>
                <div className="mt-1 h-2 w-full rounded-full bg-slate-100">
                  <div className="h-2 rounded-full bg-[#5391D5]" style={{ width: `${Math.max(4, s.normalized)}%` }} />
                </div>
                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                  {scaleDefinition(s.key) || scaleDesc(s.key)}
                  {s.percentile != null && <span className="font-medium text-[#5391D5]"> · {Math.round(s.percentile)}th percentile</span>}
                </p>
                <p className="mt-1 text-[11px] font-medium leading-relaxed text-[#010131]">
                  {cognitiveNarrative(s.raw, false)}
                </p>
              </div>
            ))}
          </div>

          {result.validity?.flag && (
            <div className="inline-flex items-start gap-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Response-style check: the profile shows {result.validity.socialDesirability >= 4.5 ? "uniformly high self-ratings" : "high inconsistency"} - interpret with care.
            </div>
          )}

          {result.tier === "calibrated" ? (
            <p className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
              <strong>Norm-referenced</strong> result - scored against the VIFM reference group (percentiles + sten). A screening signal to inform a human decision, never an automatic one.
            </p>
          ) : (
            <p className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
              This is an <strong>indicative</strong> result based on raw scores, not local norms or IRT calibration - for development and self-insight, not a standalone hiring decision.
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <button onClick={reset} className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
              <RotateCcw className="h-4 w-4" /> Start over
            </button>
            {resultId && (
              <a
                href={`/api/ac/cognitive/${resultId}/report`}
                className="inline-flex items-center gap-2 rounded-md bg-[#010131] px-4 py-2 text-sm font-medium text-white hover:bg-[#1e1b4b]"
              >
                <Download className="h-4 w-4" /> Download report (PDF)
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
