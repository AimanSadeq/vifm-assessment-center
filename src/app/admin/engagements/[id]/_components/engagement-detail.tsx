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
import { addCandidateAction, createAssignmentAction, addDemoAssessorAction, updateEngagementStatusAction, removeCandidateAction, deleteAssignmentAction, setCandidateRoleProfileAction, createReengagementAction } from "../actions";
import { Trash2, Send, FileText, CheckCircle, Eye, Repeat2, Loader2, History } from "lucide-react";
import Link from "next/link";
import { Checkbox } from "@/components/ui/checkbox";

type RoleProfileOption = {
  id: string;
  name_en: string;
  name_ar: string | null;
  target_role: string | null;
};

type Props = {
  engagement: Record<string, unknown>;
  candidates: Record<string, unknown>[];
  exercises: Record<string, unknown>[];
  assignments: Record<string, unknown>[];
  assessors: Record<string, unknown>[];
  matrix: Record<string, unknown>[];
  integrationWorksheets?: Record<string, unknown>[];
  roleProfiles?: RoleProfileOption[];
  /** G7 - prior OAR keyed by *prior* candidate_id; empty when not a re-engagement. */
  priorOarMap?: Record<string, number>;
  /** G7 - current OAR keyed by *current* candidate_id; used to compute delta. */
  currentOarMap?: Record<string, number>;
};

const ROLE_NONE = "__none__";

const REPORT_TYPES = [
  { id: "oar_summary", label: "OAR Summary Report" },
  { id: "full_competency", label: "Full Competency Report" },
  { id: "development_plan", label: "Development Plan" },
  { id: "executive_summary", label: "Executive Summary" },
];

export function EngagementDetail({
  engagement,
  candidates: initCandidates,
  exercises,
  assignments: initAssignments,
  assessors: initAssessors,
  matrix,
  integrationWorksheets = [],
  roleProfiles = [],
  priorOarMap = {},
  currentOarMap = {},
}: Props) {
  const router = useRouter();
  const [candidates, setCandidates] = useState(initCandidates);
  const [assignments, setAssignments] = useState(initAssignments);
  const [assessors, setAssessors] = useState(initAssessors);

  // Add candidate dialog
  const [candDialogOpen, setCandDialogOpen] = useState(false);
  const [candName, setCandName] = useState("");
  const [candEmail, setCandEmail] = useState("");
  const [candDepartment, setCandDepartment] = useState("");
  const [candGender, setCandGender] = useState("");
  const [candAgeRange, setCandAgeRange] = useState("");
  const [candSeniority, setCandSeniority] = useState("");
  const [candRoleProfileId, setCandRoleProfileId] = useState<string>("");
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

  // Report types selection
  const [selectedReportTypes, setSelectedReportTypes] = useState<string[]>(["full_competency"]);

  // Status confirmation dialog
  const [statusConfirm, setStatusConfirm] = useState<{ open: boolean; status: string; label: string }>({ open: false, status: "", label: "" });
  const [statusUpdating, setStatusUpdating] = useState(false);

  // G7 - re-engagement dialog
  const [reengageOpen, setReengageOpen] = useState(false);
  const [reengageCarryCandidates, setReengageCarryCandidates] = useState(true);
  const [reengaging, setReengaging] = useState(false);

  const handleReengage = async () => {
    setReengaging(true);
    const result = await createReengagementAction({
      priorEngagementId: engagement.id as string,
      carryCandidates: reengageCarryCandidates,
    });
    setReengaging(false);
    if ("error" in result && result.error) {
      toast.error(typeof result.error === "string" ? result.error : "Failed to create re-engagement");
      return;
    }
    if ("data" in result && result.data) {
      setReengageOpen(false);
      toast.success("Re-engagement created");
      router.push(`/admin/engagements/${result.data.id}`);
    }
  };

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
      : "-";

  const handleAddCandidate = async () => {
    if (!candName.trim() || !candEmail.trim()) return;
    setCandCreating(true);
    const result = await addCandidateAction({
      engagementId: engagement.id as string,
      fullName: candName,
      email: candEmail,
      department: candDepartment || undefined,
      gender: candGender || undefined,
      ageRange: candAgeRange || undefined,
      seniorityLevel: candSeniority || undefined,
      roleProfileId: candRoleProfileId || undefined,
    });
    setCandCreating(false);
    if ("data" in result && result.data) {
      // Hydrate the embedded role_profiles object so the UI shows a name immediately,
      // matching the shape returned by the engagement-detail page query.
      const matched = candRoleProfileId
        ? roleProfiles.find((rp) => rp.id === candRoleProfileId) ?? null
        : null;
      const hydrated = { ...result.data, role_profiles: matched } as Record<string, unknown>;
      setCandidates((prev) => [...prev, hydrated]);
      setCandDialogOpen(false);
      setCandName("");
      setCandEmail("");
      setCandDepartment("");
      setCandGender("");
      setCandAgeRange("");
      setCandSeniority("");
      setCandRoleProfileId("");
      toast.success("Candidate added");
    } else if ("error" in result) {
      toast.error(typeof result.error === "string" ? result.error : "Failed to add candidate");
    }
  };

  const handleSetRoleProfile = async (candidateId: string, value: string) => {
    const roleProfileId = value === ROLE_NONE ? null : value;
    const result = await setCandidateRoleProfileAction({ candidateId, roleProfileId });
    if ("error" in result && result.error) {
      toast.error(typeof result.error === "string" ? result.error : "Failed to update role");
      return;
    }
    const matched = roleProfileId
      ? roleProfiles.find((rp) => rp.id === roleProfileId) ?? null
      : null;
    setCandidates((prev) =>
      prev.map((c) =>
        (c.id as string) === candidateId
          ? { ...c, role_profile_id: roleProfileId, role_profiles: matched }
          : c
      )
    );
    toast.success(roleProfileId ? "Role profile assigned" : "Role profile cleared");
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

  const priorEngagementId = (engagement.prior_engagement_id as string | null) ?? null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">{engagement.name as string}</h1>
        <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
          <span>{orgName}</span>
          <Badge variant="secondary">{engagement.status as string}</Badge>
          {engagement.target_role ? <span>Target: {engagement.target_role as string}</span> : null}
          {priorEngagementId && (
            <Link
              href={`/admin/engagements/${priorEngagementId}`}
              className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
              title="View the prior engagement this one was seeded from"
            >
              <History className="h-3 w-3" />
              Re-engagement of prior cohort
            </Link>
          )}
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
            {(engagement.status === "completed" || engagement.status === "archived") && (
              <Button
                size="sm"
                variant="default"
                className="gap-1"
                onClick={() => setReengageOpen(true)}
              >
                <Repeat2 className="h-3 w-3" />
                Re-engage cohort
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* G7 - re-engagement confirmation dialog */}
      <Dialog open={reengageOpen} onOpenChange={setReengageOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Re-engage this cohort</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <p className="text-muted-foreground">
              Creates a new draft engagement seeded from this one. The role
              profile, competencies, exercises, and matrix carry over so you
              don&apos;t have to rebuild the design. Prior assessor assignments,
              ratings, and reports are not copied - the new run earns its
              own scores.
            </p>
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={reengageCarryCandidates}
                onChange={(e) => setReengageCarryCandidates(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-input"
              />
              <span>
                Carry over the candidates from this engagement (each new
                candidate row is linked to its prior so deltas can show on
                the report).
              </span>
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="ghost"
                onClick={() => setReengageOpen(false)}
                disabled={reengaging}
              >
                Cancel
              </Button>
              <Button onClick={handleReengage} disabled={reengaging}>
                {reengaging && <Loader2 className="h-3 w-3 me-1 animate-spin" />}
                Create re-engagement
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
          <TabsTrigger value="integration">
            Integration
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
                      <div className="space-y-1">
                        <Label>Role Profile (optional)</Label>
                        <Select value={candRoleProfileId} onValueChange={setCandRoleProfileId}>
                          <SelectTrigger>
                            <SelectValue placeholder="Unassigned (set later)" />
                          </SelectTrigger>
                          <SelectContent>
                            {roleProfiles.length === 0 ? (
                              <SelectItem value="__empty__" disabled>
                                No profiles in library yet
                              </SelectItem>
                            ) : (
                              roleProfiles.map((rp) => (
                                <SelectItem key={rp.id} value={rp.id}>
                                  {rp.name_en}
                                  {rp.target_role && rp.target_role !== rp.name_en
                                    ? ` - ${rp.target_role}`
                                    : ""}
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                        <p className="text-[11px] text-muted-foreground">
                          Defines target proficiencies the candidate&apos;s scores will be compared against.
                        </p>
                      </div>
                      <Separator />
                      <p className="text-xs text-muted-foreground font-medium">Demographics (optional)</p>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs">Department</Label>
                          <Input
                            value={candDepartment}
                            onChange={(e) => setCandDepartment(e.target.value)}
                            placeholder="e.g., Finance"
                            className="h-8 text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Gender</Label>
                          <Select value={candGender} onValueChange={setCandGender}>
                            <SelectTrigger className="h-8 text-sm">
                              <SelectValue placeholder="Select..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="male">Male</SelectItem>
                              <SelectItem value="female">Female</SelectItem>
                              <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Age Range</Label>
                          <Select value={candAgeRange} onValueChange={setCandAgeRange}>
                            <SelectTrigger className="h-8 text-sm">
                              <SelectValue placeholder="Select..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="under_25">Under 25</SelectItem>
                              <SelectItem value="25_34">25-34</SelectItem>
                              <SelectItem value="35_44">35-44</SelectItem>
                              <SelectItem value="45_54">45-54</SelectItem>
                              <SelectItem value="55_plus">55+</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Seniority</Label>
                          <Select value={candSeniority} onValueChange={setCandSeniority}>
                            <SelectTrigger className="h-8 text-sm">
                              <SelectValue placeholder="Select..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="entry">Entry Level</SelectItem>
                              <SelectItem value="mid">Mid Level</SelectItem>
                              <SelectItem value="senior">Senior</SelectItem>
                              <SelectItem value="executive">Executive</SelectItem>
                              <SelectItem value="c_suite">C-Suite</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
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
                      <TableHead>Role Profile</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Assigned Assessments</TableHead>
                      {priorEngagementId && <TableHead>vs Prior</TableHead>}
                      <TableHead>Status</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {candidates.map((c) => {
                      const candAssignments = assignments.filter(
                        (a) => {
                          const cand = a.candidates as Record<string, unknown> | null;
                          return cand?.id === c.id || a.candidate_id === c.id;
                        }
                      );
                      const currentRoleId = (c.role_profile_id as string | null) ?? null;
                      return (
                        <TableRow key={c.id as string}>
                          <TableCell className="font-medium">
                            {c.full_name as string}
                          </TableCell>
                          <TableCell className="text-sm">{c.email as string}</TableCell>
                          <TableCell>
                            <Select
                              value={currentRoleId ?? ROLE_NONE}
                              onValueChange={(v) => handleSetRoleProfile(c.id as string, v)}
                            >
                              <SelectTrigger className="h-8 text-xs min-w-[180px] max-w-[240px]">
                                <SelectValue placeholder="Unassigned" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value={ROLE_NONE}>Unassigned</SelectItem>
                                {roleProfiles.map((rp) => (
                                  <SelectItem key={rp.id} value={rp.id}>
                                    {rp.name_en}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {(c.department as string) || "-"}
                          </TableCell>
                          <TableCell>
                            {candAssignments.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {candAssignments.map((a) => {
                                  const ex = a.exercises as Record<string, unknown> | null;
                                  return (
                                    <Badge key={a.id as string} variant="secondary" className="text-xs">
                                      {(ex?.name as string) ?? "-"}
                                    </Badge>
                                  );
                                })}
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">None</span>
                            )}
                          </TableCell>
                          {priorEngagementId && (
                            <TableCell>
                              {(() => {
                                const priorCandId = c.prior_candidate_id as string | null;
                                const priorOar = priorCandId ? priorOarMap[priorCandId] : undefined;
                                const currOar = currentOarMap[c.id as string];
                                if (priorOar == null) {
                                  return <span className="text-xs text-muted-foreground">-</span>;
                                }
                                if (currOar == null) {
                                  return (
                                    <Badge variant="secondary" className="text-[11px] gap-1">
                                      <History className="h-3 w-3" /> Prior {priorOar}
                                    </Badge>
                                  );
                                }
                                const delta = currOar - priorOar;
                                const tone =
                                  delta > 0
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                    : delta < 0
                                      ? "bg-rose-50 text-rose-700 border-rose-200"
                                      : "bg-muted text-muted-foreground";
                                const arrow = delta > 0 ? "↑" : delta < 0 ? "↓" : "=";
                                return (
                                  <span
                                    className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] tabular-nums ${tone}`}
                                    title={`Prior OAR ${priorOar} → ${currOar}`}
                                  >
                                    {arrow} {delta > 0 ? `+${delta}` : delta} vs prior
                                  </span>
                                );
                              })()}
                            </TableCell>
                          )}
                          <TableCell>
                            <Badge variant="outline">{c.status as string}</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-end gap-0.5">
                              <Link
                                href={`/candidate/welcome/${c.id as string}?asAdmin=1`}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="View as candidate (opens in new tab)"
                              >
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                </Button>
                              </Link>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                                onClick={() => handleRemoveCandidate(c.id as string, c.full_name as string)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
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
                          <TableCell>{profile?.full_name as string ?? "-"}</TableCell>
                          <TableCell>{cand?.full_name as string ?? "-"}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{ex?.name as string ?? "-"}</Badge>
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

        {/* Integration Tab */}
        <TabsContent value="integration">
          <Card>
            <CardHeader>
              <CardTitle>Integration Summary</CardTitle>
              <p className="text-sm text-muted-foreground">
                Consolidated view of all assessors&apos; preliminary ratings and notes.
              </p>
            </CardHeader>
            <CardContent>
              {integrationWorksheets.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No integration worksheets submitted yet. Assessors complete these before the wash-up session.
                </p>
              ) : (
                <div className="space-y-4">
                  {/* Group by candidate */}
                  {candidates.map((c) => {
                    const candWs = integrationWorksheets.filter(
                      (w) => w.candidate_id === c.id
                    );
                    if (candWs.length === 0) return null;
                    return (
                      <div key={c.id as string} className="border rounded-lg p-4">
                        <h4 className="font-medium mb-2">{c.full_name as string}</h4>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Competency</TableHead>
                              <TableHead>Assessor</TableHead>
                              <TableHead className="text-center">Rating</TableHead>
                              <TableHead>Notes</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {candWs.map((w) => {
                              const comp = w.competencies as Record<string, unknown> | null;
                              const prof = w.profiles as Record<string, unknown> | null;
                              return (
                                <TableRow key={w.id as string}>
                                  <TableCell className="text-sm">
                                    {(comp?.name as string) ?? "-"}
                                  </TableCell>
                                  <TableCell className="text-sm">
                                    {(prof?.full_name as string) ?? "-"}
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <Badge variant={
                                      (w.preliminary_rating as number) >= 3 ? "default" : "destructive"
                                    }>
                                      {w.preliminary_rating as number}/5
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                                    {(w.notes as string) || "-"}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
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
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Candidate Reports</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Select report types and generate or share reports with candidates.
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Report type selector */}
              <div className="border rounded-lg p-3">
                <p className="text-xs font-medium text-muted-foreground mb-2">Report Types to Include</p>
                <div className="flex flex-wrap gap-3">
                  {REPORT_TYPES.map((rt) => (
                    <label key={rt.id} className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox
                        checked={selectedReportTypes.includes(rt.id)}
                        onCheckedChange={(checked) => {
                          setSelectedReportTypes((prev) =>
                            checked
                              ? [...prev, rt.id]
                              : prev.filter((id) => id !== rt.id)
                          );
                        }}
                      />
                      {rt.label}
                    </label>
                  ))}
                </div>
              </div>

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
                      <TableHead>Reports</TableHead>
                      <TableHead className="w-40">Actions</TableHead>
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
                          <div className="flex gap-1">
                            {selectedReportTypes.map((rt) => (
                              <Badge key={rt} variant="secondary" className="text-xs">
                                {REPORT_TYPES.find((r) => r.id === rt)?.label ?? rt}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <a
                              href={`/api/reports/${engagement.id}/${c.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <Button size="sm" variant="outline" className="gap-1">
                                <FileText className="h-3 w-3" />
                                PDF
                              </Button>
                            </a>
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1"
                              onClick={() => {
                                toast.success(`Reports shared with ${c.full_name as string}`);
                              }}
                            >
                              <Send className="h-3 w-3" />
                              Share
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}

              {/* Bulk share */}
              {candidates.length > 0 && (
                <div className="flex justify-end">
                  <Button
                    variant="default"
                    className="gap-2"
                    onClick={() => {
                      toast.success(`Reports auto-shared with ${candidates.length} candidate(s)`);
                    }}
                  >
                    <Send className="h-4 w-4" />
                    Auto-Share All Reports
                  </Button>
                </div>
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
