import Link from "next/link";
import {
  ArrowRight, Shield, Users, Link2, Sparkles, CheckCircle2, BarChart3, Globe, Route, User, GraduationCap,
} from "lucide-react";
import { VifmLogo } from "@/components/shared/vifm-logo";
import { AllServicesLink } from "@/components/shared/all-services-link";
import { AnimatedCompass } from "@/components/shared/ara/animated-compass";
import { CountUp } from "@/components/shared/ara/count-up";
import { FadeIn } from "@/components/shared/ara/fade-in";

export default function AraRootPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* ─── Hero ─── */}
      <section className="ara-hero relative overflow-hidden">
        <div className="max-w-6xl mx-auto px-6 pt-8 pb-24 relative">
          {/* Floating compass - hidden on small screens so it never
              competes with the headline. */}
          <div className="pointer-events-none hidden lg:block absolute top-16 right-0 w-[420px] h-[420px] opacity-90">
            <AnimatedCompass className="w-full h-full" />
          </div>

          {/* Top nav - Platform Roadmap is promoted as a primary header
              link so visitors can jump straight into the storytelling
              overview without hunting through the entry cards. */}
          <div className="flex items-center justify-between mb-20 relative z-10">
            <VifmLogo variant="white" size="sm" />
            <div className="flex items-center gap-3">
              <AllServicesLink variant="onDark" />
              <Link
                href="/ara/engage"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-white px-3.5 py-1.5 rounded-full border border-white/25 bg-white/5 hover:bg-white/15 hover:border-white/40 backdrop-blur transition-colors"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Engage
              </Link>
              <Link
                href="/ara/roadmap"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-white/85 px-3.5 py-1.5 rounded-full border border-white/15 bg-white/0 hover:bg-white/10 hover:border-white/30 backdrop-blur transition-colors"
              >
                <Route className="h-3.5 w-3.5" />
                Roadmap
              </Link>
              <Link
                href="/courses"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-white/85 px-3.5 py-1.5 rounded-full border border-white/15 bg-white/0 hover:bg-white/10 hover:border-white/30 backdrop-blur transition-colors"
              >
                <GraduationCap className="h-3.5 w-3.5" />
                Training catalogue
              </Link>
              <Link
                href="/admin"
                className="hidden sm:inline-flex items-center gap-1 text-xs text-white/70 hover:text-white transition-colors ms-2"
              >
                Assessment Center <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>

          <div className="max-w-3xl relative z-10">
            <span className="ara-eyebrow text-accent">
              <Sparkles className="h-3 w-3" />
              VIFM AI Readiness Compass
            </span>
            <h1 className="ara-numeral text-4xl sm:text-5xl lg:text-6xl font-semibold text-white leading-[1.05] mt-4 mb-5">
              Know where you stand. <br className="hidden sm:block" />
              Know where to go <span className="ara-accent-sweep">with AI</span>.
            </h1>
            <p className="text-base text-white/70 mb-6 italic">
              The VIFM AI Readiness Compass - a bilingual diagnostic calibrated for the GCC.
            </p>
            <p className="text-lg text-white/75 max-w-2xl leading-relaxed">
              Eight pillars, sixteen regulatory frameworks, and a bilingual branded
              report - delivered in English, Arabic, or side-by-side landscape.
              Plus a complimentary, self-served Personal Snapshot for individuals. Built
              for consultant-led engagements across UAE and Saudi Arabia.
            </p>

            <div className="flex flex-wrap gap-3 mt-8">
              <Link
                href="/ara/engage"
                className="ara-pulse inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-3 text-sm font-medium text-white hover:bg-accent/90 transition-colors"
              >
                Start with a complimentary assessment <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/ara/consultant"
                className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/5 px-5 py-3 text-sm font-medium text-white hover:bg-white/10 transition-colors backdrop-blur"
              >
                Consultant dashboard
              </Link>
            </div>
          </div>

          {/* Floating stat strip - each stat tinted with its own palette role.
              All four tiles share the same grid cell width, fill their cell
              to equal height (h-full + flex-col), and animate from 0 to a
              single numeric target so the visual weight stays uniform. */}
          <div className="mt-16 grid grid-cols-2 sm:grid-cols-4 gap-4 relative z-10 items-stretch">
            {[
              { label: "Pillars",                 value: 8,  tone: "text-accent",        border: "hover:border-accent/50" },
              { label: "Regulatory frameworks",   value: 15, tone: "ara-text-violet-dk", border: "hover:border-[#A78BFA]/50" },
              { label: "Compliance requirements", value: 56, tone: "ara-text-teal-dk",   border: "hover:border-[#2DD4BF]/50" },
              { label: "Report pages",            value: 60, tone: "ara-text-gold-dk",   border: "hover:border-[#FBBF24]/50" },
            ].map((s, i) => (
              <FadeIn key={s.label} delay={i * 80} className="h-full">
                <div className={`rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur transition-colors h-full flex flex-col ${s.border}`}>
                  <div className={`ara-numeral text-3xl font-semibold leading-none ${s.tone}`}>
                    <CountUp value={s.value} />
                  </div>
                  <div className="text-[11px] uppercase tracking-widest text-white/60 mt-2">
                    {s.label}
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Entry points ─── */}
      <section className="max-w-6xl mx-auto px-6 -mt-12 relative z-10 pb-16">
        <div className="grid gap-5 md:grid-cols-3">
          <FadeIn delay={0}>
            <EntryCard
              href="/ara/consultant"
              icon={Users}
              tone="blue"
              title="Consultant"
              subtitle="Run engagements"
              description="Create assessments, invite respondents, validate Phase 2 findings, freeze scores, and generate bilingual reports."
              cta="Open dashboard"
            />
          </FadeIn>
          <FadeIn delay={120}>
            <EntryCard
              href="/ara/admin"
              icon={Shield}
              tone="violet"
              title="VIFM Admin"
              subtitle="Curate content"
              description="Manage question bank versions, regulatory frameworks, sandbox data, and retention lifecycle."
              cta="Open console"
            />
          </FadeIn>
          <FadeIn delay={240}>
            <EntryCard
              href="/ara/personal/start"
              icon={User}
              tone="teal"
              title="Personal snapshot"
              subtitle="Self-served, complimentary"
              description="A short bilingual self-assessment for individuals - 5-7 minutes, four VIFM factors, plus personalised VIFM training recommendations to act on the gaps."
              cta="Take the snapshot"
            />
          </FadeIn>
        </div>

        {/* Subtle separate row for the org-side respondent flow note -
            kept in the layout so consultants who land here remember the
            token URL exists, but visually demoted vs the three primary
            entry cards. */}
        <div className="mt-4 flex items-center justify-center gap-2 text-[11px] text-muted-foreground">
          <Link2 className="h-3 w-3" />
          <span>
            Org respondents arrive via a consultant-issued token URL{" "}
            <code className="text-[10px]">/ara/respond/[token]</code> - no
            account or self-service required.
          </span>
        </div>
      </section>

      {/* ─── Capability rail ─── */}
      <section className="ara-hero-subtle py-20 border-y">
        <div className="max-w-6xl mx-auto px-6">
          <span className="ara-eyebrow">Inside the platform</span>
          <h2 className="text-3xl font-semibold text-primary mt-3 mb-12 max-w-2xl">
            Built for Big-4 calibre engagements, priced for VIFM&apos;s GCC market.
          </h2>

          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: BarChart3,
                tone: "blue" as const,
                title: "8-pillar scoring engine",
                body: "Real-time recalculation across maturity levels, weighted scores, benchmark gaps, perception-vs-reality, and peer medians.",
              },
              {
                icon: Globe,
                tone: "violet" as const,
                title: "Bilingual by design",
                body: "Full Arabic/English toggle on the respondent form. 3-mode PDF report: EN-only, AR-only, or side-by-side landscape.",
              },
              {
                icon: Shield,
                tone: "emerald" as const,
                title: "GCC regulatory calibration",
                body: "16 frameworks seeded for UAE and Saudi (PDPL, NCA ECC, SDAIA NDGF, DCAI, ADDA, Vision 2030) with 56 mapped requirements.",
              },
              {
                icon: CheckCircle2,
                tone: "gold" as const,
                title: "Evidence triangulation",
                body: "Gap Detector, Shadow AI Alert, supporting materials upload, AI use case portfolio inventory, and consultant-validated scores.",
              },
            ].map((c, i) => (
              <FadeIn key={c.title} delay={i * 100}>
                <CapabilityItem icon={c.icon} tone={c.tone} title={c.title} body={c.body} />
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="border-t bg-card/50">
        <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="text-xs text-muted-foreground">
            <div className="font-medium text-foreground mb-0.5">
              Virginia Institute of Finance and Management
            </div>
            Confidential - for VIFM and engaged clients only.
          </div>
          <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-4">
            <Link href="/admin" className="hover:text-foreground">Assessment Center</Link>
            <span className="h-3 w-px bg-border" />
            <span>Module status: Ready for pilot</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

type Tone = "blue" | "violet" | "teal" | "gold" | "emerald" | "rose";

const TONE_ICON_CLASS: Record<Tone, string> = {
  blue: "ara-icon-blue",
  violet: "ara-icon-violet",
  teal: "ara-icon-teal",
  gold: "ara-icon-gold",
  emerald: "ara-icon-emerald",
  rose: "ara-icon-rose",
};

const TONE_LINK_CLASS: Record<Tone, string> = {
  blue: "text-accent",
  violet: "text-[#7C3AED]",
  teal: "text-[#0D9488]",
  gold: "text-[#D97706]",
  emerald: "text-[#059669]",
  rose: "text-[#E11D48]",
};

function EntryCard({
  href,
  icon: Icon,
  tone = "blue",
  title,
  subtitle,
  description,
  cta,
  disabled,
}: {
  href?: string;
  icon: typeof Users;
  tone?: Tone;
  title: string;
  subtitle: string;
  description: string;
  cta: string;
  disabled?: boolean;
}) {
  const body = (
    <div className={`ara-tile p-6 h-full flex flex-col ${disabled ? "opacity-70 pointer-events-none" : ""}`}>
      <div className={`ara-tile-icon h-10 w-10 rounded-lg flex items-center justify-center mb-4 ${TONE_ICON_CLASS[tone]}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="ara-eyebrow text-muted-foreground mb-1">{subtitle}</div>
      <h3 className="text-xl font-semibold text-primary">{title}</h3>
      <p className="text-sm text-muted-foreground mt-2 flex-1">{description}</p>
      <div className={`mt-4 inline-flex items-center gap-1 text-sm font-medium ${disabled ? "text-muted-foreground" : TONE_LINK_CLASS[tone]}`}>
        {disabled ? <code className="bg-muted px-1.5 py-0.5 rounded text-xs">{cta}</code> : (
          <>
            {cta} <ArrowRight className="h-3.5 w-3.5" />
          </>
        )}
      </div>
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

function CapabilityItem({
  icon: Icon,
  tone = "blue",
  title,
  body,
}: {
  icon: typeof BarChart3;
  tone?: Tone;
  title: string;
  body: string;
}) {
  return (
    <div>
      <div className={`h-9 w-9 rounded-lg flex items-center justify-center mb-3 ${TONE_ICON_CLASS[tone]}`}>
        <Icon className="h-4 w-4" />
      </div>
      <h3 className="text-sm font-semibold text-primary mb-1">{title}</h3>
      <p className="text-xs text-muted-foreground leading-relaxed">{body}</p>
    </div>
  );
}
