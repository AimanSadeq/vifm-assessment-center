"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
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
      toast.error(t("candidateWelcome.form.saveFail"));
    } else {
      setSaved(true);
      toast.success(t("candidateWelcome.form.saveSuccess"));
    }
  };

  return (
    <div className="rounded-md border p-4 space-y-3">
      <p className="text-sm font-medium">{t("candidateWelcome.form.title")}</p>
      <p className="text-xs text-muted-foreground">
        {t("candidateWelcome.form.subtitle")}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">{t("candidateWelcome.form.idLabel")}</Label>
          <Input
            value={nationalId}
            onChange={(e) => { setNationalId(e.target.value); setSaved(false); }}
            placeholder={t("candidateWelcome.form.idPlaceholder")}
            className="h-8 text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t("candidateWelcome.form.departmentLabel")}</Label>
          <Input
            value={department}
            onChange={(e) => { setDepartment(e.target.value); setSaved(false); }}
            placeholder={t("candidateWelcome.form.departmentPlaceholder")}
            className="h-8 text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t("candidateWelcome.form.genderLabel")}</Label>
          <Select value={gender} onValueChange={(v) => { setGender(v); setSaved(false); }}>
            <SelectTrigger className="h-8 text-sm">
              <SelectValue placeholder={t("candidateWelcome.form.genderPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="male">{t("candidateWelcome.form.genderMale")}</SelectItem>
              <SelectItem value="female">{t("candidateWelcome.form.genderFemale")}</SelectItem>
              <SelectItem value="prefer_not_to_say">{t("candidateWelcome.form.genderPreferNot")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t("candidateWelcome.form.roleLabel")}</Label>
          <Input
            value={functionRole}
            onChange={(e) => { setFunctionRole(e.target.value); setSaved(false); }}
            placeholder={t("candidateWelcome.form.rolePlaceholder")}
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
        {saving ? t("candidateWelcome.form.saving") : saved ? t("candidateWelcome.form.saved") : t("candidateWelcome.form.save")}
      </Button>
    </div>
  );
}
