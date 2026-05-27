"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import {
  setCourseCompetencyTagsAction,
  setCoursePillarTagsAction,
} from "../actions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, X, Loader2, Sparkles, UserCog } from "lucide-react";

type TagSource = "manual" | "ai_proposed" | "ai_accepted";
type Weight = 1 | 2 | 3;

type CompetencyTag = {
  id: string;
  competency_id: string;
  relevance_weight: Weight;
  rationale: string | null;
  source: TagSource;
};

type PillarId =
  | "strategy" | "data" | "technology" | "talent" | "culture"
  | "governance" | "operations" | "model_management";

type PillarTag = {
  id: string;
  pillar_id: PillarId;
  relevance_weight: Weight;
  rationale: string | null;
  source: TagSource;
};

type CompetencyOption = { id: string; name: string };

const PILLAR_OPTIONS: Array<{ id: PillarId; labelKey: string }> = [
  { id: "strategy", labelKey: "adminCourses.tags.pillarStrategy" },
  { id: "data", labelKey: "adminCourses.tags.pillarData" },
  { id: "technology", labelKey: "adminCourses.tags.pillarTechnology" },
  { id: "talent", labelKey: "adminCourses.tags.pillarTalent" },
  { id: "culture", labelKey: "adminCourses.tags.pillarCulture" },
  { id: "governance", labelKey: "adminCourses.tags.pillarGovernance" },
  { id: "operations", labelKey: "adminCourses.tags.pillarOperations" },
  { id: "model_management", labelKey: "adminCourses.tags.pillarModelManagement" },
];

const SOURCE_TONE: Record<TagSource, string> = {
  manual: "bg-muted text-muted-foreground",
  ai_proposed: "bg-violet-100 text-violet-900",
  ai_accepted: "bg-emerald-100 text-emerald-900",
};

const SOURCE_LABEL_KEY: Record<TagSource, string> = {
  manual: "adminCourses.tags.sourceManual",
  ai_proposed: "adminCourses.tags.sourceAiProposed",
  ai_accepted: "adminCourses.tags.sourceAiAccepted",
};

const WEIGHT_LABEL_KEY: Record<Weight, string> = {
  1: "adminCourses.tags.weightTangential",
  2: "adminCourses.tags.weightRelated",
  3: "adminCourses.tags.weightCore",
};

type Props = {
  courseId: string;
  initialCompetencyTags: CompetencyTag[];
  initialPillarTags: PillarTag[];
  allCompetencies: CompetencyOption[];
};

/**
 * Read + edit AC competency and ARA pillar tags on a course.
 *
 * Design choices:
 *  - Replace-all save semantics - one click commits the whole set.
 *    Matches the server action's behaviour (delete then insert) and
 *    avoids per-tag round-trips.
 *  - "source" defaults to manual when the admin adds/edits a tag
 *    locally; AI-proposed tags retain their badge until the admin
 *    explicitly tweaks them, at which point they flip to manual.
 *  - Adding a duplicate tag is a no-op (existing tag's weight wins).
 *  - The "Reset" button reverts unsaved changes to the initial state,
 *    so an admin can experiment without fear.
 */
export function CourseTagsPanel({
  courseId,
  initialCompetencyTags,
  initialPillarTags,
  allCompetencies,
}: Props) {
  const router = useRouter();
  const { t } = useTranslation();
  const [compTags, setCompTags] = useState<CompetencyTag[]>(initialCompetencyTags);
  const [pillarTags, setPillarTags] = useState<PillarTag[]>(initialPillarTags);
  const [pending, start] = useTransition();
  const [addCompId, setAddCompId] = useState<string>("");
  const [addPillarId, setAddPillarId] = useState<string>("");

  const competencyById = new Map(allCompetencies.map((c) => [c.id, c.name]));

  const dirty =
    JSON.stringify(compTags.map(stripId)) !== JSON.stringify(initialCompetencyTags.map(stripId)) ||
    JSON.stringify(pillarTags.map(stripId)) !== JSON.stringify(initialPillarTags.map(stripId));

  const handleAddCompetency = () => {
    if (!addCompId) return;
    if (compTags.some((tag) => tag.competency_id === addCompId)) {
      toast.message(t("adminCourses.tags.alreadyTaggedCompetency"));
      setAddCompId("");
      return;
    }
    setCompTags((prev) => [
      ...prev,
      {
        id: `tmp-${addCompId}`,
        competency_id: addCompId,
        relevance_weight: 2,
        rationale: null,
        source: "manual",
      },
    ]);
    setAddCompId("");
  };

  const handleAddPillar = () => {
    if (!addPillarId) return;
    if (pillarTags.some((tag) => tag.pillar_id === addPillarId)) {
      toast.message(t("adminCourses.tags.alreadyTaggedPillar"));
      setAddPillarId("");
      return;
    }
    setPillarTags((prev) => [
      ...prev,
      {
        id: `tmp-${addPillarId}`,
        pillar_id: addPillarId as PillarId,
        relevance_weight: 2,
        rationale: null,
        source: "manual",
      },
    ]);
    setAddPillarId("");
  };

  const handleSave = () => {
    start(async () => {
      // Both calls run sequentially because they hit the same row group
      // with delete-then-insert semantics on the server side; running
      // them in parallel would race against shared state.
      const compRes = await setCourseCompetencyTagsAction({
        course_id: courseId,
        tags: compTags.map((tag) => ({
          competency_id: tag.competency_id,
          relevance_weight: tag.relevance_weight,
          rationale: tag.rationale,
          source: tag.source === "ai_proposed" ? "ai_accepted" : tag.source,
        })),
      });
      if ("error" in compRes && compRes.error) {
        const msg = typeof compRes.error === "string" ? compRes.error : t("adminCourses.tags.saveFailed");
        toast.error(t("adminCourses.tags.competencyTagsError", { msg }));
        return;
      }
      const pillarRes = await setCoursePillarTagsAction({
        course_id: courseId,
        tags: pillarTags.map((tag) => ({
          pillar_id: tag.pillar_id,
          relevance_weight: tag.relevance_weight,
          rationale: tag.rationale,
          source: tag.source === "ai_proposed" ? "ai_accepted" : tag.source,
        })),
      });
      if ("error" in pillarRes && pillarRes.error) {
        const msg = typeof pillarRes.error === "string" ? pillarRes.error : t("adminCourses.tags.saveFailed");
        toast.error(t("adminCourses.tags.pillarTagsError", { msg }));
        return;
      }
      toast.success(t("adminCourses.tags.mappingsSaved"));
      router.refresh();
    });
  };

  const handleReset = () => {
    setCompTags(initialCompetencyTags);
    setPillarTags(initialPillarTags);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-accent" />
          {t("adminCourses.tags.title")}
        </CardTitle>
        <CardDescription>
          {t("adminCourses.tags.descPre")}{" "}
          <strong>{t("adminCourses.tags.saveMappings")}</strong>{t("adminCourses.tags.descPost")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* AC competencies */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <UserCog className="h-3.5 w-3.5 text-blue-700" />
            <p className="text-sm font-semibold">{t("adminCourses.tags.acCompetencies")}</p>
            <Badge variant="outline" className="text-[10px]">
              {compTags.length}
            </Badge>
          </div>
          {compTags.length === 0 && (
            <p className="text-xs text-muted-foreground">
              {t("adminCourses.tags.noCompetencyTags")}
            </p>
          )}
          {compTags.map((tag) => (
            <TagRow
              key={tag.id}
              label={competencyById.get(tag.competency_id) ?? tag.competency_id}
              weight={tag.relevance_weight}
              source={tag.source}
              rationale={tag.rationale}
              onWeightChange={(w) =>
                setCompTags((prev) => prev.map((row) =>
                  row.id === tag.id ? { ...row, relevance_weight: w, source: row.source === "ai_proposed" ? "ai_accepted" : row.source } : row
                ))
              }
              onRationaleChange={(r) =>
                setCompTags((prev) => prev.map((row) =>
                  row.id === tag.id ? { ...row, rationale: r, source: "manual" } : row
                ))
              }
              onRemove={() =>
                setCompTags((prev) => prev.filter((row) => row.id !== tag.id))
              }
              tone="bg-blue-50 border-blue-200 text-blue-900"
              t={t}
            />
          ))}
          <div className="flex items-center gap-2 pt-1">
            <Select value={addCompId} onValueChange={setAddCompId}>
              <SelectTrigger className="h-8 text-xs flex-1 min-w-0">
                <SelectValue placeholder={t("adminCourses.tags.addCompetencyPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {allCompetencies
                  .filter((c) => !compTags.some((row) => row.competency_id === c.id))
                  .map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <Button
              type="button" size="sm" variant="outline" onClick={handleAddCompetency}
              disabled={!addCompId} className="gap-1"
            >
              <Plus className="h-3.5 w-3.5" /> {t("adminCourses.add")}
            </Button>
          </div>
        </div>

        {/* ARA pillars */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-violet-700" />
            <p className="text-sm font-semibold">{t("adminCourses.tags.araPillars")}</p>
            <Badge variant="outline" className="text-[10px]">
              {pillarTags.length}
            </Badge>
          </div>
          {pillarTags.length === 0 && (
            <p className="text-xs text-muted-foreground">
              {t("adminCourses.tags.noPillarTags")}
            </p>
          )}
          {pillarTags.map((tag) => {
            const pillarOpt = PILLAR_OPTIONS.find((p) => p.id === tag.pillar_id);
            return (
            <TagRow
              key={tag.id}
              label={pillarOpt ? t(pillarOpt.labelKey) : tag.pillar_id}
              weight={tag.relevance_weight}
              source={tag.source}
              rationale={tag.rationale}
              onWeightChange={(w) =>
                setPillarTags((prev) => prev.map((row) =>
                  row.id === tag.id ? { ...row, relevance_weight: w, source: row.source === "ai_proposed" ? "ai_accepted" : row.source } : row
                ))
              }
              onRationaleChange={(r) =>
                setPillarTags((prev) => prev.map((row) =>
                  row.id === tag.id ? { ...row, rationale: r, source: "manual" } : row
                ))
              }
              onRemove={() =>
                setPillarTags((prev) => prev.filter((row) => row.id !== tag.id))
              }
              tone="bg-violet-50 border-violet-200 text-violet-900"
              t={t}
            />
            );
          })}
          <div className="flex items-center gap-2 pt-1">
            <Select value={addPillarId} onValueChange={setAddPillarId}>
              <SelectTrigger className="h-8 text-xs flex-1 min-w-0">
                <SelectValue placeholder={t("adminCourses.tags.addPillarPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {PILLAR_OPTIONS
                  .filter((p) => !pillarTags.some((row) => row.pillar_id === p.id))
                  .map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {t(p.labelKey)}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <Button
              type="button" size="sm" variant="outline" onClick={handleAddPillar}
              disabled={!addPillarId} className="gap-1"
            >
              <Plus className="h-3.5 w-3.5" /> {t("adminCourses.add")}
            </Button>
          </div>
        </div>

        {/* Save / reset */}
        <div className="flex items-center justify-end gap-2 border-t pt-3">
          <Button type="button" variant="ghost" onClick={handleReset} disabled={!dirty || pending}>
            {t("adminCourses.tags.reset")}
          </Button>
          <Button type="button" onClick={handleSave} disabled={!dirty || pending} className="gap-2">
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            {t("adminCourses.tags.saveMappings")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function stripId<T extends { id: string }>(t: T): Omit<T, "id"> {
  const { id: _id, ...rest } = t;
  return rest;
}

function TagRow({
  label, weight, source, rationale, onWeightChange, onRationaleChange, onRemove, tone, t,
}: {
  label: string;
  weight: Weight;
  source: TagSource;
  rationale: string | null;
  onWeightChange: (w: Weight) => void;
  onRationaleChange: (r: string | null) => void;
  onRemove: () => void;
  tone: string;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  return (
    <div className={`rounded-md border px-3 py-2 ${tone}`}>
      <div className="flex items-start gap-2">
        <span className="text-xs font-medium flex-1">{label}</span>
        <Select
          value={String(weight)}
          onValueChange={(v) => onWeightChange(Number(v) as Weight)}
        >
          <SelectTrigger className="h-7 text-[11px] w-[140px] bg-card">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">{t("adminCourses.tags.weightOption1")}</SelectItem>
            <SelectItem value="2">{t("adminCourses.tags.weightOption2")}</SelectItem>
            <SelectItem value="3">{t("adminCourses.tags.weightOption3")}</SelectItem>
          </SelectContent>
        </Select>
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${SOURCE_TONE[source]}`}
        >
          {t(SOURCE_LABEL_KEY[source])}
        </span>
        <button
          type="button"
          aria-label={t("adminCourses.tags.removeAria", { label })}
          onClick={onRemove}
          className="inline-flex items-center justify-center h-6 w-6 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <textarea
        rows={2}
        placeholder={t("adminCourses.tags.rationalePlaceholder")}
        value={rationale ?? ""}
        onChange={(e) => onRationaleChange(e.target.value || null)}
        className="w-full mt-1.5 rounded-md border border-input bg-card px-2 py-1.5 text-[11px]"
      />
      <p className="text-[10px] text-muted-foreground/80 mt-0.5">
        {t("adminCourses.tags.weightFootnotePre", { weight, label: t(WEIGHT_LABEL_KEY[weight]) })} <code>gap × {weight}</code>.
      </p>
    </div>
  );
}
