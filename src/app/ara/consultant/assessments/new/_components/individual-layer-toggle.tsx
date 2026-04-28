"use client";

import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Users } from "lucide-react";

/**
 * Optional Mode-C toggle on the assessment-create wizard.
 *
 * When checked, every respondent on this org assessment also answers
 * the four-factor individual readiness items (24 if tier=snapshot, 48
 * if tier=deep_dive). When unchecked, the assessment runs as a pure
 * org-pillar diagnostic — original behaviour.
 *
 * Renders as a single block with a checkbox that conditionally reveals
 * the tier selector. Both fields are real form inputs so the parent
 * server form picks them up via FormData.
 */
export function IndividualLayerToggle() {
  const [enabled, setEnabled] = useState(false);
  const [tier, setTier] = useState<"snapshot" | "deep_dive">("snapshot");

  return (
    <div className="rounded-lg border bg-muted/20 overflow-hidden">
      <label className="flex items-start gap-3 p-4 cursor-pointer">
        <input
          type="checkbox"
          name="include_individual_layer"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-input"
        />
        <div className="flex-1">
          <div className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 text-accent" />
            <span className="text-sm font-semibold">Include individual readiness layer</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Each respondent will also answer the four-factor personal AI
            readiness items (THINKING / RESULTS / PEOPLE / SELF) alongside
            their pillar questions. Adds a workforce-readiness rollup to
            the assessment dashboard. For paying clients who want
            individual-level reads on their workforce in addition to the
            org-side maturity diagnosis.
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
