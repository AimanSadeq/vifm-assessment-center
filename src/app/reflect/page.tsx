import Link from "next/link";
import {
  ArrowRight,
  Aperture,
  Users,
  Shield,
  CircleDot,
  Globe,
  GraduationCap,
} from "lucide-react";
import { VifmLogo } from "@/components/shared/vifm-logo";

export const metadata = {
  title: "VIFM Reflect · 360° leadership feedback",
  description:
    "VIFM Reflect — a bilingual 360° leadership feedback platform that turns Corporate Values and Leadership Competencies into actionable insight for the GCC.",
};

export default function ReflectRootPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* ─── Hero ─── */}
      <section className="ara-hero relative overflow-hidden">
        <div className="max-w-6xl mx-auto px-6 pt-8 pb-24 relative">
          {/* Top nav */}
          <div className="flex items-center justify-between mb-20 relative z-10">
            <VifmLogo variant="white" size="sm" />
            <div className="flex items-center gap-3">
              <Link
                href="/courses"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-white/85 px-3.5 py-1.5 rounded-full border border-white/15 bg-white/0 hover:bg-white/10 hover:border-white/30 backdrop-blur transition-colors"
              >
                <GraduationCap className="h-3.5 w-3.5" />
                Training catalogue
              </Link>
              <Link
                href="/ara"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-white/85 px-3.5 py-1.5 rounded-full border border-white/15 bg-white/0 hover:bg-white/10 hover:border-white/30 backdrop-blur transition-colors"
              >
                AI Readiness
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
              <Aperture className="h-3 w-3" />
              VIFM Reflect
            </span>
            <h1 className="ara-numeral text-4xl sm:text-5xl lg:text-6xl font-semibold text-white leading-[1.05] mt-4 mb-5">
              See yourself
              <br className="hidden sm:block" />
              <span className="ara-accent-sweep">from every angle.</span>
            </h1>
            <p className="text-base text-white/70 mb-6 italic">
              VIFM Reflect — bilingual 360° leadership feedback, calibrated to your
              own values and leadership competencies.
            </p>
            <p className="text-lg text-white/75 max-w-2xl leading-relaxed">
              Bring your Corporate Values and Leadership Competencies. We turn them
              into behavioural items, gather feedback from peers, managers, and direct
              reports, and deliver each leader a development-grade report and an
              individual development plan — in English, Arabic, or both.
            </p>

            <div className="flex flex-wrap gap-3 mt-8">
              <Link
                href="/reflect/consultant"
                className="ara-pulse inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-3 text-sm font-medium text-white hover:bg-accent/90 transition-colors"
              >
                Open consultant dashboard <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/reflect/admin"
                className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/5 px-5 py-3 text-sm font-medium text-white hover:bg-white/10 transition-colors backdrop-blur"
              >
                Admin console
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Entry points ─── */}
      <section className="max-w-6xl mx-auto px-6 -mt-12 relative z-10 pb-16">
        <div className="grid gap-5 md:grid-cols-2">
          <EntryCard
            href="/reflect/consultant"
            icon={Users}
            tone="blue"
            title="Consultant"
            subtitle="Run engagements"
            description="Create a 360° engagement, build the competency framework from the client's values, invite participants and raters, score, and release reports."
            cta="Open dashboard"
          />
          <EntryCard
            href="/reflect/admin"
            icon={Shield}
            tone="violet"
            title="VIFM Admin"
            subtitle="Curate content"
            description="Manage library templates, monitor active engagements, manage retention, and audit email + scoring activity across all consultants."
            cta="Open console"
          />
        </div>

        {/* Subtle note about rater flow */}
        <div className="mt-4 flex items-center justify-center gap-2 text-[11px] text-muted-foreground">
          <CircleDot className="h-3 w-3" />
          <span>
            Raters arrive via a consultant-issued token URL{" "}
            <code className="text-[10px]">/reflect/respond/[token]</code> — no
            account or self-service required.
          </span>
        </div>
      </section>

      {/* ─── Capability rail ─── */}
      <section className="ara-hero-subtle py-20 border-y">
        <div className="max-w-6xl mx-auto px-6">
          <span className="ara-eyebrow">Inside the platform</span>
          <h2 className="text-3xl font-semibold text-primary mt-3 mb-12 max-w-2xl">
            Development-grade 360°, built on your competency model — not ours.
          </h2>

          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: Aperture,
                tone: "blue" as const,
                title: "Your framework, our engine",
                body: "Upload your Corporate Values and Leadership Competencies. AI proposes the behavioural items; the consultant approves before launch.",
              },
              {
                icon: Users,
                tone: "violet" as const,
                title: "Multi-rater, anonymised",
                body: "Self, Manager, Peer, Direct Report — with a configurable minimum-N threshold (default 3) before peer and direct-report scores are revealed.",
              },
              {
                icon: Globe,
                tone: "emerald" as const,
                title: "Bilingual EN + AR",
                body: "Full Arabic / English toggle for raters and reports — branded participant PDF with both languages side by side when needed.",
              },
              {
                icon: GraduationCap,
                tone: "gold" as const,
                title: "Linked to training",
                body: "Each report ends with the VIFM courses that close the participant's biggest behaviour gaps — ready to debrief and act on.",
              },
            ].map((c) => (
              <CapabilityItem key={c.title} icon={c.icon} tone={c.tone} title={c.title} body={c.body} />
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
            Confidential — for VIFM and engaged clients only.
          </div>
          <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-4">
            <Link href="/admin" className="hover:text-foreground">Assessment Center</Link>
            <span className="h-3 w-px bg-border" />
            <span>Module status: Scaffolding (M1)</span>
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
}: {
  href: string;
  icon: typeof Users;
  tone?: Tone;
  title: string;
  subtitle: string;
  description: string;
  cta: string;
}) {
  return (
    <Link href={href}>
      <div className="ara-tile p-6 h-full flex flex-col">
        <div className={`ara-tile-icon h-10 w-10 rounded-lg flex items-center justify-center mb-4 ${TONE_ICON_CLASS[tone]}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="ara-eyebrow text-muted-foreground mb-1">{subtitle}</div>
        <h3 className="text-xl font-semibold text-primary">{title}</h3>
        <p className="text-sm text-muted-foreground mt-2 flex-1">{description}</p>
        <div className={`mt-4 inline-flex items-center gap-1 text-sm font-medium ${TONE_LINK_CLASS[tone]}`}>
          {cta} <ArrowRight className="h-3.5 w-3.5" />
        </div>
      </div>
    </Link>
  );
}

function CapabilityItem({
  icon: Icon,
  tone = "blue",
  title,
  body,
}: {
  icon: typeof Aperture;
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
