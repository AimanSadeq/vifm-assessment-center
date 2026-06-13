import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { getServerT } from "@/lib/i18n/server";
import { Clock, FileText } from "lucide-react";
import { BackLink } from "@/components/shared/back-link";

export default async function ExercisesPage() {
  const supabase = await createClient();
  const t = await getServerT();
  const typeLabel = (k: string) => {
    const v = t(`exercise.types.${k}`);
    return v.startsWith("exercise.types.") ? k : v;
  };

  const { data: exercises } = await supabase
    .from("exercises")
    .select("*")
    .order("name");

  return (
    <div>
      <BackLink href="/admin" label="Back" history />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("exercise.libTitle")}</h1>
          <p className="mt-1 text-muted-foreground">
            {t("exercise.libIntro")}
          </p>
        </div>
      </div>

      <div className="mt-6">
        {(!exercises || exercises.length === 0) ? (
          <div className="rounded-lg border border-dashed p-12 text-center">
            <p className="text-muted-foreground">{t("exercise.libEmptyTitle")}</p>
            <p className="text-sm text-muted-foreground mt-1">
              {t("exercise.libEmptyBody")}
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("exercise.thName")}</TableHead>
                <TableHead>{t("exercise.thType")}</TableHead>
                <TableHead>{t("exercise.duration")}</TableHead>
                <TableHead>{t("exercise.thBriefing")}</TableHead>
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
                        {typeLabel(ex.exercise_type)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Clock className="h-3.5 w-3.5" />
                        {ex.duration_minutes ? `${ex.duration_minutes} ${t("exercise.minShort")}` : "-"}
                        {hasTiming && (
                          <span className="text-[10px] text-accent ml-1">{t("exercise.detailed")}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {hasBrief ? (
                        <Badge variant="secondary" className="gap-1 text-[10px]">
                          <FileText className="h-3 w-3" /> {t("exercise.configured")}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">{t("exercise.notSet")}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Link href={`/admin/exercises/${ex.id}`}>
                        <Button size="sm" variant="outline">{t("exercise.edit")}</Button>
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
