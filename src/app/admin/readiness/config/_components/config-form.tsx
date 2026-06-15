"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Save } from "lucide-react";
import type { ReadinessConfig, ReadinessTier, RoleCompetencyPriority } from "@/lib/scoring/readiness";
import { saveReadinessConfigAction, type ReadinessConfigInput } from "../actions";

const TIER_LABELS: Record<ReadinessTier, string> = {
  ready_now: "Ready Now",
  ready_soon: "Ready Soon",
  developing: "Developing",
  not_ready: "Not Ready",
};

function NumField({
  label,
  hint,
  value,
  onChange,
  step = "0.05",
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  step?: string;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
      <Input type="number" step={step} value={value} onChange={(e) => onChange(e.target.value)} className="w-32" />
    </div>
  );
}

const selectCls =
  "h-9 rounded-md border border-input bg-background px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

export function ReadinessConfigForm({ initial }: { initial: ReadinessConfig }) {
  const [readyNow, setReadyNow] = useState(String(initial.readyNowGapCut));
  const [readySoon, setReadySoon] = useState(String(initial.readySoonGapCut));
  const [developing, setDeveloping] = useState(String(initial.developingGapCut));
  const [knockoutEnabled, setKnockoutEnabled] = useState(initial.knockoutEnabled);
  const [knockoutPriority, setKnockoutPriority] = useState<RoleCompetencyPriority>(initial.knockoutPriority);
  const [knockoutGap, setKnockoutGap] = useState(String(initial.knockoutGap));
  const [knockoutCapTier, setKnockoutCapTier] = useState<ReadinessTier>(initial.knockoutCapTier);
  const [useWeights, setUseWeights] = useState(initial.useWeights);
  const [minOthers, setMinOthers] = useState(String(initial.minOthersPerCompetency));
  const [coverageMin, setCoverageMin] = useState(String(initial.coverageMinPct));
  const [borderlineBand, setBorderlineBand] = useState(String(initial.borderlineBand));
  const [spreadMax, setSpreadMax] = useState(String(initial.raterAgreementSpreadMax));
  const [yearEnabled, setYearEnabled] = useState(initial.yearLayerEnabled);
  const [yearMap, setYearMap] = useState({ ...initial.yearMap });
  const [pending, start] = useTransition();

  function buildInput(): ReadinessConfigInput | { error: string } {
    const n = (s: string) => Number(s);
    const rn = n(readyNow), rs = n(readySoon), dv = n(developing), kg = n(knockoutGap);
    const mo = n(minOthers), cm = n(coverageMin), bb = n(borderlineBand), sm = n(spreadMax);
    const inBand = (x: number) => Number.isFinite(x) && x >= -5 && x <= 5;
    if (![rn, rs, dv, kg].every(inBand)) return { error: "Gap values must be numbers between -5 and 5." };
    if (!(rn >= rs && rs >= dv)) return { error: "Tier cutoffs must be descending: Ready Now ≥ Ready Soon ≥ Developing." };
    if (!(Number.isFinite(cm) && cm >= 0 && cm <= 1)) return { error: "Coverage minimum must be between 0 and 1." };
    if (!(Number.isInteger(mo) && mo >= 1)) return { error: "Minimum Others per competency must be a whole number ≥ 1." };
    if (!(Number.isFinite(bb) && bb >= 0 && bb <= 2)) return { error: "Borderline band must be between 0 and 2." };
    if (!(Number.isFinite(sm) && sm >= 0 && sm <= 4)) return { error: "Rater-agreement spread max must be between 0 and 4." };
    for (const k of ["ready_now", "ready_soon", "developing", "not_ready"] as ReadinessTier[]) {
      if (!yearMap[k]?.trim()) return { error: "Every year-layer label must be filled in." };
    }
    return {
      readyNowGapCut: rn,
      readySoonGapCut: rs,
      developingGapCut: dv,
      knockoutEnabled,
      knockoutPriority,
      knockoutGap: kg,
      knockoutCapTier,
      useWeights,
      minOthersPerCompetency: mo,
      coverageMinPct: cm,
      borderlineBand: bb,
      raterAgreementSpreadMax: sm,
      yearLayerEnabled: yearEnabled,
      yearMap: { ...yearMap },
    };
  }

  const save = () =>
    start(async () => {
      const built = buildInput();
      if ("error" in built) {
        toast.error(built.error);
        return;
      }
      const res = await saveReadinessConfigAction(built);
      if ("error" in res) toast.error(res.error);
      else toast.success("Readiness configuration saved.");
    });

  return (
    <div className="space-y-8">
      {/* Tier cutoffs */}
      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold">Tier gap cutoffs</h3>
          <p className="text-[11px] text-muted-foreground">
            On the (weighted_others − weighted_target) gap. Must be descending. Anything below the
            Developing cut is Not Ready.
          </p>
        </div>
        <div className="flex flex-wrap gap-6">
          <NumField label="Ready Now ≥" value={readyNow} onChange={setReadyNow} />
          <NumField label="Ready Soon ≥" value={readySoon} onChange={setReadySoon} />
          <NumField label="Developing ≥" value={developing} onChange={setDeveloping} />
        </div>
      </section>

      {/* Knockout */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Checkbox id="ko" checked={knockoutEnabled} onCheckedChange={(v) => setKnockoutEnabled(v === true)} />
          <Label htmlFor="ko" className="text-sm font-semibold">Knockout guardrail</Label>
        </div>
        <p className="text-[11px] text-muted-foreground">
          A must-have competency far below target caps the final tier, so a strong average can’t fast-track
          someone failing a critical area.
        </p>
        <div className="flex flex-wrap items-end gap-6">
          <div className="space-y-1">
            <Label className="text-xs">Priority that triggers it</Label>
            <select
              className={selectCls}
              value={knockoutPriority}
              disabled={!knockoutEnabled}
              onChange={(e) => setKnockoutPriority(e.target.value as RoleCompetencyPriority)}
            >
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
          <NumField label="Below target by ≥" hint="Others-mean this far under target" value={knockoutGap} onChange={setKnockoutGap} step="0.1" />
          <div className="space-y-1">
            <Label className="text-xs">Caps tier at</Label>
            <select
              className={selectCls}
              value={knockoutCapTier}
              disabled={!knockoutEnabled}
              onChange={(e) => setKnockoutCapTier(e.target.value as ReadinessTier)}
            >
              {(Object.keys(TIER_LABELS) as ReadinessTier[]).map((t) => (
                <option key={t} value={t}>{TIER_LABELS[t]}</option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* Aggregation + coverage */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Aggregation &amp; data sufficiency</h3>
        <div className="flex items-center gap-2">
          <Checkbox id="weights" checked={useWeights} onCheckedChange={(v) => setUseWeights(v === true)} />
          <Label htmlFor="weights" className="text-sm">Use competency weights (off = plain mean)</Label>
        </div>
        <div className="flex flex-wrap gap-6">
          <NumField label="Min Others per competency" hint="Raters needed to count as covered" value={minOthers} onChange={setMinOthers} step="1" />
          <NumField label="Coverage minimum" hint="Fraction 0–1 (0.7 = 70%). Below this → Insufficient Data" value={coverageMin} onChange={setCoverageMin} step="0.05" />
        </div>
      </section>

      {/* Advisory confidence (v2) */}
      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold">Advisory confidence</h3>
          <p className="text-[11px] text-muted-foreground">
            Caveats only - these never change the tier. They flag a near-call result and competencies
            where the 360 raters disagree.
          </p>
        </div>
        <div className="flex flex-wrap gap-6">
          <NumField label="Borderline band" hint="Gap within this of a cutoff → flagged near-call" value={borderlineBand} onChange={setBorderlineBand} step="0.05" />
          <NumField label="Rater-agreement spread max" hint="Others spread (max−min) ≥ this → low agreement (1-5 scale; 3 matches Reflect)" value={spreadMax} onChange={setSpreadMax} step="0.5" />
        </div>
      </section>

      {/* Year layer */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Checkbox id="year" checked={yearEnabled} onCheckedChange={(v) => setYearEnabled(v === true)} />
          <Label htmlFor="year" className="text-sm font-semibold">Optional year-horizon layer</Label>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Stakeholder-facing horizon label per tier. Presentation only - derived from the tier, never the maths.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {(Object.keys(TIER_LABELS) as ReadinessTier[]).map((t) => (
            <div key={t} className="space-y-1">
              <Label className="text-xs">{TIER_LABELS[t]}</Label>
              <Input
                value={yearMap[t]}
                disabled={!yearEnabled}
                onChange={(e) => setYearMap((m) => ({ ...m, [t]: e.target.value }))}
              />
            </div>
          ))}
        </div>
      </section>

      <div className="flex justify-end border-t pt-4">
        <Button onClick={save} disabled={pending}>
          {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save configuration
        </Button>
      </div>
    </div>
  );
}
