"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { copyToClipboard } from "@/lib/utils/clipboard";
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
import { addCandidateAction, createAssignmentAction, addDemoAssessorAction, updateEngagementStatusAction, removeCandidateAction, deleteAssignmentAction, setCandidateRoleProfileAction, createReengagementAction, inviteCandidateToPortalAction } from "../actions";
import { Trash2, Send, FileText, CheckCircle, Eye, Repeat2, Loader2, History, Grid3x3, KeyRound } from "lucide-react";
import Link from "next/link";
import { Checkbox } from "@/components/ui/checkbox";
import { localizedName } from "@/lib/i18n/localized";

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
  { id: "oar_summary", labelKey: "adminEngagements.detail.reportTypeOarSummary" },
  { id: "full_competency", labelKey: "adminEngagements.detail.reportTypeFullCompetency" },
  { id: "development_plan", labelKey: "adminEngagements.detail.reportTypeDevelopmentPlan" },
  { id: "executive_summary", labelKey: "adminEngagements.detail.reportTypeExecutiveSummary" },
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
  const { t, i18n } = useTranslation();
  const rtl = i18n.language === "ar";
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
      toast.error(typeof result.error === "string" ? result.error : t("adminEngagements.detail.toastReengageFailed"));
      return;
    }
    if ("data" in result && result.data) {
      setReengageOpen(false);
      toast.success(t("adminEngagements.detail.toastReengageCreated"));
      router.push(`/admin/engagements/${result.data.id}`);
    }
  };

  const handleStatusChange = async () => {
    setStatusUpdating(true);
    const result = await updateEngagementStatusAction(engagement.id as string, statusConfirm.status);
    setStatusUpdating(false);
    setStatusConfirm({ open: false, status: "", label: "" });
    if ("error" in result && result.error) {
      toast.error(typeof result.error === "string" ? result.error : t("adminEngagements.detail.toastStatusFailed"));
    } else {
      toast.success(t(`adminEngagements.detail.toastStatusChanged.${statusConfirm.status}`));
      router.refresh();
    }
  };

  const [invitingId, setInvitingId] = useState<string | null>(null);

  const handleInviteCandidate = async (candidateId: string, name: string, email: string) => {
    if (!email) {
      toast.error(t("adminEngagements.detail.toastInviteNoEmail"));
      return;
    }
    if (!confirm(t("adminEngagements.detail.confirmInviteCandidate", { name, email }))) return;
    setInvitingId(candidateId);
    const result = await inviteCandidateToPortalAction(candidateId);
    setInvitingId(null);
    if ("error" in result && result.error) {
      toast.error(typeof result.error === "string" ? result.error : t("adminEngagements.detail.toastInviteFailed"));
      return;
    }
    if ("ok" in result && result.ok) {
      if (result.emailed) {
        toast.success(t("adminEngagements.detail.toastInviteSent", { name }));
      } else {
        // Email not configured / failed: hand the admin the link to share.
        toast.success(t("adminEngagements.detail.toastInviteLinkReady"));
        try {
          await copyToClipboard(result.portalUrl);
          toast.message(t("adminEngagements.detail.toastInviteLinkCopied"));
        } catch {
          toast.message(result.portalUrl);
        }
      }
      router.refresh();
    }
  };

  const handleRemoveCandidate = async (candidateId: string, name: string) => {
    if (!confirm(t("adminEngagements.detail.confirmRemoveCandidate", { name }))) return;
    const result = await removeCandidateAction(candidateId);
    if ("error" in result && result.error) {
      toast.error(typeof result.error === "string" ? result.error : t("adminEngagements.detail.toastRemoveCandidateFailed"));
    } else {
      setCandidates((prev) => prev.filter((c) => (c.id as string) !== candidateId));
      toast.success(t("adminEngagements.detail.toastCandidateRemoved"));
      router.refresh();
    }
  };

  const handleDeleteAssignment = async (assignmentId: string) => {
    if (!confirm(t("adminEngagements.detail.confirmDeleteAssignment"))) return;
    const result = await deleteAssignmentAction(assignmentId);
    if ("error" in result && result.error) {
      toast.error(typeof result.error === "string" ? result.error : t("adminEngagements.detail.toastDeleteAssignmentFailed"));
    } else {
      setAssignments((prev) => prev.filter((a) => (a.id as string) !== assignmentId));
      toast.success(t("adminEngagements.detail.toastAssignmentDeleted"));
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
      toast.success(t("adminEngagements.detail.toastCandidateAdded"));
    } else if ("error" in result) {
      toast.error(typeof result.error === "string" ? result.error : t("adminEngagements.detail.toastAddCandidateFailed"));
    }
  };

  const handleSetRoleProfile = async (candidateId: string, value: string) => {
    const roleProfileId = value === ROLE_NONE ? null : value;
    const result = await setCandidateRoleProfileAction({ candidateId, roleProfileId });
    if ("error" in result && result.error) {
      toast.error(typeof result.error === "string" ? result.error : t("adminEngagements.detail.toastUpdateRoleFailed"));
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
    toast.success(roleProfileId ? t("adminEngagements.detail.toastRoleProfileAssigned") : t("adminEngagements.detail.toastRoleProfileCleared"));
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
      toast.success(t("adminEngagements.detail.toastAssessorCreated"));
    } else if ("error" in result) {
      toast.error(typeof result.error === "string" ? result.error : t("adminEngagements.detail.toastCreateAssessorFailed"));
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
      toast.success(t("adminEngagements.detail.toastAssignmentCreated"));
      router.refresh();
    } else if ("error" in result) {
      const msg = typeof result.error === "string" ? result.error : t("adminEngagements.detail.toastCreateAssignmentFailed");
      // Friendlier message for duplicate constraint
      if (msg.includes("duplicate") || msg.includes("unique")) {
        toast.error(t("adminEngagements.detail.toastAssignmentExists"));
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
          <Badge variant="secondary">{t(`adminEngagements.status.${engagement.status as string}`)}</Badge>
          {engagement.target_role ? <span>{t("adminEngagements.detail.targetPrefix")} {engagement.target_role as string}</span> : null}
          {priorEngagementId && (
            <Link
              href={`/admin/engagements/${priorEngagementId}`}
              className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
              title={t("adminEngagements.detail.priorLinkTitle")}
            >
              <History className="h-3 w-3" />
              {t("adminEngagements.detail.priorLinkLabel")}
            </Link>
          )}
          {/* Status transitions */}
          <div className="flex gap-1 ms-auto">
            <Link href={`/admin/engagements/${engagement.id as string}/talent-map`}>
              <Button size="sm" variant="outline" className="gap-1">
                <Grid3x3 className="h-3 w-3" />
                {t("adminEngagements.detail.talentMap")}
              </Button>
            </Link>
            {engagement.status === "draft" && (
              <Button size="sm" variant="default" onClick={() => setStatusConfirm({ open: true, status: "active", label: "Activate" })}>
                {t("adminEngagements.detail.activate")}
              </Button>
            )}
            {engagement.status === "active" && (
              <Button size="sm" variant="outline" onClick={() => setStatusConfirm({ open: true, status: "completed", label: "Complete" })}>
                {t("adminEngagements.detail.markComplete")}
              </Button>
            )}
            {engagement.status === "completed" && (
              <Button size="sm" variant="ghost" onClick={() => setStatusConfirm({ open: true, status: "archived", label: "Archive" })}>
                {t("adminEngagements.detail.archive")}
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
                {t("adminEngagements.detail.reengageCohort")}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* G7 - re-engagement confirmation dialog */}
      <Dialog open={reengageOpen} onOpenChange={setReengageOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("adminEngagements.detail.reengageDialogTitle")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <p className="text-muted-foreground">
              {t("adminEngagements.detail.reengageDialogBody")}
            </p>
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={reengageCarryCandidates}
                onChange={(e) => setReengageCarryCandidates(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-input"
              />
              <span>
                {t("adminEngagements.detail.reengageCarryCandidates")}
              </span>
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="ghost"
                onClick={() => setReengageOpen(false)}
                disabled={reengaging}
              >
                {t("adminEngagements.detail.cancel")}
              </Button>
              <Button onClick={handleReengage} disabled={reengaging}>
                {reengaging && <Loader2 className="h-3 w-3 me-1 animate-spin" />}
                {t("adminEngagements.detail.createReengagement")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Tabs defaultValue="candidates">
        <TabsList>
          <TabsTrigger value="candidates">
            {t("adminEngagements.detail.tabCandidates", { n: candidates.length })}
          </TabsTrigger>
          <TabsTrigger value="assignments">
            {t("adminEngagements.detail.tabAssignments", { n: assignments.length })}
          </TabsTrigger>
          <TabsTrigger value="matrix">
            {t("adminEngagements.detail.tabMatrix", { n: matrix.length })}
          </TabsTrigger>
          <TabsTrigger value="integration">
            {t("adminEngagements.detail.tabIntegration")}
          </TabsTrigger>
          <TabsTrigger value="reports">
            {t("adminEngagements.detail.tabReports")}
          </TabsTrigger>
        </TabsList>

        {/* Candidates Tab */}
        <TabsContent value="candidates">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{t("adminEngagements.detail.candidatesTitle")}</CardTitle>
                <Dialog open={candDialogOpen} onOpenChange={setCandDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm">{t("adminEngagements.detail.addCandidate")}</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{t("adminEngagements.detail.addCandidateTitle")}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <Label>{t("adminEngagements.detail.fullNameRequired")}</Label>
                        <Input
                          value={candName}
                          onChange={(e) => setCandName(e.target.value)}
                          placeholder={t("adminEngagements.detail.candNamePlaceholder")}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>{t("adminEngagements.detail.emailRequired")}</Label>
                        <Input
                          type="email"
                          value={candEmail}
                          onChange={(e) => setCandEmail(e.target.value)}
                          placeholder="candidate@example.com"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>{t("adminEngagements.detail.roleProfileOptional")}</Label>
                        <Select value={candRoleProfileId} onValueChange={setCandRoleProfileId}>
                          <SelectTrigger>
                            <SelectValue placeholder={t("adminEngagements.detail.unassignedSetLater")} />
                          </SelectTrigger>
                          <SelectContent>
                            {roleProfiles.length === 0 ? (
                              <SelectItem value="__empty__" disabled>
                                {t("adminEngagements.detail.noProfilesYet")}
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
                          {t("adminEngagements.detail.roleProfileHelp")}
                        </p>
                      </div>
                      <Separator />
                      <p className="text-xs text-muted-foreground font-medium">{t("adminEngagements.detail.demographicsOptional")}</p>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs">{t("adminEngagements.detail.department")}</Label>
                          <Input
                            value={candDepartment}
                            onChange={(e) => setCandDepartment(e.target.value)}
                            placeholder={t("adminEngagements.detail.departmentPlaceholder")}
                            className="h-8 text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">{t("adminEngagements.detail.gender")}</Label>
                          <Select value={candGender} onValueChange={setCandGender}>
                            <SelectTrigger className="h-8 text-sm">
                              <SelectValue placeholder={t("adminEngagements.detail.selectPlaceholder")} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="male">{t("adminEngagements.detail.genderMale")}</SelectItem>
                              <SelectItem value="female">{t("adminEngagements.detail.genderFemale")}</SelectItem>
                              <SelectItem value="prefer_not_to_say">{t("adminEngagements.detail.genderPreferNot")}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">{t("adminEngagements.detail.ageRange")}</Label>
                          <Select value={candAgeRange} onValueChange={setCandAgeRange}>
                            <SelectTrigger className="h-8 text-sm">
                              <SelectValue placeholder={t("adminEngagements.detail.selectPlaceholder")} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="under_25">{t("adminEngagements.detail.ageUnder25")}</SelectItem>
                              <SelectItem value="25_34">25-34</SelectItem>
                              <SelectItem value="35_44">35-44</SelectItem>
                              <SelectItem value="45_54">45-54</SelectItem>
                              <SelectItem value="55_plus">55+</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">{t("adminEngagements.detail.seniority")}</Label>
                          <Select value={candSeniority} onValueChange={setCandSeniority}>
                            <SelectTrigger className="h-8 text-sm">
                              <SelectValue placeholder={t("adminEngagements.detail.selectPlaceholder")} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="entry">{t("adminEngagements.detail.seniorityEntry")}</SelectItem>
                              <SelectItem value="mid">{t("adminEngagements.detail.seniorityMid")}</SelectItem>
                              <SelectItem value="senior">{t("adminEngagements.detail.senioritySenior")}</SelectItem>
                              <SelectItem value="executive">{t("adminEngagements.detail.seniorityExecutive")}</SelectItem>
                              <SelectItem value="c_suite">{t("adminEngagements.detail.seniorityCSuite")}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <Button
                        onClick={handleAddCandidate}
                        disabled={!candName.trim() || !candEmail.trim() || candCreating}
                        className="w-full"
                      >
                        {candCreating ? t("adminEngagements.detail.adding") : t("adminEngagements.detail.addCandidateTitle")}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {candidates.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  {t("adminEngagements.detail.noCandidates")}
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("adminEngagements.detail.colName")}</TableHead>
                      <TableHead>{t("adminEngagements.detail.colEmail")}</TableHead>
                      <TableHead>{t("adminEngagements.detail.colRoleProfile")}</TableHead>
                      <TableHead>{t("adminEngagements.detail.colDepartment")}</TableHead>
                      <TableHead>{t("adminEngagements.detail.colAssignedAssessments")}</TableHead>
                      {priorEngagementId && <TableHead>{t("adminEngagements.detail.colVsPrior")}</TableHead>}
                      <TableHead>{t("adminEngagements.detail.colStatus")}</TableHead>
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
                                <SelectValue placeholder={t("adminEngagements.detail.unassigned")} />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value={ROLE_NONE}>{t("adminEngagements.detail.unassigned")}</SelectItem>
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
                              <span className="text-xs text-muted-foreground">{t("adminEngagements.detail.none")}</span>
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
                                      <History className="h-3 w-3" /> {t("adminEngagements.detail.priorScore", { score: priorOar })}
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
                                    title={t("adminEngagements.detail.priorOarTooltip", { prior: priorOar, current: currOar })}
                                  >
                                    {arrow} {delta > 0 ? `+${delta}` : delta} {t("adminEngagements.detail.vsPrior")}
                                  </span>
                                );
                              })()}
                            </TableCell>
                          )}
                          <TableCell>
                            <Badge variant="outline">{t(`adminEngagements.candStatus.${c.status as string}`)}</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-end gap-0.5">
                              <Link
                                href={`/candidate/welcome/${c.id as string}?asAdmin=1`}
                                target="_blank"
                                rel="noopener noreferrer"
                                title={t("adminEngagements.detail.viewAsCandidate")}
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
                                className="h-8 w-8 p-0 text-muted-foreground hover:text-primary"
                                title={t("adminEngagements.detail.inviteToPortal")}
                                disabled={invitingId === (c.id as string)}
                                onClick={() => handleInviteCandidate(c.id as string, c.full_name as string, (c.email as string) ?? "")}
                              >
                                {invitingId === (c.id as string) ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <KeyRound className="h-3.5 w-3.5" />
                                )}
                              </Button>
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
                <CardTitle>{t("adminEngagements.detail.assessorAssignmentsTitle")}</CardTitle>
                <div className="flex gap-2">
                  <Dialog open={assessorDialogOpen} onOpenChange={setAssessorDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm">{t("adminEngagements.detail.newAssessor")}</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>{t("adminEngagements.detail.createDemoAssessor")}</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <Label>{t("adminEngagements.detail.fullNameRequired")}</Label>
                          <Input
                            value={assessorName}
                            onChange={(e) => setAssessorName(e.target.value)}
                            placeholder={t("adminEngagements.detail.assessorNamePlaceholder")}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label>{t("adminEngagements.detail.emailRequired")}</Label>
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
                          {assessorCreating ? t("adminEngagements.detail.creating") : t("adminEngagements.detail.createAssessor")}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>

                  <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm">{t("adminEngagements.detail.assign")}</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>{t("adminEngagements.detail.createAssignmentTitle")}</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <Label>{t("adminEngagements.detail.assessorRequired")}</Label>
                          <Select value={assignAssessorId} onValueChange={setAssignAssessorId}>
                            <SelectTrigger>
                              <SelectValue placeholder={t("adminEngagements.detail.selectAssessor")} />
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
                          <Label>{t("adminEngagements.detail.candidateRequired")}</Label>
                          <Select value={assignCandidateId} onValueChange={setAssignCandidateId}>
                            <SelectTrigger>
                              <SelectValue placeholder={t("adminEngagements.detail.selectCandidate")} />
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
                          <Label>{t("adminEngagements.detail.exerciseRequired")}</Label>
                          <Select value={assignExerciseId} onValueChange={setAssignExerciseId}>
                            <SelectTrigger>
                              <SelectValue placeholder={t("adminEngagements.detail.selectExercise")} />
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
                          {assigning ? t("adminEngagements.detail.assigning") : t("adminEngagements.detail.createAssignmentTitle")}
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
                  {t("adminEngagements.detail.noAssignments")}
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("adminEngagements.detail.colAssessor")}</TableHead>
                      <TableHead>{t("adminEngagements.detail.colCandidate")}</TableHead>
                      <TableHead>{t("adminEngagements.detail.colExercise")}</TableHead>
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
              <CardTitle>{t("adminEngagements.detail.matrixTitle")}</CardTitle>
            </CardHeader>
            <CardContent>
              {matrix.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  {t("adminEngagements.detail.noMatrix")}
                </p>
              ) : (
                <div className="space-y-1 text-sm">
                  {exercises.map((ex) => {
                    const exId = (ex as Record<string, unknown>).id as string;
                    const exName = (ex as Record<string, unknown>).name as string;
                    const comps = matrix
                      .filter((m) => m.exercise_id === exId)
                      .map((m) => {
                        const c = m.competencies as { name?: string | null; name_ar?: string | null } | null;
                        return localizedName(c, rtl) || t("adminEngagements.detail.unknown");
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
              <CardTitle>{t("adminEngagements.detail.integrationTitle")}</CardTitle>
              <p className="text-sm text-muted-foreground">
                {t("adminEngagements.detail.integrationDesc")}
              </p>
            </CardHeader>
            <CardContent>
              {integrationWorksheets.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  {t("adminEngagements.detail.noIntegration")}
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
                              <TableHead>{t("adminEngagements.detail.colCompetency")}</TableHead>
                              <TableHead>{t("adminEngagements.detail.colAssessor")}</TableHead>
                              <TableHead className="text-center">{t("adminEngagements.detail.colRating")}</TableHead>
                              <TableHead>{t("adminEngagements.detail.colNotes")}</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {candWs.map((w) => {
                              const comp = w.competencies as { name?: string | null; name_ar?: string | null } | null;
                              const prof = w.profiles as Record<string, unknown> | null;
                              return (
                                <TableRow key={w.id as string}>
                                  <TableCell className="text-sm">
                                    {localizedName(comp, rtl) || "-"}
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
                  <CardTitle>{t("adminEngagements.detail.candidateReportsTitle")}</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    {t("adminEngagements.detail.candidateReportsDesc")}
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Report type selector */}
              <div className="border rounded-lg p-3">
                <p className="text-xs font-medium text-muted-foreground mb-2">{t("adminEngagements.detail.reportTypesToInclude")}</p>
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
                      {t(rt.labelKey)}
                    </label>
                  ))}
                </div>
              </div>

              {candidates.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  {t("adminEngagements.detail.noCandidates")}
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("adminEngagements.detail.colCandidate")}</TableHead>
                      <TableHead>{t("adminEngagements.detail.colStatus")}</TableHead>
                      <TableHead>{t("adminEngagements.detail.colReports")}</TableHead>
                      <TableHead className="w-40">{t("adminEngagements.detail.colActions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {candidates.map((c) => (
                      <TableRow key={c.id as string}>
                        <TableCell className="font-medium">
                          {c.full_name as string}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{t(`adminEngagements.candStatus.${c.status as string}`)}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {selectedReportTypes.map((rt) => {
                              const found = REPORT_TYPES.find((r) => r.id === rt);
                              return (
                                <Badge key={rt} variant="secondary" className="text-xs">
                                  {found ? t(found.labelKey) : rt}
                                </Badge>
                              );
                            })}
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
                                {t("adminEngagements.detail.pdf")}
                              </Button>
                            </a>
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1"
                              onClick={() => {
                                toast.success(t("adminEngagements.detail.toastReportsShared", { name: c.full_name as string }));
                              }}
                            >
                              <Send className="h-3 w-3" />
                              {t("adminEngagements.detail.share")}
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
                      toast.success(t("adminEngagements.detail.toastReportsAutoShared", { n: candidates.length }));
                    }}
                  >
                    <Send className="h-4 w-4" />
                    {t("adminEngagements.detail.autoShareAll")}
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
            <DialogTitle>{t("adminEngagements.detail.confirmStatusTitle")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {statusConfirm.status
              ? t("adminEngagements.detail.confirmStatusBody", { action: t(`adminEngagements.detail.confirmAction.${statusConfirm.status}`) })
              : null}{" "}
            <strong>{statusConfirm.status ? t(`adminEngagements.status.${statusConfirm.status}`) : ""}</strong>.
          </p>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setStatusConfirm({ open: false, status: "", label: "" })}>
              {t("adminEngagements.detail.cancel")}
            </Button>
            <Button onClick={handleStatusChange} disabled={statusUpdating}>
              {statusUpdating ? t("adminEngagements.detail.updating") : (statusConfirm.status ? t(`adminEngagements.detail.confirmButton.${statusConfirm.status}`) : "")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
