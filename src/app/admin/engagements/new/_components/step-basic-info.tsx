"use client";

import { useState } from "react";
import { toast } from "sonner";
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
      toast.success("Organization created");
    } else if ("error" in result) {
      toast.error(typeof result.error === "string" ? result.error : "Failed to create organization");
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

        {/* Project Name */}
        <div className="space-y-2">
          <Label>Project Name *</Label>
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

        {/* Assessment Type & Norm Group */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Assessment Type</Label>
            <Select
              value={state.assessmentType}
              onValueChange={(value) =>
                dispatch({ type: "SET_BASIC_INFO", field: "assessmentType", value })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select type..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="professional">Professional</SelectItem>
                <SelectItem value="graduate">Graduate</SelectItem>
                <SelectItem value="leadership">Leadership</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Norm / Comparison Group</Label>
            <Select
              value={state.normGroup}
              onValueChange={(value) =>
                dispatch({ type: "SET_BASIC_INFO", field: "normGroup", value })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select norm group..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gcc_banking">GCC Banking</SelectItem>
                <SelectItem value="gcc_government">GCC Government</SelectItem>
                <SelectItem value="mena_corporate">MENA Corporate</SelectItem>
                <SelectItem value="global_corporate">Global Corporate</SelectItem>
                <SelectItem value="graduate_program">Graduate Program</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>
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
              <p className="text-xs text-destructive">End date must be after start date</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
