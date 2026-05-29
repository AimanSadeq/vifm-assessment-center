"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
};

// Default weight + cut-score per stage. Weights are normalized at scoring time,
// so picking a subset still works; these can be made editable in a later pass.
const STAGES: { kind: "fluent" | "quiz" | "cbi"; label: string; weight: number; cut: number }[] = [
  { kind: "quiz", label: "Competency Quiz", weight: 0.4, cut: 60 },
  { kind: "fluent", label: "English (Fluent)", weight: 0.3, cut: 50 },
  { kind: "cbi", label: "AI Interview", weight: 0.3, cut: 60 },
];

export function RequisitionForm({ roleProfiles, organizations }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [orgId, setOrgId] = useState("");
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
      toast.error("Pick at least one screening stage.");
      return;
    }
    if (!orgId) {
      toast.error("Select a client organization.");
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
    toast.success("Requisition created.");
    router.push(`/admin/prehire/${res.data.id}`);
  };

  return (
    <Card>
      <CardContent className="space-y-5 pt-6">
        <div className="space-y-2">
          <Label htmlFor="title">Role title *</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Relationship Manager"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="org">Client organization *</Label>
            <select
              id="org"
              value={orgId}
              onChange={(e) => setOrgId(e.target.value)}
              className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">— Select a client —</option>
              {organizations.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
            {organizations.length === 0 && (
              <p className="text-xs text-amber-600">
                No client organizations yet — create one under Clients first.
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="level">Level</Label>
            <Input
              id="level"
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              placeholder="e.g. Mid / Senior"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="rp">Role profile (competency model)</Label>
          <select
            id="rp"
            value={roleProfileId}
            onChange={(e) => setRoleProfileId(e.target.value)}
            className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">— None —</option>
            {roleProfiles.map((p) => (
              <option key={p.id} value={p.id}>{p.name_en}</option>
            ))}
          </select>
        </div>

        <div className="space-y-3">
          <Label>Screening stages</Label>
          <div className="space-y-2">
            {STAGES.map((s) => (
              <div key={s.kind} className="flex items-center gap-3 rounded-md border p-3">
                <Checkbox
                  id={`stage-${s.kind}`}
                  checked={!!stages[s.kind]}
                  onCheckedChange={() => toggleStage(s.kind)}
                />
                <Label htmlFor={`stage-${s.kind}`} className="flex-1 cursor-pointer">
                  {s.label}
                </Label>
                <span className="text-xs text-muted-foreground">
                  weight {s.weight} · cut {s.cut}
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
            English proficiency is job-relevant for this role
          </Label>
        </div>

        <Button onClick={handleSubmit} disabled={submitting || !title} className="w-full">
          {submitting ? "Creating…" : "Create requisition"}
        </Button>
      </CardContent>
    </Card>
  );
}
