"use client";

import { useMemo, useState, useRef, useCallback } from "react";
import {
  Layers, Sparkles, Loader2, CheckCircle2, RotateCcw, ChevronLeft, ChevronRight,
  AlertTriangle, Download, Target, GraduationCap, Shuffle,
} from "lucide-react";
import type { BehavioralCompetency } from "@/lib/scoring/behavioral-items";
import type { BehavioralProfileRow, BehavioralAnswer } from "@/lib/scoring/behavioral";
import { startPersonaAction, savePersonaAnswersAction, submitPersonaAction } from "../actions";
import { personaBand, personaBandLabel, PERSONA_BAND_TW } from "@/lib/scoring/persona-bands";
import {
  freshSeed, flattenNormativeItems, paginate, buildIpsativeBlocks,
  type FlatNormItem, type IpsativeBlock, type IpsativeChoice,
} from "@/lib/scoring/persona-format";
import {
  computeFit, competencyNarrative, developmentNarrative, FIT_BAND_TW, type RoleCompReq, type FitResult,
} from "@/lib/scoring/persona-fit";
import type { RecommendedCourse } from "@/lib/recommender/courses";
import { VIFM_VERTICAL_LABELS } from "@/types/database";
import { PersonaReportView } from "./persona-report-view";
import type { PersonaPdfData } from "@/lib/reports/persona-profile";

// Inlined from the recommender (a value import from that module would pull its
// server-only @/lib/supabase/server dependency into this client component).
const HIGH_FIT_THRESHOLD = 4;

type Lang = "en" | "ar";
type Phase = "intro" | "normative" | "ipsative" | "result";
type Purpose = "development" | "hiring";

const LIKERT = [1, 2, 3, 4, 5];
const ITEMS_PER_PAGE = 12;

export type RoleProfileOption = { id: string; name: string; comps: RoleCompReq[] };

export function PersonaStandaloneClient({
  competencies,
  redemptionToken = null,
  prefillName,
  roleProfiles = [],
  pinned = null,
  definitions = {},
  demo = false,
}: {
  competencies: BehavioralCompetency[];
  /** Voucher redemption token (delegate flow); stamps the result with the client org. */
  redemptionToken?: string | null;
  prefillName?: string;
  /** Role profiles offered for a hiring fit read (empty = hiring picker hidden). */
  roleProfiles?: RoleProfileOption[];
  /** Competency id -> framework definition, for the result's per-competency detail. */
  definitions?: Record<string, string>;
  /** Demo mode (?demo=1 or dev): shows a "Fill random answers" shortcut so a
   *  presenter can skip clicking every item live. Never shown to real candidates. */
  demo?: boolean;
  /** Admin-pinned scope (voucher delegate). When set, the purpose + role are
   *  fixed by the admin and the candidate cannot change them - the picker is
   *  replaced by a read-only summary. The competency scope is already applied
   *  upstream (the `competencies` prop is pre-filtered). */
  pinned?: { purpose: Purpose; roleProfileId: string | null; roleName: string | null } | null;
}) {
  const [phase, setPhase] = useState<Phase>("intro");
  const [lang, setLang] = useState<Lang>("en");
  const [name, setName] = useState(prefillName ?? "");
  const [purpose, setPurpose] = useState<Purpose>(pinned?.purpose ?? "development");
  const [targetRoleId, setTargetRoleId] = useState(pinned?.roleProfileId ?? "");
  // Standalone coverage override: assess only the role's competencies (default,
  // the efficient scoped test) or the full framework (to show the whole
  // instrument). The fit is always computed against the role either way.
  const [scopeMode, setScopeMode] = useState<"role" | "full">("role");
  const [seed, setSeed] = useState<number>(0);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [ipsChoices, setIpsChoices] = useState<Record<string, { most?: string; least?: string }>>({});
  const [profile, setProfile] = useState<BehavioralProfileRow[] | null>(null);
  // AI per-competency insights (hiring or development), grounded in the answers.
  const [insights, setInsights] = useState<Record<string, string>>({});
  // VIFM Academy course plan (development result only).
  const [courses, setCourses] = useState<RecommendedCourse[]>([]);
  // Full report payload (PersonaPdfData) - the on-screen result renders this so
  // it matches the PDF section-for-section. Falls back to the lighter view if null.
  const [report, setReport] = useState<PersonaPdfData | null>(null);
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const ar = lang === "ar";
  const tx = (en: string, arabic: string) => (ar ? arabic : en);

  // Autosave is debounced + batched: answers accumulate in a buffer keyed by
  // itemKey and flush in ONE server action call ~700ms after the last change
  // (and immediately before page-advance / submit). This collapses what would
  // otherwise be one server-action round-trip per click (160+ per test) into a
  // handful, avoiding the request storm + router-refresh cascade that one save
  // per answer produces.
  const pendingRef = useRef<Map<string, BehavioralAnswer>>(new Map());
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The save currently hitting the server, if any. flush() always awaits it
  // before scoring so a debounced auto-save that is still persisting cannot be
  // skipped - the "fill all answers, then submit immediately" race that would
  // otherwise score an empty session (zero).
  const inflightRef = useRef<Promise<void> | null>(null);

  const flush = useCallback(async (): Promise<void> => {
    if (flushTimer.current) { clearTimeout(flushTimer.current); flushTimer.current = null; }
    if (inflightRef.current) { try { await inflightRef.current; } catch { /* ignore */ } }
    if (!sessionId) return;
    const batch = [...pendingRef.current.values()];
    if (batch.length === 0) return;
    pendingRef.current.clear();
    setSaving(true);
    const p = (async () => {
      try { await savePersonaAnswersAction(sessionId, batch); }
      finally { setSaving(false); }
    })();
    inflightRef.current = p;
    try { await p; } finally { if (inflightRef.current === p) inflightRef.current = null; }
  }, [sessionId]);

  const queue = useCallback((a: BehavioralAnswer) => {
    pendingRef.current.set(a.itemKey, a);
    if (flushTimer.current) clearTimeout(flushTimer.current);
    flushTimer.current = setTimeout(() => { void flush(); }, 700);
  }, [flush]);

  // The competency set actually served. The ROLE PROFILE is the single source
  // of truth for scope: on the standalone path, selecting a hiring role narrows
  // the assessment to that role's competencies (just like a voucher does), so
  // the same designed role yields the same scoped test either way. On the
  // voucher path the `competencies` prop is already scoped upstream and `pinned`
  // is set, so we leave it untouched (it may carry an admin override).
  const effectiveCompetencies = useMemo<BehavioralCompetency[]>(() => {
    if (pinned) return competencies;
    // "full" override: assess the whole framework even with a role selected.
    if (!targetRoleId || scopeMode === "full") return competencies;
    const role = roleProfiles.find((r) => r.id === targetRoleId);
    if (!role || role.comps.length === 0) return competencies;
    const want = new Set(role.comps.map((c) => c.competencyId));
    const scoped = competencies.filter((c) => want.has(c.acCompetencyId));
    return scoped.length > 0 ? scoped : competencies;
  }, [competencies, pinned, targetRoleId, roleProfiles, scopeMode]);

  // How many of the selected role's competencies exist in the served bank
  // (drives the coverage-toggle label).
  const roleCompCount = useMemo(() => {
    const role = roleProfiles.find((r) => r.id === targetRoleId);
    if (!role) return 0;
    const bankIds = new Set(competencies.map((c) => c.acCompetencyId));
    return role.comps.filter((c) => bankIds.has(c.competencyId)).length;
  }, [competencies, roleProfiles, targetRoleId]);

  // Seeded, section-hidden layouts (stable once the seed is set at begin()).
  const normItems = useMemo<FlatNormItem[]>(
    () => (seed ? flattenNormativeItems(effectiveCompetencies, seed) : []),
    [effectiveCompetencies, seed],
  );
  const normPages = useMemo(() => paginate(normItems, ITEMS_PER_PAGE), [normItems]);
  const ipsBlocks = useMemo<IpsativeBlock[]>(
    () => (seed ? buildIpsativeBlocks(effectiveCompetencies, seed) : []),
    [effectiveCompetencies, seed],
  );

  const totalNorm = normItems.length;
  const answeredNorm = Object.keys(answers).length;
  const allNormAnswered = answeredNorm >= totalNorm && totalNorm > 0;
  const blocksDone = ipsBlocks.filter((b) => ipsChoices[b.blockId]?.most && ipsChoices[b.blockId]?.least).length;
  const allIpsDone = ipsBlocks.length > 0 ? blocksDone >= ipsBlocks.length : true;

  const begin = async () => {
    setBusy(true); setError("");
    const s = freshSeed();
    try {
      const res = await startPersonaAction(name, redemptionToken, {
        purpose,
        // The target role drives scope + the report for BOTH purposes.
        targetRoleProfileId: targetRoleId || null,
        seed: s,
      });
      if (!res.ok) { setError(res.error); return; }
      setSeed(s); setSessionId(res.sessionId); setPhase("normative"); setPage(0);
    } catch { setError(tx("Could not start the Persona assessment.", "تعذّر بدء تقييم بيرسونا.")); }
    finally { setBusy(false); }
  };

  const answerNorm = (it: FlatNormItem, value: number) => {
    setAnswers((prev) => ({ ...prev, [it.itemKey]: value }));
    queue({ itemKey: it.itemKey, competencyId: it.competencyId, rawScore: value, isReverse: it.reverse });
  };

  // Forced-choice: record most/least, enforce distinct, and queue the whole
  // block once both are picked (most=5, least=1, the rest=3 neutral). State
  // update + autosave queueing both run in the event handler (never inside the
  // setState updater - a side effect during render is illegal and drops state).
  const chooseIps = (block: IpsativeBlock, statementKey: string, choice: IpsativeChoice) => {
    const prev = ipsChoices[block.blockId] ?? {};
    const cur: { most?: string; least?: string } = { ...prev };
    // Toggle off if re-clicking the same cell.
    if (cur[choice] === statementKey) { delete cur[choice]; }
    else {
      cur[choice] = statementKey;
      // The same statement can't be both most and least.
      const other: IpsativeChoice = choice === "most" ? "least" : "most";
      if (cur[other] === statementKey) delete cur[other];
    }
    setIpsChoices((p) => ({ ...p, [block.blockId]: cur }));
    if (cur.most && cur.least) {
      const mostKey = cur.most, leastKey = cur.least;
      for (const st of block.statements) {
        const raw = st.itemKey === mostKey ? 5 : st.itemKey === leastKey ? 1 : 3;
        const ch = st.itemKey === mostKey ? "most" : st.itemKey === leastKey ? "least" : "mid";
        queue({
          itemKey: st.itemKey, competencyId: st.competencyId, rawScore: raw,
          isReverse: false, itemType: "ipsative", answerData: { block: block.blockId, choice: ch },
        });
      }
    }
  };

  // Demo shortcut: fill every normative item with a random 1-5 and every
  // ipsative block with a random distinct most/least, queue them for autosave,
  // and jump to the ipsative phase so Submit is one click away. Demo-only (never
  // shown to real candidates) so it cannot taint a genuine sitting.
  const fillRandom = () => {
    const rand5 = () => 1 + Math.floor(Math.random() * 5);
    const nextAnswers: Record<string, number> = {};
    for (const it of normItems) {
      const v = rand5();
      nextAnswers[it.itemKey] = v;
      queue({ itemKey: it.itemKey, competencyId: it.competencyId, rawScore: v, isReverse: it.reverse });
    }
    setAnswers(nextAnswers);

    const nextIps: Record<string, { most?: string; least?: string }> = {};
    for (const block of ipsBlocks) {
      const n = block.statements.length;
      if (n === 0) continue;
      const mostIdx = Math.floor(Math.random() * n);
      let leastIdx = Math.floor(Math.random() * n);
      if (n > 1) while (leastIdx === mostIdx) leastIdx = Math.floor(Math.random() * n);
      const mostKey = block.statements[mostIdx].itemKey;
      const leastKey = block.statements[leastIdx].itemKey;
      nextIps[block.blockId] = { most: mostKey, least: leastKey };
      for (const st of block.statements) {
        const raw = st.itemKey === mostKey ? 5 : st.itemKey === leastKey ? 1 : 3;
        const ch = st.itemKey === mostKey ? "most" : st.itemKey === leastKey ? "least" : "mid";
        queue({
          itemKey: st.itemKey, competencyId: st.competencyId, rawScore: raw,
          isReverse: false, itemType: "ipsative", answerData: { block: block.blockId, choice: ch },
        });
      }
    }
    setIpsChoices(nextIps);
    void flush(); // persist all filled answers immediately (not just on the debounce)
    if (phase === "normative") { setPhase("ipsative"); window.scrollTo({ top: 0 }); }
  };

  const submit = async () => {
    if (!sessionId) return;
    setBusy(true); setError("");
    try {
      await flush(); // persist any buffered answers before scoring
      const res = await submitPersonaAction(sessionId, lang);
      if (!res.ok || !res.profile) { setError(res.error || tx("Could not score.", "تعذّر التقييم.")); return; }
      setReport((res as { report?: PersonaPdfData }).report ?? null);
      setProfile(res.profile); setPhase("result");
    } catch { setError(tx("Could not score.", "تعذّر التقييم.")); } finally { setBusy(false); }
  };

  const reset = () => {
    if (flushTimer.current) { clearTimeout(flushTimer.current); flushTimer.current = null; }
    pendingRef.current.clear();
    setPhase("intro"); setSessionId(null); setAnswers({}); setIpsChoices({});
    setProfile(null); setInsights({}); setCourses([]); setReport(null); setPage(0); setSeed(0); setError("");
  };

  const likertLabel = (v: number) =>
    ar
      ? ["لا أوافق بشدة", "لا أوافق", "محايد", "أوافق", "أوافق بشدة"][v - 1]
      : ["Strongly disagree", "Disagree", "Neither", "Agree", "Strongly agree"][v - 1];

  const selectedRole = roleProfiles.find((r) => r.id === targetRoleId) ?? null;

  return (
    <div dir={ar ? "rtl" : "ltr"} className="space-y-5">
      {/* Demo shortcut (only with ?demo=1 or in dev). Fills every answer so a
          presenter can skip clicking each item live; hidden from real candidates. */}
      {demo && (phase === "normative" || phase === "ipsative") && (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-dashed border-amber-400 bg-amber-50 px-3 py-2">
          <span className="text-xs font-medium text-amber-800">{tx("Demo tools", "أدوات العرض")}</span>
          <button
            type="button"
            onClick={fillRandom}
            className="inline-flex items-center gap-1.5 rounded-md bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700"
          >
            <Shuffle className="h-3.5 w-3.5" /> {tx("Fill random answers", "تعبئة إجابات عشوائية")}
          </button>
        </div>
      )}
      <div>
        <h1 className="inline-flex items-center gap-2 text-2xl font-bold text-[#010131]">
          <Layers className="h-6 w-6 text-[#5391D5]" /> {tx("Persona®", "بيرسونا®")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {tx(
            "Behavioural Competency Self-Assessment - self-ratings across the VIFM competency framework (the same framework as the 360).",
            "التقييم الذاتي للجدارات السلوكية - تقييم ذاتي عبر إطار جدارات VIFM (الإطار نفسه المستخدم في تقييم 360).",
          )}
        </p>
      </div>

      {error && <div className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}

      {phase === "intro" && (
        <div className="space-y-5 rounded-xl border bg-card p-6">
          {pinned ? (
            /* Admin-pinned (voucher delegate): purpose + role are fixed; the
               candidate just begins. Scope is already applied to the items. */
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <span className="inline-flex items-center gap-2 font-semibold text-[#010131]">
                {pinned.purpose === "hiring" ? (
                  <Target className="h-4 w-4 text-[#5391D5]" />
                ) : (
                  <GraduationCap className="h-4 w-4 text-[#5391D5]" />
                )}
                {pinned.purpose === "hiring"
                  ? tx("Hiring / selection assessment", "تقييم التوظيف / الاختيار")
                  : tx("Development assessment", "تقييم تطويري")}
              </span>
              {pinned.roleName && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {pinned.purpose === "hiring"
                    ? tx("Assessing for: ", "التقييم لدور: ")
                    : tx("Developing toward: ", "التطوير نحو دور: ")}
                  <span className="font-medium text-[#010131]">{pinned.roleName}</span>
                </p>
              )}
              <p className="mt-1 text-xs text-muted-foreground">
                {tx(
                  `This assessment covers ${competencies.length} competenc${competencies.length === 1 ? "y" : "ies"}, set by the organization.`,
                  `يغطي هذا التقييم ${competencies.length} جدارة، وقد حدّدتها المؤسسة.`,
                )}
              </p>
            </div>
          ) : (
            <>
              {/* Purpose - drives the result (development narrative vs hiring fit). */}
              <div>
                <p className="text-xs font-medium text-slate-500">{tx("What is this assessment for?", "ما الغرض من هذا التقييم؟")}</p>
                <div className="mt-2 grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setPurpose("development")}
                    className={`rounded-lg border p-4 text-start transition ${purpose === "development" ? "border-[#5391D5] bg-[#5391D5]/5 ring-1 ring-[#5391D5]" : "border-slate-200 hover:bg-slate-50"}`}
                  >
                    <span className="inline-flex items-center gap-2 font-semibold text-[#010131]">
                      <GraduationCap className="h-4 w-4 text-[#5391D5]" /> {tx("Development", "التطوير")}
                    </span>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {tx("A growth plan vs a target role + recommended VIFM courses.", "خطة تطوير مقابل دور مستهدف + دورات VIFM الموصى بها.")}
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPurpose("hiring")}
                    className={`rounded-lg border p-4 text-start transition ${purpose === "hiring" ? "border-[#5391D5] bg-[#5391D5]/5 ring-1 ring-[#5391D5]" : "border-slate-200 hover:bg-slate-50"}`}
                  >
                    <span className="inline-flex items-center gap-2 font-semibold text-[#010131]">
                      <Target className="h-4 w-4 text-[#5391D5]" /> {tx("Hiring / selection", "التوظيف / الاختيار")}
                    </span>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {tx("A fit score against a target role profile.", "درجة ملاءمة مقابل ملف دور مستهدف.")}
                    </p>
                  </button>
                </div>
              </div>

              {/* Target role - drives scope + the report for BOTH purposes:
                  the hiring fit and the development plan both compare against it. */}
              <div className="rounded-lg border border-slate-200 p-3">
                  <p className="text-xs font-medium text-[#010131]">
                    {purpose === "hiring"
                      ? tx("Target role", "الدور المستهدف")
                      : tx("Role to develop toward", "الدور المستهدف للتطوير")}
                  </p>
                  {roleProfiles.length > 0 ? (
                    <select
                      value={targetRoleId}
                      onChange={(e) => setTargetRoleId(e.target.value)}
                      className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    >
                      <option value="">{tx("Select a role profile…", "اختر ملف دور…")}</option>
                      {roleProfiles.map((r) => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                      ))}
                    </select>
                  ) : (
                    <p className="mt-1 text-xs text-amber-600">
                      {purpose === "hiring"
                        ? tx("No role profiles available. Create one under Design Target Roles to get a fit score.", "لا تتوفّر ملفات أدوار. أنشئ ملفًا في (تصميم الأدوار المستهدفة) للحصول على درجة الملاءمة.")
                        : tx("No role profiles available. Create one under Design Target Roles to get a development plan.", "لا تتوفّر ملفات أدوار. أنشئ ملفًا في (تصميم الأدوار المستهدفة) للحصول على خطة تطوير.")}
                    </p>
                  )}

                  {/* Coverage override: the role's competencies (scoped) or the
                      whole framework. Fit is computed against the role either way. */}
                  {targetRoleId && roleCompCount > 0 && (
                    <div className="mt-3">
                      <p className="text-xs font-medium text-slate-500">{tx("Competency coverage", "تغطية الجدارات")}</p>
                      <div className="mt-1.5 inline-flex rounded-lg border border-slate-200 p-0.5">
                        <button
                          type="button"
                          onClick={() => setScopeMode("role")}
                          className={`rounded-md px-3 py-1.5 text-sm font-medium ${scopeMode === "role" ? "bg-[#5391D5] text-white" : "text-slate-600 hover:bg-slate-100"}`}
                        >
                          {tx(`Role competencies (${roleCompCount})`, `جدارات الدور (${roleCompCount})`)}
                        </button>
                        <button
                          type="button"
                          onClick={() => setScopeMode("full")}
                          className={`rounded-md px-3 py-1.5 text-sm font-medium ${scopeMode === "full" ? "bg-[#5391D5] text-white" : "text-slate-600 hover:bg-slate-100"}`}
                        >
                          {tx(`Full profile (${competencies.length})`, `الملف الكامل (${competencies.length})`)}
                        </button>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {scopeMode === "full"
                          ? tx("Assessing the whole framework; the report still scores against the role.", "تقييم كامل الإطار؛ ويُحتسب التقرير مقابل الدور.")
                          : tx("Assessing only the role's competencies (shorter, targeted).", "تقييم جدارات الدور فقط (أقصر وأكثر استهدافًا).")}
                      </p>
                    </div>
                  )}
                </div>
            </>
          )}

          <div className="rounded-lg border border-[#5391D5] bg-[#5391D5]/5 p-4">
            <p className="font-semibold text-[#010131]">{tx("How it works", "كيف يعمل")}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {tx(
                `Part 1: ${totalNormPreview(effectiveCompetencies)} statements rated 1-5 (in random order). Part 2: a few quick "most / least like me" choices.`,
                `الجزء 1: ${totalNormPreview(effectiveCompetencies)} عبارة تُقيَّم من 1 إلى 5 (بترتيب عشوائي). الجزء 2: اختيارات سريعة (الأكثر/الأقل انطباقًا عليّ).`,
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-end gap-4">
            <label className="min-w-[12rem] flex-1">
              <span className="text-xs font-medium text-slate-500">{tx("Your name (optional)", "اسمك (اختياري)")}</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                dir="ltr"
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                placeholder="e.g. Sara Al Mansoori"
              />
            </label>
            <div className="flex items-center gap-2">
              <span className="text-[11px] uppercase tracking-wide text-slate-400">{tx("Language", "اللغة")}</span>
              <div className="inline-flex rounded-lg border border-slate-200 p-0.5">
                {(["en", "ar"] as Lang[]).map((l) => (
                  <button
                    key={l}
                    onClick={() => setLang(l)}
                    className={`rounded-md px-3 py-1.5 text-sm font-medium ${lang === l ? "bg-[#5391D5] text-white" : "text-slate-600 hover:bg-slate-100"}`}
                  >
                    {l === "en" ? "English" : "العربية"}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <button
            onClick={begin}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg bg-[#010131] px-6 py-3 text-sm font-semibold text-white hover:bg-[#121140] disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {busy ? tx("Preparing…", "جارٍ التحضير…") : tx("Begin Persona assessment", "ابدأ تقييم بيرسونا")}
          </button>
        </div>
      )}

      {phase === "normative" && (
        <div className="space-y-4">
          <ProgressBar value={answeredNorm} total={totalNorm} ar={ar} />
          <p className="text-sm font-semibold text-[#010131]">
            {tx("Rate each statement", "قيّم كل عبارة")} · {tx("Page", "صفحة")} {page + 1}/{normPages.length}
          </p>

          <section className="space-y-3 rounded-lg border bg-white p-4">
            {(normPages[page] ?? []).map((it) => (
              <div key={it.itemKey} className="space-y-1.5 border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                <p className="text-sm">{ar ? it.textAr : it.textEn}</p>
                <div className="flex flex-wrap gap-1.5">
                  {LIKERT.map((v) => {
                    const selected = answers[it.itemKey] === v;
                    return (
                      <button
                        key={v}
                        type="button"
                        title={likertLabel(v)}
                        onClick={() => answerNorm(it, v)}
                        className={`min-w-[2.25rem] rounded-md border px-2.5 py-1.5 text-sm transition ${
                          selected ? "border-[#5391D5] bg-[#5391D5] text-white" : "border-border hover:bg-muted"
                        }`}
                      >
                        {v}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </section>

          <div className="flex items-center justify-between gap-3">
            <button
              disabled={page === 0}
              onClick={() => setPage((s) => Math.max(0, s - 1))}
              className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              <ChevronLeft className="h-4 w-4" /> {tx("Previous", "السابق")}
            </button>
            <span className="text-[11px] text-muted-foreground">
              {saving ? tx("Saving…", "جارٍ الحفظ…") : tx("Answers save automatically", "تُحفظ الإجابات تلقائيًا")}
            </span>
            {page < normPages.length - 1 ? (
              <button
                onClick={() => setPage((s) => Math.min(normPages.length - 1, s + 1))}
                className="inline-flex items-center gap-1 rounded-md bg-[#010131] px-4 py-2 text-sm font-semibold text-white hover:bg-[#121140]"
              >
                {tx("Next", "التالي")} <ChevronRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                onClick={() => { void flush(); setPhase("ipsative"); window.scrollTo({ top: 0 }); }}
                disabled={!allNormAnswered}
                className="inline-flex items-center gap-1 rounded-md bg-[#010131] px-4 py-2 text-sm font-semibold text-white hover:bg-[#121140] disabled:opacity-50"
              >
                {tx("Continue", "متابعة")} <ChevronRight className="h-4 w-4" />
              </button>
            )}
          </div>
          {!allNormAnswered && page === normPages.length - 1 && (
            <p className="flex items-center justify-end gap-1 text-end text-[11px] text-amber-600">
              <AlertTriangle className="h-3.5 w-3.5" />
              {tx(
                `Answer all ${totalNorm} statements to continue (${totalNorm - answeredNorm} left).`,
                `أجب عن جميع العبارات (${totalNorm}) للمتابعة (تبقّى ${totalNorm - answeredNorm}).`,
              )}
            </p>
          )}
        </div>
      )}

      {phase === "ipsative" && (
        <div className="space-y-4">
          <ProgressBar value={blocksDone} total={ipsBlocks.length} ar={ar} unit={tx("blocks", "مجموعات")} />
          <div className="rounded-lg border border-[#5391D5] bg-[#5391D5]/5 p-3">
            <p className="text-sm font-semibold text-[#010131]">{tx("Most / least like me", "الأكثر / الأقل انطباقًا عليّ")}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {tx(
                "In each set, mark the one statement MOST like you and the one LEAST like you.",
                "في كل مجموعة، حدّد العبارة الأكثر انطباقًا عليك والعبارة الأقل انطباقًا عليك.",
              )}
            </p>
          </div>

          {ipsBlocks.map((block, bi) => {
            const ch = ipsChoices[block.blockId] ?? {};
            const complete = ch.most && ch.least;
            return (
              <section key={block.blockId} className={`rounded-lg border bg-white p-4 ${complete ? "border-emerald-200" : "border-slate-200"}`}>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-medium text-slate-500">{tx("Set", "مجموعة")} {bi + 1}/{ipsBlocks.length}</p>
                  {complete && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
                </div>
                <div className="space-y-2">
                  {block.statements.map((st) => {
                    const isMost = ch.most === st.itemKey;
                    const isLeast = ch.least === st.itemKey;
                    return (
                      <div key={st.itemKey} className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => chooseIps(block, st.itemKey, "most")}
                          className={`shrink-0 rounded-md border px-2 py-1 text-[11px] font-semibold transition ${isMost ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-200 text-slate-500 hover:bg-emerald-50"}`}
                        >
                          {tx("Most", "الأكثر")}
                        </button>
                        <button
                          type="button"
                          onClick={() => chooseIps(block, st.itemKey, "least")}
                          className={`shrink-0 rounded-md border px-2 py-1 text-[11px] font-semibold transition ${isLeast ? "border-rose-500 bg-rose-500 text-white" : "border-slate-200 text-slate-500 hover:bg-rose-50"}`}
                        >
                          {tx("Least", "الأقل")}
                        </button>
                        <span className="text-sm">{ar ? st.textAr : st.textEn}</span>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}

          <div className="flex items-center justify-between gap-3">
            <button
              onClick={() => { setPhase("normative"); setPage(normPages.length - 1); }}
              className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              <ChevronLeft className="h-4 w-4" /> {tx("Back", "رجوع")}
            </button>
            <span className="text-[11px] text-muted-foreground">
              {saving ? tx("Saving…", "جارٍ الحفظ…") : tx("Answers save automatically", "تُحفظ الإجابات تلقائيًا")}
            </span>
            <button
              onClick={submit}
              disabled={!allNormAnswered || !allIpsDone || busy}
              className="inline-flex items-center gap-2 rounded-md bg-[#047857] px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {busy ? tx("Scoring…", "جارٍ التقييم…") : tx("Submit", "إرسال")}
            </button>
          </div>
          {!allIpsDone && (
            <p className="flex items-center justify-end gap-1 text-end text-[11px] text-amber-600">
              <AlertTriangle className="h-3.5 w-3.5" />
              {tx(
                `Complete all ${ipsBlocks.length} sets to submit (${ipsBlocks.length - blocksDone} left).`,
                `أكمل جميع المجموعات (${ipsBlocks.length}) للإرسال (تبقّى ${ipsBlocks.length - blocksDone}).`,
              )}
            </p>
          )}
        </div>
      )}

      {phase === "result" && profile && (
        pinned?.purpose === "hiring" ? (
          /* Hiring voucher (candidate) flow: results are NOT shown to the
             taker - the fit report is a client/admin deliverable. */
          <div className="rounded-xl border bg-card p-10 text-center" dir={ar ? "rtl" : "ltr"}>
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-2xl text-emerald-700">
              ✓
            </div>
            <h2 className="text-lg font-semibold text-[#010131]">
              {tx("Your assessment has been submitted", "تم إرسال تقييمك")}
            </h2>
            <p className="mt-3 text-sm text-muted-foreground">
              {tx(
                "Thank you. Your responses have been recorded and will be shared with the requesting organization. Results are not shown here.",
                "شكراً لك. تم تسجيل إجاباتك وستتم مشاركتها مع المؤسسة الطالبة للتقييم، ولا تُعرض النتائج هنا.",
              )}
            </p>
          </div>
        ) : report ? (
          <PersonaReportView data={report} ar={ar} sessionId={sessionId} onReset={reset} />
        ) : (
          <PersonaResult
            competencies={competencies}
            profile={profile}
            name={name.trim()}
            ar={ar}
            onReset={reset}
            sessionId={sessionId}
            purpose={purpose}
            role={selectedRole}
            definitions={definitions}
            insights={insights}
            courses={courses}
          />
        )
      )}
    </div>
  );
}

function totalNormPreview(competencies: BehavioralCompetency[]): number {
  return competencies.reduce((n, c) => n + c.items.length, 0);
}

function ProgressBar({ value, total, ar, unit }: { value: number; total: number; ar: boolean; unit?: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-[#5391D5]" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs tabular-nums text-muted-foreground">
        {value}/{total}{unit ? ` ${unit}` : ""}
      </span>
    </div>
  );
}

function PersonaResult({
  competencies, profile, name, ar, onReset, sessionId, purpose, role, definitions = {}, insights = {}, courses = [],
}: {
  competencies: BehavioralCompetency[];
  profile: BehavioralProfileRow[];
  name: string;
  ar: boolean;
  onReset: () => void;
  sessionId: string | null;
  purpose: Purpose;
  role: RoleProfileOption | null;
  definitions?: Record<string, string>;
  /** AI per-competency insights (hiring or development); falls back to a deterministic narrative. */
  insights?: Record<string, string>;
  /** VIFM Academy course plan (development result only). */
  courses?: RecommendedCourse[];
}) {
  const tx = (en: string, arabic: string) => (ar ? arabic : en);
  const scoreById = useMemo(() => new Map(profile.map((p) => [p.competencyId, p.selfScore])), [profile]);

  // Fit is computed for BOTH purposes when a role is selected: hiring renders it
  // as a fit score, development as "current alignment" + a development plan.
  // Compute only over the role competencies that were actually served (a scoped
  // sitting may omit some) - mirrors the PDF route so on-screen and downloaded
  // figures can't diverge; unmeasured comps must not count as 0.
  const fit: FitResult | null = useMemo(() => {
    if (!role) return null;
    const measured = role.comps.filter((c) => scoreById.has(c.competencyId));
    return computeFit(scoreById, measured);
  }, [role, scoreById]);

  const nameById = useMemo(
    () => new Map(competencies.map((c) => [c.acCompetencyId, ar ? c.nameAr : c.nameEn])),
    [competencies, ar],
  );

  // Group competencies by cluster, attaching the self score where present.
  const clusters = useMemo(() => {
    const byCluster = new Map<number, { nameEn: string; nameAr: string; rows: { id: string; name: string; score: number }[] }>();
    for (const c of competencies) {
      const score = scoreById.get(c.acCompetencyId);
      if (score == null) continue;
      if (!byCluster.has(c.clusterOrder)) byCluster.set(c.clusterOrder, { nameEn: c.clusterNameEn, nameAr: c.clusterNameAr, rows: [] });
      byCluster.get(c.clusterOrder)!.rows.push({ id: c.acCompetencyId, name: ar ? c.nameAr : c.nameEn, score });
    }
    return Array.from(byCluster.entries()).sort((a, b) => a[0] - b[0]).map(([order, v]) => ({ order, ...v }));
  }, [competencies, ar, scoreById]);

  const all = profile.map((p) => p.selfScore);
  const overall = all.length ? Math.round((all.reduce((a, b) => a + b, 0) / all.length) * 100) / 100 : 0;

  // Development: the lowest-scoring competencies become the focus list.
  const focus = useMemo(() => {
    if (purpose !== "development") return [];
    return [...profile]
      .sort((a, b) => a.selfScore - b.selfScore)
      .slice(0, 5)
      .map((p) => ({ name: nameById.get(p.competencyId) ?? "", score: p.selfScore }));
  }, [purpose, profile, nameById]);

  return (
    <div className="space-y-5 rounded-xl border bg-white p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {name ? (
          <p className="text-sm text-slate-500">{tx("Self-profile for", "الملف الذاتي لـ")} <span className="font-semibold text-[#010131]">{name}</span></p>
        ) : <span />}
        <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
          {purpose === "hiring" ? tx("Hiring fit · self-report", "ملاءمة توظيف · تقييم ذاتي") : tx("Development · self-report", "تطوير · تقييم ذاتي")}
        </span>
      </div>

      {/* HIRING: fit headline + biggest gaps */}
      {purpose === "hiring" && fit && (
        <div className="rounded-lg border border-slate-200 p-4">
          <div className="text-center">
            <p className="text-base font-bold uppercase tracking-wide text-[#010131]">{tx("Role fit", "ملاءمة الدور")}</p>
            {role ? <p className="mt-1 text-xl font-semibold text-[#010131]">{role.name}</p> : null}
            <span className={`mt-2 inline-block rounded-lg px-6 py-2.5 text-3xl font-bold ${FIT_BAND_TW[fit.band]}`}>
              {fit.fitPct}% · {ar ? fit.bandLabelAr : fit.bandLabel}
            </span>
          </div>
          {/* Biggest strengths + biggest gaps, side by side */}
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-emerald-700">{tx("Biggest strengths", "أبرز نقاط القوة")}</p>
              <div className="mt-1 space-y-1">
                {fit.gaps.filter((g) => g.self != null && (g.self as number) >= g.target)
                  .sort((a, b) => ((b.self as number) - b.target) - ((a.self as number) - a.target))
                  .slice(0, 5).map((g) => (
                  <div key={g.competencyId} className="flex items-center justify-between text-sm">
                    <span className="text-[#010131]">{nameById.get(g.competencyId) ?? g.name}</span>
                    <span className="tabular-nums font-semibold text-emerald-600">{g.self?.toFixed(1)} / {g.target.toFixed(1)}</span>
                  </div>
                ))}
                {fit.gaps.filter((g) => g.self != null && (g.self as number) >= g.target).length === 0 && (
                  <p className="text-sm text-slate-400">{tx("None at or above target.", "لا شيء عند المستهدف أو أعلى.")}</p>
                )}
              </div>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wider text-rose-700">{tx("Biggest gaps vs the role target", "أكبر الفجوات مقابل المستهدف")}</p>
              <div className="mt-1 space-y-1">
                {fit.gaps.filter((g) => g.self != null && g.gap > 0).slice(0, 5).map((g) => (
                  <div key={g.competencyId} className="flex items-center justify-between text-sm">
                    <span className="text-[#010131]">{nameById.get(g.competencyId) ?? g.name}</span>
                    <span className="tabular-nums font-semibold text-rose-600">{g.self?.toFixed(1)} / {g.target.toFixed(1)}</span>
                  </div>
                ))}
                {fit.gaps.filter((g) => g.self != null && g.gap > 0).length === 0 && (
                  <p className="text-sm text-emerald-700">{tx("Meets or exceeds every target.", "يحقّق أو يتجاوز كل المستهدفات.")}</p>
                )}
              </div>
            </div>
          </div>

          {/* Per-competency detail: paired boxes - definition + an insight read
              from the candidate's own answers, with a target-coloured score. */}
          <div className="mt-4">
            <p className="text-[11px] uppercase tracking-wider text-slate-500">{tx("Competency detail", "تفصيل الجدارات")}</p>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              {fit.gaps.filter((g) => g.self != null).map((g) => {
                const meets = (g.self as number) >= g.target;
                return (
                  <div key={g.competencyId} className="flex flex-col rounded-lg border border-slate-200 p-3">
                    <span className="text-center text-sm font-semibold text-[#010131]">{nameById.get(g.competencyId) ?? g.name}</span>
                    <span className={`mt-1 text-center text-2xl font-bold tabular-nums ${meets ? "text-emerald-600" : "text-rose-600"}`}>
                      {g.self?.toFixed(1)} / {g.target.toFixed(1)}
                    </span>
                    {definitions[g.competencyId] ? (
                      <p className="mt-2 text-xs text-slate-500">{definitions[g.competencyId]}</p>
                    ) : null}
                    <p className="mt-1.5 text-xs text-[#121232]">{insights[g.competencyId] ?? competencyNarrative(g.self as number, g.target)}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
            {tx(
              "A self-report screening signal - corroborate with a Reflect 360, interview and evidence before any hiring decision.",
              "إشارة فرز قائمة على تقييم ذاتي - تحقّق منها بتقييم 360 ومقابلة وأدلة قبل أي قرار توظيف.",
            )}
          </p>
        </div>
      )}

      {/* DEVELOPMENT with a target role: a growth plan against the role +
          a VIFM Academy training plan. Same process as hiring, growth framing. */}
      {purpose === "development" && fit && role && (
        <div className="rounded-lg border border-slate-200 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-slate-500">{tx("Development plan", "خطة التطوير")} · {role.name}</p>
              <span className="mt-1 inline-block rounded-lg bg-[#5391D5]/10 px-4 py-2 text-2xl font-bold text-[#010131]">
                {fit.fitPct}% <span className="text-sm font-medium text-slate-500">{tx("aligned to the role target", "متوافق مع مستهدف الدور")}</span>
              </span>
            </div>
          </div>

          {/* Strengths to leverage + development priorities */}
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-emerald-700">{tx("Strengths to leverage", "نقاط القوة للاستثمار فيها")}</p>
              <div className="mt-1 space-y-1">
                {fit.gaps.filter((g) => g.self != null && (g.self as number) >= g.target)
                  .sort((a, b) => ((b.self as number) - b.target) - ((a.self as number) - a.target))
                  .slice(0, 5).map((g) => (
                  <div key={g.competencyId} className="flex items-center justify-between text-sm">
                    <span className="text-[#010131]">{nameById.get(g.competencyId) ?? g.name}</span>
                    <span className="tabular-nums font-semibold text-emerald-600">{g.self?.toFixed(1)} / {g.target.toFixed(1)}</span>
                  </div>
                ))}
                {fit.gaps.filter((g) => g.self != null && (g.self as number) >= g.target).length === 0 && (
                  <p className="text-sm text-slate-400">{tx("None at or above target yet.", "لا شيء عند المستهدف أو أعلى بعد.")}</p>
                )}
              </div>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wider text-amber-700">{tx("Development priorities", "أولويات التطوير")}</p>
              <div className="mt-1 space-y-1">
                {fit.gaps.filter((g) => g.self != null && g.gap > 0).slice(0, 5).map((g) => (
                  <div key={g.competencyId} className="flex items-center justify-between text-sm">
                    <span className="text-[#010131]">{nameById.get(g.competencyId) ?? g.name}</span>
                    <span className="tabular-nums font-semibold text-amber-600">{g.self?.toFixed(1)} / {g.target.toFixed(1)}</span>
                  </div>
                ))}
                {fit.gaps.filter((g) => g.self != null && g.gap > 0).length === 0 && (
                  <p className="text-sm text-emerald-700">{tx("Meets or exceeds every target.", "يحقّق أو يتجاوز كل المستهدفات.")}</p>
                )}
              </div>
            </div>
          </div>

          {/* Per-competency growth narrative: definition + a note read from the
              person's own answers, with a target-coloured score. */}
          <div className="mt-4">
            <p className="text-[11px] uppercase tracking-wider text-slate-500">{tx("Per-competency development notes", "ملاحظات التطوير لكل جدارة")}</p>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              {fit.gaps.filter((g) => g.self != null).map((g) => {
                const meets = (g.self as number) >= g.target;
                return (
                  <div key={g.competencyId} className="flex flex-col rounded-lg border border-slate-200 p-3">
                    <span className="text-center text-sm font-semibold text-[#010131]">{nameById.get(g.competencyId) ?? g.name}</span>
                    <span className={`mt-1 text-center text-2xl font-bold tabular-nums ${meets ? "text-emerald-600" : "text-amber-600"}`}>
                      {g.self?.toFixed(1)} / {g.target.toFixed(1)}
                    </span>
                    {definitions[g.competencyId] ? (
                      <p className="mt-2 text-xs text-slate-500">{definitions[g.competencyId]}</p>
                    ) : null}
                    <p className="mt-1.5 text-xs text-[#121232]">{insights[g.competencyId] ?? developmentNarrative(g.self as number, g.target)}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* VIFM Academy connection */}
          <AcademyCourses courses={courses} ar={ar} tx={tx} />

          <p className="mt-3 rounded-md bg-[#5391D5]/10 px-3 py-2 text-[11px] text-[#010131]">
            {tx(
              "A self-report development plan - pair it with a Reflect 360 (others' view) and the recommended VIFM programmes to turn priorities into progress.",
              "خطة تطوير قائمة على تقييم ذاتي - اقرنها بتقييم ريفلكت 360 (رأي الآخرين) وببرامج VIFM الموصى بها لتحويل الأولويات إلى تقدّم.",
            )}
          </p>
        </div>
      )}

      <div>
        <p className="text-[11px] uppercase tracking-wider text-slate-500">{tx("Overall self-rating", "متوسط التقييم الذاتي")}</p>
        <span className={`mt-1 inline-block rounded-lg px-4 py-2 text-2xl font-bold ${PERSONA_BAND_TW[personaBand(overall).key]}`}>{overall.toFixed(2)} / 5 · {personaBandLabel(overall, ar)}</span>
      </div>

      {/* DEVELOPMENT without a target role: a generic focus list (the role-based
          development plan above replaces this when a role is selected). */}
      {purpose === "development" && !role && focus.length > 0 && (
        <div className="rounded-lg border border-slate-200 p-4">
          <p className="text-sm font-semibold text-[#010131]">{tx("Development focus", "أولويات التطوير")}</p>
          <div className="mt-2 space-y-2.5">
            {focus.map((f) => {
              const b = personaBand(f.score);
              return (
                <div key={f.name}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[#010131]">{f.name}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${PERSONA_BAND_TW[b.key]}`}>{f.score.toFixed(1)} · {ar ? b.labelAr : b.label}</span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{b.action}</p>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-[11px] text-slate-500">
            {tx("Full per-competency suggestions are in the downloadable report.", "تتوفّر الاقتراحات الكاملة لكل جدارة في التقرير القابل للتنزيل.")}
          </p>
        </div>
      )}

      <div className="space-y-5">
        {clusters.map((cl) => {
          const clAvg = cl.rows.reduce((a, b) => a + b.score, 0) / cl.rows.length;
          return (
            <div key={cl.order}>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-semibold text-[#010131]">{ar ? cl.nameAr : cl.nameEn}</p>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${PERSONA_BAND_TW[personaBand(clAvg).key]}`}>{clAvg.toFixed(1)} · {personaBandLabel(clAvg, ar)}</span>
              </div>
              <div className="space-y-2">
                {cl.rows.map((r) => (
                  <div key={r.id}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-[#010131]">{r.name}</span>
                      <span className="tabular-nums text-muted-foreground">{r.score.toFixed(1)}</span>
                    </div>
                    <div className="mt-1 h-2 w-full rounded-full bg-slate-100">
                      <div className="h-2 rounded-full bg-[#5391D5]" style={{ width: `${(r.score / 5) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
        {tx(
          "This is an indicative self-report - how you see yourself across the competencies. To turn it into a readiness verdict, run Persona for a named candidate and pair it with a Reflect 360 (others) against a target role.",
          "هذا تقرير ذاتي استرشادي - كيف ترى نفسك عبر الجدارات. لتحويله إلى حكم على الجاهزية، أجرِ بيرسونا لمرشّح محدّد واقرنه بتقييم ريفلكت 360 (الآخرون) مقابل دور مستهدف.",
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {sessionId && (
          <a
            href={`/api/ac/persona/${sessionId}/report`}
            className="inline-flex items-center gap-2 rounded-md bg-[#010131] px-4 py-2 text-sm font-medium text-white hover:bg-[#121140]"
          >
            <Download className="h-4 w-4" /> {tx("Download PDF", "تنزيل التقرير (PDF)")}
          </a>
        )}
        <button onClick={onReset} className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
          <RotateCcw className="h-4 w-4" /> {tx("Start over", "البدء من جديد")}
        </button>
      </div>
    </div>
  );
}

/**
 * VIFM Academy connection for the development result - the ranked training plan
 * from the recommender (gap × course relevance). No admin link (a voucher
 * delegate may be viewing); the same data renders read-only in the PDF.
 */
function AcademyCourses({
  courses, ar, tx,
}: {
  courses: RecommendedCourse[];
  ar: boolean;
  tx: (en: string, arabic: string) => string;
}) {
  if (courses.length === 0) return null;
  const top = Math.max(0, ...courses.map((c) => c.total_score));
  return (
    <div className="mt-4 rounded-lg border border-[#5391D5]/30 bg-[#5391D5]/5 p-3">
      <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#010131]">
        <GraduationCap className="h-4 w-4 text-[#5391D5]" /> {tx("Recommended VIFM Academy programmes", "برامج أكاديمية VIFM الموصى بها")}
      </p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">
        {tx(
          "Mapped to your development priorities - ranked by gap size and how strongly each programme targets it.",
          "مرتبطة بأولويات تطويرك - مرتّبة حسب حجم الفجوة ومدى استهداف كل برنامج لها.",
        )}
      </p>
      <div className="mt-2 space-y-2">
        {courses.map((c) => {
          const highFit = c.total_score >= HIGH_FIT_THRESHOLD;
          return (
            <div key={c.course_id} className="rounded-md border border-slate-200 bg-white p-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#010131]">
                    {ar && c.title_ar ? c.title_ar : c.title_en}
                    {highFit && (
                      <span className="ms-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-900">
                        ★ {tx("High fit", "ملاءمة عالية")}
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {VIFM_VERTICAL_LABELS[c.vertical] ?? c.vertical} · <span className="capitalize">{c.level}</span> ·{" "}
                    {c.min_duration_days === c.max_duration_days
                      ? `${c.default_duration_days}d`
                      : `${c.min_duration_days}-${c.max_duration_days}d`}
                  </p>
                </div>
                {top > 0 && (
                  <span className="shrink-0 rounded-md bg-slate-100 px-2 py-1 text-xs font-bold tabular-nums text-[#010131]">
                    {Math.max(1, Math.round((c.total_score / top) * 10))}/10
                  </span>
                )}
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {c.drivers.slice(0, 4).map((d, i) => (
                  <span
                    key={`${c.course_id}-d-${i}`}
                    title={d.rationale ?? undefined}
                    className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] text-blue-900"
                  >
                    <span className="font-medium">{ar && d.label_ar ? d.label_ar : d.label}</span>
                    <span className="tabular-nums opacity-70">{tx("gap", "فجوة")} {d.gap.toFixed(1)} · ×{d.relevance}</span>
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
