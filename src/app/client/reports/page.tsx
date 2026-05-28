import { createClient } from "@/lib/supabase/server";
import { getClientOrgId } from "@/lib/auth/get-org-id";
import { getServerT } from "@/lib/i18n/server";
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

export const dynamic = "force-dynamic";

export default async function ClientReportsPage() {
  const supabase = await createClient();
  const t = await getServerT();

  const orgId = await getClientOrgId();

  // Get org-scoped engagement IDs first
  let engIdQuery = supabase.from("engagements").select("id");
  if (orgId) engIdQuery = engIdQuery.eq("organization_id", orgId);
  const { data: engRows } = await engIdQuery;
  const engIds = (engRows ?? []).map((e) => e.id);

  // Scope OAR query to org's engagements
  let oarQuery = supabase
    .from("overall_assessment_ratings")
    .select("*, candidates(full_name, email), engagements(name)")
    .order("created_at", { ascending: false });
  if (engIds.length > 0) oarQuery = oarQuery.in("engagement_id", engIds);
  const { data: oarData } = await oarQuery;

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
      <h1 className="text-2xl font-bold">{t("clientPortal.reports.title")}</h1>
      <p className="mt-1 text-muted-foreground">
        {t("clientPortal.reports.subtitle")}
      </p>

      <div className="mt-6">
        <Card>
          <CardHeader>
            <CardTitle>{t("clientPortal.reports.cardTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            {(!allCandidates || allCandidates.length === 0) ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                {t("clientPortal.reports.empty")}
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("clientPortal.reports.colCandidate")}</TableHead>
                    <TableHead>{t("clientPortal.reports.colEngagement")}</TableHead>
                    <TableHead>{t("clientPortal.reports.colOar")}</TableHead>
                    <TableHead>{t("clientPortal.reports.colRecommendation")}</TableHead>
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
                          {eng?.name ?? "-"}
                        </TableCell>
                        <TableCell>
                          {oar ? (
                            <Badge variant={oar.overall_score >= 3 ? "default" : "destructive"}>
                              {oar.overall_score}/5
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">{t("clientPortal.reports.pending")}</span>
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
                              {t(`clientPortal.oar.${oar.recommendation}`)}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {eng && oar ? (
                            <a
                              href={`/api/reports/${eng.id}/${c.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <Button size="sm" variant="outline">
                                {t("clientPortal.reports.downloadPdf")}
                              </Button>
                            </a>
                          ) : (
                            <span className="text-xs text-muted-foreground">{t("clientPortal.reports.notReleased")}</span>
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
    </div>
  );
}
