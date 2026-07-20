import { notFound } from "next/navigation";
import { BadgeCheck, Bot, FileText, ShieldAlert } from "lucide-react";
import { requireRole, isAuthorizationError } from "@/lib/ara/auth-guards";
import { createServiceClient } from "@/lib/supabase/server";
import { getPrehireCertification } from "@/lib/prehire/certification";
import { computeIntegritySignal, type IntegrityFlags } from "@/lib/scoring/integrity";
import { BackLink } from "@/components/shared/back-link";
import { CertifyForm } from "./_components/certify-form";

// UA-2 / UA-3 / D-4: an unmissable marker that the per-stage scores and the CBI
// rating are AI-generated drafts. They feed an advisory screening signal, never a
// hiring decision - a human SME certifies the result below and the client decides.
function AiDraftBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
      <Bot className="h-3 w-3" /> AI draft
    </span>
  );
}

export const dynamic = "force-dynamic";

type StageRow = {
  kind: string;
  normalized_score: number | null;
  raw_score: number | null;
  detail: Record<string, unknown> | null;
  flags: (IntegrityFlags & { turnSeconds?: number[]; speakingTyped?: boolean }) | null;
};

const STAGE_LABEL: Record<string, string> = {
  quiz: "Competency Quiz",
  fluent: "English (Fluent®)",
  cbi: "Behavioural Interview (AI)",
  assessment_center: "Assessment Center",
};

export default async function PrehireReviewPage({
  params,
}: {
  params: { id: string; candidateId: string };
}) {
  try {
    await requireRole(["admin"]);
  } catch (e) {
    if (isAuthorizationError(e)) return notFound();
    throw e;
  }

  const sb = createServiceClient();
  const { data: cand } = await sb
    .from("prehire_candidates")
    .select(
      "id, full_name, email, requisition_id, prehire_stage_results(kind, normalized_score, raw_score, detail, flags), prehire_requisitions(title)"
    )
    .eq("id", params.candidateId)
    .eq("requisition_id", params.id)
    .maybeSingle();
  if (!cand) return notFound();

  const cert = await getPrehireCertification(params.candidateId);
  const stages = (cand.prehire_stage_results ?? []) as StageRow[];
  const reqTitle = (cand.prehire_requisitions as unknown as { title: string } | null)?.title ?? "Role";

  // CBI (AI interview) transcript + AI assessment.
  const cbiDetail = stages.find((s) => s.kind === "cbi")?.detail as
    | {
        history?: { role?: string; text?: string }[];
        score?: {
          bars_rating?: number;
          rating_label?: string;
          rationale?: string;
          strengths?: string[];
          development_areas?: string[];
          ai_likelihood?: number;
          ai_markers?: string[];
        };
      }
    | null
    | undefined;
  const cbiHistory = Array.isArray(cbiDetail?.history) ? cbiDetail!.history! : [];
  const cbiScore = cbiDetail?.score ?? null;

  // Advisory integrity signals per stage (tab-away, paste, thinking time,
  // typed-speaking fallback). Prompts for a human glance - never auto-fail.
  const TIER_TONE: Record<string, string> = {
    clean: "border-emerald-200 bg-emerald-50 text-emerald-800",
    minor: "border-amber-200 bg-amber-50 text-amber-800",
    elevated: "border-rose-200 bg-rose-50 text-rose-800",
  };
  const fmtAway = (ms: number) => (ms >= 60_000 ? `${Math.round(ms / 60_000)}m` : `${Math.round(ms / 1000)}s`);
  const median = (xs: number[]) => {
    const s = [...xs].sort((a, b) => a - b);
    return s.length ? s[Math.floor(s.length / 2)] : 0;
  };
  const integrityRows = stages
    .filter((s) => s.flags && Object.keys(s.flags).length > 0)
    .map((s) => {
      const f = s.flags!;
      const sig = computeIntegritySignal(f);
      const facts: string[] = [];
      const blur = f.blurCount ?? 0;
      if (blur > 0) facts.push(`left the page ${blur}x${f.awayMs ? ` (${fmtAway(f.awayMs)} away)` : ""}`);
      const pastes = f.pasteCount ?? 0;
      if (pastes > 0) facts.push(`pasted ${pastes}x${f.pasteChars ? ` (~${f.pasteChars} chars)` : ""}`);
      if (Array.isArray(f.turnSeconds) && f.turnSeconds.length > 0) {
        const med = median(f.turnSeconds);
        facts.push(`answer time ${f.turnSeconds.join("s / ")}s (median ${med}s)`);
        if (med < 20) facts.push("unusually fast for composed interview answers - worth a read");
      }
      if (f.speakingTyped) facts.push("speaking answer was typed (no-mic fallback; no pronunciation score)");
      if (typeof f.aiLikelihood === "number") facts.push(`AI-likeness estimate ${f.aiLikelihood}/100 (stylometric, advisory)`);
      if (facts.length === 0) facts.push("nothing notable captured");
      return { kind: s.kind, sig, facts };
    });

  // Fluent productive responses (tolerant - shape varies; show what's present).
  const fluentDetail = stages.find((s) => s.kind === "fluent")?.detail as
    | {
        result?: {
          writing?: { feedback_en?: string };
          speaking?: { transcript?: string; feedback_en?: string };
        };
      }
    | null
    | undefined;
  const fw = fluentDetail?.result?.writing?.feedback_en ?? null;
  const sp = fluentDetail?.result?.speaking ?? null;

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <div className="mb-4">
        <BackLink href={`/admin/prehire/${params.id}`} label="Back to requisition" />
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#010131]">SME review &amp; certify</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {cand.full_name} {cand.email ? `· ${cand.email}` : ""} · {reqTitle}
          </p>
        </div>
        {cert && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
            <BadgeCheck className="h-3.5 w-3.5" /> Certified
          </span>
        )}
      </div>

      {cert && (
        <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          Certified by <strong>{cert.certifiedBy ?? "-"}</strong> on{" "}
          {new Date(cert.certifiedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}.
          {cert.notes ? <span> Notes: {cert.notes}</span> : null}
        </div>
      )}

      {/* Per-stage scores */}
      <div className="mt-7 flex items-center gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Stage scores</h2>
        <AiDraftBadge />
      </div>
      <p className="mt-1 text-xs text-amber-700">
        AI-generated screening signals, not a hiring decision. Review the evidence below, then certify.
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {stages.length === 0 && <span className="text-sm text-muted-foreground">No stages completed yet.</span>}
        {stages.map((s) => (
          <span key={s.kind} className="inline-flex items-center gap-2 rounded-md border bg-card px-3 py-1.5 text-sm">
            <span className="font-medium text-[#010131]">{STAGE_LABEL[s.kind] ?? s.kind}</span>
            <span className="tabular-nums text-muted-foreground">
              {s.normalized_score == null ? "-" : `${Math.round(s.normalized_score)}/100`}
            </span>
          </span>
        ))}
      </div>

      {/* Integrity signals (advisory) */}
      {integrityRows.length > 0 && (
        <section className="mt-7">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            <ShieldAlert className="h-4 w-4" /> Integrity signals (advisory)
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Prompts for a human glance - never an automatic action. Legitimate behaviour (a phone
            call, a slow connection, no microphone) produces the same traces.
          </p>
          <div className="mt-2 space-y-2">
            {integrityRows.map((r) => (
              <div key={r.kind} className="flex flex-wrap items-start gap-2 rounded-lg border bg-card p-3 text-sm">
                <span className="w-44 shrink-0 font-medium text-[#010131]">{STAGE_LABEL[r.kind] ?? r.kind}</span>
                <span
                  className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${TIER_TONE[r.sig.tier] ?? TIER_TONE.clean}`}
                >
                  {r.sig.tier} · {r.sig.score}/100
                </span>
                <span className="min-w-0 flex-1 text-xs text-muted-foreground">{r.facts.join(" · ")}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* CBI transcript + AI assessment */}
      {cbiHistory.length > 0 && (
        <section className="mt-7">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              AI interview - transcript &amp; assessment
            </h2>
            <AiDraftBadge />
          </div>
          {cbiScore && (
            <div className="mt-2 rounded-lg border bg-muted/30 p-3 text-sm">
              {cbiScore.rating_label && (
                <div>
                  <span className="font-semibold text-accent">AI rating:</span> {cbiScore.rating_label}
                  {typeof cbiScore.bars_rating === "number" ? ` (${cbiScore.bars_rating}/5)` : ""}
                </div>
              )}
              {cbiScore.rationale && (
                <div className="mt-1">
                  <span className="font-semibold text-accent">Rationale:</span> {cbiScore.rationale}
                </div>
              )}
              {typeof cbiScore.ai_likelihood === "number" && cbiScore.ai_likelihood >= 30 && (
                <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
                  <span className="font-semibold">AI-likeness (advisory):</span> the answers&apos;
                  style reads as possibly AI-assisted, estimate {cbiScore.ai_likelihood}/100.
                  Stylometric only - not proof; weigh it alongside the transcript, and verify at
                  the human interview stage.
                  {(cbiScore.ai_markers?.length ?? 0) > 0 && (
                    <span> Markers: {cbiScore.ai_markers!.join("; ")}.</span>
                  )}
                </div>
              )}
            </div>
          )}
          <div className="mt-3 overflow-hidden rounded-lg border">
            {cbiHistory.map((m, i) => (
              <div
                key={i}
                className={`border-b p-3 last:border-b-0 ${m.role === "candidate" ? "bg-card" : "bg-muted/40"}`}
              >
                <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                  {m.role === "candidate" ? "Candidate" : "Interviewer (AI)"}
                </div>
                <div className="mt-1 whitespace-pre-wrap text-sm">{m.text}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Fluent productive responses (if present) */}
      {(fw || sp?.transcript || sp?.feedback_en) && (
        <section className="mt-7">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            English (Fluent) - writing &amp; speaking
          </h2>
          <div className="mt-2 space-y-2 rounded-lg border bg-muted/30 p-3 text-sm">
            {fw && (
              <div>
                <span className="font-semibold text-accent">Writing feedback:</span> {fw}
              </div>
            )}
            {sp?.transcript && (
              <div>
                <span className="font-semibold text-accent">Speaking transcript:</span> {sp.transcript}
              </div>
            )}
            {sp?.feedback_en && (
              <div>
                <span className="font-semibold text-accent">Speaking feedback:</span> {sp.feedback_en}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Certify */}
      <section className="mt-8 rounded-xl border bg-card p-5">
        <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-[#010131]">
          <BadgeCheck className="h-5 w-5 text-accent" /> Certify this result
        </h2>
        <CertifyForm requisitionId={params.id} candidateId={params.candidateId} alreadyCertified={!!cert} />
      </section>

      <div className="mt-5">
        <a
          href={`/api/admin/prehire/${params.id}/candidate/${params.candidateId}/report?lang=en`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm text-accent hover:underline"
        >
          <FileText className="h-4 w-4" /> Open the full report (carries the certified stamp once certified)
        </a>
      </div>
    </div>
  );
}
