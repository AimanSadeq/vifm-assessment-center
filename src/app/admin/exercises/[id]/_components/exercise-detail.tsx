"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BackLink } from "@/components/shared/back-link";
import { Clock, FileText, Users, Save, MessageSquare } from "lucide-react";
import { updateExerciseAction, saveRolePlayerPromptAction } from "../actions";

type Props = {
  exercise: Record<string, unknown>;
  rolePlayerPrompts: Record<string, unknown>[];
};

export function ExerciseDetail({ exercise, rolePlayerPrompts }: Props) {
  const router = useRouter();
  const { t } = useTranslation();
  const typeLabel = (k: string) => {
    const v = t(`exercise.types.${k}`);
    return v.startsWith("exercise.types.") ? k : v;
  };
  const [saving, setSaving] = useState(false);
  const [savingPrompt, setSavingPrompt] = useState(false);

  // Exercise fields
  const [description, setDescription] = useState((exercise.description as string) ?? "");
  const [instructions, setInstructions] = useState((exercise.instructions as string) ?? "");
  const [prepMinutes, setPrepMinutes] = useState((exercise.prep_minutes as number) ?? "");
  const [meetingMinutes, setMeetingMinutes] = useState((exercise.meeting_minutes as number) ?? "");
  const [instructionsMinutes, setInstructionsMinutes] = useState((exercise.instructions_minutes as number) ?? 10);
  const [participantBrief, setParticipantBrief] = useState((exercise.participant_brief as string) ?? "");
  const [scenarioContext, setScenarioContext] = useState((exercise.scenario_context as string) ?? "");
  const [assessorNotes, setAssessorNotes] = useState((exercise.assessor_notes as string) ?? "");

  // Role player prompt
  const existingPrompt = rolePlayerPrompts[0] ?? null;
  const [promptText, setPromptText] = useState((existingPrompt?.prompt_text as string) ?? "");
  const [triggerBehaviors, setTriggerBehaviors] = useState((existingPrompt?.trigger_behaviors as string) ?? "");
  const [characterName, setCharacterName] = useState((existingPrompt?.character_name as string) ?? "");
  const [characterRole, setCharacterRole] = useState((existingPrompt?.character_role as string) ?? "");
  const [characterAttitude, setCharacterAttitude] = useState((existingPrompt?.character_attitude as string) ?? "");
  const [meetingObjectives, setMeetingObjectives] = useState((existingPrompt?.meeting_objectives as string) ?? "");

  const handleSaveExercise = async () => {
    setSaving(true);
    const result = await updateExerciseAction(exercise.id as string, {
      description,
      instructions,
      prep_minutes: prepMinutes ? Number(prepMinutes) : null,
      meeting_minutes: meetingMinutes ? Number(meetingMinutes) : null,
      instructions_minutes: instructionsMinutes ? Number(instructionsMinutes) : null,
      participant_brief: participantBrief || null,
      scenario_context: scenarioContext || null,
      assessor_notes: assessorNotes || null,
    });
    setSaving(false);
    if ("error" in result) {
      toast.error(typeof result.error === "string" ? result.error : t("exercise.failedSave"));
    } else {
      toast.success(t("exercise.savedExercise"));
    }
    router.refresh();
  };

  const handleSavePrompt = async () => {
    setSavingPrompt(true);
    await saveRolePlayerPromptAction({
      id: existingPrompt?.id as string | undefined,
      exercise_id: exercise.id as string,
      prompt_text: promptText,
      trigger_behaviors: triggerBehaviors || undefined,
      character_name: characterName || undefined,
      character_role: characterRole || undefined,
      character_attitude: characterAttitude || undefined,
      meeting_objectives: meetingObjectives || undefined,
    });
    setSavingPrompt(false);
    router.refresh();
  };

  const exType = exercise.exercise_type as string;
  const isRolePlay = exType === "role_play";
  const totalMinutes = (Number(instructionsMinutes) || 0) + (Number(prepMinutes) || 0) + (Number(meetingMinutes) || 0);

  return (
    <div className="space-y-6">
      <div>
        <BackLink href="/admin/exercises" label={t("exercise.back")} />
        <h1 className="mt-2 text-2xl font-bold">{exercise.name as string}</h1>
        <div className="flex items-center gap-2 mt-1">
          <Badge>{typeLabel(exType)}</Badge>
          {exercise.duration_minutes ? (
            <span className="text-sm text-muted-foreground">{t("exercise.minTotal", { n: exercise.duration_minutes as number })}</span>
          ) : null}
        </div>
      </div>

      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details" className="gap-1.5"><FileText className="h-3.5 w-3.5" />{t("exercise.tabDetails")}</TabsTrigger>
          <TabsTrigger value="timing" className="gap-1.5"><Clock className="h-3.5 w-3.5" />{t("exercise.tabTiming")}</TabsTrigger>
          {isRolePlay && (
            <TabsTrigger value="roleplay" className="gap-1.5"><Users className="h-3.5 w-3.5" />{t("exercise.tabRolePlay")}</TabsTrigger>
          )}
          <TabsTrigger value="assessor" className="gap-1.5"><MessageSquare className="h-3.5 w-3.5" />{t("exercise.tabAssessor")}</TabsTrigger>
        </TabsList>

        {/* Details & Briefing Tab */}
        <TabsContent value="details" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("exercise.cardDescription")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>{t("exercise.lblDescription")}</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder={t("exercise.phDescription")} />
              </div>
              <div className="space-y-2">
                <Label>{t("exercise.lblInstructions")}</Label>
                <Textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={3} placeholder={t("exercise.phInstructions")} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("exercise.cardParticipantBrief")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>{t("exercise.lblScenario")}</Label>
                <Textarea value={scenarioContext} onChange={(e) => setScenarioContext(e.target.value)} rows={4} placeholder={t("exercise.phScenario")} />
              </div>
              <div className="space-y-2">
                <Label>{t("exercise.lblBrief")}</Label>
                <Textarea value={participantBrief} onChange={(e) => setParticipantBrief(e.target.value)} rows={4} placeholder={t("exercise.phBrief")} />
              </div>
            </CardContent>
          </Card>

          <Button onClick={handleSaveExercise} disabled={saving} className="gap-2">
            <Save className="h-4 w-4" />
            {saving ? t("exercise.saving") : t("exercise.saveDetails")}
          </Button>
        </TabsContent>

        {/* Timing Tab */}
        <TabsContent value="timing">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("exercise.cardTiming")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>{t("exercise.lblInstrMin")}</Label>
                  <Input type="number" value={instructionsMinutes} onChange={(e) => setInstructionsMinutes(Number(e.target.value))} placeholder="10" />
                  <p className="text-[10px] text-muted-foreground">{t("exercise.hintInstrMin")}</p>
                </div>
                <div className="space-y-2">
                  <Label>{t("exercise.lblPrepMin")}</Label>
                  <Input type="number" value={prepMinutes} onChange={(e) => setPrepMinutes(Number(e.target.value))} placeholder="e.g., 60" />
                  <p className="text-[10px] text-muted-foreground">{t("exercise.hintPrepMin")}</p>
                </div>
                <div className="space-y-2">
                  <Label>{t("exercise.lblMeetMin")}</Label>
                  <Input type="number" value={meetingMinutes} onChange={(e) => setMeetingMinutes(Number(e.target.value))} placeholder="e.g., 25" />
                  <p className="text-[10px] text-muted-foreground">{t("exercise.hintMeetMin")}</p>
                </div>
              </div>

              <Separator />

              <div className="flex items-center justify-between rounded-lg bg-muted/50 p-4">
                <div>
                  <p className="text-sm font-semibold">{t("exercise.totalTime")}</p>
                  <p className="text-xs text-muted-foreground">{t("exercise.totalFormula")}</p>
                </div>
                <div className="text-2xl font-bold text-accent">
                  {totalMinutes > 0 ? `${totalMinutes} ${t("exercise.minShort")}` : "-"}
                </div>
              </div>

              <Button onClick={handleSaveExercise} disabled={saving} className="gap-2">
                <Save className="h-4 w-4" />
                {saving ? t("exercise.saving") : t("exercise.saveTiming")}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Role Player Guide Tab */}
        {isRolePlay && (
          <TabsContent value="roleplay">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t("exercise.rpGuide")}</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {t("exercise.rpGuideIntro")}
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t("exercise.lblCharName")}</Label>
                    <Input value={characterName} onChange={(e) => setCharacterName(e.target.value)} placeholder={t("exercise.phCharName")} />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("exercise.lblCharRole")}</Label>
                    <Input value={characterRole} onChange={(e) => setCharacterRole(e.target.value)} placeholder={t("exercise.phCharRole")} />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>{t("exercise.lblCharAttitude")}</Label>
                  <Textarea value={characterAttitude} onChange={(e) => setCharacterAttitude(e.target.value)} rows={3} placeholder={t("exercise.phCharAttitude")} />
                </div>

                <div className="space-y-2">
                  <Label>{t("exercise.lblMeetObj")}</Label>
                  <Textarea value={meetingObjectives} onChange={(e) => setMeetingObjectives(e.target.value)} rows={3} placeholder={t("exercise.phMeetObj")} />
                </div>

                <div className="space-y-2">
                  <Label>{t("exercise.lblPrompt")}</Label>
                  <Textarea value={promptText} onChange={(e) => setPromptText(e.target.value)} rows={4} placeholder={t("exercise.phPrompt")} />
                </div>

                <div className="space-y-2">
                  <Label>{t("exercise.lblTriggers")}</Label>
                  <Textarea value={triggerBehaviors} onChange={(e) => setTriggerBehaviors(e.target.value)} rows={3} placeholder={t("exercise.phTriggers")} />
                </div>

                <Button onClick={handleSavePrompt} disabled={savingPrompt || !promptText.trim()} className="gap-2">
                  <Save className="h-4 w-4" />
                  {savingPrompt ? t("exercise.saving") : existingPrompt ? t("exercise.updateRpGuide") : t("exercise.saveRpGuide")}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* Assessor Notes Tab */}
        <TabsContent value="assessor">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("exercise.cardAssessorNotes")}</CardTitle>
              <p className="text-sm text-muted-foreground">
                {t("exercise.assessorNotesIntro")}
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea value={assessorNotes} onChange={(e) => setAssessorNotes(e.target.value)} rows={8} placeholder={t("exercise.phAssessorNotes")} />

              <Button onClick={handleSaveExercise} disabled={saving} className="gap-2">
                <Save className="h-4 w-4" />
                {saving ? t("exercise.saving") : t("exercise.saveNotes")}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
