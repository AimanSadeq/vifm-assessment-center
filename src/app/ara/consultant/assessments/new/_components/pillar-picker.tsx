"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { ARA_PILLARS } from "@/lib/constants/ara-pillars";
import type { AraPillarId } from "@/types/ara";

/**
 * Pillar selector on Step 2 of the new-assessment wizard. Default-
 * checks the stage's recommended pillars so a consultant can hit
 * Create with sensible defaults, but explicitly supports swapping
 * which pillars are in scope (e.g., swap Operations for Governance
 * on a Stage 1 assessment for a sector where governance matters more).
 *
 * Per-stage cardinality is must-equal (Department=4, Division=6).
 * The Submit button on the parent form is enabled only when the
 * count matches; the live counter at the top of the panel is the
 * affordance for the consultant.
 *
 * Each checked pillar is posted as an `pillars_in_scope` form field
 * — the create action collects them with formData.getAll().
 *
 * Hidden inputs render so vanilla form submission works without JS.
 * The interactive UI is just for live feedback.
 */

type Props = {
  /** Pre-checked pillars — comes from ARA_STAGE_MAP[stage].applicable_pillars. */
  defaultPillars: ReadonlyArray<AraPillarId>;
  /** Required count — Department=4, Division=6. */
  requiredCount: number;
};

export function PillarPicker({ defaultPillars, requiredCount }: Props) {
  const [selected, setSelected] = useState<Set<AraPillarId>>(
    new Set(defaultPillars)
  );

  const toggle = (id: AraPillarId) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        // If we're already at the cap, drop the oldest (first) and add new.
        // This makes swapping a pillar one click instead of two.
        if (next.size >= requiredCount) {
          const first = next.values().next().value;
          if (first) next.delete(first);
        }
        next.add(id);
      }
      return next;
    });
  };

  const valid = selected.size === requiredCount;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Pick the {requiredCount} pillars this assessment will score. Defaults
          to the recommended set; swap any pillar to match the client&apos;s focus.
        </p>
        <span
          className={`text-[11px] font-bold uppercase tracking-wider px-2 py-1 rounded-full border tabular-nums ${
            valid
              ? "bg-emerald-100 text-emerald-900 border-emerald-200"
              : "bg-amber-100 text-amber-900 border-amber-200"
          }`}
        >
          {selected.size} / {requiredCount} selected
        </span>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {ARA_PILLARS.map((p) => {
          const isOn = selected.has(p.id);
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => toggle(p.id)}
              className={`text-start rounded-md border px-3 py-2 transition-colors ${
                isOn
                  ? "bg-accent/10 border-accent/40"
                  : "bg-card hover:bg-muted border-input"
              }`}
            >
              <div className="flex items-start gap-2">
                <span
                  className={`mt-0.5 inline-flex items-center justify-center h-4 w-4 rounded shrink-0 border ${
                    isOn ? "bg-accent border-accent text-white" : "border-input"
                  }`}
                >
                  {isOn && <Check className="h-3 w-3" />}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium">{p.name_en}</p>
                  <p className="text-[11px] text-muted-foreground leading-snug truncate">
                    {p.description_en}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Hidden inputs feed the form submission. We render one per
          selected pillar so formData.getAll("pillars_in_scope")
          returns the array. */}
      {Array.from(selected).map((id) => (
        <input key={id} type="hidden" name="pillars_in_scope" value={id} />
      ))}

      {!valid && (
        <p className="text-[11px] text-amber-700">
          Pick exactly {requiredCount} pillars to continue. Click any tile to
          add or remove — when you&apos;re at the cap, clicking a new one
          swaps in.
        </p>
      )}
    </div>
  );
}
