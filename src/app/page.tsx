import Link from "next/link";
import {
  ArrowRight, ClipboardCheck, Compass, Aperture, Languages, GraduationCap, Sparkles,
} from "lucide-react";
import { VifmLogo } from "@/components/shared/vifm-logo";

export const metadata = {
  title: "VIFM · Assessment, readiness & development",
  description:
    "VIFM's bilingual talent platform for the GCC: competency assessment centers, organisational AI readiness, 360 leadership feedback, and AI English placement.",
};

type Tone = "blue" | "violet" | "teal" | "gold";

type Service = {
  href: string;
  icon: typeof Compass;
  tone: Tone;
  name: string;
  tagline: string;
  description: string;
};

// The four applications hosted under the VIFM platform. Each gets one hue
// from the platform aurora so the suite reads as four distinct-but-related
// services. Order: the two organisational diagnostics first, then the two
// individual instruments.
const SERVICES: Service[] = [
  {
    href: "/admin",
    icon: ClipboardCheck,
    tone: "blue",
    name: "Assessment Center",
    tagline: "Competency assessment",
    description:
      "Design assessment centers, run exercises and observations, reach scoring consensus in the live wash-up engine, and issue competency reports and learning plans.",
  },
  {
    href: "/ara",
    icon: Compass,
    tone: "violet",
    name: "AI Readiness",
    tagline: "AR Compass diagnostic",
    description:
      "An eight-pillar organisational AI-readiness diagnostic, calibrated to UAE and Saudi frameworks, with bilingual board-ready reports and a complimentary personal snapshot.",
  },
  {
    href: "/reflect",
    icon: Aperture,
    tone: "teal",
    name: "Reflect 360",
    tagline: "Leadership feedback",
    description:
      "360-degree leadership feedback built from your own values and competencies, with a development plan per leader and an organisation-wide cohort culture view.",
  },
  {
    href: "/ac/fluent",
    icon: Languages,
    tone: "gold",
    name: "VIFM Fluent",
    tagline: "AI English placement",
    description:
      "A four-skill, CEFR-aligned English placement: AI-generated reading and listening, rubric-scored writing and speaking, with an indicative level and feedback in minutes.",
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      {/* ─── Platform hero ─── */}
      <header className="ara-hero relative overflow-hidden">
        <div className="mx-auto max-w-6xl px-6 pt-8 pb-28">
          {/* Top bar */}
          <div className="mb-16 flex items-center justify-between gap-4">
            <VifmLogo variant="white" size="md" />
            <Link
              href="/courses"
              className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-xs font-medium text-white/85 backdrop-blur transition-colors hover:border-white/35 hover:bg-white/15"
            >
              <GraduationCap className="h-3.5 w-3.5" /> Training catalogue
            </Link>
          </div>

          {/* Headline */}
          <div className="max-w-3xl">
            <span className="ara-eyebrow text-accent">
              <Sparkles className="h-3 w-3" /> VIFM Talent &amp; Readiness Platform
            </span>
            <h1 className="ara-numeral mt-4 mb-5 text-4xl font-semibold leading-[1.05] text-white sm:text-5xl lg:text-6xl">
              Measure capability.{" "}
              <span className="ara-accent-sweep">Build readiness.</span>
            </h1>
            <p className="max-w-2xl text-lg leading-relaxed text-white/75">
              Four bilingual services for the GCC, in one place: competency assessment
              centers, organisational AI readiness, 360 leadership feedback, and AI
              English placement. Choose where to begin.
            </p>
            <p className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-white/55">
              <span>Bilingual English / Arabic</span>
              <span className="h-3 w-px bg-white/20" />
              <span>Calibrated for UAE &amp; Saudi Arabia</span>
              <span className="h-3 w-px bg-white/20" />
              <span>AI-assisted, human-aligned scoring</span>
            </p>
          </div>
        </div>
      </header>

      {/* ─── Service launcher (overlaps the hero) ─── */}
      <main className="relative z-10 mx-auto -mt-16 max-w-6xl px-6 pb-16">
        <div className="grid gap-6 sm:grid-cols-2">
          {SERVICES.map(({ href, icon: Icon, tone, name, tagline, description }) => (
            <Link key={href} href={href} className="block h-full">
              <div className={`launcher-card tone-${tone} h-full p-7`}>
                <Icon className="launcher-card-glyph h-28 w-28" strokeWidth={1} aria-hidden />
                <div className="relative z-10 flex h-full flex-col">
                  <div className="launcher-card-icon mb-4 flex h-12 w-12 items-center justify-center rounded-xl">
                    <Icon className="h-6 w-6" />
                  </div>
                  <div className="ara-eyebrow mb-1.5">{tagline}</div>
                  <h2 className="text-xl font-semibold text-primary">{name}</h2>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                    {description}
                  </p>
                  <div className="launcher-card-cta mt-5 inline-flex items-center gap-1.5 text-sm font-semibold">
                    Enter <ArrowRight className="h-4 w-4" />
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </main>

      {/* ─── Footer ─── */}
      <footer className="border-t bg-card/50">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-4 px-6 py-8 sm:flex-row sm:items-center">
          <div className="text-xs text-muted-foreground">
            <div className="mb-0.5 font-medium text-foreground">
              Virginia Institute of Finance and Management
            </div>
            Confidential - for VIFM and engaged clients only.
          </div>
          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            <Link href="/courses" className="hover:text-foreground">Training catalogue</Link>
            <span className="h-3 w-px bg-border" />
            <span>Built for the GCC</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
