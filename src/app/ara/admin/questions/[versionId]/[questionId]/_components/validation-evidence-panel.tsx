"use client";

import { useState, useTransition } from "react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
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
          {t("araAdminData.ve_empty_body")}
        </p>
        <div className="mt-4">
          <Button onClick={generate} disabled={pending}>
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin me-1.5" /> : <Sparkles className="h-3.5 w-3.5 me-1.5" />}
            {t("araAdminData.ve_generate_button")}
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
            {t("araAdminData.ve_reviewed_by", { name: evidence.reviewed_by, date: evidence.reviewed_at?.slice(0, 10) ?? "" })}
          </span>
        )}
        {evidence.ai_model && (
          <span className="text-[10px] text-muted-foreground ms-auto">
            {t("araAdminData.ve_ai_proposed_via", { model: evidence.ai_model })}
          </span>
        )}
      </div>

      {showAiBanner && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 mb-4 text-xs text-amber-900 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">{t("araAdminData.ve_banner_title")}</p>
            <p className="mt-0.5 leading-snug">
              {t("araAdminData.ve_banner_body")}
            </p>
          </div>
        </div>
      )}

      <div className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-1">
        {t("araAdminData.ve_construct_summary")}
      </div>
      <p className="text-sm mb-4">{evidence.construct_summary}</p>

      <div className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-2">
        {t("araAdminData.ve_anchor_instruments", { count: evidence.anchor_instruments.length })}
      </div>
      {evidence.anchor_instruments.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">
          {t("araAdminData.ve_no_anchors")}
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
                  {t("araAdminData.ve_rationale_prefix", { text: a.rationale })}
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
              {t("araAdminData.ve_accept_verified")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => { setDraft(evidence); setEditing(true); }}
            >
              {t("araAdminData.ve_edit")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => persist({ ...evidence, review_status: "rejected" })}
            >
              <X className="h-3.5 w-3.5 me-1.5" />
              {t("araAdminData.ve_reject")}
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
              {t("araAdminData.ve_edit")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => persist({ ...evidence, review_status: "rejected" })}
            >
              <X className="h-3.5 w-3.5 me-1.5" />
              {t("araAdminData.ve_reject")}
            </Button>
            <Button size="sm" variant="ghost" disabled={pending} onClick={generate}>
              <Sparkles className="h-3.5 w-3.5 me-1.5" />
              {t("araAdminData.ve_regenerate")}
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
              {t("araAdminData.ve_restore_verified")}
            </Button>
            <Button size="sm" variant="ghost" disabled={pending} onClick={generate}>
              <Sparkles className="h-3.5 w-3.5 me-1.5" />
              {t("araAdminData.ve_regenerate")}
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
  const { t } = useTranslation();
  return (
    <div className="rounded-lg border bg-card mb-6 p-5">
      <div className="flex items-center gap-2 mb-3">
        <Badge variant="outline" className="text-[10px]">{t("araAdminData.ve_badge")}</Badge>
        <h2 className="text-base font-semibold">{t("araAdminData.ve_panel_heading")}</h2>
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
  const { t } = useTranslation();
  return (
    <div className="mt-5 rounded-md border border-sky-300 bg-sky-50/60 p-4 space-y-3">
      <p className="text-xs font-semibold text-sky-900">{t("araAdminData.ve_editing_title")}</p>
      <div>
        <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
          {t("araAdminData.ve_construct_summary_label")}
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
            {t("araAdminData.ve_anchor_instruments_label", { count: draft.anchor_instruments.length })}
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
            <Plus className="h-3 w-3" /> {t("araAdminData.ve_add_anchor")}
          </button>
        </div>
        <div className="space-y-2">
          {draft.anchor_instruments.map((a, idx) => (
            <div key={idx} className="rounded-md border bg-card p-3 space-y-2">
              <input
                type="text"
                placeholder={t("araAdminData.ve_name_placeholder")}
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
                placeholder={t("araAdminData.ve_citation_placeholder")}
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
                  title={t("araAdminData.ve_remove_anchor_title")}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
              <input
                type="text"
                placeholder={t("araAdminData.ve_rationale_placeholder")}
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
        <Button size="sm" onClick={onSave} disabled={pending}>{t("araAdminData.ve_save_edited")}</Button>
        <Button size="sm" variant="outline" onClick={onCancel} disabled={pending}>{t("araAdminData.ve_cancel")}</Button>
      </div>
    </div>
  );
}
