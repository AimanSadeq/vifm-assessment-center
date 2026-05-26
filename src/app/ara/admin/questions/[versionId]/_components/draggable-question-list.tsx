"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  ChevronUp, ChevronDown, GripVertical, Pencil, Trash2, Loader2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  reorderAraQuestions, moveAraQuestion, deleteAraQuestion,
} from "@/lib/ara/actions";
import type { AraQuestion } from "@/types/ara";

type Item = Pick<
  AraQuestion,
  "id" | "question_number" | "question_text_en" | "layer"
> & {
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

const EVIDENCE_TONE: Record<NonNullable<Item["evidence_status"]>, { label: string; cls: string; title: string }> = {
  ai_proposed: { label: "AI proposed", cls: "bg-amber-100 text-amber-900 border-amber-200", title: "AI suggestion saved - admin review required before clients see it" },
  verified:    { label: "Verified",    cls: "bg-emerald-100 text-emerald-900 border-emerald-200", title: "Citation verified by admin - surfaces in the report appendix" },
  edited:      { label: "Edited",      cls: "bg-sky-100 text-sky-900 border-sky-200", title: "Admin edited the AI proposal - surfaces in the report appendix" },
  rejected:    { label: "Rejected",    cls: "bg-rose-100 text-rose-900 border-rose-200", title: "Admin rejected the proposal - does not surface in the report" },
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
        setError(result?.error ?? "Reorder failed");
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
        setError(result?.error ?? "Move failed");
        setQuestions(initialQuestions);
      }
    });
  };

  const handleDelete = (id: string) => {
    if (!confirm("Delete this question? This cannot be undone.")) return;
    const prev = questions;
    setQuestions(questions.filter((q) => q.id !== id));
    start(async () => {
      const result = await deleteAraQuestion(id, versionId);
      if (!result?.ok) {
        setError(result?.error ?? "Delete failed");
        setQuestions(prev);
      }
    });
  };

  if (questions.length === 0) {
    return <p className="text-xs text-muted-foreground">No questions in this pillar yet.</p>;
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
                title="Drag to reorder"
              >
                <GripVertical className="h-4 w-4" />
              </span>
              <div className="flex flex-col -gap-px">
                <button
                  type="button"
                  onClick={() => handleArrowMove(q.id, "up")}
                  disabled={idx === 0 || pending}
                  className="h-4 w-5 text-muted-foreground hover:text-foreground disabled:opacity-20"
                  aria-label="Move up"
                >
                  <ChevronUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleArrowMove(q.id, "down")}
                  disabled={idx === questions.length - 1 || pending}
                  className="h-4 w-5 text-muted-foreground hover:text-foreground disabled:opacity-20"
                  aria-label="Move down"
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
              </div>
              <Link
                href={`/ara/admin/questions/${versionId}/${q.id}`}
                className="flex-1 min-w-0 hover:text-accent group"
                title="Open question detail (lineage + validation evidence + edit form)"
              >
                <span className="font-medium">Q{q.question_number}</span>{" "}
                <Badge variant="outline" className="text-[10px] mx-1">L{q.layer}</Badge>
                <span className="text-muted-foreground group-hover:text-accent">{q.question_text_en}</span>
              </Link>
              <div className="flex items-center gap-1 shrink-0">
                {q.evidence_status && EVIDENCE_TONE[q.evidence_status] && (
                  <span
                    className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full border ${EVIDENCE_TONE[q.evidence_status].cls}`}
                    title={EVIDENCE_TONE[q.evidence_status].title}
                  >
                    {EVIDENCE_TONE[q.evidence_status].label}
                  </span>
                )}
                <Link
                  href={`/ara/admin/questions/${versionId}/${q.id}`}
                  className="h-6 w-6 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
                  aria-label="Edit"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Link>
                <button
                  type="button"
                  onClick={() => handleDelete(q.id)}
                  disabled={pending}
                  className="h-6 w-6 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 disabled:opacity-40"
                  aria-label="Delete"
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
          {error ?? "Saving order…"}
        </p>
      )}
    </div>
  );
}
