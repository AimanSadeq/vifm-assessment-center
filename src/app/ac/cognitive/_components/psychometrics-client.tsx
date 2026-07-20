"use client";

import { useState, useEffect, useRef } from "react";
import { BrainCircuit, Sparkles, Loader2, CheckCircle2, RotateCcw, Download, Clock, Ticket } from "lucide-react";
import type { PsyTestPublic, PsyResult, ScaleScore } from "@/lib/psychometrics/scoring";
import { COGNITIVE_SUBTESTS, COGNITIVE_SUBTEST_KEYS, cognitiveNarrative } from "@/lib/psychometrics/framework";
import { useCognitiveLanguage } from "./cognitive-language";

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
  candidateId, engagementId, engagements = [], redemptionToken = null, prefillName, prefillEmail, timerMinutes, lockedSubtests = null, onDark = false,
}: {
  candidateId: string | null;
  engagementId: string | null;
  engagements?: EngagementOption[];
  /** Voucher redemption token (delegate flow); stamps the result with the client org. */
  redemptionToken?: string | null;
  prefillName?: string;
  prefillEmail?: string;
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
  // Language is shared with the take-page header when a CognitiveLanguageProvider
  // wraps us, so the welcome above the card follows the toggle (trial: Omar).
  // Standalone surfaces have no provider and keep local state.
  const sharedLang = useCognitiveLanguage();
  const localLang = useState<Lang>("en");
  const [lang, setLang] = sharedLang
    ? ([sharedLang.language, sharedLang.setLanguage] as const)
    : localLang;
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
      ? lang === "ar"
        ? "الاستدلال العددي واللفظي والاستقرائي والاستنتاجي"
        : "Numerical, verbal, inductive and deductive reasoning"
      : activeSubtests
          .map((k) => (lang === "ar" ? COGNITIVE_SUBTESTS.find((x) => x.key === k)?.name_ar ?? k : scaleName(k)))
          .join(" · ");
  // The advertised time scales with scope: a one-subtest sitting is not a
  // 40-minute test (trial: Omar). The server computes the authoritative limit
  // with the same formula and returns it on start; this is the intro estimate.
  const introMinutes = limitMinutes
    ? Math.max(10, Math.ceil((limitMinutes * activeSubtests.length) / COGNITIVE_SUBTEST_KEYS.length))
    : null;
  // Countdown: deadline stamped when the test starts; on expiry, auto-submit.
  const [deadline, setDeadline] = useState<number | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  // Cognitive candidate picker - optional binding. Blank = anonymous.
  const [cogEng, setCogEng] = useState("");
  const [cogCand, setCogCand] = useState("");
  const [takerName, setTakerName] = useState(prefillName ?? "");
  const [takerEmail, setTakerEmail] = useState(prefillEmail ?? "");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [test, setTest] = useState<PsyTestPublic | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<PsyResult | null>(null);
  const [resultId, setResultId] = useState<string | null>(null);
  // XP-13: only VIFM staff see results on-screen; a taker gets a thank-you.
  const [canView, setCanView] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // Submit fires once and is final - require an explicit second click (trial:
  // Asaad - "one stray click ends the test"). Timeout auto-submit bypasses it.
  const [armSubmit, setArmSubmit] = useState(false);
  // Autosave-blob key. Per voucher token for delegates (two delegates on a
  // shared machine can never resume each other's sitting), and per CANDIDATE
  // for admin-bound runs - without that, Candidate A's abandoned sitting on a
  // proctor's machine would resume for Candidate B and the result would be
  // written against A (review catch). Anonymous self-serve shares "self" but
  // never restores silently - see the resume banner below.
  const resumeKey = `logica-resume-${redemptionToken ?? (candidateId ? `cand-${candidateId}` : "self")}`;
  const RESUME_TTL_MS = 3 * 60 * 60 * 1000; // mirrors the psy_sessions TTL
  // A pending blob found on mount for a NON-token sitting: offered, not
  // auto-applied, so a shared-machine walk-up always sees what they are
  // resuming and a proctor can discard the previous candidate's run.
  const [pendingResume, setPendingResume] = useState<{
    sessionId: string; test: PsyTestPublic; answers: Record<string, number>;
    deadline: number | null; lang: Lang; savedAt: number;
  } | null>(null);

  const start = async () => {
    setBusy(true); setError("");
    try {
      // URL binding wins; otherwise honour the optional candidate picker (blank = anonymous).
      const boundCandidateId = candidateId ?? (cogCand || null);
      const boundEngagementId = engagementId ?? (cogEng || null);
      const res = await fetch("/api/ac/cognitive", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start", language: lang, candidateId: boundCandidateId, engagementId: boundEngagementId, takerEmail: takerEmail.trim() || null, subtests: selectedSubtests, redemptionToken }),
      });
      const d = await res.json();
      if (!res.ok || !d.test) { setError(d.error || "Could not start."); return; }
      setSessionId(d.session_id); setTest(d.test as PsyTestPublic); setAnswers({}); setResult(null); setResultId(null);
      // The server's limit is authoritative (it stamps the same deadline into
      // the session); fall back to the unscaled prop for older responses.
      const eff = typeof d.limit_minutes === "number" && d.limit_minutes > 0 ? d.limit_minutes : limitMinutes;
      setDeadline(eff ? Date.now() + eff * 60_000 : null);
      setArmSubmit(false);
      setPhase("test");
    } catch { setError("Could not start."); } finally { setBusy(false); }
  };

  const submit = async () => {
    if (!test || !sessionId) return;
    setBusy(true); setError("");
    try {
      const res = await fetch("/api/ac/cognitive", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "score", session_id: sessionId, answers, takerName: takerName.trim() || null, takerEmail: takerEmail.trim() || null, language: lang, redemptionToken }),
      });
      const d = await res.json();
      // XP-13: a NON-STAFF taker's successful response deliberately carries
      // result=null (no score data over the wire), so success is res.ok alone -
      // requiring d.result here mislabelled every voucher taker's successful
      // submit as "Could not score." (and their retry hit the single-use guard).
      if (!res.ok) {
        // Terminal states (already completed / session expired): the autosaved
        // blob would restore this same doomed session on every reload, parking
        // the taker in a test view with no way out (review catch). Clear it and
        // land back on the intro with the reason shown.
        if (res.status === 409 || res.status === 410) {
          try { localStorage.removeItem(resumeKey); } catch { /* ignore */ }
          setPhase("intro"); setTest(null); setSessionId(null); setAnswers({});
          setDeadline(null); setRemaining(null); setArmSubmit(false);
        }
        setError(d.error || "Could not score.");
        return;
      }
      try { localStorage.removeItem(resumeKey); } catch { /* ignore */ }
      setResult((d.result as PsyResult | null) ?? null);
      setResultId(d.result_id ?? null);
      setCanView(d.isStaff === true && !!d.result);
      setPhase("result");
    } catch { setError("Could not score."); } finally { setBusy(false); }
  };

  const reset = () => {
    try { localStorage.removeItem(resumeKey); } catch { /* ignore */ }
    setPhase("intro"); setTest(null); setSessionId(null); setAnswers({});
    setResult(null); setResultId(null); setError(""); setDeadline(null); setRemaining(null);
    setArmSubmit(false);
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

  // ── Autosave + resume (trial: Asaad - "one accidental refresh wipes all 36
  // answers"). The key-stripped test, the answers and the deadline are snapshotted
  // to THIS DEVICE on every change; a reload within the session's ~3h TTL (and
  // before the deadline) restores the sitting mid-flight. Integrity is unchanged:
  // the blob holds no answer key, and grading remains server-side against the
  // stored session, which stays single-use.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(resumeKey);
      if (!raw) return;
      const b = JSON.parse(raw) as {
        sessionId?: string; test?: PsyTestPublic; answers?: Record<string, number>;
        deadline?: number | null; lang?: Lang; savedAt?: number;
      };
      if (!b?.sessionId || !b?.test || typeof b.savedAt !== "number") { localStorage.removeItem(resumeKey); return; }
      const expired = Date.now() - b.savedAt > RESUME_TTL_MS || (b.deadline != null && b.deadline <= Date.now());
      if (expired) { localStorage.removeItem(resumeKey); return; }
      const blob = {
        sessionId: b.sessionId, test: b.test, answers: b.answers ?? {},
        deadline: b.deadline ?? null, lang: (b.lang === "ar" ? "ar" : "en") as Lang, savedAt: b.savedAt,
      };
      if (redemptionToken) {
        // Token sittings restore silently: the per-token key guarantees this is
        // the same delegate's own run.
        setSessionId(blob.sessionId); setTest(blob.test); setAnswers(blob.answers);
        setDeadline(blob.deadline); setLang(blob.lang); setPhase("test");
      } else {
        // Staff/anonymous surface: OFFER the resume instead of hijacking the
        // intro - a shared machine may now hold a different person.
        setPendingResume(blob);
      }
    } catch { /* corrupted blob - fall through to a fresh start */ }
    // Mount-only by design: restore once, before any user interaction.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyResume = () => {
    if (!pendingResume) return;
    setSessionId(pendingResume.sessionId); setTest(pendingResume.test); setAnswers(pendingResume.answers);
    setDeadline(pendingResume.deadline); setLang(pendingResume.lang); setPendingResume(null); setPhase("test");
  };
  const discardResume = () => {
    try { localStorage.removeItem(resumeKey); } catch { /* ignore */ }
    setPendingResume(null);
  };

  useEffect(() => {
    if (phase !== "test" || !test || !sessionId) return;
    try {
      localStorage.setItem(resumeKey, JSON.stringify({ sessionId, test, answers, deadline, lang, savedAt: Date.now() }));
    } catch { /* storage blocked/full - the beforeunload warning still applies */ }
  }, [phase, test, sessionId, answers, deadline, lang, resumeKey]);

  // Still warn on close/navigation: autosave covers a reload on this device,
  // not a taker walking away with the timer running.
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
          {lang === "ar" ? (
            <>{subtestPhrase} - قراءة تطويرية <strong>استرشادية</strong>، وليست درجة معيارية أو عالية المخاطر.</>
          ) : (
            <>{subtestPhrase} - an <strong>indicative</strong> developmental read, not a norm-referenced or high-stakes score.</>
          )}
        </p>
      </div>

      {error && <div className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}

      {phase === "intro" && (
        <div className="space-y-5 rounded-xl border bg-card p-6">
          {pendingResume && (
            <div className="rounded-lg border border-sky-300 bg-sky-50 p-4">
              <p className="text-sm font-semibold text-sky-900">
                {lang === "ar" ? "توجد جلسة قيد التقدم على هذا الجهاز" : "A sitting is in progress on this device"}
              </p>
              <p className="mt-1 text-xs text-sky-800">
                {lang === "ar"
                  ? `${Object.keys(pendingResume.answers).length} إجابة محفوظة. تابعها إذا كانت جلستك أنت - وإذا كانت لشخص آخر، تجاهلها وابدأ من جديد.`
                  : `${Object.keys(pendingResume.answers).length} answer(s) saved. Resume if this is your own sitting - if it belongs to someone else, discard it and start fresh.`}
              </p>
              <div className="mt-2 flex gap-2">
                <button onClick={applyResume}
                  className="rounded-md bg-[#5391D5] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#3f7dc0]">
                  {lang === "ar" ? "متابعة الجلسة" : "Resume sitting"}
                </button>
                <button onClick={discardResume}
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
                  {lang === "ar" ? "تجاهل وابدأ من جديد" : "Discard and start fresh"}
                </button>
              </div>
            </div>
          )}
          <div className="rounded-lg border border-[#5391D5] bg-[#5391D5]/5 p-4">
            <p className="font-semibold text-[#010131]">Logica®</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {subtestPhrase} {lang === "ar" ? "(أسئلة اختيار من متعدد ضمن وقت محدد)." : "(timed-style MCQs)."}
            </p>
          </div>

          {/* Pre-test notice: the material terms, before the taker commits. */}
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900">
            <p className="text-sm font-semibold">{lang === "ar" ? "قبل أن تبدأ" : "Before you begin"}</p>
            <ul className="mt-1.5 space-y-1 text-xs">
              <li>
                {lang === "ar"
                  ? `أسئلة اختيار من متعدد عبر ${activeSubtests.length} ${activeSubtests.length === 1 ? "اختبار فرعي" : "اختبارات فرعية"}.`
                  : `Multiple-choice questions across ${activeSubtests.length} subtest${activeSubtests.length === 1 ? "" : "s"}.`}
              </li>
              {introMinutes && (
                <li>
                  {lang === "ar"
                    ? `الوقت المحدد ${introMinutes} دقيقة، ويُرسَل الاختبار تلقائيًا عند انتهاء الوقت.`
                    : `You have ${introMinutes} minutes; it submits automatically when time runs out.`}
                </li>
              )}
              <li>
                {lang === "ar"
                  ? "يمكن أداؤه مرة واحدة فقط، والإجابات نهائية بعد الإرسال."
                  : "It can be taken once, and your answers are final after you submit."}
              </li>
              <li>
                {lang === "ar"
                  ? "تُحفَظ إجاباتك على هذا الجهاز أولاً بأول - إذا أُعيد تحميل الصفحة يمكنك المتابعة من حيث توقفت."
                  : "Your answers save on this device as you go - if the page reloads, you can pick up where you left off."}
              </li>
            </ul>
          </div>

          {/* SD-4: subtest selection. Hidden when an admin has locked the set, and
              ALWAYS hidden for voucher delegates: one seat = one sitting, so a
              delegate who picked "numerical only" quietly spent their whole
              voucher on a quarter of the battery and was then locked out of the
              rest (trial: Omar). A token sitting runs the voucher's issued
              scope, or the full battery when the voucher carries none. */}
          {!lockedSet && !redemptionToken && (
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
                  <select id="cog-eng" name="engagement"
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
                  <select id="cog-cand" name="candidate"
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
            <label className="flex-1 min-w-[12rem]" htmlFor="cog-taker-name">
              <span className="text-xs font-medium text-slate-500">{lang === "ar" ? "اسمك (اختياري)" : "Your name (optional)"}</span>
              <input id="cog-taker-name" name="name" autoComplete="name"
                value={takerName} onChange={(e) => setTakerName(e.target.value)} dir="auto"
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                placeholder={lang === "ar" ? "مثال: سارة المنصوري" : "e.g. Sara Al Mansoori"} />
            </label>
            {/* Without this the result cannot be tied back to a person: the runner
                never captured an email, so 35 of 39 stored results had none and
                identity survived only as a join onto the voucher redemption -
                which the retention purge later scrubs. */}
            <label className="flex-1 min-w-[12rem]" htmlFor="cog-taker-email">
              <span className="text-xs font-medium text-slate-500">{lang === "ar" ? "البريد الإلكتروني (اختياري)" : "Email (optional)"}</span>
              <input id="cog-taker-email" name="email" type="email" autoComplete="email"
                value={takerEmail} onChange={(e) => setTakerEmail(e.target.value)} dir="ltr"
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="you@example.com" />
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
            {busy
              ? lang === "ar" ? "جارٍ التحضير…" : "Preparing…"
              : lang === "ar" ? "ابدأ اختبار القدرات" : "Begin cognitive assessment"}
          </button>
        </div>
      )}

      {phase === "test" && test && (
        <div className="space-y-4">
          {/* Sticky progress + countdown: on a timed test the taker must see
              time remaining WITHOUT scrolling to the bottom (trial: Asaad,
              Yassin, Ahmad Ghosheh - three of seven flagged it). */}
          <div className="sticky top-0 z-30 flex items-center justify-between rounded-lg border bg-white/95 px-4 py-2.5 shadow-sm backdrop-blur">
            <span className="text-xs font-medium text-slate-600">
              {answered}/{total} {lang === "ar" ? "تمت الإجابة" : "answered"}
            </span>
            {remaining != null && (
              <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold tabular-nums ${remaining <= 60 ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-700"}`}>
                <Clock className="h-4 w-4" />
                {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, "0")}
              </span>
            )}
          </div>

          {/* Questions grouped under their subtest, with a header per section
              (trial: Ali - one undifferentiated 36-question list read poorly).
              Numbering stays continuous across sections. */}
          {test.kind === "cognitive"
            ? (() => {
                const scaleOrder = [...new Set(test.items.map((i) => i.scale))];
                let n = 0;
                return scaleOrder.map((sc) => {
                  const st = COGNITIVE_SUBTESTS.find((x) => x.key === sc);
                  const group = test.items.filter((i) => i.scale === sc);
                  return (
                    <div key={sc} className="space-y-3">
                      <div className="flex items-baseline justify-between border-b border-slate-200 pb-1.5 pt-2">
                        <h2 className="text-sm font-bold uppercase tracking-wide text-[#010131]">
                          {lang === "ar" ? st?.name_ar ?? sc : st?.name_en ?? sc}
                        </h2>
                        <span className="text-xs text-muted-foreground">
                          {group.filter((i) => answers[i.id] != null).length}/{group.length}
                        </span>
                      </div>
                      {group.map((item) => {
                        n += 1;
                        const num = n;
                        return (
                          <section key={item.id} className="rounded-lg border bg-white p-4">
                            <p id={`cog-q-${item.id}`} className="text-sm font-semibold text-[#010131]">{num}. {item.stem}</p>
                            <div className="mt-2 grid gap-2 sm:grid-cols-2" role="radiogroup" aria-labelledby={`cog-q-${item.id}`}>
                              {item.options.map((opt, oi) => (
                                <label key={oi} htmlFor={`${item.id}-${oi}`} className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm ${answers[item.id] === oi ? "border-[#5391D5] bg-[#5391D5]/5" : "border-slate-200 hover:bg-slate-50"}`}>
                                  <input type="radio" id={`${item.id}-${oi}`} name={item.id} checked={answers[item.id] === oi}
                                    onChange={() => setAnswers((a) => ({ ...a, [item.id]: oi }))} className="accent-[#5391D5]" />
                                  <span>{opt}</span>
                                </label>
                              ))}
                            </div>
                          </section>
                        );
                      })}
                    </div>
                  );
                });
              })()
            : null}

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">{answered}/{total} {lang === "ar" ? "تمت الإجابة" : "answered"}</span>
              {remaining != null && (
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums ${remaining <= 60 ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-600"}`}>
                  <Clock className="h-3 w-3" />
                  {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, "0")}
                </span>
              )}
            </div>
            {/* Two-step submit: the sitting is single-use and answers are final,
                so one stray click must not end it (trial: Asaad). The timeout
                auto-submit deliberately bypasses this. */}
            {!armSubmit ? (
              <button onClick={() => setArmSubmit(true)} disabled={!canSubmit}
                className="inline-flex items-center gap-2 rounded-md bg-[#047857] px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50">
                <CheckCircle2 className="h-4 w-4" />
                {lang === "ar" ? "إرسال" : "Submit"}
              </button>
            ) : (
              <div className="flex flex-wrap items-center justify-end gap-2">
                <span className="text-xs font-medium text-slate-600">
                  {lang === "ar" ? "إرسال وإنهاء؟ لا يمكن التراجع." : "Submit and finish? This cannot be undone."}
                </span>
                <button onClick={() => setArmSubmit(false)} disabled={busy}
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
                  {lang === "ar" ? "متابعة الإجابة" : "Keep answering"}
                </button>
                <button onClick={submit} disabled={busy}
                  className="inline-flex items-center gap-2 rounded-md bg-[#047857] px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  {busy ? (lang === "ar" ? "جارٍ التقييم…" : "Scoring…") : (lang === "ar" ? "تأكيد الإرسال" : "Confirm submit")}
                </button>
              </div>
            )}
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
