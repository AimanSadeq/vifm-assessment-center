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

// A composed bespoke service held in front-end state only (this first pass is
// the composer UI; persistence + client-portal wiring lands in the next step).
type Composed = {
  id: string;
  nameEn: string;
  nameAr: string;
  description: string;
  services: CaliberService[];
  clientKey: string;
  clientName: string;
  /** Logica element scope (subtest keys); full battery when all four. */
  logicaSubtests: string[];
};

const logicaScopeLabel = (subtests: string[]): string =>
  subtests.length === COGNITIVE_SUBTEST_KEYS.length
    ? "Logica"
    : `Logica · ${subtests.map((k) => COGNITIVE_SUBTESTS.find((s) => s.key === k)?.name_en ?? k).join(" · ")}`;

export function BespokeBuilder({ clients }: { clients: ClientOpt[] }) {
  const [nameEn, setNameEn] = useState("");
  const [nameAr, setNameAr] = useState("");
  const [description, setDescription] = useState("");
  const [selected, setSelected] = useState<CaliberService[]>([]);
  const [clientKey, setClientKey] = useState("");
  const [composed, setComposed] = useState<Composed[]>([]);
  // Logica element scope: which subtests the package includes (default: all four).
  const [logicaSubtests, setLogicaSubtests] = useState<string[]>([...COGNITIVE_SUBTEST_KEYS]);

  const toggle = (id: CaliberService) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  const toggleLogicaSubtest = (key: string) =>
    setLogicaSubtests((prev) =>
      prev.includes(key)
        ? prev.filter((k) => k !== key)
        : COGNITIVE_SUBTEST_KEYS.filter((k) => prev.includes(k) || k === key)
    );

  const client = clients.find((c) => c.key === clientKey);
  const logicaOn = selected.includes("logica");
  const canSave =
    nameEn.trim().length >= 2 && selected.length >= 1 && !!client && (!logicaOn || logicaSubtests.length > 0);

  const reset = () => {
    setNameEn(""); setNameAr(""); setDescription(""); setSelected([]); setClientKey("");
    setLogicaSubtests([...COGNITIVE_SUBTEST_KEYS]);
  };

  const add = () => {
    if (!canSave || !client) return;
    setComposed((prev) => [
      {
        id: String(Date.now()),
        nameEn: nameEn.trim(),
        nameAr: nameAr.trim(),
        description: description.trim(),
        services: [...selected],
        clientKey,
        clientName: client.name,
        logicaSubtests: logicaOn ? [...logicaSubtests] : [...COGNITIVE_SUBTEST_KEYS],
      },
      ...prev,
    ]);
    toast.success(`Bespoke service "${nameEn.trim()}" composed for ${client.name}`);
    reset();
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
          <Button onClick={add} disabled={!canSave} className="gap-1.5">
            <Plus className="h-4 w-4" /> Add bespoke service
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
                  {id === "logica" ? logicaScopeLabel(logicaSubtests) : labelFor(id)}
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
                      onClick={() => setComposed((prev) => prev.filter((x) => x.id !== b.id))}
                      className="text-muted-foreground hover:text-destructive"
                      aria-label="Remove"
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
                        {id === "logica" ? logicaScopeLabel(b.logicaSubtests) : labelFor(id)}
                      </span>
                    ))}
                  </div>
                  {b.services.includes("logica") && (
                    <a
                      href={`/ac/cognitive/vouchers?subtests=${b.logicaSubtests.join(",")}`}
                      className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-[#c026d3] hover:underline"
                    >
                      Issue Logica vouchers for this scope →
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-4 border-t pt-3 text-[11px] leading-relaxed text-muted-foreground">
            Front-end preview. Saving to the database and surfacing the package in the client&apos;s
            portal is the next step - we&apos;ll wire it when you give the bespoke design to build.
          </p>
        </div>
      </div>
    </div>
  );
}
