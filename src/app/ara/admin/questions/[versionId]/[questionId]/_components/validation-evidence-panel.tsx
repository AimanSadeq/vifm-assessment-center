"use client";

import { useState, useTransition } from "react";
import { Sparkles, CheckCircle2, X, Loader2, AlertTriangle, Trash2, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  suggestQuestionValidationEvidence, saveQuestionValidationEvidence,
} from "@/lib/ara/actions";
import type { AraQuestionValidationEvidence } from "@/types/ara";

/**
 * Per-item validation-evidence editor. Sits on the admin question
 * detail page below the lineage card. Three modes:
 *
 *   No evidence yet    → "Generate AI suggestion" button (calls Claude
 *                         via the suggester; saves with status='ai_proposed')
 *   ai_proposed        → Editable list with Accept / Edit & Save / Reject
 *                         actions. Banner reminds admin: not surfaced to
 *                         clients until verified.
 *   verified | edited  → Read-only display + "Re-generate" + "Reject"
 *   rejected           → Greyed out + "Re-generate" + "Restore"
 *
 * The hallucination-guard pattern: AI-proposed citations are saved to
 * the DB but the report-rendering code skips items with
 * review_status != 'verified' && != 'edited'. So admin click-throughs
 * are required before anything appears in a client deliverable.
 */

type Props = {
  questionId: string;
  reviewerEmail: string;
  initialEvidence: AraQuestionValidationEvidence | null;
};

const CONFIDENCE_TONE: Record<
  AraQuestionValidationEvidence["anchor_instruments"][number]["confidence"],
  string
> = {
  direct_adaptation: "bg-emerald-100 text-emerald-900 border-emerald-200",
  construct_aligned: "bg-sky-100 text-sky-900 border-sky-200",
  novel:             "bg-amber-100 text-amber-900 border-amber-200",
};

const STATUS_TONE: Record<AraQuestionValidationEvidence["review_status"], string> = {
  ai_proposed: "bg-amber-100 text-amber-900 border-amber-200",
  verified:    "bg-emerald-100 text-emerald-900 border-emerald-200",
  edited:      "bg-sky-100 text-sky-900 border-sky-200",
  rejected:    "bg-rose-100 text-rose-900 border-rose-200",
};

export function ValidationEvidencePanel({ questionId, reviewerEmail, initialEvidence }: Props) {
  const [evidence, setEvidence] = useState<AraQuestionValidationEvidence | null>(initialEvidence);
  const [draft, setDraft] = useState<AraQuestionValidationEvidence | null>(initialEvidence);
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function generate() {
    setError(null);
    startTransition(async () => {
      const r = await suggestQuestionValidationEvidence(questionId);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setEvidence(r.evidence);
      setDraft(r.evidence);
      setEditing(false);
    });
  }

  function persist(next: AraQuestionValidationEvidence) {
    setError(null);
    startTransition(async () => {
      const r = await saveQuestionValidationEvidence(questionId, next, reviewerEmail);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setEvidence(next);
      setDraft(next);
      setEditing(false);
    });
  }

  if (!evidence) {
    return (
      <PanelShell>
        <p className="text-sm text-muted-foreground">
          No validation evidence captured for this question yet. Click below
          to ask Claude for an AI-suggested anchor against the curated
          bibliography in the methodology brief. Suggestions are saved as{" "}
          <em>ai_proposed</em> and require admin review before they appear in
          any client report.
        </p>
        <div className="mt-4">
          <Button onClick={generate} disabled={pending}>
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin me-1.5" /> : <Sparkles className="h-3.5 w-3.5 me-1.5" />}
            Generate AI suggestion
          </Button>
        </div>
        {error && <ErrorMsg>{error}</ErrorMsg>}
      </PanelShell>
    );
  }

  const status = evidence.review_status;
  const showAiBanner = status === "ai_proposed";

  return (
    <PanelShell>
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full border ${STATUS_TONE[status]}`}>
          {status.replace("_", " ")}
        </span>
        {evidence.reviewed_by && (
          <span className="text-[11px] text-muted-foreground">
            reviewed by {evidence.reviewed_by} · {evidence.reviewed_at?.slice(0, 10)}
          </span>
        )}
        {evidence.ai_model && (
          <span className="text-[10px] text-muted-foreground ms-auto">
            AI-proposed via {evidence.ai_model}
          </span>
        )}
      </div>

      {showAiBanner && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 mb-4 text-xs text-amber-900 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">Not yet surfaced to clients</p>
            <p className="mt-0.5 leading-snug">
              This is an AI-suggested anchor. LLM citations can subtly
              hallucinate paper-level details. Verify the citations are
              accurate before clicking <em>Accept</em>; only then will they
              appear in the consultant report appendix.
            </p>
          </div>
        </div>
      )}

      <div className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-1">
        Construct summary
      </div>
      <p className="text-sm mb-4">{evidence.construct_summary}</p>

      <div className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-2">
        Anchor instruments ({evidence.anchor_instruments.length})
      </div>
      {evidence.anchor_instruments.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">
          No anchor instruments captured. The suggester returned a 'novel'
          confidence — this item may need a custom citation or item revision.
        </p>
      ) : (
        <ul className="space-y-3">
          {evidence.anchor_instruments.map((a, i) => (
            <li key={i} className="rounded-md border bg-card p-3">
              <div className="flex items-start gap-2">
                <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full border shrink-0 ${CONFIDENCE_TONE[a.confidence]}`}>
                  {a.confidence.replace("_", " ")}
                </span>
                <span className="text-sm font-semibold flex-1">{a.name}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-2 leading-snug">
                {a.citation}
              </p>
              {a.rationale && (
                <p className="text-[11px] text-foreground/80 mt-2 italic leading-snug">
                  Rationale: {a.rationale}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Action row */}
      <div className="flex flex-wrap gap-2 mt-5">
        {status === "ai_proposed" && (
          <>
            <Button
              size="sm"
              variant="default"
              disabled={pending}
              onClick={() => persist({ ...evidence, review_status: "verified" })}
            >
              <CheckCircle2 className="h-3.5 w-3.5 me-1.5" />
              Accept as verified
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => { setDraft(evidence); setEditing(true); }}
            >
              Edit
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => persist({ ...evidence, review_status: "rejected" })}
            >
              <X className="h-3.5 w-3.5 me-1.5" />
              Reject
            </Button>
          </>
        )}
        {(status === "verified" || status === "edited") && (
          <>
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => { setDraft(evidence); setEditing(true); }}
            >
              Edit
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => persist({ ...evidence, review_status: "rejected" })}
            >
              <X className="h-3.5 w-3.5 me-1.5" />
              Reject
            </Button>
            <Button size="sm" variant="ghost" disabled={pending} onClick={generate}>
              <Sparkles className="h-3.5 w-3.5 me-1.5" />
              Re-generate
            </Button>
          </>
        )}
        {status === "rejected" && (
          <>
            <Button
              size="sm"
              variant="default"
              disabled={pending}
              onClick={() => persist({ ...evidence, review_status: "verified" })}
            >
              Restore as verified
            </Button>
            <Button size="sm" variant="ghost" disabled={pending} onClick={generate}>
              <Sparkles className="h-3.5 w-3.5 me-1.5" />
              Re-generate
            </Button>
          </>
        )}
        {pending && <Loader2 className="h-3.5 w-3.5 animate-spin self-center text-muted-foreground" />}
      </div>

      {error && <ErrorMsg>{error}</ErrorMsg>}

      {/* Inline editor */}
      {editing && draft && (
        <EditorForm
          draft={draft}
          setDraft={setDraft}
          onCancel={() => { setEditing(false); setDraft(evidence); }}
          onSave={() => persist({ ...draft, review_status: "edited" })}
          pending={pending}
        />
      )}
    </PanelShell>
  );
}

function PanelShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-card mb-6 p-5">
      <div className="flex items-center gap-2 mb-3">
        <Badge variant="outline" className="text-[10px]">Validation evidence</Badge>
        <h2 className="text-base font-semibold">Per-item content-validity trail</h2>
      </div>
      {children}
    </div>
  );
}

function ErrorMsg({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-3 rounded-md border border-rose-300 bg-rose-50 p-2 text-xs text-rose-900">
      {children}
    </div>
  );
}

function EditorForm({
  draft, setDraft, onCancel, onSave, pending,
}: {
  draft: AraQuestionValidationEvidence;
  setDraft: (e: AraQuestionValidationEvidence) => void;
  onCancel: () => void;
  onSave: () => void;
  pending: boolean;
}) {
  return (
    <div className="mt-5 rounded-md border border-sky-300 bg-sky-50/60 p-4 space-y-3">
      <p className="text-xs font-semibold text-sky-900">Editing evidence</p>
      <div>
        <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
          Construct summary
        </label>
        <input
          type="text"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={draft.construct_summary}
          onChange={(e) => setDraft({ ...draft, construct_summary: e.target.value })}
        />
      </div>
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-[11px] font-semibold text-muted-foreground">
            Anchor instruments ({draft.anchor_instruments.length})
          </label>
          <button
            type="button"
            onClick={() =>
              setDraft({
                ...draft,
                anchor_instruments: [
                  ...draft.anchor_instruments,
                  { name: "", citation: "", confidence: "construct_aligned", rationale: "" },
                ],
              })
            }
            className="inline-flex items-center gap-1 text-[11px] font-medium text-accent hover:underline"
          >
            <Plus className="h-3 w-3" /> Add anchor
          </button>
        </div>
        <div className="space-y-2">
          {draft.anchor_instruments.map((a, idx) => (
            <div key={idx} className="rounded-md border bg-card p-3 space-y-2">
              <input
                type="text"
                placeholder="Name (e.g. Technology Acceptance Model)"
                className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs"
                value={a.name}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    anchor_instruments: draft.anchor_instruments.map((x, i) =>
                      i === idx ? { ...x, name: e.target.value } : x
                    ),
                  })
                }
              />
              <textarea
                rows={2}
                placeholder="Citation (full bibliographic, APA-style preferred)"
                className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs"
                value={a.citation}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    anchor_instruments: draft.anchor_instruments.map((x, i) =>
                      i === idx ? { ...x, citation: e.target.value } : x
                    ),
                  })
                }
              />
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <select
                  value={a.confidence}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      anchor_instruments: draft.anchor_instruments.map((x, i) =>
                        i === idx ? { ...x, confidence: e.target.value as typeof x.confidence } : x
                      ),
                    })
                  }
                  className="rounded-md border border-input bg-background px-2 py-1.5 text-xs"
                >
                  <option value="direct_adaptation">direct_adaptation</option>
                  <option value="construct_aligned">construct_aligned</option>
                  <option value="novel">novel</option>
                </select>
                <button
                  type="button"
                  onClick={() =>
                    setDraft({
                      ...draft,
                      anchor_instruments: draft.anchor_instruments.filter((_, i) => i !== idx),
                    })
                  }
                  className="inline-flex items-center gap-1 text-[11px] text-rose-700 hover:underline px-2"
                  title="Remove this anchor"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
              <input
                type="text"
                placeholder="One-sentence rationale"
                className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs"
                value={a.rationale}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    anchor_instruments: draft.anchor_instruments.map((x, i) =>
                      i === idx ? { ...x, rationale: e.target.value } : x
                    ),
                  })
                }
              />
            </div>
          ))}
        </div>
      </div>
      <div className="flex gap-2 pt-2">
        <Button size="sm" onClick={onSave} disabled={pending}>Save as edited</Button>
        <Button size="sm" variant="outline" onClick={onCancel} disabled={pending}>Cancel</Button>
      </div>
    </div>
  );
}
