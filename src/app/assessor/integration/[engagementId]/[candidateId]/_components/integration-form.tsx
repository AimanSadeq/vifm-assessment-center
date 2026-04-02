"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { BackLink } from "@/components/shared/back-link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { BARS_LABELS } from "@/lib/validations/assessor";
import { saveIntegrationAction } from "../actions";
import { cn } from "@/lib/utils";

type Competency = { id: string; name: string; description: string | null };

type Props = {
  engagementId: string;
  engagementName: string;
  candidateId: string;
  candidateName: string;
  assessorId: string;
  competencies: Competency[];
  observations: Record<string, unknown>[];
  ratings: Record<string, unknown>[];
  existingWorksheets: Record<string, unknown>[];
};

export function IntegrationForm({
  engagementId,
  engagementName,
  candidateId,
  candidateName,
  assessorId,
  competencies,
  observations,
  ratings,
  existingWorksheets,
}: Props) {
  // Build worksheet state from existing data
  const [worksheets, setWorksheets] = useState<
    Record<string, { rating: number; notes: string }>
  >(
    Object.fromEntries(
      existingWorksheets.map((w) => [
        w.competency_id as string,
        { rating: w.preliminary_rating as number, notes: (w.notes as string) ?? "" },
      ])
    )
  );
  const [savingId, setSavingId] = useState<string | null>(null);

  const getObsForCompetency = (compId: string) =>
    observations.filter((o) => o.competency_id === compId);

  const getRatingsForCompetency = (compId: string) =>
    ratings.filter((r) => r.competency_id === compId);

  const handleSave = async (competencyId: string) => {
    const w = worksheets[competencyId];
    if (!w || !w.rating) return;
    setSavingId(competencyId);
    const result = await saveIntegrationAction({
      engagementId,
      assessorId,
      candidateId,
      competencyId,
      preliminaryRating: w.rating,
      notes: w.notes || undefined,
    });
    setSavingId(null);
    if ("error" in result) {
      toast.error("Failed to save worksheet");
    } else {
      toast.success("Worksheet saved");
    }
  };

  const completedCount = Object.values(worksheets).filter((w) => w.rating > 0).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <BackLink href={`/assessor/assignments/${engagementId}`} label="Back to Assignments" />
        <h1 className="mt-2 text-2xl font-bold">Integration Worksheet</h1>
        <p className="text-sm text-muted-foreground">
          {candidateName} — {engagementName}
        </p>
        <Badge variant={completedCount === competencies.length ? "default" : "secondary"} className="mt-2">
          {completedCount}/{competencies.length} competencies rated
        </Badge>
      </div>

      {/* Per competency */}
      {competencies.map((comp) => {
        const compObs = getObsForCompetency(comp.id);
        const compRatings = getRatingsForCompetency(comp.id);
        const w = worksheets[comp.id] ?? { rating: 0, notes: "" };

        return (
          <Card key={comp.id}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{comp.name}</CardTitle>
                {w.rating > 0 && (
                  <Badge variant={w.rating >= 3 ? "default" : "destructive"}>
                    {w.rating} — {BARS_LABELS[w.rating]}
                  </Badge>
                )}
              </div>
              {comp.description && (
                <p className="text-xs text-muted-foreground">{comp.description}</p>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Evidence summary */}
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">
                  Evidence ({compObs.length} observations, {compRatings.length} exercise ratings)
                </p>

                {/* Exercise ratings */}
                {compRatings.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {compRatings.map((r, i) => {
                      const assignment = r.assessor_assignments as Record<string, unknown> | null;
                      const exercise = assignment?.exercises as { name: string } | null;
                      return (
                        <Badge key={i} variant="outline" className="text-xs">
                          {exercise?.name ?? "Exercise"}: {r.score as number}/5
                        </Badge>
                      );
                    })}
                  </div>
                )}

                {/* Observations */}
                {compObs.length > 0 && (
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {compObs.map((obs) => (
                      <div
                        key={obs.id as string}
                        className={cn(
                          "text-xs rounded px-2 py-1 border",
                          obs.is_positive === true && "bg-green-50 border-green-200",
                          obs.is_positive === false && "bg-red-50 border-red-200",
                          obs.is_positive === null && "bg-muted"
                        )}
                      >
                        {obs.behavior_observed as string}
                      </div>
                    ))}
                  </div>
                )}

                {compObs.length === 0 && compRatings.length === 0 && (
                  <p className="text-xs text-muted-foreground italic">No evidence recorded yet.</p>
                )}
              </div>

              <Separator />

              {/* Preliminary rating */}
              <div>
                <p className="text-xs font-medium mb-2">Preliminary Rating</p>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((score) => (
                    <Button
                      key={score}
                      variant={w.rating === score ? "default" : "outline"}
                      size="sm"
                      className="flex-1"
                      onClick={() =>
                        setWorksheets((prev) => ({
                          ...prev,
                          [comp.id]: { ...prev[comp.id], rating: score, notes: prev[comp.id]?.notes ?? "" },
                        }))
                      }
                    >
                      {score}
                    </Button>
                  ))}
                </div>
                <p className="text-xs text-center text-muted-foreground mt-1">
                  {w.rating > 0 ? BARS_LABELS[w.rating] : "Select 1-5"}
                </p>
              </div>

              {/* Notes */}
              <Textarea
                placeholder="Integration notes — summarize evidence and rationale..."
                rows={2}
                value={w.notes}
                onChange={(e) =>
                  setWorksheets((prev) => ({
                    ...prev,
                    [comp.id]: { ...prev[comp.id], rating: prev[comp.id]?.rating ?? 0, notes: e.target.value },
                  }))
                }
              />

              <Button
                size="sm"
                variant="outline"
                onClick={() => handleSave(comp.id)}
                disabled={!w.rating || savingId === comp.id}
                className="w-full"
              >
                {savingId === comp.id ? "Saving..." : "Save"}
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
