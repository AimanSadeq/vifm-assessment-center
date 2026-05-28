"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
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
            {t("araConsultant.individual_eyebrow")}
          </span>
        </div>
        <p className="text-sm font-semibold text-primary leading-snug">
          {t("araConsultant.individual_headline_before")}<span className="text-accent">{t("araConsultant.individual_headline_accent")}</span>
        </p>
        <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
          {t("araConsultant.individual_body_before")}<span className="italic">{t("araConsultant.individual_body_quote")}</span>{t("araConsultant.individual_body_after")}
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
              {t("araConsultant.individual_toggle_label")}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            {t("araConsultant.individual_toggle_help")}
          </p>
        </div>
      </label>

      {enabled && (
        <div className="border-t bg-background px-4 py-3 space-y-2">
          <Label htmlFor="assessment_tier" className="text-xs">
            {t("araConsultant.individual_tier_label")}
          </Label>
          <select
            id="assessment_tier"
            name="assessment_tier"
            value={tier}
            onChange={(e) => setTier(e.target.value as "snapshot" | "deep_dive")}
            className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs"
          >
            <option value="snapshot">
              {t("araConsultant.individual_tier_snapshot")}
            </option>
            <option value="deep_dive">
              {t("araConsultant.individual_tier_deep_dive")}
            </option>
          </select>
          <p className="text-[11px] text-muted-foreground">
            {t("araConsultant.individual_tier_help")}
          </p>
        </div>
      )}
    </div>
  );
}
