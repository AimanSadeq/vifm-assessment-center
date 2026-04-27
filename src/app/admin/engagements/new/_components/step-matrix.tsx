"use client";

import React from "react";
import type { CompetencyTree, Exercise } from "@/types/database";
import { useWizard, useWizardDispatch } from "./wizard-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

type Props = {
  competencyTree: CompetencyTree;
  exercises: Exercise[];
};

export function StepMatrix({ competencyTree, exercises }: Props) {
  const state = useWizard();
  const dispatch = useWizardDispatch();

  // Only show selected competencies and exercises
  const selectedCompIds = new Set(
    state.selectedCompetencies.map((c) => c.competencyId)
  );
  const selectedExercises = exercises.filter((e) =>
    state.selectedExerciseIds.includes(e.id)
  );

  // Build flat list of selected competencies grouped by domain
  const competencyRows: {
    domain: string;
    competencyId: string;
    competencyName: string;
  }[] = [];

  for (const domainGroup of competencyTree) {
    for (const clusterGroup of domainGroup.clusters) {
      for (const comp of clusterGroup.competencies) {
        if (selectedCompIds.has(comp.id)) {
          competencyRows.push({
            domain: domainGroup.domain.name,
            competencyId: comp.id,
            competencyName: comp.name,
          });
        }
      }
    }
  }

  const isChecked = (exerciseId: string, competencyId: string) =>
    state.matrix.some(
      (m) => m.exerciseId === exerciseId && m.competencyId === competencyId
    );

  const getExerciseCount = (competencyId: string) =>
    state.matrix.filter((m) => m.competencyId === competencyId).length;

  const allValid = competencyRows.every(
    (row) => getExerciseCount(row.competencyId) >= 2
  );
  const validCount = competencyRows.filter(
    (row) => getExerciseCount(row.competencyId) >= 2
  ).length;

  if (selectedExercises.length === 0 || competencyRows.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Step 4: Exercise-Competency Matrix</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground py-8 text-center">
            Select at least 1 exercise and 4 competencies in the previous steps.
          </p>
        </CardContent>
      </Card>
    );
  }

  let lastDomain = "";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Step 4: Exercise-Competency Matrix</CardTitle>
          <Badge variant={allValid ? "default" : "destructive"}>
            {validCount}/{competencyRows.length} competencies meet 2-exercise
            minimum
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Each competency must be observed in at least 2 exercises (International
          Taskforce Guidelines).
        </p>
      </CardHeader>
      <CardContent>
        <ScrollArea className="w-full">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 pr-4 min-w-[200px] sticky left-0 bg-card">
                  Competency
                </th>
                {selectedExercises.map((ex) => (
                  <th
                    key={ex.id}
                    className="text-center py-2 px-3 min-w-[100px]"
                  >
                    <div className="text-xs font-medium leading-tight">
                      {ex.name}
                    </div>
                  </th>
                ))}
                <th className="text-center py-2 px-2 min-w-[60px]">Status</th>
              </tr>
            </thead>
            <tbody>
              {competencyRows.map((row) => {
                const count = getExerciseCount(row.competencyId);
                const showDomainHeader = row.domain !== lastDomain;
                lastDomain = row.domain;

                return (
                  <React.Fragment key={row.competencyId}>
                    {showDomainHeader && (
                      <tr>
                        <td
                          colSpan={selectedExercises.length + 2}
                          className="pt-4 pb-1 text-xs font-bold uppercase tracking-wider text-muted-foreground"
                        >
                          {row.domain}
                        </td>
                      </tr>
                    )}
                    <tr className="border-b">
                      <td className="py-2 pr-4 sticky left-0 bg-card">
                        {row.competencyName}
                      </td>
                      {selectedExercises.map((ex) => (
                        <td key={ex.id} className="text-center py-2 px-3">
                          <Checkbox
                            checked={isChecked(ex.id, row.competencyId)}
                            onCheckedChange={() =>
                              dispatch({
                                type: "TOGGLE_MATRIX_CELL",
                                exerciseId: ex.id,
                                competencyId: row.competencyId,
                              })
                            }
                          />
                        </td>
                      ))}
                      <td className="text-center py-2 px-2">
                        <span
                          className={cn(
                            "text-xs font-medium",
                            count >= 2
                              ? "text-green-600"
                              : count === 1
                                ? "text-yellow-600"
                                : "text-red-500"
                          )}
                        >
                          {count >= 2 ? "OK" : `${count}/2`}
                        </span>
                      </td>
                    </tr>
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
