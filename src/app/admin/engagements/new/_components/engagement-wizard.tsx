"use client";

import type { Organization, Exercise, CompetencyTree } from "@/types/database";
import { WizardProvider, useWizard, useWizardDispatch } from "./wizard-context";
import { StepBasicInfo } from "./step-basic-info";
import { StepCompetencies } from "./step-competencies";
import { StepExercises } from "./step-exercises";
import { StepMatrix } from "./step-matrix";
import { StepReview } from "./step-review";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";

const STEPS = [
  { number: 1, label: "Basic Info" },
  { number: 2, label: "Competencies" },
  { number: 3, label: "Exercises" },
  { number: 4, label: "Matrix" },
  { number: 5, label: "Review" },
];

type Props = {
  organizations: Organization[];
  competencyTree: CompetencyTree;
  exercises: Exercise[];
};

function WizardInner({ organizations, competencyTree, exercises }: Props) {
  const state = useWizard();
  const dispatch = useWizardDispatch();

  const canGoNext = () => {
    switch (state.currentStep) {
      case 1:
        return state.organizationId !== "" && state.engagementName !== "";
      case 2:
        return state.selectedCompetencies.length >= 4 && state.selectedCompetencies.length <= 15;
      case 3:
        return state.selectedExerciseIds.length >= 1;
      case 4: {
        // Each selected competency must be mapped to at least 2 exercises
        const compExerciseCount = new Map<string, number>();
        for (const m of state.matrix) {
          compExerciseCount.set(m.competencyId, (compExerciseCount.get(m.competencyId) ?? 0) + 1);
        }
        return state.selectedCompetencies.every(
          (c) => (compExerciseCount.get(c.competencyId) ?? 0) >= 2
        );
      }
      default:
        return false;
    }
  };

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <nav className="flex gap-1">
        {STEPS.map((step) => (
          <button
            key={step.number}
            onClick={() => {
              if (step.number < state.currentStep) {
                dispatch({ type: "SET_STEP", step: step.number });
              }
            }}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
              state.currentStep === step.number
                ? "bg-primary text-primary-foreground"
                : step.number < state.currentStep
                  ? "bg-muted text-foreground hover:bg-muted/80 cursor-pointer"
                  : "text-muted-foreground cursor-default"
            )}
          >
            <span
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-full text-xs",
                state.currentStep === step.number
                  ? "bg-primary-foreground text-primary"
                  : step.number < state.currentStep
                    ? "bg-foreground/10"
                    : "bg-muted-foreground/20"
              )}
            >
              {step.number < state.currentStep ? <Check className="h-3 w-3" /> : step.number}
            </span>
            {step.label}
          </button>
        ))}
      </nav>

      {/* Active step */}
      <div className="min-h-[400px]">
        {state.currentStep === 1 && (
          <StepBasicInfo organizations={organizations} />
        )}
        {state.currentStep === 2 && (
          <StepCompetencies competencyTree={competencyTree} />
        )}
        {state.currentStep === 3 && (
          <StepExercises exercises={exercises} />
        )}
        {state.currentStep === 4 && (
          <StepMatrix competencyTree={competencyTree} exercises={exercises} />
        )}
        {state.currentStep === 5 && (
          <StepReview
            organizations={organizations}
            competencyTree={competencyTree}
            exercises={exercises}
          />
        )}
      </div>

      {/* Navigation footer */}
      <div className="flex justify-between border-t pt-4">
        <div className="flex gap-2">
          {state.currentStep === 1 ? (
            <Link href="/admin/engagements">
              <Button variant="ghost">Cancel</Button>
            </Link>
          ) : (
            <Button
              variant="outline"
              onClick={() =>
                dispatch({ type: "SET_STEP", step: state.currentStep - 1 })
              }
            >
              <ChevronLeft className="h-4 w-4 me-1" />
              Back
            </Button>
          )}
        </div>

        {state.currentStep < 5 ? (
          <Button
            onClick={() =>
              dispatch({ type: "SET_STEP", step: state.currentStep + 1 })
            }
            disabled={!canGoNext()}
          >
            Next
            <ChevronRight className="h-4 w-4 ms-1" />
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function EngagementWizard(props: Props) {
  return (
    <WizardProvider>
      <WizardInner {...props} />
    </WizardProvider>
  );
}
