import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft, FlaskConical, Mail, Link2, Lock, Unlock, RefreshCw, Plus, Trash2,
  Archive, RotateCcw, BookOpen, AlertTriangle, ShieldAlert,
} from "lucide-react";
import { createServiceClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ARA_PILLARS } from "@/lib/constants/ara-pillars";
import { createAraRespondent } from "@/lib/ara/actions";
import {
  createConsultantNote, deleteConsultantNote, toggleNoteIncludeInReport,
  freezeAssessmentScores, unfreezeAssessmentScores,
  recalculateCompliance, overrideComplianceStatus,
  updatePillarWeights,
  archiveAssessment, reopenAssessment,
} from "@/lib/ara/consultant-actions";
import { summarizeComplianceByFramework } from "@/lib/ara/compliance";
import { detectAraGaps, detectAraShadowAi } from "@/lib/ara/detectors";
import { ValidatedScoreInput } from "./_components/validated-score-input";
import type {
  AraAssessment, AraOrganization, AraRespondent, AraRespondentPillarAssignment,
} from "@/types/ara";

export const dynamic = "force-dynamic";

type RespondentWithAssignments = AraRespondent & {
  assignments: Pick<AraRespondentPillarAssignment, "pillar_id">[];
};

type PillarScoreRow = {
  pillar_id: string;
  raw_score: number | null;
  weighted_score: number | null;
  pillar_weight: number;
  maturity_level: number | null;
  maturity_label_en: string | null;
  benchmark_gap: number | null;
  self_assessment_score: number | null;
  consultant_validated_score: number | null;
  perception_gap: number | null;
};

type OverallScoreRow = {
  overall_score: number | null;
  overall_label_en: string | null;
  score_frozen_at: string | null;
};

type ConsultantNoteRow = {
  id: string;
  pillar_id: string | null;
  note_text: string;
  include_in_report: boolean;
  note_language: "en" | "ar";
  created_at: string;
};

type ComplianceResultRow = {
  id: string;
  requirement_id: string;
  status: "met" | "partial" | "not_met" | "unknown";
  status_label_en: string | null;
  evidence_note: string | null;
  requirement: {
    id: string;
    requirement_code: string;
    requirement_text_en: string;
    pillar_id: string | null;
    severity: "mandatory" | "recommended" | "advisory";
    framework_id: string;
  } | null;
};

const maturityColor = (level: number | null) => {
  if (level == null) return "bg-muted text-muted-foreground";
  if (level >= 4) return "bg-emerald-100 text-emerald-800";
  if (level === 3) return "bg-amber-100 text-amber-800";
  return "bg-red-100 text-red-800";
};

const statusVariant: Record<string, string> = {
  met: "bg-emerald-100 text-emerald-800",
  partial: "bg-amber-100 text-amber-800",
  not_met: "bg-red-100 text-red-800",
  unknown: "bg-muted text-muted-foreground",
};

export default async function AraAssessmentDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const sb = createServiceClient();

  const { data: assessment } = await sb
    .from("ara_assessments")
    .select("*, organization:ara_organizations(id, name, name_ar, region, sector)")
    .eq("id", params.id)
    .maybeSingle<AraAssessment & { organization: Pick<AraOrganization, "id" | "name" | "name_ar" | "region" | "sector"> | null }>();

  if (!assessment) return notFound();

  const [
    { data: respondents },
    { data: pillarScores },
    { data: overallScore },
    { data: notes },
    complianceSummaries,
    { data: complianceResults },
    { data: materials },
  ] = await Promise.all([
    sb
      .from("ara_respondents")
      .select("*, assignments:ara_respondent_pillar_assignments(pillar_id)")
      .eq("assessment_id", assessment.id)
      .order("created_at", { ascending: true })
      .returns<RespondentWithAssignments[]>(),
    sb
      .from("ara_pillar_scores")
      .select("pillar_id, raw_score, weighted_score, pillar_weight, maturity_level, maturity_label_en, benchmark_gap, self_assessment_score, consultant_validated_score, perception_gap")
      .eq("assessment_id", assessment.id)
      .returns<PillarScoreRow[]>(),
    sb
      .from("ara_assessment_scores")
      .select("overall_score, overall_label_en, score_frozen_at")
      .eq("assessment_id", assessment.id)
      .maybeSingle<OverallScoreRow>(),
    sb
      .from("ara_consultant_notes")
      .select("id, pillar_id, note_text, include_in_report, note_language, created_at")
      .eq("assessment_id", assessment.id)
      .order("created_at", { ascending: false })
      .returns<ConsultantNoteRow[]>(),
    summarizeComplianceByFramework(assessment.id),
    sb
      .from("ara_compliance_results")
      .select("id, requirement_id, status, status_label_en, evidence_note, requirement:ara_regulatory_requirements(id, requirement_code, requirement_text_en, pillar_id, severity, framework_id)")
      .eq("assessment_id", assessment.id)
      .returns<ComplianceResultRow[]>(),
    sb
      .from("ara_supporting_materials")
      .select("*, respondent:ara_respondents(name, email)")
      .eq("assessment_id", assessment.id)
      .order("uploaded_at", { ascending: false }),
  ]);

  const pillarMap = new Map<string, PillarScoreRow>();
  (pillarScores ?? []).forEach((p) => pillarMap.set(p.pillar_id, p));

  // Gap Detector + Shadow AI Alert — run in parallel
  const [gapAlerts, shadowAi] = await Promise.all([
    detectAraGaps(assessment.id),
    detectAraShadowAi(assessment.id),
  ]);

  // Load Layer 2 consultant-guide questions for this version (never shown
  // to respondents — reference material for the Phase 2 workshop).
  const { data: layer2Questions } = assessment.question_bank_version_id
    ? await sb
        .from("ara_questions")
        .select("id, pillar_id, question_number, question_text_en, question_text_ar, help_text_en")
        .eq("version_id", assessment.question_bank_version_id)
        .eq("layer", 2)
        .eq("is_active", true)
        .order("pillar_id")
        .order("display_order")
    : { data: [] };

  const isFrozen = assessment.status === "frozen";
  const isArchived = assessment.status === "archived";
  const overall = overallScore?.overall_score;

  // Bound inline server actions
  const freezeAction = async () => {
    "use server";
    await freezeAssessmentScores(assessment.id);
  };
  const unfreezeAction = async () => {
    "use server";
    await unfreezeAssessmentScores(assessment.id);
  };
  const recalcAction = async () => {
    "use server";
    await recalculateCompliance(assessment.id);
  };
  const archiveAction = async () => {
    "use server";
    await archiveAssessment(assessment.id);
  };
  const reopenAction = async () => {
    "use server";
    await reopenAssessment(assessment.id);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-6 py-10">
        <Link href="/ara/consultant" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="h-3 w-3" /> Back to assessments
        </Link>

        {assessment.is_sandbox && (
          <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-3 flex items-center gap-2 text-amber-900 text-sm">
            <FlaskConical className="h-4 w-4" />
            <span className="font-medium">This is a sandbox assessment.</span>
            <span>Emails redirect; data is excluded from analytics.</span>
          </div>
        )}

        <div className="flex items-start justify-between mb-8 gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-primary">
              {assessment.organization?.name ?? "(no organization)"}
            </h1>
            <p className="text-muted-foreground">
              {assessment.region === "uae" ? "United Arab Emirates" : "Saudi Arabia"} •{" "}
              <span className="capitalize">{assessment.sector}</span> •{" "}
              Default language: {assessment.default_language === "en" ? "English" : "Arabic"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="capitalize">{assessment.status}</Badge>
            <Badge variant="secondary" className="capitalize">
              {assessment.phase.replace("phase", "Phase ")}
            </Badge>
            {!isArchived && (isFrozen ? (
              <form action={unfreezeAction}>
                <Button size="sm" type="submit" variant="outline" className="gap-1">
                  <Unlock className="h-3 w-3" /> Unfreeze
                </Button>
              </form>
            ) : (
              <form action={freezeAction}>
                <Button size="sm" type="submit" className="gap-1">
                  <Lock className="h-3 w-3" /> Freeze
                </Button>
              </form>
            ))}
            {isArchived ? (
              <form action={reopenAction}>
                <Button size="sm" type="submit" variant="outline" className="gap-1">
                  <RotateCcw className="h-3 w-3" /> Reopen
                </Button>
              </form>
            ) : (
              <form action={archiveAction}>
                <Button size="sm" type="submit" variant="outline" className="gap-1">
                  <Archive className="h-3 w-3" /> Archive
                </Button>
              </form>
            )}
          </div>
        </div>

        {/* ─── Shadow AI alert ─── */}
        {shadowAi.triggered && (
          <Card className="mb-6 border-destructive/50 bg-destructive/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-destructive flex items-center gap-2">
                <ShieldAlert className="h-4 w-4" /> Shadow AI alert
              </CardTitle>
              <CardDescription>
                Signals suggest employees may be using public AI tools without
                formal governance. Investigate in Phase 2.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {shadowAi.matches.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">
                    AI tool mentions in open-text answers
                  </p>
                  <ul className="space-y-1">
                    {shadowAi.matches.slice(0, 5).map((m, i) => (
                      <li key={i} className="text-xs">
                        <span className="font-medium">{m.respondent_name}</span>
                        {" — "}
                        <span className="italic">…{m.snippet}…</span>
                        <span className="ms-1 inline-block px-1.5 py-0.5 rounded bg-destructive/10 text-[10px] uppercase">
                          {m.keyword}
                        </span>
                      </li>
                    ))}
                    {shadowAi.matches.length > 5 && (
                      <li className="text-xs text-muted-foreground">
                        …and {shadowAi.matches.length - 5} more
                      </li>
                    )}
                  </ul>
                </div>
              )}
              {shadowAi.low_governance_scores.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">
                    Governance pillar gaps (score ≤ 2.0)
                  </p>
                  <ul className="space-y-1 text-xs">
                    {shadowAi.low_governance_scores.slice(0, 5).map((g, i) => (
                      <li key={i}>
                        <span className="font-medium">{g.respondent_name}</span>
                        {" — Q"}{g.question_number}: {g.question_text_en}
                        <span className="ms-1 text-destructive font-medium">({g.score.toFixed(1)})</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* ─── Gap Detector alerts ─── */}
        {gapAlerts.length > 0 && (
          <Card className="mb-6 border-amber-300 bg-amber-50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-amber-900 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" /> Gap Detector — {gapAlerts.length} disagreement{gapAlerts.length === 1 ? "" : "s"} flagged
              </CardTitle>
              <CardDescription className="text-amber-900/80">
                Respondents on the same pillar disagree significantly.
                Investigate in the Phase 2 workshop.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                {gapAlerts.map((a, i) => (
                  <li key={i} className="border-l-2 border-amber-500 ps-3">
                    {a.kind === "question" ? (
                      <>
                        <p className="font-medium text-xs uppercase text-amber-900/70">
                          {a.pillar_name_en} — Q{a.question_number} (spread {a.spread.toFixed(1)})
                        </p>
                        <p className="text-xs">{a.question_text_en}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {a.low_respondent}: {a.low_score.toFixed(1)} • {a.high_respondent}: {a.high_score.toFixed(1)}
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="font-medium text-xs uppercase text-amber-900/70">
                          {a.pillar_name_en} — level split
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {a.low_respondent} averaging {a.low_avg.toFixed(1)} while{" "}
                          {a.high_respondent} averaging {a.high_avg.toFixed(1)}
                        </p>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* ─── Overall + Pillar Scores ─── */}
        <Card className="mb-6">
          <CardHeader className="flex-row items-start justify-between gap-4">
            <div>
              <CardTitle className="text-lg">Live scores</CardTitle>
              <CardDescription>
                Recalculates on every respondent answer. Freeze before generating the report.
              </CardDescription>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-primary">
                {overall != null ? overall.toFixed(2) : "—"}
                <span className="text-sm text-muted-foreground font-normal"> / 5.0</span>
              </div>
              {overallScore?.overall_label_en && (
                <div className="text-xs text-muted-foreground mt-0.5">{overallScore.overall_label_en}</div>
              )}
              {overallScore?.score_frozen_at && (
                <div className="text-[10px] text-amber-700 mt-1">
                  Frozen {new Date(overallScore.score_frozen_at).toLocaleString()}
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pillar</TableHead>
                  <TableHead className="text-right">Raw</TableHead>
                  <TableHead className="text-right">Wt %</TableHead>
                  <TableHead className="text-right">Weighted</TableHead>
                  <TableHead>Maturity</TableHead>
                  <TableHead className="text-right">vs 4.0</TableHead>
                  <TableHead className="text-right" title="Consultant-validated score (Phase 2)">Validated</TableHead>
                  <TableHead className="text-right" title="Perception vs reality gap">Gap</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ARA_PILLARS.map((p) => {
                  const row = pillarMap.get(p.id);
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.name_en}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row?.raw_score != null ? Number(row.raw_score).toFixed(2) : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {row?.pillar_weight != null ? `${Number(row.pillar_weight).toFixed(1)}` : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {row?.weighted_score != null ? Number(row.weighted_score).toFixed(3) : "—"}
                      </TableCell>
                      <TableCell>
                        {row?.maturity_label_en ? (
                          <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${maturityColor(row.maturity_level)}`}>
                            L{row.maturity_level} — {row.maturity_label_en}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-xs text-muted-foreground">
                        {row?.benchmark_gap != null ? (
                          Number(row.benchmark_gap) > 0
                            ? `+${Number(row.benchmark_gap).toFixed(2)}`
                            : Number(row.benchmark_gap).toFixed(2)
                        ) : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {isFrozen || isArchived ? (
                          <span className="text-xs tabular-nums text-muted-foreground">
                            {row?.consultant_validated_score != null
                              ? Number(row.consultant_validated_score).toFixed(2)
                              : "—"}
                          </span>
                        ) : (
                          <ValidatedScoreInput
                            assessmentId={assessment.id}
                            pillarId={p.id}
                            defaultValue={row?.consultant_validated_score ?? null}
                          />
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-xs">
                        {row?.perception_gap != null ? (
                          <span className={Number(row.perception_gap) > 0 ? "text-amber-700" : Number(row.perception_gap) < 0 ? "text-emerald-700" : ""}>
                            {Number(row.perception_gap) > 0 ? "+" : ""}
                            {Number(row.perception_gap).toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* ─── Pillar weights editor ─── */}
        {!isFrozen && !isArchived && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg">Pillar weights</CardTitle>
              <CardDescription>
                Adjust how each pillar contributes to the overall score.
                Weights must sum to 100. Default is equal (12.5% × 8).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form action={updatePillarWeights} className="space-y-3">
                <input type="hidden" name="assessment_id" value={assessment.id} />
                <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-4">
                  {ARA_PILLARS.map((p) => {
                    const weights = assessment.pillar_weights as Record<string, number>;
                    return (
                      <div key={p.id} className="space-y-1">
                        <Label htmlFor={`weight_${p.id}`} className="text-xs">
                          {p.name_en}
                        </Label>
                        <Input
                          id={`weight_${p.id}`}
                          name={`weight_${p.id}`}
                          type="number"
                          min="0"
                          max="100"
                          step="0.5"
                          defaultValue={weights?.[p.id] ?? 12.5}
                          className="h-8 text-xs"
                        />
                      </div>
                    );
                  })}
                </div>
                <Button type="submit" size="sm">Save weights &amp; recalculate</Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* ─── Layer 2 Consultant Guide ─── */}
        {(layer2Questions ?? []).length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <BookOpen className="h-4 w-4" /> Layer 2 — Consultant guide
              </CardTitle>
              <CardDescription>
                Additional questions for your Phase 2 workshop. <strong>Never shown to respondents.</strong>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {ARA_PILLARS.map((pillar) => {
                  const qs = (layer2Questions ?? []).filter((q) => q.pillar_id === pillar.id);
                  if (qs.length === 0) return null;
                  return (
                    <details key={pillar.id} className="rounded-lg border bg-card">
                      <summary className="px-3 py-2 cursor-pointer flex items-center justify-between text-sm">
                        <span className="font-medium">{pillar.name_en}</span>
                        <Badge variant="outline" className="text-[10px]">{qs.length}</Badge>
                      </summary>
                      <ol className="px-4 py-3 space-y-2 list-decimal list-inside text-sm">
                        {qs.map((q) => (
                          <li key={q.id}>
                            <span className="font-medium me-1">Q{q.question_number}.</span>
                            {q.question_text_en}
                            {q.help_text_en && (
                              <p className="mt-1 text-xs text-muted-foreground ms-5">
                                {q.help_text_en}
                              </p>
                            )}
                          </li>
                        ))}
                      </ol>
                    </details>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ─── Phase 2 Consultant Notes ─── */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Phase 2 consultant notes</CardTitle>
            <CardDescription>
              Observations from the Deep Dive workshop. Toggle <em>Include in report</em> to surface
              a note in the final report; otherwise it stays internal.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Existing notes */}
            {(notes ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No notes yet.</p>
            ) : (
              <div className="space-y-3">
                {(notes ?? []).map((n) => {
                  const pillarName = n.pillar_id
                    ? ARA_PILLARS.find((p) => p.id === n.pillar_id)?.name_en ?? n.pillar_id
                    : "General";
                  const toggleAction = async () => {
                    "use server";
                    await toggleNoteIncludeInReport(n.id, assessment.id, !n.include_in_report);
                  };
                  const deleteAction = async () => {
                    "use server";
                    await deleteConsultantNote(n.id, assessment.id);
                  };
                  return (
                    <div key={n.id} className="rounded-lg border p-3 bg-card">
                      <div className="flex items-start justify-between gap-4 mb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="text-[10px]">{pillarName}</Badge>
                          <Badge variant="secondary" className="text-[10px] uppercase">{n.note_language}</Badge>
                          {n.include_in_report ? (
                            <Badge className="bg-emerald-600 hover:bg-emerald-600 text-[10px]">In report</Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[10px]">Internal</Badge>
                          )}
                        </div>
                        <div className="flex gap-1">
                          <form action={toggleAction}>
                            <Button type="submit" variant="outline" size="sm" className="h-7 text-xs">
                              {n.include_in_report ? "Make internal" : "Include in report"}
                            </Button>
                          </form>
                          <form action={deleteAction}>
                            <Button type="submit" variant="ghost" size="sm" className="h-7 w-7 p-0">
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </form>
                        </div>
                      </div>
                      <p className="text-sm whitespace-pre-wrap" dir={n.note_language === "ar" ? "rtl" : "ltr"}>
                        {n.note_text}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Add note form */}
            <form action={createConsultantNote} className="rounded-lg border p-4 bg-muted/30 space-y-3">
              <input type="hidden" name="assessment_id" value={assessment.id} />
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="note_pillar" className="text-xs">Pillar (optional)</Label>
                  <select
                    id="note_pillar"
                    name="pillar_id"
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs"
                    defaultValue=""
                  >
                    <option value="">General (not pillar-specific)</option>
                    {ARA_PILLARS.map((p) => (
                      <option key={p.id} value={p.id}>{p.name_en}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="note_language" className="text-xs">Language</Label>
                  <select
                    id="note_language"
                    name="note_language"
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs"
                    defaultValue={assessment.default_language}
                  >
                    <option value="en">English</option>
                    <option value="ar">Arabic</option>
                  </select>
                </div>
              </div>
              <textarea
                name="note_text"
                rows={3}
                required
                maxLength={5000}
                placeholder="What did you observe in Phase 2?"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input type="checkbox" name="include_in_report" className="h-3.5 w-3.5 rounded border-input" />
                  Include in report
                </label>
                <Button type="submit" size="sm" className="gap-1">
                  <Plus className="h-3 w-3" /> Add note
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* ─── Regulatory Compliance ─── */}
        <Card className="mb-6">
          <CardHeader className="flex-row items-start justify-between gap-4">
            <div>
              <CardTitle className="text-lg">Regulatory compliance</CardTitle>
              <CardDescription>
                {assessment.region === "uae" ? "UAE" : "Saudi Arabia"} frameworks applicable to your sector.
                Auto-derived from answers; override when you have direct evidence.
              </CardDescription>
            </div>
            <form action={recalcAction}>
              <Button type="submit" variant="outline" size="sm" className="gap-1">
                <RefreshCw className="h-3 w-3" /> Recalculate
              </Button>
            </form>
          </CardHeader>
          <CardContent className="space-y-4">
            {complianceSummaries.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No frameworks apply to this region/sector combination.
              </p>
            ) : (
              <>
                {/* Framework summary cards */}
                <div className="grid gap-2 md:grid-cols-2">
                  {complianceSummaries.map((s) => (
                    <div key={s.framework_id} className="rounded-lg border p-3 bg-card text-sm">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="font-medium">{s.framework_code}</span>
                        <Badge variant="outline" className="text-[10px]">Tier {s.tier}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mb-2 line-clamp-1">
                        {s.framework_name_en}
                      </p>
                      <div className="flex items-center gap-3 text-xs">
                        <span className="tabular-nums font-semibold">
                          {s.percent != null ? `${s.percent}%` : "—"}
                        </span>
                        <span className="text-emerald-700">{s.met} met</span>
                        <span className="text-amber-700">{s.partial} partial</span>
                        <span className="text-red-700">{s.not_met} not met</span>
                        <span className="text-muted-foreground">{s.unknown} unknown</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Requirement list with override forms */}
                <details className="rounded-lg border bg-muted/30">
                  <summary className="px-4 py-2 cursor-pointer text-sm font-medium">
                    All requirements ({(complianceResults ?? []).length}) — click to expand
                  </summary>
                  <div className="p-4 space-y-2 max-h-[600px] overflow-auto">
                    {(complianceResults ?? []).map((r) => {
                      if (!r.requirement) return null;
                      return (
                        <ComplianceRequirementRow
                          key={r.id}
                          result={r}
                          assessmentId={assessment.id}
                        />
                      );
                    })}
                  </div>
                </details>
              </>
            )}
          </CardContent>
        </Card>

        {/* ─── Supporting Materials ─── */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Supporting materials</CardTitle>
            <CardDescription>
              Documents and links submitted by respondents as evidence.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!materials || materials.length === 0 ? (
              <p className="text-sm text-muted-foreground">None submitted yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Submitted by</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Uploaded</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {materials.map((m: any) => (
                    <TableRow key={m.id}>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] uppercase">
                          {m.material_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">{m.material_name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {m.respondent?.name ?? "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground truncate max-w-xs">
                        {m.material_type === "url" ? (
                          <a href={m.link_url} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                            {m.link_url}
                          </a>
                        ) : (
                          m.file_name
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(m.uploaded_at).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* ─── Respondents ─── */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Respondents</CardTitle>
            <CardDescription>
              Stakeholders who will complete their assigned pillar sections.
              Each receives a unique access link — no account required.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!respondents || respondents.length === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-center">
                <p className="text-sm text-muted-foreground">
                  No respondents yet. Add one below.
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Lang</TableHead>
                    <TableHead>Pillars assigned</TableHead>
                    <TableHead>Completed</TableHead>
                    <TableHead>Invite link</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {respondents.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell className="text-sm">
                        <span className="inline-flex items-center gap-1 text-muted-foreground">
                          <Mail className="h-3 w-3" /> {r.email}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {r.role_label_en ?? "—"}
                      </TableCell>
                      <TableCell className="text-xs uppercase">{r.language_preference}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {r.assignments.length === 0 ? (
                            <span className="text-xs text-muted-foreground">None</span>
                          ) : (
                            r.assignments.map((a) => (
                              <Badge key={a.pillar_id} variant="secondary" className="text-[10px]">
                                {ARA_PILLARS.find((p) => p.id === a.pillar_id)?.name_en ?? a.pillar_id}
                              </Badge>
                            ))
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">
                        {r.completed_at ? (
                          <Badge className="bg-emerald-600 hover:bg-emerald-600 text-[10px]">Done</Badge>
                        ) : r.first_opened_at ? (
                          <span className="text-amber-700">In progress</span>
                        ) : (
                          <span className="text-muted-foreground">Not started</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/ara/respond/${r.access_token}`}
                          target="_blank"
                          className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
                        >
                          <Link2 className="h-3 w-3" /> Preview
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* ─── Add respondent ─── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Add respondent</CardTitle>
            <CardDescription>
              Assign one or more pillars. Respondent sees only their assigned sections.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={createAraRespondent} className="space-y-5">
              <input type="hidden" name="assessment_id" value={assessment.id} />

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Name *</Label>
                  <Input id="name" name="name" required maxLength={200} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name_ar">Name (Arabic)</Label>
                  <Input id="name_ar" name="name_ar" maxLength={200} dir="rtl" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input id="email" name="email" type="email" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="language_preference">Language</Label>
                  <select
                    id="language_preference"
                    name="language_preference"
                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                    defaultValue={assessment.default_language}
                  >
                    <option value="en">English</option>
                    <option value="ar">Arabic — العربية</option>
                  </select>
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="role_label_en">Role (optional)</Label>
                  <Input
                    id="role_label_en"
                    name="role_label_en"
                    placeholder="e.g. Chief Executive Officer"
                    maxLength={200}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Assign pillars</Label>
                <div className="grid gap-2 sm:grid-cols-2 rounded-lg border p-4">
                  {ARA_PILLARS.map((p) => (
                    <label key={p.id} className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        name="pillar_assignments"
                        value={p.id}
                        className="mt-0.5 h-4 w-4 rounded border-input"
                      />
                      <span>
                        <span className="block text-sm font-medium">{p.name_en}</span>
                        <span className="block text-xs text-muted-foreground" dir="rtl">{p.name_ar}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <Button type="submit">Add respondent</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Compliance requirement row with inline override form
// ─────────────────────────────────────────────────────────────
function ComplianceRequirementRow({
  result,
  assessmentId,
}: {
  result: ComplianceResultRow;
  assessmentId: string;
}) {
  if (!result.requirement) return null;
  const req = result.requirement;
  const pillar = req.pillar_id ? ARA_PILLARS.find((p) => p.id === req.pillar_id)?.name_en : null;

  return (
    <details className="rounded border bg-card">
      <summary className="px-3 py-2 cursor-pointer flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${
            result.status === "met" ? "bg-emerald-500" :
            result.status === "partial" ? "bg-amber-500" :
            result.status === "not_met" ? "bg-red-500" : "bg-muted-foreground/30"
          }`} />
          <code className="text-[11px] font-mono text-muted-foreground shrink-0">{req.requirement_code}</code>
          <span className="text-xs truncate">{req.requirement_text_en}</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {pillar && <Badge variant="outline" className="text-[9px]">{pillar}</Badge>}
          <span className={`text-[10px] px-1.5 py-0.5 rounded ${statusVariant[result.status]}`}>
            {result.status_label_en ?? result.status}
          </span>
          {result.evidence_note && <span title="Overridden" className="text-[10px]">✎</span>}
        </div>
      </summary>
      <form action={overrideComplianceStatus} className="px-3 py-3 border-t bg-muted/30 space-y-2">
        <input type="hidden" name="assessment_id" value={assessmentId} />
        <input type="hidden" name="requirement_id" value={req.id} />
        <div className="flex items-center gap-2">
          <select
            name="status"
            defaultValue={result.status}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs"
          >
            <option value="met">Compliant</option>
            <option value="partial">Partially Compliant</option>
            <option value="not_met">Action Required</option>
            <option value="unknown">Needs Verification</option>
          </select>
          <input
            name="evidence_note"
            placeholder="Evidence note (optional)"
            defaultValue={result.evidence_note ?? ""}
            maxLength={2000}
            className="flex-1 h-8 rounded-md border border-input bg-background px-2 text-xs"
          />
          <Button type="submit" size="sm" className="h-8 text-xs">Save</Button>
        </div>
      </form>
    </details>
  );
}
