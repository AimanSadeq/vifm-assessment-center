import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
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
import { EXERCISE_TYPE_LABELS } from "@/lib/constants/exercise-types";

type Props = {
  params: { engagementId: string };
};

export default async function AssessorAssignmentGridPage({ params }: Props) {
  const supabase = await createClient();
  const { engagementId } = params;

  const [engResult, assignResult] = await Promise.all([
    supabase.from("engagements").select("id, name, organizations(name)").eq("id", engagementId).single(),
    // RLS automatically filters to the logged-in assessor's assignments
    supabase
      .from("assessor_assignments")
      .select("id, candidate_id, exercise_id, candidates(id, full_name), exercises(id, name, exercise_type), profiles(id, full_name)")
      .eq("engagement_id", engagementId),
  ]);

  if (engResult.error || !engResult.data) return notFound();

  const engagement = engResult.data;
  const assignments = assignResult.data ?? [];

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
        <BackLink href="/assessor/assignments" label="Back to Engagements" />
        <h1 className="mt-2 text-2xl font-bold">{engagement.name}</h1>
        <p className="text-sm text-muted-foreground">{orgName}</p>
      </div>

      {candidateMap.size === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-muted-foreground">No assignments for this engagement yet.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Array.from(candidateMap.values()).map((group) => (
            <Card key={group.candidateId}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{group.candidateName}</CardTitle>
                  <Link href={`/assessor/integration/${engagementId}/${group.candidateId}`}>
                    <Button variant="outline" size="sm">
                      Integration Worksheet
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Exercise</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Assessor</TableHead>
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
                            {ex?.name ?? "—"}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {EXERCISE_TYPE_LABELS[ex?.exercise_type ?? ""] ?? ex?.exercise_type}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {prof?.full_name ?? "—"}
                          </TableCell>
                          <TableCell>
                            <Link href={`/assessor/observation/${a.id}`}>
                              <Button size="sm">Observe</Button>
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
