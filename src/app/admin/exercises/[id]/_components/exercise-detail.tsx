"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import { EXERCISE_TYPE_LABELS } from "@/lib/constants/exercise-types";
import { Clock, FileText, Users, Save, MessageSquare } from "lucide-react";
import { updateExerciseAction, saveRolePlayerPromptAction } from "../actions";

type Props = {
  exercise: Record<string, unknown>;
  rolePlayerPrompts: Record<string, unknown>[];
};

export function ExerciseDetail({ exercise, rolePlayerPrompts }: Props) {
  const router = useRouter();
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
      toast.error(typeof result.error === "string" ? result.error : "Failed to save");
    } else {
      toast.success("Exercise saved");
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
        <BackLink href="/admin/exercises" label="Back to Exercises" />
        <h1 className="mt-2 text-2xl font-bold">{exercise.name as string}</h1>
        <div className="flex items-center gap-2 mt-1">
          <Badge>{EXERCISE_TYPE_LABELS[exType] ?? exType}</Badge>
          {exercise.duration_minutes ? (
            <span className="text-sm text-muted-foreground">{exercise.duration_minutes as number} min total</span>
          ) : null}
        </div>
      </div>

      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details" className="gap-1.5"><FileText className="h-3.5 w-3.5" />Details & Briefing</TabsTrigger>
          <TabsTrigger value="timing" className="gap-1.5"><Clock className="h-3.5 w-3.5" />Timing</TabsTrigger>
          {isRolePlay && (
            <TabsTrigger value="roleplay" className="gap-1.5"><Users className="h-3.5 w-3.5" />Role Player Guide</TabsTrigger>
          )}
          <TabsTrigger value="assessor" className="gap-1.5"><MessageSquare className="h-3.5 w-3.5" />Assessor Notes</TabsTrigger>
        </TabsList>

        {/* Details & Briefing Tab */}
        <TabsContent value="details" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Exercise Description</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Brief description of the exercise..." />
              </div>
              <div className="space-y-2">
                <Label>Instructions for Assessors</Label>
                <Textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={3} placeholder="How to administer this exercise..." />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Participant Briefing</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Scenario Context</Label>
                <Textarea value={scenarioContext} onChange={(e) => setScenarioContext(e.target.value)} rows={4} placeholder="Background story and context for the exercise scenario. Describe the fictional company, the participant's role, and the situation they will face..." />
              </div>
              <div className="space-y-2">
                <Label>Participant Brief / Task Description</Label>
                <Textarea value={participantBrief} onChange={(e) => setParticipantBrief(e.target.value)} rows={4} placeholder="What the participant needs to do. Include deliverables, time allocation guidance, and any specific instructions..." />
              </div>
            </CardContent>
          </Card>

          <Button onClick={handleSaveExercise} disabled={saving} className="gap-2">
            <Save className="h-4 w-4" />
            {saving ? "Saving..." : "Save Details"}
          </Button>
        </TabsContent>

        {/* Timing Tab */}
        <TabsContent value="timing">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Exercise Timing Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Instructions (minutes)</Label>
                  <Input type="number" value={instructionsMinutes} onChange={(e) => setInstructionsMinutes(Number(e.target.value))} placeholder="10" />
                  <p className="text-[10px] text-muted-foreground">Time for reading instructions</p>
                </div>
                <div className="space-y-2">
                  <Label>Preparation (minutes)</Label>
                  <Input type="number" value={prepMinutes} onChange={(e) => setPrepMinutes(Number(e.target.value))} placeholder="e.g., 60" />
                  <p className="text-[10px] text-muted-foreground">Time for analysis and preparation</p>
                </div>
                <div className="space-y-2">
                  <Label>Meeting / Presentation (minutes)</Label>
                  <Input type="number" value={meetingMinutes} onChange={(e) => setMeetingMinutes(Number(e.target.value))} placeholder="e.g., 25" />
                  <p className="text-[10px] text-muted-foreground">Live interaction time</p>
                </div>
              </div>

              <Separator />

              <div className="flex items-center justify-between rounded-lg bg-muted/50 p-4">
                <div>
                  <p className="text-sm font-semibold">Total Exercise Time</p>
                  <p className="text-xs text-muted-foreground">Instructions + Preparation + Meeting</p>
                </div>
                <div className="text-2xl font-bold text-accent">
                  {totalMinutes > 0 ? `${totalMinutes} min` : "-"}
                </div>
              </div>

              <Button onClick={handleSaveExercise} disabled={saving} className="gap-2">
                <Save className="h-4 w-4" />
                {saving ? "Saving..." : "Save Timing"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Role Player Guide Tab */}
        {isRolePlay && (
          <TabsContent value="roleplay">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Role Player Guide</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Instructions for the person playing the role in this exercise.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Character Name</Label>
                    <Input value={characterName} onChange={(e) => setCharacterName(e.target.value)} placeholder="e.g., Sam Vallée" />
                  </div>
                  <div className="space-y-2">
                    <Label>Character Role / Title</Label>
                    <Input value={characterRole} onChange={(e) => setCharacterRole(e.target.value)} placeholder="e.g., Sales & Marketing Director" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Character Attitude & Personality</Label>
                  <Textarea value={characterAttitude} onChange={(e) => setCharacterAttitude(e.target.value)} rows={3} placeholder="Describe the character's demeanor, attitude, and how they should behave during the exercise. Include trigger points and emotional reactions..." />
                </div>

                <div className="space-y-2">
                  <Label>Meeting Objectives</Label>
                  <Textarea value={meetingObjectives} onChange={(e) => setMeetingObjectives(e.target.value)} rows={3} placeholder="What the role player should try to achieve or explore during the meeting. Key topics to raise, challenges to introduce..." />
                </div>

                <div className="space-y-2">
                  <Label>Prompt Script / Talking Points</Label>
                  <Textarea value={promptText} onChange={(e) => setPromptText(e.target.value)} rows={4} placeholder="Key lines, questions, and responses the role player should use. Include standard prompts and escalation triggers..." />
                </div>

                <div className="space-y-2">
                  <Label>Trigger Behaviors to Watch For</Label>
                  <Textarea value={triggerBehaviors} onChange={(e) => setTriggerBehaviors(e.target.value)} rows={3} placeholder="Specific candidate behaviors that should trigger certain role player responses. e.g., 'If candidate becomes defensive, push back harder...'" />
                </div>

                <Button onClick={handleSavePrompt} disabled={savingPrompt || !promptText.trim()} className="gap-2">
                  <Save className="h-4 w-4" />
                  {savingPrompt ? "Saving..." : existingPrompt ? "Update Role Player Guide" : "Save Role Player Guide"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* Assessor Notes Tab */}
        <TabsContent value="assessor">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Assessor Notes</CardTitle>
              <p className="text-sm text-muted-foreground">
                Private notes for assessors about this exercise - key issues to watch for, common pitfalls, administration tips.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea value={assessorNotes} onChange={(e) => setAssessorNotes(e.target.value)} rows={8} placeholder="Notes for assessors:&#10;&#10;• Key issues participants should identify&#10;• Common mistakes to watch for&#10;• Tips for the Q&A session&#10;• Exercise-specific behavioral indicators to focus on..." />

              <Button onClick={handleSaveExercise} disabled={saving} className="gap-2">
                <Save className="h-4 w-4" />
                {saving ? "Saving..." : "Save Notes"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
