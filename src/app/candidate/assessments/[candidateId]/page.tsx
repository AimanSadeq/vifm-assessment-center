export const dynamic = "force-dynamic";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
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
  const supabase = await createClient();
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
          {eng.name} - {eng.start_date ?? "TBD"} to {eng.end_date ?? "TBD"}
        </p>
      </div>

      {/* Assessment Journey Tiles */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Your Assessment Journey</h2>
        {exercises.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center">
            <p className="text-sm text-muted-foreground">
              No exercises scheduled yet. Check back closer to your assessment date.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {exercises.map((ex, index) => {
              // Sequential unlock: first is always available, rest depend on previous
              const isAvailable = index === 0;
              const isLocked = index > 0;

              return (
                <Card
                  key={ex.name}
                  className={`relative transition-all ${
                    isLocked ? "opacity-60" : "hover:shadow-md"
                  }`}
                >
                  {/* Step number */}
                  <div className="absolute top-3 right-3">
                    <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold ${
                      isAvailable
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}>
                      {index + 1}
                    </div>
                  </div>

                  <CardHeader className="pb-2 pr-12">
                    <CardTitle className="text-base">{ex.name}</CardTitle>
                    <Badge variant="outline" className="w-fit text-xs">
                      {EXERCISE_TYPE_LABELS[ex.exercise_type] ?? ex.exercise_type}
                    </Badge>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {ex.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {ex.description}
                      </p>
                    )}
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      {ex.duration_minutes && (
                        <span>{ex.duration_minutes} min</span>
                      )}
                      {ex.scheduled_date && (
                        <span>{ex.scheduled_date}</span>
                      )}
                    </div>

                    {/* Status indicator */}
                    <div className="pt-1">
                      {isAvailable ? (
                        <Badge variant="default" className="text-xs">Available</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">
                          Locked - Complete previous assessment first
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

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
            record observations. There are no right or wrong answers - the
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
