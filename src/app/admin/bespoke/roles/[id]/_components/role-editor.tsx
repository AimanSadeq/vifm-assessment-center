"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Save, Plus, Trash2, Send, Copy, CheckCircle2, Boxes, ClipboardList, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { BEHAVIORAL_COMPETENCIES } from "@/lib/scoring/behavioral-items";
import type { RoleReadinessConfig } from "@/lib/role-readiness/config";
import {
  updateRoleAction, setCompetenciesAction, addAreaAction, removeAreaAction,
  addItemAction, removeItemAction, publishRoleAction, unpublishRoleAction, inviteRoleCandidateAction,
} from "../../actions";

export function RoleEditor({ config, published, clients }: { config: RoleReadinessConfig; published: boolean; clients: { id: string; name: string }[] }) {
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
      <div className="rounded-xl border bg-card p-5">
        <h2 className="text-sm font-semibold">Pass thresholds</h2>
        <div className="mt-3 flex flex-wrap items-end gap-4">
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
      </div>

      {/* Competencies */}
      <div className="rounded-xl border bg-card p-5">
        <h2 className="inline-flex items-center gap-1.5 text-sm font-semibold"><ClipboardList className="h-4 w-4 text-[#5391D5]" /> Behavioural competencies + targets</h2>
        <p className="mt-1 text-xs text-muted-foreground">Tick the competencies this role requires and set each target level (1-5). {Object.keys(comps).length} selected.</p>
        <div className="mt-3 max-h-80 space-y-1 overflow-y-auto rounded-lg border p-2">
          {BEHAVIORAL_COMPETENCIES.map((c) => {
            const on = comps[c.acCompetencyId] != null;
            return (
              <div key={c.acCompetencyId} className={`flex items-center gap-2 rounded-md px-2 py-1.5 ${on ? "bg-[#5391D5]/5" : ""}`}>
                <input type="checkbox" checked={on} onChange={() => toggleComp(c.acCompetencyId)} className="h-4 w-4" />
                <span className="min-w-0 flex-1 truncate text-sm">{c.nameEn} <span className="text-[10px] text-muted-foreground">· {c.clusterNameEn}</span></span>
                {on && (
                  <select value={comps[c.acCompetencyId]} onChange={(e) => setComps((p) => ({ ...p, [c.acCompetencyId]: Number(e.target.value) }))}
                    className="rounded border border-border bg-background px-1.5 py-1 text-xs">
                    {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>Target {n}</option>)}
                  </select>
                )}
              </div>
            );
          })}
        </div>
        <Button size="sm" className="mt-3 gap-1.5" disabled={pending}
          onClick={() => run(() => setCompetenciesAction({ roleId: config.id, items: Object.entries(comps).map(([competencyId, target]) => ({ competencyId, target })) }), "Competencies saved")}>
          <Save className="h-3.5 w-3.5" /> Save competencies
        </Button>
      </div>

      {/* Technical areas + items */}
      <div className="rounded-xl border bg-card p-5">
        <h2 className="inline-flex items-center gap-1.5 text-sm font-semibold"><Boxes className="h-4 w-4 text-[#5391D5]" /> Technical areas + items</h2>
        <div className="mt-3 space-y-4">
          {config.technicalAreas.map((area) => (
            <div key={area.id} className="rounded-lg border p-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">{area.name_en} <span className="text-xs text-muted-foreground">· target {area.target_pct}% · {area.items.length} item(s)</span></div>
                <button className="text-muted-foreground hover:text-destructive" disabled={pending}
                  onClick={() => run(() => removeAreaAction({ roleId: config.id, areaId: area.id }), "Area removed")}><Trash2 className="h-4 w-4" /></button>
              </div>
              <ul className="mt-2 space-y-1">
                {area.items.map((it) => (
                  <li key={it.id} className="flex items-start justify-between gap-2 text-xs">
                    <span className="min-w-0"><span className="text-muted-foreground">Q:</span> {it.stem_en} <span className="text-emerald-600">(ans: {it.options_en[it.correct_index]})</span></span>
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
      </div>

      {/* Invite */}
      <InviteCard roleId={config.id} disabled={pending} />
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

function InviteCard({ roleId, disabled }: { roleId: string; disabled: boolean }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [link, setLink] = useState("");
  const [pending, start] = useTransition();
  return (
    <div className="rounded-xl border bg-card p-5">
      <h2 className="inline-flex items-center gap-1.5 text-sm font-semibold"><Send className="h-4 w-4 text-[#5391D5]" /> Invite a candidate</h2>
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" className="min-w-40 flex-1" />
        <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@org.com" className="min-w-48 flex-1" />
        <Button size="sm" className="gap-1.5" disabled={pending || disabled}
          onClick={() => start(async () => {
            const res = await inviteRoleCandidateAction({ roleId, fullName: name, email });
            if ("error" in res) { toast.error(res.error); return; }
            const url = `${window.location.origin}/role-readiness/apply/${res.token}`;
            setLink(url); setName(""); setEmail(""); toast.success("Candidate created - copy the link");
          })}>
          <Send className="h-3.5 w-3.5" /> Create invite link
        </Button>
      </div>
      {link && (
        <div className="mt-3 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
          <input readOnly value={link} onFocus={(e) => e.currentTarget.select()} className="flex-1 rounded-md border bg-muted px-2 py-1.5 font-mono text-xs" />
          <button onClick={() => { navigator.clipboard.writeText(link); toast.success("Copied"); }} className="inline-flex items-center gap-1 rounded border px-2 py-1.5 text-xs hover:bg-muted"><Copy className="h-3 w-3" /> Copy</button>
        </div>
      )}
    </div>
  );
}
