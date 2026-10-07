"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ChevronDown, Compass, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { BundleSettings } from "@/lib/bespoke/bundle-settings";
import { LEVEL_NAMES, type BundleCompetency, type SjtItem } from "@/lib/bespoke/sjt-shared";
import { saveScenarioSettingsAction } from "./delivery-actions";

const LEVEL_TONE: Record<string, string> = {
  Advanced: "bg-emerald-100 text-emerald-800",
  Proficient: "bg-sky-100 text-sky-800",
  Basic: "bg-slate-100 text-slate-700",
  "Counter-evidence": "bg-rose-100 text-rose-800",
};

/** Scenario section (00234): switch it on, set order and cut-offs, and check the
 *  loaded scenarios. Scenarios are loaded from the SME's workbook with
 *  scripts/sdc-hipo/load-scenarios.py, never edited here. */
export function ScenarioPanel({
  bundleId,
  settings,
  competencies,
  items,
  started,
  submitted,
}: {
  bundleId: string;
  settings: BundleSettings;
  competencies: BundleCompetency[];
  items: SjtItem[];
  started: number;
  submitted: number;
}) {
  const [pending, start] = useTransition();
  const cfg = settings.sjtConfig;
  const [enabled, setEnabled] = useState(settings.sjtEnabled);
  const [order, setOrder] = useState(cfg.order);
  const [cuts, setCuts] = useState({ advanced: String(cfg.cuts.advanced), proficient: String(cfg.cuts.proficient), basic: String(cfg.cuts.basic) });
  const [open, setOpen] = useState<string | null>(null);

  const byComp = new Map<string, SjtItem[]>();
  for (const it of items) byComp.set(it.competency_code, [...(byComp.get(it.competency_code) ?? []), it]);
  const unknown = items.filter((it) => !competencies.some((c) => c.code === it.competency_code));
  const maxMost = Math.max(...Object.values(cfg.points));

  const save = () =>
    start(async () => {
      if (enabled !== settings.sjtEnabled && started > 0 &&
        !window.confirm(`${started} candidate${started === 1 ? " has" : "s have"} already started. Change whether the scenario section runs?`)) return;
      const res = await saveScenarioSettingsAction(bundleId, {
        enabled,
        order,
        cuts: { advanced: Number(cuts.advanced), proficient: Number(cuts.proficient), basic: Number(cuts.basic) },
      });
      if ("error" in res) toast.error(res.error);
      else toast.success("Scenario settings saved.");
    });

  return (
    <section className="rounded-xl border bg-card p-5">
      <h2 className="inline-flex items-center gap-2 text-sm font-semibold">
        <Compass className="h-4 w-4 text-[#5391D5]" /> Scenario section
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Part 1 when switched on: each scenario has four responses keyed Advanced, Proficient, Basic and Counter-evidence; the candidate marks the MOST
        and LEAST effective. Untimed, one scenario per screen, answers saved as they go. {items.length} scenario{items.length === 1 ? "" : "s"} loaded
        across {byComp.size} competenc{byComp.size === 1 ? "y" : "ies"} · {started} started · {submitted} submitted.
      </p>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          <span>
            <span className="font-medium">Run the scenario section</span>
            <span className="block text-xs text-muted-foreground">Shown before the other sections. Needs scenarios loaded.</span>
          </span>
        </label>
        <div>
          <div className="text-sm font-medium">Order</div>
          <select className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm" value={order} onChange={(e) => setOrder(e.target.value as typeof order)}>
            <option value="shuffled">Shuffled for each candidate</option>
            <option value="grouped">Grouped by competency, Basic to Advanced</option>
          </select>
          <p className="mt-1 text-xs text-muted-foreground">Responses within a scenario are always shuffled.</p>
        </div>
        <div>
          <div className="text-sm font-medium">Level cut-offs (points out of 12 per competency)</div>
          <div className="mt-1 flex gap-2">
            {(["advanced", "proficient", "basic"] as const).map((k) => (
              <label key={k} className="text-xs text-muted-foreground">
                <span className="capitalize">{k}</span>
                <Input className="mt-0.5 w-20" inputMode="decimal" value={cuts[k]} onChange={(e) => setCuts((c) => ({ ...c, [k]: e.target.value.replace(/[^0-9.]/g, "") }))} />
              </label>
            ))}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Per scenario: MOST = Advanced {cfg.points.Advanced}, Proficient {cfg.points.Proficient}, Basic {cfg.points.Basic}, Counter-evidence{" "}
            {cfg.points["Counter-evidence"]}; +{cfg.leastCounterBonus} when LEAST is the Counter-evidence (max {maxMost + cfg.leastCounterBonus}). Below
            the Basic cut-off reads as {LEVEL_NAMES[0]}. Submitted results keep the settings they were scored with.
          </p>
        </div>
      </div>
      <Button className="mt-3" size="sm" disabled={pending} onClick={save}>
        {pending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null} Save scenario settings
      </Button>

      <div className="mt-6 border-t pt-4">
        <h3 className="text-sm font-semibold">Loaded scenarios</h3>
        {items.length === 0 ? (
          <p className="mt-1 text-xs text-muted-foreground">
            None yet. Load the SME&apos;s approved workbook with <code>scripts/sdc-hipo/load-scenarios.py</code>.
          </p>
        ) : (
          <div className="mt-2 space-y-2">
            {unknown.length > 0 && (
              <p className="text-xs text-rose-700">{unknown.length} scenario(s) name a competency code that is not loaded: {Array.from(new Set(unknown.map((u) => u.competency_code))).join(", ")}.</p>
            )}
            {competencies.map((c) => {
              const list = (byComp.get(c.code) ?? []).sort((a, b) => a.sort_order - b.sort_order);
              const isOpen = open === c.code;
              return (
                <div key={c.code} className="rounded-lg border">
                  <button type="button" className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-muted/50" onClick={() => setOpen(isOpen ? null : c.code)}>
                    <span>
                      <span className="font-medium">{c.name}</span> <span className="text-xs text-muted-foreground">({c.code}{c.category ? ` · ${c.category}` : ""})</span>
                    </span>
                    <span className={`inline-flex items-center gap-1 text-xs ${list.length === 3 ? "text-muted-foreground" : "text-amber-700"}`}>
                      {list.length} scenario{list.length === 1 ? "" : "s"}
                      <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                    </span>
                  </button>
                  {isOpen && (
                    <div className="space-y-3 border-t px-3 py-3">
                      {list.length === 0 && <p className="text-xs text-muted-foreground">No scenarios for this competency.</p>}
                      {list.map((it) => (
                        <div key={it.id} className="text-xs">
                          <div className="font-medium text-[#010131]">{it.ref} · scenario level {it.target_level}</div>
                          <p className="mt-1 whitespace-pre-line text-foreground">{it.situation}</p>
                          <ul className="mt-1.5 space-y-1">
                            {it.options.map((o) => (
                              <li key={o.key} className="flex items-start gap-2">
                                <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${LEVEL_TONE[o.level] ?? ""}`}>{o.level}</span>
                                <span>{o.text}{o.indicator_id ? <span className="text-muted-foreground"> ({o.indicator_id})</span> : null}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
