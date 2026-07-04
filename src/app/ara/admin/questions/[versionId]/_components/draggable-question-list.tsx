"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useTranslation } from "react-i18next";
import {
  ChevronUp, ChevronDown, GripVertical, Pencil, Trash2, Loader2, Power,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  reorderAraQuestions, moveAraQuestion, deleteAraQuestion, setAraQuestionActive,
} from "@/lib/ara/actions";
import type { AraQuestion } from "@/types/ara";

type Item = Pick<
  AraQuestion,
  "id" | "question_number" | "question_text_en" | "layer"
> & {
  /** Whether the question is live. AI-authored drafts arrive inactive and are
   *  excluded from the respondent flow + scoring until an admin activates them. */
  is_active?: boolean;
  /** Validation-evidence review status, surfaced as a per-row chip
   *  so admins can see at a glance which questions still need an
   *  anchor citation reviewed. Null = no evidence captured yet. */
  evidence_status?: "ai_proposed" | "verified" | "edited" | "rejected" | null;
};

type DraggableQuestionListProps = {
  versionId: string;
  pillarId: string;
  layer: 1 | 2;
  initialQuestions: Item[];
};

// CSS tone only - label + title come from i18n keyed by status
// (see EVIDENCE_I18N below) so they translate with the active locale.
const EVIDENCE_TONE: Record<NonNullable<Item["evidence_status"]>, string> = {
  ai_proposed: "bg-amber-100 text-amber-900 border-amber-200",
  verified:    "bg-emerald-100 text-emerald-900 border-emerald-200",
  edited:      "bg-sky-100 text-sky-900 border-sky-200",
  rejected:    "bg-rose-100 text-rose-900 border-rose-200",
};

const EVIDENCE_I18N: Record<NonNullable<Item["evidence_status"]>, { label: string; title: string }> = {
  ai_proposed: { label: "araAdminData.dql_status_ai_proposed_label", title: "araAdminData.dql_status_ai_proposed_title" },
  verified:    { label: "araAdminData.dql_status_verified_label",    title: "araAdminData.dql_status_verified_title" },
  edited:      { label: "araAdminData.dql_status_edited_label",      title: "araAdminData.dql_status_edited_title" },
  rejected:    { label: "araAdminData.dql_status_rejected_label",    title: "araAdminData.dql_status_rejected_title" },
};

/**
 * Drag-to-reorder questions inside a single pillar. Up/down arrow
 * buttons remain available as a no-JS fallback and for keyboard /
 * screen-reader users. The drag handle is visual only - the actual
 * dragging is on the row, but we surface a `GripVertical` icon as a
 * cursor affordance.
 *
 * The component owns local order state so the UI updates optimistically
 * on drop; the server action runs in a useTransition and reverts the
 * order on failure.
 */
export function DraggableQuestionList({
  versionId,
  pillarId,
  layer,
  initialQuestions,
}: DraggableQuestionListProps) {
  const { t } = useTranslation();
  const [questions, setQuestions] = useState<Item[]>(initialQuestions);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const persist = (next: Item[]) => {
    const orderedIds = next.map((q) => q.id);
    start(async () => {
      const result = await reorderAraQuestions(versionId, pillarId, layer, orderedIds);
      if (!result?.ok) {
        setError(result?.error ?? t("araAdminData.dql_reorder_failed"));
        setQuestions(initialQuestions); // revert
      } else {
        setError(null);
      }
    });
  };

  const onDragStart = (i: number) => (e: React.DragEvent) => {
    e.dataTransfer.effectAllowed = "move";
    setDragIdx(i);
  };

  const onDragOver = (i: number) => (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (overIdx !== i) setOverIdx(i);
  };

  const onDrop = (target: number) => (e: React.DragEvent) => {
    e.preventDefault();
    const from = dragIdx;
    setDragIdx(null);
    setOverIdx(null);
    if (from == null || from === target) return;
    const next = [...questions];
    const [moved] = next.splice(from, 1);
    next.splice(target, 0, moved);
    setQuestions(next);
    persist(next);
  };

  const onDragEnd = () => {
    setDragIdx(null);
    setOverIdx(null);
  };

  const handleArrowMove = (id: string, direction: "up" | "down") => {
    const i = questions.findIndex((q) => q.id === id);
    if (i < 0) return;
    if (direction === "up" && i === 0) return;
    if (direction === "down" && i === questions.length - 1) return;
    const j = direction === "up" ? i - 1 : i + 1;
    const next = [...questions];
    [next[i], next[j]] = [next[j], next[i]];
    setQuestions(next);
    start(async () => {
      const result = await moveAraQuestion(id, direction);
      if (!result?.ok) {
        setError(result?.error ?? t("araAdminData.dql_move_failed"));
        setQuestions(initialQuestions);
      }
    });
  };

  const handleDelete = (id: string) => {
    if (!confirm(t("araAdminData.dql_delete_confirm"))) return;
    const prev = questions;
    setQuestions(questions.filter((q) => q.id !== id));
    start(async () => {
      const result = await deleteAraQuestion(id, versionId);
      if (!result?.ok) {
        setError(result?.error ?? t("araAdminData.dql_delete_failed"));
        setQuestions(prev);
      }
    });
  };

  const handleToggleActive = (id: string, next: boolean) => {
    const prev = questions;
    setQuestions(questions.map((q) => (q.id === id ? { ...q, is_active: next } : q)));
    start(async () => {
      const result = await setAraQuestionActive(id, next, versionId);
      if (!result?.ok) {
        setError(result?.error ?? "Could not update the question.");
        setQuestions(prev);
      }
    });
  };

  if (questions.length === 0) {
    return <p className="text-xs text-muted-foreground">{t("araAdminData.dql_no_questions")}</p>;
  }

  return (
    <div>
      <ol className="space-y-2">
        {questions.map((q, idx) => {
          const isDragging = dragIdx === idx;
          const isOver = overIdx === idx && dragIdx !== null && dragIdx !== idx;
          return (
            <li
              key={q.id}
              draggable
              onDragStart={onDragStart(idx)}
              onDragOver={onDragOver(idx)}
              onDrop={onDrop(idx)}
              onDragEnd={onDragEnd}
              className={[
                "text-sm flex items-start gap-2 rounded-md px-1 py-1.5 -mx-1",
                "transition-colors",
                isDragging ? "opacity-50" : "",
                isOver ? "bg-accent/10 ring-1 ring-accent/40" : "",
              ].filter(Boolean).join(" ")}
            >
              <span
                className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground pt-1"
                aria-hidden="true"
                title={t("araAdminData.dql_drag_title")}
              >
                <GripVertical className="h-4 w-4" />
              </span>
              <div className="flex flex-col -gap-px">
                <button
                  type="button"
                  onClick={() => handleArrowMove(q.id, "up")}
                  disabled={idx === 0 || pending}
                  className="h-4 w-5 text-muted-foreground hover:text-foreground disabled:opacity-20"
                  aria-label={t("araAdminData.dql_move_up")}
                >
                  <ChevronUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleArrowMove(q.id, "down")}
                  disabled={idx === questions.length - 1 || pending}
                  className="h-4 w-5 text-muted-foreground hover:text-foreground disabled:opacity-20"
                  aria-label={t("araAdminData.dql_move_down")}
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
              </div>
              <Link
                href={`/ara/admin/questions/${versionId}/${q.id}`}
                className="flex-1 min-w-0 hover:text-accent group"
                title={t("araAdminData.dql_open_detail_title")}
              >
                <span className="font-medium">Q{q.question_number}</span>{" "}
                <Badge variant="outline" className="text-[10px] mx-1">L{q.layer}</Badge>
                {q.is_active === false && (
                  <Badge className="mx-1 border-amber-200 bg-amber-100 text-[10px] text-amber-900">Inactive draft</Badge>
                )}
                <span className={`group-hover:text-accent ${q.is_active === false ? "text-muted-foreground/60 italic" : "text-muted-foreground"}`}>{q.question_text_en}</span>
              </Link>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => handleToggleActive(q.id, q.is_active === false)}
                  disabled={pending}
                  className={`h-6 w-6 inline-flex items-center justify-center rounded-md hover:bg-muted disabled:opacity-40 ${
                    q.is_active === false ? "text-amber-600 hover:text-emerald-600" : "text-emerald-600 hover:text-muted-foreground"
                  }`}
                  title={q.is_active === false ? "Activate (make this question live)" : "Deactivate (hide from the assessment)"}
                  aria-label={q.is_active === false ? "Activate question" : "Deactivate question"}
                >
                  <Power className="h-3.5 w-3.5" />
                </button>
                {q.evidence_status && EVIDENCE_TONE[q.evidence_status] && (
                  <span
                    className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full border ${EVIDENCE_TONE[q.evidence_status]}`}
                    title={t(EVIDENCE_I18N[q.evidence_status].title)}
                  >
                    {t(EVIDENCE_I18N[q.evidence_status].label)}
                  </span>
                )}
                <Link
                  href={`/ara/admin/questions/${versionId}/${q.id}`}
                  className="h-6 w-6 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
                  aria-label={t("araAdminData.dql_edit")}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Link>
                <button
                  type="button"
                  onClick={() => handleDelete(q.id)}
                  disabled={pending}
                  className="h-6 w-6 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 disabled:opacity-40"
                  aria-label={t("araAdminData.dql_delete")}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </li>
          );
        })}
      </ol>
      {(pending || error) && (
        <p className={`text-xs mt-2 inline-flex items-center gap-1 ${error ? "text-destructive" : "text-muted-foreground"}`}>
          {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
          {error ?? t("araAdminData.dql_saving_order")}
        </p>
      )}
    </div>
  );
}
