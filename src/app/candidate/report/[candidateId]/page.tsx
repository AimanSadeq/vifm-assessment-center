export const dynamic = "force-dynamic";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { BackLink } from "@/components/shared/back-link";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ImpersonationBanner } from "@/components/shared/impersonation-banner";
import { getServerT, getServerLocale, getServerDir } from "@/lib/i18n/server";
import { localizedName } from "@/lib/i18n/localized";

type Props = {
  params: { candidateId: string };
  searchParams?: { asAdmin?: string };
};

export default async function CandidateReportPage({ params, searchParams }: Props) {
  const supabase = await createClient();
  const t = await getServerT();
  const rtl = getServerDir(await getServerLocale()) === "rtl";
  const { candidateId } = params;
  const asAdmin = searchParams?.asAdmin === "1";

  const [candResult, reportResult, oarResult, consensusResult] =
    await Promise.all([
      supabase
        .from("candidates")
        .select("id, full_name, email, engagement_id, engagements(id, name, organizations(name))")
        .eq("id", candidateId)
        .single(),
      supabase
        .from("candidate_reports")
        .select("*")
        .eq("candidate_id", candidateId)
        .eq("status", "released")
        .maybeSingle(),
      supabase
        .from("overall_assessment_ratings")
        .select("overall_score, recommendation, summary")
        .eq("candidate_id", candidateId)
        .maybeSingle(),
      supabase
        .from("consensus_ratings")
        .select("competency_id, final_score, competencies(name, name_ar)")
        .eq("candidate_id", candidateId),
    ]);

  if (candResult.error || !candResult.data) return notFound();

  const candidate = candResult.data;

  // Fetch engagement competencies using the candidate's engagement_id (separate query to avoid nesting)
  const { data: compResult } = await supabase
    .from("engagement_competencies")
    .select("competency_id, competencies(name)")
    .eq("engagement_id", candidate.engagement_id);
  const eng = candidate.engagements as unknown as {
    id: string;
    name: string;
    organizations: { name: string };
  };
  const oar = oarResult.data;
  const consensusRatings = consensusResult.data ?? [];
  const hasReport = reportResult.data !== null;
  const hasOar = oar !== null;
  const hasConsensus = consensusRatings.length > 0;

  return (
    <div className="space-y-6">
      {asAdmin && (
        <ImpersonationBanner
          candidateName={candidate.full_name}
          candidateEmail={candidate.email as string | null}
          exitHref={`/admin/engagements/${eng.id}`}
        />
      )}
      <div>
        <BackLink href={`/candidate/welcome/${candidateId}${asAdmin ? "?asAdmin=1" : ""}`} label={t("candidateReport.backToWelcome")} />
        <h1 className="mt-2 text-2xl font-bold">{t("candidateReport.title")}</h1>
        <p className="text-sm text-muted-foreground">
          {eng.name} - {eng.organizations?.name ?? ""}
        </p>
      </div>

      {!hasReport ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-lg font-medium text-muted-foreground">
              {t("candidateReport.notAvailableTitle")}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("candidateReport.notAvailableBody")}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* OAR Summary */}
          {hasOar && (
            <Card>
              <CardHeader>
                <CardTitle>{t("candidateReport.oarTitle")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-2xl font-bold text-primary-foreground">
                    {oar.overall_score}
                  </div>
                  <div>
                    <p className="text-lg font-semibold">
                      {t(`rating.bars.${oar.overall_score}`) !== `rating.bars.${oar.overall_score}`
                        ? t(`rating.bars.${oar.overall_score}`)
                        : t(`ratings.bars.${oar.overall_score}`) ?? ""}
                    </p>
                    {oar.recommendation && (
                      <Badge variant="outline" className="mt-1">
                        {t(`candidateReport.oar.${oar.recommendation}`) !== `candidateReport.oar.${oar.recommendation}`
                          ? t(`candidateReport.oar.${oar.recommendation}`)
                          : oar.recommendation}
                      </Badge>
                    )}
                  </div>
                </div>
                {oar.summary && (
                  <>
                    <Separator />
                    <div>
                      <p className="text-sm font-medium mb-1">{t("candidateReport.executiveSummary")}</p>
                      <p className="text-sm text-muted-foreground">{oar.summary}</p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* Competency Scores */}
          {hasConsensus && (
            <Card>
              <CardHeader>
                <CardTitle>{t("candidateReport.competencyScores")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {consensusRatings.map((cr) => {
                  const comp = cr.competencies as unknown as { name: string; name_ar: string | null } | null;
                  return (
                    <div key={cr.competency_id} className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
                      <span className="text-sm sm:min-w-[180px]">
                        {localizedName(comp, rtl) || t("candidateReport.unknownCompetency")}
                      </span>
                      <div className="flex items-center gap-3 sm:flex-1">
                        <div className="flex-1 h-3 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full bg-primary transition-all"
                            style={{ width: `${(cr.final_score / 5) * 100}%` }}
                          />
                        </div>
                        <Badge variant={cr.final_score >= 3 ? "default" : "destructive"}>
                          {cr.final_score}/5
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* Downloads */}
          <Card>
            <CardHeader>
              <CardTitle>{t("candidateReport.pdfsTitle")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-md border p-4">
                <div>
                  <p className="font-medium">{t("candidateReport.fullReportTitle")}</p>
                  <p className="text-sm text-muted-foreground">
                    {t("candidateReport.fullReportBody")}
                  </p>
                </div>
                <a
                  href={`/api/reports/${eng.id}/${candidateId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0"
                >
                  <Button className="w-full sm:w-auto">{t("candidateReport.downloadReport")}</Button>
                </a>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-md border p-4 bg-accent/5">
                <div>
                  <p className="font-medium">{t("candidateReport.learningPlanTitle")}</p>
                  <p className="text-sm text-muted-foreground">
                    {t("candidateReport.learningPlanBody")}
                  </p>
                </div>
                <a
                  href={`/api/reports/${eng.id}/${candidateId}/learning-plan`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0"
                >
                  <Button variant="secondary" className="w-full sm:w-auto">{t("candidateReport.downloadLearningPlan")}</Button>
                </a>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
