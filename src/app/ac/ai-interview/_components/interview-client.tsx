"use client";

import { useRef, useState } from "react";
import {
  Bot, User, Send, Loader2, RotateCcw, ClipboardCheck, Sparkles,
  ShieldCheck, CheckCircle2, X,
} from "lucide-react";
import {
  persistCbiDraftAction,
  approveCbiToPipelineAction,
} from "../actions";

export type CompetencyOption = { id: string; name: string; cluster_id: string };
export type CbiAssignmentContext = {
  id: string;
  engagementId: string;
  candidateId: string;
  candidateName: string;
  exerciseName: string;
  engagementName: string;
  competencies: { id: string; name: string }[];
};

type Language = "en" | "ar";
type Message = { role: "interviewer" | "candidate"; text: string };
type Polarity = "positive" | "negative" | "neutral";

type Evidence = { behavior: string; indicator_type: Polarity; confidence: number };
type ScoreResult = {
  competency_name: string;
  bars_rating: number;
  rating_label: string;
  rationale: string;
  evidence: Evidence[];
  strengths: string[];
  development_areas: string[];
  language: Language;
  ai_generated: boolean;
};

// Editable review-gate row
type ReviewItem = { behavior: string; polarity: Polarity; keep: boolean };

const RATING_TONE: Record<number, string> = {
  1: "bg-rose-100 text-rose-800 border-rose-300",
  2: "bg-amber-100 text-amber-800 border-amber-300",
  3: "bg-sky-100 text-sky-800 border-sky-300",
  4: "bg-emerald-100 text-emerald-800 border-emerald-300",
  5: "bg-emerald-200 text-emerald-900 border-emerald-400",
};
const POLARITY_TONE: Record<Polarity, string> = {
  positive: "bg-emerald-100 text-emerald-800 border-emerald-300",
  negative: "bg-rose-100 text-rose-800 border-rose-300",
  neutral: "bg-slate-100 text-slate-600 border-slate-300",
};
const NEXT_POLARITY: Record<Polarity, Polarity> = {
  positive: "negative", negative: "neutral", neutral: "positive",
};

export function CbiInterviewClient({
  competencies,
  assignments,
}: {
  competencies: CompetencyOption[];
  assignments: CbiAssignmentContext[];
}) {
  const [assignmentId, setAssignmentId] = useState<string>(""); // "" = demo
  const activeAssignment = assignments.find((a) => a.id === assignmentId) ?? null;
  const compOptions: { id: string; name: string }[] = activeAssignment
    ? activeAssignment.competencies
    : competencies;

  const [competencyId, setCompetencyId] = useState<string>(compOptions[0]?.id ?? "");
  const [language, setLanguage] = useState<Language>("en");
  const [started, setStarted] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [concluded, setConcluded] = useState(false);
  const [score, setScore] = useState<ScoreResult | null>(null);
  const [scoring, setScoring] = useState(false);

  // Production review-gate state
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [reviewRating, setReviewRating] = useState<number>(3);
  const [reviewNotes, setReviewNotes] = useState<string>("");
  const [reviewItems, setReviewItems] = useState<ReviewItem[]>([]);
  const [approving, setApproving] = useState(false);
  const [approved, setApproved] = useState<{ observationsWritten: number; rating: number } | null>(null);
  const [error, setError] = useState<string>("");

  const scrollRef = useRef<HTMLDivElement>(null);
  const rtl = language === "ar";
  const productionMode = activeAssignment !== null;

  function scrollToEnd() {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    });
  }

  function onAssignmentChange(id: string) {
    setAssignmentId(id);
    const next = assignments.find((a) => a.id === id) ?? null;
    const list = next ? next.competencies : competencies;
    setCompetencyId(list[0]?.id ?? "");
    reset();
  }

  async function callApi(action: "turn" | "score", history: Message[]) {
    const res = await fetch("/api/ac/cbi", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, competencyId, language, history }),
    });
    if (!res.ok) throw new Error(`API ${res.status}`);
    return res.json();
  }

  async function start() {
    if (!competencyId) return;
    setBusy(true); setStarted(true); setMessages([]); setConcluded(false);
    setScore(null); setSessionId(null); setApproved(null); setError("");
    try {
      const turn = (await callApi("turn", [])) as { message: string; shouldConclude: boolean };
      setMessages([{ role: "interviewer", text: turn.message }]);
    } catch {
      setMessages([{ role: "interviewer", text: "Could not start the interview. Please try again." }]);
    } finally {
      setBusy(false); scrollToEnd();
    }
  }

  async function send() {
    const text = draft.trim();
    if (!text || busy || concluded) return;
    const next: Message[] = [...messages, { role: "candidate", text }];
    setMessages(next); setDraft(""); setBusy(true); scrollToEnd();
    try {
      const turn = (await callApi("turn", next)) as { message: string; shouldConclude: boolean };
      setMessages([...next, { role: "interviewer", text: turn.message }]);
      if (turn.shouldConclude) setConcluded(true);
    } catch {
      setMessages([...next, { role: "interviewer", text: "Connection hiccup — please resend." }]);
    } finally {
      setBusy(false); scrollToEnd();
    }
  }

  async function runScore() {
    setScoring(true); setError("");
    try {
      const result = (await callApi("score", messages)) as ScoreResult;
      setScore(result);
      // Seed the review gate from the AI draft
      setReviewRating(result.bars_rating);
      setReviewNotes(result.rationale);
      setReviewItems(result.evidence.map((e) => ({ behavior: e.behavior, polarity: e.indicator_type, keep: true })));

      // In production mode, persist the draft as an audit record.
      if (productionMode && activeAssignment) {
        const res = await persistCbiDraftAction({
          assessorAssignmentId: activeAssignment.id,
          engagementId: activeAssignment.engagementId,
          candidateId: activeAssignment.candidateId,
          competencyId,
          language,
          transcript: messages,
          aiRating: result.bars_rating,
          aiRationale: result.rationale,
          aiEvidence: result.evidence,
        });
        if ("id" in res) setSessionId(res.id);
      }
    } catch {
      setError("Scoring failed. Please try again.");
    } finally {
      setScoring(false);
    }
  }

  async function approve() {
    if (!activeAssignment || !sessionId) return;
    setApproving(true); setError("");
    try {
      const res = await approveCbiToPipelineAction({
        sessionId,
        assessorAssignmentId: activeAssignment.id,
        competencyId,
        reviewedRating: reviewRating,
        reviewerNotes: reviewNotes,
        engagementId: activeAssignment.engagementId,
        evidence: reviewItems
          .filter((r) => r.keep)
          .map((r) => ({
            behavior: r.behavior,
            is_positive: r.polarity === "positive" ? true : r.polarity === "negative" ? false : null,
          })),
      });
      if ("error" in res) setError(res.error);
      else setApproved(res);
    } catch {
      setError("Could not write to the pipeline.");
    } finally {
      setApproving(false);
    }
  }

  function reset() {
    setStarted(false); setMessages([]); setDraft(""); setConcluded(false);
    setScore(null); setSessionId(null); setApproved(null); setError("");
  }

  const answersGiven = messages.filter((m) => m.role === "candidate").length;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      {/* ── Interview column ── */}
      <div className="rounded-xl border bg-white shadow-sm">
        {/* Context bar */}
        <div className="space-y-3 border-b p-4">
          <div>
            <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-slate-500">
              Context
            </label>
            <select
              value={assignmentId}
              onChange={(e) => onAssignmentChange(e.target.value)}
              disabled={started}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-[#111232] disabled:opacity-60"
            >
              <option value="">Demo — no candidate (scoring only, no pipeline write)</option>
              {assignments.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.candidateName} — {a.exerciseName}{a.engagementName ? ` (${a.engagementName})` : ""}
                </option>
              ))}
            </select>
            {productionMode && (
              <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-emerald-700">
                <ShieldCheck className="h-3 w-3" /> Production: approved results write to{" "}
                {activeAssignment?.candidateName}&apos;s observation record.
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={competencyId}
              onChange={(e) => setCompetencyId(e.target.value)}
              disabled={started}
              className="min-w-[220px] flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-[#111232] disabled:opacity-60"
            >
              {compOptions.length === 0 && <option value="">No competencies mapped</option>}
              {compOptions.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <div className="inline-flex overflow-hidden rounded-md border border-slate-300">
              {(["en", "ar"] as const).map((lng) => (
                <button
                  key={lng}
                  onClick={() => !started && setLanguage(lng)}
                  disabled={started}
                  className={`px-3 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed ${
                    language === lng ? "bg-[#5391D5] text-white" : "bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {lng === "en" ? "EN" : "ع"}
                </button>
              ))}
            </div>
            {!started ? (
              <button
                onClick={start}
                disabled={busy || !competencyId}
                className="inline-flex items-center gap-2 rounded-md bg-[#010131] px-4 py-2 text-sm font-medium text-white hover:bg-[#121140] disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Start interview
              </button>
            ) : (
              <button
                onClick={reset}
                className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                <RotateCcw className="h-4 w-4" /> Start over
              </button>
            )}
          </div>
        </div>

        {/* Transcript */}
        <div ref={scrollRef} dir={rtl ? "rtl" : "ltr"} className="h-[400px] space-y-4 overflow-y-auto p-4">
          {!started && (
            <div className="flex h-full flex-col items-center justify-center text-center text-sm text-slate-400">
              <Bot className="mb-2 h-8 w-8 text-slate-300" />
              Choose a context + competency, then Start interview.
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`flex gap-2 ${m.role === "candidate" ? "flex-row-reverse" : "flex-row"}`}>
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                m.role === "interviewer" ? "bg-[#5391D5]/15 text-[#5391D5]" : "bg-[#010131]/10 text-[#010131]"
              }`}>
                {m.role === "interviewer" ? <Bot className="h-4 w-4" /> : <User className="h-4 w-4" />}
              </div>
              <div className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                m.role === "interviewer" ? "bg-slate-100 text-[#111232]" : "bg-[#010131] text-white"
              }`}>
                {m.text}
              </div>
            </div>
          ))}
          {busy && started && (
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Interviewer is thinking…
            </div>
          )}
        </div>

        {/* Composer */}
        {started && (
          <div className="border-t p-3">
            {concluded ? (
              <div className="flex items-center justify-between gap-3 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                <span className="inline-flex items-center gap-2">
                  <ClipboardCheck className="h-4 w-4" /> Interview complete — ready to score.
                </span>
                <button
                  onClick={runScore}
                  disabled={scoring}
                  className="inline-flex items-center gap-2 rounded-md bg-[#047857] px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
                >
                  {scoring ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ClipboardCheck className="h-3.5 w-3.5" />}
                  {scoring ? "Scoring…" : "Score this interview"}
                </button>
              </div>
            ) : (
              <div dir={rtl ? "rtl" : "ltr"} className="flex items-end gap-2">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); }
                  }}
                  rows={2}
                  placeholder="Type your answer…"
                  disabled={busy}
                  className="flex-1 resize-none rounded-md border border-slate-300 px-3 py-2 text-sm text-[#111232] focus:border-[#5391D5] focus:outline-none"
                />
                <button
                  onClick={send}
                  disabled={busy || !draft.trim()}
                  className="inline-flex h-10 items-center gap-2 rounded-md bg-[#5391D5] px-4 text-sm font-medium text-white hover:bg-[#5391D5]/90 disabled:opacity-50"
                >
                  <Send className="h-4 w-4" /> Send
                </button>
              </div>
            )}
            {!concluded && answersGiven > 0 && (
              <button onClick={runScore} disabled={scoring} className="mt-2 text-xs text-slate-400 underline hover:text-slate-600">
                {scoring ? "Scoring…" : "Score now →"}
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Score / Review column ── */}
      <div className="rounded-xl border bg-white p-5 shadow-sm">
        <h2 className="mb-3 inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-[#5391D5]">
          {productionMode ? <ShieldCheck className="h-4 w-4" /> : null}
          {productionMode ? "Review & approve" : "Scored evidence"}
        </h2>

        {error && <div className="mb-3 rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</div>}

        {!score ? (
          <p className="text-sm text-slate-400">
            {started
              ? "Finish the interview (or score early) to see Claude extract behavioural evidence and assign a BARS rating."
              : "Scored evidence will appear here after an interview."}
          </p>
        ) : approved ? (
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">
              <CheckCircle2 className="h-5 w-5" /> Written to the pipeline
            </div>
            <p className="text-sm text-[#111232]">
              {approved.observationsWritten} observation{approved.observationsWritten === 1 ? "" : "s"} and a
              rating of <strong>{approved.rating}/5</strong> saved to{" "}
              <strong>{activeAssignment?.candidateName}</strong>&apos;s record for{" "}
              <strong>{score.competency_name}</strong>.
            </p>
            <a
              href={`/assessor/observation/${activeAssignment?.id}`}
              className="inline-block text-xs text-[#5391D5] underline hover:text-[#5391D5]/80"
            >
              Open the assessor observation page →
            </a>
          </div>
        ) : (
          <div dir={score.language === "ar" ? "rtl" : "ltr"} className="space-y-4">
            <div>
              <div className="text-xs text-slate-500">{score.competency_name}</div>
              {!score.ai_generated && (
                <div className="mt-1 text-[10px] text-amber-600">AI draft is a fallback (no AI key)</div>
              )}
            </div>

            {/* Rating — read-only in demo, editable in production */}
            {productionMode ? (
              <div>
                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">BARS rating (editable)</div>
                <div className="flex gap-1.5">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      onClick={() => setReviewRating(n)}
                      className={`h-9 w-9 rounded-md border text-sm font-semibold transition ${
                        reviewRating === n ? RATING_TONE[n] : "border-slate-200 bg-white text-slate-400 hover:bg-slate-50"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <div className="mt-1 text-[11px] text-slate-500">
                  AI suggested {score.bars_rating}/5 · {score.rating_label}
                </div>
              </div>
            ) : (
              <div className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-semibold ${RATING_TONE[score.bars_rating]}`}>
                <span className="text-lg">{score.bars_rating}</span>
                <span>/ 5 · {score.rating_label}</span>
              </div>
            )}

            {/* Rationale / reviewer notes */}
            <div>
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                {productionMode ? "Justification (editable)" : "Rationale"}
              </div>
              {productionMode ? (
                <textarea
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  rows={3}
                  className="w-full resize-none rounded-md border border-slate-300 px-3 py-2 text-sm text-[#111232] focus:border-[#5391D5] focus:outline-none"
                />
              ) : (
                <p className="text-sm leading-relaxed text-[#111232]">{score.rationale}</p>
              )}
            </div>

            {/* Evidence */}
            {productionMode ? (
              <div>
                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Evidence — keep, drop, or re-polarise
                </div>
                <div className="space-y-2">
                  {reviewItems.map((r, i) => (
                    <div key={i} className={`rounded-md border px-3 py-2 text-xs ${r.keep ? "border-slate-200 bg-white" : "border-slate-200 bg-slate-50 opacity-50"}`}>
                      <div className="flex items-start justify-between gap-2">
                        <span className="leading-snug text-[#111232]">{r.behavior}</span>
                        <button
                          onClick={() => setReviewItems((items) => items.map((it, j) => j === i ? { ...it, keep: !it.keep } : it))}
                          className="shrink-0 text-slate-400 hover:text-rose-600"
                          title={r.keep ? "Drop" : "Restore"}
                        >
                          {r.keep ? <X className="h-3.5 w-3.5" /> : <RotateCcw className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                      <button
                        onClick={() => setReviewItems((items) => items.map((it, j) => j === i ? { ...it, polarity: NEXT_POLARITY[it.polarity] } : it))}
                        disabled={!r.keep}
                        className={`mt-1.5 rounded border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${POLARITY_TONE[r.polarity]} disabled:opacity-40`}
                        title="Click to change polarity"
                      >
                        {r.polarity}
                      </button>
                    </div>
                  ))}
                  {reviewItems.length === 0 && <p className="text-xs text-slate-400">No evidence extracted.</p>}
                </div>
                <button
                  onClick={approve}
                  disabled={approving || reviewItems.filter((r) => r.keep).length === 0}
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md bg-[#047857] px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
                >
                  {approving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                  {approving ? "Writing…" : "Approve & write to pipeline"}
                </button>
                <p className="mt-1 text-center text-[10px] text-slate-400">
                  Writes {reviewItems.filter((r) => r.keep).length} observation(s) + a {reviewRating}/5 rating.
                </p>
              </div>
            ) : (
              score.evidence.length > 0 && (
                <div className="space-y-2">
                  {score.evidence.map((e, i) => (
                    <div key={i} className={`rounded-md border px-3 py-2 text-xs ${POLARITY_TONE[e.indicator_type]}`}>
                      <div className="leading-snug">{e.behavior}</div>
                      <div className="mt-1 flex items-center justify-between text-[10px] opacity-70">
                        <span className="uppercase tracking-wide">{e.indicator_type}</span>
                        <span>{Math.round(e.confidence * 100)}% confidence</span>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}
