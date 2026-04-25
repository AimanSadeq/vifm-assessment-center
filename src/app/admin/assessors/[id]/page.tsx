import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { BackLink } from "@/components/shared/back-link";
import { AssessorUtilizationChart } from "./_components/assessor-utilization-chart";

const ROLE_LABELS: Record<string, string> = {
  lead_assessor: "Lead Assessor",
  associate_assessor: "Associate Assessor",
};

export default async function AssessorDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = await createClient();

  const { data: assessor } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, phone")
    .eq("id", params.id)
    .single();

  if (!assessor) notFound();

  // Get assignments with engagement + exercise + candidate details
  const { data: assignments } = await supabase
    .from("assessor_assignments")
    .select("id, engagement_id, engagements(name, status), candidates(full_name), exercises(name, exercise_type)")
    .eq("assessor_id", params.id);

  // Get ratings count
  const { data: ratings } = await supabase
    .from("ratings")
    .select("id, assessor_assignment_id")
    .in("assessor_assignment_id", (assignments ?? []).map((a) => a.id));

  // Get observations count
  const { data: observations } = await supabase
    .from("observations")
    .select("id, assessor_assignment_id")
    .in("assessor_assignment_id", (assignments ?? []).map((a) => a.id));

  // Build utilization data: assignments per engagement
  const engMap = new Map<string, { name: string; count: number }>();
  (assignments ?? []).forEach((a) => {
    const eng = a.engagements as { name: string; status: string } | null;
    if (eng) {
      const existing = engMap.get(a.engagement_id);
      if (existing) {
        existing.count++;
      } else {
        engMap.set(a.engagement_id, { name: eng.name, count: 1 });
      }
    }
  });

  const utilizationData = Array.from(engMap.values()).map((e) => ({
    name: e.name.length > 25 ? e.name.slice(0, 25) + "..." : e.name,
    assignments: e.count,
  }));

  return (
    <div className="space-y-6">
      <BackLink href="/admin/assessors" label="Back to Assessors" />

      {/* Profile header */}
      <div>
        <h1 className="text-2xl font-bold">{assessor.full_name}</h1>
        <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
          <span>{assessor.email}</span>
          {assessor.phone && <span>{assessor.phone}</span>}
          <Badge variant="outline">{ROLE_LABELS[assessor.role] ?? assessor.role}</Badge>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Assignments</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{assignments?.length ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Observations</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{observations?.length ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Ratings</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{ratings?.length ?? 0}</p>
          </CardContent>
        </Card>
      </div>

      {/* Resource utilization chart */}
      {utilizationData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Resource Utilization by Project</CardTitle>
          </CardHeader>
          <CardContent>
            <AssessorUtilizationChart data={utilizationData} />
          </CardContent>
        </Card>
      )}

      {/* Assignment history */}
      <Card>
        <CardHeader>
          <CardTitle>Assignment History</CardTitle>
        </CardHeader>
        <CardContent>
          {(!assignments || assignments.length === 0) ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No assignments yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Project</TableHead>
                  <TableHead>Candidate</TableHead>
                  <TableHead>Exercise</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assignments.map((a) => {
                  const eng = a.engagements as { name: string; status: string } | null;
                  const cand = a.candidates as { full_name: string } | null;
                  const ex = a.exercises as { name: string; exercise_type: string } | null;
                  return (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">{eng?.name ?? "-"}</TableCell>
                      <TableCell>{cand?.full_name ?? "-"}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{ex?.name ?? "-"}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{eng?.status ?? "-"}</Badge>
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
