"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { CompetencyTree } from "@/types/database";
import { useWizard, useWizardDispatch } from "./wizard-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { JdExtractor } from "./jd-extractor";
import { RoleProfilePicker, type RoleProfileSummary } from "./role-profile-picker";

type Props = {
  competencyTree: CompetencyTree;
  roleProfiles: RoleProfileSummary[];
};

export function StepCompetencies({ competencyTree, roleProfiles }: Props) {
  const state = useWizard();
  const dispatch = useWizardDispatch();
  const { t } = useTranslation();
  const [search, setSearch] = useState("");

  const selectedIds = new Set(
    state.selectedCompetencies.map((c) => c.competencyId)
  );

  const isSelected = (id: string) => selectedIds.has(id);

  const getWeight = (id: string) => {
    const found = state.selectedCompetencies.find(
      (c) => c.competencyId === id
    );
    return found?.weight ?? null;
  };

  const filteredTree = competencyTree
    .map((domainGroup) => ({
      ...domainGroup,
      clusters: domainGroup.clusters
        .map((clusterGroup) => ({
          ...clusterGroup,
          competencies: clusterGroup.competencies.filter((comp) =>
            comp.name.toLowerCase().includes(search.toLowerCase())
          ),
        }))
        .filter((cg) => cg.competencies.length > 0),
    }))
    .filter((dg) => dg.clusters.length > 0);

  const toggleDomain = (domainGroup: CompetencyTree[number]) => {
    const allCompIds = domainGroup.clusters.flatMap((c) =>
      c.competencies.map((comp) => comp.id)
    );
    const allSelected = allCompIds.every((id) => selectedIds.has(id));
    dispatch({ type: "TOGGLE_DOMAIN", competencyIds: allCompIds, selectAll: !allSelected });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle>{t("adminWizard.step2.title")}</CardTitle>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <RoleProfilePicker profiles={roleProfiles} />
            <JdExtractor />
            <Badge variant={selectedIds.size >= 4 && selectedIds.size <= 15 ? "default" : "destructive"}>
              {t("adminWizard.step2.selectedBadge", { count: selectedIds.size })}{" "}
              {selectedIds.size < 4 ? t("adminWizard.step2.minHint") : selectedIds.size > 15 ? t("adminWizard.step2.maxHint") : ""}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Input
          placeholder={t("adminWizard.step2.searchPlaceholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <div className="space-y-6 max-h-[500px] overflow-y-auto pr-2">
          {filteredTree.map((domainGroup) => {
            const allCompIds = domainGroup.clusters.flatMap((c) =>
              c.competencies.map((comp) => comp.id)
            );
            const allSelected = allCompIds.every((id) => selectedIds.has(id));

            return (
              <div key={domainGroup.domain.id}>
                <div className="flex items-center gap-2 mb-3">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={() => toggleDomain(domainGroup)}
                  />
                  <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                    {domainGroup.domain.name}
                  </h3>
                </div>

                {domainGroup.clusters.map((clusterGroup) => (
                  <div key={clusterGroup.cluster.id} className="ml-4 mb-4">
                    <h4 className="text-sm font-semibold mb-2">
                      {clusterGroup.cluster.name}
                    </h4>
                    <div className="space-y-2 ml-2">
                      {clusterGroup.competencies.map((comp) => (
                        <div
                          key={comp.id}
                          className="flex items-center gap-3"
                        >
                          <Checkbox
                            checked={isSelected(comp.id)}
                            onCheckedChange={() =>
                              dispatch({
                                type: "TOGGLE_COMPETENCY",
                                competencyId: comp.id,
                              })
                            }
                          />
                          <span className="text-sm flex-1">{comp.name}</span>
                          {isSelected(comp.id) && (
                            <div className="flex items-center gap-1">
                              <Label className="text-xs text-muted-foreground">
                                {t("adminWizard.step2.weight")}
                              </Label>
                              <Input
                                type="number"
                                min={0.5}
                                max={10}
                                step={0.5}
                                className="h-7 w-16 text-xs"
                                value={getWeight(comp.id) ?? ""}
                                onChange={(e) =>
                                  dispatch({
                                    type: "SET_COMPETENCY_WEIGHT",
                                    competencyId: comp.id,
                                    weight: e.target.value
                                      ? Number(e.target.value)
                                      : null,
                                  })
                                }
                                placeholder="-"
                              />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
