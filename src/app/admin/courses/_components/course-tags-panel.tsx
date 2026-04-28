"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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

const PILLAR_OPTIONS: Array<{ id: PillarId; label: string }> = [
  { id: "strategy", label: "Strategy" },
  { id: "data", label: "Data" },
  { id: "technology", label: "Technology" },
  { id: "talent", label: "Talent" },
  { id: "culture", label: "Culture" },
  { id: "governance", label: "Governance" },
  { id: "operations", label: "Operations" },
  { id: "model_management", label: "Model Management" },
];

const SOURCE_LABEL: Record<TagSource, { label: string; tone: string }> = {
  manual: { label: "Manual", tone: "bg-muted text-muted-foreground" },
  ai_proposed: { label: "AI proposed", tone: "bg-violet-100 text-violet-900" },
  ai_accepted: { label: "AI accepted", tone: "bg-emerald-100 text-emerald-900" },
};

const WEIGHT_LABEL: Record<Weight, string> = {
  1: "Tangential",
  2: "Related",
  3: "Core",
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
 *  - Replace-all save semantics — one click commits the whole set.
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
    if (compTags.some((t) => t.competency_id === addCompId)) {
      toast.message("Already tagged with that competency");
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
    if (pillarTags.some((t) => t.pillar_id === addPillarId)) {
      toast.message("Already tagged with that pillar");
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
        tags: compTags.map((t) => ({
          competency_id: t.competency_id,
          relevance_weight: t.relevance_weight,
          rationale: t.rationale,
          source: t.source === "ai_proposed" ? "ai_accepted" : t.source,
        })),
      });
      if ("error" in compRes && compRes.error) {
        const msg = typeof compRes.error === "string" ? compRes.error : "Save failed";
        toast.error(`Competency tags: ${msg}`);
        return;
      }
      const pillarRes = await setCoursePillarTagsAction({
        course_id: courseId,
        tags: pillarTags.map((t) => ({
          pillar_id: t.pillar_id,
          relevance_weight: t.relevance_weight,
          rationale: t.rationale,
          source: t.source === "ai_proposed" ? "ai_accepted" : t.source,
        })),
      });
      if ("error" in pillarRes && pillarRes.error) {
        const msg = typeof pillarRes.error === "string" ? pillarRes.error : "Save failed";
        toast.error(`Pillar tags: ${msg}`);
        return;
      }
      toast.success("Mappings saved");
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
          Recommender mappings
        </CardTitle>
        <CardDescription>
          Two-axis tagging that drives both AC and ARA recommendations.
          Hover the AI rationale text under each tag to see the
          extractor&apos;s reasoning. Edit weights or remove tags below;
          changes are local until you click <strong>Save mappings</strong>.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* AC competencies */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <UserCog className="h-3.5 w-3.5 text-blue-700" />
            <p className="text-sm font-semibold">AC behavioural competencies</p>
            <Badge variant="outline" className="text-[10px]">
              {compTags.length}
            </Badge>
          </div>
          {compTags.length === 0 && (
            <p className="text-xs text-muted-foreground">
              No competency tags yet. Add one below — courses without
              competency tags won&apos;t surface on AC engagement
              recommendations.
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
                setCompTags((prev) => prev.map((t) =>
                  t.id === tag.id ? { ...t, relevance_weight: w, source: t.source === "ai_proposed" ? "ai_accepted" : t.source } : t
                ))
              }
              onRationaleChange={(r) =>
                setCompTags((prev) => prev.map((t) =>
                  t.id === tag.id ? { ...t, rationale: r, source: "manual" } : t
                ))
              }
              onRemove={() =>
                setCompTags((prev) => prev.filter((t) => t.id !== tag.id))
              }
              tone="bg-blue-50 border-blue-200 text-blue-900"
            />
          ))}
          <div className="flex items-center gap-2 pt-1">
            <Select value={addCompId} onValueChange={setAddCompId}>
              <SelectTrigger className="h-8 text-xs flex-1 min-w-0">
                <SelectValue placeholder="Add a competency…" />
              </SelectTrigger>
              <SelectContent>
                {allCompetencies
                  .filter((c) => !compTags.some((t) => t.competency_id === c.id))
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
              <Plus className="h-3.5 w-3.5" /> Add
            </Button>
          </div>
        </div>

        {/* ARA pillars */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-violet-700" />
            <p className="text-sm font-semibold">ARA pillars</p>
            <Badge variant="outline" className="text-[10px]">
              {pillarTags.length}
            </Badge>
          </div>
          {pillarTags.length === 0 && (
            <p className="text-xs text-muted-foreground">
              No pillar tags yet. Courses without pillar tags won&apos;t
              surface on ARA capability-building plans.
            </p>
          )}
          {pillarTags.map((tag) => (
            <TagRow
              key={tag.id}
              label={PILLAR_OPTIONS.find((p) => p.id === tag.pillar_id)?.label ?? tag.pillar_id}
              weight={tag.relevance_weight}
              source={tag.source}
              rationale={tag.rationale}
              onWeightChange={(w) =>
                setPillarTags((prev) => prev.map((t) =>
                  t.id === tag.id ? { ...t, relevance_weight: w, source: t.source === "ai_proposed" ? "ai_accepted" : t.source } : t
                ))
              }
              onRationaleChange={(r) =>
                setPillarTags((prev) => prev.map((t) =>
                  t.id === tag.id ? { ...t, rationale: r, source: "manual" } : t
                ))
              }
              onRemove={() =>
                setPillarTags((prev) => prev.filter((t) => t.id !== tag.id))
              }
              tone="bg-violet-50 border-violet-200 text-violet-900"
            />
          ))}
          <div className="flex items-center gap-2 pt-1">
            <Select value={addPillarId} onValueChange={setAddPillarId}>
              <SelectTrigger className="h-8 text-xs flex-1 min-w-0">
                <SelectValue placeholder="Add a pillar…" />
              </SelectTrigger>
              <SelectContent>
                {PILLAR_OPTIONS
                  .filter((p) => !pillarTags.some((t) => t.pillar_id === p.id))
                  .map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.label}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <Button
              type="button" size="sm" variant="outline" onClick={handleAddPillar}
              disabled={!addPillarId} className="gap-1"
            >
              <Plus className="h-3.5 w-3.5" /> Add
            </Button>
          </div>
        </div>

        {/* Save / reset */}
        <div className="flex items-center justify-end gap-2 border-t pt-3">
          <Button type="button" variant="ghost" onClick={handleReset} disabled={!dirty || pending}>
            Reset
          </Button>
          <Button type="button" onClick={handleSave} disabled={!dirty || pending} className="gap-2">
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            Save mappings
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
  label, weight, source, rationale, onWeightChange, onRationaleChange, onRemove, tone,
}: {
  label: string;
  weight: Weight;
  source: TagSource;
  rationale: string | null;
  onWeightChange: (w: Weight) => void;
  onRationaleChange: (r: string | null) => void;
  onRemove: () => void;
  tone: string;
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
            <SelectItem value="1">1 · Tangential</SelectItem>
            <SelectItem value="2">2 · Related</SelectItem>
            <SelectItem value="3">3 · Core</SelectItem>
          </SelectContent>
        </Select>
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${SOURCE_LABEL[source].tone}`}
        >
          {SOURCE_LABEL[source].label}
        </span>
        <button
          type="button"
          aria-label={`Remove ${label}`}
          onClick={onRemove}
          className="inline-flex items-center justify-center h-6 w-6 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <textarea
        rows={2}
        placeholder="Rationale (why does this course develop this competency / pillar?)"
        value={rationale ?? ""}
        onChange={(e) => onRationaleChange(e.target.value || null)}
        className="w-full mt-1.5 rounded-md border border-input bg-card px-2 py-1.5 text-[11px]"
      />
      <p className="text-[10px] text-muted-foreground/80 mt-0.5">
        Weight {weight} ({WEIGHT_LABEL[weight]}) — used in the recommender as <code>gap × {weight}</code>.
      </p>
    </div>
  );
}
