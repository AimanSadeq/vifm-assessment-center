"use client";

import { useState } from "react";
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
import { EXERCISE_TYPE_LABELS, EXERCISE_TYPES } from "@/lib/constants/exercise-types";
import { createExerciseAction } from "../actions";

type Props = {
  exercises: Exercise[];
};

export function StepExercises({ exercises: initialExercises }: Props) {
  const state = useWizard();
  const dispatch = useWizardDispatch();
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
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Step 3: Select Exercises</CardTitle>
          <div className="flex items-center gap-2">
            <Badge
              variant={
                state.selectedExerciseIds.length >= 1 ? "default" : "destructive"
              }
            >
              {state.selectedExerciseIds.length} selected
            </Badge>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  + Add Exercise
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Exercise</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label>Name *</Label>
                    <Input
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="Exercise name"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Type *</Label>
                    <Select value={newType} onValueChange={setNewType}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select exercise type..." />
                      </SelectTrigger>
                      <SelectContent>
                        {EXERCISE_TYPES.map((type) => (
                          <SelectItem key={type} value={type}>
                            {EXERCISE_TYPE_LABELS[type]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Duration (minutes)</Label>
                    <Input
                      type="number"
                      value={newDuration}
                      onChange={(e) => setNewDuration(e.target.value)}
                      placeholder="e.g., 60"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Description</Label>
                    <Textarea
                      value={newDescription}
                      onChange={(e) => setNewDescription(e.target.value)}
                      placeholder="Brief description..."
                      rows={3}
                    />
                  </div>
                  <Button
                    onClick={handleCreateExercise}
                    disabled={!newName.trim() || !newType || creating}
                    className="w-full"
                  >
                    {creating ? "Creating..." : "Create Exercise"}
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
            No exercises in the library yet. Create one using the button above.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10"></TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="w-24">Duration</TableHead>
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
                      {EXERCISE_TYPE_LABELS[exercise.exercise_type] ??
                        exercise.exercise_type}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {exercise.duration_minutes
                      ? `${exercise.duration_minutes} min`
                      : "—"}
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
