"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { BackLink } from "@/components/shared/back-link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
} from "recharts";
import {
  BARS_LABELS,
} from "@/lib/validations/assessor";
import {
  OAR_RECOMMENDATION_LABELS,
  OAR_RECOMMENDATION_COLORS,
} from "@/lib/validations/washup";
import { saveConsensusRatingAction, saveOarAction } from "../../actions";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Competency = {
  id: string;
  name: string;
  description: string | null;
  weight: number | null;
};

type Props = {
  engagementId: string;
  engagementName: string;
  candidateId: string;
  candidateName: string;
  competencies: Competency[];
  worksheets: Record<string, unknown>[];
  existingConsensus: Record<string, unknown>[];
  existingOar: Record<string, unknown> | null;
};

export function WashupForm({
  engagementId,
  engagementName,
  candidateId,
  candidateName,
  competencies,
  worksheets,
  existingConsensus,
  existingOar,
}: Props) {
  const router = useRouter();

  // Consensus ratings state
  const [consensus, setConsensus] = useState<
    Record<string, { score: number; notes: string }>
  >(
    Object.fromEntries(
      existingConsensus.map((c) => [
        c.competency_id as string,
        {
          score: c.final_score as number,
          notes: (c.discussion_notes as string) ?? "",
        },
      ])
    )
  );

  // OAR state
  const [oarScore, setOarScore] = useState(
    (existingOar?.overall_score as number) ?? 0
  );
  const [oarRec, setOarRec] = useState(
    (existingOar?.recommendation as string) ?? ""
  );
  const [oarSummary, setOarSummary] = useState(
    (existingOar?.summary as string) ?? ""
  );

  const [savingId, setSavingId] = useState<string | null>(null);
  const [savingOar, setSavingOar] = useState(false);

  // Get all assessor worksheets for a competency
  const getWorksheetsByCompetency = (compId: string) =>
    worksheets.filter((w) => w.competency_id === compId);

  const [saveError, setSaveError] = useState<string | null>(null);
  const [realtimeActive, setRealtimeActive] = useState(false);
  const [lastExternalUpdate, setLastExternalUpdate] = useState<string | null>(null);
  const lastSavedByMe = React.useRef<string | null>(null);

  // Supabase Realtime — subscribe to consensus_ratings changes for this candidate
  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`washup-${engagementId}-${candidateId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "consensus_ratings",
          filter: `engagement_id=eq.${engagementId}`,
        },
        (payload) => {
          const record = payload.new as Record<string, unknown> | undefined;
          if (!record || record.candidate_id !== candidateId) return;

          const compId = record.competency_id as string;
          const score = record.final_score as number;
          const notes = (record.discussion_notes as string) ?? "";

          // Update local state with the incoming change
          setConsensus((prev) => ({
            ...prev,
            [compId]: { score, notes },
          }));
          setLastExternalUpdate(new Date().toLocaleTimeString());
          // Only show notification if this wasn't our own save
          if (lastSavedByMe.current !== compId) {
            toast.info("A colleague updated a consensus rating");
          }
          lastSavedByMe.current = null;
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "overall_assessment_ratings",
          filter: `engagement_id=eq.${engagementId}`,
        },
        (payload) => {
          const record = payload.new as Record<string, unknown> | undefined;
          if (!record || record.candidate_id !== candidateId) return;

          setOarScore(record.overall_score as number);
          setOarRec(record.recommendation as string);
          setOarSummary((record.summary as string) ?? "");
          setLastExternalUpdate(new Date().toLocaleTimeString());
          toast.info("Overall Assessment Rating updated by a colleague");
        }
      )
      .subscribe((status) => {
        setRealtimeActive(status === "SUBSCRIBED");
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [engagementId, candidateId]);

  const handleSaveConsensus = async (competencyId: string) => {
    const c = consensus[competencyId];
    if (!c || !c.score) return;
    setSavingId(competencyId);
    setSaveError(null);
    lastSavedByMe.current = competencyId;
    const result = await saveConsensusRatingAction({
      engagementId,
      candidateId,
      competencyId,
      finalScore: c.score,
      discussionNotes: c.notes || undefined,
    });
    setSavingId(null);
    if ("error" in result && result.error) {
      const msg = typeof result.error === "string" ? result.error : "Failed to save";
      setSaveError(msg);
      toast.error(msg);
    } else {
      toast.success("Consensus rating saved");
    }
  };

  const handleSaveOar = async () => {
    if (!oarScore || !oarRec) return;
    setSavingOar(true);
    await saveOarAction({
      engagementId,
      candidateId,
      overallScore: oarScore,
      recommendation: oarRec as "ready_now" | "ready_with_development" | "not_ready",
      summary: oarSummary || undefined,
    });
    setSavingOar(false);
    toast.success("Overall Assessment Rating saved");
    router.refresh();
  };

  const completedCount = Object.values(consensus).filter((c) => c.score > 0).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <BackLink href={`/assessor/washup/${engagementId}`} label="Back to Candidate List" />
        <h1 className="mt-2 text-2xl font-bold">Wash-Up: {candidateName}</h1>
        <p className="text-sm text-muted-foreground">{engagementName}</p>
        <Badge
          variant={completedCount === competencies.length ? "default" : "secondary"}
          className="mt-2"
        >
          {completedCount}/{competencies.length} consensus ratings agreed
        </Badge>
        {/* Realtime status indicator */}
        <div className="flex items-center gap-2">
          <span className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-medium",
            realtimeActive
              ? "bg-green-100 text-green-700"
              : "bg-muted text-muted-foreground"
          )}>
            <span className={cn(
              "h-1.5 w-1.5 rounded-full",
              realtimeActive ? "bg-green-500 animate-pulse" : "bg-muted-foreground"
            )} />
            {realtimeActive ? "Live" : "Connecting..."}
          </span>
          {lastExternalUpdate && (
            <span className="text-[10px] text-muted-foreground">
              Last sync: {lastExternalUpdate}
            </span>
          )}
        </div>
      </div>

      {/* Radar Chart + Score Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Radar Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Competency Profile</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <RadarChart data={competencies.map((comp) => {
                const c = consensus[comp.id];
                const ws = worksheets.filter((w) => w.competency_id === comp.id);
                const prelim = ws.length > 0
                  ? ws.reduce((sum, w) => sum + (w.preliminary_rating as number), 0) / ws.length
                  : 0;
                return {
                  competency: comp.name.length > 16 ? comp.name.slice(0, 16) + "..." : comp.name,
                  consensus: c?.score ?? 0,
                  preliminary: Math.round(prelim * 10) / 10,
                  fullMark: 5,
                };
              })}>
                <PolarGrid />
                <PolarAngleAxis dataKey="competency" fontSize={9} />
                <PolarRadiusAxis angle={30} domain={[0, 5]} fontSize={9} />
                <Radar name="Preliminary" dataKey="preliminary" stroke="hsl(var(--muted-foreground))" fill="hsl(var(--muted-foreground))" fillOpacity={0.15} strokeDasharray="4 4" />
                {completedCount > 0 && <Radar name="Consensus" dataKey="consensus" stroke="hsl(var(--accent))" fill="hsl(var(--accent))" fillOpacity={0.3} />}
              </RadarChart>
            </ResponsiveContainer>
            <div className="flex justify-center gap-6 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-4 rounded-sm border border-muted-foreground/30 bg-muted-foreground/15" />
                Preliminary
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-4 rounded-sm bg-accent/30 border border-accent" />
                Consensus
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Score Summary Table */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Ratings Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              {competencies.map((comp) => {
                const c = consensus[comp.id];
                const ws = worksheets.filter((w) => w.competency_id === comp.id);
                const prelim = ws.length > 0
                  ? ws.reduce((sum, w) => sum + (w.preliminary_rating as number), 0) / ws.length
                  : 0;
                const score = c?.score ?? 0;

                return (
                  <div key={comp.id} className="flex items-center gap-2">
                    <span className="text-[11px] min-w-[130px] truncate" title={comp.name}>
                      {comp.name}
                    </span>
                    {/* Preliminary bar */}
                    <div className="flex-1 h-4 rounded bg-muted overflow-hidden relative">
                      {prelim > 0 && (
                        <div
                          className="absolute inset-y-0 left-0 bg-muted-foreground/15 border-r border-muted-foreground/30"
                          style={{ width: `${(prelim / 5) * 100}%` }}
                        />
                      )}
                      {score > 0 && (
                        <div
                          className={cn(
                            "absolute inset-y-0 left-0 rounded transition-all",
                            score >= 4 ? "bg-green-500/60" : score >= 3 ? "bg-accent/50" : "bg-red-400/50"
                          )}
                          style={{ width: `${(score / 5) * 100}%` }}
                        />
                      )}
                    </div>
                    {/* Score badges */}
                    <div className="flex gap-1 shrink-0">
                      {prelim > 0 && (
                        <span className="text-[10px] text-muted-foreground w-6 text-center">
                          {prelim.toFixed(1)}
                        </span>
                      )}
                      {score > 0 ? (
                        <Badge
                          variant="default"
                          className={cn(
                            "text-[10px] px-1.5 py-0",
                            score >= 4 ? "bg-green-600" : score >= 3 ? "bg-accent" : "bg-red-500"
                          )}
                        >
                          {score}
                        </Badge>
                      ) : (
                        <span className="text-[10px] text-muted-foreground/40 w-6 text-center">—</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Legend */}
            <div className="flex gap-4 mt-3 pt-2 border-t text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-green-600" /> ≥4 Strength</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-accent" /> 3 Competent</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500" /> ≤2 Development</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Error display */}
      {saveError && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {saveError}
        </div>
      )}

      {/* Competency-by-competency consensus */}
      {competencies.map((comp) => {
        const assessorWorksheets = getWorksheetsByCompetency(comp.id);
        const c = consensus[comp.id] ?? { score: 0, notes: "" };

        // Calculate average of preliminary ratings
        const prelimRatings = assessorWorksheets
          .map((w) => w.preliminary_rating as number)
          .filter((r) => r > 0);
        const avgRating =
          prelimRatings.length > 0
            ? (prelimRatings.reduce((a, b) => a + b, 0) / prelimRatings.length).toFixed(1)
            : null;
        const ratingSpread =
          prelimRatings.length > 1
            ? Math.max(...prelimRatings) - Math.min(...prelimRatings)
            : 0;

        return (
          <Card key={comp.id}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">{comp.name}</CardTitle>
                  {comp.description && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {comp.description}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {comp.weight != null && (
                    <Badge variant="outline" className="text-xs">
                      Weight: {comp.weight}
                    </Badge>
                  )}
                  {c.score > 0 && (
                    <Badge variant="default">
                      Consensus: {c.score}
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Assessor preliminary ratings comparison */}
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  Assessor Preliminary Ratings
                  {avgRating && (
                    <span className="ml-2">
                      (Avg: {avgRating}
                      {ratingSpread > 1 && (
                        <span className="text-yellow-600 ml-1">
                          ⚠ Spread: {ratingSpread}
                        </span>
                      )}
                      )
                    </span>
                  )}
                </p>
                {assessorWorksheets.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">
                    No preliminary ratings submitted yet.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {assessorWorksheets.map((w, i) => {
                      const profile = w.profiles as Record<string, unknown> | null;
                      const rating = w.preliminary_rating as number;
                      return (
                        <div
                          key={i}
                          className="flex items-start gap-3 rounded-md border p-2 text-sm"
                        >
                          <div className="flex items-center gap-2 min-w-[140px]">
                            <span className="font-medium">
                              {(profile?.full_name as string) ?? "Assessor"}
                            </span>
                            <Badge
                              variant={rating >= 3 ? "default" : "destructive"}
                              className="text-xs"
                            >
                              {rating}/5
                            </Badge>
                          </div>
                          <span className="text-xs text-muted-foreground flex-1">
                            {(w.notes as string) || "No notes"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <Separator />

              {/* Consensus rating */}
              <div>
                <p className="text-xs font-medium mb-2">Consensus Rating</p>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((score) => (
                    <Button
                      key={score}
                      variant={c.score === score ? "default" : "outline"}
                      size="sm"
                      className={cn(
                        "flex-1",
                        c.score === score && score >= 4 && "bg-green-600 hover:bg-green-700",
                        c.score === score && score === 3 && "bg-accent hover:bg-accent/90",
                        c.score === score && score <= 2 && "bg-red-500 hover:bg-red-600",
                      )}
                      onClick={() =>
                        setConsensus((prev) => ({
                          ...prev,
                          [comp.id]: { ...prev[comp.id], score, notes: prev[comp.id]?.notes ?? "" },
                        }))
                      }
                    >
                      {score}
                    </Button>
                  ))}
                </div>
                <p className="text-xs text-center text-muted-foreground mt-1">
                  {c.score > 0 ? BARS_LABELS[c.score] : "Agree on a rating (1-5)"}
                </p>
              </div>

              {/* Discussion notes */}
              <Textarea
                placeholder="Discussion notes — key evidence, points of agreement/disagreement..."
                rows={2}
                value={c.notes}
                onChange={(e) =>
                  setConsensus((prev) => ({
                    ...prev,
                    [comp.id]: { ...prev[comp.id], score: prev[comp.id]?.score ?? 0, notes: e.target.value },
                  }))
                }
              />

              <Button
                size="sm"
                variant="outline"
                onClick={() => handleSaveConsensus(comp.id)}
                disabled={!c.score || savingId === comp.id}
                className="w-full"
              >
                {savingId === comp.id ? "Saving..." : "Save Consensus Rating"}
              </Button>
            </CardContent>
          </Card>
        );
      })}

      {/* OAR Section */}
      <Card className="border-2">
        <CardHeader>
          <CardTitle>Overall Assessment Rating (OAR)</CardTitle>
          <p className="text-sm text-muted-foreground">
            Final overall rating and recommendation for {candidateName}.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Overall Score */}
          <div>
            <Label className="text-sm font-medium">Overall Score (1-5)</Label>
            <div className="flex gap-1 mt-2">
              {[1, 2, 3, 4, 5].map((score) => (
                <Button
                  key={score}
                  variant={oarScore === score ? "default" : "outline"}
                  size="lg"
                  className="flex-1"
                  onClick={() => setOarScore(score)}
                >
                  {score}
                </Button>
              ))}
            </div>
            <p className="text-sm text-center text-muted-foreground mt-1">
              {oarScore > 0 ? BARS_LABELS[oarScore] : "Select overall score"}
            </p>
          </div>

          {/* Recommendation */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Recommendation</Label>
            <div className="grid grid-cols-3 gap-2">
              {(["ready_now", "ready_with_development", "not_ready"] as const).map(
                (rec) => (
                  <Button
                    key={rec}
                    variant={oarRec === rec ? "default" : "outline"}
                    size="sm"
                    className={cn(
                      "text-xs",
                      oarRec === rec && OAR_RECOMMENDATION_COLORS[rec]
                    )}
                    onClick={() => setOarRec(rec)}
                  >
                    {OAR_RECOMMENDATION_LABELS[rec]}
                  </Button>
                )
              )}
            </div>
          </div>

          {/* Summary */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Executive Summary</Label>
            <Textarea
              placeholder="Summary of candidate's overall performance, key strengths, and development areas..."
              rows={4}
              value={oarSummary}
              onChange={(e) => setOarSummary(e.target.value)}
            />
          </div>

          <Button
            onClick={handleSaveOar}
            disabled={!oarScore || !oarRec || savingOar}
            className="w-full"
            size="lg"
          >
            {savingOar
              ? "Saving..."
              : existingOar
                ? "Update Overall Assessment Rating"
                : "Save Overall Assessment Rating"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
