"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { createRequisitionAction } from "../../actions";

type Props = {
  roleProfiles: { id: string; name_en: string }[];
  organizations: { id: string; name: string }[];
  defaultOrgId?: string;
};

// Default weight + cut-score per stage. Weights are normalized at scoring time,
// so picking a subset still works; these can be made editable in a later pass.
const STAGES: { kind: "fluent" | "quiz" | "cbi"; label: string; weight: number; cut: number }[] = [
  { kind: "quiz", label: "Competency Quiz", weight: 0.4, cut: 60 },
  { kind: "fluent", label: "English (Fluent)", weight: 0.3, cut: 50 },
  { kind: "cbi", label: "AI Interview", weight: 0.3, cut: 60 },
];

export function RequisitionForm({ roleProfiles, organizations, defaultOrgId }: Props) {
  const router = useRouter();
  const { t } = useTranslation();
  const [title, setTitle] = useState("");
  const [orgId, setOrgId] = useState(defaultOrgId ?? "");
  const [roleProfileId, setRoleProfileId] = useState("");
  const [level, setLevel] = useState("");
  const [englishRequired, setEnglishRequired] = useState(false);
  const [stages, setStages] = useState<Record<string, boolean>>({ quiz: true, fluent: true, cbi: false });
  const [submitting, setSubmitting] = useState(false);

  const toggleStage = (kind: string) =>
    setStages((s) => ({ ...s, [kind]: !s[kind] }));

  const handleSubmit = async () => {
    const stage_config = STAGES.filter((s) => stages[s.kind]).map((s) => ({
      kind: s.kind,
      weight: s.weight,
      cut_score: s.cut,
      required: false,
    }));
    if (stage_config.length === 0) {
      toast.error(t("prehire.errPickStage"));
      return;
    }
    if (!orgId) {
      toast.error(t("prehire.errPickOrg"));
      return;
    }
    setSubmitting(true);
    const res = await createRequisitionAction({
      organization_id: orgId,
      title,
      role_profile_id: roleProfileId || null,
      level: level || undefined,
      english_required: englishRequired,
      stage_config,
    });
    setSubmitting(false);
    if ("error" in res) {
      toast.error(res.error);
      return;
    }
    toast.success(t("prehire.createdOk"));
    router.push(`/admin/prehire/${res.data.id}`);
  };

  return (
    <Card>
      <CardContent className="space-y-5 pt-6">
        <div className="space-y-2">
          <Label htmlFor="title">{t("prehire.roleTitleLabel")}</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("prehire.roleTitlePh")}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="org">{t("prehire.orgLabel")}</Label>
            <select
              id="org"
              value={orgId}
              onChange={(e) => setOrgId(e.target.value)}
              className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">{t("prehire.orgPlaceholder")}</option>
              {organizations.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
            {organizations.length === 0 && (
              <p className="text-xs text-amber-600">
                {t("prehire.noOrgs")}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="level">{t("prehire.levelLabel")}</Label>
            <Input
              id="level"
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              placeholder={t("prehire.levelPh")}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="rp">{t("prehire.roleProfileLabel")}</Label>
          <select
            id="rp"
            value={roleProfileId}
            onChange={(e) => setRoleProfileId(e.target.value)}
            className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">{t("prehire.noneOption")}</option>
            {roleProfiles.map((p) => (
              <option key={p.id} value={p.id}>{p.name_en}</option>
            ))}
          </select>
        </div>

        <div className="space-y-3">
          <Label>{t("prehire.stagesLabel")}</Label>
          <div className="space-y-2">
            {STAGES.map((s) => (
              <div key={s.kind} className="flex items-center gap-3 rounded-md border p-3">
                <Checkbox
                  id={`stage-${s.kind}`}
                  checked={!!stages[s.kind]}
                  onCheckedChange={() => toggleStage(s.kind)}
                />
                <Label htmlFor={`stage-${s.kind}`} className="flex-1 cursor-pointer">
                  {t(`prehire.stageLabels.${s.kind}`)}
                </Label>
                <span className="text-xs text-muted-foreground">
                  {t("prehire.weightCut", { weight: s.weight, cut: s.cut })}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Checkbox
            id="english"
            checked={englishRequired}
            onCheckedChange={(c) => setEnglishRequired(c === true)}
          />
          <Label htmlFor="english" className="cursor-pointer">
            {t("prehire.englishRelevant")}
          </Label>
        </div>

        <Button onClick={handleSubmit} disabled={submitting || !title} className="w-full">
          {submitting ? t("prehire.creating") : t("prehire.createReq")}
        </Button>
      </CardContent>
    </Card>
  );
}
