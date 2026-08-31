"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
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
 * - the create action collects them with formData.getAll().
 *
 * Hidden inputs render so vanilla form submission works without JS.
 * The interactive UI is just for live feedback.
 */

type Props = {
  /** Pre-checked pillars - comes from ARA_STAGE_MAP[stage].applicable_pillars. */
  defaultPillars: ReadonlyArray<AraPillarId>;
  /** Required count - Department=4, Division=6. */
  requiredCount: number;
};

export function PillarPicker({ defaultPillars, requiredCount }: Props) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<Set<AraPillarId>>(
    new Set(defaultPillars)
  );
  // Custom scope (migration 00198): relaxes the must-equal pillar rule (any
  // 1-8 pillars) and adds an optional per-pillar question budget. The standard
  // tier behaviour is completely unchanged while the toggle is off.
  const [custom, setCustom] = useState(false);
  const [questionsPerPillar, setQuestionsPerPillar] = useState<string>("6");

  const toggle = (id: AraPillarId) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        // Standard mode: if we're already at the cap, drop the oldest (first)
        // and add new - swapping a pillar is one click instead of two. Custom
        // mode has no cap (any subset up to all 8).
        if (!custom && next.size >= requiredCount) {
          const first = next.values().next().value;
          if (first) next.delete(first);
        }
        next.add(id);
      }
      return next;
    });
  };

  const valid = custom ? selected.size >= 1 : selected.size === requiredCount;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {custom
            ? t("araConsultant.pillar_picker_custom_intro", "Custom scope: pick any pillars this assessment should cover.")
            : t("araConsultant.pillar_picker_intro", { n: requiredCount })}
        </p>
        <span
          className={`text-[11px] font-bold uppercase tracking-wider px-2 py-1 rounded-full border tabular-nums ${
            valid
              ? "bg-emerald-100 text-emerald-900 border-emerald-200"
              : "bg-amber-100 text-amber-900 border-amber-200"
          }`}
        >
          {custom
            ? `${selected.size} / 8`
            : t("araConsultant.pillar_picker_counter", { selected: selected.size, required: requiredCount })}
        </span>
      </div>

      {/* Custom-scope toggle: standard tiers (the SOP) stay exactly as they are;
          custom unlocks any pillar combination + a per-pillar question budget. */}
      <label className="flex items-start gap-2 rounded-md border border-input bg-muted/30 px-3 py-2 cursor-pointer">
        <input
          type="checkbox"
          name="custom_scope"
          checked={custom}
          onChange={(e) => setCustom(e.target.checked)}
          className="mt-0.5 h-4 w-4 accent-[#5391D5]"
        />
        <span className="min-w-0">
          <span className="block text-sm font-medium">
            {t("araConsultant.pillar_custom_toggle", "Custom scope (advanced)")}
          </span>
          <span className="block text-[11px] text-muted-foreground leading-snug">
            {t(
              "araConsultant.pillar_custom_hint",
              "Override the standard tier: choose any pillar combination and set a question budget per pillar (e.g. a department run covering all 8 pillars at 6 questions each = 48 questions)."
            )}
          </span>
        </span>
      </label>

      {custom && (
        <label className="block text-sm">
          <span className="text-muted-foreground">
            {t("araConsultant.pillar_qpp_label", "Questions per pillar (blank = full set)")}
          </span>
          <input
            type="number"
            name="questions_per_pillar"
            min={1}
            max={20}
            value={questionsPerPillar}
            onChange={(e) => setQuestionsPerPillar(e.target.value)}
            className="mt-1 w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
          />
          <span className="mt-1 block text-[11px] text-muted-foreground">
            {t(
              "araConsultant.pillar_qpp_hint",
              "6 recommended; below 4 the per-pillar read gets unreliable. The report marks custom-form results as indicative (not benchmark-comparable to full forms)."
            )}
          </span>
        </label>
      )}

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
          {custom
            ? t("araConsultant.pillar_custom_warning", "Select at least one pillar.")
            : t("araConsultant.pillar_picker_warning", { n: requiredCount })}
        </p>
      )}
    </div>
  );
}
