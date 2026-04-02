import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/server";
import { BackLink } from "@/components/shared/back-link";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { BARS_LABELS } from "@/lib/validations/assessor";

const OAR_LABELS: Record<string, string> = {
  ready_now: "Ready Now",
  ready_with_development: "Ready with Development",
  not_ready: "Not Ready",
};

type Props = { params: { candidateId: string } };

export default async function CandidateReportPage({ params }: Props) {
  const supabase = createServiceClient();
  const { candidateId } = params;

  const [candResult, reportResult, oarResult, consensusResult] =
    await Promise.all([
      supabase
        .from("candidates")
        .select("id, full_name, engagement_id, engagements(id, name, organizations(name))")
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
        .select("competency_id, final_score, competencies(name)")
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
      <div>
        <BackLink href={`/candidate/welcome/${candidateId}`} label="Back to Welcome" />
        <h1 className="mt-2 text-2xl font-bold">Your Assessment Report</h1>
        <p className="text-sm text-muted-foreground">
          {eng.name} — {eng.organizations?.name ?? ""}
        </p>
      </div>

      {!hasReport ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-lg font-medium text-muted-foreground">
              Your report is not yet available.
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Assessment results are currently being processed. You will be
              notified when your report is ready for viewing.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* OAR Summary */}
          {hasOar && (
            <Card>
              <CardHeader>
                <CardTitle>Overall Assessment Rating</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-2xl font-bold text-primary-foreground">
                    {oar.overall_score}
                  </div>
                  <div>
                    <p className="text-lg font-semibold">
                      {BARS_LABELS[oar.overall_score] ?? ""}
                    </p>
                    {oar.recommendation && (
                      <Badge variant="outline" className="mt-1">
                        {OAR_LABELS[oar.recommendation] ?? oar.recommendation}
                      </Badge>
                    )}
                  </div>
                </div>
                {oar.summary && (
                  <>
                    <Separator />
                    <div>
                      <p className="text-sm font-medium mb-1">Executive Summary</p>
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
                <CardTitle>Competency Scores</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {consensusRatings.map((cr) => {
                  const comp = cr.competencies as unknown as { name: string } | null;
                  return (
                    <div key={cr.competency_id} className="flex items-center gap-3">
                      <span className="text-sm min-w-[180px]">
                        {comp?.name ?? "Unknown"}
                      </span>
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
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* Download PDF */}
          <Card>
            <CardContent className="py-6 flex items-center justify-between">
              <div>
                <p className="font-medium">Download Full Report</p>
                <p className="text-sm text-muted-foreground">
                  PDF with detailed behavioral evidence and development recommendations.
                </p>
              </div>
              <a
                href={`/api/reports/${eng.id}/${candidateId}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button>Download PDF</Button>
              </a>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
