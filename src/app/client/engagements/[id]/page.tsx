import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/server";
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

export default async function ClientEngagementDetailPage({ params }: Props) {
  const supabase = createServiceClient();

  const [engResult, candsResult, oarResult, reportsResult] = await Promise.all([
    supabase
      .from("engagements")
      .select("id, name, status, target_role, start_date, end_date, organizations(name)")
      .eq("id", params.id)
      .single(),
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
  ]);

  if (engResult.error || !engResult.data) return notFound();

  const eng = engResult.data;
  const candidates = candsResult.data ?? [];
  const oarRatings = oarResult.data ?? [];
  const reports = reportsResult.data ?? [];

  const oarMap = new Map(oarRatings.map((o) => [o.candidate_id, o]));
  const reportMap = new Map(reports.map((r) => [r.candidate_id, r]));

  const orgName =
    eng.organizations && typeof eng.organizations === "object" && "name" in eng.organizations
      ? (eng.organizations as { name: string }).name
      : "—";

  return (
    <div className="space-y-6">
      <div>
        <BackLink href="/client/engagements" label="Back to Engagements" />
        <h1 className="mt-2 text-2xl font-bold">{eng.name}</h1>
        <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
          <span>{orgName}</span>
          <Badge variant="secondary">{eng.status}</Badge>
          {eng.target_role ? <span>Target: {eng.target_role}</span> : null}
          <span>{eng.start_date ?? "—"} — {eng.end_date ?? "—"}</span>
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
                          <span className="text-xs text-muted-foreground">—</span>
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
    </div>
  );
}
