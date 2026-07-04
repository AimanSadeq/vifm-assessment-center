"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, CheckCircle2, RotateCcw, GraduationCap, AlertCircle, ShieldCheck, ExternalLink, Layers3, ChevronDown, ChevronRight, ChevronLeft, Gauge, Blend, Plus, Check, X, Clock } from "lucide-react";
import type { LocalizedTechDomain } from "@/lib/competencies/technical-taxonomy";
import type { LocalizedTechFunction } from "@/lib/competencies/technical-function";
import { categoryRank, aggregateByCompetency } from "@/lib/competencies/technical-categories";
import { proficiencyTier, proficiencyTierLabel } from "@/lib/competencies/proficiency-tier";
import type { PublicTechTest, TechResult } from "@/lib/ai/technical-assessment";

type Phase = "intro" | "instructions" | "test" | "adaptive" | "result";
type RunKind = "function" | "domain";
// Canonical display order for the per-type "how to answer" guidance.
const TYPE_ORDER = ["single", "true_false", "multi", "scenario"] as const;

// One adaptive item (answer key stripped) + the running progress.
type AdaptiveItem = { id: string; skill: string; type: "single"; question: string; options: string[]; difficulty: "easy" | "medium" | "hard" };
type AdaptiveProgress = { answered: number; max: number; se: number | null; theta: number };

// The score response augments TechResult with the certification outcome.
type ScoredResult = TechResult & {
  passedCut?: boolean | null;
  cutPct?: number | null;
  credentialCode?: string | null;
};

const LEVEL_TONE: Record<number, string> = {
  1: "bg-rose-100 text-rose-800 border-rose-300",
  2: "bg-amber-100 text-amber-800 border-amber-300",
  3: "bg-sky-100 text-sky-800 border-sky-300",
  4: "bg-blue-100 text-blue-800 border-blue-300",
  5: "bg-emerald-100 text-emerald-800 border-emerald-300",
};

export function TechAssessmentClient({
  domains,
  functions,
  adaptiveRefs = [],
  skillLabels,
  language = "en",
  candidateId = null,
  engagementId = null,
  programId = null,
  participantId = null,
  takerName = null,
  takerEmail = null,
  lockedDomain = null,
  lockedFunction = null,
}: {
  domains: LocalizedTechDomain[];
  /** The job-level functions (primary unit of assessment), grouped by category. */
  functions: LocalizedTechFunction[];
  /** Function refs whose calibrated bank is deep enough for an adaptive sitting. */
  adaptiveRefs?: string[];
  skillLabels: Record<string, string>;
  /** UI language - also the language the test content is served/generated in. */
  language?: "en" | "ar";
  /** When set, the sitting binds to this candidate (AC-engagement run). */
  candidateId?: string | null;
  engagementId?: string | null;
  /** When set, the sitting binds to this standalone-program participant. */
  programId?: string | null;
  participantId?: string | null;
  /** Participant name/email - the credential is issued to them on a pass. */
  takerName?: string | null;
  takerEmail?: string | null;
  /** When set, the runner starts this domain immediately and hides the picker. */
  lockedDomain?: string | null;
  /** When set, the runner starts this function immediately and hides the picker. */
  lockedFunction?: string | null;
}) {
  const { t } = useTranslation();
  const skillLabel = (s: string) => skillLabels[s] ?? s;
  // A run's display name: localized domain name when the key is a domain, else
  // the test/result's own (already-localized) name - which is the function name.
  const displayName = (key: string, fallback: string) => domains.find((d) => d.key === key)?.name ?? fallback;
  const locked = !!(lockedDomain || lockedFunction);

  const [phase, setPhase] = useState<Phase>("intro");
  // After the instructions screen, which phase to begin: the fixed test or the adaptive flow.
  const [startTarget, setStartTarget] = useState<"test" | "adaptive">("test");
  const [runKind, setRunKind] = useState<RunKind>("function");
  const [test, setTest] = useState<PublicTechTest | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  // A single-answer item maps to a number; a multi-select item to a number[].
  const [answers, setAnswers] = useState<Record<string, number | number[]>>({});
  const [result, setResult] = useState<ScoredResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // Admin per-instance time limit (seconds) from the start response; the deadline
  // is stamped when the taker clicks Start, then counts down + auto-submits.
  const [timeLimitSeconds, setTimeLimitSeconds] = useState<number | null>(null);
  const [deadline, setDeadline] = useState<number | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  // Two-level picker: pick a competency first, then a function within it.
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const adaptiveSet = useMemo(() => new Set(adaptiveRefs), [adaptiveRefs]);
  // Mix & match basket: individual SKILLS picked across functions/competencies
  // for one combined sitting. Keyed by the canonical English skill name, each
  // remembering the function it was picked from. Nothing is persisted.
  type MixPick = { ref: string; fnName: string; label: string };
  const [mixSkills, setMixSkills] = useState<Record<string, MixPick>>({});
  // The function card currently expanded to show its pickable skills.
  const [expandedRef, setExpandedRef] = useState<string | null>(null);
  const mixCount = Object.keys(mixSkills).length;
  // Contributing functions (for the basket chips + the start payload).
  const mixFns = useMemo(() => {
    const by = new Map<string, { ref: string; name: string; count: number }>();
    for (const p of Object.values(mixSkills)) {
      const cur = by.get(p.ref);
      if (cur) cur.count += 1;
      else by.set(p.ref, { ref: p.ref, name: p.fnName, count: 1 });
    }
    return Array.from(by.values());
  }, [mixSkills]);
  const MIX_MIN_SKILLS = 3;

  const toggleMixSkill = (f: LocalizedTechFunction, skillEn: string, label: string) =>
    setMixSkills((s) => {
      const next = { ...s };
      if (next[skillEn]) delete next[skillEn];
      else next[skillEn] = { ref: f.ref, fnName: f.name, label };
      return next;
    });
  const setAllMixSkills = (f: LocalizedTechFunction, on: boolean) =>
    setMixSkills((s) => {
      const next = { ...s };
      f.skillsEn.forEach((en, i) => {
        if (on) next[en] = next[en] ?? { ref: f.ref, fnName: f.name, label: f.skills[i] ?? en };
        else delete next[en];
      });
      return next;
    });
  const removeMixFn = (ref: string) =>
    setMixSkills((s) => Object.fromEntries(Object.entries(s).filter(([, p]) => p.ref !== ref)));
  const pickedCountOf = (f: LocalizedTechFunction) => f.skillsEn.filter((en) => !!mixSkills[en]).length;

  // Adaptive (turn-based CAT) state.
  const [adaptiveItem, setAdaptiveItem] = useState<AdaptiveItem | null>(null);
  const [adaptiveAnswer, setAdaptiveAnswer] = useState<number | null>(null);
  const [adaptiveProgress, setAdaptiveProgress] = useState<AdaptiveProgress | null>(null);

  // Functions grouped by their category, for a tidy picker.
  const grouped = useMemo(() => {
    const map = new Map<string, { cat: string; label: string; items: LocalizedTechFunction[] }>();
    for (const f of functions) {
      const key = f.category ?? "other";
      const bucket = map.get(key);
      if (bucket) bucket.items.push(f);
      else map.set(key, { cat: key, label: f.categoryLabel, items: [f] });
    }
    // Order the competency buckets by the canonical CATEGORY_ORDER.
    return Array.from(map.values()).sort((a, b) => categoryRank(a.cat) - categoryRank(b.cat));
  }, [functions]);

  // The competency drilled into (level 2), or null on the competency picker (level 1).
  const selectedGroup = selectedCategory ? grouped.find((g) => g.cat === selectedCategory) ?? null : null;

  async function start(kind: RunKind, key: string) {
    // An adaptive-ready function gets the shorter, ability-matched CAT sitting.
    if (kind === "function" && adaptiveSet.has(key)) {
      return startAdaptive(key);
    }
    return beginFixed(kind, kind === "function" ? { functionKey: key } : { domainKey: key });
  }

  // Combined (mix & match) run: the basket's picked skills in one sitting.
  // Always the fixed form (CAT pools are per-function).
  async function startMix() {
    const skills = Object.keys(mixSkills);
    if (skills.length < MIX_MIN_SKILLS) return;
    return beginFixed("function", { functionKeys: mixFns.map((f) => f.ref), skills });
  }

  async function beginFixed(kind: RunKind, idBody: Record<string, unknown>) {
    setBusy(true);
    setError("");
    setRunKind(kind);
    try {
      const res = await fetch("/api/ac/tech-assessment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start", ...idBody, candidateId, engagementId, programId, participantId, takerName, takerEmail, language }),
      });
      const raw = (await res.json()) as PublicTechTest & {
        session_id?: string;
        test?: PublicTechTest;
        time_limit_seconds?: number | null;
        error?: string;
      };
      if (!res.ok) {
        // A program seat allows one sitting; a completed participant is refused.
        setError(raw.error === "already_completed" ? t("tech.take.errAlreadyDone") : t("tech.take.errBuild"));
        return;
      }
      // The session path nests the test under `test`; the legacy (un-migrated)
      // path returns the test fields flat. Normalize, and refuse to enter the
      // test phase with a malformed or empty deck.
      const built = raw.test ?? raw;
      if (!built || !Array.isArray(built.items) || built.items.length === 0) {
        setError(t("tech.take.errBuild"));
        return;
      }
      setSessionId(raw.session_id ?? null);
      setTest(built);
      setTimeLimitSeconds(typeof raw.time_limit_seconds === "number" && raw.time_limit_seconds > 0 ? raw.time_limit_seconds : null);
      setAnswers({});
      setResult(null);
      setDeadline(null);
      setRemaining(null);
      setStartTarget("test");
      setPhase("instructions");
    } catch {
      setError(t("tech.take.errBuild"));
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    if (!test) return;
    setBusy(true);
    setError("");
    try {
      const common = { candidateId, engagementId, programId, participantId, takerName, takerEmail, language };
      // Legacy (no session) path: re-send the run's identity so the server can
      // re-build + grade. A function run carries its key in domain_key.
      const idBody =
        runKind === "function"
          ? { functionKey: test.domain_key }
          : { domainKey: test.domain_key, domainName: test.domain_name };
      const payload = sessionId
        ? { action: "score", sessionId, answers, ...common }
        : { action: "score", ...idBody, items: test.items, aiGenerated: test.ai_generated, answers, ...common };
      const res = await fetch("/api/ac/tech-assessment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        setError(err.error === "time limit exceeded" ? t("tech.take.errTimeUp") : t("tech.take.errScore"));
        return;
      }
      const data = (await res.json()) as ScoredResult;
      setResult(data);
      setPhase("result");
    } catch {
      setError(t("tech.take.errScore"));
    } finally {
      setBusy(false);
    }
  }

  // ── Adaptive (turn-based CAT) ──
  async function startAdaptive(ref: string) {
    setBusy(true);
    setError("");
    setRunKind("function");
    try {
      const res = await fetch("/api/ac/tech-assessment/adaptive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start", functionKey: ref, candidateId, engagementId, programId, participantId, takerName, takerEmail, language }),
      });
      const data = (await res.json()) as { session_id?: string; item?: AdaptiveItem; progress?: AdaptiveProgress; error?: string };
      if (!res.ok || !data.session_id || !data.item) {
        setError(t("tech.take.errBuild"));
        return;
      }
      setSessionId(data.session_id);
      setAdaptiveItem(data.item);
      setAdaptiveProgress(data.progress ?? { answered: 0, max: 0, se: null, theta: 0 });
      setAdaptiveAnswer(null);
      setResult(null);
      setStartTarget("adaptive");
      setPhase("instructions");
    } catch {
      setError(t("tech.take.errBuild"));
    } finally {
      setBusy(false);
    }
  }

  async function answerAdaptive() {
    if (!sessionId || adaptiveItem == null || adaptiveAnswer == null) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/ac/tech-assessment/adaptive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "answer", sessionId, answer: adaptiveAnswer }),
      });
      const data = (await res.json()) as
        | { done: true; result: ScoredResult }
        | { done: false; item: AdaptiveItem; progress: AdaptiveProgress }
        | { error: string };
      if ("error" in data) {
        setError(t("tech.take.errScore"));
        return;
      }
      if (data.done) {
        setResult(data.result);
        setAdaptiveItem(null);
        setPhase("result");
      } else {
        setAdaptiveItem(data.item);
        setAdaptiveProgress(data.progress);
        setAdaptiveAnswer(null);
      }
    } catch {
      setError(t("tech.take.errScore"));
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setPhase("intro");
    setTest(null);
    setSessionId(null);
    setAnswers({});
    setResult(null);
    setAdaptiveItem(null);
    setAdaptiveAnswer(null);
    setAdaptiveProgress(null);
    setTimeLimitSeconds(null);
    setDeadline(null);
    setRemaining(null);
    setError("");
  }

  // Org-assigned / token run: when a function or domain is locked in via the URL,
  // start it once on mount and skip the picker entirely.
  const autoStarted = useRef(false);
  useEffect(() => {
    if (autoStarted.current) return;
    if (lockedFunction) {
      autoStarted.current = true;
      void start("function", lockedFunction);
    } else if (lockedDomain) {
      autoStarted.current = true;
      void start("domain", lockedDomain);
    }
    // start is intentionally not a dependency (it's recreated each render and the
    // ref guard ensures a single run).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lockedDomain, lockedFunction]);

  // Countdown + auto-submit when the admin per-instance time limit runs out.
  useEffect(() => {
    if (phase !== "test" || deadline == null) return;
    const id = setInterval(() => {
      const secs = Math.max(0, Math.round((deadline - Date.now()) / 1000));
      setRemaining(secs);
      if (secs <= 0) {
        clearInterval(id);
        if (!busy) void submit();
      }
    }, 1000);
    return () => clearInterval(id);
    // submit is a stable closure; deadline/phase/busy drive the timer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, deadline, busy]);

  // An item is answered when a single item has a chosen index, or a multi item
  // has at least one option ticked.
  const isAnswered = (item: PublicTechTest["items"][number]) => {
    const a = answers[item.id];
    return item.type === "multi" ? Array.isArray(a) && a.length > 0 : typeof a === "number";
  };
  const allAnswered =
    !!test && Array.isArray(test.items) && test.items.length > 0 && test.items.every(isAnswered);

  const toggleSingle = (id: string, oi: number) => setAnswers((a) => ({ ...a, [id]: oi }));
  const toggleMulti = (id: string, oi: number) =>
    setAnswers((a) => {
      const cur = Array.isArray(a[id]) ? (a[id] as number[]) : [];
      const next = cur.includes(oi) ? cur.filter((x) => x !== oi) : [...cur, oi].sort((p, q) => p - q);
      return { ...a, [id]: next };
    });
  const isPicked = (id: string, oi: number, multi: boolean) => {
    const a = answers[id];
    return multi ? Array.isArray(a) && a.includes(oi) : a === oi;
  };

  return (
    <div className="space-y-5">
      {error && <div className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}

      {phase === "intro" && locked && (
        <div className="rounded-2xl border bg-card p-8 text-center shadow-sm">
          <p className="inline-flex items-center gap-2 text-sm text-slate-600">
            <Loader2 className="h-4 w-4 animate-spin" /> {t("tech.take.building")}
          </p>
        </div>
      )}

      {phase === "intro" && !locked && (
        <div className="space-y-4">
          {/* Mix & match basket: skills picked across functions/competencies. */}
          {mixCount > 0 && (
            <div className="rounded-2xl border border-[#5391D5]/50 bg-[#5391D5]/[0.04] p-4 shadow-sm">
              <p className="inline-flex items-center gap-2 text-sm font-semibold text-[#010131]">
                <Blend className="h-4 w-4 text-[#5391D5]" /> {t("tech.take.mixTitle")}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {mixFns.map((f) => (
                  <button
                    key={f.ref}
                    onClick={() => removeMixFn(f.ref)}
                    title={t("tech.take.mixRemoveFn")}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[#5391D5] bg-white px-3 py-1 text-xs font-medium text-[#2b6cb0] hover:bg-rose-50 hover:text-rose-600"
                  >
                    {f.name} · {f.count} <X className="h-3 w-3" />
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-slate-600">
                {Object.values(mixSkills).map((p) => p.label).join(" · ")}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <button
                  onClick={startMix}
                  disabled={busy || mixCount < MIX_MIN_SKILLS}
                  className="inline-flex items-center gap-2 rounded-md bg-[#047857] px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <GraduationCap className="h-4 w-4" />}
                  {t("tech.take.mixStart", { skills: mixCount, n: mixFns.length })}
                </button>
                {mixCount < MIX_MIN_SKILLS && (
                  <span className="text-[11px] text-slate-500">{t("tech.take.mixNeedMore", { min: MIX_MIN_SKILLS })}</span>
                )}
              </div>
            </div>
          )}

          {/* Primary: functions (the job-level unit of assessment). */}
          <div className="rounded-2xl border bg-card p-6 shadow-sm">
            {!selectedGroup ? (
              /* Level 1 - pick a competency */
              <>
                <h2 className="text-lg font-semibold text-[#010131]">{t("tech.take.chooseFunctionTitle")}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{t("tech.take.chooseFunctionIntro")}</p>
                <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {grouped.map((g) => (
                    <button
                      key={g.cat}
                      onClick={() => setSelectedCategory(g.cat)}
                      className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-4 text-start transition-colors hover:border-[#5391D5] hover:bg-[#5391D5]/5"
                    >
                      <span className="flex flex-col gap-1">
                        <span className="font-semibold text-[#010131]">{g.label}</span>
                        <span className="text-[11px] text-muted-foreground">{t("tech.take.functionsCount", { count: g.items.length })}</span>
                      </span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
                    </button>
                  ))}
                </div>
              </>
            ) : (
              /* Level 2 - pick a function within the chosen competency */
              <>
                <button
                  onClick={() => setSelectedCategory(null)}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-[#010131]"
                >
                  <ChevronLeft className="h-4 w-4" /> {t("tech.take.backToCompetencies")}
                </button>
                <h2 className="mt-3 text-lg font-semibold text-[#010131]">{selectedGroup.label}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{t("tech.take.selectFunctionSub")}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">{t("tech.take.mixHint")}</p>
                <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {selectedGroup.items.map((f) => {
                    const open = expandedRef === f.ref;
                    const picked = pickedCountOf(f);
                    const allOn = picked === f.skillsEn.length;
                    return (
                      <div
                        key={f.ref}
                        className={`rounded-xl border transition-colors ${
                          open || picked > 0 ? "border-[#5391D5] bg-[#5391D5]/5" : "border-slate-200 hover:border-[#5391D5] hover:bg-[#5391D5]/5"
                        } ${open ? "sm:col-span-2 lg:col-span-3" : ""}`}
                      >
                        {/* Card header: tap to open the function's skills. */}
                        <button
                          onClick={() => setExpandedRef(open ? null : f.ref)}
                          disabled={busy}
                          className="flex w-full items-start justify-between gap-3 p-4 text-start disabled:opacity-60"
                        >
                          <span className="flex flex-col gap-1.5">
                            <span className="font-semibold text-[#010131]">{f.name}</span>
                            {!open && (
                              <span className="text-[11px] leading-snug text-muted-foreground">{f.skills.slice(0, 3).join(" · ")}…</span>
                            )}
                            <span className="mt-0.5 flex flex-wrap gap-1">
                              <span className="inline-flex w-fit items-center gap-1 rounded-full bg-[#5391D5]/10 px-2 py-0.5 text-[10px] font-medium text-[#2b6cb0]">
                                <Layers3 className="h-3 w-3" /> {t("tech.take.skillsCount", { count: f.skillsEn.length })} · {t("tech.take.functionDeep")}
                              </span>
                              {adaptiveSet.has(f.ref) && (
                                <span className="inline-flex w-fit items-center gap-1 rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-medium text-indigo-700">
                                  <Gauge className="h-3 w-3" /> {t("tech.take.adaptiveBadge")}
                                </span>
                              )}
                              {picked > 0 && (
                                <span className="inline-flex w-fit items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                                  <Check className="h-3 w-3" /> {t("tech.take.mixPicked", { n: picked })}
                                </span>
                              )}
                            </span>
                          </span>
                          <ChevronDown className={`mt-1 h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
                        </button>

                        {/* Expanded: pick one, some, or all of this function's skills. */}
                        {open && (
                          <div className="border-t border-[#5391D5]/20 p-4">
                            <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                              {f.skillsEn.map((en, i) => {
                                const on = !!mixSkills[en];
                                const label = f.skills[i] ?? en;
                                return (
                                  <label
                                    key={en}
                                    className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm ${
                                      on ? "border-[#5391D5] bg-white" : "border-slate-200 bg-white/60 hover:bg-white"
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={on}
                                      onChange={() => toggleMixSkill(f, en, label)}
                                      className="accent-[#5391D5]"
                                    />
                                    <span>{label}</span>
                                  </label>
                                );
                              })}
                            </div>
                            <div className="mt-3 flex flex-wrap items-center gap-2">
                              <button
                                onClick={() => setAllMixSkills(f, !allOn)}
                                className="inline-flex items-center gap-1.5 rounded-md border border-[#5391D5]/50 px-3 py-1.5 text-xs font-medium text-[#2b6cb0] hover:bg-[#5391D5]/10"
                              >
                                {allOn ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                                {allOn ? t("tech.take.mixUnselectAll") : t("tech.take.mixSelectAll")}
                              </button>
                              <button
                                onClick={() => start("function", f.ref)}
                                disabled={busy}
                                className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60"
                              >
                                <GraduationCap className="h-3.5 w-3.5" /> {t("tech.take.mixAssessNow")}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                {busy && (
                  <p className="mt-4 inline-flex items-center gap-2 text-sm text-slate-500">
                    <Loader2 className="h-4 w-4 animate-spin" /> {t("tech.take.building")}
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {phase === "instructions" && (() => {
        const isAdaptive = startTarget === "adaptive";
        const name = isAdaptive
          ? t("tech.take.adaptiveTitle")
          : test
            ? displayName(test.domain_key, test.domain_name)
            : "";
        const count = isAdaptive ? adaptiveProgress?.max ?? 0 : test?.items.length ?? 0;
        const present = isAdaptive
          ? (["single"] as string[])
          : TYPE_ORDER.filter((ty) => (test?.items ?? []).some((i) => i.type === ty));
        const certified = !isAdaptive && !!test?.certified;
        return (
          <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-4">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-slate-500">{t("tech.take.instr.eyebrow")}</p>
              <h2 className="mt-1 inline-flex items-center gap-2 text-lg font-semibold text-[#010131]">
                <GraduationCap className="h-5 w-5 text-[#5391D5]" /> {t("tech.take.instr.title")}
              </h2>
            </div>
            <p className="text-sm text-slate-700">{t("tech.take.instr.intro", { name, n: count })}</p>

            <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{t("tech.take.instr.howTo")}</p>
              <ul className="mt-2 space-y-1.5 text-sm text-slate-700">
                {present.map((ty) => (
                  <li key={ty} className="flex gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#5391D5]" />
                    <span>
                      <span className="font-semibold">{t(`tech.take.instr.t.${ty}.label`)}:</span> {t(`tech.take.instr.t.${ty}.how`)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <ul className="space-y-1.5 text-sm text-slate-600">
              <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />{t("tech.take.instr.g1")}</li>
              <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />{t("tech.take.instr.g2")}</li>
              {isAdaptive && (
                <li className="flex gap-2"><Gauge className="mt-0.5 h-4 w-4 shrink-0 text-indigo-500" />{t("tech.take.instr.adaptive")}</li>
              )}
            </ul>

            {startTarget === "test" && timeLimitSeconds != null && timeLimitSeconds > 0 && (
              <div className="flex items-start gap-2 rounded-md border border-slate-200 bg-slate-50 p-3 text-[12px] text-slate-700">
                <Clock className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                <span>{t("tech.take.instr.timeLimit", { minutes: Math.ceil(timeLimitSeconds / 60) })}</span>
              </div>
            )}

            {!isAdaptive &&
              (certified ? (
                <div className="flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-[12px] text-emerald-800">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" /> {t("tech.take.instr.certified")}
                </div>
              ) : (
                <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-[12px] text-amber-800">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {t("tech.take.instr.indicative")}
                </div>
              ))}

            <button
              onClick={() => {
                if (startTarget === "test" && timeLimitSeconds) {
                  setDeadline(Date.now() + timeLimitSeconds * 1000);
                  setRemaining(timeLimitSeconds);
                }
                setPhase(startTarget);
              }}
              className="inline-flex items-center gap-2 rounded-md bg-[#047857] px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800"
            >
              <GraduationCap className="h-4 w-4" /> {t("tech.take.instr.start")}
            </button>
          </div>
        );
      })()}

      {phase === "test" && test && (
        <>
          {remaining != null && (
            <div
              className={`sticky top-0 z-10 flex items-center justify-between rounded-lg border px-4 py-2 text-sm shadow-sm ${
                remaining <= 60 ? "border-rose-200 bg-rose-50 text-rose-700" : "border-slate-200 bg-white text-slate-600"
              }`}
            >
              <span>{t("tech.take.timeRemaining")}</span>
              <span className="font-mono font-semibold tabular-nums">
                {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, "0")}
              </span>
            </div>
          )}
          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <h2 className="inline-flex items-center gap-2 text-lg font-semibold text-[#010131]">
              <GraduationCap className="h-5 w-5 text-[#5391D5]" /> {displayName(test.domain_key, test.domain_name)}
            </h2>
            <p className="mt-1 text-xs text-slate-500">{t("tech.take.answerAll", { n: test.items.length })}</p>
          </div>
          {test.items.map((item, i) => {
            const multi = item.type === "multi";
            return (
              <section key={item.id} className="rounded-xl border bg-white p-5 shadow-sm">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
                    {skillLabel(item.skill)}
                  </span>
                  {item.cognitive && (
                    <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-indigo-600">
                      {t(`tech.take.cog.${item.cognitive}`)}
                    </span>
                  )}
                  {item.type === "scenario" && (
                    <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-violet-600">
                      {t("tech.take.typeScenario")}
                    </span>
                  )}
                  {item.type === "true_false" && (
                    <span className="rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-teal-600">
                      {t("tech.take.typeTrueFalse")}
                    </span>
                  )}
                  <span className="text-[10px] uppercase tracking-wide text-slate-400">{t(`tech.sme.diff.${item.difficulty}`)}</span>
                </div>
                {item.type === "scenario" && item.scenario && (
                  <p className="mb-2 rounded-md border-s-2 border-violet-300 bg-violet-50/40 px-3 py-2 text-[13px] leading-relaxed text-slate-700">
                    {item.scenario}
                  </p>
                )}
                <p className="text-sm font-semibold text-[#010131]">{i + 1}. {item.question}</p>
                {multi && <p className="mt-0.5 text-[11px] font-medium text-[#2b6cb0]">{t("tech.take.selectAll")}</p>}
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {item.options.map((opt, oi) => (
                    <label
                      key={oi}
                      className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm ${
                        isPicked(item.id, oi, multi) ? "border-[#5391D5] bg-[#5391D5]/5" : "border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      <input
                        type={multi ? "checkbox" : "radio"}
                        name={item.id}
                        checked={isPicked(item.id, oi, multi)}
                        onChange={() => (multi ? toggleMulti(item.id, oi) : toggleSingle(item.id, oi))}
                        className="accent-[#5391D5]"
                      />
                      <span>{opt}</span>
                    </label>
                  ))}
                </div>
              </section>
            );
          })}
          <button
            onClick={submit}
            disabled={busy || !allAnswered}
            className="inline-flex items-center gap-2 rounded-md bg-[#047857] px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            {busy ? t("tech.take.scoring") : t("tech.take.submit")}
          </button>
        </>
      )}

      {phase === "adaptive" && adaptiveItem && adaptiveProgress && (
        <>
          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <h2 className="inline-flex items-center gap-2 text-lg font-semibold text-[#010131]">
              <Gauge className="h-5 w-5 text-indigo-500" /> {t("tech.take.adaptiveTitle")}
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              {t("tech.take.adaptiveProgress", { n: adaptiveProgress.answered + 1, max: adaptiveProgress.max })}
              {adaptiveProgress.se != null && <span> · {t("tech.take.adaptiveSe", { se: adaptiveProgress.se.toFixed(2) })}</span>}
            </p>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-indigo-400 transition-all"
                style={{ width: `${Math.min(100, Math.round((adaptiveProgress.answered / Math.max(1, adaptiveProgress.max)) * 100))}%` }}
              />
            </div>
          </div>
          <section className="rounded-xl border bg-white p-5 shadow-sm">
            <div className="mb-2 flex items-center gap-2">
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
                {skillLabel(adaptiveItem.skill)}
              </span>
              <span className="text-[10px] uppercase tracking-wide text-slate-400">{t(`tech.sme.diff.${adaptiveItem.difficulty}`)}</span>
            </div>
            <p className="text-sm font-semibold text-[#010131]">{adaptiveProgress.answered + 1}. {adaptiveItem.question}</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {adaptiveItem.options.map((opt, oi) => (
                <label
                  key={oi}
                  className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm ${
                    adaptiveAnswer === oi ? "border-indigo-500 bg-indigo-50" : "border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <input type="radio" name={adaptiveItem.id} checked={adaptiveAnswer === oi} onChange={() => setAdaptiveAnswer(oi)} className="accent-indigo-500" />
                  <span>{opt}</span>
                </label>
              ))}
            </div>
          </section>
          <div className="flex items-center gap-3">
            <button
              onClick={answerAdaptive}
              disabled={busy || adaptiveAnswer == null}
              className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {busy ? t("tech.take.scoring") : t("tech.take.adaptiveNext")}
            </button>
            <span className="text-[11px] text-slate-400">{t("tech.take.adaptiveNote")}</span>
          </div>
        </>
      )}

      {phase === "result" && result && (
        <div className="space-y-5 rounded-xl border bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-slate-500">
                {result.certified && result.passedCut ? t("tech.take.certifiedProf") : t("tech.take.indicativeProf")} · {displayName(result.domain_key, result.domain_name)}
              </p>
              <div className={`mt-1 inline-flex items-center justify-center rounded-xl border-2 px-5 py-3 text-2xl font-bold ${LEVEL_TONE[result.proficiency.level]}`}>
                {result.proficiency.level}/5 · {t(`tech.take.levels.${result.proficiency.label}`)}
              </div>
              {result.band && result.band.levelLow !== result.band.levelHigh && (
                <p className="mt-1.5 text-[11px] text-slate-500">
                  {t("tech.take.bandRange", {
                    low: t(`tech.take.levels.${result.band.labelLow}`),
                    high: t(`tech.take.levels.${result.band.labelHigh}`),
                  })}
                  {result.band.underpowered && <span className="text-amber-600"> · {t("tech.take.bandShort")}</span>}
                </p>
              )}
            </div>
            <div className="rounded-md border bg-muted/20 p-3 text-center">
              <p className="text-[10px] uppercase tracking-wider text-slate-500">{t("tech.take.score")}</p>
              <p className="mt-1 text-lg font-bold tabular-nums">{result.correct}/{result.total}</p>
              <p className="text-[10px] text-slate-500">{result.pct}%</p>
            </div>
          </div>

          {/* Certified outcome: credential issued, or below the cut-score. */}
          {result.certified && result.passedCut && result.credentialCode && (
            <div className="rounded-md border border-emerald-300 bg-emerald-50 p-4">
              <p className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-800">
                <ShieldCheck className="h-4 w-4" /> {t("tech.take.credIssued")}
              </p>
              <p className="mt-1 text-xs text-emerald-700">{t("tech.take.credNote", { pct: result.pct, cut: result.cutPct })}</p>
              <a
                href={`/verify/${result.credentialCode}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-800"
              >
                <ExternalLink className="h-3.5 w-3.5" /> {t("tech.take.viewCred")}
              </a>
            </div>
          )}
          {result.certified && result.passedCut === false && (
            <div className="rounded-md border border-rose-200 bg-rose-50 p-4">
              <p className="inline-flex items-center gap-2 text-sm font-semibold text-rose-800">
                <AlertCircle className="h-4 w-4" /> {t("tech.take.belowCut")}
              </p>
              <p className="mt-1 text-xs text-rose-700">{t("tech.take.belowNote", { pct: result.pct, cut: result.cutPct })}</p>
            </div>
          )}

          {/* Per-competency breakdown (00074 tier) - only when the function has competencies */}
          {(() => {
            const fn = functions.find((f) => f.ref === result.domain_key);
            const groups = (fn?.competencies ?? []).map((c) => ({ nameEn: c.nameEn, name: c.name, skillsEn: c.skillsEn }));
            if (groups.length === 0) return null;
            const comp = aggregateByCompetency(result.perSkill, groups, language);
            if (comp.length === 0) return null;
            return (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">{t("tech.take.byCompetency")}</p>
                <div className="space-y-1.5">
                  {comp.map((c) => {
                    const tier = proficiencyTier(c.pct);
                    return (
                      <div key={c.competencyEn} className="flex items-center gap-3 text-xs">
                        <span className="w-48 shrink-0 truncate font-medium">{c.competency}</span>
                        <div className="flex flex-1 gap-1">
                          {Array.from({ length: c.total }).map((_, n) => (
                            <span key={n} className={`h-2 flex-1 rounded-full ${n < c.correct ? "bg-[#5391D5]" : "bg-slate-200"}`} />
                          ))}
                        </div>
                        <span className={`w-24 shrink-0 rounded-full border px-2 py-0.5 text-center text-[10px] font-semibold ${tier.tone}`}>
                          {proficiencyTierLabel(tier.tier, language)}
                        </span>
                        <span className="w-12 shrink-0 text-right tabular-nums text-slate-500">{c.correct}/{c.total}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* Per-skill breakdown */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">{t("tech.take.bySkill")}</p>
            <div className="space-y-1.5">
              {result.perSkill.map((s) => (
                <div key={s.skill} className="flex items-center gap-3 text-xs">
                  <span className="w-56 shrink-0 truncate">{skillLabel(s.skill)}</span>
                  <div className="flex flex-1 gap-1">
                    {Array.from({ length: s.total }).map((_, n) => (
                      <span key={n} className={`h-2 flex-1 rounded-full ${n < s.correct ? "bg-[#5391D5]" : "bg-slate-200"}`} />
                    ))}
                  </div>
                  <span className="w-10 shrink-0 text-right tabular-nums text-slate-500">{s.correct}/{s.total}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Certified track that PASSED the cut-score → green certified disclaimer.
              Indicative track → amber disclaimer. A certified track that did NOT
              pass earns no credential and is not "Certified"; the rose below-cut
              panel above already explains it, so show no green/certified footer. */}
          {result.certified && result.passedCut ? (
            <div className="flex items-start gap-2 rounded-md border border-slate-200 bg-slate-50 p-3 text-[11px] text-slate-600">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
              <span>{t("tech.take.discCertified", { levels: t("tech.take.levelsLine") })}</span>
            </div>
          ) : !result.certified ? (
            <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-[11px] text-amber-800">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                {t("tech.take.discIndicative", {
                  kind: result.ai_generated ? t("tech.take.aiAuthored") : t("tech.take.placeholder"),
                  levels: t("tech.take.levelsLine"),
                })}
              </span>
            </div>
          ) : null}

          {!locked && (
            <button
              onClick={reset}
              className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              <RotateCcw className="h-4 w-4" /> {t("tech.take.restart")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
