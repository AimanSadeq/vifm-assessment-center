"use client";

import { CheckCircle2, AlertCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ReflectLevelTier } from "@/lib/reflect/validations";
import type { WizardState } from "./wizard";
import { cn } from "@/lib/utils";

type Props = {
  state: WizardState;
  update: (patch: Partial<WizardState>) => void;
  engagementId: string;
};

const TIERS: { value: ReflectLevelTier; labelKey: string; descriptionKey: string }[] = [
  {
    value: "exec",
    labelKey: "reflectWizard.step3.tiers.execLabel",
    descriptionKey: "reflectWizard.step3.tiers.execDesc",
  },
  {
    value: "senior_mgr",
    labelKey: "reflectWizard.step3.tiers.seniorMgrLabel",
    descriptionKey: "reflectWizard.step3.tiers.seniorMgrDesc",
  },
  {
    value: "manager",
    labelKey: "reflectWizard.step3.tiers.managerLabel",
    descriptionKey: "reflectWizard.step3.tiers.managerDesc",
  },
  {
    value: "individual_contributor",
    labelKey: "reflectWizard.step3.tiers.icLabel",
    descriptionKey: "reflectWizard.step3.tiers.icDesc",
  },
];

export function StepLevels({ state, update }: Props) {
  const { t: tr } = useTranslation();
  const toggle = (tier: ReflectLevelTier) => {
    const next = state.levels_in_scope.includes(tier)
      ? state.levels_in_scope.filter((t) => t !== tier)
      : [...state.levels_in_scope, tier];
    update({ levels_in_scope: next });
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs text-emerald-700 mb-3">
          <CheckCircle2 className="h-3 w-3" />
          {tr("reflectWizard.step3.createdBadge")}
        </div>
        <h2 className="text-lg font-semibold text-primary">{tr("reflectWizard.step3.heading")}</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {tr("reflectWizard.step3.intro")}
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {TIERS.map((t) => {
          const selected = state.levels_in_scope.includes(t.value);
          return (
            <button
              key={t.value}
              type="button"
              onClick={() => toggle(t.value)}
              className={cn(
                "text-start rounded-lg border p-4 transition-all",
                selected
                  ? "border-accent bg-accent/5 ring-2 ring-accent/30"
                  : "border-border bg-card hover:border-accent/40"
              )}
            >
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    "h-5 w-5 rounded-full border flex items-center justify-center mt-0.5",
                    selected ? "bg-accent border-accent text-white" : "border-muted-foreground/30"
                  )}
                >
                  {selected && <CheckCircle2 className="h-3 w-3" />}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-semibold text-primary">{tr(t.labelKey)}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{tr(t.descriptionKey)}</div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {state.levels_in_scope.length === 0 && (
        <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{tr("reflectWizard.step3.pickAtLeastOne")}</span>
        </div>
      )}
    </div>
  );
}
