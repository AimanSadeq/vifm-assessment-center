"use client";

import { useState } from "react";
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
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Step 1: Basic Information</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Organization */}
        <div className="space-y-2">
          <Label>Client Organization *</Label>
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
                <SelectValue placeholder="Select an organization..." />
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
                <Button variant="outline">+ New</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Organization</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label>Name *</Label>
                    <Input
                      value={newOrgName}
                      onChange={(e) => setNewOrgName(e.target.value)}
                      placeholder="Organization name"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Industry</Label>
                    <Input
                      value={newOrgIndustry}
                      onChange={(e) => setNewOrgIndustry(e.target.value)}
                      placeholder="e.g., Banking, Government"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Country</Label>
                    <Input
                      value={newOrgCountry}
                      onChange={(e) => setNewOrgCountry(e.target.value)}
                      placeholder="e.g., UAE, Saudi Arabia"
                    />
                  </div>
                  <Button
                    onClick={handleCreateOrg}
                    disabled={!newOrgName.trim() || creating}
                    className="w-full"
                  >
                    {creating ? "Creating..." : "Create Organization"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Engagement Name */}
        <div className="space-y-2">
          <Label>Engagement Name *</Label>
          <Input
            value={state.engagementName}
            onChange={(e) =>
              dispatch({
                type: "SET_BASIC_INFO",
                field: "engagementName",
                value: e.target.value,
              })
            }
            placeholder="e.g., ADNOC Senior Manager AC - April 2026"
          />
        </div>

        {/* Target Role */}
        <div className="space-y-2">
          <Label>Target Role</Label>
          <Input
            value={state.targetRole}
            onChange={(e) =>
              dispatch({
                type: "SET_BASIC_INFO",
                field: "targetRole",
                value: e.target.value,
              })
            }
            placeholder="e.g., Senior Manager, Director"
          />
        </div>

        {/* Dates */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Start Date</Label>
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
            <Label>End Date</Label>
            <Input
              type="date"
              value={state.endDate}
              onChange={(e) =>
                dispatch({
                  type: "SET_BASIC_INFO",
                  field: "endDate",
                  value: e.target.value,
                })
              }
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
