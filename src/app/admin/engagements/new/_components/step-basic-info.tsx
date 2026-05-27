"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import type { Organization } from "@/types/database";
import { useWizard, useWizardDispatch } from "./wizard-context";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createOrganizationAction } from "../actions";

type Props = {
  organizations: Organization[];
};

export function StepBasicInfo({ organizations: initialOrgs }: Props) {
  const state = useWizard();
  const dispatch = useWizardDispatch();
  const { t } = useTranslation();
  const [orgs, setOrgs] = useState(initialOrgs);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");
  const [newOrgIndustry, setNewOrgIndustry] = useState("");
  const [newOrgCountry, setNewOrgCountry] = useState("");
  const [creating, setCreating] = useState(false);

  const handleCreateOrg = async () => {
    if (!newOrgName.trim()) return;
    setCreating(true);
    const result = await createOrganizationAction({
      name: newOrgName,
      industry: newOrgIndustry || undefined,
      country: newOrgCountry || undefined,
    });
    setCreating(false);

    if ("data" in result && result.data) {
      const newOrg = {
        ...result.data,
        industry: newOrgIndustry || null,
        country: newOrgCountry || null,
        contact_name: null,
        contact_email: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      setOrgs((prev) => [...prev, newOrg]);
      dispatch({
        type: "SET_BASIC_INFO",
        field: "organizationId",
        value: result.data.id,
      });
      setDialogOpen(false);
      setNewOrgName("");
      setNewOrgIndustry("");
      setNewOrgCountry("");
      toast.success(t("adminWizard.step1.orgCreatedToast"));
    } else if ("error" in result) {
      toast.error(typeof result.error === "string" ? result.error : t("adminWizard.step1.orgCreateFailedToast"));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("adminWizard.step1.title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Organization */}
        <div className="space-y-2">
          <Label>{t("adminWizard.step1.clientOrganization")}</Label>
          <div className="flex gap-2">
            <Select
              value={state.organizationId}
              onValueChange={(value) =>
                dispatch({
                  type: "SET_BASIC_INFO",
                  field: "organizationId",
                  value,
                })
              }
            >
              <SelectTrigger className="flex-1">
                <SelectValue placeholder={t("adminWizard.step1.selectOrganization")} />
              </SelectTrigger>
              <SelectContent>
                {orgs.map((org) => (
                  <SelectItem key={org.id} value={org.id}>
                    {org.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">{t("adminWizard.step1.newButton")}</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t("adminWizard.step1.createOrganization")}</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label>{t("adminWizard.step1.name")}</Label>
                    <Input
                      value={newOrgName}
                      onChange={(e) => setNewOrgName(e.target.value)}
                      placeholder={t("adminWizard.step1.organizationNamePlaceholder")}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>{t("adminWizard.step1.industry")}</Label>
                    <Input
                      value={newOrgIndustry}
                      onChange={(e) => setNewOrgIndustry(e.target.value)}
                      placeholder={t("adminWizard.step1.industryPlaceholder")}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>{t("adminWizard.step1.country")}</Label>
                    <Input
                      value={newOrgCountry}
                      onChange={(e) => setNewOrgCountry(e.target.value)}
                      placeholder={t("adminWizard.step1.countryPlaceholder")}
                    />
                  </div>
                  <Button
                    onClick={handleCreateOrg}
                    disabled={!newOrgName.trim() || creating}
                    className="w-full"
                  >
                    {creating ? t("adminWizard.step1.creating") : t("adminWizard.step1.createOrganization")}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Project Name */}
        <div className="space-y-2">
          <Label>{t("adminWizard.step1.projectName")}</Label>
          <Input
            value={state.engagementName}
            onChange={(e) =>
              dispatch({
                type: "SET_BASIC_INFO",
                field: "engagementName",
                value: e.target.value,
              })
            }
            placeholder={t("adminWizard.step1.projectNamePlaceholder")}
          />
        </div>

        {/* Target Role */}
        <div className="space-y-2">
          <Label>{t("adminWizard.step1.targetRole")}</Label>
          <Input
            value={state.targetRole}
            onChange={(e) =>
              dispatch({
                type: "SET_BASIC_INFO",
                field: "targetRole",
                value: e.target.value,
              })
            }
            placeholder={t("adminWizard.step1.targetRolePlaceholder")}
          />
        </div>

        {/* Assessment Type & Norm Group */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>{t("adminWizard.step1.assessmentType")}</Label>
            <Select
              value={state.assessmentType}
              onValueChange={(value) =>
                dispatch({ type: "SET_BASIC_INFO", field: "assessmentType", value })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder={t("adminWizard.step1.selectType")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="professional">{t("adminWizard.step1.assessmentTypes.professional")}</SelectItem>
                <SelectItem value="graduate">{t("adminWizard.step1.assessmentTypes.graduate")}</SelectItem>
                <SelectItem value="leadership">{t("adminWizard.step1.assessmentTypes.leadership")}</SelectItem>
                <SelectItem value="other">{t("adminWizard.step1.assessmentTypes.other")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t("adminWizard.step1.normGroup")}</Label>
            <Select
              value={state.normGroup}
              onValueChange={(value) =>
                dispatch({ type: "SET_BASIC_INFO", field: "normGroup", value })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder={t("adminWizard.step1.selectNormGroup")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gcc_banking">{t("adminWizard.step1.normGroups.gccBanking")}</SelectItem>
                <SelectItem value="gcc_government">{t("adminWizard.step1.normGroups.gccGovernment")}</SelectItem>
                <SelectItem value="mena_corporate">{t("adminWizard.step1.normGroups.menaCorporate")}</SelectItem>
                <SelectItem value="global_corporate">{t("adminWizard.step1.normGroups.globalCorporate")}</SelectItem>
                <SelectItem value="graduate_program">{t("adminWizard.step1.normGroups.graduateProgram")}</SelectItem>
                <SelectItem value="custom">{t("adminWizard.step1.normGroups.custom")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Dates */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>{t("adminWizard.step1.startDate")}</Label>
            <Input
              type="date"
              value={state.startDate}
              onChange={(e) =>
                dispatch({
                  type: "SET_BASIC_INFO",
                  field: "startDate",
                  value: e.target.value,
                })
              }
            />
          </div>
          <div className="space-y-2">
            <Label>{t("adminWizard.step1.endDate")}</Label>
            <Input
              type="date"
              value={state.endDate}
              min={state.startDate || undefined}
              onChange={(e) =>
                dispatch({
                  type: "SET_BASIC_INFO",
                  field: "endDate",
                  value: e.target.value,
                })
              }
            />
            {state.startDate && state.endDate && state.endDate < state.startDate && (
              <p className="text-xs text-destructive">{t("adminWizard.step1.endDateError")}</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
