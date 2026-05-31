import Link from "next/link";
import { GraduationCap, Layers } from "lucide-react";
import { isAIConfigured } from "@/lib/ai/client";
import { VifmLogo } from "@/components/shared/vifm-logo";
import { TechAssessmentClient } from "./_components/tech-assessment-client";
import { getServerT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Technical Assessment · VIFM",
};

export default async function TechAssessmentPage() {
  const aiConfigured = isAIConfigured();
  const t = await getServerT();

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
        {!aiConfigured && (
          <div className="mb-5 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 shadow-sm">
            <strong>{t("tech.runner.aiWarnTitle")}</strong> {t("tech.runner.aiWarnBody")}
          </div>
        )}
        <TechAssessmentClient />
      </main>
    </div>
  );
}
