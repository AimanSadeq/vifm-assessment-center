"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Save, X, Plus, Trash2 } from "lucide-react";
import type { ReviewBlock } from "@/lib/technical-sandbox/service";
import type { CheckpointKind } from "@/lib/technical-sandbox/types";
import { updateBlockContentAction } from "../actions";

// ── Structured scoring editor ───────────────────────────────────────
// Edits the master answer (master_solution) + scoring checkpoints with typed
// fields instead of raw JSON, so a malformed checkpoint can't reach the scorer.
// Engine-specific: spreadsheet/advanced -> cell map, logic_input -> field map,
// sql -> master query. Non-standard shapes (e.g. python) fall back to raw JSON.

const CHECKPOINT_KINDS: { value: CheckpointKind; label: string }[] = [
  { value: "cell_value", label: "Cell value" },
  { value: "is_array_formula", label: "Is array formula" },
  { value: "logic_value", label: "Logic-input value" },
  { value: "sql_result_match", label: "SQL result match" },
];
const KNOWN_KINDS = new Set<string>(CHECKPOINT_KINDS.map((k) => k.value));

type KvRow = { key: string; value: string };
type CpRow = {
  id: string;
  kind: CheckpointKind;
  label_en: string;
  label_ar: string;
  weight: string;
  target: string;
  field: string;
  expected: string;
  tolerance: string;
  ordered: boolean;
};
type MasterMode = "cells" | "fields" | "sql" | "raw";

const genId = () => `cp_${Math.random().toString(36).slice(2, 8)}`;
const isObj = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const isNum = (s: string) => s.trim() !== "" && Number.isFinite(Number(s));

function deriveMaster(block: ReviewBlock): {
  mode: MasterMode; cells: KvRow[]; fields: KvRow[]; query: string; raw: string;
} {
  const e = block.engineType;
  const ms = isObj(block.masterSolution) ? block.masterSolution : {};
  const toKv = (rec: unknown): KvRow[] =>
    isObj(rec) ? Object.entries(rec).map(([key, value]) => ({ key, value: String(value) })) : [];
  if ((e === "spreadsheet" || e === "advanced_spreadsheet") && isObj(ms.cells)) {
    return { mode: "cells", cells: toKv(ms.cells), fields: [], query: "", raw: "" };
  }
  if (e === "logic_input" && isObj(ms.fields)) {
    return { mode: "fields", cells: [], fields: toKv(ms.fields), query: "", raw: "" };
  }
  if (e === "sql") {
    return { mode: "sql", cells: [], fields: [], query: String(ms.master_query ?? ""), raw: "" };
  }
  return { mode: "raw", cells: [], fields: [], query: "", raw: JSON.stringify(block.masterSolution ?? {}, null, 2) };
}

function deriveCheckpoints(block: ReviewBlock): { mode: "structured" | "raw"; rows: CpRow[]; raw: string } {
  const arr = Array.isArray(block.checkpoints) ? (block.checkpoints as Record<string, unknown>[]) : [];
  const allKnown = arr.every((c) => isObj(c) && KNOWN_KINDS.has(String(c.kind)));
  if (!allKnown) return { mode: "raw", rows: [], raw: JSON.stringify(block.checkpoints ?? [], null, 2) };
  const rows: CpRow[] = arr.map((c) => ({
    id: String(c.id ?? genId()),
    kind: (c.kind as CheckpointKind) ?? "cell_value",
    label_en: String(c.label_en ?? ""),
    label_ar: String(c.label_ar ?? ""),
    weight: String(c.weight ?? 1),
    target: String(c.target ?? ""),
    field: String(c.field ?? ""),
    expected: c.expected != null ? String(c.expected) : "",
    tolerance: c.tolerance != null ? String(c.tolerance) : "",
    ordered: !!c.ordered,
  }));
  return { mode: "structured", rows, raw: "" };
}

const inputCls =
  "w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const smallCls =
  "rounded-md border border-input bg-background px-2 py-1 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";
const labelCls = "mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground";

export function BlockContentEditor({ block, onDone }: { block: ReviewBlock; onDone: () => void }) {
  const [pending, start] = useTransition();

  const [text, setText] = useState({
    nameEn: block.nameEn ?? "",
    nameAr: block.nameAr ?? "",
    descriptionEn: block.descriptionEn ?? "",
    descriptionAr: block.descriptionAr ?? "",
    frameworkRef: block.frameworkRef ?? "",
    promptEn: block.promptEn ?? "",
    promptAr: block.promptAr ?? "",
    instructionsEn: block.instructionsEn ?? "",
    instructionsAr: block.instructionsAr ?? "",
    timeLimitSeconds: String(block.timeLimitSeconds ?? 1200),
  });
  const setT = <K extends keyof typeof text>(k: K, v: string) => setText((f) => ({ ...f, [k]: v }));
  const [engineConfigJson, setEngineConfigJson] = useState(JSON.stringify(block.engineConfig ?? {}, null, 2));

  const [master, setMaster] = useState(() => deriveMaster(block));
  const [cp, setCp] = useState(() => deriveCheckpoints(block));

  const kvLabel = master.mode === "fields" ? "Field" : "Cell ref";
  const patchMaster = (p: Partial<typeof master>) => setMaster((m) => ({ ...m, ...p }));
  const kvList = () => (master.mode === "fields" ? master.fields : master.cells);
  const setKv = (rows: KvRow[]) =>
    master.mode === "fields" ? patchMaster({ fields: rows }) : patchMaster({ cells: rows });

  const setCpRow = (i: number, p: Partial<CpRow>) =>
    setCp((s) => ({ ...s, rows: s.rows.map((r, idx) => (idx === i ? { ...r, ...p } : r)) }));

  // ── Serialise + validate ────────────────────────────────────────
  function buildMasterJson(): { ok: true; json: string } | { ok: false; error: string } {
    if (master.mode === "cells" || master.mode === "fields") {
      const out: Record<string, number> = {};
      for (const r of kvList()) {
        const key = r.key.trim();
        if (key === "") continue;
        if (!isNum(r.value)) return { ok: false, error: `Master answer: "${key}" needs a numeric expected value` };
        out[key] = Number(r.value);
      }
      return { ok: true, json: JSON.stringify(master.mode === "fields" ? { fields: out } : { cells: out }) };
    }
    if (master.mode === "sql") return { ok: true, json: JSON.stringify({ master_query: master.query }) };
    try {
      JSON.parse(master.raw || "{}");
    } catch {
      return { ok: false, error: "Master answer: invalid JSON" };
    }
    return { ok: true, json: master.raw || "{}" };
  }

  function buildCheckpointsJson(): { ok: true; json: string } | { ok: false; error: string } {
    if (cp.mode === "raw") {
      try {
        JSON.parse(cp.raw || "[]");
      } catch {
        return { ok: false, error: "Checkpoints: invalid JSON" };
      }
      return { ok: true, json: cp.raw || "[]" };
    }
    const seen = new Set<string>();
    const arr: Record<string, unknown>[] = [];
    for (const r of cp.rows) {
      const id = r.id.trim() || genId();
      if (seen.has(id)) return { ok: false, error: `Duplicate checkpoint id "${id}"` };
      seen.add(id);
      if (!isNum(r.weight) || Number(r.weight) <= 0) return { ok: false, error: `Checkpoint "${id}": weight must be a positive number` };
      const base: Record<string, unknown> = { id, kind: r.kind, weight: Number(r.weight) };
      if (r.label_en.trim()) base.label_en = r.label_en.trim();
      if (r.label_ar.trim()) base.label_ar = r.label_ar.trim();
      if (r.kind === "cell_value" || r.kind === "logic_value") {
        const ref = r.kind === "cell_value" ? r.target.trim() : r.field.trim();
        if (ref === "") return { ok: false, error: `Checkpoint "${id}": ${r.kind === "cell_value" ? "target cell" : "field"} is required` };
        if (!isNum(r.expected)) return { ok: false, error: `Checkpoint "${id}": expected must be a number` };
        if (r.kind === "cell_value") base.target = ref;
        else base.field = ref;
        base.expected = Number(r.expected);
        if (r.tolerance.trim() !== "") {
          if (!isNum(r.tolerance)) return { ok: false, error: `Checkpoint "${id}": tolerance must be a number` };
          base.tolerance = Number(r.tolerance);
        }
      } else if (r.kind === "is_array_formula") {
        if (r.target.trim() === "") return { ok: false, error: `Checkpoint "${id}": target cell/range is required` };
        base.target = r.target.trim();
      } else if (r.kind === "sql_result_match") {
        if (r.ordered) base.ordered = true;
      }
      arr.push(base);
    }
    return { ok: true, json: JSON.stringify(arr) };
  }

  const save = () => {
    if (!text.nameEn.trim()) {
      toast.error("Name (EN) is required");
      return;
    }
    const ms = buildMasterJson();
    if (!ms.ok) return toast.error(ms.error);
    const cps = buildCheckpointsJson();
    if (!cps.ok) return toast.error(cps.error);
    if (engineConfigJson.trim() !== "") {
      try {
        JSON.parse(engineConfigJson);
      } catch {
        return toast.error("Engine config: invalid JSON");
      }
    }
    start(async () => {
      const res = await updateBlockContentAction(block.id, {
        ...text,
        timeLimitSeconds: Number(text.timeLimitSeconds) || 1200,
        engineConfigJson,
        masterSolutionJson: ms.json,
        checkpointsJson: cps.json,
      });
      if (res.ok) {
        toast.success("Task content saved");
        onDone();
      } else {
        toast.error(res.error ?? "Save failed");
      }
    });
  };

  return (
    <div className="mt-3 rounded-md border border-[#5391D5]/40 bg-[#5391D5]/[0.04] p-4">
      {/* Text content */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={labelCls}>Task name (EN)</label>
          <input className={inputCls} value={text.nameEn} onChange={(e) => setT("nameEn", e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Task name (AR)</label>
          <input className={inputCls} dir="rtl" value={text.nameAr} onChange={(e) => setT("nameAr", e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Framework reference</label>
          <input className={inputCls} value={text.frameworkRef} onChange={(e) => setT("frameworkRef", e.target.value)} placeholder="e.g. IFRS 9" />
        </div>
        <div>
          <label className={labelCls}>Time limit (seconds)</label>
          <input className={inputCls} type="number" min={30} max={36000} value={text.timeLimitSeconds} onChange={(e) => setT("timeLimitSeconds", e.target.value)} />
        </div>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <label className={labelCls}>Prompt (EN)</label>
          <textarea className={`${inputCls} min-h-[80px] resize-y`} value={text.promptEn} onChange={(e) => setT("promptEn", e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Prompt (AR)</label>
          <textarea className={`${inputCls} min-h-[80px] resize-y`} dir="rtl" value={text.promptAr} onChange={(e) => setT("promptAr", e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Instructions (EN)</label>
          <textarea className={`${inputCls} min-h-[64px] resize-y`} value={text.instructionsEn} onChange={(e) => setT("instructionsEn", e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Instructions (AR)</label>
          <textarea className={`${inputCls} min-h-[64px] resize-y`} dir="rtl" value={text.instructionsAr} onChange={(e) => setT("instructionsAr", e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Description (EN)</label>
          <textarea className={`${inputCls} min-h-[56px] resize-y`} value={text.descriptionEn} onChange={(e) => setT("descriptionEn", e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Description (AR)</label>
          <textarea className={`${inputCls} min-h-[56px] resize-y`} dir="rtl" value={text.descriptionAr} onChange={(e) => setT("descriptionAr", e.target.value)} />
        </div>
      </div>

      {/* ── Master answer (structured per engine) ── */}
      <div className="mt-4 rounded-md border bg-card p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wide text-[#010131]">
            Master answer / expected output
          </span>
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">{block.engineType}</span>
        </div>

        {(master.mode === "cells" || master.mode === "fields") && (
          <div className="space-y-2">
            <div className="hidden grid-cols-[1fr_1fr_auto] gap-2 px-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground sm:grid">
              <span>{kvLabel}</span>
              <span>Expected value</span>
              <span />
            </div>
            {kvList().map((r, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                <input
                  className={smallCls}
                  value={r.key}
                  placeholder={master.mode === "fields" ? "field_id" : "B12"}
                  onChange={(e) => setKv(kvList().map((x, idx) => (idx === i ? { ...x, key: e.target.value } : x)))}
                />
                <input
                  className={smallCls}
                  type="number"
                  step="any"
                  value={r.value}
                  onChange={(e) => setKv(kvList().map((x, idx) => (idx === i ? { ...x, value: e.target.value } : x)))}
                />
                <button
                  type="button"
                  onClick={() => setKv(kvList().filter((_, idx) => idx !== i))}
                  className="inline-flex items-center justify-center rounded-md border px-2 text-muted-foreground hover:bg-muted hover:text-destructive"
                  aria-label="Remove"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setKv([...kvList(), { key: "", value: "" }])}
              className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs hover:bg-muted"
            >
              <Plus className="h-3 w-3" /> Add {master.mode === "fields" ? "field" : "cell"}
            </button>
          </div>
        )}

        {master.mode === "sql" && (
          <div>
            <label className={labelCls}>Master query (SQL)</label>
            <textarea
              className={`${inputCls} min-h-[120px] resize-y font-mono text-xs`}
              spellCheck={false}
              value={master.query}
              onChange={(e) => patchMaster({ query: e.target.value })}
            />
          </div>
        )}

        {master.mode === "raw" && (
          <div>
            <p className="mb-1 text-[11px] text-amber-700">Non-standard master shape for this engine - edit as JSON.</p>
            <textarea
              className={`${inputCls} min-h-[100px] resize-y font-mono text-xs`}
              spellCheck={false}
              value={master.raw}
              onChange={(e) => patchMaster({ raw: e.target.value })}
            />
          </div>
        )}
      </div>

      {/* ── Scoring checkpoints (structured) ── */}
      <div className="mt-3 rounded-md border bg-card p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wide text-[#010131]">Scoring checkpoints</span>
          {cp.mode === "structured" && (
            <span className="text-[10px] text-muted-foreground">{cp.rows.length} check{cp.rows.length === 1 ? "" : "s"} · weighted</span>
          )}
        </div>

        {cp.mode === "raw" ? (
          <div>
            <p className="mb-1 text-[11px] text-amber-700">Contains a non-standard checkpoint kind - edit as JSON.</p>
            <textarea
              className={`${inputCls} min-h-[100px] resize-y font-mono text-xs`}
              spellCheck={false}
              value={cp.raw}
              onChange={(e) => setCp((s) => ({ ...s, raw: e.target.value }))}
            />
          </div>
        ) : (
          <div className="space-y-2">
            {cp.rows.map((r, i) => (
              <div key={r.id} className="rounded-md border bg-background p-2.5">
                <div className="flex flex-wrap items-end gap-2">
                  <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Kind
                    <select
                      className={`${smallCls} mt-0.5 block`}
                      value={r.kind}
                      onChange={(e) => setCpRow(i, { kind: e.target.value as CheckpointKind })}
                    >
                      {CHECKPOINT_KINDS.map((k) => (
                        <option key={k.value} value={k.value}>{k.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="flex-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Label
                    <input className={`${smallCls} mt-0.5 block w-full`} value={r.label_en} onChange={(e) => setCpRow(i, { label_en: e.target.value })} />
                  </label>
                  <label className="w-16 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Weight
                    <input className={`${smallCls} mt-0.5 block w-full`} type="number" step="any" min={0} value={r.weight} onChange={(e) => setCpRow(i, { weight: e.target.value })} />
                  </label>
                  <button
                    type="button"
                    onClick={() => setCp((s) => ({ ...s, rows: s.rows.filter((_, idx) => idx !== i) }))}
                    className="inline-flex h-7 items-center justify-center rounded-md border px-2 text-muted-foreground hover:bg-muted hover:text-destructive"
                    aria-label="Remove checkpoint"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="mt-2 flex flex-wrap items-end gap-2">
                  {(r.kind === "cell_value" || r.kind === "is_array_formula") && (
                    <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Target {r.kind === "is_array_formula" ? "cell/range" : "cell"}
                      <input className={`${smallCls} mt-0.5 block w-28`} value={r.target} placeholder={r.kind === "is_array_formula" ? "C9:E11" : "B12"} onChange={(e) => setCpRow(i, { target: e.target.value })} />
                    </label>
                  )}
                  {r.kind === "logic_value" && (
                    <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Field
                      <input className={`${smallCls} mt-0.5 block w-28`} value={r.field} placeholder="field_id" onChange={(e) => setCpRow(i, { field: e.target.value })} />
                    </label>
                  )}
                  {(r.kind === "cell_value" || r.kind === "logic_value") && (
                    <>
                      <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Expected
                        <input className={`${smallCls} mt-0.5 block w-28`} type="number" step="any" value={r.expected} onChange={(e) => setCpRow(i, { expected: e.target.value })} />
                      </label>
                      <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Tolerance (±)
                        <input className={`${smallCls} mt-0.5 block w-24`} type="number" step="any" min={0} value={r.tolerance} placeholder="0" onChange={(e) => setCpRow(i, { tolerance: e.target.value })} />
                      </label>
                    </>
                  )}
                  {r.kind === "sql_result_match" && (
                    <label className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                      <input type="checkbox" className="h-3.5 w-3.5" checked={r.ordered} onChange={(e) => setCpRow(i, { ordered: e.target.checked })} />
                      Rows must match in order
                    </label>
                  )}
                  <span className="ms-auto self-center font-mono text-[10px] text-muted-foreground">{r.id}</span>
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={() =>
                setCp((s) => ({
                  ...s,
                  rows: [...s.rows, { id: genId(), kind: "cell_value", label_en: "", label_ar: "", weight: "1", target: "", field: "", expected: "", tolerance: "", ordered: false }],
                }))
              }
              className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs hover:bg-muted"
            >
              <Plus className="h-3 w-3" /> Add checkpoint
            </button>
          </div>
        )}
      </div>

      {/* ── Engine config (raw - the sandbox environment, not scored) ── */}
      <div className="mt-3">
        <label className={labelCls}>Engine config (JSON · the candidate&apos;s working environment)</label>
        <textarea
          className={`${inputCls} min-h-[100px] resize-y font-mono text-xs`}
          spellCheck={false}
          value={engineConfigJson}
          onChange={(e) => setEngineConfigJson(e.target.value)}
        />
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
