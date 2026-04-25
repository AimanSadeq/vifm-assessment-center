import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getClientOrgId } from "@/lib/auth/get-org-id";
import { BackLink } from "@/components/shared/back-link";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BARS_LABELS } from "@/lib/validations/assessor";

const OAR_LABELS: Record<string, string> = {
  ready_now: "Ready Now",
  ready_with_development: "Ready with Development",
  not_ready: "Not Ready",
};

type Props = { params: { id: string } };

export const dynamic = "force-dynamic";

export default async function ClientEngagementDetailPage({ params }: Props) {
  const supabase = await createClient();
  const orgId = await getClientOrgId();

  // Build engagement query with org-scoping
  let engQuery = supabase
    .from("engagements")
    .select("id, name, status, target_role, start_date, end_date, organizations(name)")
    .eq("id", params.id);
  if (orgId) engQuery = engQuery.eq("organization_id", orgId);

  const [engResult, candsResult, oarResult, reportsResult, consensusResult] = await Promise.all([
    engQuery.single(),
    supabase
      .from("candidates")
      .select("id, full_name, email, status")
      .eq("engagement_id", params.id)
      .order("full_name"),
    supabase
      .from("overall_assessment_ratings")
      .select("candidate_id, overall_score, recommendation")
      .eq("engagement_id", params.id),
    supabase
      .from("candidate_reports")
      .select("candidate_id, status, released_at")
      .eq("engagement_id", params.id),
    supabase
      .from("consensus_ratings")
      .select("candidate_id, competency_id, final_score, competencies(name)")
      .eq("engagement_id", params.id),
  ]);

  if (engResult.error || !engResult.data) return notFound();

  const eng = engResult.data;
  const candidates = candsResult.data ?? [];
  const oarRatings = oarResult.data ?? [];
  const reports = reportsResult.data ?? [];

  const oarMap = new Map(oarRatings.map((o) => [o.candidate_id, o]));
  const reportMap = new Map(reports.map((r) => [r.candidate_id, r]));
  const consensusRatings = consensusResult.data ?? [];

  // Build competency score matrix
  const competencyNames = new Map<string, string>();
  const candidateScores = new Map<string, Map<string, number>>();
  for (const cr of consensusRatings) {
    const comp = cr.competencies as unknown as { name: string } | null;
    if (comp) competencyNames.set(cr.competency_id, comp.name);
    if (!candidateScores.has(cr.candidate_id)) {
      candidateScores.set(cr.candidate_id, new Map());
    }
    candidateScores.get(cr.candidate_id)!.set(cr.competency_id, cr.final_score);
  }
  const compIds = Array.from(competencyNames.keys());

  const orgName =
    eng.organizations && typeof eng.organizations === "object" && "name" in eng.organizations
      ? (eng.organizations as { name: string }).name
      : "-";

  return (
    <div className="space-y-6">
      <div>
        <BackLink href="/client/engagements" label="Back to Projects" />
        <h1 className="mt-2 text-2xl font-bold">{eng.name}</h1>
        <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
          <span>{orgName}</span>
          <Badge variant="secondary">{eng.status}</Badge>
          {eng.target_role ? <span>Target: {eng.target_role}</span> : null}
          <span>{eng.start_date ?? "-"} - {eng.end_date ?? "-"}</span>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Candidate Results</CardTitle>
          <p className="text-sm text-muted-foreground">
            Overall assessment ratings and report status for each candidate.
          </p>
        </CardHeader>
        <CardContent>
          {candidates.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No candidates in this engagement.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Candidate</TableHead>
                  <TableHead>Assessment Status</TableHead>
                  <TableHead>OAR Score</TableHead>
                  <TableHead>Recommendation</TableHead>
                  <TableHead>Report</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {candidates.map((c) => {
                  const oar = oarMap.get(c.id);
                  const report = reportMap.get(c.id);
                  const reportReleased = report?.status === "released";

                  return (
                    <TableRow key={c.id}>
                      <TableCell>
                        <div>
                          <span className="font-medium">{c.full_name}</span>
                          <p className="text-xs text-muted-foreground">{c.email}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{c.status}</Badge>
                      </TableCell>
                      <TableCell>
                        {oar ? (
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-lg">{oar.overall_score}</span>
                            <span className="text-xs text-muted-foreground">/5</span>
                            <span className="text-xs text-muted-foreground">
                              {BARS_LABELS[oar.overall_score] ?? ""}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">Pending</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {oar ? (
                          <Badge
                            variant={
                              oar.recommendation === "ready_now"
                                ? "default"
                                : oar.recommendation === "not_ready"
                                  ? "destructive"
                                  : "secondary"
                            }
                          >
                            {OAR_LABELS[oar.recommendation] ?? oar.recommendation}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {reportReleased ? (
                          <a
                            href={`/api/reports/${params.id}/${c.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Button size="sm" variant="outline">
                              Download PDF
                            </Button>
                          </a>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            Not released
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      {/* Competency Score Matrix */}
      {compIds.length > 0 && candidates.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Competency Score Matrix</CardTitle>
            <p className="text-sm text-muted-foreground">
              Consensus scores per candidate per competency.
            </p>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 bg-card z-10 min-w-[150px]">Candidate</TableHead>
                  {compIds.map((cid) => (
                    <TableHead key={cid} className="text-center text-xs min-w-[80px]">
                      {(competencyNames.get(cid) ?? "").length > 15
                        ? (competencyNames.get(cid) ?? "").slice(0, 15) + "..."
                        : competencyNames.get(cid)}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {candidates.map((c) => {
                  const scores = candidateScores.get(c.id);
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="sticky left-0 bg-card z-10 font-medium text-sm">
                        {c.full_name}
                      </TableCell>
                      {compIds.map((cid) => {
                        const score = scores?.get(cid);
                        return (
                          <TableCell key={cid} className="text-center">
                            {score !== undefined ? (
                              <Badge
                                variant={score >= 3 ? "default" : "destructive"}
                                className="text-xs"
                              >
                                {score}
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
