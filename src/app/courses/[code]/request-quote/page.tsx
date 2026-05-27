import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, GraduationCap, Sparkles } from "lucide-react";
import { createServiceClient } from "@/lib/supabase/server";
import { VifmLogo } from "@/components/shared/vifm-logo";
import { QuoteRequestForm } from "./_components/quote-request-form";
import { VIFM_VERTICAL_LABELS, type VifmCourse, type VifmVertical } from "@/types/database";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function QuoteRequestPage({
  params,
  searchParams,
}: {
  params: { code: string };
  searchParams?: {
    source?: string;
    engagement?: string;
    participant?: string;
  };
}) {
  const sb = createServiceClient();
  const lookup = UUID_RE.test(params.code)
    ? sb.from("vifm_courses").select("id, code, title_en, title_ar, vertical, level, default_duration_days, min_duration_days, max_duration_days, languages, delivery_modes").eq("id", params.code).maybeSingle<Pick<VifmCourse, "id" | "code" | "title_en" | "title_ar" | "vertical" | "level" | "default_duration_days" | "min_duration_days" | "max_duration_days" | "languages" | "delivery_modes">>()
    : sb.from("vifm_courses").select("id, code, title_en, title_ar, vertical, level, default_duration_days, min_duration_days, max_duration_days, languages, delivery_modes").eq("code", params.code).maybeSingle<Pick<VifmCourse, "id" | "code" | "title_en" | "title_ar" | "vertical" | "level" | "default_duration_days" | "min_duration_days" | "max_duration_days" | "languages" | "delivery_modes">>();
  const { data: course } = await lookup;
  if (!course) return notFound();

  // Optional Reflect engagement context. Drives form prefill + hidden
  // inputs that ultimately land in vifm_course_quote_requests with
  // engagement_type='reflect'. We validate that the participant belongs
  // to the engagement before prefilling; otherwise we silently degrade
  // to the public "direct" flow.
  let reflectContext: {
    engagement_type: "reflect";
    reflect_engagement_id: string;
    reflect_participant_id: string;
    prefillName: string;
    prefillEmail: string;
    prefillCompany: string;
  } | null = null;

  if (
    searchParams?.source === "reflect" &&
    searchParams.engagement &&
    searchParams.participant &&
    UUID_RE.test(searchParams.engagement) &&
    UUID_RE.test(searchParams.participant)
  ) {
    const { data: participant } = await sb
      .from("reflect_participants")
      .select(
        "id, full_name, email, engagement_id, reflect_engagements!inner(id, ara_organizations(name))"
      )
      .eq("id", searchParams.participant)
      .maybeSingle<{
        id: string;
        full_name: string;
        email: string;
        engagement_id: string;
        reflect_engagements: { id: string; ara_organizations: { name: string } | null };
      }>();
    if (participant && participant.engagement_id === searchParams.engagement) {
      reflectContext = {
        engagement_type: "reflect",
        reflect_engagement_id: participant.engagement_id,
        reflect_participant_id: participant.id,
        prefillName: participant.full_name,
        prefillEmail: participant.email,
        prefillCompany: participant.reflect_engagements.ara_organizations?.name ?? "",
      };
    }
  }

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
            href={`/courses/${course.code ?? course.id}`}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
          >
            <ArrowLeft className="h-3 w-3" /> Back to programme
          </Link>
        </div>
      </header>

      <section className="max-w-3xl mx-auto px-6 py-10">
        <span className="ara-eyebrow text-accent inline-flex items-center gap-1.5">
          <Sparkles className="h-3 w-3" />
          Request a quote
        </span>
        <h1 className="text-2xl sm:text-3xl font-semibold text-primary mt-2 mb-1">
          {course.title_en}
        </h1>
        <p className="text-sm text-muted-foreground mb-8">
          {VIFM_VERTICAL_LABELS[course.vertical as VifmVertical] ?? course.vertical} ·{" "}
          {course.level.charAt(0).toUpperCase() + course.level.slice(1)} ·{" "}
          {course.min_duration_days === course.max_duration_days
            ? `${course.default_duration_days} day${course.default_duration_days === 1 ? "" : "s"}`
            : `${course.min_duration_days}–${course.max_duration_days} days`}
        </p>

        {reflectContext && (
          <div className="mb-6 rounded-lg border border-accent/30 bg-accent/5 p-4 text-sm">
            <div className="font-medium text-primary mb-1">
              Quote-request from your Reflect 360 report
            </div>
            <div className="text-muted-foreground">
              We&apos;ve pre-filled your name, email, and organisation. Edit anything
              below or add the rest, then send the request.
            </div>
          </div>
        )}

        <QuoteRequestForm
          courseId={course.id}
          courseTitle={course.title_en}
          courseLanguages={course.languages ?? []}
          courseDeliveryModes={course.delivery_modes ?? []}
          engagementType={reflectContext?.engagement_type}
          reflectEngagementId={reflectContext?.reflect_engagement_id}
          reflectParticipantId={reflectContext?.reflect_participant_id}
          prefillName={reflectContext?.prefillName}
          prefillEmail={reflectContext?.prefillEmail}
          prefillCompany={reflectContext?.prefillCompany}
        />

        <p className="text-[11px] text-muted-foreground text-center mt-6">
          We respond to quote requests within 2 working days. Your contact
          information is used only to scope this engagement and is held in
          accordance with VIFM&apos;s data-protection policy.
        </p>
      </section>
    </div>
  );
}
