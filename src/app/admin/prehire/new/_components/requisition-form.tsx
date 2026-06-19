"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Sparkles, Loader2, Upload } from "lucide-react";
import { createRequisitionAction, createPrehireOrgAction } from "../../actions";
// Reuse the SAME job-design backend as the AC engagement wizard - paste/upload a
// JD, Claude maps it to the behavioural 38, and we pre-fill the quiz competency
// set (the "designed role").
import {
  extractCompetenciesFromJdAction,
  extractCompetenciesFromJdFileAction,
} from "../../../engagements/new/actions";
import { FLUENT_SKILLS, RECEPTIVE_FLUENT_SKILLS, type FluentSkill } from "@/types/prehire";

type RoleProfileOption = {
  id: string;
  name_en: string;
  competencies: {
    competencyId: string;
    weight: number | null;
    priority: string | null;
  }[];
};

type CompetencyOption = {
  id: string;
  name: string;
  domainName: string;
  domainSort: number;
  sortOrder: number;
};

type Props = {
  roleProfiles: RoleProfileOption[];
  organizations: { id: string; name: string }[];
  defaultOrgId?: string;
  competencies: CompetencyOption[];
};

type StageKind = "quiz" | "fluent" | "cbi";
type StageState = { included: boolean; weight: number; cut: number };

const FLUENT_SKILL_LABELS: Record<FluentSkill, string> = {
  reading: "Reading",
  listening: "Listening",
  writing: "Writing",
  speaking: "Speaking",
};

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

export function RequisitionForm({
  roleProfiles,
  organizations: initialOrgs,
  defaultOrgId,
  competencies,
}: Props) {
  const router = useRouter();
  const { t } = useTranslation();
  const [title, setTitle] = useState("");
  const [organizations, setOrganizations] = useState(initialOrgs);
  const [orgId, setOrgId] = useState(defaultOrgId ?? "");
  const [roleProfileId, setRoleProfileId] = useState("");
  const [level, setLevel] = useState("");
  const [stages, setStages] = useState<Record<StageKind, StageState>>(INITIAL_STAGES);
  // CAL-PRE-503: which Fluent CEFR sub-skills to administer. Defaults to all four;
  // only attached to stage_config when the Fluent stage is included.
  const [fluentSkills, setFluentSkills] = useState<Set<FluentSkill>>(new Set(FLUENT_SKILLS));
  const [submitting, setSubmitting] = useState(false);

  // CAL-PRE-502: the quiz competency set. Pre-filled from the chosen role profile
  // but editable (add/remove from the behavioural 38). `competencyDirty` tracks
  // whether the user has manually edited - while clean, switching role profiles
  // re-prefills; once dirty, switching profiles leaves their edits alone (a
  // "reset to role default" button restores the profile's set on demand).
  const [selectedCompetencies, setSelectedCompetencies] = useState<Set<string>>(new Set());
  const [competencyDirty, setCompetencyDirty] = useState(false);

  // Competencies grouped by domain (stable order) for a readable picker.
  const competenciesByDomain = useMemo(() => {
    const groups = new Map<string, { domainName: string; domainSort: number; items: CompetencyOption[] }>();
    for (const c of competencies) {
      const g = groups.get(c.domainName);
      if (g) g.items.push(c);
      else groups.set(c.domainName, { domainName: c.domainName, domainSort: c.domainSort, items: [c] });
    }
    return Array.from(groups.values())
      .sort((a, b) => a.domainSort - b.domainSort || a.domainName.localeCompare(b.domainName))
      .map((g) => ({ ...g, items: g.items.slice().sort((a, b) => a.sortOrder - b.sortOrder) }));
  }, [competencies]);

  // The valid competency-id set the role profile maps to (some role_profile rows
  // may reference a competency no longer in the catalogue - keep only real ones).
  const competencyIdSet = useMemo(() => new Set(competencies.map((c) => c.id)), [competencies]);
  const roleProfileDefaultIds = (profileId: string): string[] => {
    const profile = roleProfiles.find((p) => p.id === profileId);
    if (!profile) return [];
    return profile.competencies.map((c) => c.competencyId).filter((id) => competencyIdSet.has(id));
  };
  const currentProfileDefaults = roleProfileDefaultIds(roleProfileId);

  const handleRoleProfileChange = (id: string) => {
    setRoleProfileId(id);
    // Pre-fill the competency picker from the new profile, but only while the
    // user hasn't manually edited the set (so a deliberate selection survives).
    if (!competencyDirty) {
      setSelectedCompetencies(new Set(roleProfileDefaultIds(id)));
    }
  };

  const toggleCompetency = (id: string, on: boolean) => {
    setCompetencyDirty(true);
    setSelectedCompetencies((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const resetCompetenciesToRoleDefault = () => {
    setSelectedCompetencies(new Set(roleProfileDefaultIds(roleProfileId)));
    setCompetencyDirty(false);
  };

  // Design-the-role-from-a-JD panel (reuses the AC wizard's extractor backend).
  const [showJd, setShowJd] = useState(false);
  const [jdText, setJdText] = useState("");
  const [jdFile, setJdFile] = useState<File | null>(null);
  const [extractingJd, setExtractingJd] = useState(false);

  async function handleExtractJd() {
    setExtractingJd(true);
    try {
      const res = jdFile
        ? await (async () => {
            const fd = new FormData();
            fd.set("file", jdFile);
            if (title.trim()) fd.set("targetRole", title.trim());
            return extractCompetenciesFromJdFileAction(fd);
          })()
        : await extractCompetenciesFromJdAction({
            jobDescription: jdText,
            targetRole: title.trim() || undefined,
          });
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      // Map the AI's recommendations to catalogue competency ids we can score.
      const ids = res.recommendations
        .map((r) => r.competencyId)
        .filter((id) => competencyIdSet.has(id));
      if (ids.length === 0) {
        toast.error(t("prehire.jdNoMatch", "No matching competencies were found in this JD."));
        return;
      }
      setSelectedCompetencies(new Set(ids));
      setCompetencyDirty(true);
      // The designed set drives the quiz, so make sure that stage is on.
      setStage("quiz", { included: true });
      toast.success(
        t("prehire.jdDesigned", "Designed {{count}} competencies from the job description.", {
          count: ids.length,
        }),
      );
      setShowJd(false);
      setJdText("");
      setJdFile(null);
    } finally {
      setExtractingJd(false);
    }
  }

  // Inline client creation (CAL-PH-504).
  const [showNewOrg, setShowNewOrg] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");
  const [creatingOrg, setCreatingOrg] = useState(false);

  const setStage = (kind: StageKind, patch: Partial<StageState>) =>
    setStages((s) => ({ ...s, [kind]: { ...s[kind], ...patch } }));

  const toggleFluentSkill = (skill: FluentSkill, on: boolean) =>
    setFluentSkills((prev) => {
      const next = new Set(prev);
      if (on) next.add(skill);
      else next.delete(skill);
      return next;
    });

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
    // CAL-PRE-503: a placement with any skill dropped must still keep at least
    // one receptive skill (reading or listening) to stay defensible.
    if (stages.fluent.included && !RECEPTIVE_FLUENT_SKILLS.some((s) => fluentSkills.has(s))) {
      toast.error(
        t(
          "prehire.errFluentReceptive",
          "Select at least one receptive English skill (Reading or Listening).",
        ),
      );
      return;
    }
    // Preserve the canonical skill order; attach skills to the Fluent entry only.
    const orderedFluentSkills = FLUENT_SKILLS.filter((s) => fluentSkills.has(s));
    const stage_config = (Object.keys(stages) as StageKind[])
      .filter((k) => stages[k].included)
      .map((k) => ({
        kind: k,
        weight: clamp(stages[k].weight, 0, 1),
        cut_score: clamp(stages[k].cut, 0, 100),
        required: false,
        ...(k === "fluent" ? { skills: orderedFluentSkills } : {}),
      }));
    if (stage_config.length === 0) {
      toast.error(t("prehire.errPickStage"));
      return;
    }
    if (!orgId) {
      toast.error(t("prehire.errPickOrg"));
      return;
    }
    // CAL-PRE-502: only carry the competency set when the quiz stage runs (it has
    // no meaning otherwise). Keep the catalogue order for a stable, readable array.
    const competency_ids = stages.quiz.included
      ? competencies.map((c) => c.id).filter((id) => selectedCompetencies.has(id))
      : [];

    setSubmitting(true);
    const res = await createRequisitionAction({
      organization_id: orgId,
      title,
      role_profile_id: roleProfileId || null,
      level: level || undefined,
      english_required: englishRequired,
      stage_config,
      competency_ids,
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
          <div className="flex items-center justify-between">
            <Label htmlFor="rp">{t("prehire.roleProfileLabel")}</Label>
            <button
              type="button"
              onClick={() => setShowJd((v) => !v)}
              className="inline-flex items-center gap-1 text-xs font-medium text-[#5391D5] hover:underline"
            >
              <Sparkles className="h-3.5 w-3.5" />
              {showJd
                ? t("prehire.cancelJd", "Cancel")
                : t("prehire.designFromJd", "Design from a job description")}
            </button>
          </div>
          <select
            id="rp"
            value={roleProfileId}
            onChange={(e) => handleRoleProfileChange(e.target.value)}
            className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">{t("prehire.noneOption")}</option>
            {roleProfiles.map((p) => (
              <option key={p.id} value={p.id}>{p.name_en}</option>
            ))}
          </select>

          {/* Design the role from a JD - reuses the AC engagement extractor. The
              extracted competencies pre-fill the quiz competency set below. */}
          {showJd && (
            <div className="rounded-md border bg-muted/20 p-3 space-y-2">
              <p className="text-xs text-muted-foreground">
                {t(
                  "prehire.designFromJdHint",
                  "Paste a job description (or upload a PDF/TXT). VIFM's AI maps it to the behavioural competency framework and pre-fills the quiz competency set below - the same engine the Assessment Center uses.",
                )}
              </p>
              <Textarea
                value={jdText}
                onChange={(e) => setJdText(e.target.value)}
                placeholder={t("prehire.jdPlaceholder", "Paste the job description here (at least 50 characters)...")}
                className="min-h-[120px] text-sm"
                disabled={!!jdFile}
              />
              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex items-center gap-1.5 text-xs font-medium text-[#5391D5] cursor-pointer hover:underline">
                  <Upload className="h-3.5 w-3.5" />
                  {jdFile ? jdFile.name : t("prehire.jdUpload", "Upload PDF / TXT")}
                  <input
                    type="file"
                    accept=".pdf,.txt,application/pdf,text/plain"
                    className="hidden"
                    onChange={(e) => setJdFile(e.target.files?.[0] ?? null)}
                  />
                </label>
                {jdFile && (
                  <button
                    type="button"
                    onClick={() => setJdFile(null)}
                    className="text-xs text-muted-foreground hover:underline"
                  >
                    {t("prehire.jdClearFile", "Remove file")}
                  </button>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="ms-auto"
                  onClick={handleExtractJd}
                  disabled={extractingJd || (!jdFile && jdText.trim().length < 50)}
                >
                  {extractingJd ? (
                    <><Loader2 className="h-3.5 w-3.5 animate-spin" /> {t("prehire.jdExtracting", "Designing...")}</>
                  ) : (
                    <><Sparkles className="h-3.5 w-3.5" /> {t("prehire.jdExtract", "Extract competencies")}</>
                  )}
                </Button>
              </div>
            </div>
          )}
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
                <div key={kind} className="rounded-md border p-3">
                  <div className="flex flex-wrap items-center gap-3">
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

                  {/* CAL-PRE-503: pick which CEFR sub-skills run for the English stage. */}
                  {kind === "fluent" && st.included && (
                    <div className="mt-3 border-t pt-3">
                      <p className="mb-2 text-xs font-medium text-muted-foreground">
                        {t("prehire.fluentSkillsLabel", "English sub-skills to assess")}
                      </p>
                      <div className="flex flex-wrap gap-x-5 gap-y-2">
                        {FLUENT_SKILLS.map((skill) => (
                          <label
                            key={skill}
                            className="flex cursor-pointer items-center gap-2 text-sm"
                          >
                            <Checkbox
                              checked={fluentSkills.has(skill)}
                              onCheckedChange={(c) => toggleFluentSkill(skill, c === true)}
                            />
                            <span>{t(`prehire.fluentSkills.${skill}`, FLUENT_SKILL_LABELS[skill])}</span>
                          </label>
                        ))}
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {t(
                          "prehire.fluentSkillsHint",
                          "Keep at least one receptive skill (Reading or Listening). Dropping any skill produces a partial placement, not a full Overall CEFR.",
                        )}
                      </p>
                    </div>
                  )}
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

        {/* CAL-PRE-502: quiz competency picker - only relevant when the quiz stage runs. */}
        {stages.quiz.included && competencies.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>{t("prehire.quizCompetenciesLabel", "Quiz competencies")}</Label>
              {currentProfileDefaults.length > 0 && (
                <button
                  type="button"
                  onClick={resetCompetenciesToRoleDefault}
                  className="text-xs font-medium text-[#5391D5] hover:underline"
                >
                  {t("prehire.resetToRoleDefault", "Reset to role default")}
                </button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {t(
                "prehire.quizCompetenciesHint",
                "The competency quiz draws its questions from this set, pre-filled from the role profile and editable. Leave it empty to fall back to the role profile (or a generic deck). The quiz stays about 7 questions regardless of how many you pick - the highest-weighted competencies are sampled.",
              )}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("prehire.quizCompetenciesCount", "{{count}} selected", {
                count: selectedCompetencies.size,
              })}
            </p>
            <div className="space-y-3 rounded-md border p-3">
              {competenciesByDomain.map((group) => (
                <div key={group.domainName} className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {group.domainName}
                  </p>
                  <div className="grid grid-cols-1 gap-x-5 gap-y-2 sm:grid-cols-2">
                    {group.items.map((comp) => (
                      <label
                        key={comp.id}
                        className="flex cursor-pointer items-start gap-2 text-sm"
                      >
                        <Checkbox
                          checked={selectedCompetencies.has(comp.id)}
                          onCheckedChange={(c) => toggleCompetency(comp.id, c === true)}
                          className="mt-0.5"
                        />
                        <span>{comp.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <Button onClick={handleSubmit} disabled={submitting || !title} className="w-full">
          {submitting ? t("prehire.creating") : t("prehire.createReq")}
        </Button>
      </CardContent>
    </Card>
  );
}
