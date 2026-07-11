import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getServerT } from "@/lib/i18n/server";
import { fetchAllPages } from "@/lib/ara/paginate";
import { BackLink } from "@/components/shared/back-link";
import { notFound } from "next/navigation";
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

type Props = {
  params: { engagementId: string };
};

export default async function WashupEngagementPage({ params }: Props) {
  const supabase = await createClient();
  const t = await getServerT();
  const { engagementId } = params;

  // consensus_ratings scales as candidates x competencies (e.g. 40 x 41 = 1640),
  // so it is paginated - an unpaginated read caps at 1000 and would undercount
  // the per-candidate progress bar (and mis-mark candidates as incomplete).
  type ConsensusRow = { candidate_id: string; competency_id: string; final_score: number };
  const [engResult, candsResult, compsResult, oarResult] =
    await Promise.all([
      supabase.from("engagements").select("id, name, organizations(name)").eq("id", engagementId).single(),
      supabase.from("candidates").select("id, full_name, status").eq("engagement_id", engagementId).order("full_name"),
      supabase
        .from("engagement_competencies")
        .select("competency_id")
        .eq("engagement_id", engagementId),
      supabase
        .from("overall_assessment_ratings")
        .select("candidate_id, overall_score, recommendation")
        .eq("engagement_id", engagementId),
    ]);

  if (engResult.error || !engResult.data) return notFound();

  const consensusRatings = await fetchAllPages<ConsensusRow>((from, to) =>
    supabase
      .from("consensus_ratings")
      .select("candidate_id, competency_id, final_score")
      .eq("engagement_id", engagementId)
      .order("id")
      .range(from, to) as unknown as PromiseLike<{ data: ConsensusRow[] | null; error: { message: string } | null }>
  ).catch(() => [] as ConsensusRow[]);

  const engagement = engResult.data;
  const candidates = candsResult.data ?? [];
  const totalComps = compsResult.data?.length ?? 0;
  const oarRatings = oarResult.data ?? [];

  // Count consensus per candidate
  const consensusCountMap = new Map<string, number>();
  for (const cr of consensusRatings) {
    consensusCountMap.set(cr.candidate_id, (consensusCountMap.get(cr.candidate_id) ?? 0) + 1);
  }

  // OAR per candidate
  const oarMap = new Map<string, { overall_score: number; recommendation: string }>();
  for (const o of oarRatings) {
    oarMap.set(o.candidate_id, { overall_score: o.overall_score, recommendation: o.recommendation });
  }

  const orgName =
    engagement.organizations &&
    typeof engagement.organizations === "object" &&
    "name" in engagement.organizations
      ? (engagement.organizations as { name: string }).name
      : "";

  return (
    <div>
      <div className="mb-6">
        <BackLink href="/assessor/washup" label={t("assessorWashup.engagement.backToSessions")} />
        <h1 className="mt-2 text-2xl font-bold">{t("assessorWashup.engagement.title", { name: engagement.name })}</h1>
        <p className="text-sm text-muted-foreground">{orgName}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("assessorWashup.engagement.candidates")}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {t("assessorWashup.engagement.subtitle")}
          </p>
        </CardHeader>
        <CardContent>
          {candidates.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              {t("assessorWashup.engagement.empty")}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("assessorWashup.engagement.colCandidate")}</TableHead>
                  <TableHead>{t("assessorWashup.engagement.colConsensusProgress")}</TableHead>
                  <TableHead>{t("assessorWashup.engagement.colOar")}</TableHead>
                  <TableHead className="w-28"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {candidates.map((c) => {
                  const consensusCount = consensusCountMap.get(c.id) ?? 0;
                  const oar = oarMap.get(c.id);
                  const isComplete = totalComps > 0 && consensusCount >= totalComps;

                  return (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.full_name}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="h-2 flex-1 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full bg-primary rounded-full transition-all"
                              style={{
                                width: totalComps > 0
                                  ? `${(consensusCount / totalComps) * 100}%`
                                  : "0%",
                              }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {consensusCount}/{totalComps}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {oar ? (
                          <Badge variant="outline">
                            {oar.overall_score}/5 - {t(`ratings.oar.${oar.recommendation}`) ?? oar.recommendation}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">{t("assessorWashup.engagement.notSet")}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Link href={`/assessor/washup/${engagementId}/${c.id}`}>
                          <Button size="sm" variant={isComplete ? "outline" : "default"}>
                            {isComplete ? t("assessorWashup.engagement.review") : t("assessorWashup.engagement.discuss")}
                          </Button>
                        </Link>
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
