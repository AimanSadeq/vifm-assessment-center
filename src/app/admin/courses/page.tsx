export const dynamic = "force-dynamic";

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Plus, GraduationCap, Sparkles, Copy } from "lucide-react";
import {
  VIFM_VERTICAL_LABELS,
  type VifmCourse,
  type VifmVertical,
} from "@/types/database";
import { DeleteCourseButton } from "./_components/delete-course-button";

type CourseRow = Pick<
  VifmCourse,
  "id" | "code" | "title_en" | "title_ar" | "vertical" | "level"
  | "default_duration_days" | "min_duration_days" | "max_duration_days"
  | "certification_code" | "is_active" | "updated_at"
>;

export default async function CoursesListPage() {
  const sb = await createClient();
  const { data, error } = await sb
    .from("vifm_courses")
    .select(
      "id, code, title_en, title_ar, vertical, level, " +
      "default_duration_days, min_duration_days, max_duration_days, " +
      "certification_code, is_active, updated_at"
    )
    .order("vertical", { ascending: true })
    .order("title_en", { ascending: true });

  // Tolerate the table not existing yet (migration 00023 not applied)
  const tableMissing = error?.code === "42P01";
  const courses = (data ?? []) as unknown as CourseRow[];

  // Group by vertical for the summary tally
  const tally: Partial<Record<VifmVertical, number>> = {};
  for (const c of courses) {
    tally[c.vertical] = (tally[c.vertical] ?? 0) + 1;
  }
  const verticalsCovered = Object.keys(tally).length;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <GraduationCap className="h-6 w-6 text-accent" />
            Training Courses
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            VIFM&apos;s course catalogue. Each course maps to AC behavioural
            competencies and ARA pillars so the recommender can surface the
            right development path for each diagnostic.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/courses/duplicates">
            <Button variant="outline" className="gap-2">
              <Copy className="h-4 w-4" />
              Find duplicates
            </Button>
          </Link>
          <Link href="/admin/courses/import">
            <Button variant="outline" className="gap-2">
              <Sparkles className="h-4 w-4" />
              Import PDFs
            </Button>
          </Link>
          <Link href="/admin/courses/new">
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              New course
            </Button>
          </Link>
        </div>
      </div>

      {tableMissing && (
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="py-4 text-sm text-amber-900">
            <strong>Migration 00023 not yet applied.</strong> Run{" "}
            <code className="bg-amber-100 px-1 py-0.5 rounded text-xs">
              supabase db push
            </code>{" "}
            (or paste{" "}
            <code className="bg-amber-100 px-1 py-0.5 rounded text-xs">
              supabase/migrations/00023_vifm_courses.sql
            </code>{" "}
            into the SQL editor) to create the catalogue tables. The page will
            populate once the migration is in place.
          </CardContent>
        </Card>
      )}

      {/* Top-line tally */}
      {!tableMissing && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Catalogue at a glance</CardTitle>
          </CardHeader>
          <CardContent>
            {courses.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No courses yet. Use <strong>Import PDFs</strong> to ingest
                course outlines in bulk via AI extraction, or <strong>New
                course</strong> to add one manually.
              </p>
            ) : (
              <div className="flex flex-wrap items-baseline gap-3 text-sm">
                <span className="text-2xl font-bold tabular-nums">{courses.length}</span>
                <span className="text-muted-foreground">
                  course{courses.length === 1 ? "" : "s"} across {verticalsCovered} of 14
                  verticals
                </span>
                <div className="flex flex-wrap gap-1.5 ms-2">
                  {(Object.keys(VIFM_VERTICAL_LABELS) as VifmVertical[]).map((v) => {
                    const count = tally[v] ?? 0;
                    if (count === 0) return null;
                    return (
                      <Badge key={v} variant="secondary" className="text-[11px] tabular-nums">
                        {VIFM_VERTICAL_LABELS[v]} · {count}
                      </Badge>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Course table */}
      {!tableMissing && courses.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Vertical</TableHead>
                  <TableHead>Level</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {courses.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <Link
                        href={`/admin/courses/${c.id}`}
                        className="font-medium hover:underline"
                      >
                        {c.title_en}
                      </Link>
                      {c.code && (
                        <span className="ms-2 text-[11px] text-muted-foreground font-mono">
                          {c.code}
                        </span>
                      )}
                      {c.title_ar && (
                        <p className="text-xs text-muted-foreground mt-0.5" dir="rtl">
                          {c.title_ar}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[11px]">
                        {VIFM_VERTICAL_LABELS[c.vertical] ?? c.vertical}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs capitalize">{c.level}</span>
                    </TableCell>
                    <TableCell className="text-xs tabular-nums">
                      {c.min_duration_days === c.max_duration_days
                        ? `${c.default_duration_days}d`
                        : `${c.min_duration_days}-${c.max_duration_days}d (default ${c.default_duration_days}d)`}
                    </TableCell>
                    <TableCell>
                      {c.is_active ? (
                        <Badge className="bg-emerald-600 hover:bg-emerald-600 text-[11px]">
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[11px]">
                          Hidden
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right pr-2">
                      <DeleteCourseButton courseId={c.id} title={c.title_en} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
