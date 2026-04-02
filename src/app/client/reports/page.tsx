import { createServiceClient } from "@/lib/supabase/server";
import { getClientOrgId } from "@/lib/auth/get-org-id";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

export default async function ClientReportsPage() {
  const supabase = createServiceClient();

  const orgId = await getClientOrgId();

  const { data: oarData } = await supabase
    .from("overall_assessment_ratings")
    .select("*, candidates(full_name, email), engagements(name)")
    .order("created_at", { ascending: false });

  // Get candidates scoped to this client's organization
  let candQuery = supabase
    .from("candidates")
    .select("id, full_name, email, status, engagement_id, engagements!inner(id, name, organization_id)")
    .in("status", ["in_progress", "completed"])
    .order("full_name");
  if (orgId) candQuery = candQuery.eq("engagements.organization_id", orgId);
  const { data: allCandidates } = await candQuery;

  return (
    <div>
      <h1 className="text-2xl font-bold">Reports</h1>
      <p className="mt-1 text-muted-foreground">
        Access candidate assessment reports once released by VIFM.
      </p>

      <div className="mt-6">
        <Card>
          <CardHeader>
            <CardTitle>Candidate Reports</CardTitle>
          </CardHeader>
          <CardContent>
            {(!allCandidates || allCandidates.length === 0) ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                No candidate reports available yet.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Candidate</TableHead>
                    <TableHead>Engagement</TableHead>
                    <TableHead>OAR</TableHead>
                    <TableHead>Recommendation</TableHead>
                    <TableHead className="w-32"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allCandidates.map((c) => {
                    const eng = c.engagements as unknown as { id: string; name: string } | null;
                    const oar = (oarData ?? []).find(
                      (o) => o.candidate_id === c.id
                    );
                    return (
                      <TableRow key={c.id}>
                        <TableCell>
                          <div>
                            <span className="font-medium">{c.full_name}</span>
                            <p className="text-xs text-muted-foreground">{c.email}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {eng?.name ?? "—"}
                        </TableCell>
                        <TableCell>
                          {oar ? (
                            <Badge variant={oar.overall_score >= 3 ? "default" : "destructive"}>
                              {oar.overall_score}/5
                            </Badge>
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
                          {eng ? (
                            <a
                              href={`/api/reports/${eng.id}/${c.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <Button size="sm" variant="outline">
                                Download PDF
                              </Button>
                            </a>
                          ) : null}
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
    </div>
  );
}
