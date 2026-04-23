import Link from "next/link";
import {
  ArrowRight, Shield, Users, Link2, Sparkles, CheckCircle2, BarChart3, Globe,
} from "lucide-react";
import { VifmLogo } from "@/components/shared/vifm-logo";

export default function AraRootPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* ─── Hero ─── */}
      <section className="ara-hero relative overflow-hidden">
        <div className="max-w-6xl mx-auto px-6 pt-8 pb-24">
          {/* Top nav */}
          <div className="flex items-center justify-between mb-20">
            <VifmLogo variant="white" size="sm" />
            <Link
              href="/admin"
              className="inline-flex items-center gap-1 text-xs text-white/70 hover:text-white transition-colors"
            >
              Assessment Center <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="max-w-3xl">
            <span className="ara-eyebrow text-accent">
              <Sparkles className="h-3 w-3" />
              VIFM AI Readiness Assessment
            </span>
            <h1 className="ara-numeral text-4xl sm:text-5xl lg:text-6xl font-semibold text-white leading-[1.05] mt-4 mb-6">
              Diagnose, validate, <br className="hidden sm:block" />and guide <span className="text-accent">AI readiness</span> across the GCC.
            </h1>
            <p className="text-lg text-white/75 max-w-2xl leading-relaxed">
              A bilingual consultancy platform calibrated for UAE and Saudi Arabia —
              multi-stakeholder self-assessment, evidence triangulation, consultant
              validation, and a 27-page branded report delivered in English, Arabic,
              or side-by-side bilingual.
            </p>

            <div className="flex flex-wrap gap-3 mt-8">
              <Link
                href="/ara/consultant"
                className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-3 text-sm font-medium text-white hover:bg-accent/90 transition-colors"
              >
                Open consultant dashboard <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/ara/admin"
                className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/5 px-5 py-3 text-sm font-medium text-white hover:bg-white/10 transition-colors backdrop-blur"
              >
                Admin console
              </Link>
            </div>
          </div>

          {/* Floating stat strip */}
          <div className="mt-16 grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: "Pillars", value: "8" },
              { label: "Regulatory frameworks", value: "16" },
              { label: "Compliance requirements", value: "56" },
              { label: "Report pages", value: "27–60" },
            ].map((s) => (
              <div
                key={s.label}
                className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur"
              >
                <div className="ara-numeral text-3xl font-semibold text-white">{s.value}</div>
                <div className="text-[11px] uppercase tracking-widest text-white/60 mt-1">
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Entry points ─── */}
      <section className="max-w-6xl mx-auto px-6 -mt-12 relative z-10 pb-16">
        <div className="grid gap-5 md:grid-cols-3">
          <EntryCard
            href="/ara/consultant"
            icon={Users}
            title="Consultant"
            subtitle="Run engagements"
            description="Create assessments, invite respondents, validate Phase 2 findings, freeze scores, and generate bilingual reports."
            cta="Open dashboard"
          />
          <EntryCard
            href="/ara/admin"
            icon={Shield}
            title="VIFM Admin"
            subtitle="Curate content"
            description="Manage question bank versions, regulatory frameworks, sandbox data, and retention lifecycle."
            cta="Open console"
          />
          <EntryCard
            icon={Link2}
            title="Respondent"
            subtitle="Token-based access"
            description="Stakeholders receive a unique URL — no account required. Bilingual form with auto-save, offline detection, and evidence upload."
            cta="/ara/respond/[token]"
            disabled
          />
        </div>
      </section>

      {/* ─── Capability rail ─── */}
      <section className="ara-hero-subtle py-20 border-y">
        <div className="max-w-6xl mx-auto px-6">
          <span className="ara-eyebrow">Inside the platform</span>
          <h2 className="text-3xl font-semibold text-primary mt-3 mb-12 max-w-2xl">
            Built for Big-4 calibre engagements, priced for VIFM's GCC market.
          </h2>

          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            <CapabilityItem
              icon={BarChart3}
              title="8-pillar scoring engine"
              body="Real-time recalculation across maturity levels, weighted scores, benchmark gaps, perception-vs-reality, and peer medians."
            />
            <CapabilityItem
              icon={Globe}
              title="Bilingual by design"
              body="Full Arabic/English toggle on the respondent form. 3-mode PDF report: EN-only, AR-only, or side-by-side landscape."
            />
            <CapabilityItem
              icon={Shield}
              title="GCC regulatory calibration"
              body="16 frameworks seeded for UAE and Saudi (PDPL, NCA ECC, SDAIA NDGF, DCAI, ADDA, Vision 2030) with 56 mapped requirements."
            />
            <CapabilityItem
              icon={CheckCircle2}
              title="Evidence triangulation"
              body="Gap Detector, Shadow AI Alert, supporting materials upload, AI use case portfolio inventory, and consultant-validated scores."
            />
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
            <span>Module status: Ready for pilot</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function EntryCard({
  href,
  icon: Icon,
  title,
  subtitle,
  description,
  cta,
  disabled,
}: {
  href?: string;
  icon: typeof Users;
  title: string;
  subtitle: string;
  description: string;
  cta: string;
  disabled?: boolean;
}) {
  const body = (
    <div className={`ara-tile p-6 h-full flex flex-col ${disabled ? "opacity-70 pointer-events-none" : ""}`}>
      <div className="h-10 w-10 rounded-lg bg-accent/10 text-accent flex items-center justify-center mb-4">
        <Icon className="h-5 w-5" />
      </div>
      <div className="ara-eyebrow text-muted-foreground mb-1">{subtitle}</div>
      <h3 className="text-xl font-semibold text-primary">{title}</h3>
      <p className="text-sm text-muted-foreground mt-2 flex-1">{description}</p>
      <div className={`mt-4 inline-flex items-center gap-1 text-sm font-medium ${disabled ? "text-muted-foreground" : "text-accent"}`}>
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
  title,
  body,
}: {
  icon: typeof BarChart3;
  title: string;
  body: string;
}) {
  return (
    <div>
      <div className="h-9 w-9 rounded-lg bg-primary/5 text-primary flex items-center justify-center mb-3">
        <Icon className="h-4 w-4" />
      </div>
      <h3 className="text-sm font-semibold text-primary mb-1">{title}</h3>
      <p className="text-xs text-muted-foreground leading-relaxed">{body}</p>
    </div>
  );
}
