"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { EXERCISE_TYPE_LABELS } from "@/lib/constants/exercise-types";
import { addCandidateAction, createAssignmentAction, addDemoAssessorAction, updateEngagementStatusAction, removeCandidateAction, deleteAssignmentAction } from "../actions";
import { Trash2 } from "lucide-react";

type Props = {
  engagement: Record<string, unknown>;
  candidates: Record<string, unknown>[];
  exercises: Record<string, unknown>[];
  assignments: Record<string, unknown>[];
  assessors: Record<string, unknown>[];
  matrix: Record<string, unknown>[];
};

export function EngagementDetail({
  engagement,
  candidates: initCandidates,
  exercises,
  assignments: initAssignments,
  assessors: initAssessors,
  matrix,
}: Props) {
  const router = useRouter();
  const [candidates, setCandidates] = useState(initCandidates);
  const [assignments, setAssignments] = useState(initAssignments);
  const [assessors, setAssessors] = useState(initAssessors);

  // Add candidate dialog
  const [candDialogOpen, setCandDialogOpen] = useState(false);
  const [candName, setCandName] = useState("");
  const [candEmail, setCandEmail] = useState("");
  const [candCreating, setCandCreating] = useState(false);

  // Add assessor dialog
  const [assessorDialogOpen, setAssessorDialogOpen] = useState(false);
  const [assessorName, setAssessorName] = useState("");
  const [assessorEmail, setAssessorEmail] = useState("");
  const [assessorCreating, setAssessorCreating] = useState(false);

  // Assign dialog
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [assignAssessorId, setAssignAssessorId] = useState("");
  const [assignCandidateId, setAssignCandidateId] = useState("");
  const [assignExerciseId, setAssignExerciseId] = useState("");
  const [assigning, setAssigning] = useState(false);

  // Status confirmation dialog
  const [statusConfirm, setStatusConfirm] = useState<{ open: boolean; status: string; label: string }>({ open: false, status: "", label: "" });
  const [statusUpdating, setStatusUpdating] = useState(false);

  const handleStatusChange = async () => {
    setStatusUpdating(true);
    const result = await updateEngagementStatusAction(engagement.id as string, statusConfirm.status);
    setStatusUpdating(false);
    setStatusConfirm({ open: false, status: "", label: "" });
    if ("error" in result && result.error) {
      toast.error(typeof result.error === "string" ? result.error : "Failed to update status");
    } else {
      toast.success(`Engagement ${statusConfirm.label.toLowerCase()}d`);
      router.refresh();
    }
  };

  const handleRemoveCandidate = async (candidateId: string, name: string) => {
    if (!confirm(`Remove candidate "${name}"? This will also delete their assignments.`)) return;
    const result = await removeCandidateAction(candidateId);
    if ("error" in result && result.error) {
      toast.error(typeof result.error === "string" ? result.error : "Failed to remove candidate");
    } else {
      setCandidates((prev) => prev.filter((c) => (c.id as string) !== candidateId));
      toast.success("Candidate removed");
      router.refresh();
    }
  };

  const handleDeleteAssignment = async (assignmentId: string) => {
    if (!confirm("Delete this assignment?")) return;
    const result = await deleteAssignmentAction(assignmentId);
    if ("error" in result && result.error) {
      toast.error(typeof result.error === "string" ? result.error : "Failed to delete assignment");
    } else {
      setAssignments((prev) => prev.filter((a) => (a.id as string) !== assignmentId));
      toast.success("Assignment deleted");
    }
  };

  const orgName =
    engagement.organizations &&
    typeof engagement.organizations === "object" &&
    "name" in (engagement.organizations as Record<string, unknown>)
      ? (engagement.organizations as { name: string }).name
      : "—";

  const handleAddCandidate = async () => {
    if (!candName.trim() || !candEmail.trim()) return;
    setCandCreating(true);
    const result = await addCandidateAction({
      engagementId: engagement.id as string,
      fullName: candName,
      email: candEmail,
    });
    setCandCreating(false);
    if ("data" in result && result.data) {
      setCandidates((prev) => [...prev, result.data]);
      setCandDialogOpen(false);
      setCandName("");
      setCandEmail("");
      toast.success("Candidate added");
    } else if ("error" in result) {
      toast.error(typeof result.error === "string" ? result.error : "Failed to add candidate");
    }
  };

  const handleAddAssessor = async () => {
    if (!assessorName.trim() || !assessorEmail.trim()) return;
    setAssessorCreating(true);
    const result = await addDemoAssessorAction({
      fullName: assessorName,
      email: assessorEmail,
    });
    setAssessorCreating(false);
    if ("data" in result && result.data) {
      setAssessors((prev) => [...prev, result.data]);
      setAssessorDialogOpen(false);
      setAssessorName("");
      setAssessorEmail("");
      toast.success("Assessor created");
    } else if ("error" in result) {
      toast.error(typeof result.error === "string" ? result.error : "Failed to create assessor");
    }
  };

  const handleAssign = async () => {
    if (!assignAssessorId || !assignCandidateId || !assignExerciseId) return;
    setAssigning(true);
    const result = await createAssignmentAction({
      engagementId: engagement.id as string,
      assessorId: assignAssessorId,
      candidateId: assignCandidateId,
      exerciseId: assignExerciseId,
    });
    setAssigning(false);
    if ("data" in result && result.data) {
      setAssignDialogOpen(false);
      setAssignAssessorId("");
      setAssignCandidateId("");
      setAssignExerciseId("");
      toast.success("Assignment created");
      router.refresh();
    } else if ("error" in result) {
      const msg = typeof result.error === "string" ? result.error : "Failed to create assignment";
      // Friendlier message for duplicate constraint
      if (msg.includes("duplicate") || msg.includes("unique")) {
        toast.error("This assignment already exists");
      } else {
        toast.error(msg);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">{engagement.name as string}</h1>
        <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
          <span>{orgName}</span>
          <Badge variant="secondary">{engagement.status as string}</Badge>
          {engagement.target_role ? <span>Target: {engagement.target_role as string}</span> : null}
          {/* Status transitions */}
          <div className="flex gap-1 ms-auto">
            {engagement.status === "draft" && (
              <Button size="sm" variant="default" onClick={() => setStatusConfirm({ open: true, status: "active", label: "Activate" })}>
                Activate
              </Button>
            )}
            {engagement.status === "active" && (
              <Button size="sm" variant="outline" onClick={() => setStatusConfirm({ open: true, status: "completed", label: "Complete" })}>
                Mark Complete
              </Button>
            )}
            {engagement.status === "completed" && (
              <Button size="sm" variant="ghost" onClick={() => setStatusConfirm({ open: true, status: "archived", label: "Archive" })}>
                Archive
              </Button>
            )}
          </div>
        </div>
      </div>

      <Tabs defaultValue="candidates">
        <TabsList>
          <TabsTrigger value="candidates">
            Candidates ({candidates.length})
          </TabsTrigger>
          <TabsTrigger value="assignments">
            Assignments ({assignments.length})
          </TabsTrigger>
          <TabsTrigger value="matrix">
            Matrix ({matrix.length})
          </TabsTrigger>
          <TabsTrigger value="reports">
            Reports
          </TabsTrigger>
        </TabsList>

        {/* Candidates Tab */}
        <TabsContent value="candidates">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Candidates</CardTitle>
                <Dialog open={candDialogOpen} onOpenChange={setCandDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm">+ Add Candidate</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add Candidate</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <Label>Full Name *</Label>
                        <Input
                          value={candName}
                          onChange={(e) => setCandName(e.target.value)}
                          placeholder="Candidate full name"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Email *</Label>
                        <Input
                          type="email"
                          value={candEmail}
                          onChange={(e) => setCandEmail(e.target.value)}
                          placeholder="candidate@example.com"
                        />
                      </div>
                      <Button
                        onClick={handleAddCandidate}
                        disabled={!candName.trim() || !candEmail.trim() || candCreating}
                        className="w-full"
                      >
                        {candCreating ? "Adding..." : "Add Candidate"}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {candidates.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No candidates yet.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {candidates.map((c) => (
                      <TableRow key={c.id as string}>
                        <TableCell className="font-medium">
                          {c.full_name as string}
                        </TableCell>
                        <TableCell>{c.email as string}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{c.status as string}</Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                            onClick={() => handleRemoveCandidate(c.id as string, c.full_name as string)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Assignments Tab */}
        <TabsContent value="assignments">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Assessor Assignments</CardTitle>
                <div className="flex gap-2">
                  <Dialog open={assessorDialogOpen} onOpenChange={setAssessorDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm">+ New Assessor</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Create Demo Assessor</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <Label>Full Name *</Label>
                          <Input
                            value={assessorName}
                            onChange={(e) => setAssessorName(e.target.value)}
                            placeholder="Assessor name"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label>Email *</Label>
                          <Input
                            type="email"
                            value={assessorEmail}
                            onChange={(e) => setAssessorEmail(e.target.value)}
                            placeholder="assessor@vifm.ae"
                          />
                        </div>
                        <Button
                          onClick={handleAddAssessor}
                          disabled={!assessorName.trim() || !assessorEmail.trim() || assessorCreating}
                          className="w-full"
                        >
                          {assessorCreating ? "Creating..." : "Create Assessor"}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>

                  <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm">+ Assign</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Create Assignment</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <Label>Assessor *</Label>
                          <Select value={assignAssessorId} onValueChange={setAssignAssessorId}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select assessor..." />
                            </SelectTrigger>
                            <SelectContent>
                              {assessors.map((a) => (
                                <SelectItem key={a.id as string} value={a.id as string}>
                                  {a.full_name as string}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label>Candidate *</Label>
                          <Select value={assignCandidateId} onValueChange={setAssignCandidateId}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select candidate..." />
                            </SelectTrigger>
                            <SelectContent>
                              {candidates.map((c) => (
                                <SelectItem key={c.id as string} value={c.id as string}>
                                  {c.full_name as string}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label>Exercise *</Label>
                          <Select value={assignExerciseId} onValueChange={setAssignExerciseId}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select exercise..." />
                            </SelectTrigger>
                            <SelectContent>
                              {exercises.map((e) => (
                                <SelectItem key={(e as Record<string, unknown>).id as string} value={(e as Record<string, unknown>).id as string}>
                                  {(e as Record<string, unknown>).name as string}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <Button
                          onClick={handleAssign}
                          disabled={!assignAssessorId || !assignCandidateId || !assignExerciseId || assigning}
                          className="w-full"
                        >
                          {assigning ? "Assigning..." : "Create Assignment"}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {assignments.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No assignments yet. Add candidates and assessors, then create assignments.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Assessor</TableHead>
                      <TableHead>Candidate</TableHead>
                      <TableHead>Exercise</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {assignments.map((a) => {
                      const profile = a.profiles as Record<string, unknown> | null;
                      const cand = a.candidates as Record<string, unknown> | null;
                      const ex = a.exercises as Record<string, unknown> | null;
                      return (
                        <TableRow key={a.id as string}>
                          <TableCell>{profile?.full_name as string ?? "—"}</TableCell>
                          <TableCell>{cand?.full_name as string ?? "—"}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{ex?.name as string ?? "—"}</Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                              onClick={() => handleDeleteAssignment(a.id as string)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Matrix Tab */}
        <TabsContent value="matrix">
          <Card>
            <CardHeader>
              <CardTitle>Exercise-Competency Matrix</CardTitle>
            </CardHeader>
            <CardContent>
              {matrix.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No matrix mappings configured.
                </p>
              ) : (
                <div className="space-y-1 text-sm">
                  {exercises.map((ex) => {
                    const exId = (ex as Record<string, unknown>).id as string;
                    const exName = (ex as Record<string, unknown>).name as string;
                    const comps = matrix
                      .filter((m) => m.exercise_id === exId)
                      .map((m) => {
                        const c = m.competencies as Record<string, unknown> | null;
                        return c?.name as string ?? "Unknown";
                      });
                    return (
                      <div key={exId} className="flex gap-2 items-start py-2 border-b last:border-0">
                        <span className="font-medium min-w-[180px]">{exName}</span>
                        <div className="flex flex-wrap gap-1">
                          {comps.map((name, i) => (
                            <Badge key={i} variant="secondary" className="text-xs">
                              {name}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Reports Tab */}
        <TabsContent value="reports">
          <Card>
            <CardHeader>
              <CardTitle>Candidate Reports</CardTitle>
            </CardHeader>
            <CardContent>
              {candidates.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No candidates yet.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Candidate</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-40"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {candidates.map((c) => (
                      <TableRow key={c.id as string}>
                        <TableCell className="font-medium">
                          {c.full_name as string}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{c.status as string}</Badge>
                        </TableCell>
                        <TableCell>
                          <a
                            href={`/api/reports/${engagement.id}/${c.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Button size="sm" variant="outline">
                              Generate PDF
                            </Button>
                          </a>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Status confirmation dialog */}
      <Dialog open={statusConfirm.open} onOpenChange={(open) => !open && setStatusConfirm({ open: false, status: "", label: "" })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Status Change</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to {statusConfirm.label.toLowerCase()} this engagement? This action changes the engagement status to <strong>{statusConfirm.status}</strong>.
          </p>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setStatusConfirm({ open: false, status: "", label: "" })}>
              Cancel
            </Button>
            <Button onClick={handleStatusChange} disabled={statusUpdating}>
              {statusUpdating ? "Updating..." : statusConfirm.label}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
