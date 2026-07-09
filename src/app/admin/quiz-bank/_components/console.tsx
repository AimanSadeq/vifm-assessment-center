"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Ban, Archive, RotateCcw, Languages, ChevronDown, ChevronRight, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CompetencyBank, QuizBankItem } from "@/lib/quiz-bank/admin";
import { setQuizItemStatusAction, bulkApproveCompetencyAction, setQuizItemArReviewedAction } from "../actions";

type Res = { ok: true; message?: string } | { ok: false; error: string };

function useRunner() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<Res>, okMsg?: string) =>
    start(async () => {
      const res = await fn();
      if (res.ok) { toast.success(res.message ?? okMsg ?? "Done"); router.refresh(); }
      else toast.error(res.error);
    });
  return { pending, run };
}

const STATUS_TONE: Record<string, string> = {
  approved: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  in_review: "bg-amber-50 text-amber-700 ring-amber-200",
  draft: "bg-sky-50 text-sky-700 ring-sky-200",
  rejected: "bg-rose-50 text-rose-700 ring-rose-200",
  retired: "bg-slate-100 text-slate-500 ring-slate-200",
};

function ItemRow({ item }: { item: QuizBankItem }) {
  const { pending, run } = useRunner();
  return (
    <li className="rounded-md border border-slate-200 bg-white p-2.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ${STATUS_TONE[item.status]}`}>{item.status.replace("_", " ")}</span>
            <span className="text-[10px] uppercase text-slate-400">{item.difficulty}</span>
            <span className="text-[10px] text-slate-400">{item.type.replace("_", " ")}</span>
            {item.ar_reviewed
              ? <span className="inline-flex items-center gap-0.5 text-[10px] text-emerald-600"><Languages className="h-3 w-3" /> AR reviewed</span>
              : <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-500"><Languages className="h-3 w-3" /> AR pending</span>}
          </div>
          <p className="mt-1 text-sm text-slate-800">{item.prompt_en}</p>
          {item.prompt_ar && <p className="text-sm text-slate-400" dir="rtl">{item.prompt_ar}</p>}
          <ul className="mt-1 space-y-0.5">
            {item.options_en.map((o, i) => (
              <li key={i} className={`text-xs ${i === item.correct_index ? "font-semibold text-emerald-700" : "text-slate-500"}`}>
                {i === item.correct_index ? "✓ " : "· "}{o}
              </li>
            ))}
          </ul>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {item.status !== "approved" && (
            <Button size="sm" variant="ghost" className="h-7 px-2 text-emerald-700" title="Approve" onClick={() => run(() => setQuizItemStatusAction({ itemId: item.id, status: "approved" }), "Approved.")} disabled={pending}>
              <Check className="h-4 w-4" />
            </Button>
          )}
          {item.status !== "approved" && item.status !== "rejected" && (
            <Button size="sm" variant="ghost" className="h-7 px-2 text-rose-600" title="Reject" onClick={() => run(() => setQuizItemStatusAction({ itemId: item.id, status: "rejected" }), "Rejected.")} disabled={pending}>
              <Ban className="h-4 w-4" />
            </Button>
          )}
          <Button size="sm" variant="ghost" className={`h-7 px-2 ${item.ar_reviewed ? "text-emerald-600" : "text-amber-500"}`} title={item.ar_reviewed ? "Arabic reviewed - click to unmark" : "Mark Arabic (MSA) reviewed"} onClick={() => run(() => setQuizItemArReviewedAction({ itemId: item.id, value: !item.ar_reviewed }), "Updated.")} disabled={pending}>
            <Languages className="h-4 w-4" />
          </Button>
          {item.status !== "retired" ? (
            <Button size="sm" variant="ghost" className="h-7 px-2 text-slate-500" title="Retire" onClick={() => run(() => setQuizItemStatusAction({ itemId: item.id, status: "retired" }), "Retired.")} disabled={pending}>
              <Archive className="h-4 w-4" />
            </Button>
          ) : (
            <Button size="sm" variant="ghost" className="h-7 px-2 text-sky-600" title="Restore" onClick={() => run(() => setQuizItemStatusAction({ itemId: item.id, status: "in_review" }), "Restored.")} disabled={pending}>
              <RotateCcw className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </li>
  );
}

function CompetencyCard({ comp, target }: { comp: CompetencyBank; target: number }) {
  const { pending, run } = useRunner();
  const [open, setOpen] = useState(false);
  const ready = comp.approved >= target;
  const visible = comp.items.filter((i) => i.status !== "retired");

  return (
    <div className={`rounded-xl border bg-card p-4 shadow-sm ${ready ? "border-emerald-200" : comp.inReview > 0 ? "border-amber-200" : "border-border"}`}>
      <div className="flex flex-wrap items-center gap-2">
        <button className="inline-flex items-center gap-1 text-sm font-semibold text-[#010131]" onClick={() => setOpen((v) => !v)}>
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          {comp.name}
        </button>
        <span className={`text-xs tabular-nums ${ready ? "text-emerald-700" : "text-slate-500"}`}>
          {comp.approved}/{target} approved
        </span>
        {comp.inReview > 0 && <span className="text-xs text-amber-600">· {comp.inReview} in review</span>}
        {ready && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">servable</span>}
        {comp.inReview > 0 && (
          <Button size="sm" variant="outline" className="ml-auto" onClick={() => run(() => bulkApproveCompetencyAction({ competencyId: comp.competencyId }), "Approved.")} disabled={pending}>
            <CheckCheck className="mr-1.5 h-4 w-4" /> Approve all in review
          </Button>
        )}
      </div>
      {open && visible.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {visible.map((it) => <ItemRow key={it.id} item={it} />)}
        </ul>
      )}
    </div>
  );
}

export function QuizBankConsole({ competencies, target }: { competencies: CompetencyBank[]; target: number }) {
  // Only show competencies that have authored items - the rest have no bank yet.
  const withItems = competencies.filter((c) => c.items.length > 0);
  if (withItems.length === 0) {
    return <p className="text-sm text-muted-foreground">No quiz items yet. Seed the competency quiz bank, then review + approve each competency here.</p>;
  }
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">{withItems.length} competency(ies) with authored items. Expand to review; &ldquo;Approve all in review&rdquo; is the SME sign-off that activates a competency&apos;s pool.</p>
      {withItems.map((c) => <CompetencyCard key={c.competencyId} comp={c} target={target} />)}
    </div>
  );
}
