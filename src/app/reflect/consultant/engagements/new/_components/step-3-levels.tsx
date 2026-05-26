"use client";

import { CheckCircle2, AlertCircle } from "lucide-react";
import type { ReflectLevelTier } from "@/lib/reflect/validations";
import type { WizardState } from "./wizard";
import { cn } from "@/lib/utils";

type Props = {
  state: WizardState;
  update: (patch: Partial<WizardState>) => void;
  engagementId: string;
};

const TIERS: { value: ReflectLevelTier; label: string; description: string }[] = [
  {
    value: "exec",
    label: "Executive / C-suite",
    description: "CEO, CXOs, EVPs - the strategic-leadership cohort.",
  },
  {
    value: "senior_mgr",
    label: "Senior manager",
    description: "Department heads, VPs, directors - people-leadership cohort.",
  },
  {
    value: "manager",
    label: "Manager / Team lead",
    description: "Section heads, line managers, team leads - operational-leadership cohort.",
  },
  {
    value: "individual_contributor",
    label: "Senior individual contributor",
    description: "Senior engineers, principal specialists - optional, for matrix orgs.",
  },
];

export function StepLevels({ state, update }: Props) {
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
          Engagement created · framework populated
        </div>
        <h2 className="text-lg font-semibold text-primary">Leadership levels in scope</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Pick the tiers you&apos;re running this 360° against. In v1 every behaviour is rated by everyone in the cohort; per-tier behaviour variants land in a later iteration.
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
                  <div className="text-sm font-semibold text-primary">{t.label}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{t.description}</div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {state.levels_in_scope.length === 0 && (
        <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>Pick at least one tier to continue.</span>
        </div>
      )}
    </div>
  );
}
