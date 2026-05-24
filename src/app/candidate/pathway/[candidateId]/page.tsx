export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getServerLocale } from "@/lib/i18n/server";
import { BackLink } from "@/components/shared/back-link";
import { ImpersonationBanner } from "@/components/shared/impersonation-banner";
import { PathwayClient } from "./_components/pathway-client";

type Props = {
  params: { candidateId: string };
  searchParams?: { asAdmin?: string };
};

export default async function CandidatePathwayPage({ params, searchParams }: Props) {
  const sb = await createClient();
  const locale = await getServerLocale();
  const { candidateId } = params;
  const asAdmin = searchParams?.asAdmin === "1";

  const { data: candidate, error } = await sb
    .from("candidates")
    .select("id, full_name, email, engagement_id")
    .eq("id", candidateId)
    .single();
  if (error || !candidate) return notFound();

  const tt =
    locale === "ar"
      ? {
          back: "العودة إلى مهاراتي",
          title: "مسار تطوير مهاراتي",
          sub: "يحوّل الذكاء الاصطناعي فجواتك المُقيّمة إلى خطة تعلّم متسلسلة، دورة تلو الأخرى.",
        }
      : {
          back: "Back to my skills",
          title: "My learning pathway",
          sub: "AI turns your assessed gaps into a sequenced, course-by-course development plan.",
        };

  return (
    <div className="space-y-6">
      {asAdmin && (
        <ImpersonationBanner
          candidateName={candidate.full_name}
          candidateEmail={candidate.email}
          exitHref={`/admin/engagements/${candidate.engagement_id}`}
        />
      )}
      <BackLink
        href={`/candidate/skills/${candidateId}${asAdmin ? "?asAdmin=1" : ""}`}
        label={tt.back}
      />
      <div>
        <h1 className="mt-2 text-2xl font-bold">{tt.title}</h1>
        <p className="text-sm text-muted-foreground">{tt.sub}</p>
      </div>
      <PathwayClient candidateId={candidateId} lang={locale} candidateName={candidate.full_name} />
    </div>
  );
}
