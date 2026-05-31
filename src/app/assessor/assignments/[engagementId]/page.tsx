import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getServerT } from "@/lib/i18n/server";
import { BackLink } from "@/components/shared/back-link";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";

type Props = {
  params: { engagementId: string };
};

export default async function AssessorAssignmentGridPage({ params }: Props) {
  const supabase = await createClient();
  const t = await getServerT();
  const typeLabel = (k: string) => {
    const v = t(`exercise.types.${k}`);
    return v.startsWith("exercise.types.") ? k : v;
  };
  const { engagementId } = params;

  const [engResult, assignResult, oarResult] = await Promise.all([
    supabase.from("engagements").select("id, name, status, target_role, start_date, end_date, assessment_type, organizations(name)").eq("id", engagementId).single(),
    // RLS automatically filters to the logged-in assessor's assignments
    supabase
      .from("assessor_assignments")
      .select("id, candidate_id, exercise_id, candidates(id, full_name), exercises(id, name, exercise_type), profiles(id, full_name)")
      .eq("engagement_id", engagementId),
    supabase
      .from("overall_assessment_ratings")
      .select("candidate_id, overall_score, recommendation")
      .eq("engagement_id", engagementId),
  ]);

  if (engResult.error || !engResult.data) return notFound();

  const engagement = engResult.data;
  const assignments = assignResult.data ?? [];
  const oars = oarResult.data ?? [];

  // Build OAR lookup
  const oarMap = new Map<string, { score: number; recommendation: string }>();
  for (const o of oars) {
    oarMap.set(o.candidate_id, { score: o.overall_score, recommendation: o.recommendation });
  }

  // Group by candidate
  const candidateMap = new Map<string, {
    candidateName: string;
    candidateId: string;
    assignments: typeof assignments;
  }>();

  for (const a of assignments) {
    const cand = a.candidates as unknown as { id: string; full_name: string } | null;
    if (!cand) continue;
    if (!candidateMap.has(cand.id)) {
      candidateMap.set(cand.id, {
        candidateName: cand.full_name,
        candidateId: cand.id,
        assignments: [],
      });
    }
    candidateMap.get(cand.id)!.assignments.push(a);
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
        <BackLink href="/assessor/assignments" label={t("assessorPortal.grid.backToProjects")} />
        <h1 className="mt-2 text-2xl font-bold">{engagement.name}</h1>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>{orgName}</span>
          <Badge variant="secondary">{engagement.status}</Badge>
          {engagement.target_role && <span>{t("assessorPortal.grid.role", { role: engagement.target_role })}</span>}
          {engagement.assessment_type && (
            <Badge variant="outline" className="text-xs capitalize">{engagement.assessment_type}</Badge>
          )}
          {engagement.start_date && engagement.end_date && (
            <span>{engagement.start_date} - {engagement.end_date}</span>
          )}
        </div>
      </div>

      {candidateMap.size === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-muted-foreground">{t("assessorPortal.grid.noAssignments")}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Array.from(candidateMap.values()).map((group) => (
            <Card key={group.candidateId}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-lg">{group.candidateName}</CardTitle>
                    {oarMap.has(group.candidateId) && (
                      <Badge variant={oarMap.get(group.candidateId)!.score >= 3 ? "default" : "destructive"}>
                        {t("assessorPortal.grid.oarBadge", { score: oarMap.get(group.candidateId)!.score })}
                      </Badge>
                    )}
                  </div>
                  <Link href={`/assessor/integration/${engagementId}/${group.candidateId}`}>
                    <Button variant="outline" size="sm">
                      {t("assessorPortal.grid.integrationWorksheet")}
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("assessorPortal.grid.colExercise")}</TableHead>
                      <TableHead>{t("assessorPortal.grid.colType")}</TableHead>
                      <TableHead>{t("assessorPortal.grid.colAssessor")}</TableHead>
                      <TableHead className="w-28"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {group.assignments.map((a) => {
                      const ex = a.exercises as unknown as { id: string; name: string; exercise_type: string } | null;
                      const prof = a.profiles as unknown as { id: string; full_name: string } | null;
                      return (
                        <TableRow key={a.id}>
                          <TableCell className="font-medium">
                            {ex?.name ?? "-"}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {ex?.exercise_type ? typeLabel(ex.exercise_type) : "-"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {prof?.full_name ?? "-"}
                          </TableCell>
                          <TableCell>
                            <Link href={`/assessor/observation/${a.id}`}>
                              <Button size="sm">{t("assessorPortal.grid.observe")}</Button>
                            </Link>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
