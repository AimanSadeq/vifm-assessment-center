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
import { createRequisitionAction, createPrehireOrgAction } from "../../actions";

type Props = {
  roleProfiles: { id: string; name_en: string }[];
  organizations: { id: string; name: string }[];
  defaultOrgId?: string;
};

type StageKind = "quiz" | "fluent" | "cbi";
type StageState = { included: boolean; weight: number; cut: number };

// Starting weights + cut-scores per stage; all now editable in the wizard
// (CAL-PH-505). Weights are normalized over the included stages at scoring time,
// so they need not sum to 1.
const STAGE_LABELS: Record<StageKind, string> = {
  quiz: "Competency Quiz",
  fluent: "English (Fluent)",
  cbi: "AI Interview",
};
const INITIAL_STAGES: Record<StageKind, StageState> = {
  quiz: { included: true, weight: 0.4, cut: 60 },
  fluent: { included: true, weight: 0.3, cut: 50 },
  cbi: { included: false, weight: 0.3, cut: 60 },
};

export function RequisitionForm({ roleProfiles, organizations: initialOrgs, defaultOrgId }: Props) {
  const router = useRouter();
  const { t } = useTranslation();
  const [title, setTitle] = useState("");
  const [organizations, setOrganizations] = useState(initialOrgs);
  const [orgId, setOrgId] = useState(defaultOrgId ?? "");
  const [roleProfileId, setRoleProfileId] = useState("");
  const [level, setLevel] = useState("");
  const [stages, setStages] = useState<Record<StageKind, StageState>>(INITIAL_STAGES);
  const [submitting, setSubmitting] = useState(false);

  // Inline client creation (CAL-PH-504).
  const [showNewOrg, setShowNewOrg] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");
  const [creatingOrg, setCreatingOrg] = useState(false);

  const setStage = (kind: StageKind, patch: Partial<StageState>) =>
    setStages((s) => ({ ...s, [kind]: { ...s[kind], ...patch } }));

  // CAL-PH-503: English requirement DRIVES the Fluent stage. The single Fluent
  // toggle both includes the English assessment and flags the requisition's
  // english_required - there is no longer a separate, dangling English checkbox.
  const englishRequired = stages.fluent.included;

  async function handleCreateOrg() {
    const name = newOrgName.trim();
    if (name.length < 2) {
      toast.error(t("prehire.errOrgName", "Enter a client name."));
      return;
    }
    setCreatingOrg(true);
    const res = await createPrehireOrgAction({ name });
    setCreatingOrg(false);
    if ("error" in res) {
      toast.error(res.error);
      return;
    }
    // Insert (or surface) the org and select it.
    setOrganizations((prev) =>
      prev.some((o) => o.id === res.data.id) ? prev : [...prev, { id: res.data.id, name: res.data.name }].sort((a, b) => a.name.localeCompare(b.name)),
    );
    setOrgId(res.data.id);
    setNewOrgName("");
    setShowNewOrg(false);
    toast.success(t("prehire.orgCreated", "Client added."));
  }

  const handleSubmit = async () => {
    const clamp = (v: number, lo: number, hi: number) =>
      Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : lo;
    const stage_config = (Object.keys(stages) as StageKind[])
      .filter((k) => stages[k].included)
      .map((k) => ({
        kind: k,
        weight: clamp(stages[k].weight, 0, 1),
        cut_score: clamp(stages[k].cut, 0, 100),
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
            <div className="flex items-center justify-between">
              <Label htmlFor="org">{t("prehire.orgLabel")}</Label>
              <button
                type="button"
                onClick={() => setShowNewOrg((v) => !v)}
                className="text-xs font-medium text-[#5391D5] hover:underline"
              >
                {showNewOrg ? t("prehire.cancelNewOrg", "Cancel") : t("prehire.addNewOrg", "+ New client")}
              </button>
            </div>
            {showNewOrg ? (
              <div className="flex items-center gap-2">
                <Input
                  value={newOrgName}
                  onChange={(e) => setNewOrgName(e.target.value)}
                  placeholder={t("prehire.newOrgPh", "New client name")}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void handleCreateOrg();
                    }
                  }}
                />
                <Button type="button" onClick={handleCreateOrg} disabled={creatingOrg} variant="secondary">
                  {creatingOrg ? t("prehire.creating") : t("prehire.addBtn", "Add")}
                </Button>
              </div>
            ) : (
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
            )}
            {!showNewOrg && organizations.length === 0 && (
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
          <p className="text-xs text-muted-foreground">
            {t(
              "prehire.stagesHint",
              "Tick a stage to include it, then set its weight (0-1, normalized across included stages) and cut-score. English (Fluent) runs only when the role requires English.",
            )}
          </p>
          <div className="space-y-2">
            {(Object.keys(stages) as StageKind[]).map((kind) => {
              const st = stages[kind];
              return (
                <div key={kind} className="flex flex-wrap items-center gap-3 rounded-md border p-3">
                  <Checkbox
                    id={`stage-${kind}`}
                    checked={st.included}
                    onCheckedChange={(c) => setStage(kind, { included: c === true })}
                  />
                  <Label htmlFor={`stage-${kind}`} className="flex-1 min-w-[8rem] cursor-pointer">
                    {t(`prehire.stageLabels.${kind}`, STAGE_LABELS[kind])}
                    {kind === "fluent" && (
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        {t("prehire.fluentDriver", "English required")}
                      </span>
                    )}
                  </Label>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-muted-foreground">{t("prehire.weightShort", "Weight")}</span>
                    <Input
                      type="number"
                      min={0}
                      max={1}
                      step={0.05}
                      value={st.weight}
                      disabled={!st.included}
                      onChange={(e) => setStage(kind, { weight: Number(e.target.value) })}
                      className="h-8 w-20"
                    />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-muted-foreground">{t("prehire.cutShort", "Cut")}</span>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step={1}
                      value={st.cut}
                      disabled={!st.included}
                      onChange={(e) => setStage(kind, { cut: Number(e.target.value) })}
                      className="h-8 w-20"
                    />
                  </div>
                </div>
              );
            })}
          </div>
          {englishRequired && (
            <p className="text-xs text-muted-foreground">
              {t("prehire.englishOnNote", "This role is flagged as requiring English - the Fluent assessment is included.")}{" "}
              {t(
                "prehire.englishScoringNote",
                "The flag only controls whether the English (Fluent) stage runs; it carries no separate scoring weight. English counts toward the composite solely through the Fluent stage's own weight and cut-score above.",
              )}
            </p>
          )}
        </div>

        <Button onClick={handleSubmit} disabled={submitting || !title} className="w-full">
          {submitting ? t("prehire.creating") : t("prehire.createReq")}
        </Button>
      </CardContent>
    </Card>
  );
}
