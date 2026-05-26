import Link from "next/link";
import { Sparkles, GraduationCap, Clock, Globe2, Search } from "lucide-react";
import { createServiceClient } from "@/lib/supabase/server";
import { VifmLogo } from "@/components/shared/vifm-logo";
import { Badge } from "@/components/ui/badge";
import {
  VIFM_VERTICAL_LABELS,
  type VifmCourse,
  type VifmVertical,
  type VifmCourseLevel,
} from "@/types/database";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Training catalogue · VIFM",
  description:
    "Browse VIFM's full training catalogue - finance, AI readiness, leadership, governance and more - and request a tailored quote for any programme.",
};

/**
 * Public training catalogue. The customer-facing entry into VIFM's
 * course library. Anyone (no auth required) can:
 *
 *   - Browse all active courses
 *   - Filter by vertical (Finance, AI, Leadership, etc.) and level
 *   - Click into a course detail page → request-a-quote form
 *
 * Output is read directly from `vifm_courses` via service-role
 * (anonymous reads are safe since these are marketing pages). Only
 * `is_active=true` courses appear.
 */

type CatalogueRow = Pick<
  VifmCourse,
  | "id" | "code" | "title_en" | "vertical" | "level"
  | "default_duration_days" | "min_duration_days" | "max_duration_days"
  | "delivery_modes" | "languages" | "overview_en" | "certification_code"
>;

const LEVELS: VifmCourseLevel[] = ["foundation", "intermediate", "advanced"];

export default async function CoursesCataloguePage({
  searchParams,
}: {
  searchParams?: { vertical?: string; level?: string };
}) {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from("vifm_courses")
    .select(
      "id, code, title_en, vertical, level, default_duration_days, min_duration_days, max_duration_days, delivery_modes, languages, overview_en, certification_code"
    )
    .eq("is_active", true)
    .order("vertical")
    .order("title_en")
    .returns<CatalogueRow[]>();

  if (error) {
    return (
      <Shell>
        <p className="text-sm text-rose-700">
          Catalogue temporarily unavailable. Please try again shortly.
        </p>
      </Shell>
    );
  }

  // Filter client-side based on URL params (server component, no JS needed).
  const filterVertical = (searchParams?.vertical ?? "").toLowerCase();
  const filterLevel = (searchParams?.level ?? "").toLowerCase();

  const courses = (data ?? []).filter((c) => {
    if (filterVertical && c.vertical !== filterVertical) return false;
    if (filterLevel && c.level !== filterLevel) return false;
    return true;
  });

  // Group by vertical for the visual "section" layout
  const byVertical = new Map<VifmVertical, CatalogueRow[]>();
  for (const c of courses) {
    const arr = byVertical.get(c.vertical) ?? [];
    arr.push(c);
    byVertical.set(c.vertical, arr);
  }

  const totalCount = courses.length;
  const verticals = Array.from(new Set((data ?? []).map((c) => c.vertical))).sort();

  return (
    <Shell>
      <section className="ara-hero relative overflow-hidden">
        <div className="max-w-6xl mx-auto px-6 pt-12 pb-16">
          <span className="ara-eyebrow text-accent inline-flex items-center gap-1.5">
            <Sparkles className="h-3 w-3" />
            VIFM training catalogue
          </span>
          <h1 className="text-4xl sm:text-5xl font-semibold text-white leading-[1.05] mt-4 mb-4 max-w-2xl">
            Browse the full programme library.
          </h1>
          <p className="text-lg text-white/75 max-w-2xl leading-relaxed">
            {totalCount} active programme{totalCount === 1 ? "" : "s"} across
            finance, AI readiness, leadership, governance and more - built for
            professional teams in the GCC. Pick any programme to see the full
            outline and request a tailored quote.
          </p>
        </div>
      </section>

      {/* Filter bar */}
      <section className="border-b bg-card/80 backdrop-blur sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-6 py-3 flex flex-wrap items-center gap-3">
          <span className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">
            Filter
          </span>
          {/* Vertical filter chips */}
          <FilterChip
            href={withParams(searchParams, { vertical: undefined, level: filterLevel || undefined })}
            label="All verticals"
            active={!filterVertical}
          />
          {verticals.map((v) => (
            <FilterChip
              key={v}
              href={withParams(searchParams, { vertical: v, level: filterLevel || undefined })}
              label={VIFM_VERTICAL_LABELS[v as VifmVertical] ?? v}
              active={filterVertical === v}
            />
          ))}
          <span className="mx-2 h-4 w-px bg-border" />
          <FilterChip
            href={withParams(searchParams, { level: undefined, vertical: filterVertical || undefined })}
            label="All levels"
            active={!filterLevel}
          />
          {LEVELS.map((lv) => (
            <FilterChip
              key={lv}
              href={withParams(searchParams, { level: lv, vertical: filterVertical || undefined })}
              label={lv.charAt(0).toUpperCase() + lv.slice(1)}
              active={filterLevel === lv}
            />
          ))}
        </div>
      </section>

      {/* Course cards grouped by vertical */}
      <section className="max-w-6xl mx-auto px-6 py-12">
        {totalCount === 0 ? (
          <div className="rounded-lg border border-dashed p-12 text-center">
            <Search className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              No programmes match the current filters. Clear filters to browse the full catalogue.
            </p>
          </div>
        ) : (
          Array.from(byVertical.entries()).map(([vertical, list]) => (
            <div key={vertical} className="mb-12">
              <h2 className="text-2xl font-semibold text-primary mb-1">
                {VIFM_VERTICAL_LABELS[vertical] ?? vertical}
              </h2>
              <p className="text-xs text-muted-foreground mb-5">
                {list.length} programme{list.length === 1 ? "" : "s"}
              </p>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {list.map((c) => (
                  <CourseCard key={c.id} course={c} />
                ))}
              </div>
            </div>
          ))
        )}
      </section>

      {/* Footer CTA */}
      <section className="border-t bg-muted/30">
        <div className="max-w-4xl mx-auto px-6 py-12 text-center">
          <h2 className="text-2xl font-semibold text-primary mb-2">
            Don&apos;t see what you need?
          </h2>
          <p className="text-sm text-muted-foreground max-w-xl mx-auto mb-5">
            VIFM also runs bespoke programmes - custom-built around your team&apos;s
            specific competencies and outcomes. Get in touch for a scoped proposal.
          </p>
          <Link
            href="mailto:contact@viftraining.com?subject=Bespoke%20programme%20enquiry"
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white hover:bg-accent/90 transition-colors"
          >
            Talk to a VIFM programme designer
          </Link>
        </div>
      </section>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/80 backdrop-blur sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <VifmLogo variant="color" size="sm" />
            <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.15em] text-muted-foreground font-medium border-l ps-3 ms-1">
              <GraduationCap className="h-3 w-3 text-accent" />
              Training catalogue
            </span>
          </Link>
          <Link
            href="/ara/engage"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
          >
            AI Readiness Compass →
          </Link>
        </div>
      </header>
      {children}
    </div>
  );
}

function FilterChip({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
        active
          ? "bg-accent text-white border-accent"
          : "bg-card hover:bg-muted border-input"
      }`}
    >
      {label}
    </Link>
  );
}

function CourseCard({ course }: { course: CatalogueRow }) {
  const durationLabel =
    course.min_duration_days === course.max_duration_days
      ? `${course.default_duration_days}d`
      : `${course.min_duration_days}–${course.max_duration_days}d`;
  const overviewSnippet = course.overview_en
    ? course.overview_en.length > 200
      ? course.overview_en.slice(0, 200).trimEnd() + "…"
      : course.overview_en
    : "Detailed outline available on the programme page.";
  const href = `/courses/${course.code ?? course.id}`;

  return (
    <Link
      href={href}
      className="group block rounded-lg border bg-card p-5 hover:border-accent/50 hover:shadow-sm transition-all"
    >
      <div className="flex items-center gap-2 mb-2 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
        {course.code && <span className="font-mono normal-case tracking-normal">{course.code}</span>}
        {course.code && <span>·</span>}
        <span>{course.level}</span>
      </div>
      <h3 className="text-base font-semibold text-primary group-hover:text-accent transition-colors leading-snug mb-2">
        {course.title_en}
      </h3>
      <p className="text-xs text-muted-foreground leading-snug mb-4 line-clamp-3">
        {overviewSnippet}
      </p>
      <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {durationLabel}
        </span>
        {course.languages && course.languages.length > 0 && (
          <span className="inline-flex items-center gap-1">
            <Globe2 className="h-3 w-3" />
            {course.languages.map((l) => l.toUpperCase()).join(" · ")}
          </span>
        )}
        {course.certification_code && (
          <Badge variant="outline" className="text-[9px] py-0 px-1.5 font-mono">
            {course.certification_code}
          </Badge>
        )}
      </div>
    </Link>
  );
}

function withParams(
  current: { vertical?: string; level?: string } | undefined,
  patch: Partial<Record<string, string | undefined>>
): string {
  const params = new URLSearchParams();
  const merged: Record<string, string | undefined> = { ...(current ?? {}), ...patch };
  for (const [k, v] of Object.entries(merged)) {
    if (v) params.set(k, v);
  }
  const qs = params.toString();
  return qs ? `/courses?${qs}` : "/courses";
}
