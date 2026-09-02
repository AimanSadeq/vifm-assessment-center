import Link from "next/link";
import { ArrowRight, Building2, Layers, User, FileText } from "lucide-react";
import { AraTopBar } from "@/components/shared/ara-top-bar";
import { BackLink } from "@/components/shared/back-link";
import {
  SAMPLE_ORG_NAME,
  SAMPLE_DIVISION_LABEL,
  SAMPLE_DEPARTMENT_LABEL,
} from "@/lib/reports/sample-fixture";

export const metadata = {
  title: "AI Readiness Compass - Sample Reports | VIFM",
  description:
    "The three deliverables of an AI Readiness Compass engagement, rendered live from a sample organisation: department report, division consolidation, individual report. English and Arabic.",
};

/**
 * Public samples landing - one link for business development to share.
 *
 * Decision (2026-09-02): the samples are the three real deliverables, each
 * rendered live from one sandbox fixture through the same code path as a
 * paying client's report, and BD shares ONE page rather than six PDF links.
 * The page frames the three documents as a single engagement journey so a
 * prospect reads the narrative before the documents, and every link on it is
 * a live render - nothing here can differ from what the product produces.
 */

const SAMPLES = [
  {
    href: "/samples/arc-department",
    icon: Building2,
    kicker: "Stage 1 - Department",
    title: "Department report",
    subject: `${SAMPLE_DEPARTMENT_LABEL} · ${SAMPLE_ORG_NAME}`,
    blurb:
      "The complete report one department receives: maturity on each pillar against the 4.00 AI Ready target, the gap heatmap, investment matrix and roadmap, regulatory readiness, and - because this department also ran the individual layer - a Workforce AI Readiness section showing how its people compare with its systems.",
    pages: "About 22 pages",
    arabic: true,
  },
  {
    href: "/samples/arc-division",
    icon: Layers,
    kicker: "Stage 2 - Division",
    title: "Division consolidation",
    subject: `${SAMPLE_DIVISION_LABEL} over ${SAMPLE_DEPARTMENT_LABEL} and Finance`,
    blurb:
      "What a division engagement adds on top of its departments' own reports: the units ranked, every unit against every pillar, the gaps every unit shares (fix once, centrally) versus the pillars where units differ (capability that exists and has not travelled), and the pillars no unit assessed.",
    pages: "5 pages",
    arabic: true,
  },
  {
    href: "/samples/arc-report",
    icon: User,
    kicker: "Individual layer",
    title: "Individual report",
    subject: `One officer in ${SAMPLE_DEPARTMENT_LABEL}`,
    blurb:
      "Delivered to VIFM and the client for each person who completed the individual layer: the four AI-readiness factors with self-rated versus demonstrated sub-scores, strengths, sequenced development priorities, a 30/60/90-day plan, comparison against their unit and organisation, matched VIFM training, and a manager conversation guide.",
    pages: "4 pages",
    arabic: true,
  },
] as const;

export default function SamplesLandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <BackLink href="/ara" label="Back" history />
      <AraTopBar role="public" />

      {/* ─── Hero ─── */}
      <section className="ara-hero relative overflow-hidden">
        <div className="max-w-6xl mx-auto px-6 pt-14 pb-16 relative">
          <div className="max-w-3xl relative z-10">
            <span className="ara-eyebrow text-accent">
              <FileText className="h-3 w-3" />
              Sample reports
            </span>
            <h1 className="ara-numeral text-4xl sm:text-5xl font-semibold text-white leading-[1.05] mt-4 mb-5">
              One engagement. <span className="ara-accent-sweep">Three documents.</span>
            </h1>
            <p className="text-lg text-white/75 max-w-2xl leading-relaxed">
              Every sample below is generated live from one fictional organisation,{" "}
              {SAMPLE_ORG_NAME}, through exactly the code that produces a client&apos;s
              report. Nothing is mocked up: what you open here is what you would
              receive.
            </p>
          </div>
        </div>
      </section>

      {/* ─── The three deliverables ─── */}
      <section className="max-w-6xl mx-auto px-6 -mt-10 relative z-10 pb-12">
        <div className="grid gap-5 md:grid-cols-3">
          {SAMPLES.map((s) => {
            const Icon = s.icon;
            return (
              <article
                key={s.href}
                className="flex flex-col rounded-2xl border border-border bg-card p-6 shadow-sm"
              >
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-accent">
                  <Icon className="h-4 w-4" />
                  {s.kicker}
                </div>
                <h2 className="mt-3 text-xl font-semibold text-primary">{s.title}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{s.subject}</p>
                <p className="mt-4 text-sm leading-relaxed text-foreground/80 flex-1">{s.blurb}</p>
                <p className="mt-4 text-xs text-muted-foreground">{s.pages} · PDF</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    href={`${s.href}?lang=en`}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                  >
                    Open in English <ArrowRight className="h-4 w-4" />
                  </Link>
                  {s.arabic && (
                    <Link
                      href={`${s.href}?lang=ar`}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
                      dir="rtl"
                    >
                      افتح بالعربية
                    </Link>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* ─── How they fit together ─── */}
      <section className="ara-hero-subtle py-14 border-y">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-2xl font-semibold text-primary mb-3">How the three fit together</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            A client usually starts with one department. That department&apos;s report is
            complete on its own. When a second department in the same division is
            assessed, the division consolidation compares them - which is the finding
            no single report can produce. The individual layer can be switched on for
            any department, in which case each person who completes it has their own
            report and the department report gains a workforce section. Each document
            is rendered from the same scored data, so the three never disagree.
          </p>
          <p className="mt-4 text-xs text-muted-foreground">
            Sample data. {SAMPLE_ORG_NAME} is fictional; the respondents and their answers
            are seeded to illustrate the reports and are labelled as such on every page.
            Documents render on request and take a few seconds to open.
          </p>
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section className="max-w-4xl mx-auto px-6 py-14 text-center">
        <h2 className="text-2xl font-semibold text-primary mb-2">See how an engagement is scoped</h2>
        <p className="text-sm text-muted-foreground max-w-xl mx-auto mb-6">
          Standard forms by tier, custom scope, the individual layer, and what each stage
          includes.
        </p>
        <Link
          href="/ara/engage"
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-5 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
        >
          How to engage <ArrowRight className="h-4 w-4" />
        </Link>
      </section>
    </div>
  );
}
