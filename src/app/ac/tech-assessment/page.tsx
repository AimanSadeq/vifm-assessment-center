import Link from "next/link";
import { ArrowLeft, GraduationCap, Layers } from "lucide-react";
import { isAIConfigured } from "@/lib/ai/client";
import { VifmLogo } from "@/components/shared/vifm-logo";
import { TechAssessmentClient } from "./_components/tech-assessment-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Technical Assessment · VIFM",
};

export default function TechAssessmentPage() {
  const aiConfigured = isAIConfigured();

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
                <Layers className="h-3.5 w-3.5" /> All services
              </Link>
              <Link
                href="/admin"
                className="ms-1 hidden items-center gap-1 text-xs text-white/70 transition-colors hover:text-white sm:inline-flex"
              >
                <ArrowLeft className="h-3 w-3" /> Assessment Center
              </Link>
            </nav>
          </div>

          <div className="max-w-3xl">
            <span className="ara-eyebrow text-[#FDA4AF]">
              <GraduationCap className="h-3 w-3" /> Technical competency
            </span>
            <h1 className="ara-numeral mt-3 mb-4 text-3xl font-semibold leading-[1.08] text-white sm:text-4xl">
              Measure what you can <span className="ara-accent-sweep">actually do</span>.
            </h1>
            <p className="max-w-2xl text-sm leading-relaxed text-white/75">
              An indicative assessment of technical proficiency across VIFM&apos;s finance &amp; management domains —
              finance, treasury, accounting, banking, analytics and more. The third capability pillar, beside
              behavioural competencies and English. For development, not certification.
            </p>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto -mt-12 max-w-5xl px-6 pb-16">
        {!aiConfigured && (
          <div className="mb-5 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 shadow-sm">
            <strong>AI key not set.</strong> Set <code className="text-xs">ANTHROPIC_API_KEY</code> for real,
            domain-specific items — a placeholder set is shown otherwise.
          </div>
        )}
        <TechAssessmentClient />
      </main>
    </div>
  );
}
