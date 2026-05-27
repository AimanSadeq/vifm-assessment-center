"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Trash2, Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Competency, CompetencyTree } from "@/types/database";
import { JdExtractor } from "@/app/admin/engagements/new/_components/jd-extractor";
import {
  createRoleProfileAction,
  updateRoleProfileAction,
} from "../actions";

export type RoleProfileEditorInitial = {
  id?: string;
  profile: {
    name_en: string;
    name_ar: string;
    description: string;
    target_role: string;
    industry: string;
    region: "" | "uae" | "saudi" | "gcc" | "global";
    default_target_proficiency: number | null;
    source_jd: string;
  };
  competencies: {
    competency_id: string;
    weight: number | null;
    priority: "high" | "medium" | "low" | null;
    reasoning: string;
  }[];
};

export const EMPTY_PROFILE_INITIAL: RoleProfileEditorInitial = {
  profile: {
    name_en: "",
    name_ar: "",
    description: "",
    target_role: "",
    industry: "",
    region: "",
    default_target_proficiency: 3,
    source_jd: "",
  },
  competencies: [],
};

const PRIORITY_OPTIONS: ("high" | "medium" | "low")[] = ["high", "medium", "low"];

const priorityTone: Record<"high" | "medium" | "low", string> = {
  high: "bg-red-100 text-red-900",
  medium: "bg-amber-100 text-amber-900",
  low: "bg-slate-100 text-slate-700",
};

type Props = {
  initial: RoleProfileEditorInitial;
  competencyTree: CompetencyTree;
  mode: "create" | "edit";
};

export function RoleProfileEditor({ initial, competencyTree, mode }: Props) {
  const router = useRouter();
  const { t } = useTranslation();
  const [profile, setProfile] = useState(initial.profile);
  const [comps, setComps] = useState(initial.competencies);
  const [saving, setSaving] = useState(false);

  const flat = competencyTree.flatMap((d) =>
    d.clusters.flatMap((c) => c.competencies.map((cp) => ({ comp: cp, cluster: c.cluster, domain: d.domain })))
  );
  const compById = new Map(flat.map((row) => [row.comp.id, row]));

  const updateProfile = <K extends keyof typeof profile>(k: K, v: (typeof profile)[K]) =>
    setProfile((p) => ({ ...p, [k]: v }));

  const removeComp = (id: string) =>
    setComps((cs) => cs.filter((c) => c.competency_id !== id));

  const updateComp = (id: string, patch: Partial<(typeof comps)[number]>) =>
    setComps((cs) => cs.map((c) => (c.competency_id === id ? { ...c, ...patch } : c)));

  const addComp = (comp: Competency) => {
    if (comps.some((c) => c.competency_id === comp.id)) return;
    setComps((cs) => [
      ...cs,
      { competency_id: comp.id, weight: 5, priority: "medium", reasoning: "" },
    ]);
  };

  const onSave = async () => {
    if (!profile.name_en.trim()) {
      toast.error(t("adminRoleProfiles.editor.errNameRequired"));
      return;
    }
    if (comps.length < 4) {
      toast.error(t("adminRoleProfiles.editor.errMinComps"));
      return;
    }

    setSaving(true);
    const payload = {
      profile: {
        ...profile,
        region: profile.region || undefined,
        default_target_proficiency: profile.default_target_proficiency ?? undefined,
        name_ar: profile.name_ar || undefined,
        description: profile.description || undefined,
        target_role: profile.target_role || undefined,
        industry: profile.industry || undefined,
        source_jd: profile.source_jd || undefined,
      },
      competencies: comps.map((c) => ({
        competency_id: c.competency_id,
        weight: c.weight ?? undefined,
        priority: c.priority ?? undefined,
        reasoning: c.reasoning || undefined,
      })),
    };

    const result =
      mode === "edit" && initial.id
        ? await updateRoleProfileAction(initial.id, payload)
        : await createRoleProfileAction(payload);

    setSaving(false);

    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    toast.success(mode === "edit" ? t("adminRoleProfiles.editor.toastUpdated") : t("adminRoleProfiles.editor.toastCreated"));
    router.push(`/admin/role-profiles/${result.data?.id ?? initial.id}`);
    router.refresh();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("adminRoleProfiles.editor.roleDetails")}</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-1 space-y-1.5">
            <Label htmlFor="rp-name-en">{t("adminRoleProfiles.editor.nameEnLabel")}</Label>
            <Input
              id="rp-name-en"
              value={profile.name_en}
              onChange={(e) => updateProfile("name_en", e.target.value)}
              placeholder={t("adminRoleProfiles.editor.nameEnPlaceholder")}
            />
          </div>
          <div className="md:col-span-1 space-y-1.5">
            <Label htmlFor="rp-name-ar">{t("adminRoleProfiles.editor.nameArLabel")}</Label>
            <Input
              id="rp-name-ar"
              value={profile.name_ar}
              onChange={(e) => updateProfile("name_ar", e.target.value)}
              placeholder={t("adminRoleProfiles.editor.nameArPlaceholder")}
              dir="rtl"
            />
          </div>
          <div className="md:col-span-1 space-y-1.5">
            <Label htmlFor="rp-target-role">{t("adminRoleProfiles.editor.targetRoleLabel")}</Label>
            <Input
              id="rp-target-role"
              value={profile.target_role}
              onChange={(e) => updateProfile("target_role", e.target.value)}
              placeholder={t("adminRoleProfiles.editor.targetRolePlaceholder")}
            />
          </div>
          <div className="md:col-span-1 space-y-1.5">
            <Label htmlFor="rp-industry">{t("adminRoleProfiles.editor.industryLabel")}</Label>
            <Input
              id="rp-industry"
              value={profile.industry}
              onChange={(e) => updateProfile("industry", e.target.value)}
              placeholder={t("adminRoleProfiles.editor.industryPlaceholder")}
            />
          </div>
          <div className="md:col-span-1 space-y-1.5">
            <Label htmlFor="rp-region">{t("adminRoleProfiles.editor.regionLabel")}</Label>
            <Select
              value={profile.region || undefined}
              onValueChange={(v) => updateProfile("region", v as typeof profile.region)}
            >
              <SelectTrigger id="rp-region">
                <SelectValue placeholder={t("adminRoleProfiles.editor.regionPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="uae">{t("adminRoleProfiles.editor.regionUae")}</SelectItem>
                <SelectItem value="saudi">{t("adminRoleProfiles.editor.regionSaudi")}</SelectItem>
                <SelectItem value="gcc">{t("adminRoleProfiles.editor.regionGcc")}</SelectItem>
                <SelectItem value="global">{t("adminRoleProfiles.editor.regionGlobal")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-1 space-y-1.5">
            <Label htmlFor="rp-target">{t("adminRoleProfiles.editor.targetProficiencyLabel")}</Label>
            <Input
              id="rp-target"
              type="number"
              min={1}
              max={5}
              step={0.5}
              value={profile.default_target_proficiency ?? ""}
              onChange={(e) =>
                updateProfile(
                  "default_target_proficiency",
                  e.target.value === "" ? null : Number(e.target.value)
                )
              }
            />
            <p className="text-xs text-muted-foreground">
              {t("adminRoleProfiles.editor.targetProficiencyHint")}
            </p>
          </div>
          <div className="md:col-span-2 space-y-1.5">
            <Label htmlFor="rp-description">{t("adminRoleProfiles.editor.descriptionLabel")}</Label>
            <Textarea
              id="rp-description"
              value={profile.description}
              onChange={(e) => updateProfile("description", e.target.value)}
              placeholder={t("adminRoleProfiles.editor.descriptionPlaceholder")}
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>{t("adminRoleProfiles.editor.competenciesTitle")}</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {t("adminRoleProfiles.editor.competenciesCount", { count: comps.length })}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <JdExtractor
                triggerLabel={t("adminRoleProfiles.editor.buildFromJd")}
                onApply={(recs) => {
                  const merged = new Map(comps.map((c) => [c.competency_id, c]));
                  for (const r of recs) {
                    merged.set(r.competencyId, {
                      competency_id: r.competencyId,
                      weight: r.weight,
                      priority: r.priority,
                      reasoning: r.reasoning,
                    });
                  }
                  setComps(Array.from(merged.values()));
                }}
              />
              <CompetencyAddDropdown
                tree={competencyTree}
                excludedIds={new Set(comps.map((c) => c.competency_id))}
                onPick={addComp}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {comps.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              {t("adminRoleProfiles.editor.competenciesEmpty")}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("adminRoleProfiles.editor.colCompetency")}</TableHead>
                  <TableHead className="w-[110px]">{t("adminRoleProfiles.editor.colWeight")}</TableHead>
                  <TableHead className="w-[130px]">{t("adminRoleProfiles.editor.colPriority")}</TableHead>
                  <TableHead>{t("adminRoleProfiles.editor.colWhyMatters")}</TableHead>
                  <TableHead className="w-[40px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {comps.map((c) => {
                  const meta = compById.get(c.competency_id);
                  return (
                    <TableRow key={c.competency_id}>
                      <TableCell>
                        <div>
                          <span className="font-medium text-sm">
                            {meta?.comp.name ?? t("adminRoleProfiles.editor.unknownCompetency")}
                          </span>
                          {meta && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {meta.domain.name} · {meta.cluster.name}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={0.5}
                          max={10}
                          step={0.5}
                          value={c.weight ?? ""}
                          onChange={(e) =>
                            updateComp(c.competency_id, {
                              weight: e.target.value === "" ? null : Number(e.target.value),
                            })
                          }
                          className="h-8"
                        />
                      </TableCell>
                      <TableCell>
                        <Select
                          value={c.priority ?? ""}
                          onValueChange={(v) =>
                            updateComp(c.competency_id, {
                              priority: v as "high" | "medium" | "low",
                            })
                          }
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue placeholder="-">
                              {c.priority && (
                                <Badge variant="secondary" className={priorityTone[c.priority]}>
                                  {t(`adminRoleProfiles.editor.priority.${c.priority}`)}
                                </Badge>
                              )}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {PRIORITY_OPTIONS.map((p) => (
                              <SelectItem key={p} value={p}>
                                {t(`adminRoleProfiles.editor.priority.${p}`)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input
                          value={c.reasoning}
                          onChange={(e) =>
                            updateComp(c.competency_id, { reasoning: e.target.value })
                          }
                          placeholder={t("adminRoleProfiles.editor.reasoningPlaceholder")}
                          className="h-8"
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeComp(c.competency_id)}
                          aria-label={t("adminRoleProfiles.editor.removeCompetency")}
                        >
                          <Trash2 className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={() => router.back()}>
          {t("adminRoleProfiles.editor.cancel")}
        </Button>
        <Button onClick={onSave} disabled={saving || comps.length < 4}>
          <Save className="h-4 w-4 me-2" />
          {saving
            ? t("adminRoleProfiles.editor.saving")
            : mode === "edit"
              ? t("adminRoleProfiles.editor.saveChanges")
              : t("adminRoleProfiles.editor.createRoleProfile")}
        </Button>
      </div>
    </div>
  );
}

function CompetencyAddDropdown({
  tree,
  excludedIds,
  onPick,
}: {
  tree: CompetencyTree;
  excludedIds: Set<string>;
  onPick: (c: Competency) => void;
}) {
  const { t } = useTranslation();
  const flat = tree.flatMap((d) =>
    d.clusters.flatMap((c) =>
      c.competencies
        .filter((cp) => !excludedIds.has(cp.id))
        .map((cp) => ({ comp: cp, label: `${d.domain.name} › ${c.cluster.name} › ${cp.name}` }))
    )
  );

  return (
    <Select
      value=""
      onValueChange={(id) => {
        const found = flat.find((f) => f.comp.id === id);
        if (found) onPick(found.comp);
      }}
    >
      <SelectTrigger className="h-9 w-[230px]">
        <SelectValue placeholder={t("adminRoleProfiles.editor.addCompetencyManually")} />
      </SelectTrigger>
      <SelectContent className="max-h-[400px]">
        {flat.length === 0 ? (
          <div className="px-2 py-3 text-xs text-muted-foreground">
            {t("adminRoleProfiles.editor.allCompetenciesAdded")}
          </div>
        ) : (
          flat.map((f) => (
            <SelectItem key={f.comp.id} value={f.comp.id}>
              {f.label}
            </SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  );
}
