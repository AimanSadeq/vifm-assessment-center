import { createClient } from "@/lib/supabase/server";
import { fetchAllPages, fetchAllByIdChunks } from "@/lib/ara/paginate";
import { getClientOrgId } from "@/lib/auth/get-org-id";
import { getServerT, getServerLocale, getServerDir } from "@/lib/i18n/server";
import { localizedName } from "@/lib/i18n/localized";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { NineBoxGrid } from "./_components/nine-box-grid";
import { BackLink } from "@/components/shared/back-link";

export const dynamic = "force-dynamic";

export default async function ClientAnalyticsPage() {
  const supabase = await createClient();
  const t = await getServerT();
  const rtl = getServerDir(await getServerLocale()) === "rtl";

  const orgId = await getClientOrgId();

  // Org-scoped engagement ids (paginated for safety). The OAR / consensus /
  // candidate reads that hang off them scale with cohort size across the whole
  // org, so they MUST page within each id chunk - an unpaginated read caps at
  // 1000 and would drop candidates from the 9-box grid and cohort aggregates.
  const engIds = (
    await fetchAllPages<{ id: string }>((from, to) => {
      let q = supabase.from("engagements").select("id").order("id").range(from, to);
      if (orgId) q = q.eq("organization_id", orgId);
      return q as unknown as PromiseLike<{ data: { id: string }[] | null; error: { message: string } | null }>;
    }).catch(() => [] as { id: string }[])
  ).map((e) => e.id);

  type OarRow = { candidate_id: string; overall_score: number; recommendation: string };
  type ConsRow = {
    candidate_id: string;
    final_score: number;
    competency_id: string;
    competencies: { name: string; name_ar: string | null } | null;
  };
  type CandRow = { id: string; full_name: string; department: string | null; seniority_level: string | null };

  const [oarData, consensusData, candidatesData] =
    engIds.length > 0
      ? await Promise.all([
          fetchAllByIdChunks<OarRow>(engIds, (chunk, from, to) =>
            supabase
              .from("overall_assessment_ratings")
              .select("candidate_id, overall_score, recommendation")
              .in("engagement_id", chunk)
              .order("id")
              .range(from, to) as unknown as PromiseLike<{ data: OarRow[] | null; error: { message: string } | null }>
          ).catch(() => [] as OarRow[]),
          fetchAllByIdChunks<ConsRow>(engIds, (chunk, from, to) =>
            supabase
              .from("consensus_ratings")
              .select("candidate_id, final_score, competency_id, competencies(name, name_ar)")
              .in("engagement_id", chunk)
              .order("id")
              .range(from, to) as unknown as PromiseLike<{ data: ConsRow[] | null; error: { message: string } | null }>
          ).catch(() => [] as ConsRow[]),
          fetchAllByIdChunks<CandRow>(engIds, (chunk, from, to) =>
            supabase
              .from("candidates")
              .select("id, full_name, department, seniority_level")
              .in("engagement_id", chunk)
              .order("id")
              .range(from, to) as unknown as PromiseLike<{ data: CandRow[] | null; error: { message: string } | null }>
          ).catch(() => [] as CandRow[]),
        ])
      : [[] as OarRow[], [] as ConsRow[], [] as CandRow[]];

  // Build 9-box grid data: Performance (OAR) vs Potential (avg competency score)
  const nineBoxData = candidatesData.map((c) => {
    const oar = oarData.find((o) => o.candidate_id === c.id);
    const candConsensus = consensusData.filter((cr) => cr.candidate_id === c.id);
    const avgScore = candConsensus.length > 0
      ? candConsensus.reduce((sum, cr) => sum + cr.final_score, 0) / candConsensus.length
      : null;
    return {
      name: c.full_name,
      performance: oar?.overall_score ?? 0,
      potential: avgScore ?? 0,
      recommendation: oar?.recommendation ?? null,
    };
  }).filter((c) => c.performance > 0 || c.potential > 0);

  // HiPo identification
  const hipos = nineBoxData
    .filter((c) => c.performance >= 4 && c.potential >= 3.5)
    .sort((a, b) => (b.performance + b.potential) - (a.performance + a.potential));

  const totalAssessed = oarData.length;
  const readyNow = oarData.filter((o) => o.recommendation === "ready_now").length;
  const readyDev = oarData.filter((o) => o.recommendation === "ready_with_development").length;
  const notReady = oarData.filter((o) => o.recommendation === "not_ready").length;
  const avgOar = totalAssessed > 0
    ? (oarData.reduce((sum, o) => sum + o.overall_score, 0) / totalAssessed).toFixed(1)
    : "-";

  // Competency strength/weakness analysis
  const compMap = new Map<string, { name: string; total: number; count: number }>();
  for (const cr of consensusData ?? []) {
    const comp = cr.competencies as unknown as { name: string; name_ar: string | null } | null;
    const name = (comp ? localizedName(comp, rtl) : "") || t("clientAnalytics.unknownCompetency");
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
      <BackLink href="/client" label="Back" history />
      <div>
        <h1 className="text-2xl font-bold">{t("clientAnalytics.title")}</h1>
        <p className="mt-1 text-muted-foreground">
          {t("clientAnalytics.subtitle")}
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-2xl font-bold">{totalAssessed}</p>
            <p className="text-sm text-muted-foreground">{t("clientAnalytics.summaryCandidatesAssessed")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-2xl font-bold">{avgOar}</p>
            <p className="text-sm text-muted-foreground">{t("clientAnalytics.summaryAverageOarScore")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-2xl font-bold text-accent">{readyNow}</p>
            <p className="text-sm text-muted-foreground">{t("clientAnalytics.summaryReadyNow")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-2xl font-bold text-amber-600">{readyDev}</p>
            <p className="text-sm text-muted-foreground">{t("clientAnalytics.summaryReadyWithDev")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-2xl font-bold text-destructive">{notReady}</p>
            <p className="text-sm text-muted-foreground">{t("clientAnalytics.summaryNotReady")}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Strengths */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("clientAnalytics.strengthsTitle")}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {t("clientAnalytics.strengthsSubtitle")}
            </p>
          </CardHeader>
          <CardContent>
            {strengths.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                {t("clientAnalytics.strengthsEmpty")}
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
            <CardTitle className="text-base">{t("clientAnalytics.developmentTitle")}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {t("clientAnalytics.developmentSubtitle")}
            </p>
          </CardHeader>
          <CardContent>
            {developmentAreas.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                {t("clientAnalytics.developmentEmpty")}
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

      {/* 9-Box Grid */}
      {nineBoxData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("clientAnalytics.nineBoxTitle")}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {t("clientAnalytics.nineBoxSubtitle")}
            </p>
          </CardHeader>
          <CardContent>
            <NineBoxGrid data={nineBoxData} />
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* HiPo Identification */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("clientAnalytics.hipoTitle")}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {t("clientAnalytics.hipoSubtitle")}
            </p>
          </CardHeader>
          <CardContent>
            {hipos.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                {t("clientAnalytics.hipoEmpty")}
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("clientAnalytics.colName")}</TableHead>
                    <TableHead className="text-center">{t("clientAnalytics.colPerformance")}</TableHead>
                    <TableHead className="text-center">{t("clientAnalytics.colPotential")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {hipos.map((h) => (
                    <TableRow key={h.name}>
                      <TableCell className="font-medium">{h.name}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="default">{h.performance}/5</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary">{h.potential.toFixed(1)}/5</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Succession Planning */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("clientAnalytics.successionTitle")}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {t("clientAnalytics.successionSubtitle")}
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-32 text-sm font-medium">{t("clientAnalytics.successionReadyNow")}</div>
                <div className="flex-1 h-6 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-accent rounded-full flex items-center justify-center text-xs text-white font-medium"
                    style={{ width: totalAssessed > 0 ? `${(readyNow / totalAssessed) * 100}%` : "0%" }}
                  >
                    {readyNow}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-32 text-sm font-medium">{t("clientAnalytics.successionReadyWithDev")}</div>
                <div className="flex-1 h-6 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-500 rounded-full flex items-center justify-center text-xs text-white font-medium"
                    style={{ width: totalAssessed > 0 ? `${(readyDev / totalAssessed) * 100}%` : "0%" }}
                  >
                    {readyDev}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-32 text-sm font-medium">{t("clientAnalytics.successionNotReady")}</div>
                <div className="flex-1 h-6 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-destructive rounded-full flex items-center justify-center text-xs text-white font-medium"
                    style={{ width: totalAssessed > 0 ? `${(notReady / totalAssessed) * 100}%` : "0%" }}
                  >
                    {notReady}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Leadership Development Priorities */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("clientAnalytics.prioritiesTitle")}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {t("clientAnalytics.prioritiesSubtitle")}
          </p>
        </CardHeader>
        <CardContent>
          {developmentAreas.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              {t("clientAnalytics.prioritiesEmpty")}
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {developmentAreas.map((c, i) => (
                <div key={c.name} className="border rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="text-xs">{t("clientAnalytics.priorityBadge", { n: i + 1 })}</Badge>
                  </div>
                  <p className="text-sm font-medium">{c.name}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t("clientAnalytics.cohortAvgTarget", { score: c.avg.toFixed(1) })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
