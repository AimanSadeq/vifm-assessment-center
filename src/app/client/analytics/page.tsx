import { createServiceClient } from "@/lib/supabase/server";
import { getClientOrgId } from "@/lib/auth/get-org-id";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BARS_LABELS } from "@/lib/validations/assessor";

const OAR_LABELS: Record<string, string> = {
  ready_now: "Ready Now",
  ready_with_development: "Ready with Development",
  not_ready: "Not Ready",
};

export default async function ClientAnalyticsPage() {
  const supabase = createServiceClient();

  const orgId = await getClientOrgId();
  // TODO: Join through engagements to filter by org when auth is enabled
  const { data: oarData } = await supabase
    .from("overall_assessment_ratings")
    .select("overall_score, recommendation");

  const { data: consensusData } = await supabase
    .from("consensus_ratings")
    .select("final_score, competency_id, competencies(name)");

  const totalAssessed = oarData?.length ?? 0;
  const readyNow = oarData?.filter((o) => o.recommendation === "ready_now").length ?? 0;
  const readyDev = oarData?.filter((o) => o.recommendation === "ready_with_development").length ?? 0;
  const notReady = oarData?.filter((o) => o.recommendation === "not_ready").length ?? 0;
  const avgOar = totalAssessed > 0
    ? (oarData!.reduce((sum, o) => sum + o.overall_score, 0) / totalAssessed).toFixed(1)
    : "—";

  // Competency strength/weakness analysis
  const compMap = new Map<string, { name: string; total: number; count: number }>();
  for (const cr of consensusData ?? []) {
    const comp = cr.competencies as unknown as { name: string } | null;
    const name = comp?.name ?? "Unknown";
    if (!compMap.has(cr.competency_id)) {
      compMap.set(cr.competency_id, { name, total: 0, count: 0 });
    }
    const entry = compMap.get(cr.competency_id)!;
    entry.total += cr.final_score;
    entry.count++;
  }

  const compAverages = Array.from(compMap.values())
    .map((c) => ({ name: c.name, avg: c.total / c.count }))
    .sort((a, b) => b.avg - a.avg);

  const strengths = compAverages.filter((c) => c.avg >= 3.5).slice(0, 5);
  const developmentAreas = compAverages.filter((c) => c.avg < 3.5).sort((a, b) => a.avg - b.avg).slice(0, 5);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Analytics</h1>
        <p className="mt-1 text-muted-foreground">
          Aggregate insights across your engagements and candidate cohorts.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-2xl font-bold">{totalAssessed}</p>
            <p className="text-sm text-muted-foreground">Candidates Assessed</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-2xl font-bold">{avgOar}</p>
            <p className="text-sm text-muted-foreground">Average OAR Score</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-2xl font-bold text-accent">{readyNow}</p>
            <p className="text-sm text-muted-foreground">Ready Now</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-2xl font-bold text-amber-600">{readyDev}</p>
            <p className="text-sm text-muted-foreground">Ready with Dev.</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-2xl font-bold text-destructive">{notReady}</p>
            <p className="text-sm text-muted-foreground">Not Ready</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Strengths */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cohort Strengths</CardTitle>
            <p className="text-sm text-muted-foreground">
              Top-scoring competencies across all candidates.
            </p>
          </CardHeader>
          <CardContent>
            {strengths.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No consensus data available yet.
              </p>
            ) : (
              <div className="space-y-3">
                {strengths.map((c) => (
                  <div key={c.name} className="flex items-center gap-3">
                    <span className="text-sm flex-1">{c.name}</span>
                    <div className="w-24 h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-accent"
                        style={{ width: `${(c.avg / 5) * 100}%` }}
                      />
                    </div>
                    <Badge variant="default">{c.avg.toFixed(1)}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Development Areas */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Development Areas</CardTitle>
            <p className="text-sm text-muted-foreground">
              Competencies where the cohort scored below 3.5.
            </p>
          </CardHeader>
          <CardContent>
            {developmentAreas.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No development areas identified or no data yet.
              </p>
            ) : (
              <div className="space-y-3">
                {developmentAreas.map((c) => (
                  <div key={c.name} className="flex items-center gap-3">
                    <span className="text-sm flex-1">{c.name}</span>
                    <div className="w-24 h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-destructive/70"
                        style={{ width: `${(c.avg / 5) * 100}%` }}
                      />
                    </div>
                    <Badge variant="destructive">{c.avg.toFixed(1)}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
