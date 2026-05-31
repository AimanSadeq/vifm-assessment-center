import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Sparkles, GraduationCap, Clock, Globe2, ArrowRight, ArrowLeft,
  Users, Target, Compass, BookOpen, Award, FileText,
} from "lucide-react";
import { createServiceClient } from "@/lib/supabase/server";
import { getServerT } from "@/lib/i18n/server";
import { VifmLogo } from "@/components/shared/vifm-logo";
import { Badge } from "@/components/ui/badge";
import { type VifmCourse } from "@/types/database";
import { verticalLabel } from "@/lib/constants/verticals";

export const dynamic = "force-dynamic";

/**
 * Public course detail page. Lookup by `code` (preferred - readable
 * URL like /courses/CPMA-AI) or by uuid (fallback for legacy links).
 *
 * Renders the seven course "blocks":
 *   1. Course Overview
 *   2. Target Competencies
 *   3. Course Objectives
 *   4. Target Audience
 *   5. Course Methodology
 *   6. Course Outline
 *   7. Note (admin annotation)
 *
 * Plus a sticky CTA panel at the bottom and an "About this programme"
 * sidebar with the at-a-glance facts (duration band, levels, languages,
 * certification code).
 *
 * The big "Request a quote" button routes to /courses/[code]/request-quote.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type CourseDetailRow = VifmCourse;

export default async function CourseDetailPage({
  params,
}: {
  params: { code: string };
}) {
  const t = await getServerT();
  const sb = createServiceClient();
  const lookup = UUID_RE.test(params.code)
    ? sb.from("vifm_courses").select("*").eq("id", params.code).maybeSingle<CourseDetailRow>()
    : sb.from("vifm_courses").select("*").eq("code", params.code).maybeSingle<CourseDetailRow>();
  const { data: course } = await lookup;
  if (!course || !course.is_active) return notFound();

  const durationLabel =
    course.min_duration_days === course.max_duration_days
      ? t(
          course.default_duration_days === 1
            ? "coursesPublic.durationDays_one"
            : "coursesPublic.durationDays_other",
          { count: course.default_duration_days }
        )
      : t("coursesPublic.durationRange", {
          min: course.min_duration_days,
          max: course.max_duration_days,
        });

  const requestQuoteHref = `/courses/${course.code ?? course.id}/request-quote`;

  return (
    <div className="min-h-screen bg-background">
      {/* Top nav */}
      <header className="border-b bg-card/80 backdrop-blur sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <VifmLogo variant="color" size="sm" />
            <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.15em] text-muted-foreground font-medium border-l ps-3 ms-1">
              <GraduationCap className="h-3 w-3 text-accent" />
              {t("coursesPublic.navTrainingCatalogue")}
            </span>
          </Link>
          <Link
            href="/courses"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
          >
            <ArrowLeft className="h-3 w-3" /> {t("coursesPublic.backToCatalogue")}
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="ara-hero relative overflow-hidden">
        <div className="max-w-6xl mx-auto px-6 pt-12 pb-14">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <Badge variant="secondary" className="text-[10px] uppercase tracking-widest">
              {verticalLabel(t, course.vertical)}
            </Badge>
            <Badge variant="outline" className="text-[10px] uppercase tracking-widest text-white/70 border-white/20">
              {t(`coursesPublic.level.${course.level}`)}
            </Badge>
            {course.certification_code && (
              <Badge variant="outline" className="text-[10px] font-mono text-white/70 border-white/20">
                {course.certification_code}
              </Badge>
            )}
          </div>
          <h1 className="text-3xl sm:text-4xl font-semibold text-white leading-[1.1] mb-4 max-w-3xl">
            {course.title_en}
          </h1>
          {course.title_ar && (
            <p className="text-lg text-white/70 max-w-3xl mb-4" dir="rtl">{course.title_ar}</p>
          )}
          <div className="flex flex-wrap items-center gap-4 text-sm text-white/80">
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-4 w-4" /> {durationLabel}
            </span>
            {course.languages && course.languages.length > 0 && (
              <span className="inline-flex items-center gap-1.5">
                <Globe2 className="h-4 w-4" />
                {course.languages.map((l) => l.toUpperCase()).join(" · ")}
              </span>
            )}
            {course.delivery_modes && course.delivery_modes.length > 0 && (
              <span className="inline-flex items-center gap-1.5">
                <Sparkles className="h-4 w-4" />
                {course.delivery_modes.join(" · ")}
              </span>
            )}
          </div>
        </div>
      </section>

      {/* Body - content + sidebar */}
      <section className="max-w-6xl mx-auto px-6 py-10 grid gap-8 lg:grid-cols-[1fr_320px]">
        <article className="space-y-8 order-2 lg:order-1">
          {/* Block 1 - Course Overview */}
          {course.overview_en && (
            <Block icon={Compass} title={t("coursesPublic.blockOverview")}>
              <p className="leading-relaxed">{course.overview_en}</p>
              {course.overview_ar && (
                <p className="mt-3 leading-relaxed text-muted-foreground" dir="rtl">{course.overview_ar}</p>
              )}
            </Block>
          )}

          {/* Block 4 - Target audience */}
          {course.audience_en && (
            <Block icon={Users} title={t("coursesPublic.blockAudience")}>
              <p className="leading-relaxed">{course.audience_en}</p>
            </Block>
          )}

          {/* Block 3 - Objectives */}
          {course.objectives_en && course.objectives_en.length > 0 && (
            <Block icon={Target} title={t("coursesPublic.blockObjectives")}>
              <ul className="list-disc ms-5 space-y-1.5">
                {course.objectives_en.map((o, i) => (
                  <li key={i}>{o}</li>
                ))}
              </ul>
            </Block>
          )}

          {/* Block 2 - Target competencies */}
          {course.target_competencies_raw_en && course.target_competencies_raw_en.length > 0 && (
            <Block icon={Award} title={t("coursesPublic.blockCompetencies")}>
              <div className="flex flex-wrap gap-1.5">
                {course.target_competencies_raw_en.map((c, i) => (
                  <Badge key={i} variant="outline">
                    {c}
                  </Badge>
                ))}
              </div>
            </Block>
          )}

          {/* Block 5 - Methodology */}
          {course.methodology_en && (
            <Block icon={BookOpen} title={t("coursesPublic.blockMethodology")}>
              <p className="leading-relaxed whitespace-pre-line">{course.methodology_en}</p>
            </Block>
          )}

          {/* Block 6 - Detailed outline. Two shapes are supported by
               VifmCourseOutlineSection: flat bullets, or nested
               sub-sections each with their own bullets. */}
          {course.outline_en && course.outline_en.length > 0 && (
            <Block icon={FileText} title={t("coursesPublic.blockOutline")}>
              <div className="space-y-4">
                {course.outline_en.map((section, i) => (
                  <div key={i} className="rounded-md border bg-card p-4">
                    <p className="font-semibold text-primary mb-2">{section.main_header}</p>
                    {section.bullets && section.bullets.length > 0 && (
                      <ul className="list-disc ms-5 mt-1 space-y-0.5 text-sm text-muted-foreground">
                        {section.bullets.map((b, k) => (
                          <li key={k}>
                            {b.text}
                            {b.sub_bullets && b.sub_bullets.length > 0 && (
                              <ul className="list-[circle] ms-5 mt-0.5 space-y-0.5">
                                {b.sub_bullets.map((sb, l) => (
                                  <li key={l}>{sb}</li>
                                ))}
                              </ul>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                    {section.subsections && section.subsections.length > 0 && (
                      <ul className="space-y-2 text-sm mt-2">
                        {section.subsections.map((sub, j) => (
                          <li key={j}>
                            <p className="font-medium">{sub.sub_header}</p>
                            {sub.bullets && sub.bullets.length > 0 && (
                              <ul className="list-disc ms-5 mt-1 space-y-0.5 text-muted-foreground">
                                {sub.bullets.map((b, k) => (
                                  <li key={k}>
                                    {b.text}
                                    {b.sub_bullets && b.sub_bullets.length > 0 && (
                                      <ul className="list-[circle] ms-5 mt-0.5 space-y-0.5">
                                        {b.sub_bullets.map((sb, l) => (
                                          <li key={l}>{sb}</li>
                                        ))}
                                      </ul>
                                    )}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </Block>
          )}

          {/* Block 7 - Note */}
          {course.note_en && (
            <Block icon={Sparkles} title={t("coursesPublic.blockNote")}>
              <p className="leading-relaxed text-muted-foreground italic">{course.note_en}</p>
            </Block>
          )}

          {/* Bottom CTA */}
          <div className="rounded-xl border bg-gradient-to-br from-accent/5 to-accent/10 p-6 sm:p-8 text-center">
            <h2 className="text-2xl font-semibold text-primary mb-2">
              {t("coursesPublic.detailBottomCtaHeading")}
            </h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto mb-5">
              {t("coursesPublic.detailBottomCtaBlurb")}
            </p>
            <Link
              href={requestQuoteHref}
              className="inline-flex items-center gap-2 rounded-lg bg-accent px-6 py-3 text-sm font-medium text-white hover:bg-accent/90 transition-colors"
            >
              {t("coursesPublic.requestQuote")} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </article>

        {/* Sidebar */}
        <aside className="order-1 lg:order-2 lg:sticky lg:top-24 self-start">
          <div className="rounded-lg border bg-card p-5 space-y-4">
            <Link
              href={requestQuoteHref}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-5 py-3 text-sm font-medium text-white hover:bg-accent/90 transition-colors"
            >
              {t("coursesPublic.requestQuote")} <ArrowRight className="h-4 w-4" />
            </Link>
            <p className="text-[11px] text-muted-foreground text-center">
              {t("coursesPublic.scopedWithin")}
            </p>
            <div className="border-t pt-4 space-y-3 text-xs">
              <Fact label={t("coursesPublic.factProgrammeCode")} value={course.code ?? "-"} mono />
              <Fact label={t("coursesPublic.factVertical")} value={verticalLabel(t, course.vertical)} />
              <Fact label={t("coursesPublic.factLevel")} value={t(`coursesPublic.level.${course.level}`)} />
              <Fact label={t("coursesPublic.factDuration")} value={durationLabel} />
              <Fact label={t("coursesPublic.factLanguages")} value={course.languages?.map((l) => l.toUpperCase()).join(" · ") ?? "-"} />
              <Fact label={t("coursesPublic.factDelivery")} value={course.delivery_modes?.join(" · ") ?? "-"} />
              {course.certification_code && (
                <Fact label={t("coursesPublic.factCertification")} value={course.certification_code} mono />
              )}
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}

function Block({
  icon: Icon, title, children,
}: {
  icon: typeof Compass;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <span className="inline-flex items-center justify-center h-7 w-7 rounded-md bg-accent/10 text-accent">
          <Icon className="h-4 w-4" />
        </span>
        <h2 className="text-lg font-semibold text-primary">{title}</h2>
      </div>
      <div className="text-sm text-foreground/90">{children}</div>
    </div>
  );
}

function Fact({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className={`text-end ${mono ? "font-mono" : "font-medium"} text-foreground`}>
        {value}
      </span>
    </div>
  );
}
