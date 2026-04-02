import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/server";
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
import { EXERCISE_TYPE_LABELS } from "@/lib/constants/exercise-types";

type Props = { params: { candidateId: string } };

export default async function CandidateAssessmentsPage({ params }: Props) {
  const supabase = createServiceClient();
  const { candidateId } = params;

  const [candResult, assignResult] = await Promise.all([
    supabase
      .from("candidates")
      .select("id, full_name, engagement_id, engagements(name, start_date, end_date)")
      .eq("id", candidateId)
      .single(),
    supabase
      .from("assessor_assignments")
      .select("id, exercise_id, exercises(name, exercise_type, duration_minutes, description)")
      .eq("candidate_id", candidateId),
  ]);

  if (candResult.error || !candResult.data) return notFound();

  const candidate = candResult.data;
  const eng = candidate.engagements as unknown as {
    name: string;
    start_date: string | null;
    end_date: string | null;
  };
  const assignments = assignResult.data ?? [];

  // Fetch scheduled dates from engagement_exercises
  const { data: engExercises } = await supabase
    .from("engagement_exercises")
    .select("exercise_id, scheduled_date")
    .eq("engagement_id", candidate.engagement_id);

  const scheduledMap = new Map<string, string>();
  for (const ee of engExercises ?? []) {
    if (ee.scheduled_date) scheduledMap.set(ee.exercise_id, ee.scheduled_date);
  }

  // Deduplicate exercises
  const exerciseMap = new Map<string, { name: string; exercise_type: string; duration_minutes: number | null; description: string | null; scheduled_date: string | null }>();
  for (const a of assignments) {
    const ex = a.exercises as unknown as { name: string; exercise_type: string; duration_minutes: number | null; description: string | null };
    if (ex && !exerciseMap.has(ex.name)) {
      exerciseMap.set(ex.name, { ...ex, scheduled_date: scheduledMap.get(a.exercise_id) ?? null });
    }
  }
  const exercises = Array.from(exerciseMap.values());

  return (
    <div className="space-y-6">
      <div>
        <BackLink href={`/candidate/welcome/${candidateId}`} label="Back to Welcome" />
        <h1 className="mt-2 text-2xl font-bold">Your Assessments</h1>
        <p className="text-sm text-muted-foreground">
          {eng.name} — {eng.start_date ?? "TBD"} to {eng.end_date ?? "TBD"}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Exercise Schedule</CardTitle>
        </CardHeader>
        <CardContent>
          {exercises.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No exercises scheduled yet. Check back closer to your assessment date.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Exercise</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Scheduled</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {exercises.map((ex) => (
                  <TableRow key={ex.name}>
                    <TableCell>
                      <div>
                        <span className="font-medium">{ex.name}</span>
                        {ex.description && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {ex.description}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {EXERCISE_TYPE_LABELS[ex.exercise_type] ?? ex.exercise_type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {ex.duration_minutes ? `${ex.duration_minutes} min` : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {ex.scheduled_date ?? "TBD"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Important Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            Each exercise is designed to assess specific competencies relevant to
            the target role. Please arrive prepared and on time for each session.
          </p>
          <p>
            During the exercises, trained assessors will observe your behavior and
            record observations. There are no right or wrong answers — the
            assessment evaluates how you approach situations naturally.
          </p>
          <p>
            Your results will be compiled into a confidential assessment report,
            which will be shared with you once finalized.
          </p>
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Link href={`/candidate/report/${candidateId}`}>
          <Button variant="outline">View Report</Button>
        </Link>
      </div>
    </div>
  );
}
