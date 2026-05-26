"use client";

import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Users, Sparkles } from "lucide-react";

/**
 * Mode-C toggle on the assessment-create wizard - the bridge that lets
 * a Department / Division / Enterprise engagement also measure
 * individual behaviour, not only org capability.
 *
 * Rewritten 2026-05-14 from a quiet "optional add-on" into a recommended
 * default with a visible "why this matters" framing: pillars measure
 * what the organisation has built, factors measure how its people behave.
 * A department's realised readiness is the intersection of both - and
 * the wizard is the only place the consultant can wire them together
 * inside one engagement, so we surface the framing prominently here.
 *
 * When checked, every respondent on this org assessment also answers
 * the four-factor individual readiness items (24 if tier=snapshot, 48
 * if tier=deep_dive). When unchecked, the assessment runs as a pure
 * org-pillar diagnostic - original behaviour.
 */
export function IndividualLayerToggle() {
  const [enabled, setEnabled] = useState(false);
  const [tier, setTier] = useState<"snapshot" | "deep_dive">("snapshot");

  return (
    <div
      className={`rounded-lg border-2 overflow-hidden transition-colors ${
        enabled
          ? "border-accent/60 bg-accent/5"
          : "border-accent/30 bg-accent/[0.03] hover:bg-accent/[0.06]"
      }`}
    >
      {/* Why this matters - visible whether the toggle is on or off. The
           framing comes first; the checkbox is a consequence of it. */}
      <div className="px-4 pt-4 pb-3 border-b border-accent/20">
        <div className="inline-flex items-center gap-1.5 mb-2">
          <Sparkles className="h-3.5 w-3.5 text-accent" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-accent">
            Recommended for this engagement
          </span>
        </div>
        <p className="text-sm font-semibold text-primary leading-snug">
          Pillars measure what the organisation has built.
          {" "}<span className="text-accent">Factors measure how its people behave.</span>
        </p>
        <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
          A department&apos;s realised AI readiness is the intersection of both -
          the org can score 5 / 5 on Data and Strategy, but if the workforce
          scores 2 / 5 on AI Working Practice the value still doesn&apos;t land.
          Adding the individual layer is the one place the consultant report
          can say <span className="italic">&ldquo;your strategy is solid; the gap is adoption&rdquo;</span>{" "}
          with evidence on both sides.
        </p>
      </div>

      <label className="flex items-start gap-3 px-4 py-3 cursor-pointer">
        <input
          type="checkbox"
          name="include_individual_layer"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-input accent-accent"
        />
        <div className="flex-1">
          <div className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 text-accent" />
            <span className="text-sm font-semibold">
              Add the workforce readiness layer to this engagement
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            Every respondent will also answer the four-factor personal AI
            readiness items (AI Sense-Check · AI Working Practice ·
            AI Collaboration · AI Adaptive Mindset) alongside their pillar
            questions. The consultant assessment dashboard gains a
            cohort-rollup card, the client PDF gains a Workforce AI
            Readiness section, and each respondent gets their own
            personal results page after submitting.
          </p>
        </div>
      </label>

      {enabled && (
        <div className="border-t bg-background px-4 py-3 space-y-2">
          <Label htmlFor="assessment_tier" className="text-xs">
            Tier of the individual layer
          </Label>
          <select
            id="assessment_tier"
            name="assessment_tier"
            value={tier}
            onChange={(e) => setTier(e.target.value as "snapshot" | "deep_dive")}
            className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs"
          >
            <option value="snapshot">
              Snapshot · 24 items (~5–8 min per respondent)
            </option>
            <option value="deep_dive">
              Deep-dive · 48 items (~10–14 min per respondent)
            </option>
          </select>
          <p className="text-[11px] text-muted-foreground">
            Snapshot is reliable for directional reads (per-factor α ≈ 0.78).
            Deep-dive is research-grade (α ≈ 0.85+) and recommended when
            individual-level decisions follow the report.
          </p>
        </div>
      )}
    </div>
  );
}
