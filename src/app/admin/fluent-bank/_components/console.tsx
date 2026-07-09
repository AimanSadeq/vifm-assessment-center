"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Ban, Archive, ChevronDown, ChevronRight, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { FluentCell, FluentItem, FluentPrompt } from "@/lib/quiz-bank/fluent-admin";
import { PROMPT_MIN } from "@/lib/quiz-bank/fluent-admin";
import { setFluentItemStatusAction, bulkPromoteSkillAction } from "../actions";

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

const TONE: Record<string, string> = {
  live: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  in_review: "bg-amber-50 text-amber-700 ring-amber-200",
  rejected: "bg-rose-50 text-rose-700 ring-rose-200",
  retired: "bg-slate-100 text-slate-500 ring-slate-200",
};

function ItemRow({ item }: { item: FluentItem }) {
  const { pending, run } = useRunner();
  return (
    <li className="rounded-md border border-slate-200 bg-white p-2.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ${TONE[item.status] ?? "bg-sky-50 text-sky-700 ring-sky-200"}`}>{item.status.replace("_", " ")}</span>
            <span className="text-[10px] uppercase text-slate-400">{item.cefr}</span>
          </div>
          <p className="mt-1 text-xs italic text-slate-500">{item.content}</p>
          <p className="text-sm text-slate-800">{item.question}</p>
          <ul className="mt-1 space-y-0.5">
            {item.options.map((o, i) => (
              <li key={i} className={`text-xs ${i === item.correct_index ? "font-semibold text-emerald-700" : "text-slate-500"}`}>
                {i === item.correct_index ? "✓ " : "· "}{o}
              </li>
            ))}
          </ul>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {item.status !== "live" && (
            <Button size="sm" variant="ghost" className="h-7 px-2 text-emerald-700" title="Promote to live" onClick={() => run(() => setFluentItemStatusAction({ itemId: item.id, status: "live" }), "Promoted to live.")} disabled={pending}>
              <Check className="h-4 w-4" />
            </Button>
          )}
          {item.status !== "rejected" && item.status !== "retired" && (
            <Button size="sm" variant="ghost" className="h-7 px-2 text-rose-600" title="Reject" onClick={() => run(() => setFluentItemStatusAction({ itemId: item.id, status: "rejected" }), "Rejected.")} disabled={pending}>
              <Ban className="h-4 w-4" />
            </Button>
          )}
          {item.status === "live" && (
            <Button size="sm" variant="ghost" className="h-7 px-2 text-slate-500" title="Retire" onClick={() => run(() => setFluentItemStatusAction({ itemId: item.id, status: "retired" }), "Retired.")} disabled={pending}>
              <Archive className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </li>
  );
}

function SkillCard({ skill, cells }: { skill: "reading" | "listening"; cells: FluentCell[] }) {
  const { pending, run } = useRunner();
  const [openCell, setOpenCell] = useState<string | null>(null);
  const mine = cells.filter((c) => c.skill === skill);
  const totalInReview = mine.reduce((s, c) => s + c.inReview, 0);
  const servable = mine.every((c) => c.live >= c.need);

  return (
    <div className={`rounded-xl border bg-card p-4 shadow-sm ${servable ? "border-emerald-200" : totalInReview > 0 ? "border-amber-200" : "border-border"}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold capitalize text-[#010131]">{skill}</span>
        {servable && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">ramp servable</span>}
        {totalInReview > 0 && (
          <Button size="sm" variant="outline" className="ml-auto" onClick={() => run(() => bulkPromoteSkillAction({ skill }), "Promoted.")} disabled={pending}>
            <CheckCheck className="mr-1.5 h-4 w-4" /> Promote all in review → live
          </Button>
        )}
      </div>
      <div className="mt-3 space-y-1">
        {mine.map((c) => {
          const key = `${c.skill}:${c.cefr}`;
          const ok = c.live >= c.need;
          return (
            <div key={key} className="rounded-md border border-slate-100 bg-slate-50/50">
              <button className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left" onClick={() => setOpenCell(openCell === key ? null : key)}>
                {openCell === key ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                <span className="w-8 text-xs font-semibold text-slate-700">{c.cefr}</span>
                <span className={`text-xs tabular-nums ${ok ? "text-emerald-700" : "text-rose-600"}`}>{c.live}/{c.need} live</span>
                {c.inReview > 0 && <span className="text-xs text-amber-600">· {c.inReview} in review</span>}
              </button>
              {openCell === key && c.items.length > 0 && (
                <ul className="space-y-1.5 p-2">
                  {c.items.filter((i) => i.status !== "retired").map((it) => <ItemRow key={it.id} item={it} />)}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PromptRow({ prompt }: { prompt: FluentPrompt }) {
  const { pending, run } = useRunner();
  return (
    <li className="rounded-md border border-slate-200 bg-white p-2.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ${TONE[prompt.status] ?? "bg-sky-50 text-sky-700 ring-sky-200"}`}>{prompt.status.replace("_", " ")}</span>
            <span className="text-[10px] uppercase text-slate-400">target {prompt.cefr}</span>
          </div>
          <p className="mt-1 text-sm text-slate-800">{prompt.prompt_en}</p>
          {prompt.prompt_ar && <p dir="rtl" className="text-xs text-slate-500">{prompt.prompt_ar}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {prompt.status !== "live" && (
            <Button size="sm" variant="ghost" className="h-7 px-2 text-emerald-700" title="Promote to live" onClick={() => run(() => setFluentItemStatusAction({ itemId: prompt.id, status: "live" }), "Promoted to live.")} disabled={pending}>
              <Check className="h-4 w-4" />
            </Button>
          )}
          {prompt.status !== "rejected" && prompt.status !== "retired" && (
            <Button size="sm" variant="ghost" className="h-7 px-2 text-rose-600" title="Reject" onClick={() => run(() => setFluentItemStatusAction({ itemId: prompt.id, status: "rejected" }), "Rejected.")} disabled={pending}>
              <Ban className="h-4 w-4" />
            </Button>
          )}
          {prompt.status === "live" && (
            <Button size="sm" variant="ghost" className="h-7 px-2 text-slate-500" title="Retire" onClick={() => run(() => setFluentItemStatusAction({ itemId: prompt.id, status: "retired" }), "Retired.")} disabled={pending}>
              <Archive className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </li>
  );
}

function PromptCard({ skill, prompts }: { skill: "writing" | "speaking"; prompts: FluentPrompt[] }) {
  const { pending, run } = useRunner();
  const mine = prompts.filter((p) => p.skill === skill && p.status !== "retired" && p.status !== "rejected");
  const live = mine.filter((p) => p.status === "live").length;
  const inReview = mine.filter((p) => p.status === "in_review").length;
  const servable = live >= PROMPT_MIN;

  return (
    <div className={`rounded-xl border bg-card p-4 shadow-sm ${servable ? "border-emerald-200" : inReview > 0 ? "border-amber-200" : "border-border"}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold capitalize text-[#010131]">{skill}</span>
        <span className="text-[11px] text-muted-foreground">AI-scored task · {live}/{PROMPT_MIN} live prompts</span>
        {servable && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">rotation servable</span>}
        {inReview > 0 && <span className="text-[11px] text-amber-600">· {inReview} in review</span>}
        {inReview > 0 && (
          <Button size="sm" variant="outline" className="ml-auto" onClick={() => run(() => bulkPromoteSkillAction({ skill }), "Promoted.")} disabled={pending}>
            <CheckCheck className="mr-1.5 h-4 w-4" /> Promote all in review → live
          </Button>
        )}
      </div>
      <ul className="mt-3 space-y-1.5">
        {mine.map((p) => <PromptRow key={p.id} prompt={p} />)}
      </ul>
    </div>
  );
}

export function FluentBankConsole({ cells, prompts }: { cells: FluentCell[]; prompts: FluentPrompt[] }) {
  const hasItems = cells.some((c) => c.items.length > 0);
  const hasPrompts = prompts.length > 0;
  if (!hasItems && !hasPrompts) {
    return <p className="text-sm text-muted-foreground">No curated items yet. Seed the Fluent bank, then review + promote items to live here.</p>;
  }
  return (
    <div className="space-y-6">
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Receptive (auto-scored MCQ) · CEFR ramp</h3>
        <div className="grid gap-3 md:grid-cols-2">
          <SkillCard skill="reading" cells={cells} />
          <SkillCard skill="listening" cells={cells} />
        </div>
      </div>
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Productive (AI-scored open task) · prompt rotation</h3>
        <div className="grid gap-3 md:grid-cols-2">
          <PromptCard skill="writing" prompts={prompts} />
          <PromptCard skill="speaking" prompts={prompts} />
        </div>
      </div>
    </div>
  );
}
