"use client";

// Psychometrics Tier-2 SME console. Per instrument → per scale: readiness (tier
// gate, approved count, Cronbach's α, norm n), AI-draft into the bank, manual
// authoring, and the review lifecycle (approve / retire / edit / delete). The
// bank starts empty (Tier 1 runs from code); this is where it gets built.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Sparkles, Plus, Check, Archive, Trash2, Pencil, X, RotateCcw,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PSY_TIER } from "@/lib/psychometrics/calibration";
import type { PsyBankView, InstrumentReadiness, ScaleReadiness, BankItem, PsyKind } from "@/lib/psychometrics/bank";
import {
  draftItemsIntoBankAction, setItemStatusAction, addItemAction, updateItemAction, deleteItemAction,
  computePilotNormsAction, clearNormsAction, seedIpip50IntoBankAction,
} from "../actions";

type Res = { ok: true; message?: string } | { ok: false; error: string };

const inputCls =
  "w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40";

function TierBadge({ tier }: { tier: "indicative" | "calibrated" }) {
  return tier === "calibrated" ? (
    <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white">Tier 2 · Calibrated</Badge>
  ) : (
    <Badge variant="outline" className="border-slate-300 text-slate-600">Tier 1 · Indicative</Badge>
  );
}

function GateChip({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
        ok ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200" : "bg-slate-50 text-slate-500 ring-1 ring-slate-200"
      }`}
    >
      {ok ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
      {label}
    </span>
  );
}

function StatusBadge({ status }: { status: BankItem["status"] }) {
  const map: Record<BankItem["status"], string> = {
    approved: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    in_review: "bg-amber-50 text-amber-700 ring-amber-200",
    draft: "bg-sky-50 text-sky-700 ring-sky-200",
    retired: "bg-slate-100 text-slate-500 ring-slate-200",
  };
  return <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ${map[status]}`}>{status.replace("_", " ")}</span>;
}

/** Shared action runner: pending flag + toast + refresh. */
function useRunner() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<Res>, okMsg?: string) =>
    start(async () => {
      const res = await fn();
      if (res.ok) {
        toast.success(res.message ?? okMsg ?? "Done");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  return { pending, run };
}

// ── Manual authoring form ─────────────────────────────────────────
function AddItemForm({ kind, scaleKey, onClose }: { kind: PsyKind; scaleKey: string; onClose: () => void }) {
  const { pending, run } = useRunner();
  const [stemEn, setStemEn] = useState("");
  const [stemAr, setStemAr] = useState("");
  const [optEn, setOptEn] = useState("");
  const [optAr, setOptAr] = useState("");
  const [correct, setCorrect] = useState(0);
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [reverse, setReverse] = useState(false);
  const isCog = kind === "cognitive";

  const submit = () =>
    run(async () => {
      const res = await addItemAction({
        kind, scaleKey, stem_en: stemEn, stem_ar: stemAr,
        options_en: isCog ? optEn.split("\n").map((s) => s.trim()).filter(Boolean) : undefined,
        options_ar: isCog ? optAr.split("\n").map((s) => s.trim()).filter(Boolean) : undefined,
        correct_index: isCog ? correct : null,
        reverse_keyed: !isCog ? reverse : false,
        difficulty: isCog ? difficulty : null,
      });
      if (res.ok) onClose();
      return res;
    }, "Item added.");

  return (
    <div className="rounded-md border border-slate-200 bg-slate-50/60 p-3 space-y-2">
      <div className="grid gap-2 sm:grid-cols-2">
        <textarea className={inputCls} rows={2} placeholder="Stem (English)" value={stemEn} onChange={(e) => setStemEn(e.target.value)} />
        <textarea className={inputCls} dir="rtl" rows={2} placeholder="النص (بالعربية)" value={stemAr} onChange={(e) => setStemAr(e.target.value)} />
      </div>
      {isCog ? (
        <>
          <div className="grid gap-2 sm:grid-cols-2">
            <textarea className={inputCls} rows={3} placeholder="Options (one per line)" value={optEn} onChange={(e) => setOptEn(e.target.value)} />
            <textarea className={inputCls} dir="rtl" rows={3} placeholder="الخيارات (سطر لكل خيار)" value={optAr} onChange={(e) => setOptAr(e.target.value)} />
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <label className="flex items-center gap-1.5">
              <span className="text-slate-600">Correct line #</span>
              <input type="number" min={1} className="w-16 rounded-md border border-slate-300 px-2 py-1" value={correct + 1} onChange={(e) => setCorrect(Math.max(0, (parseInt(e.target.value, 10) || 1) - 1))} />
            </label>
            <label className="flex items-center gap-1.5">
              <span className="text-slate-600">Difficulty</span>
              <select className="rounded-md border border-slate-300 px-2 py-1" value={difficulty} onChange={(e) => setDifficulty(e.target.value as "easy" | "medium" | "hard")}>
                <option value="easy">easy</option>
                <option value="medium">medium</option>
                <option value="hard">hard</option>
              </select>
            </label>
          </div>
        </>
      ) : (
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={reverse} onChange={(e) => setReverse(e.target.checked)} />
          Reverse-keyed (disagreement = more of the trait)
        </label>
      )}
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={submit} disabled={pending || !stemEn.trim()}>
          {pending ? "Saving…" : "Add to bank"}
        </Button>
        <Button size="sm" variant="ghost" onClick={onClose} disabled={pending}>Cancel</Button>
      </div>
    </div>
  );
}

// ── One item row ──────────────────────────────────────────────────
function ItemRow({ item }: { item: BankItem }) {
  const { pending, run } = useRunner();
  const [editing, setEditing] = useState(false);
  const [stemEn, setStemEn] = useState(item.stem_en);
  const [stemAr, setStemAr] = useState(item.stem_ar ?? "");
  const [correct, setCorrect] = useState(item.correct_index ?? 0);
  const [reverse, setReverse] = useState(item.reverse_keyed);

  const saveEdit = () =>
    run(async () => {
      const res = await updateItemAction({
        itemId: item.id, stem_en: stemEn, stem_ar: stemAr,
        correct_index: item.kind === "mcq" ? correct : null,
        reverse_keyed: item.kind === "likert" ? reverse : undefined,
      });
      if (res.ok) setEditing(false);
      return res;
    }, "Item updated.");

  return (
    <li className="rounded-md border border-slate-200 bg-white p-2.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <StatusBadge status={item.status} />
            {item.difficulty && <span className="text-[10px] uppercase text-slate-400">{item.difficulty}</span>}
            {item.kind === "likert" && item.reverse_keyed && <span className="text-[10px] uppercase text-violet-500">reverse</span>}
            <span className="text-[10px] text-slate-400">{item.source}</span>
          </div>
          {editing ? (
            <div className="mt-1.5 space-y-1.5">
              <textarea className={inputCls} rows={2} value={stemEn} onChange={(e) => setStemEn(e.target.value)} />
              <textarea className={inputCls} dir="rtl" rows={2} value={stemAr} onChange={(e) => setStemAr(e.target.value)} />
              {item.kind === "mcq" && item.options_en && (
                <label className="flex items-center gap-1.5 text-sm">
                  <span className="text-slate-600">Correct option</span>
                  <select className="rounded-md border border-slate-300 px-2 py-1" value={correct} onChange={(e) => setCorrect(parseInt(e.target.value, 10))}>
                    {item.options_en.map((o, i) => (
                      <option key={i} value={i}>{i + 1}. {o.slice(0, 40)}</option>
                    ))}
                  </select>
                </label>
              )}
              {item.kind === "likert" && (
                <label className="flex items-center gap-2 text-sm text-slate-600">
                  <input type="checkbox" checked={reverse} onChange={(e) => setReverse(e.target.checked)} /> Reverse-keyed
                </label>
              )}
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={saveEdit} disabled={pending}>Save</Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing(false)} disabled={pending}>Cancel</Button>
              </div>
            </div>
          ) : (
            <>
              <p className="mt-1 text-sm text-slate-800">{item.stem_en}</p>
              {item.stem_ar && <p className="text-sm text-slate-400" dir="rtl">{item.stem_ar}</p>}
              {item.kind === "mcq" && item.options_en && (
                <ul className="mt-1 space-y-0.5">
                  {item.options_en.map((o, i) => (
                    <li key={i} className={`text-xs ${i === item.correct_index ? "font-semibold text-emerald-700" : "text-slate-500"}`}>
                      {i === item.correct_index ? "✓ " : "· "}{o}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
        {!editing && (
          <div className="flex shrink-0 flex-col items-end gap-1">
            <div className="flex items-center gap-1">
              {item.status !== "approved" && (
                <Button size="sm" variant="ghost" className="h-7 px-2 text-emerald-700" title="Approve" onClick={() => run(() => setItemStatusAction({ itemId: item.id, status: "approved" }), "Approved.")} disabled={pending}>
                  <Check className="h-4 w-4" />
                </Button>
              )}
              {item.status !== "retired" ? (
                <Button size="sm" variant="ghost" className="h-7 px-2 text-slate-500" title="Retire" onClick={() => run(() => setItemStatusAction({ itemId: item.id, status: "retired" }), "Retired.")} disabled={pending}>
                  <Archive className="h-4 w-4" />
                </Button>
              ) : (
                <Button size="sm" variant="ghost" className="h-7 px-2 text-sky-600" title="Restore to draft" onClick={() => run(() => setItemStatusAction({ itemId: item.id, status: "draft" }), "Restored.")} disabled={pending}>
                  <RotateCcw className="h-4 w-4" />
                </Button>
              )}
              <Button size="sm" variant="ghost" className="h-7 px-2 text-slate-500" title="Edit" onClick={() => setEditing(true)} disabled={pending}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="ghost" className="h-7 px-2 text-rose-500" title="Delete" onClick={() => run(() => deleteItemAction({ itemId: item.id }), "Deleted.")} disabled={pending}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </li>
  );
}

// ── One scale card ────────────────────────────────────────────────
function ScaleCard({ scale }: { scale: ScaleReadiness }) {
  const { pending, run } = useRunner();
  const [count, setCount] = useState(6);
  const [adding, setAdding] = useState(false);
  const [showRetired, setShowRetired] = useState(false);

  const draft = () =>
    run(() => draftItemsIntoBankAction({ kind: scale.instrumentKind, scaleKey: scale.scaleKey, scaleNameEn: scale.nameEn, count }), "Drafted for review.");

  const visible = scale.items.filter((i) => showRetired || i.status !== "retired");

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-semibold text-dark">{scale.nameEn}</p>
          <p className="text-xs text-slate-400" dir="rtl">{scale.nameAr}</p>
        </div>
        <TierBadge tier={scale.tier} />
      </div>

      {/* Readiness */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
        <span><strong className="text-dark">{scale.approved}</strong> approved</span>
        <span>· {scale.counts.draft} draft</span>
        <span>· {scale.counts.in_review} in review</span>
        <span>· α {scale.alpha == null ? "—" : scale.alpha.toFixed(2)}{scale.alphaN ? ` (n=${scale.alphaN})` : ""}</span>
        <span>· norm n {scale.normN}</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <GateChip ok={scale.approved >= PSY_TIER.minApprovedPerScale} label={`≥${PSY_TIER.minApprovedPerScale} approved`} />
        <GateChip ok={(scale.alpha ?? 0) >= PSY_TIER.minAlpha} label={`α ≥ ${PSY_TIER.minAlpha}`} />
        <GateChip ok={scale.normN >= PSY_TIER.minNormN} label={`norm n ≥ ${PSY_TIER.minNormN}`} />
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-2.5">
        <label className="flex items-center gap-1.5 text-sm text-slate-600">
          <input type="number" min={1} max={12} className="w-14 rounded-md border border-slate-300 px-2 py-1" value={count} onChange={(e) => setCount(Math.max(1, Math.min(12, parseInt(e.target.value, 10) || 1)))} />
        </label>
        <Button size="sm" variant="outline" onClick={draft} disabled={pending}>
          <Sparkles className="mr-1.5 h-4 w-4" /> {pending ? "Working…" : "AI-draft"}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setAdding((v) => !v)} disabled={pending}>
          <Plus className="mr-1 h-4 w-4" /> Add item
        </Button>
        {scale.counts.retired > 0 && (
          <button className="ml-auto text-xs text-slate-400 hover:text-slate-600" onClick={() => setShowRetired((v) => !v)}>
            {showRetired ? "Hide" : "Show"} {scale.counts.retired} retired
          </button>
        )}
      </div>

      {adding && <AddItemForm kind={scale.instrumentKind} scaleKey={scale.scaleKey} onClose={() => setAdding(false)} />}

      {visible.length > 0 && (
        <ul className="space-y-1.5">
          {visible.map((it) => <ItemRow key={it.id} item={it} />)}
        </ul>
      )}
      {scale.items.length === 0 && (
        <p className="text-xs text-slate-400">No bank items yet — AI-draft a batch or author them manually. Until a scale clears all three gates it stays Tier-1 indicative.</p>
      )}
    </div>
  );
}

// ── Norm group panel (per instrument) ─────────────────────────────
function NormPanel({ kind, scales }: { kind: PsyKind; scales: ScaleReadiness[] }) {
  const { pending, run } = useRunner();
  const ns = scales.map((s) => s.normN);
  const minN = ns.length ? Math.min(...ns) : 0;
  const maxN = ns.length ? Math.max(...ns) : 0;
  const hasNorms = maxN > 0;
  const fullyNormed = ns.every((n) => n >= PSY_TIER.minNormN);

  return (
    <div className="rounded-md border border-indigo-100 bg-indigo-50/40 p-3 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm">
          <span className="font-semibold text-dark">Norm group</span>{" "}
          <span className="text-slate-500">
            {hasNorms ? `n = ${minN}${minN !== maxN ? `–${maxN}` : ""} per scale` : "none loaded"}
            {hasNorms && !fullyNormed && ` · below the ${PSY_TIER.minNormN} threshold (still indicative)`}
            {hasNorms && fullyNormed && " · norm-referencing active"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => run(() => computePilotNormsAction({ kind }), "Pilot norms computed.")} disabled={pending}>
            {pending ? "Working…" : "Compute pilot norms"}
          </Button>
          {hasNorms && (
            <Button size="sm" variant="ghost" className="text-slate-500" onClick={() => run(() => clearNormsAction({ kind }), "Cleared.")} disabled={pending}>
              Clear
            </Button>
          )}
        </div>
      </div>
      <p className="text-[11px] leading-snug text-slate-500">
        Pilot norms are computed from the distribution of collected results and are <strong>provisional</strong>.
        A scale only becomes norm-referenced once its sample reaches n ≥ {PSY_TIER.minNormN}; validated norms still
        require a representative sample and a psychometrician&apos;s sign-off.
      </p>
    </div>
  );
}

// ── IPIP-50 seed banner (personality only) ────────────────────────
function Ipip50Banner({ seeded }: { seeded: boolean }) {
  const { pending, run } = useRunner();
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-violet-100 bg-violet-50/50 p-3">
      <div className="text-sm">
        <span className="font-semibold text-dark">IPIP-50 · longer validated form</span>{" "}
        <span className="text-slate-500">
          {seeded
            ? "· seeded into the bank (10 items × 5 traits, approved)"
            : "· public-domain Big-Five markers, 10 items/trait — higher reliability than the 20-item short form"}
        </span>
      </div>
      {seeded ? (
        <span className="inline-flex items-center gap-1 text-xs text-violet-600"><Check className="h-3.5 w-3.5" /> Seeded</span>
      ) : (
        <Button size="sm" variant="outline" onClick={() => run(() => seedIpip50IntoBankAction(), "IPIP-50 seeded.")} disabled={pending}>
          {pending ? "Seeding…" : "Seed IPIP-50 into bank"}
        </Button>
      )}
    </div>
  );
}

function InstrumentSection({ inst }: { inst: InstrumentReadiness }) {
  const ipip50Seeded = inst.kind === "personality" && inst.scales.some((s) => s.items.some((it) => it.source === "ipip50"));
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle className="text-lg">{inst.nameEn}</CardTitle>
        <TierBadge tier={inst.tier} />
      </CardHeader>
      <CardContent className="space-y-3">
        {inst.kind === "personality" && <Ipip50Banner seeded={ipip50Seeded} />}
        <NormPanel kind={inst.kind} scales={inst.scales} />
        <div className="grid gap-3 lg:grid-cols-2">
          {inst.scales.map((s) => <ScaleCard key={s.scaleKey} scale={s} />)}
        </div>
      </CardContent>
    </Card>
  );
}

export function BankConsole({ view }: { view: PsyBankView }) {
  return (
    <div className="space-y-6">
      {view.instruments.map((inst) => <InstrumentSection key={inst.code} inst={inst} />)}
    </div>
  );
}
