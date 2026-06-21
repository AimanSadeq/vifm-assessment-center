import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, BadgeCheck, FileText } from "lucide-react";
import { requireRole, isAuthorizationError } from "@/lib/ara/auth-guards";
import { createServiceClient } from "@/lib/supabase/server";
import { getPrehireCertification } from "@/lib/prehire/certification";
import { CertifyForm } from "./_components/certify-form";

export const dynamic = "force-dynamic";

type StageRow = {
  kind: string;
  normalized_score: number | null;
  raw_score: number | null;
  detail: Record<string, unknown> | null;
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
      "id, full_name, email, requisition_id, prehire_stage_results(kind, normalized_score, raw_score, detail), prehire_requisitions(title)"
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
        };
      }
    | null
    | undefined;
  const cbiHistory = Array.isArray(cbiDetail?.history) ? cbiDetail!.history! : [];
  const cbiScore = cbiDetail?.score ?? null;

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
      <Link
        href={`/admin/prehire/${params.id}`}
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to requisition
      </Link>

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
      <h2 className="mt-7 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Stage scores (AI)</h2>
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

      {/* CBI transcript + AI assessment */}
      {cbiHistory.length > 0 && (
        <section className="mt-7">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            AI interview - transcript &amp; assessment
          </h2>
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
