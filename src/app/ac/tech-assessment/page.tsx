import Link from "next/link";
import { GraduationCap, Layers, UserCheck } from "lucide-react";
import { isAIConfigured } from "@/lib/ai/client";
import { createServiceClient } from "@/lib/supabase/server";
import { VifmLogo } from "@/components/shared/vifm-logo";
import { TechAssessmentClient } from "./_components/tech-assessment-client";
import { getServerT, getServerLocale } from "@/lib/i18n/server";
import { getLocalizedTechTaxonomy } from "@/lib/competencies/technical-taxonomy";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Technical Assessment · VIFM",
};

type Props = {
  searchParams?: { candidateId?: string; engagementId?: string; domainKey?: string };
};

export default async function TechAssessmentPage({ searchParams }: Props) {
  const aiConfigured = isAIConfigured();
  const t = await getServerT();
  const { domains, skillLabels } = await getLocalizedTechTaxonomy(await getServerLocale());

  // Optional org-assigned run: bind the sitting to a candidate (+ engagement) and
  // optionally lock it to one domain. Tolerant — anonymous self-serve if absent.
  const candidateId = searchParams?.candidateId?.trim() || null;
  let engagementId = searchParams?.engagementId?.trim() || null;
  let candidateName: string | null = null;
  if (candidateId) {
    try {
      const sb = createServiceClient();
      const { data } = await sb
        .from("candidates")
        .select("full_name, engagement_id")
        .eq("id", candidateId)
        .maybeSingle();
      if (data) {
        candidateName = (data.full_name as string) ?? null;
        engagementId = engagementId ?? ((data.engagement_id as string) ?? null);
      }
    } catch {
      /* candidate lookup failed — fall back to anonymous mode */
    }
  }
  const reqDomain = searchParams?.domainKey?.trim() || null;
  const lockedDomain = reqDomain && domains.some((d) => d.key === reqDomain) ? reqDomain : null;

  return (
    <div className="min-h-screen bg-background">
      <header className="prehire-hero">
        <div className="mx-auto max-w-5xl px-6 pt-7 pb-24">
          <div className="mb-10 flex items-center justify-between gap-4">
            <VifmLogo variant="white" size="sm" />
            <nav className="flex items-center gap-2">
              <Link
                href="/"
                className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-xs font-medium text-white/85 backdrop-blur transition-colors hover:border-white/35 hover:bg-white/15"
              >
                <Layers className="h-3.5 w-3.5" /> {t("adminNav.allServices")}
              </Link>
            </nav>
          </div>

          <div className="max-w-3xl">
            <span className="ara-eyebrow text-[#FDA4AF]">
              <GraduationCap className="h-3 w-3" /> {t("tech.runner.eyebrow")}
            </span>
            <h1 className="ara-numeral mt-3 mb-4 text-3xl font-semibold leading-[1.08] text-white sm:text-4xl">
              {t("tech.runner.h1prefix")} <span className="ara-accent-sweep">{t("tech.runner.h1highlight")}</span>.
            </h1>
            <p className="max-w-2xl text-sm leading-relaxed text-white/75">{t("tech.runner.intro")}</p>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto -mt-12 max-w-5xl px-6 pb-16">
        {candidateName && (
          <div className="mb-5 flex items-center gap-2 rounded-xl border border-[#5391D5]/40 bg-[#5391D5]/5 px-4 py-3 text-sm text-[#010131] shadow-sm">
            <UserCheck className="h-4 w-4 shrink-0 text-[#5391D5]" />
            <span>{t("tech.runner.forCandidate", { name: candidateName })}</span>
          </div>
        )}
        {!aiConfigured && (
          <div className="mb-5 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 shadow-sm">
            <strong>{t("tech.runner.aiWarnTitle")}</strong> {t("tech.runner.aiWarnBody")}
          </div>
        )}
        <TechAssessmentClient
          domains={domains}
          skillLabels={skillLabels}
          candidateId={candidateId}
          engagementId={engagementId}
          lockedDomain={lockedDomain}
        />
      </main>
    </div>
  );
}
