"use client";

import { useState, useTransition } from "react";
import { Sparkles, CheckCircle2, X, Loader2, AlertTriangle, Trash2, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { suggestEvidence, saveEvidence } from "@/lib/evidence/actions";
import type { ValidationEvidence, EvidenceConfidence } from "@/types/evidence";

/**
 * Generic validation-evidence editor used by the four adapter-driven
 * instruments (Fluent, Technical, Reflect, Psychometrics). Identical UX
 * to the AC CompetencyEvidencePanel - generate AI suggestion → review
 * (accept / edit / reject) - but calls the generic server actions with
 * an instrument key. Only verified/edited anchors reach client surfaces.
 */

type Props = {
  instrumentKey: string;
  itemId: string;
  reviewerEmail: string;
  initialEvidence: ValidationEvidence | null;
};

const CONFIDENCE_TONE: Record<EvidenceConfidence, string> = {
  direct_adaptation: "bg-emerald-100 text-emerald-900 border-emerald-200",
  construct_aligned: "bg-sky-100 text-sky-900 border-sky-200",
  novel: "bg-amber-100 text-amber-900 border-amber-200",
};

const STATUS_TONE: Record<ValidationEvidence["review_status"], string> = {
  ai_proposed: "bg-amber-100 text-amber-900 border-amber-200",
  verified: "bg-emerald-100 text-emerald-900 border-emerald-200",
  edited: "bg-sky-100 text-sky-900 border-sky-200",
  rejected: "bg-rose-100 text-rose-900 border-rose-200",
};

export function EvidencePanel({ instrumentKey, itemId, reviewerEmail, initialEvidence }: Props) {
  const [evidence, setEvidence] = useState<ValidationEvidence | null>(initialEvidence);
  const [draft, setDraft] = useState<ValidationEvidence | null>(initialEvidence);
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function generate() {
    setError(null);
    startTransition(async () => {
      const r = await suggestEvidence(instrumentKey, itemId);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setEvidence(r.evidence);
      setDraft(r.evidence);
      setEditing(false);
    });
  }

  function persist(next: ValidationEvidence) {
    setError(null);
    startTransition(async () => {
      const r = await saveEvidence(instrumentKey, itemId, next, reviewerEmail);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setEvidence(next);
      setDraft(next);
      setEditing(false);
    });
  }

  function startEmptyDraft() {
    const empty: ValidationEvidence = {
      anchor_instruments: [],
      construct_summary: "",
      review_status: "edited",
      reviewed_by: reviewerEmail,
      reviewed_at: null,
      ai_model: null,
    };
    setDraft(empty);
    setEvidence(empty);
    setEditing(true);
  }

  if (!evidence) {
    return (
      <PanelShell>
        <p className="text-sm text-muted-foreground">
          No research provenance recorded yet. Generate an AI suggestion from the curated
          bibliography (you verify before it reaches any client), or add anchors manually.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={generate} disabled={pending}>
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin me-1.5" /> : <Sparkles className="h-3.5 w-3.5 me-1.5" />}
            Generate AI suggestion
          </Button>
          <Button variant="outline" onClick={startEmptyDraft} disabled={pending}>
            <Plus className="h-3.5 w-3.5 me-1.5" /> Add manually
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
            Reviewed by {evidence.reviewed_by}
            {evidence.reviewed_at ? ` on ${evidence.reviewed_at.slice(0, 10)}` : ""}
          </span>
        )}
        {evidence.ai_model && (
          <span className="text-[10px] text-muted-foreground ms-auto">AI-proposed via {evidence.ai_model}</span>
        )}
      </div>

      {showAiBanner && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 mb-4 text-xs text-amber-900 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">Awaiting human verification</p>
            <p className="mt-0.5 leading-snug">
              These anchors were proposed by AI and are <strong>not</strong> shown in any client
              deliverable until you Accept or Edit &amp; save them. Spot-check each citation.
            </p>
          </div>
        </div>
      )}

      <div className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-1">
        Construct summary
      </div>
      <p className="text-sm mb-4">{evidence.construct_summary || <span className="italic text-muted-foreground">-</span>}</p>

      <div className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-2">
        Anchor instruments ({evidence.anchor_instruments.length})
      </div>
      {evidence.anchor_instruments.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">No anchor instruments.</p>
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
              <p className="text-xs text-muted-foreground mt-2 leading-snug">{a.citation}</p>
              {a.rationale && (
                <p className="text-[11px] text-foreground/80 mt-2 italic leading-snug">Why: {a.rationale}</p>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap gap-2 mt-5">
        {status === "ai_proposed" && (
          <>
            <Button size="sm" disabled={pending} onClick={() => persist({ ...evidence, review_status: "verified" })}>
              <CheckCircle2 className="h-3.5 w-3.5 me-1.5" /> Accept &amp; verify
            </Button>
            <Button size="sm" variant="outline" disabled={pending} onClick={() => { setDraft(evidence); setEditing(true); }}>
              Edit
            </Button>
            <Button size="sm" variant="outline" disabled={pending} onClick={() => persist({ ...evidence, review_status: "rejected" })}>
              <X className="h-3.5 w-3.5 me-1.5" /> Reject
            </Button>
          </>
        )}
        {(status === "verified" || status === "edited") && (
          <>
            <Button size="sm" variant="outline" disabled={pending} onClick={() => { setDraft(evidence); setEditing(true); }}>
              Edit
            </Button>
            <Button size="sm" variant="outline" disabled={pending} onClick={() => persist({ ...evidence, review_status: "rejected" })}>
              <X className="h-3.5 w-3.5 me-1.5" /> Reject
            </Button>
            <Button size="sm" variant="ghost" disabled={pending} onClick={generate}>
              <Sparkles className="h-3.5 w-3.5 me-1.5" /> Re-generate
            </Button>
          </>
        )}
        {status === "rejected" && (
          <>
            <Button size="sm" disabled={pending} onClick={() => persist({ ...evidence, review_status: "verified" })}>
              Restore &amp; verify
            </Button>
            <Button size="sm" variant="ghost" disabled={pending} onClick={generate}>
              <Sparkles className="h-3.5 w-3.5 me-1.5" /> Re-generate
            </Button>
          </>
        )}
        {pending && <Loader2 className="h-3.5 w-3.5 animate-spin self-center text-muted-foreground" />}
      </div>

      {error && <ErrorMsg>{error}</ErrorMsg>}

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
        <h2 className="text-base font-semibold">Research provenance</h2>
      </div>
      {children}
    </div>
  );
}

function ErrorMsg({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-3 rounded-md border border-rose-300 bg-rose-50 p-2 text-xs text-rose-900">{children}</div>
  );
}

function EditorForm({
  draft, setDraft, onCancel, onSave, pending,
}: {
  draft: ValidationEvidence;
  setDraft: (e: ValidationEvidence) => void;
  onCancel: () => void;
  onSave: () => void;
  pending: boolean;
}) {
  return (
    <div className="mt-5 rounded-md border border-sky-300 bg-sky-50/60 p-4 space-y-3">
      <p className="text-xs font-semibold text-sky-900">Editing - saves as human-reviewed (edited)</p>
      <div>
        <label className="block text-[11px] font-semibold text-muted-foreground mb-1">Construct summary</label>
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
                  { name: "", citation: "", doi: null, confidence: "construct_aligned", rationale: "" },
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
                placeholder="Instrument / framework name"
                className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs"
                value={a.name}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    anchor_instruments: draft.anchor_instruments.map((x, i) => (i === idx ? { ...x, name: e.target.value } : x)),
                  })
                }
              />
              <textarea
                rows={2}
                placeholder="Full citation (APA)"
                className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs"
                value={a.citation}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    anchor_instruments: draft.anchor_instruments.map((x, i) => (i === idx ? { ...x, citation: e.target.value } : x)),
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
                        i === idx ? { ...x, confidence: e.target.value as EvidenceConfidence } : x
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
                    setDraft({ ...draft, anchor_instruments: draft.anchor_instruments.filter((_, i) => i !== idx) })
                  }
                  className="inline-flex items-center gap-1 text-[11px] text-rose-700 hover:underline px-2"
                  title="Remove anchor"
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
                    anchor_instruments: draft.anchor_instruments.map((x, i) => (i === idx ? { ...x, rationale: e.target.value } : x)),
                  })
                }
              />
            </div>
          ))}
        </div>
      </div>
      <div className="flex gap-2 pt-2">
        <Button size="sm" onClick={onSave} disabled={pending}>Save</Button>
        <Button size="sm" variant="outline" onClick={onCancel} disabled={pending}>Cancel</Button>
      </div>
    </div>
  );
}
