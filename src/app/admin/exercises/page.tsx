import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { EXERCISE_TYPE_LABELS } from "@/lib/constants/exercise-types";
import { Clock, FileText } from "lucide-react";

export default async function ExercisesPage() {
  const supabase = createServiceClient();

  const { data: exercises } = await supabase
    .from("exercises")
    .select("*")
    .order("name");

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Exercise Library</h1>
          <p className="mt-1 text-muted-foreground">
            Manage exercises, briefing content, timing, and role player guides.
          </p>
        </div>
      </div>

      <div className="mt-6">
        {(!exercises || exercises.length === 0) ? (
          <div className="rounded-lg border border-dashed p-12 text-center">
            <p className="text-muted-foreground">No exercises in the library yet.</p>
            <p className="text-sm text-muted-foreground mt-1">
              Exercises are created when building engagements.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Briefing</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {exercises.map((ex) => {
                const hasBrief = ex.participant_brief || ex.scenario_context;
                const hasTiming = ex.prep_minutes || ex.meeting_minutes;
                return (
                  <TableRow key={ex.id}>
                    <TableCell className="font-medium">
                      <Link href={`/admin/exercises/${ex.id}`} className="hover:underline">
                        {ex.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {EXERCISE_TYPE_LABELS[ex.exercise_type] ?? ex.exercise_type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Clock className="h-3.5 w-3.5" />
                        {ex.duration_minutes ? `${ex.duration_minutes} min` : "—"}
                        {hasTiming && (
                          <span className="text-[10px] text-accent ml-1">(detailed)</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {hasBrief ? (
                        <Badge variant="secondary" className="gap-1 text-[10px]">
                          <FileText className="h-3 w-3" /> Configured
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">Not set</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Link href={`/admin/exercises/${ex.id}`}>
                        <Button size="sm" variant="outline">Edit</Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
