"use client";

import { Fragment, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Save, Plus, Trash2, Boxes, ClipboardList, Rocket, Info, FileText, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { RrVoucherPanel } from "@/components/shared/rr-voucher-panel";
import { CollapsibleCard } from "@/components/shared/collapsible-card";
import { BEHAVIORAL_COMPETENCIES } from "@/lib/scoring/behavioral-items";
import type { RoleReadinessConfig } from "@/lib/role-readiness/config";
import {
  updateRoleAction, setCompetenciesAction, addAreaAction, removeAreaAction,
  addItemAction, removeItemAction, publishRoleAction, unpublishRoleAction,
  matchCompetenciesFromJdAction, generateTechnicalItemsAction, issueRoleVouchersAction,
} from "../../actions";

// VIFM BARS 1-5 target scale - shown on hover next to the competency targets.
const TARGET_HELP =
  "Target proficiency on the VIFM BARS scale (1-5): 1 Significant Development Needed · 2 Development Needed · 3 Competent · 4 Strength · 5 Significant Strength. A candidate meets the competency when their Persona self-rating is at or above this target.";
// Total distinct framework "building blocks" (clusters) the competencies group into.
const TOTAL_BLOCKS = new Set(BEHAVIORAL_COMPETENCIES.map((c) => c.clusterNameEn)).size;
// Sort by clusterOrder so the grid's section headers are correct even if the
// (auto-generated) source array is ever reordered.
const SORTED_COMPETENCIES = [...BEHAVIORAL_COMPETENCIES].sort((a, b) => a.clusterOrder - b.clusterOrder);
const priorityToTarget = (p: "high" | "medium" | "low") => (p === "high" ? 4 : p === "medium" ? 3 : 3);

type JdRec = { competencyId: string; competencyName: string; priority: "high" | "medium" | "low"; reasoning: string };

export function RoleEditor({ config, published, clients, assignedOrgId }: { config: RoleReadinessConfig; published: boolean; clients: { id: string; name: string }[]; assignedOrgId: string | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [assignOrg, setAssignOrg] = useState("");
  const [personaPct, setPersonaPct] = useState(config.persona_pass_pct);
  const [techPct, setTechPct] = useState(config.technical_pass_pct);

  // competency selection: id -> target
  const [comps, setComps] = useState<Record<string, number>>(
    Object.fromEntries(config.competencies.map((c) => [c.competency_id, c.target_level])),
  );
  const toggleComp = (id: string) =>
    setComps((p) => {
      const n = { ...p };
      if (n[id] != null) delete n[id];
      else n[id] = 3;
      return n;
    });

  // JD matching: recommendations from the AI extractor (pre-selects competencies).
  const [matched, setMatched] = useState<JdRec[] | null>(null);
  const applyMatched = (recs: JdRec[]) => {
    setMatched(recs);
    setComps((prev) => {
      const n = { ...prev };
      for (const r of recs) n[r.competencyId] = priorityToTarget(r.priority);
      return n;
    });
  };
  // Distinct framework "building blocks" (clusters) the currently-selected competencies cover.
  const blocksCovered = new Set(
    BEHAVIORAL_COMPETENCIES.filter((c) => comps[c.acCompetencyId] != null).map((c) => c.clusterNameEn),
  ).size;

  const run = (fn: () => Promise<{ ok?: true; error?: string } | { error: string } | { ok: true }>, ok: string) =>
    start(async () => {
      const res = await fn();
      if (res && "error" in res && res.error) { toast.error(res.error); return; }
      toast.success(ok);
      router.refresh();
    });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="inline-flex items-center gap-2 text-2xl font-bold">
            <Boxes className="h-6 w-6 text-[#5391D5]" /> {config.name_en}
            {config.is_sample && <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">SAMPLE</span>}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {published ? "Published in Bespoke Services." : "Draft - publish to surface it in the Bespoke Services section."}
          </p>
        </div>
        {published ? (
          <Button variant="outline" disabled={pending} onClick={() => run(() => unpublishRoleAction({ roleId: config.id }), "Unpublished")}>
            Unpublish
          </Button>
        ) : (
          <div className="flex items-center gap-2">
            <select value={assignOrg} onChange={(e) => setAssignOrg(e.target.value)}
              className="rounded-md border border-border bg-background px-2 py-2 text-xs" title="Assign to a client (or leave as a template visible to all)">
              <option value="">All clients (template)</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <Button className="gap-1.5" disabled={pending}
              onClick={() => run(() => publishRoleAction({ roleId: config.id, nameEn: config.name_en, nameAr: config.name_ar ?? undefined, description: config.description ?? undefined, organizationId: assignOrg || null }), "Published to Bespoke Services")}>
              <Rocket className="h-4 w-4" /> Publish to Bespoke
            </Button>
          </div>
        )}
      </div>

      {/* Settings */}
      <CollapsibleCard title="Pass thresholds" icon={Save} defaultOpen>
        <div className="flex flex-wrap items-end gap-4">
          <label className="text-xs">Behavioural (Persona) pass %
            <Input type="number" min={0} max={100} value={personaPct} onChange={(e) => setPersonaPct(Number(e.target.value) || 0)} className="mt-1 w-32" />
          </label>
          <label className="text-xs">Technical pass %
            <Input type="number" min={0} max={100} value={techPct} onChange={(e) => setTechPct(Number(e.target.value) || 0)} className="mt-1 w-32" />
          </label>
          <Button size="sm" className="gap-1.5" disabled={pending}
            onClick={() => run(() => updateRoleAction({ roleId: config.id, personaPassPct: personaPct, technicalPassPct: techPct }), "Thresholds saved")}>
            <Save className="h-3.5 w-3.5" /> Save
          </Button>
        </div>
      </CollapsibleCard>

      {/* Competencies */}
      <CollapsibleCard
        title="Behavioural competencies + targets"
        icon={ClipboardList}
        defaultOpen
        subtitle={`${Object.keys(comps).length} selected across ${blocksCovered}/${TOTAL_BLOCKS} building blocks`}
      >
        <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          Tick the competencies this role requires and set each target level (1-5).
          <TooltipProvider delayDuration={150}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="cursor-help text-muted-foreground"><Info className="h-3.5 w-3.5" /></span>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs text-xs leading-snug">{TARGET_HELP}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </p>

        <JdMatchBox onMatched={applyMatched} />
        {matched && matched.length > 0 && (
          <div className="mt-3 rounded-lg border border-[#5391D5]/30 bg-[#5391D5]/5 p-3">
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#010131]">
              <Sparkles className="h-3.5 w-3.5 text-[#5391D5]" /> Matched {matched.length} competencies from the job description
            </div>
            <ul className="mt-1.5 space-y-1 text-[11px] text-muted-foreground">
              {matched.map((m) => (
                <li key={m.competencyId}>
                  <span className="font-medium text-foreground">{m.competencyName}</span>{" "}
                  <span className="rounded bg-muted px-1 py-0.5 uppercase">{m.priority}</span> - {m.reasoning}
                </li>
              ))}
            </ul>
            <p className="mt-1.5 text-[11px] text-muted-foreground">Pre-selected below - review the targets, then Save competencies.</p>
          </div>
        )}

        {/* All competencies on one screen, grouped + labelled by cluster (building block). */}
        <div className="mt-3 grid grid-cols-1 gap-x-4 gap-y-0.5 rounded-lg border p-2 sm:grid-cols-2 xl:grid-cols-3">
          {SORTED_COMPETENCIES.map((c, i) => {
            const on = comps[c.acCompetencyId] != null;
            const newCluster = i === 0 || SORTED_COMPETENCIES[i - 1].clusterNameEn !== c.clusterNameEn;
            return (
              <Fragment key={c.acCompetencyId}>
                {newCluster && (
                  <div className="col-span-full mt-2 border-b border-[#5391D5]/20 pb-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#5391D5] first:mt-0">
                    {c.clusterNameEn}
                  </div>
                )}
                <div className={`flex items-center gap-1.5 rounded px-1.5 py-0.5 text-[11px] ${on ? "bg-[#5391D5]/5" : ""}`}>
                  <input type="checkbox" checked={on} onChange={() => toggleComp(c.acCompetencyId)} className="h-3.5 w-3.5 shrink-0" />
                  <span className="min-w-0 flex-1 truncate" title={`${c.nameEn} · ${c.clusterNameEn}`}>{c.nameEn}</span>
                  {on && (
                    <select value={comps[c.acCompetencyId]} onChange={(e) => setComps((p) => ({ ...p, [c.acCompetencyId]: Number(e.target.value) }))}
                      title={TARGET_HELP}
                      className="shrink-0 rounded border border-border bg-background px-1 py-0.5 text-[10px]">
                      {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>Target {n}</option>)}
                    </select>
                  )}
                </div>
              </Fragment>
            );
          })}
        </div>
        <Button size="sm" className="mt-3 gap-1.5" disabled={pending}
          onClick={() => run(() => setCompetenciesAction({ roleId: config.id, items: Object.entries(comps).map(([competencyId, target]) => ({ competencyId, target })) }), "Competencies saved")}>
          <Save className="h-3.5 w-3.5" /> Save competencies
        </Button>
      </CollapsibleCard>

      {/* Technical areas + items */}
      <CollapsibleCard title="Technical areas + items" icon={Boxes} defaultOpen
        subtitle={`${config.technicalAreas.length} area(s)`}>
        <div className="space-y-4">
          {config.technicalAreas.map((area) => (
            <div key={area.id} className="rounded-lg border p-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">{area.name_en} <span className="text-xs text-muted-foreground">· target {area.target_pct}% · {area.items.length} item(s)</span></div>
                <div className="flex items-center gap-2">
                  <button
                    className="inline-flex items-center gap-1 rounded border px-2 py-1 text-[11px] font-medium text-[#5391D5] hover:bg-[#5391D5]/5 disabled:opacity-50"
                    disabled={pending}
                    title="AI-draft 4 questions for this area (you can edit/remove them after)"
                    onClick={() => run(() => generateTechnicalItemsAction({ roleId: config.id, areaId: area.id, roleName: config.name_en, areaName: area.name_en, count: 4 }), "Questions generated")}>
                    <Sparkles className="h-3 w-3" /> AI generate
                  </button>
                  <button className="text-muted-foreground hover:text-destructive" disabled={pending}
                    onClick={() => run(() => removeAreaAction({ roleId: config.id, areaId: area.id }), "Area removed")}><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
              <ul className="mt-2 space-y-1">
                {area.items.map((it) => (
                  <li key={it.id} className="flex items-start justify-between gap-2 text-xs">
                    <span className="min-w-0"><span className="text-muted-foreground">Q:</span> {it.stem_en} <span className="text-emerald-600" title="Answer key - shown to admins only; the candidate never sees it">(answer: {it.options_en[it.correct_index]})</span></span>
                    <button className="text-muted-foreground hover:text-destructive" disabled={pending}
                      onClick={() => run(() => removeItemAction({ roleId: config.id, itemId: it.id }), "Item removed")}><Trash2 className="h-3.5 w-3.5" /></button>
                  </li>
                ))}
              </ul>
              <AddItemForm roleId={config.id} areaId={area.id} disabled={pending} onAdded={() => router.refresh()} />
            </div>
          ))}
        </div>
        <AddAreaForm roleId={config.id} disabled={pending} onAdded={() => router.refresh()} />
      </CollapsibleCard>

      {/* Vouchers (individual links or one shared multi-seat link) - collapsible */}
      <RrVoucherPanel
        clients={clients.map((c) => c.name)}
        onIssue={(input) =>
          issueRoleVouchersAction({
            roleId: config.id,
            organizationId: assignedOrgId,
            mode: input.mode,
            emails: input.emails,
            delegates: input.delegates,
            seats: input.seats,
            sendEmails: input.sendEmails,
            origin: input.origin,
            clientName: input.clientName,
            projectLabel: input.projectLabel,
            expiresAt: input.expiresAt,
            contactName: input.contactName,
            contactTitle: input.contactTitle,
            contactEmail: input.contactEmail,
          })
        }
      />
    </div>
  );
}

function AddAreaForm({ roleId, disabled, onAdded }: { roleId: string; disabled: boolean; onAdded: () => void }) {
  const [name, setName] = useState("");
  const [target, setTarget] = useState(60);
  const [suggestion, setSuggestion] = useState("");
  const [pending, start] = useTransition();
  return (
    <div className="mt-4 rounded-lg border border-dashed p-3">
      <div className="text-xs font-medium text-muted-foreground">Add technical area</div>
      <div className="mt-2 flex flex-wrap items-end gap-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Area name, e.g. Workforce Planning" className="flex-1 min-w-48" />
        <label className="text-xs">Target %<Input type="number" min={0} max={100} value={target} onChange={(e) => setTarget(Number(e.target.value) || 0)} className="mt-1 w-24" /></label>
      </div>
      <Input value={suggestion} onChange={(e) => setSuggestion(e.target.value)} placeholder="Development suggestion (SME-editable, optional)" className="mt-2" />
      <Button size="sm" className="mt-2 gap-1.5" disabled={pending || disabled || name.trim().length < 2}
        onClick={() => start(async () => {
          const res = await addAreaAction({ roleId, nameEn: name, targetPct: target, suggestionEn: suggestion });
          if ("error" in res) { toast.error(res.error); return; }
          toast.success("Area added"); setName(""); setSuggestion(""); onAdded();
        })}>
        <Plus className="h-3.5 w-3.5" /> Add area
      </Button>
    </div>
  );
}

function AddItemForm({ roleId, areaId, disabled, onAdded }: { roleId: string; areaId: string; disabled: boolean; onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [stem, setStem] = useState("");
  const [opts, setOpts] = useState("");
  const [correct, setCorrect] = useState(0);
  const [pending, start] = useTransition();
  const lines = opts.split("\n").map((l) => l.trim()).filter(Boolean);
  if (!open) return <button className="mt-2 text-xs font-medium text-[#5391D5] hover:underline" onClick={() => setOpen(true)}>+ Add question</button>;
  return (
    <div className="mt-2 rounded-md border border-dashed p-2">
      <Textarea value={stem} onChange={(e) => setStem(e.target.value)} rows={2} placeholder="Question stem" className="text-xs" />
      <Textarea value={opts} onChange={(e) => setOpts(e.target.value)} rows={4} placeholder={"One option per line\nFirst correct option here\n..."} className="mt-1 text-xs" />
      {lines.length > 0 && (
        <div className="mt-1 space-y-0.5">
          {lines.map((l, i) => (
            <label key={i} className="flex items-center gap-1.5 text-[11px]">
              <input type="radio" name={`c-${areaId}`} checked={correct === i} onChange={() => setCorrect(i)} /> <span className="truncate">{l}</span>
            </label>
          ))}
        </div>
      )}
      <div className="mt-2 flex gap-2">
        <Button size="sm" disabled={pending || disabled || stem.trim().length < 3 || lines.length < 2}
          onClick={() => start(async () => {
            const res = await addItemAction({ roleId, areaId, stemEn: stem, optionsEn: lines, correctIndex: correct });
            if ("error" in res) { toast.error(res.error); return; }
            toast.success("Question added"); setStem(""); setOpts(""); setCorrect(0); setOpen(false); onAdded();
          })}>Add</Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </div>
  );
}

// Match a job description to the VIFM framework: paste text or upload a PDF/text
// file, then the AI extractor pre-selects the important competencies (request).
function JdMatchBox({ onMatched }: { onMatched: (recs: JdRec[]) => void }) {
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState("");
  const [pdfBase64, setPdfBase64] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onFile = (f: File | null) => {
    if (!f) { setFileName(""); setPdfBase64(null); return; }
    setFileName(f.name);
    const reader = new FileReader();
    if (f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf")) {
      reader.onload = () => {
        const res = String(reader.result || "");
        setPdfBase64(res.includes(",") ? res.split(",")[1] : res);
        setText("");
      };
      reader.readAsDataURL(f);
    } else {
      reader.onload = () => { setText(String(reader.result || "")); setPdfBase64(null); };
      reader.readAsText(f);
    }
  };

  const match = async () => {
    setBusy(true);
    try {
      const res = await matchCompetenciesFromJdAction(pdfBase64 ? { pdfBase64 } : { jobDescription: text });
      if ("error" in res) { toast.error(res.error); return; }
      if (res.recommendations.length === 0) { toast.error("No competencies matched - try a fuller description."); return; }
      onMatched(res.recommendations.map((r) => ({
        competencyId: r.competencyId, competencyName: r.competencyName, priority: r.priority, reasoning: r.reasoning,
      })));
      toast.success(`Matched ${res.recommendations.length} competencies`);
    } finally { setBusy(false); }
  };

  const canMatch = !!pdfBase64 || text.trim().length > 30;
  return (
    <div className="mt-3 rounded-lg border border-dashed border-[#5391D5]/40 bg-[#5391D5]/5 p-3">
      <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#010131]">
        <Sparkles className="h-3.5 w-3.5 text-[#5391D5]" /> Match from a job description
      </div>
      <p className="mt-0.5 text-[11px] text-muted-foreground">
        Paste or upload a JD - AI identifies the important competencies across the VIFM framework ({TOTAL_BLOCKS} building blocks · {BEHAVIORAL_COMPETENCIES.length} competencies) and pre-selects them below.
      </p>
      <Textarea
        value={pdfBase64 ? "" : text}
        onChange={(e) => { setText(e.target.value); if (e.target.value) { setPdfBase64(null); setFileName(""); } }}
        rows={3}
        placeholder="Paste the job description here (English or Arabic), or upload a file below..."
        className="mt-2 text-xs"
      />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted">
          <FileText className="h-3.5 w-3.5" /> {fileName || "Upload PDF / text"}
          <input type="file" accept=".pdf,.txt,application/pdf,text/plain" className="hidden" onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
        </label>
        <Button size="sm" className="gap-1.5" disabled={busy || !canMatch} onClick={match}>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} Identify competencies
        </Button>
      </div>
    </div>
  );
}
