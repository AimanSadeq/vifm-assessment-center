"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";

type Props = {
  candidateId: string;
  initialData: {
    department: string;
    gender: string;
    functionRole: string;
    nationalIdHash: string;
  };
};

export function CandidateDemographicsForm({ candidateId, initialData }: Props) {
  const [department, setDepartment] = useState(initialData.department);
  const [gender, setGender] = useState(initialData.gender);
  const [functionRole, setFunctionRole] = useState(initialData.functionRole);
  const [nationalId, setNationalId] = useState(initialData.nationalIdHash);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(!!initialData.department || !!initialData.gender);

  const handleSave = async () => {
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("candidates")
      .update({
        department: department || null,
        gender: gender || null,
        function_role: functionRole || null,
        national_id_hash: nationalId || null,
      })
      .eq("id", candidateId);

    setSaving(false);
    if (error) {
      toast.error("Failed to save profile");
    } else {
      setSaved(true);
      toast.success("Profile updated");
    }
  };

  return (
    <div className="rounded-md border p-4 space-y-3">
      <p className="text-sm font-medium">Your Profile Details</p>
      <p className="text-xs text-muted-foreground">
        Please provide the following information for tracking and identification purposes.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">ID / Employee Number</Label>
          <Input
            value={nationalId}
            onChange={(e) => { setNationalId(e.target.value); setSaved(false); }}
            placeholder="e.g., EMP-12345"
            className="h-8 text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Department / Function</Label>
          <Input
            value={department}
            onChange={(e) => { setDepartment(e.target.value); setSaved(false); }}
            placeholder="e.g., Finance"
            className="h-8 text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Gender</Label>
          <Select value={gender} onValueChange={(v) => { setGender(v); setSaved(false); }}>
            <SelectTrigger className="h-8 text-sm">
              <SelectValue placeholder="Select..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="male">Male</SelectItem>
              <SelectItem value="female">Female</SelectItem>
              <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Role / Job Title</Label>
          <Input
            value={functionRole}
            onChange={(e) => { setFunctionRole(e.target.value); setSaved(false); }}
            placeholder="e.g., Senior Analyst"
            className="h-8 text-sm"
          />
        </div>
      </div>
      <Button
        size="sm"
        onClick={handleSave}
        disabled={saving || saved}
        variant={saved ? "outline" : "default"}
      >
        {saving ? "Saving..." : saved ? "Saved" : "Save Profile"}
      </Button>
    </div>
  );
}
