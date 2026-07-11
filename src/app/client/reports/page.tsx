import { createClient } from "@/lib/supabase/server";
import { fetchAllPages, fetchAllByIdChunks } from "@/lib/ara/paginate";
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
import { BackLink } from "@/components/shared/back-link";

export const dynamic = "force-dynamic";

export default async function ClientReportsPage() {
  const supabase = await createClient();
  const t = await getServerT();

  const orgId = await getClientOrgId();

  // Org-scoped engagement ids (paginated). The OAR + candidate reads that hang
  // off them scale with cohort size across the whole org, so they page + chunk -
  // an unpaginated read caps at 1000 and would hide released reports the client
  // is entitled to reach.
  const engIds = (
    await fetchAllPages<{ id: string }>((from, to) => {
      let q = supabase.from("engagements").select("id").order("id").range(from, to);
      if (orgId) q = q.eq("organization_id", orgId);
      return q as unknown as PromiseLike<{ data: { id: string }[] | null; error: { message: string } | null }>;
    }).catch(() => [] as { id: string }[])
  ).map((e) => e.id);

  type OarRow = { candidate_id: string; overall_score: number; recommendation: string };
  const oarData =
    engIds.length > 0
      ? await fetchAllByIdChunks<OarRow>(engIds, (chunk, from, to) =>
          supabase
            .from("overall_assessment_ratings")
            .select("candidate_id, overall_score, recommendation")
            .in("engagement_id", chunk)
            .order("id")
            .range(from, to) as unknown as PromiseLike<{ data: OarRow[] | null; error: { message: string } | null }>
        ).catch(() => [] as OarRow[])
      : [];

  type CandRow = {
    id: string;
    full_name: string;
    email: string;
    status: string;
    engagement_id: string;
    engagements: { id: string; name: string; organization_id: string } | null;
  };
  const allCandidates = await fetchAllPages<CandRow>((from, to) => {
    let q = supabase
      .from("candidates")
      .select("id, full_name, email, status, engagement_id, engagements!inner(id, name, organization_id)")
      .in("status", ["in_progress", "completed"])
      .order("full_name")
      .order("id")
      .range(from, to);
    if (orgId) q = q.eq("engagements.organization_id", orgId);
    return q as unknown as PromiseLike<{ data: CandRow[] | null; error: { message: string } | null }>;
  }).catch(() => [] as CandRow[]);

  return (
    <div>
      <BackLink href="/client" label="Back" history />
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
            {allCandidates.length === 0 ? (
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
