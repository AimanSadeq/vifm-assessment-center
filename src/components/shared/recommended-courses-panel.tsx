import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GraduationCap, ArrowRight } from "lucide-react";
import { verticalLabel } from "@/lib/constants/verticals";
import { getServerT, getServerLocale, getServerDir } from "@/lib/i18n/server";
import type { RecommendedCourse } from "@/lib/recommender/courses";
import { HIGH_FIT_THRESHOLD } from "@/lib/recommender/courses";
import { formatFitScore, fitScoreOutOfTen } from "@/lib/recommender/format";

type Props = {
  title: string;
  description: string;
  emptyMessage?: string;
  courses: RecommendedCourse[];
  /**
   * "ac" - driver labels are AC behavioural competencies (e.g. Strategic Thinking).
   * "ara" - driver labels are ARA pillars (e.g. Strategy, Governance).
   * Used purely for the chip styling; both shapes render the same.
   */
  context: "ac" | "ara";
};

/**
 * Server component - renders a ranked list of VIFM training programmes
 * sourced from the recommender. Used both on the AC engagement detail
 * (consultant-facing development plan) and the ARA assessment detail
 * (consultant-facing capability building plan). Same shape, different
 * driver-chip tinting so the consultant sees at a glance whether a
 * recommendation came from a behavioural gap or a pillar gap.
 *
 * Each card shows: title (en + ar), vertical/level/duration badges,
 * total fit score (★ for high-fit), and the drivers - competencies or
 * pillars - that pulled this course into the list, with their gap
 * size and the AI/admin-authored rationale per tag.
 */
export async function RecommendedCoursesPanel({
  title,
  description,
  emptyMessage,
  courses,
  context,
}: Props) {
  const t = await getServerT();
  const rtl = getServerDir(await getServerLocale()) === "rtl";
  if (courses.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <GraduationCap className="h-4 w-4 text-accent" />
            {title}
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {emptyMessage ?? "No recommendations yet - either no gaps were detected against the catalogue's mappings, or the catalogue doesn't yet cover the relevant competencies / pillars."}
          </p>
        </CardContent>
      </Card>
    );
  }

  // Top match = 100%; the rest are shown relative to it (display only - the
  // ranking and the ★ High-fit badge still use the raw fit score).
  const topScore = Math.max(0, ...courses.map((c) => c.total_score));

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <GraduationCap className="h-4 w-4 text-accent" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* How-fit explainer - without this, "fit score 28" and chips
            like "gap 2 · ×3" are opaque numbers. The math is small
            (gap × relevance, summed), so the cost of a one-line
            caption is cheap and the user trust gain is large. */}
        <div className="rounded-md bg-muted/40 border border-border/60 px-3 py-2 text-[11px] text-muted-foreground leading-relaxed">
          <p>
            <span className="font-semibold text-foreground">How to read these</span> -
            {" "}each chip is one match between a course and a factor where you&apos;re
            below the target of 4 / 5. The notation
            {" "}<span className="font-mono text-foreground">gap N · ×R</span>{" "}
            means your gap to target ({" "}<span className="font-mono">N</span>{" "})
            multiplied by how strongly the course is tagged to that factor&apos;s
            competencies (relevance {" "}<span className="font-mono">×1</span>{" "}light,
            {" "}<span className="font-mono">×2</span>{" "}medium,
            {" "}<span className="font-mono">×3</span>{" "}strong). The
            {" "}<span className="font-semibold text-foreground">fit score</span>{" "}
            is out of 10 - your strongest-matched programme scores 10, the rest relative to it.
            {" "}<span className="font-semibold text-foreground">★ High fit</span>{" "}
            marks the programmes that close the most, highest-priority gaps.
          </p>
        </div>
        {courses.map((c) => {
          const isHighFit = c.total_score >= HIGH_FIT_THRESHOLD;
          return (
            <Link
              key={c.course_id}
              href={`/admin/courses/${c.course_id}`}
              className="block rounded-md border bg-card hover:bg-muted/40 transition-colors p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold">{c.title_en}</p>
                    {c.course_code && (
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {c.course_code}
                      </span>
                    )}
                    {isHighFit && (
                      <Badge className="bg-amber-100 text-amber-900 hover:bg-amber-100 text-[10px] gap-1">
                        ★ High fit
                      </Badge>
                    )}
                  </div>
                  {c.title_ar && (
                    <p className="text-xs text-muted-foreground mt-0.5" dir="rtl">
                      {c.title_ar}
                    </p>
                  )}

                  {/* Drivers */}
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {c.drivers.map((d, i) => (
                      <span
                        key={`${d.kind}-${d.label}-${i}`}
                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] ${
                          context === "ara" || d.kind === "pillar"
                            ? "bg-violet-50 border-violet-200 text-violet-900"
                            : "bg-blue-50 border-blue-200 text-blue-900"
                        }`}
                        title={d.rationale ?? undefined}
                      >
                        <span className="font-medium">{rtl ? (d.label_ar || d.label) : d.label}</span>
                        <span className="opacity-70 tabular-nums">
                          gap {formatFitScore(d.gap)} · ×{d.relevance}
                        </span>
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className="text-[10px] text-muted-foreground tabular-nums">
                    fit score
                  </span>
                  <span className="text-base font-bold tabular-nums">
                    {fitScoreOutOfTen(c.total_score, topScore)}
                  </span>
                </div>
              </div>

              <div className="mt-2 flex items-center justify-between gap-3">
                <div className="flex flex-wrap gap-1">
                  <Badge variant="outline" className="text-[10px]">
                    {verticalLabel(t, c.vertical)}
                  </Badge>
                  <Badge variant="secondary" className="text-[10px] capitalize">
                    {c.level}
                  </Badge>
                  <Badge variant="outline" className="text-[10px] tabular-nums">
                    {c.min_duration_days === c.max_duration_days
                      ? `${c.default_duration_days}d`
                      : `${c.min_duration_days}–${c.max_duration_days}d`}
                  </Badge>
                </div>
                <span className="inline-flex items-center gap-1 text-[10px] text-accent">
                  Open course <ArrowRight className="h-3 w-3" />
                </span>
              </div>
            </Link>
          );
        })}
      </CardContent>
    </Card>
  );
}
