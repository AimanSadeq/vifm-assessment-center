"use client";

import { useState } from "react";
import {
  Boxes, Languages, BrainCircuit, Layers, BadgeCheck, UserSearch, Compass, Aperture,
  Check, Plus, Building2, Trash2, Sparkles, Package,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { PORTAL_SERVICES, type CaliberService } from "@/lib/clients/portal-services";
import { COGNITIVE_SUBTESTS, COGNITIVE_SUBTEST_KEYS } from "@/lib/psychometrics/framework";
import { BEHAVIORAL_COMPETENCIES } from "@/lib/scoring/behavioral-items";
import { composeBundleAction, archiveBundleAction, inviteBundleCandidateAction } from "../actions";

// Competency picker source: the 41, grouped by cluster (stable order).
const COMPETENCY_CLUSTERS: { cluster: string; items: { id: string; name: string }[] }[] = (() => {
  const by = new Map<string, { id: string; name: string }[]>();
  for (const c of BEHAVIORAL_COMPETENCIES) {
    if (!by.has(c.clusterNameEn)) by.set(c.clusterNameEn, []);
    by.get(c.clusterNameEn)!.push({ id: c.acCompetencyId, name: c.nameEn });
  }
  return [...by.entries()].map(([cluster, items]) => ({ cluster, items }));
})();
const ALL_COMPETENCY_IDS = BEHAVIORAL_COMPETENCIES.map((c) => c.acCompetencyId);

// Per-service icon (mirrors the landing page's icon choices).
const SERVICE_ICON: Record<CaliberService, typeof Boxes> = {
  fluent: Languages,
  logica: BrainCircuit,
  persona: Layers,
  techno: BadgeCheck,
  prehire: UserSearch,
  arc: Compass,
  reflect: Aperture,
};

type ClientOpt = { key: string; name: string };

// A composed bespoke bundle. Persisted in bespoke_services (kind='bundle');
// the client's portal surfaces it as a tile under "Your tailored programmes".
export type Composed = {
  id: string;
  nameEn: string;
  nameAr: string;
  description: string;
  services: CaliberService[];
  clientName: string;
  /** Logica element scope (subtest keys); full battery when all four. */
  logicaSubtests: string[];
  /** Persona competency scope (ids); full instrument when all 41. */
  personaCompetencyIds: string[];
};

const personaScopeLabel = (ids: string[]): string =>
  ids.length === ALL_COMPETENCY_IDS.length ? "Persona" : `Persona · ${ids.length} of ${ALL_COMPETENCY_IDS.length} competencies`;

const logicaScopeLabel = (subtests: string[]): string =>
  subtests.length === COGNITIVE_SUBTEST_KEYS.length
    ? "Logica"
    : `Logica · ${subtests.map((k) => COGNITIVE_SUBTESTS.find((s) => s.key === k)?.name_en ?? k).join(" · ")}`;

/** Inline candidate invite for a saved bundle - creates the one-sitting apply
 *  link (consent -> Persona -> Logica) and surfaces it to copy/share. */
function InviteCandidate({ bundleId }: { bundleId: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const invite = async () => {
    setBusy(true);
    try {
      const res = await inviteBundleCandidateAction({ bundleId, fullName: name, email });
      if ("error" in res) { toast.error(res.error); return; }
      const full = `${window.location.origin}${res.url}`;
      setUrl(full);
      try { await navigator.clipboard.writeText(full); toast.success("Invite link copied to clipboard"); }
      catch { toast.success("Invite link created"); }
      setName(""); setEmail("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-2">
      {!open ? (
        <Button size="sm" variant="outline" className="h-7 gap-1.5 border-[#5391D5]/50 text-[11px] font-semibold text-[#5391D5] hover:bg-[#5391D5]/5" onClick={() => setOpen(true)}>
          <Plus className="h-3 w-3" /> Invite candidate - one sitting, all sections
        </Button>
      ) : (
        <div className="mt-1 space-y-1.5 rounded-md border bg-muted/30 p-2">
          <div className="grid gap-1.5 sm:grid-cols-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Candidate name" className="h-8 text-xs" />
            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="candidate@email.com" className="h-8 text-xs" />
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" className="h-7 gap-1 text-[11px]" disabled={busy || !name.trim() || !email.trim()} onClick={invite}>
              {busy ? "Creating…" : "Create invite link"}
            </Button>
            <button type="button" onClick={() => { setOpen(false); setUrl(null); }} className="text-[11px] text-muted-foreground hover:underline">
              Close
            </button>
          </div>
          {url && (
            <p className="break-all rounded bg-white px-2 py-1 font-mono text-[10px] text-[#010131]">{url}</p>
          )}
        </div>
      )}
    </div>
  );
}

export function BespokeBuilder({ clients, initialBundles = [] }: { clients: ClientOpt[]; initialBundles?: Composed[] }) {
  const [nameEn, setNameEn] = useState("");
  const [nameAr, setNameAr] = useState("");
  const [description, setDescription] = useState("");
  const [selected, setSelected] = useState<CaliberService[]>([]);
  const [clientKey, setClientKey] = useState("");
  const [composed, setComposed] = useState<Composed[]>(initialBundles);
  const [busy, setBusy] = useState(false);
  // Logica element scope: which subtests the package includes (default: all four).
  const [logicaSubtests, setLogicaSubtests] = useState<string[]>([...COGNITIVE_SUBTEST_KEYS]);
  // Persona competency scope: which of the 41 the package serves (default: all).
  const [personaIds, setPersonaIds] = useState<string[]>([...ALL_COMPETENCY_IDS]);

  const toggle = (id: CaliberService) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  const toggleLogicaSubtest = (key: string) =>
    setLogicaSubtests((prev) =>
      prev.includes(key)
        ? prev.filter((k) => k !== key)
        : COGNITIVE_SUBTEST_KEYS.filter((k) => prev.includes(k) || k === key)
    );
  const togglePersonaId = (id: string) =>
    setPersonaIds((prev) => (prev.includes(id) ? prev.filter((k) => k !== id) : [...prev, id]));
  const togglePersonaCluster = (ids: string[], on: boolean) =>
    setPersonaIds((prev) => (on ? [...new Set([...prev, ...ids])] : prev.filter((k) => !ids.includes(k))));

  const client = clients.find((c) => c.key === clientKey);
  const logicaOn = selected.includes("logica");
  const personaOn = selected.includes("persona");
  const canSave =
    nameEn.trim().length >= 2 &&
    selected.length >= 1 &&
    !!client &&
    (!logicaOn || logicaSubtests.length > 0) &&
    (!personaOn || personaIds.length > 0);

  const reset = () => {
    setNameEn(""); setNameAr(""); setDescription(""); setSelected([]); setClientKey("");
    setLogicaSubtests([...COGNITIVE_SUBTEST_KEYS]);
    setPersonaIds([...ALL_COMPETENCY_IDS]);
  };

  const add = async () => {
    if (!canSave || !client || busy) return;
    setBusy(true);
    try {
      const res = await composeBundleAction({
        nameEn: nameEn.trim(),
        nameAr: nameAr.trim() || undefined,
        description: description.trim() || undefined,
        services: [...selected],
        clientName: client.name,
        logicaSubtests: logicaOn ? [...logicaSubtests] : undefined,
        personaCompetencyIds: personaOn ? [...personaIds] : undefined,
      });
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      setComposed((prev) => [
        {
          id: res.id,
          nameEn: nameEn.trim(),
          nameAr: nameAr.trim(),
          description: description.trim(),
          services: [...selected],
          clientName: client.name,
          logicaSubtests: logicaOn ? [...logicaSubtests] : [...COGNITIVE_SUBTEST_KEYS],
          personaCompetencyIds: personaOn ? [...personaIds] : [...ALL_COMPETENCY_IDS],
        },
        ...prev,
      ]);
      toast.success(`Bespoke service "${nameEn.trim()}" saved - it now shows on ${client.name}'s portal`);
      reset();
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    const prev = composed;
    setComposed((p) => p.filter((x) => x.id !== id)); // optimistic
    const res = await archiveBundleAction(id);
    if ("error" in res) {
      setComposed(prev);
      toast.error(res.error);
    } else {
      toast.success("Bundle archived - removed from the client's portal.");
    }
  };

  const labelFor = (id: CaliberService) => PORTAL_SERVICES.find((s) => s.id === id)?.label ?? id;
  const accentFor = (id: CaliberService) => PORTAL_SERVICES.find((s) => s.id === id)?.accent ?? "#5391D5";

  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      {/* ── Builder ── */}
      <div className="space-y-6 rounded-xl border bg-card p-5">
        {/* 1. Identity */}
        <div className="space-y-3">
          <h2 className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
            <Boxes className="h-4 w-4 text-[#5391D5]" /> 1 · Name the bespoke service
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="b-name-en" className="text-xs">Name (English)</Label>
              <Input id="b-name-en" value={nameEn} onChange={(e) => setNameEn(e.target.value)}
                placeholder="e.g. Graduate Talent Programme" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="b-name-ar" className="text-xs">Name (Arabic)</Label>
              <Input id="b-name-ar" value={nameAr} onChange={(e) => setNameAr(e.target.value)}
                dir="rtl" placeholder="مثال: برنامج المواهب للخرّيجين" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="b-desc" className="text-xs">Description (optional)</Label>
            <Textarea id="b-desc" value={description} onChange={(e) => setDescription(e.target.value)}
              rows={2} placeholder="What this bespoke package delivers for the client." />
          </div>
        </div>

        {/* 2. Compose from services */}
        <div className="space-y-3">
          <h2 className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
            <Package className="h-4 w-4 text-[#5391D5]" /> 2 · Choose the services to combine
          </h2>
          <p className="text-xs text-muted-foreground">Pick one or several - they bundle into a single bespoke service.</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {PORTAL_SERVICES.map((svc) => {
              const Icon = SERVICE_ICON[svc.id];
              const on = selected.includes(svc.id);
              return (
                <button
                  key={svc.id}
                  type="button"
                  onClick={() => toggle(svc.id)}
                  className={`relative flex items-center gap-3 rounded-lg border p-3 text-left transition-all ${
                    on ? "bg-[#5391D5]/5 shadow-sm" : "border-border hover:bg-muted"
                  }`}
                  style={on ? { borderColor: svc.accent } : undefined}
                >
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                    style={{ backgroundColor: `${svc.accent}1a`, color: svc.accent }}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-foreground">{svc.label}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {svc.kind === "voucher" ? "Voucher service" : "Managed seat service"}
                    </div>
                  </div>
                  {on && (
                    <span
                      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-white"
                      style={{ backgroundColor: svc.accent }}
                    >
                      <Check className="h-3 w-3" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Logica element scope - pick which reasoning subtests the package includes. */}
          {logicaOn && (
            <div className="rounded-lg border p-3" style={{ borderColor: "#c026d366", backgroundColor: "#c026d30a" }}>
              <p className="inline-flex items-center gap-1.5 text-xs font-semibold" style={{ color: "#c026d3" }}>
                <BrainCircuit className="h-3.5 w-3.5" /> Logica elements
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Scope the package to specific reasoning elements - e.g. Inductive Reasoning only. Default is the full battery.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {COGNITIVE_SUBTESTS.map((s) => {
                  const on = logicaSubtests.includes(s.key);
                  return (
                    <button
                      key={s.key}
                      type="button"
                      onClick={() => toggleLogicaSubtest(s.key)}
                      aria-pressed={on}
                      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                        on ? "border-[#c026d3] bg-[#c026d3] text-white" : "border-slate-300 text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      {s.name_en}
                    </button>
                  );
                })}
              </div>
              {logicaSubtests.length === 0 && (
                <p className="mt-2 text-[11px] text-rose-600">Pick at least one Logica element.</p>
              )}
            </div>
          )}

          {/* Persona competency scope - pick which of the 41 the package serves. */}
          {personaOn && (
            <div className="rounded-lg border p-3" style={{ borderColor: "#0891b266", backgroundColor: "#0891b20a" }}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="inline-flex items-center gap-1.5 text-xs font-semibold" style={{ color: "#0891b2" }}>
                  <Layers className="h-3.5 w-3.5" /> Persona competencies
                  <span className="font-normal text-muted-foreground">
                    ({personaIds.length}/{ALL_COMPETENCY_IDS.length} selected)
                  </span>
                </p>
                <div className="flex gap-2 text-[11px] font-semibold">
                  <button type="button" className="text-[#0891b2] hover:underline" onClick={() => setPersonaIds([...ALL_COMPETENCY_IDS])}>
                    Select all
                  </button>
                  <button type="button" className="text-muted-foreground hover:underline" onClick={() => setPersonaIds([])}>
                    Clear
                  </button>
                </div>
              </div>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Scope the behavioural self-assessment to the competencies that matter for this package. Default is the full instrument.
              </p>
              <div className="mt-2 max-h-64 space-y-2 overflow-y-auto pr-1">
                {COMPETENCY_CLUSTERS.map((g) => {
                  const groupIds = g.items.map((i) => i.id);
                  const onCount = groupIds.filter((i) => personaIds.includes(i)).length;
                  return (
                    <div key={g.cluster}>
                      <button
                        type="button"
                        onClick={() => togglePersonaCluster(groupIds, onCount < groupIds.length)}
                        className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground hover:text-[#0891b2]"
                        title="Toggle the whole cluster"
                      >
                        {g.cluster} · {onCount}/{groupIds.length}
                      </button>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {g.items.map((c) => {
                          const on = personaIds.includes(c.id);
                          return (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => togglePersonaId(c.id)}
                              aria-pressed={on}
                              className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
                                on ? "border-[#0891b2] bg-[#0891b2] text-white" : "border-slate-300 text-slate-600 hover:bg-slate-100"
                              }`}
                            >
                              {c.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
              {personaIds.length === 0 && (
                <p className="mt-2 text-[11px] text-rose-600">Pick at least one competency.</p>
              )}
            </div>
          )}
        </div>

        {/* 3. Assign to client */}
        <div className="space-y-3">
          <h2 className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
            <Building2 className="h-4 w-4 text-[#5391D5]" /> 3 · Assign to a client
          </h2>
          {clients.length === 0 ? (
            <p className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
              No clients yet. Add one on the{" "}
              <a href="/admin/clients" className="font-medium text-[#5391D5] hover:underline">Platform Clients</a>{" "}
              page first.
            </p>
          ) : (
            <Select value={clientKey} onValueChange={setClientKey}>
              <SelectTrigger className="w-full sm:w-80">
                <SelectValue placeholder="Select a client organisation" />
              </SelectTrigger>
              <SelectContent>
                {clients.map((c) => (
                  <SelectItem key={c.key} value={c.key}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t pt-4">
          <p className="text-xs text-muted-foreground">
            {selected.length > 0
              ? `${selected.length} service${selected.length === 1 ? "" : "s"} selected`
              : "Select at least one service"}
          </p>
          <Button onClick={add} disabled={!canSave || busy} className="gap-1.5">
            <Plus className="h-4 w-4" /> {busy ? "Saving…" : "Add bespoke service"}
          </Button>
        </div>
      </div>

      {/* ── Live preview + composed list ── */}
      <div className="space-y-4">
        {/* Live preview */}
        <div className="rounded-xl border-2 border-dashed border-[#5391D5]/40 bg-[#5391D5]/5 p-5">
          <div className="ara-eyebrow text-[#5391D5]">Live preview</div>
          <div className="mt-2 flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#010131] text-white">
              <Boxes className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-semibold text-[#010131]">
                {nameEn.trim() || "Untitled bespoke service"}
              </h3>
              {nameAr.trim() && <p className="text-xs text-muted-foreground" dir="rtl">{nameAr.trim()}</p>}
              {description.trim() && <p className="mt-1 text-xs text-muted-foreground">{description.trim()}</p>}
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {selected.length === 0 ? (
              <span className="text-xs text-muted-foreground">No services selected yet.</span>
            ) : (
              selected.map((id) => (
                <span
                  key={id}
                  className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium"
                  style={{ borderColor: accentFor(id), color: accentFor(id) }}
                >
                  {id === "logica"
                    ? logicaScopeLabel(logicaSubtests)
                    : id === "persona"
                      ? personaScopeLabel(personaIds)
                      : labelFor(id)}
                </span>
              ))
            )}
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-xs">
            <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">Assigned to:</span>
            <span className="font-medium text-foreground">{client?.name ?? "-"}</span>
          </div>
        </div>

        {/* Composed list (front-end only this pass) */}
        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Composed ({composed.length})</h2>
          </div>
          {composed.length === 0 ? (
            <div className="mt-4 flex flex-col items-center gap-2 py-6 text-center">
              <Sparkles className="h-7 w-7 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">
                Bespoke services you compose appear here.
              </p>
            </div>
          ) : (
            <ul className="mt-3 space-y-2">
              {composed.map((b) => (
                <li key={b.id} className="rounded-lg border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-foreground">{b.nameEn}</div>
                      <div className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Building2 className="h-3 w-3" /> {b.clientName}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => remove(b.id)}
                      className="text-muted-foreground hover:text-destructive"
                      aria-label="Archive bundle"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {b.services.map((id) => (
                      <span
                        key={id}
                        className="rounded-full px-2 py-0.5 text-[10px] font-medium text-white"
                        style={{ backgroundColor: accentFor(id) }}
                      >
                        {id === "logica"
                          ? logicaScopeLabel(b.logicaSubtests)
                          : id === "persona"
                            ? personaScopeLabel(b.personaCompetencyIds)
                            : labelFor(id)}
                      </span>
                    ))}
                  </div>
                  {/* NOTE: no per-service voucher shortcut here - a standalone
                      Logica voucher runs ONLY Logica and confused testing. The
                      bundle is delivered through the one-sitting invite below. */}
                  <InviteCandidate bundleId={b.id} />
                </li>
              ))}
            </ul>
          )}
          <p className="mt-4 border-t pt-3 text-[11px] leading-relaxed text-muted-foreground">
            Saved bundles appear on the assigned client&apos;s portal under &quot;Your tailored
            programmes&quot;, alongside Role Readiness. Archiving removes the tile.
          </p>
        </div>
      </div>
    </div>
  );
}
