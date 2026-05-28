"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { X, Plus, HelpCircle, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EXERCISE_TYPE_LABELS } from "@/lib/constants/exercise-types";
import { BackLink } from "@/components/shared/back-link";
import { saveObservationAction, deleteObservationAction, saveRatingAction, deleteRatingAction } from "../actions";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Competency = { id: string; name: string; description: string | null; tags: string[] | null; qa_questions: string[] | null };
type ObservationRow = {
  id: string;
  competency_id: string;
  behavior_observed: string;
  is_positive: boolean | null;
  observed_at: string;
};
type RatingRow = {
  id: string;
  competency_id: string;
  score: number;
  justification: string | null;
};

type BehavioralIndicator = {
  id: string;
  competency_id: string;
  indicator_type: "positive" | "negative";
  description: string;
  sort_order: number;
};

type Props = {
  assignmentId: string;
  engagementId: string;
  candidateName: string;
  exerciseName: string;
  exerciseType: string;
  durationMinutes: number | null;
  prepMinutes?: number | null;
  meetingMinutes?: number | null;
  scenarioContext?: string | null;
  assessorNotes?: string | null;
  competencies: Competency[];
  behavioralIndicators: BehavioralIndicator[];
  existingObservations: ObservationRow[];
  existingRatings: RatingRow[];
};

export function ObservationForm({
  assignmentId,
  engagementId,
  candidateName,
  exerciseName,
  exerciseType,
  durationMinutes,
  prepMinutes,
  meetingMinutes,
  scenarioContext,
  assessorNotes,
  competencies,
  behavioralIndicators,
  existingObservations,
  existingRatings,
}: Props) {
  const { t } = useTranslation();
  const barsLabel = (score: number) => t(`assessorPortal.observation.bars.${score}`);
  const [observations, setObservations] = useState(existingObservations);
  const [ratings, setRatings] = useState<Record<string, { score: number; justification: string }>>(
    Object.fromEntries(
      existingRatings.map((r) => [
        r.competency_id,
        { score: r.score, justification: r.justification ?? "" },
      ])
    )
  );

  const getIndicators = (compId: string, type?: "positive" | "negative") =>
    behavioralIndicators.filter(
      (bi) => bi.competency_id === compId && (!type || bi.indicator_type === type)
    );

  // New observation form state
  const [newObsCompId, setNewObsCompId] = useState(competencies[0]?.id ?? "");
  const [newObsText, setNewObsText] = useState("");
  const [newObsPositive, setNewObsPositive] = useState<string>("null");
  const [saving, setSaving] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [savingRating, setSavingRating] = useState<string | null>(null);

  const handleAddObservation = async () => {
    if (!newObsText.trim() || !newObsCompId) return;
    setSaving(true);
    const result = await saveObservationAction({
      assessorAssignmentId: assignmentId,
      competencyId: newObsCompId,
      behaviorObserved: newObsText,
      isPositive: newObsPositive === "null" ? null : newObsPositive === "true",
    });
    setSaving(false);
    if ("data" in result && result.data) {
      setObservations((prev) => [result.data, ...prev]);
      setNewObsText("");
      toast.success(t("assessorPortal.observation.toast.observationSaved"));
    } else if ("error" in result) {
      toast.error(typeof result.error === "string" ? result.error : t("assessorPortal.observation.toast.observationSaveFailed"));
    }
  };

  const handleDeleteObservation = async (obsId: string) => {
    const result = await deleteObservationAction(obsId);
    if ("error" in result) {
      toast.error(t("assessorPortal.observation.toast.observationDeleteFailed"));
      return;
    }
    setObservations((prev) => prev.filter((o) => o.id !== obsId));
  };

  const handleSaveRating = async (competencyId: string, overrideScore?: number) => {
    const r = ratings[competencyId];
    const score = overrideScore ?? r?.score;
    if (!score) return;
    setSavingRating(competencyId);
    const result = await saveRatingAction({
      assessorAssignmentId: assignmentId,
      competencyId,
      score,
      justification: r?.justification || undefined,
    });
    setSavingRating(null);
    if ("error" in result) {
      toast.error(t("assessorPortal.observation.toast.ratingSaveFailed"));
    } else {
      toast.success(t("assessorPortal.observation.toast.ratingSaved", { score }));
    }
  };

  const handleMarkNE = async (competencyId: string) => {
    // Clear the rating from local state AND database
    setRatings((prev) => {
      const next = { ...prev };
      delete next[competencyId];
      return next;
    });
    await deleteRatingAction(assignmentId, competencyId);
  };

  const getObsForCompetency = (compId: string) =>
    observations.filter((o) => o.competency_id === compId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <BackLink href={`/assessor/assignments/${engagementId}`} label={t("assessorPortal.observation.backToAssignments")} />
        <h1 className="mt-2 text-2xl font-bold">{candidateName}</h1>
        <div className="flex items-center gap-2 mt-1">
          <Badge>{exerciseName}</Badge>
          <Badge variant="outline">
            {EXERCISE_TYPE_LABELS[exerciseType] ?? exerciseType}
          </Badge>
          {(prepMinutes || meetingMinutes) ? (
            <span className="text-xs text-muted-foreground">
              {prepMinutes ? t("assessorPortal.observation.prep", { minutes: prepMinutes }) : ""}
              {prepMinutes && meetingMinutes ? " · " : ""}
              {meetingMinutes ? t("assessorPortal.observation.meeting", { minutes: meetingMinutes }) : ""}
            </span>
          ) : durationMinutes ? (
            <span className="text-sm text-muted-foreground">{t("assessorPortal.observation.durationMin", { minutes: durationMinutes })}</span>
          ) : null}
        </div>
      </div>

      {/* Assessor Guide */}
      <div className="rounded-lg border bg-card">
        <button
          onClick={() => setShowGuide(!showGuide)}
          className="flex items-center justify-between w-full px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <div className="flex items-center gap-2">
            <HelpCircle className="h-4 w-4 text-accent" />
            {t("assessorPortal.observation.guide.title")}
          </div>
          {showGuide ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        {showGuide && (
          <div className="px-4 pb-4 space-y-3 text-sm text-muted-foreground border-t pt-3">
            <div>
              <p className="font-semibold text-foreground mb-1">{t("assessorPortal.observation.guide.beforeTitle")}</p>
              <ul className="space-y-1 text-xs">
                <li>• {t("assessorPortal.observation.guide.before1")}</li>
                <li>• {t("assessorPortal.observation.guide.before2Pre")} <strong>{t("assessorPortal.observation.guide.before2Tab")}</strong> {t("assessorPortal.observation.guide.before2Post")}</li>
                <li>• {t("assessorPortal.observation.guide.before3Pre")} <strong>{t("assessorPortal.observation.guide.before3Tab")}</strong> {t("assessorPortal.observation.guide.before3Post")}</li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-foreground mb-1">{t("assessorPortal.observation.guide.duringTitle")}</p>
              <ul className="space-y-1 text-xs">
                <li>• {t("assessorPortal.observation.guide.during1Pre")} <strong>{t("assessorPortal.observation.guide.during1Tab")}</strong> {t("assessorPortal.observation.guide.during1Post")}</li>
                <li>• {t("assessorPortal.observation.guide.during2")}</li>
                <li>• {t("assessorPortal.observation.guide.during3")}</li>
                <li>• {t("assessorPortal.observation.guide.during4")}</li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-foreground mb-1">{t("assessorPortal.observation.guide.afterTitle")}</p>
              <ul className="space-y-1 text-xs">
                <li>• {t("assessorPortal.observation.guide.after1Pre")} <strong>{t("assessorPortal.observation.guide.after1Tab")}</strong> {t("assessorPortal.observation.guide.after1Post")}</li>
                <li>• {t("assessorPortal.observation.guide.after2Pre")} <strong>{t("assessorPortal.observation.guide.after2Tab")}</strong> {t("assessorPortal.observation.guide.after2Post")}</li>
                <li>• {t("assessorPortal.observation.guide.after3Pre")} <strong>{t("assessorPortal.observation.guide.after3Tab")}</strong> {t("assessorPortal.observation.guide.after3Post")}</li>
                <li>• {t("assessorPortal.observation.guide.after4")}</li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-foreground mb-1">{t("assessorPortal.observation.guide.barsTitle")}</p>
              <div className="grid grid-cols-5 gap-1 text-[10px] text-center">
                <div className="rounded bg-red-50 p-1.5"><span className="font-bold text-red-600">1</span><br/>{barsLabel(1)}</div>
                <div className="rounded bg-orange-50 p-1.5"><span className="font-bold text-orange-600">2</span><br/>{barsLabel(2)}</div>
                <div className="rounded bg-accent/10 p-1.5"><span className="font-bold text-accent">3</span><br/>{barsLabel(3)}</div>
                <div className="rounded bg-green-50 p-1.5"><span className="font-bold text-green-600">4</span><br/>{barsLabel(4)}</div>
                <div className="rounded bg-green-100 p-1.5"><span className="font-bold text-green-700">5</span><br/>{barsLabel(5)}</div>
              </div>
            </div>
            {scenarioContext && (
              <div>
                <p className="font-semibold text-foreground mb-1">{t("assessorPortal.observation.guide.scenarioContext")}</p>
                <p className="text-xs">{scenarioContext}</p>
              </div>
            )}
            {assessorNotes && (
              <div>
                <p className="font-semibold text-foreground mb-1">{t("assessorPortal.observation.guide.assessorNotes")}</p>
                <p className="text-xs">{assessorNotes}</p>
              </div>
            )}
          </div>
        )}
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">{t("assessorPortal.observation.tabs.overview")}</TabsTrigger>
          <TabsTrigger value="observe">{t("assessorPortal.observation.tabs.observe")}</TabsTrigger>
          <TabsTrigger value="rate">{t("assessorPortal.observation.tabs.rate", { rated: Object.values(ratings).filter((r) => r.score > 0).length, total: competencies.length })}</TabsTrigger>
          <TabsTrigger value="questions">{t("assessorPortal.observation.tabs.questions")}</TabsTrigger>
        </TabsList>

        {/* OVERVIEW TAB - Quick Score Grid */}
        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{t("assessorPortal.observation.overview.title")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {competencies.map((comp) => {
                  const r = ratings[comp.id];
                  const compObs = getObsForCompetency(comp.id);
                  const score = r?.score ?? 0;
                  return (
                    <div key={comp.id} className="flex items-center gap-3 py-1.5 border-b last:border-0">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{comp.name}</p>
                        {comp.tags && comp.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-0.5">
                            {comp.tags.slice(0, 4).map((tag) => (
                              <Badge key={tag} variant="outline" className="text-[9px] px-1.5 py-0 h-4">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {t("assessorPortal.observation.overview.obs", { count: compObs.length })}
                      </span>
                      <div className="flex gap-0.5 shrink-0">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Button
                            key={s}
                            variant={score === s ? "default" : "outline"}
                            size="sm"
                            className={cn(
                              "h-7 w-7 p-0 text-xs",
                              score === s && s >= 4 && "bg-green-600 hover:bg-green-700",
                              score === s && s === 3 && "bg-accent hover:bg-accent/90",
                              score === s && s <= 2 && "bg-red-500 hover:bg-red-600",
                            )}
                            onClick={() => {
                              setRatings((prev) => ({
                                ...prev,
                                [comp.id]: { score: s, justification: prev[comp.id]?.justification ?? "" },
                              }));
                              handleSaveRating(comp.id, s);
                            }}
                          >
                            {s}
                          </Button>
                        ))}
                        <Button
                          variant={!score ? "secondary" : "ghost"}
                          size="sm"
                          className="h-7 px-1.5 text-[9px] text-muted-foreground"
                          onClick={() => handleMarkNE(comp.id)}
                          title={t("assessorPortal.observation.overview.noEvidence")}
                        >
                          NE
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* OBSERVE TAB */}
        <TabsContent value="observe" className="space-y-4">
          {/* Quick add form */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{t("assessorPortal.observation.observe.recordTitle")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>{t("assessorPortal.observation.observe.competency")}</Label>
                  <Select value={newObsCompId} onValueChange={setNewObsCompId}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {competencies.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>{t("assessorPortal.observation.observe.indicator")}</Label>
                  <Select value={newObsPositive} onValueChange={setNewObsPositive}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="null">{t("assessorPortal.observation.observe.neutral")}</SelectItem>
                      <SelectItem value="true">{t("assessorPortal.observation.observe.positive")}</SelectItem>
                      <SelectItem value="false">{t("assessorPortal.observation.observe.negative")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {/* Behavioral indicators reference */}
              {newObsCompId && getIndicators(newObsCompId).length > 0 && (
                <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground">{t("assessorPortal.observation.observe.lookForBehaviors")}</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-[10px] font-medium text-green-700 mb-1">{t("assessorPortal.observation.observe.positiveIndicators")}</p>
                      {getIndicators(newObsCompId, "positive").map((bi) => (
                        <button
                          key={bi.id}
                          type="button"
                          className="block w-full text-left text-[11px] text-muted-foreground hover:text-foreground hover:bg-green-50 rounded px-1.5 py-0.5 transition-colors cursor-pointer"
                          onClick={() => {
                            setNewObsText(bi.description);
                            setNewObsPositive("true");
                          }}
                        >
                          + {bi.description}
                        </button>
                      ))}
                    </div>
                    <div>
                      <p className="text-[10px] font-medium text-red-700 mb-1">{t("assessorPortal.observation.observe.negativeIndicators")}</p>
                      {getIndicators(newObsCompId, "negative").map((bi) => (
                        <button
                          key={bi.id}
                          type="button"
                          className="block w-full text-left text-[11px] text-muted-foreground hover:text-foreground hover:bg-red-50 rounded px-1.5 py-0.5 transition-colors cursor-pointer"
                          onClick={() => {
                            setNewObsText(bi.description);
                            setNewObsPositive("false");
                          }}
                        >
                          − {bi.description}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <Label>{t("assessorPortal.observation.observe.behavioralObservation")}</Label>
                <Textarea
                  value={newObsText}
                  onChange={(e) => setNewObsText(e.target.value)}
                  placeholder={t("assessorPortal.observation.observe.placeholder")}
                  rows={3}
                />
              </div>
              <Button
                onClick={handleAddObservation}
                disabled={!newObsText.trim() || saving}
                className="w-full"
              >
                {saving ? t("assessorPortal.observation.observe.saving") : <><Plus className="h-4 w-4 me-1" />{t("assessorPortal.observation.observe.addObservation")}</>}
              </Button>
            </CardContent>
          </Card>

          {/* Observations list by competency */}
          {competencies.map((comp) => {
            const compObs = getObsForCompetency(comp.id);
            if (compObs.length === 0) return null;
            return (
              <Card key={comp.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">{comp.name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {compObs.map((obs) => (
                    <div
                      key={obs.id}
                      className={cn(
                        "flex items-start gap-2 rounded-md border p-2 text-sm",
                        obs.is_positive === true && "border-green-200 bg-green-50",
                        obs.is_positive === false && "border-red-200 bg-red-50"
                      )}
                    >
                      <span className="flex-1">{obs.behavior_observed}</span>
                      <div className="flex items-center gap-1 shrink-0">
                        {obs.is_positive === true && (
                          <Badge variant="outline" className="text-green-700 border-green-300 text-xs">+</Badge>
                        )}
                        {obs.is_positive === false && (
                          <Badge variant="outline" className="text-red-700 border-red-300 text-xs">-</Badge>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDeleteObservation(obs.id)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            );
          })}

          {observations.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              {t("assessorPortal.observation.observe.noObservations")}
            </p>
          )}
        </TabsContent>

        {/* RATE TAB */}
        <TabsContent value="rate" className="space-y-4">
          {competencies.map((comp) => {
            const compObs = getObsForCompetency(comp.id);
            const r = ratings[comp.id] ?? { score: 0, justification: "" };

            return (
              <Card key={comp.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium">{comp.name}</CardTitle>
                    {r.score > 0 && (
                      <Badge variant={r.score >= 3 ? "default" : "destructive"}>
                        {r.score} - {barsLabel(r.score)}
                      </Badge>
                    )}
                  </div>
                  {comp.description && (
                    <p className="text-xs text-muted-foreground">{comp.description}</p>
                  )}
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Behavioral indicators reference */}
                  {getIndicators(comp.id).length > 0 && (
                    <div className="rounded-md bg-muted/40 p-2.5 space-y-1">
                      <p className="text-[10px] font-semibold text-muted-foreground">{t("assessorPortal.observation.rate.behavioralIndicators")}</p>
                      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                        {getIndicators(comp.id, "positive").slice(0, 4).map((bi) => (
                          <p key={bi.id} className="text-[10px] text-green-700">+ {bi.description}</p>
                        ))}
                        {getIndicators(comp.id, "negative").slice(0, 2).map((bi) => (
                          <p key={bi.id} className="text-[10px] text-red-600">− {bi.description}</p>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Show observation count */}
                  <p className="text-xs text-muted-foreground">
                    {t(compObs.length === 1 ? "assessorPortal.observation.rate.observationsRecorded_one" : "assessorPortal.observation.rate.observationsRecorded_other", { count: compObs.length })}
                    {compObs.length > 0 && (
                      <>
                        {" "}({compObs.filter((o) => o.is_positive === true).length}+
                        {" "}{compObs.filter((o) => o.is_positive === false).length}-)
                      </>
                    )}
                  </p>

                  {/* Rating selector */}
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((score) => (
                      <Button
                        key={score}
                        variant={r.score === score ? "default" : "outline"}
                        size="sm"
                        className="flex-1"
                        onClick={() => {
                          setRatings((prev) => ({
                            ...prev,
                            [comp.id]: { ...prev[comp.id], score, justification: prev[comp.id]?.justification ?? "" },
                          }));
                          handleSaveRating(comp.id, score);
                        }}
                      >
                        {score}
                      </Button>
                    ))}
                    <Button
                      variant={!r.score ? "secondary" : "ghost"}
                      size="sm"
                      className="text-xs text-muted-foreground"
                      onClick={() => handleMarkNE(comp.id)}
                      title={t("assessorPortal.observation.rate.noEvidenceTitle")}
                    >
                      NE
                    </Button>
                  </div>
                  <p className="text-xs text-center text-muted-foreground">
                    {r.score > 0 ? barsLabel(r.score) : !ratings[comp.id] ? t("assessorPortal.observation.rate.neNoEvidence") : t("assessorPortal.observation.rate.selectRating")}
                  </p>

                  {/* Justification */}
                  <Textarea
                    placeholder={t("assessorPortal.observation.rate.justificationPlaceholder")}
                    rows={2}
                    value={r.justification}
                    onChange={(e) =>
                      setRatings((prev) => ({
                        ...prev,
                        [comp.id]: { ...prev[comp.id], score: prev[comp.id]?.score ?? 0, justification: e.target.value },
                      }))
                    }
                  />

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleSaveRating(comp.id)}
                    disabled={!r.score || savingRating === comp.id}
                    className="w-full"
                  >
                    {savingRating === comp.id ? t("assessorPortal.observation.rate.saving") : t("assessorPortal.observation.rate.saveRating")}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        {/* Q&A TAB */}
        <TabsContent value="questions" className="space-y-4">
          {competencies.map((comp) => {
            if (!comp.qa_questions || comp.qa_questions.length === 0) return null;
            return (
              <Card key={comp.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">{comp.name}</CardTitle>
                  {comp.tags && comp.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {comp.tags.map((tag) => (
                        <Badge key={tag} variant="outline" className="text-[9px] px-1.5 py-0">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardHeader>
                <CardContent>
                  <p className="text-[10px] text-muted-foreground mb-2 font-medium">{t("assessorPortal.observation.questions.suggested")}</p>
                  <div className="space-y-2">
                    {comp.qa_questions.map((q, i) => (
                      <div key={i} className="flex gap-2 text-sm">
                        <span className="text-accent font-bold shrink-0">{i + 1}.</span>
                        <p className="text-muted-foreground">{q}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {competencies.every((c) => !c.qa_questions || c.qa_questions.length === 0) && (
            <p className="text-sm text-muted-foreground py-8 text-center">
              {t("assessorPortal.observation.questions.none")}
            </p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
