"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import type { Organization, Exercise, CompetencyTree } from "@/types/database";
import { useWizard, useWizardDispatch } from "./wizard-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { EXERCISE_TYPE_LABELS } from "@/lib/constants/exercise-types";
import { createEngagementAction } from "../actions";

type Props = {
  organizations: Organization[];
  competencyTree: CompetencyTree;
  exercises: Exercise[];
};

export function StepReview({
  organizations,
  competencyTree,
  exercises,
}: Props) {
  const state = useWizard();
  const dispatch = useWizardDispatch();
  const router = useRouter();
  const { t } = useTranslation();
  const [error, setError] = useState<string | null>(null);

  const org = organizations.find((o) => o.id === state.organizationId);
  const selectedExercises = exercises.filter((e) =>
    state.selectedExerciseIds.includes(e.id)
  );

  // Build competency name lookup
  const compNameMap = new Map<string, string>();
  for (const dg of competencyTree) {
    for (const cg of dg.clusters) {
      for (const c of cg.competencies) {
        compNameMap.set(c.id, c.name);
      }
    }
  }

  const handleSave = async () => {
    setError(null);
    dispatch({ type: "SET_SUBMITTING", isSubmitting: true });

    const result = await createEngagementAction({
      organizationId: state.organizationId,
      name: state.engagementName,
      targetRole: state.targetRole || undefined,
      startDate: state.startDate || undefined,
      endDate: state.endDate || undefined,
      competencies: state.selectedCompetencies.map((c) => ({
        competencyId: c.competencyId,
        weight: c.weight,
      })),
      exercises: state.selectedExerciseIds,
      matrix: state.matrix.map((m) => ({
        exerciseId: m.exerciseId,
        competencyId: m.competencyId,
      })),
    });

    dispatch({ type: "SET_SUBMITTING", isSubmitting: false });

    if ("error" in result && result.error) {
      setError(
        typeof result.error === "string"
          ? result.error
          : JSON.stringify(result.error)
      );
      return;
    }

    // Redirect to the newly created engagement detail page
    toast.success(t("adminWizard.step5.successToast"));
    const engId = "data" in result && result.data ? (result.data as { id: string }).id : null;
    router.push(engId ? `/admin/engagements/${engId}` : "/admin/engagements");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("adminWizard.step5.title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Basic Info */}
        <div>
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">{t("adminWizard.step5.basicInformation")}</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => dispatch({ type: "SET_STEP", step: 1 })}
            >
              {t("adminWizard.step5.edit")}
            </Button>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
            <div className="text-muted-foreground">{t("adminWizard.step5.organization")}</div>
            <div>{org?.name ?? "-"}</div>
            <div className="text-muted-foreground">{t("adminWizard.step5.engagement")}</div>
            <div>{state.engagementName}</div>
            <div className="text-muted-foreground">{t("adminWizard.step5.targetRole")}</div>
            <div>{state.targetRole || "-"}</div>
            <div className="text-muted-foreground">{t("adminWizard.step5.dates")}</div>
            <div>
              {t("adminWizard.step5.datesRange", { start: state.startDate || "-", end: state.endDate || "-" })}
            </div>
          </div>
        </div>

        <Separator />

        {/* Competencies */}
        <div>
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">
              {t("adminWizard.step5.competenciesHeading", { count: state.selectedCompetencies.length })}
            </h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => dispatch({ type: "SET_STEP", step: 2 })}
            >
              {t("adminWizard.step5.edit")}
            </Button>
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            {state.selectedCompetencies.map((c) => (
              <Badge key={c.competencyId} variant="secondary">
                {compNameMap.get(c.competencyId) ?? c.competencyId}
                {c.weight != null && (
                  <span className="ml-1 text-muted-foreground">
                    ({c.weight})
                  </span>
                )}
              </Badge>
            ))}
          </div>
        </div>

        <Separator />

        {/* Exercises */}
        <div>
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">
              {t("adminWizard.step5.exercisesHeading", { count: selectedExercises.length })}
            </h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => dispatch({ type: "SET_STEP", step: 3 })}
            >
              {t("adminWizard.step5.edit")}
            </Button>
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            {selectedExercises.map((ex) => (
              <Badge key={ex.id} variant="outline">
                {ex.name} (
                {EXERCISE_TYPE_LABELS[ex.exercise_type] ?? ex.exercise_type})
              </Badge>
            ))}
          </div>
        </div>

        <Separator />

        {/* Matrix summary */}
        <div>
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">
              {t("adminWizard.step5.matrixHeading", { count: state.matrix.length })}
            </h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => dispatch({ type: "SET_STEP", step: 4 })}
            >
              {t("adminWizard.step5.edit")}
            </Button>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("adminWizard.step5.matrixSummary", { count: state.matrix.length })}
          </p>
        </div>

        <Separator />

        {/* Save */}
        {error && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <Button
          onClick={handleSave}
          disabled={state.isSubmitting}
          className="w-full"
          size="lg"
        >
          {state.isSubmitting ? t("adminWizard.step5.creating") : t("adminWizard.step5.createEngagement")}
        </Button>
      </CardContent>
    </Card>
  );
}
