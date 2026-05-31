"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import type { Exercise } from "@/types/database";
import { useWizard, useWizardDispatch } from "./wizard-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EXERCISE_TYPES } from "@/lib/constants/exercise-types";
import { createExerciseAction } from "../actions";

type Props = {
  exercises: Exercise[];
};

export function StepExercises({ exercises: initialExercises }: Props) {
  const state = useWizard();
  const dispatch = useWizardDispatch();
  const { t } = useTranslation();
  const typeLabel = (k: string) => {
    const v = t(`exercise.types.${k}`);
    return v.startsWith("exercise.types.") ? k : v;
  };
  const [exercises, setExercises] = useState(initialExercises);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  // New exercise form
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("");
  const [newDuration, setNewDuration] = useState("");
  const [newDescription, setNewDescription] = useState("");

  const handleCreateExercise = async () => {
    if (!newName.trim() || !newType) return;
    setCreating(true);
    const result = await createExerciseAction({
      name: newName,
      exerciseType: newType,
      durationMinutes: newDuration ? Number(newDuration) : undefined,
      description: newDescription || undefined,
    });
    setCreating(false);

    if ("data" in result && result.data) {
      setExercises((prev) => [...prev, result.data]);
      dispatch({ type: "TOGGLE_EXERCISE", exerciseId: result.data.id });
      setDialogOpen(false);
      setNewName("");
      setNewType("");
      setNewDuration("");
      setNewDescription("");
      toast.success(t("adminWizard.step3.exerciseCreatedToast"));
    } else if ("error" in result) {
      toast.error(typeof result.error === "string" ? result.error : t("adminWizard.step3.exerciseCreateFailedToast"));
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{t("adminWizard.step3.title")}</CardTitle>
          <div className="flex items-center gap-2">
            <Badge
              variant={
                state.selectedExerciseIds.length >= 1 ? "default" : "destructive"
              }
            >
              {t("adminWizard.step3.selectedBadge", { count: state.selectedExerciseIds.length })}
            </Badge>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  {t("adminWizard.step3.addExercise")}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t("adminWizard.step3.createExercise")}</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label>{t("adminWizard.step3.name")}</Label>
                    <Input
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder={t("adminWizard.step3.exerciseNamePlaceholder")}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>{t("adminWizard.step3.type")}</Label>
                    <Select value={newType} onValueChange={setNewType}>
                      <SelectTrigger>
                        <SelectValue placeholder={t("adminWizard.step3.selectType")} />
                      </SelectTrigger>
                      <SelectContent>
                        {EXERCISE_TYPES.map((type) => (
                          <SelectItem key={type} value={type}>
                            {typeLabel(type)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>{t("adminWizard.step3.duration")}</Label>
                    <Input
                      type="number"
                      value={newDuration}
                      onChange={(e) => setNewDuration(e.target.value)}
                      placeholder={t("adminWizard.step3.durationPlaceholder")}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>{t("adminWizard.step3.description")}</Label>
                    <Textarea
                      value={newDescription}
                      onChange={(e) => setNewDescription(e.target.value)}
                      placeholder={t("adminWizard.step3.descriptionPlaceholder")}
                      rows={3}
                    />
                  </div>
                  <Button
                    onClick={handleCreateExercise}
                    disabled={!newName.trim() || !newType || creating}
                    className="w-full"
                  >
                    {creating ? t("adminWizard.step3.creating") : t("adminWizard.step3.createExercise")}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {exercises.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            {t("adminWizard.step3.emptyLibrary")}
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10"></TableHead>
                <TableHead>{t("adminWizard.step3.colName")}</TableHead>
                <TableHead>{t("adminWizard.step3.colType")}</TableHead>
                <TableHead className="w-24">{t("adminWizard.step3.colDuration")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {exercises.map((exercise) => (
                <TableRow key={exercise.id}>
                  <TableCell>
                    <Checkbox
                      checked={state.selectedExerciseIds.includes(exercise.id)}
                      onCheckedChange={() =>
                        dispatch({
                          type: "TOGGLE_EXERCISE",
                          exerciseId: exercise.id,
                        })
                      }
                    />
                  </TableCell>
                  <TableCell className="font-medium">
                    {exercise.name}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {typeLabel(exercise.exercise_type)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {exercise.duration_minutes
                      ? t("adminWizard.step3.minutesSuffix", { n: exercise.duration_minutes })
                      : "-"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
