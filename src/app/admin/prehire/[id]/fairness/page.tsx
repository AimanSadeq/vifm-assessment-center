import { notFound } from "next/navigation";
import { ShieldCheck, Scale, UserCheck, FileLock2, AlertTriangle } from "lucide-react";
import { requireRole, isAuthorizationError } from "@/lib/ara/auth-guards";
import { createServiceClient } from "@/lib/supabase/server";
import { BackLink } from "@/components/shared/back-link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  computeAdverseImpact, FOUR_FIFTHS, type AdverseImpactCandidate, type DimensionResult,
} from "@/lib/prehire/adverse-impact";
import { getPrehireAudit } from "@/lib/prehire/audit";

export const dynamic = "force-dynamic";

const AUDIT_LABELS: Record<string, string> = {
  requisition_created: "Requisition created",
  candidate_added: "Candidate added",
  invitation_sent: "Invitation sent",
  consent_given: "Consent given",
  stage_completed: "Stage completed",
  demographics_submitted: "Demographics submitted",
  decision_recorded: "Decision recorded",
  export_taken: "Results exported",
};

const pct = (n: number) => `${Math.round(n * 100)}%`;
const fmtWhen = (iso: string) => new Date(iso).toLocaleString();

function detailSummary(action: string, detail: Record<string, unknown> | null): string {
  if (!detail) return "";
  if (action === "stage_completed") return `${detail.kind ?? ""}${detail.normalized != null ? ` · ${detail.normalized}` : ""}`;
  if (action === "decision_recorded") return `${detail.decision ?? ""}`;
  if (action === "export_taken") return `${detail.format ?? ""} · ${detail.candidate_count ?? 0} candidates`;
  if (action === "invitation_sent") return `${detail.channel ?? ""}`;
  if (action === "demographics_submitted") return detail.disclosed ? "disclosed" : "declined";
  return "";
}

function DimensionTable({ dim }: { dim: DimensionResult }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[#010131]">{dim.label}</h3>
        {dim.anyAdverseImpact ? (
          <Badge className="bg-rose-100 text-rose-800 border-rose-200">Possible adverse impact</Badge>
        ) : dim.groups.length > 0 ? (
          <Badge className="bg-green-100 text-green-800 border-green-200">No flag</Badge>
        ) : null}
      </div>
      {dim.groups.length === 0 ? (
        <p className="text-xs text-muted-foreground">No disclosed data in the analysis pool yet.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Group</TableHead>
              <TableHead className="text-center">n</TableHead>
              <TableHead className="text-center">Selected</TableHead>
              <TableHead className="text-center">Rate</TableHead>
              <TableHead className="text-center">Impact ratio</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {dim.groups.map((g) => (
              <TableRow key={g.group}>
                <TableCell className="font-medium">{g.label}</TableCell>
                <TableCell className="text-center tabular-nums">{g.n}</TableCell>
                <TableCell className="text-center tabular-nums">{g.selected}</TableCell>
                <TableCell className="text-center tabular-nums">{pct(g.selectionRate)}</TableCell>
                <TableCell className="text-center tabular-nums">
                  {g.isReference ? (
                    <span className="text-xs text-muted-foreground">reference</span>
                  ) : g.impactRatio == null ? (
                    "—"
                  ) : (
                    <span className={g.adverseImpact ? "font-semibold text-rose-700" : ""}>
                      {g.impactRatio.toFixed(2)}
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  {g.adverseImpact && (
                    <span className="inline-flex items-center gap-1 text-xs text-rose-700">
                      <AlertTriangle className="h-3 w-3" /> &lt; {FOUR_FIFTHS}
                    </span>
                  )}
                  {g.smallSample && <span className="text-[10px] text-amber-600"> small n</span>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <p className="text-[11px] text-muted-foreground">
        {dim.notDisclosed > 0 && <>{dim.notDisclosed} not disclosed. </>}
        {dim.underpowered && (
          <span className="text-amber-700">
            Sample too small for a reliable ratio (aim for ≥30 in the pool and ≥5 per group) — treat as indicative only.
          </span>
        )}
      </p>
    </div>
  );
}

export default async function FairnessPage({ params }: { params: { id: string } }) {
  try {
    await requireRole(["admin"]);
  } catch (e) {
    if (isAuthorizationError(e)) {
      return (
        <div className="mx-auto max-w-6xl space-y-6 px-6 py-8">
          <BackLink href={`/admin/prehire/${params.id}`} label="Back to requisition" />
          <Card><CardContent className="py-6"><p className="text-sm text-destructive">{e.message}</p></CardContent></Card>
        </div>
      );
    }
    throw e;
  }

  const svc = createServiceClient();
  const { data: req } = await svc
    .from("prehire_requisitions")
    .select("id, title, organizations(name)")
    .eq("id", params.id)
    .maybeSingle();
  if (!req) notFound();
  const orgName = (req.organizations as unknown as { name: string } | null)?.name ?? null;

  // Tolerant read: the demographic + decision columns exist only after 00051.
  const { data: candData, error: candErr } = await svc
    .from("prehire_candidates")
    .select("gender, age_band, nationality_group, decision, recommendation")
    .eq("requisition_id", params.id);
  const needsMigration = !!candErr;
  const report = computeAdverseImpact((candData ?? []) as AdverseImpactCandidate[]);
  const audit = await getPrehireAudit(params.id, 100);

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-6 py-8">
      <BackLink href={`/admin/prehire/${params.id}`} label="Back to requisition" />

      <div>
        <h1 className="inline-flex items-center gap-2 text-2xl font-bold text-[#010131]">
          <ShieldCheck className="h-6 w-6 text-[#5391D5]" /> Fairness &amp; audit
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {req.title}{orgName ? ` · ${orgName}` : ""}
        </p>
      </div>

      {needsMigration && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Apply migration <code className="font-mono">00051</code> to enable demographic monitoring and the audit trail.
        </div>
      )}

      {/* Defensibility guardrails */}
      <Card>
        <CardHeader><CardTitle className="text-base">How this screening stays defensible</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <Guardrail icon={<Scale className="h-4 w-4 text-[#5391D5]" />} title="Job-related by design"
            body="Stages and cut-scores are configured from the role's competency profile — measuring what the job requires." />
          <Guardrail icon={<UserCheck className="h-4 w-4 text-[#5391D5]" />} title="A human decides"
            body="The composite is an advisory screening signal. It never auto-rejects; a person records the decision with a job-related reason." />
          <Guardrail icon={<FileLock2 className="h-4 w-4 text-[#5391D5]" />} title="Consent + audit trail"
            body="Each candidate consents before any data is collected, and every significant action is written to an immutable log (below)." />
          <Guardrail icon={<ShieldCheck className="h-4 w-4 text-[#5391D5]" />} title="Demographics never scored"
            body="Self-ID is voluntary, separate from the assessment, and used only in aggregate for the adverse-impact check below — never per individual." />
        </CardContent>
      </Card>

      {/* Adverse impact */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Adverse-impact analysis (4/5ths rule)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-xs text-muted-foreground">
            Selection basis:{" "}
            <span className="font-medium text-foreground">
              {report.basis === "decision" ? "human decisions (advanced vs. rejected)" : "AI recommendation (advance vs. not)"}
            </span>
            {" · "}pool {report.poolSize} · selected {report.selectedTotal}. A group flags when its selection rate
            falls below 80% of the highest-selected group. This is a monitoring signal for review, not proof of bias.
          </p>
          {report.poolSize === 0 ? (
            <p className="text-sm text-muted-foreground">
              No candidates in the analysis pool yet — record decisions (or let the pipeline score candidates) to populate this.
            </p>
          ) : (
            <div className="grid gap-6 lg:grid-cols-3">
              {report.dimensions.map((d) => <DimensionTable key={d.dimension} dim={d} />)}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Audit trail */}
      <Card>
        <CardHeader><CardTitle className="text-base">Audit trail ({audit.length})</CardTitle></CardHeader>
        <CardContent>
          {audit.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground text-center">No audit entries yet.</p>
          ) : (
            <div className="max-h-[28rem] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Actor</TableHead>
                    <TableHead>Detail</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {audit.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{fmtWhen(a.created_at)}</TableCell>
                      <TableCell className="text-sm">{AUDIT_LABELS[a.action] ?? a.action}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{a.actor_label ?? "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{detailSummary(a.action, a.detail)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Guardrail({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="flex gap-3 rounded-lg border border-slate-200 p-3">
      <div className="mt-0.5 shrink-0">{icon}</div>
      <div>
        <p className="text-sm font-medium text-[#010131]">{title}</p>
        <p className="text-xs text-muted-foreground">{body}</p>
      </div>
    </div>
  );
}
