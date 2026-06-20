"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Save, X } from "lucide-react";
import type { ReviewBlock } from "@/lib/technical-sandbox/service";
import { updateBlockContentAction, type BlockContentFormInput } from "../actions";

type FormState = BlockContentFormInput;

function pretty(value: unknown, fallback: string): string {
  try {
    return JSON.stringify(value ?? JSON.parse(fallback), null, 2);
  } catch {
    return fallback;
  }
}

/**
 * Inline editor for a sandbox task's content - prompt, instructions, the master
 * answer (master_solution) / expected output, the grid/sql config, and the
 * scoring checkpoints. Sits under a block row on the review page; the save
 * action is admin-gated and validates the JSON before writing.
 */
export function BlockContentEditor({ block, onDone }: { block: ReviewBlock; onDone: () => void }) {
  const [pending, start] = useTransition();
  const [form, setForm] = useState<FormState>({
    nameEn: block.nameEn ?? "",
    nameAr: block.nameAr ?? "",
    descriptionEn: block.descriptionEn ?? "",
    descriptionAr: block.descriptionAr ?? "",
    frameworkRef: block.frameworkRef ?? "",
    promptEn: block.promptEn ?? "",
    promptAr: block.promptAr ?? "",
    instructionsEn: block.instructionsEn ?? "",
    instructionsAr: block.instructionsAr ?? "",
    timeLimitSeconds: block.timeLimitSeconds ?? 1200,
    engineConfigJson: pretty(block.engineConfig, "{}"),
    masterSolutionJson: pretty(block.masterSolution, "{}"),
    checkpointsJson: pretty(block.checkpoints, "[]"),
  });

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const save = () => {
    if (!form.nameEn.trim()) {
      toast.error("Name (EN) is required");
      return;
    }
    // Fast client-side JSON check so the admin gets feedback before the round-trip.
    for (const [label, raw] of [
      ["Engine config", form.engineConfigJson],
      ["Master answer", form.masterSolutionJson],
      ["Checkpoints", form.checkpointsJson],
    ] as const) {
      const t = raw.trim();
      if (t !== "") {
        try {
          JSON.parse(t);
        } catch {
          toast.error(`${label}: invalid JSON`);
          return;
        }
      }
    }
    start(async () => {
      const res = await updateBlockContentAction(block.id, {
        ...form,
        timeLimitSeconds: Number(form.timeLimitSeconds) || 1200,
      });
      if (res.ok) {
        toast.success("Task content saved");
        onDone();
      } else {
        toast.error(res.error ?? "Save failed");
      }
    });
  };

  const inputCls =
    "w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
  const labelCls = "mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground";

  return (
    <div className="mt-3 rounded-md border border-[#5391D5]/40 bg-[#5391D5]/[0.04] p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={labelCls}>Task name (EN)</label>
          <input className={inputCls} value={form.nameEn} onChange={(e) => set("nameEn", e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Task name (AR)</label>
          <input className={inputCls} dir="rtl" value={form.nameAr} onChange={(e) => set("nameAr", e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Framework reference</label>
          <input className={inputCls} value={form.frameworkRef} onChange={(e) => set("frameworkRef", e.target.value)} placeholder="e.g. IFRS 9" />
        </div>
        <div>
          <label className={labelCls}>Time limit (seconds)</label>
          <input
            className={inputCls}
            type="number"
            min={30}
            max={36000}
            value={form.timeLimitSeconds}
            onChange={(e) => set("timeLimitSeconds", Number(e.target.value))}
          />
        </div>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <label className={labelCls}>Prompt (EN)</label>
          <textarea className={`${inputCls} min-h-[80px] resize-y`} value={form.promptEn} onChange={(e) => set("promptEn", e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Prompt (AR)</label>
          <textarea className={`${inputCls} min-h-[80px] resize-y`} dir="rtl" value={form.promptAr} onChange={(e) => set("promptAr", e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Instructions (EN)</label>
          <textarea className={`${inputCls} min-h-[64px] resize-y`} value={form.instructionsEn} onChange={(e) => set("instructionsEn", e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Instructions (AR)</label>
          <textarea className={`${inputCls} min-h-[64px] resize-y`} dir="rtl" value={form.instructionsAr} onChange={(e) => set("instructionsAr", e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Description (EN)</label>
          <textarea className={`${inputCls} min-h-[56px] resize-y`} value={form.descriptionEn} onChange={(e) => set("descriptionEn", e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Description (AR)</label>
          <textarea className={`${inputCls} min-h-[56px] resize-y`} dir="rtl" value={form.descriptionAr} onChange={(e) => set("descriptionAr", e.target.value)} />
        </div>
      </div>

      <div className="mt-3 space-y-3">
        <div>
          <label className={labelCls}>Master answer / expected output (JSON · master_solution)</label>
          <textarea
            className={`${inputCls} min-h-[120px] resize-y font-mono text-xs`}
            spellCheck={false}
            value={form.masterSolutionJson}
            onChange={(e) => set("masterSolutionJson", e.target.value)}
          />
          <p className="mt-1 text-[10px] text-muted-foreground">Expected cell values, logic-input values, or the SQL master query - graded against the checkpoints below.</p>
        </div>
        <div>
          <label className={labelCls}>Scoring checkpoints (JSON array · checkpoints)</label>
          <textarea
            className={`${inputCls} min-h-[100px] resize-y font-mono text-xs`}
            spellCheck={false}
            value={form.checkpointsJson}
            onChange={(e) => set("checkpointsJson", e.target.value)}
          />
        </div>
        <div>
          <label className={labelCls}>Engine config (JSON · engine_config)</label>
          <textarea
            className={`${inputCls} min-h-[100px] resize-y font-mono text-xs`}
            spellCheck={false}
            value={form.engineConfigJson}
            onChange={(e) => set("engineConfigJson", e.target.value)}
          />
          <p className="mt-1 text-[10px] text-muted-foreground">Grid seed, logic-input fields, or the SQL schema/dataset the candidate works in.</p>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-md bg-[#010131] px-3.5 py-1.5 text-sm font-medium text-white hover:bg-[#121140] disabled:opacity-50"
        >
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          {pending ? "Saving..." : "Save content"}
        </button>
        <button
          type="button"
          onClick={onDone}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted disabled:opacity-50"
        >
          <X className="h-3.5 w-3.5" /> Cancel
        </button>
      </div>
    </div>
  );
}
