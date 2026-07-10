"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { updateRequisitionStagesAction } from "../../actions";
import {
  FLUENT_SKILLS,
  RECEPTIVE_FLUENT_SKILLS,
  type FluentSkill,
  type PrehireStagePlanEntry,
} from "@/types/prehire";

// Edit a built requisition's stage plan: add / remove Competency Quiz, English
// (Fluent) and AI Interview, and tune each one's weight / cut-score / English
// sub-skills. Mirrors the create wizard's stage section. Non-editable stage
// kinds (e.g. assessment_center) are preserved untouched.

type StageKind = "quiz" | "fluent" | "cbi";
type StageState = { included: boolean; weight: number; cut: number };

const STAGE_LABELS: Record<StageKind, string> = {
  quiz: "Competency Quiz",
  fluent: "English (Fluent®)",
  cbi: "AI Interview",
};
const FLUENT_SKILL_LABELS: Record<FluentSkill, string> = {
  reading: "Reading",
  listening: "Listening",
  writing: "Writing",
  speaking: "Speaking",
};
const DEFAULTS: Record<StageKind, StageState> = {
  quiz: { included: false, weight: 0.4, cut: 60 },
  fluent: { included: false, weight: 0.3, cut: 50 },
  cbi: { included: false, weight: 0.3, cut: 60 },
};

export function EditStages({
  requisitionId,
  initialPlan,
}: {
  requisitionId: string;
  initialPlan: PrehireStagePlanEntry[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const byKind = new Map(initialPlan.map((s) => [s.kind, s]));
  // Stages this editor doesn't manage are carried through verbatim.
  const otherStages = initialPlan.filter(
    (s) => s.kind !== "quiz" && s.kind !== "fluent" && s.kind !== "cbi"
  );

  const initStage = (k: StageKind): StageState => {
    const e = byKind.get(k);
    return e
      ? { included: true, weight: e.weight, cut: e.cut_score ?? DEFAULTS[k].cut }
      : DEFAULTS[k];
  };
  const [stages, setStages] = useState<Record<StageKind, StageState>>({
    quiz: initStage("quiz"),
    fluent: initStage("fluent"),
    cbi: initStage("cbi"),
  });

  const fluentSkillsRaw = (byKind.get("fluent") as { skills?: FluentSkill[] } | undefined)?.skills;
  const [fluentSkills, setFluentSkills] = useState<Set<FluentSkill>>(
    fluentSkillsRaw && fluentSkillsRaw.length > 0 ? new Set(fluentSkillsRaw) : new Set(FLUENT_SKILLS)
  );

  const setStage = (k: StageKind, patch: Partial<StageState>) =>
    setStages((s) => ({ ...s, [k]: { ...s[k], ...patch } }));
  const toggleSkill = (skill: FluentSkill, on: boolean) =>
    setFluentSkills((prev) => {
      const n = new Set(prev);
      if (on) n.add(skill);
      else n.delete(skill);
      return n;
    });

  const save = async () => {
    const clamp = (v: number, lo: number, hi: number) =>
      Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : lo;
    if (stages.fluent.included && !RECEPTIVE_FLUENT_SKILLS.some((s) => fluentSkills.has(s))) {
      toast.error("Keep at least one receptive English skill (Reading or Listening).");
      return;
    }
    const orderedSkills = FLUENT_SKILLS.filter((s) => fluentSkills.has(s));
    const editable = (Object.keys(stages) as StageKind[])
      .filter((k) => stages[k].included)
      .map((k) => ({
        kind: k,
        weight: clamp(stages[k].weight, 0, 1),
        cut_score: clamp(stages[k].cut, 0, 100),
        required: byKind.get(k)?.required ?? false,
        ...(k === "fluent" ? { skills: orderedSkills } : {}),
      }));
    const stage_config = [...editable, ...otherStages];
    if (stage_config.length === 0) {
      toast.error("Pick at least one stage.");
      return;
    }
    setSaving(true);
    const res = await updateRequisitionStagesAction({ requisition_id: requisitionId, stage_config });
    setSaving(false);
    if ("error" in res) {
      toast.error(res.error);
      return;
    }
    if (res.rescoreFailed > 0) {
      // The stage plan saved, but some candidates could not be re-scored (they
      // keep their old-plan band). Surface it instead of a plain success so the
      // recruiter knows to re-save rather than trust stale composites.
      toast.warning(
        `Stages updated. ${res.rescoreFailed} of ${res.rescored + res.rescoreFailed} candidates could not be re-scored - re-save to retry.`,
      );
    } else {
      toast.success("Stages updated - candidates re-scored.");
    }
    setOpen(false);
    router.refresh();
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent"
        title="Add or remove screening stages"
      >
        <Pencil className="h-3.5 w-3.5" /> Edit stages
      </button>
    );
  }

  return (
    <Card>
      <CardContent className="space-y-3 pt-5">
        <div className="flex items-center justify-between">
          <Label>Screening stages</Label>
          <span className="text-xs text-muted-foreground">
            Tick to include · weight (0-1, normalized) · cut-score
          </span>
        </div>
        <div className="space-y-2">
          {(Object.keys(stages) as StageKind[]).map((kind) => {
            const st = stages[kind];
            return (
              <div key={kind} className="rounded-md border p-3">
                <div className="flex flex-wrap items-center gap-3">
                  <Checkbox
                    id={`edit-stage-${kind}`}
                    checked={st.included}
                    onCheckedChange={(c) => setStage(kind, { included: c === true })}
                  />
                  <Label htmlFor={`edit-stage-${kind}`} className="flex-1 min-w-[8rem] cursor-pointer">
                    {STAGE_LABELS[kind]}
                  </Label>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-muted-foreground">Weight</span>
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
                    <span className="text-xs text-muted-foreground">Cut</span>
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
                {kind === "fluent" && st.included && (
                  <div className="mt-3 border-t pt-3">
                    <p className="mb-2 text-xs font-medium text-muted-foreground">
                      English sub-skills to assess
                    </p>
                    <div className="flex flex-wrap gap-x-5 gap-y-2">
                      {FLUENT_SKILLS.map((skill) => (
                        <label key={skill} className="flex cursor-pointer items-center gap-2 text-sm">
                          <Checkbox
                            checked={fluentSkills.has(skill)}
                            onCheckedChange={(c) => toggleSkill(skill, c === true)}
                          />
                          <span>{FLUENT_SKILL_LABELS[skill]}</span>
                        </label>
                      ))}
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Keep at least one receptive skill (Reading or Listening).
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground">
          Saving re-scores all candidates from the new plan: a removed stage drops out of the composite;
          an added stage shows as incomplete until each candidate takes it. Results already collected are kept.
        </p>
        <div className="flex items-center gap-2">
          <Button onClick={save} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…
              </>
            ) : (
              "Save stages"
            )}
          </Button>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={saving}>
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
