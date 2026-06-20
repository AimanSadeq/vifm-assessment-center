import { Sparkles, UserCheck, CheckCircle2, Languages, FileText, ShieldCheck } from "lucide-react";
import { VifmLogo } from "@/components/shared/vifm-logo";
import { AllServicesLink } from "@/components/shared/all-services-link";
import { DesignTargetRolesLink } from "@/components/shared/design-target-roles-link";
import { AnimatedCompass } from "@/components/shared/ara/animated-compass";
import { FadeIn } from "@/components/shared/ara/fade-in";
import { ARA_INDIVIDUAL_FACTORS } from "@/lib/constants/ara-individual-factors";
import { createDeepDivePersonalAssessment } from "../consultant/personal-deep-dive/new/actions";
import { SelectionIssueForm } from "./selection-issue-form";

/**
 * AI Readiness Compass - For Selection (Talent Acquisition lens).
 *
 * Reached from the admin sidebar's Talent Acquisition pillar
 * (/ara?lens=acquisition). For selection, AI readiness is PERSONAL: you are
 * sizing up one candidate, not an organisation - so the org engagement tiers
 * (Department / Division / Enterprise) do not appear here at all. The only
 * instrument is the full 48-item Personal AI Readiness deep-dive, issued to a
 * named candidate (and openable on the spot to demo live to a client).
 */
export function SelectionLanding() {
  return (
    <div className="min-h-screen bg-background">
      {/* ─── Hero + issue/demo card ─── */}
      <section className="ara-hero relative overflow-hidden">
        <div className="max-w-6xl mx-auto px-6 pt-8 pb-20 relative">
          <div className="pointer-events-none hidden lg:block absolute top-12 right-0 w-[360px] h-[360px] opacity-80">
            <AnimatedCompass className="w-full h-full" />
          </div>

          {/* Top nav - selection-scoped: no Engage / Roadmap funnel links
              (those carry the org tiers, which don't apply to selection). */}
          <div className="flex items-center justify-between mb-14 relative z-10">
            <VifmLogo variant="white" size="sm" />
            <div className="flex items-center gap-3">
              <AllServicesLink variant="onDark" />
              <DesignTargetRolesLink variant="onDark" />
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-white/85 px-3.5 py-1.5 rounded-full border border-white/15 bg-white/5 backdrop-blur">
                <UserCheck className="h-3.5 w-3.5" /> Talent Acquisition
              </span>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-10 items-start relative z-10">
            {/* Left: positioning */}
            <div>
              <span className="ara-eyebrow text-accent">
                <Sparkles className="h-3 w-3" />
                AI Readiness Compass · For Selection
              </span>
              <h1 className="ara-numeral text-4xl sm:text-5xl font-semibold text-white leading-[1.05] mt-4 mb-5">
                Hire people who are <span className="ara-accent-sweep">AI-ready</span>.
              </h1>
              <p className="text-lg text-white/75 max-w-xl leading-relaxed">
                When you are selecting talent, AI readiness is personal. The Compass
                measures how an individual candidate thinks with, works with, collaborates
                around, and adapts to AI - then gives you a clear, bilingual read to weigh
                alongside the rest of your hiring picture.
              </p>

              <ul className="mt-7 space-y-3">
                {[
                  { icon: FileText, text: "Full 60-question Personal deep-dive - 15 items across each of the four VIFM factors, mixing self-rating, scenario, and knowledge-check items." },
                  { icon: Languages, text: "Bilingual - the candidate takes it in English or Arabic." },
                  { icon: UserCheck, text: "Email the candidate a secure link, keep it private to run yourself, or open it now to walk through it live - your call." },
                ].map(({ icon: Icon, text }) => (
                  <li key={text} className="flex items-start gap-3 text-sm text-white/85">
                    <span className="ara-tile-icon h-7 w-7 rounded-md flex items-center justify-center shrink-0 bg-white/10 text-accent">
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <span className="pt-1">{text}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Right: the one action - issue / demo. text-foreground resets the
                off-white text the .ara-hero inherits onto this white card, so
                the form labels / inputs / Arabic toggle render in dark ink. */}
            <FadeIn>
              <div className="rounded-2xl border border-white/15 bg-white/95 backdrop-blur p-6 shadow-2xl text-foreground">
                <h2 className="text-lg font-semibold text-primary">Assess a candidate</h2>
                <p className="text-sm text-muted-foreground mt-1 mb-5">
                  Enter a name and email. Email the candidate their secure link, keep it to
                  yourself to run privately, or open it now to walk through it live.
                </p>
                <SelectionIssueForm action={createDeepDivePersonalAssessment} />
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* ─── What the candidate is measured on ─── */}
      <section className="max-w-6xl mx-auto px-6 py-16">
        <span className="ara-eyebrow">What the candidate is measured on</span>
        <h2 className="text-3xl font-semibold text-primary mt-3 mb-3 max-w-2xl">
          Four VIFM factors of personal AI readiness.
        </h2>
        <p className="text-sm text-muted-foreground max-w-2xl mb-10">
          Mapped to VIFM&apos;s THINKING / RESULTS / PEOPLE / SELF framework, so a
          candidate&apos;s AI readiness reads in the same language as the rest of your
          competency picture.
        </p>

        <div className="grid gap-5 md:grid-cols-2">
          {ARA_INDIVIDUAL_FACTORS.map((f, i) => (
            <FadeIn key={f.id} delay={i * 80}>
              <div className="ara-tile p-6 h-full" style={{ borderTop: `3px solid ${f.color}` }}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: f.color }} />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    {f.domain}
                  </span>
                  <span className="ms-auto text-[10px] text-muted-foreground tabular-nums">15 items</span>
                </div>
                <h3 className="text-lg font-semibold text-primary">{f.name_en}</h3>
                <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{f.description_en}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* ─── How it runs ─── */}
      <section className="ara-hero-subtle py-16 border-y">
        <div className="max-w-6xl mx-auto px-6">
          <span className="ara-eyebrow">How it runs</span>
          <h2 className="text-3xl font-semibold text-primary mt-3 mb-12 max-w-2xl">
            From a name and an email to a hiring-ready read.
          </h2>
          <div className="grid gap-8 md:grid-cols-3">
            {[
              { n: "1", icon: UserCheck, title: "Create the link", body: "Enter the candidate's name and email. Email them their secure bilingual link, keep it private to run yourself, or open it on the spot to walk through it live." },
              { n: "2", icon: FileText, title: "They complete the deep-dive", body: "The full 60-question Personal assessment across the four VIFM factors, in English or Arabic, in about fifteen minutes." },
              { n: "3", icon: ShieldCheck, title: "You get a selection read", body: "A factor-by-factor profile framed for hiring - descriptive, not coaching - to weigh alongside the rest of your assessment picture." },
            ].map((s) => (
              <div key={s.n}>
                <div className="ara-tile-icon h-9 w-9 rounded-lg flex items-center justify-center mb-3 ara-icon-blue">
                  <s.icon className="h-4 w-4" />
                </div>
                <h3 className="text-sm font-semibold text-primary mb-1">
                  <span className="ara-numeral text-muted-foreground me-1.5">{s.n}.</span>{s.title}
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{s.body}</p>
              </div>
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
          <div className="text-xs text-muted-foreground flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-accent" />
            <span>AI Readiness Compass · Talent Acquisition</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
