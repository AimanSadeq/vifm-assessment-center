export const dynamic = "force-dynamic";

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getServerT, type ServerT } from "@/lib/i18n/server";
import { BackLink } from "@/components/shared/back-link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, ArrowRight, GraduationCap } from "lucide-react";
import type { VifmVertical } from "@/types/database";
import { verticalLabel } from "@/lib/constants/verticals";
import { DeleteCourseButton } from "../_components/delete-course-button";
import { similarity } from "./_components/levenshtein";

type CourseRow = {
  id: string;
  code: string | null;
  title_en: string;
  vertical: VifmVertical;
  level: string;
  default_duration_days: number;
  min_duration_days: number;
  max_duration_days: number;
};

// Pairs above this similarity score surface in the report. 0.85
// catches typos / hyphens / punctuation; below that things start
// looking like distinct courses.
const SIM_THRESHOLD = 0.85;

// Pairs in the same vertical AND with similarity >= STRONG_THRESHOLD
// get the "very likely duplicate" tone. The other matches are
// flagged but presented more cautiously.
const STRONG_THRESHOLD = 0.95;

type Pair = {
  a: CourseRow;
  b: CourseRow;
  similarity: number;
  sameVertical: boolean;
  durationDiff: number;
  rank: "strong" | "likely" | "possible";
};

export default async function DuplicateCoursesPage() {
  const sb = await createClient();
  const t = await getServerT();

  const { data, error } = await sb
    .from("vifm_courses")
    .select(
      "id, code, title_en, vertical, level, default_duration_days, " +
      "min_duration_days, max_duration_days"
    )
    .order("title_en");

  const tableMissing = error?.code === "42P01";
  const courses = (data ?? []) as unknown as CourseRow[];

  // Build candidate pairs. O(n²) - fine for the realistic catalogue
  // size (a few hundred at most). Skip self-pairs and duplicates of
  // the same pair (a,b) and (b,a).
  const pairs: Pair[] = [];
  for (let i = 0; i < courses.length; i++) {
    for (let j = i + 1; j < courses.length; j++) {
      const a = courses[i];
      const b = courses[j];
      const sim = similarity(a.title_en, b.title_en);
      if (sim < SIM_THRESHOLD) continue;
      const sameVertical = a.vertical === b.vertical;
      const durationDiff = Math.abs(a.default_duration_days - b.default_duration_days);
      const rank: Pair["rank"] =
        sim >= STRONG_THRESHOLD && sameVertical
          ? "strong"
          : sim >= STRONG_THRESHOLD || (sameVertical && durationDiff <= 1)
            ? "likely"
            : "possible";
      pairs.push({ a, b, similarity: sim, sameVertical, durationDiff, rank });
    }
  }
  pairs.sort((p, q) => q.similarity - p.similarity);

  const strongCount = pairs.filter((p) => p.rank === "strong").length;
  const likelyCount = pairs.filter((p) => p.rank === "likely").length;
  const possibleCount = pairs.filter((p) => p.rank === "possible").length;

  return (
    <div className="space-y-6">
      <BackLink href="/admin/courses" label={t("adminCourses.backToCourses")} />
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <GraduationCap className="h-6 w-6 text-accent" />
          {t("adminCourses.duplicates.title")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          {t("adminCourses.duplicates.subtitle", {
            pct: Math.round(SIM_THRESHOLD * 100),
          })}
        </p>
      </div>

      {tableMissing && (
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="py-4 text-sm text-amber-900">
            {t("adminCourses.duplicates.migrationMissing")}
          </CardContent>
        </Card>
      )}

      {!tableMissing && courses.length === 0 && (
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">
            {t("adminCourses.duplicates.emptyPre")}
            <Link href="/admin/courses/import" className="ms-1 text-accent hover:underline">
              {t("adminCourses.list.importPdfs")}
            </Link>{" "}{t("adminCourses.duplicates.emptyOr")}{" "}
            <Link href="/admin/courses/new" className="text-accent hover:underline">
              {t("adminCourses.list.newCourse")}
            </Link>{" "}
            {t("adminCourses.duplicates.emptyPost")}
          </CardContent>
        </Card>
      )}

      {!tableMissing && courses.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t("adminCourses.duplicates.scanTitle")}</CardTitle>
            <CardDescription>
              {t("adminCourses.duplicates.scanSummary", {
                courses: courses.length,
                pairs: pairs.length,
                pct: Math.round(SIM_THRESHOLD * 100),
              })}
              {pairs.length > 0 && (
                <>
                  {" "}- <span className="text-rose-700">{t("adminCourses.duplicates.countStrong", { n: strongCount })}</span>,{" "}
                  <span className="text-amber-700">{t("adminCourses.duplicates.countLikely", { n: likelyCount })}</span>,{" "}
                  <span className="text-muted-foreground">{t("adminCourses.duplicates.countPossible", { n: possibleCount })}</span>
                </>
              )}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {pairs.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("adminCourses.duplicates.noPairs", {
                  pct: Math.round(SIM_THRESHOLD * 100),
                })}
              </p>
            ) : (
              <div className="space-y-3">
                {pairs.map((p, i) => (
                  <PairCard key={`${p.a.id}-${p.b.id}-${i}`} pair={p} t={t} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function PairCard({ pair, t }: { pair: Pair; t: ServerT }) {
  const tone =
    pair.rank === "strong"
      ? "border-rose-300 bg-rose-50"
      : pair.rank === "likely"
        ? "border-amber-300 bg-amber-50"
        : "border-muted bg-muted/20";
  const rankLabel =
    pair.rank === "strong"
      ? t("adminCourses.duplicates.rankStrong")
      : pair.rank === "likely"
        ? t("adminCourses.duplicates.rankLikely")
        : t("adminCourses.duplicates.rankPossible");
  const rankToneBadge =
    pair.rank === "strong"
      ? "bg-rose-200 text-rose-900"
      : pair.rank === "likely"
        ? "bg-amber-200 text-amber-900"
        : "bg-muted text-muted-foreground";

  return (
    <div className={`rounded-md border p-3 ${tone}`}>
      <div className="flex items-center gap-2 mb-2">
        <AlertTriangle className="h-3.5 w-3.5" />
        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${rankToneBadge}`}>
          {rankLabel}
        </span>
        <span className="text-[11px] text-muted-foreground tabular-nums">
          {t("adminCourses.duplicates.pairMeta", {
            pct: Math.round(pair.similarity * 100),
            vertical: pair.sameVertical
              ? t("adminCourses.duplicates.sameVertical")
              : t("adminCourses.duplicates.differentVertical"),
            days: pair.durationDiff,
          })}
        </span>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <CourseSlot course={pair.a} t={t} />
        <CourseSlot course={pair.b} t={t} />
      </div>
    </div>
  );
}

function CourseSlot({ course, t }: { course: CourseRow; t: ServerT }) {
  return (
    <div className="rounded-md border bg-card p-2.5 flex items-start justify-between gap-2">
      <div className="min-w-0 flex-1">
        <Link
          href={`/admin/courses/${course.id}`}
          className="text-sm font-medium hover:underline block truncate"
        >
          {course.title_en}
        </Link>
        {course.code && (
          <span className="text-[10px] text-muted-foreground font-mono">{course.code}</span>
        )}
        <div className="flex flex-wrap gap-1 mt-1.5">
          <Badge variant="outline" className="text-[10px]">
            {verticalLabel(t, course.vertical)}
          </Badge>
          <Badge variant="secondary" className="text-[10px] capitalize">
            {course.level}
          </Badge>
          <Badge variant="outline" className="text-[10px] tabular-nums">
            {course.min_duration_days === course.max_duration_days
              ? `${course.default_duration_days}d`
              : `${course.min_duration_days}–${course.max_duration_days}d`}
          </Badge>
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Link
          href={`/admin/courses/${course.id}`}
          aria-label={t("adminCourses.duplicates.openCourse")}
          className="inline-flex items-center justify-center h-7 w-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/40"
        >
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
        <DeleteCourseButton courseId={course.id} title={course.title_en} />
      </div>
    </div>
  );
}
