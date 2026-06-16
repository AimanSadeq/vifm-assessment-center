import Link from "next/link";
import {
  Languages, Users, UserCheck, ClipboardCheck, Ticket,
  BookOpen, Headphones, PenLine, Mic, CheckCircle2,
} from "lucide-react";
import { isAIConfigured } from "@/lib/ai/client";
import { createServiceClient } from "@/lib/supabase/server";
import { getServerT } from "@/lib/i18n/server";
import { VifmLogo } from "@/components/shared/vifm-logo";
import { AllServicesLink } from "@/components/shared/all-services-link";
import { FluentClient } from "./_components/fluent-client";
import { BackLink } from "@/components/shared/back-link";
import { getTimerMinutes, TIMER_DEFAULTS } from "@/lib/assessment-timers";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Fluent · English placement (prototype)",
};

type Props = {
  searchParams?: { candidateId?: string; engagementId?: string };
};

// Hero skill chips. The note on each names *how* the skill is scored, which
// is Fluent's differentiator - receptive skills auto-score, productive skills
// are graded against the CEFR rubric. Deliberately vendor-neutral (capability,
// not implementation) so the copy outlives any model/provider swap. Label + note
// are resolved from i18n inside the component (see SKILLS map below).
const SKILL_ICONS = [
  { icon: BookOpen, key: "reading" },
  { icon: Headphones, key: "listening" },
  { icon: PenLine, key: "writing" },
  { icon: Mic, key: "speaking" },
] as const;

export default async function FluentPage({ searchParams }: Props) {
  const t = await getServerT("en"); // Fluent stays English regardless of locale cookie
  const aiConfigured = isAIConfigured();
  // Admin-configurable Fluent time limit (minutes).
  const fluentMinutes = (await getTimerMinutes("fluent", TIMER_DEFAULTS.fluent)) ?? TIMER_DEFAULTS.fluent;

  const SKILLS = SKILL_ICONS.map((s) => ({
    icon: s.icon,
    label: t(`acFluent.skill_${s.key}_label`),
    note: t(`acFluent.skill_${s.key}_note`),
  }));

  // Optional candidate binding: launch /ac/fluent?candidateId=… to attach the
  // result to a candidate record. Tolerant - anonymous self-serve if absent.
  const candidateId = searchParams?.candidateId?.trim() || null;
  let candidateName: string | null = null;
  let candidateEmail: string | null = null;
  let engagementId: string | null = searchParams?.engagementId?.trim() || null;
  if (candidateId) {
    try {
      const sb = createServiceClient();
      const { data } = await sb
        .from("candidates")
        .select("full_name, email, engagement_id")
        .eq("id", candidateId)
        .single();
      if (data) {
        candidateName = (data.full_name as string) ?? null;
        candidateEmail = (data.email as string) ?? null;
        engagementId = engagementId ?? ((data.engagement_id as string) ?? null);
      }
    } catch {
      /* candidate lookup failed - fall back to anonymous mode */
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <BackLink href="/" label="Back" history />
      {/* ─── Hero ─── */}
      <header className="fluent-hero">
        <div className="mx-auto max-w-5xl px-6 pt-7 pb-24">
          {/* Top bar: logo + module nav */}
          <div className="mb-12 flex items-center justify-between gap-4">
            <VifmLogo variant="white" size="sm" />
            <nav className="flex items-center gap-2">
              <AllServicesLink variant="onDark" />
              <Link
                href="/ac/fluent/cohort"
                className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-xs font-medium text-white/85 backdrop-blur transition-colors hover:border-white/35 hover:bg-white/15"
              >
                <Users className="h-3.5 w-3.5" /> {t("acFluent.navCohortReport")}
              </Link>
              <Link
                href="/ac/fluent/vouchers"
                className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-xs font-medium text-white/85 backdrop-blur transition-colors hover:border-white/35 hover:bg-white/15"
              >
                <Ticket className="h-3.5 w-3.5" /> Vouchers
              </Link>
              <Link
                href="/ac/fluent/calibration"
                className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-xs font-medium text-white/85 backdrop-blur transition-colors hover:border-white/35 hover:bg-white/15"
              >
                <ClipboardCheck className="h-3.5 w-3.5" /> {t("acFluent.navScoringCalibration")}
              </Link>
            </nav>
          </div>

          {/* Headline block */}
          <div className="max-w-3xl">
            <span className="ara-eyebrow text-[#9CC4EC]">
              <Languages className="h-3 w-3" /> {t("acFluent.heroEyebrow")}
            </span>
            <h1 className="ara-numeral mt-4 mb-4 text-4xl font-semibold leading-[1.07] text-white sm:text-5xl">
              {t("acFluent.heroHeadlinePrefix")}{" "}
              <span className="fluent-sweep">{t("acFluent.heroHeadlineHighlight")}</span>
              {t("acFluent.heroHeadlineSuffix")}
            </h1>
            <p className="max-w-2xl text-base leading-relaxed text-white/75 sm:text-lg">
              {t("acFluent.heroDescription")}
            </p>

            {/* Skill chips */}
            <div className="mt-7 flex flex-wrap gap-2.5">
              {SKILLS.map((s) => (
                <span
                  key={s.label}
                  className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-xs text-white/85 backdrop-blur"
                >
                  <s.icon className="h-3.5 w-3.5 text-[#9CC4EC]" />
                  <span className="font-medium text-white">{s.label}</span>
                  <span className="text-white/55">{s.note}</span>
                </span>
              ))}
            </div>

            {/* Trust strip */}
            <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-white/55">
              <span className="inline-flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3 text-[#9CC4EC]" /> {t("acFluent.trustCefrCertificate")}
              </span>
              <span className="h-3 w-px bg-white/20" />
              <span>{t("acFluent.trustAiAssistedScoring")}</span>
              <span className="h-3 w-px bg-white/20" />
              <span>{t("acFluent.trustConfidenceBand")}</span>
              <span className="h-3 w-px bg-white/20" />
              <span>{t("acFluent.trustCohortReporting")}</span>
              <span className="h-3 w-px bg-white/20" />
              <span>{t("acFluent.trustIndicativePlacement")}</span>
            </div>

            {/* CEFR reference — spell out the acronym used throughout */}
            <p className="mt-4 max-w-2xl text-[11px] leading-relaxed text-white/45">
              <span className="font-medium text-white/70">CEFR</span> {t("acFluent.cefrReference")}
            </p>
          </div>
        </div>
      </header>

      {/* ─── Start / flow (overlaps the hero like the rest of the portal) ─── */}
      <main className="relative z-10 mx-auto -mt-12 max-w-5xl px-6 pb-16">
        {candidateName && (
          <div className="mb-5 flex items-center gap-2 rounded-xl border border-[#5391D5]/40 bg-[#5391D5]/5 px-4 py-3 text-sm text-[#010131] shadow-sm">
            <UserCheck className="h-4 w-4 shrink-0 text-[#5391D5]" />
            <span>
              {t("acFluent.candidateBindingPrefix")}{" "}
              <strong>{candidateName}</strong>{t("acFluent.candidateBindingSuffix")}
            </span>
          </div>
        )}
        {!aiConfigured && (
          <div className="mb-5 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 shadow-sm">
            <strong>{t("acFluent.aiKeyNotSetTitle")}</strong> {t("acFluent.aiKeyNotSetBodyPrefix")}{" "}
            <code className="text-xs">ANTHROPIC_API_KEY</code> {t("acFluent.aiKeyNotSetBodySuffix")}
          </div>
        )}
        <FluentClient
          candidateId={candidateId}
          engagementId={engagementId}
          prefillName={candidateName ?? undefined}
          prefillEmail={candidateEmail ?? undefined}
          timerMinutes={fluentMinutes}
        />
      </main>
    </div>
  );
}
