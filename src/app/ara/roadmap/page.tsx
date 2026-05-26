import Link from "next/link";
import {
  Compass, Users, ClipboardCheck, Layers, BarChart3, FileText, Recycle,
  Shield, Database, Building2, FileClock, FlaskConical,
  Globe, CheckCircle2, AlertTriangle, TrendingUp,
  Sparkles, ArrowRight, Link2,
} from "lucide-react";
import { AraTopBar } from "@/components/shared/ara-top-bar";
import { AnimatedCompass } from "@/components/shared/ara/animated-compass";
import { FadeIn } from "@/components/shared/ara/fade-in";
import { CountUp } from "@/components/shared/ara/count-up";

export const metadata = {
  title: "Portal Roadmap",
};

type Tone = "blue" | "violet" | "teal" | "gold" | "emerald" | "rose";

const TONE_ICON_CLASS: Record<Tone, string> = {
  blue: "ara-icon-blue",
  violet: "ara-icon-violet",
  teal: "ara-icon-teal",
  gold: "ara-icon-gold",
  emerald: "ara-icon-emerald",
  rose: "ara-icon-rose",
};

const TONE_TEXT_CLASS: Record<Tone, string> = {
  blue: "text-accent",
  violet: "text-[#7C3AED]",
  teal: "text-[#0D9488]",
  gold: "text-[#D97706]",
  emerald: "text-[#059669]",
  rose: "text-[#E11D48]",
};

const TONE_BG_CLASS: Record<Tone, string> = {
  blue: "bg-accent/5 border-accent/20",
  violet: "bg-[#7C3AED]/5 border-[#7C3AED]/20",
  teal: "bg-[#0D9488]/5 border-[#0D9488]/20",
  gold: "bg-[#D97706]/5 border-[#D97706]/20",
  emerald: "bg-[#059669]/5 border-[#059669]/20",
  rose: "bg-[#E11D48]/5 border-[#E11D48]/20",
};

// ───────────────────────────────────────────────────────────────
// Data - a single source of truth for the roadmap page. Keep it
// terse; each array is designed to fit on-screen without scrolling
// trauma while still covering every shipped component.
// ───────────────────────────────────────────────────────────────

const JOURNEY: Array<{
  icon: typeof Compass;
  tone: Tone;
  title: string;
  subtitle: string;
  body: string;
}> = [
  {
    icon: Compass, tone: "blue",
    title: "Discover", subtitle: "Consultant creates",
    body: "Select client organization, region, sector, language, and activate the published question bank version.",
  },
  {
    icon: Users, tone: "violet",
    title: "Invite", subtitle: "Token-based access",
    body: "Each stakeholder receives a unique URL. No login, no account, no friction - tokens tracked in ara_respondents.",
  },
  {
    icon: ClipboardCheck, tone: "teal",
    title: "Gather", subtitle: "Multi-stakeholder input",
    body: "Bilingual questionnaire across 8 pillars. Auto-save, offline detection, supporting materials, AI use case portfolio.",
  },
  {
    icon: Layers, tone: "gold",
    title: "Validate", subtitle: "Phase 2 workshop",
    body: "Consultant-entered perception-vs-reality scores. Gap Detector flags disagreement, Shadow AI Alert fires on risk patterns.",
  },
  {
    icon: BarChart3, tone: "emerald",
    title: "Score", subtitle: "Seven-layer engine",
    body: "Raw, weighted, overall, benchmark gap, perception gap, peer-relative, maturity band - all recomputed in real time.",
  },
  {
    icon: FileText, tone: "rose",
    title: "Report", subtitle: "Branded bilingual PDF",
    body: "Puppeteer-rendered. Three modes: English-only, Arabic-only, or side-by-side landscape bilingual.",
  },
  {
    icon: Recycle, tone: "blue",
    title: "Recur", subtitle: "Annual reassessment",
    body: "Year-on-year trajectory, archive lifecycle, 3-year retention with GDPR and PDPL compliance.",
  },
];

const ADMIN_ITEMS = [
  { icon: Building2, text: "Organizations CRUD" },
  { icon: Database, text: "Question Bank versioning" },
  { icon: FileText, text: "Regulatory frameworks" },
  { icon: FlaskConical, text: "Sandbox data management" },
  { icon: FileClock, text: "Retention lifecycle" },
];

const CONSULTANT_ITEMS = [
  { icon: Compass, text: "Assessment dashboard" },
  { icon: Users, text: "Respondent management" },
  { icon: Layers, text: "Phase 2 validation tools" },
  { icon: AlertTriangle, text: "Gap Detector + Shadow AI" },
  { icon: TrendingUp, text: "Peer benchmarks + YoY" },
  { icon: FileText, text: "Report generation (3 modes)" },
];

const RESPONDENT_ITEMS = [
  { icon: Globe, text: "Bilingual EN / AR toggle" },
  { icon: ClipboardCheck, text: "Pillar-scoped questionnaire" },
  { icon: FileText, text: "Supporting materials upload" },
  { icon: Sparkles, text: "AI use case portfolio" },
  { icon: CheckCircle2, text: "Auto-save + offline banner" },
];

const NUMBERS: Array<{ value: number; label: string; tone: Tone }> = [
  { value: 8,  label: "Pillars",          tone: "blue" },
  { value: 15, label: "Frameworks",       tone: "violet" },
  { value: 56, label: "Requirements",     tone: "teal" },
  { value: 5,  label: "Maturity levels",  tone: "gold" },
  { value: 7,  label: "Scoring layers",   tone: "emerald" },
  { value: 2,  label: "Languages",        tone: "rose" },
  { value: 3,  label: "Report modes",     tone: "blue" },
  { value: 60, label: "Max report pages", tone: "violet" },
];

const UAE_FRAMEWORKS = [
  "UAE Personal Data Protection Law",
  "UAE National AI Strategy 2031",
  "UAE AI Charter (2024, 12 principles)",
  "UAE AI Ethics Guide (2022)",
  "TDRA Digital Government Regulations",
  "Dubai Centre for AI (DCAI) Guidelines",
  "Abu Dhabi Digital Authority (ADDA) Standards",
];

const SAUDI_FRAMEWORKS = [
  "Saudi Personal Data Protection Law",
  "SDAIA National Data Governance Framework",
  "NCA Essential Cybersecurity Controls (ECC-2:2024)",
  "NCA Cloud Cybersecurity Controls (CCC-2:2024)",
  "SDAIA AI Ethics Principles (2023 v2)",
  "SDAIA AI Adoption Framework (2024)",
  "Saudi Vision 2030 - AI Targets",
  "SDAIA Generative AI Guidelines (2024)",
];

const MILESTONES: Array<{ id: string; title: string; body: string }> = [
  { id: "M1", title: "Foundation",    body: "Schema, consultant role, nav" },
  { id: "M2", title: "Core CRUD",     body: "Orgs, assessments, questions" },
  { id: "M3", title: "Scoring",       body: "Respondent form + 7-layer engine" },
  { id: "M4", title: "Consultant",    body: "Phase 2 tools, compliance, YoY" },
  { id: "M5", title: "Reports",       body: "Bilingual PDF (EN/AR/side-by-side)" },
  { id: "M6", title: "Lifecycle",     body: "Retention, sandbox, reassessment" },
];

// ───────────────────────────────────────────────────────────────

export default function AraRoadmapPage() {
  return (
    <div className="min-h-screen bg-background">
      <AraTopBar role="consultant" />

      {/* ─── Hero ─── */}
      <section className="ara-hero relative overflow-hidden">
        <div className="max-w-6xl mx-auto px-6 pt-14 pb-20 relative">
          {/* Floating compass */}
          <div className="pointer-events-none hidden lg:block absolute top-8 right-0 w-[340px] h-[340px] opacity-80">
            <AnimatedCompass className="w-full h-full" />
          </div>

          <div className="max-w-3xl relative z-10">
            <span className="ara-eyebrow text-accent">
              <Sparkles className="h-3 w-3" />
              Platform Roadmap
            </span>
            <h1 className="ara-numeral text-4xl sm:text-5xl font-semibold text-white leading-[1.05] mt-4 mb-5">
              One page. <span className="ara-accent-sweep">Every moving part.</span>
            </h1>
            <p className="text-lg text-white/75 max-w-2xl leading-relaxed">
              From the moment a consultant creates an assessment to the moment a
              client opens their bilingual PDF, this is the full journey of the
              AI Readiness Compass - and every component that powers it.
            </p>
          </div>
        </div>
      </section>

      {/* ─── Four engagement stages (Personal + 3 org tiers) ─── */}
      <section className="max-w-6xl mx-auto px-6 py-14">
        <div className="text-center mb-10">
          <span className="ara-eyebrow">How to engage</span>
          <h2 className="text-3xl font-semibold text-primary mt-3">
            Four stages. One Compass.
          </h2>
          <p className="text-sm text-muted-foreground mt-3 max-w-2xl mx-auto">
            Same diagnostic engine, scope that scales. Start with a
            complimentary Personal Snapshot or a complimentary Department
            assessment, then expand to Division and Enterprise when ready.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Personal",   name: "Personal",   scope: "One person, self-served",            price: "Complimentary", metric: "4 personal factors", color: "#0D9488" },
            { label: "Stage 1",    name: "Department", scope: "One department",                     price: "Complimentary", metric: "4 of 8 pillars · you choose",  color: "#0D9488" },
            { label: "Stage 2",    name: "Division",   scope: "A division of several departments",  price: "Fee-based",     metric: "6 of 8 pillars · you choose",  color: "#7C3AED" },
            { label: "Stage 3",    name: "Enterprise", scope: "The whole organisation, board-level", price: "Fee-based",    metric: "All 8 pillars",                 color: "#D97706" },
          ].map((s) => (
            <div
              key={s.name}
              className="ara-tile p-5 flex flex-col"
              style={{ borderTop: `3px solid ${s.color}` }}
            >
              <div className="flex items-center justify-between mb-2">
                <span
                  className="text-[10px] font-semibold uppercase tracking-widest"
                  style={{ color: s.color }}
                >
                  {s.label}
                </span>
                <span
                  className="text-[10px] font-semibold uppercase tracking-widest"
                  style={{ color: s.color }}
                >
                  {s.price}
                </span>
              </div>
              <h3 className="text-lg font-semibold text-primary">{s.name}</h3>
              <p className="text-xs text-muted-foreground mt-1 mb-3">{s.scope}</p>
              <div className="text-[11px] text-muted-foreground mt-auto">
                <span className="font-semibold text-primary ara-numeral">{s.metric}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="text-center mt-6">
          <Link
            href="/ara/engage"
            className="inline-flex items-center gap-1 text-sm text-accent hover:underline"
          >
            See the full comparison →
          </Link>
        </div>
      </section>

      {/* ─── The Journey ─── */}
      <section className="max-w-6xl mx-auto px-6 py-16 border-t">
        <div className="text-center mb-12">
          <span className="ara-eyebrow">The journey</span>
          <h2 className="text-3xl font-semibold text-primary mt-3">
            Seven steps, discovery to delivery
          </h2>
          <p className="text-sm text-muted-foreground mt-3 max-w-2xl mx-auto">
            Every engagement follows the same arc. Each step maps to a concrete
            screen, a concrete actor, and a concrete outcome.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {JOURNEY.map((s, i) => (
            <FadeIn key={s.title} delay={i * 70}>
              <JourneyCard step={i + 1} total={JOURNEY.length} {...s} />
            </FadeIn>
          ))}
        </div>
      </section>

      {/* ─── Platform map - three roles + shared engine ─── */}
      <section className="ara-hero-subtle py-20 border-y">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <span className="ara-eyebrow">Platform map</span>
            <h2 className="text-3xl font-semibold text-primary mt-3">
              Three roles, one shared engine
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
            <FadeIn delay={0}>
              <RoleColumn
                tone="violet"
                roleIcon={Shield}
                title="VIFM Admin"
                subtitle="Curate content"
                items={ADMIN_ITEMS}
              />
            </FadeIn>
            <FadeIn delay={120}>
              <RoleColumn
                tone="blue"
                roleIcon={Users}
                title="Consultant"
                subtitle="Run engagements"
                items={CONSULTANT_ITEMS}
              />
            </FadeIn>
            <FadeIn delay={240}>
              <RoleColumn
                tone="teal"
                roleIcon={Link2}
                title="Respondent"
                subtitle="Contribute data"
                items={RESPONDENT_ITEMS}
              />
            </FadeIn>
          </div>

          {/* Shared engine band - visually anchored under the three roles */}
          <FadeIn delay={360}>
            <div className="rounded-2xl border bg-card p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <span className="ara-eyebrow">Shared engine</span>
                <div className="flex-1 h-px bg-border" />
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  Behind every screen
                </span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <EngineItem icon={BarChart3}    tone="blue"    title="Scoring engine"  body="7-layer computation, perception-vs-reality" />
                <EngineItem icon={Shield}       tone="emerald" title="Compliance"      body="16 frameworks, 56 requirements" />
                <EngineItem icon={TrendingUp}   tone="gold"    title="Peer benchmarks" body="Sector medians, YoY trajectory" />
                <EngineItem icon={FileClock}    tone="rose"    title="Retention"       body="3-year purge, GDPR / PDPL compliant" />
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ─── By the numbers ─── */}
      <section className="max-w-6xl mx-auto px-6 py-16">
        <div className="text-center mb-10">
          <span className="ara-eyebrow">At a glance</span>
          <h2 className="text-3xl font-semibold text-primary mt-3">
            By the numbers
          </h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
          {NUMBERS.map((n, i) => (
            <FadeIn key={n.label} delay={i * 50}>
              <div className={`rounded-xl border p-4 text-center ${TONE_BG_CLASS[n.tone]}`}>
                <div className={`ara-numeral text-3xl font-semibold ${TONE_TEXT_CLASS[n.tone]}`}>
                  <CountUp value={n.value} />
                </div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1.5">
                  {n.label}
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* ─── Regulatory coverage ─── */}
      <section className="ara-hero-subtle py-16 border-y">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-10">
            <span className="ara-eyebrow">Regulatory coverage</span>
            <h2 className="text-3xl font-semibold text-primary mt-3">
              15 GCC frameworks mapped to 56 requirements
            </h2>
            <p className="text-sm text-muted-foreground mt-3 max-w-2xl mx-auto">
              Clients only ever see frameworks applicable to their region, enforced
              at both the query layer and the report layer - no cross-contamination.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-5">
            <FadeIn delay={0}>
              <RegionCard
                region="United Arab Emirates"
                count={7}
                tone="blue"
                frameworks={UAE_FRAMEWORKS}
              />
            </FadeIn>
            <FadeIn delay={120}>
              <RegionCard
                region="Kingdom of Saudi Arabia"
                count={8}
                tone="emerald"
                frameworks={SAUDI_FRAMEWORKS}
              />
            </FadeIn>
          </div>
        </div>
      </section>

      {/* ─── Build milestones ─── */}
      <section className="max-w-6xl mx-auto px-6 py-16">
        <div className="text-center mb-10">
          <span className="ara-eyebrow">Build status</span>
          <h2 className="text-3xl font-semibold text-primary mt-3">
            M1 through M6: all milestones shipped
          </h2>
          <p className="text-sm text-muted-foreground mt-3 max-w-2xl mx-auto">
            Six development phases, now ready for pilot. Production cutover is a
            single flag in <code className="bg-muted px-1.5 py-0.5 rounded text-xs">src/lib/auth/config.ts</code>.
          </p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {MILESTONES.map((m, i) => (
            <FadeIn key={m.id} delay={i * 60}>
              <div className="rounded-xl border p-4 bg-card">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">
                    {m.id}
                  </div>
                  <CheckCircle2 className="h-3.5 w-3.5 text-[#059669]" />
                </div>
                <div className="text-sm font-semibold text-primary">
                  {m.title}
                </div>
                <div className="text-xs text-muted-foreground mt-1 leading-snug">
                  {m.body}
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* ─── CTA footer ─── */}
      <section className="ara-hero py-14 relative overflow-hidden">
        <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
          <span className="ara-eyebrow text-accent">Ready when you are</span>
          <h2 className="ara-numeral text-3xl font-semibold text-white mt-3 mb-4">
            The Compass is calibrated. <br className="hidden sm:block" />
            <span className="ara-accent-sweep">Point it at your first client.</span>
          </h2>
          <div className="flex flex-wrap justify-center gap-3 mt-6">
            <Link
              href="/ara/consultant"
              className="ara-pulse inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-3 text-sm font-medium text-white hover:bg-accent/90 transition-colors"
            >
              Open consultant dashboard <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/ara"
              className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/5 px-5 py-3 text-sm font-medium text-white hover:bg-white/10 transition-colors backdrop-blur"
            >
              Back to portal home
            </Link>
          </div>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="border-t bg-card/50">
        <div className="max-w-6xl mx-auto px-6 py-8 text-center text-xs text-muted-foreground">
          <div className="font-medium text-foreground mb-1">
            VIFM AI Readiness Compass
          </div>
          Know where you stand. Know where to go.
        </div>
      </footer>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────
// Helper components
// ───────────────────────────────────────────────────────────────

function JourneyCard({
  step, total, icon: Icon, tone, title, subtitle, body,
}: {
  step: number;
  total: number;
  icon: typeof Compass;
  tone: Tone;
  title: string;
  subtitle: string;
  body: string;
}) {
  return (
    <div className="ara-tile p-5 h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <div className={`ara-tile-icon h-10 w-10 rounded-lg flex items-center justify-center ${TONE_ICON_CLASS[tone]}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="ara-numeral text-[10px] font-medium text-muted-foreground tracking-widest">
          {String(step).padStart(2, "0")} / {String(total).padStart(2, "0")}
        </div>
      </div>
      <h3 className="text-lg font-semibold text-primary">{title}</h3>
      <p className={`text-[11px] uppercase tracking-wider mt-0.5 ${TONE_TEXT_CLASS[tone]}`}>
        {subtitle}
      </p>
      <p className="text-sm text-muted-foreground mt-3 leading-relaxed flex-1">
        {body}
      </p>
    </div>
  );
}

function RoleColumn({
  tone, roleIcon: RoleIcon, title, subtitle, items,
}: {
  tone: Tone;
  roleIcon: typeof Shield;
  title: string;
  subtitle: string;
  items: Array<{ icon: typeof Shield; text: string }>;
}) {
  return (
    <div className="ara-tile p-6 h-full flex flex-col">
      <div className={`ara-tile-icon h-11 w-11 rounded-lg flex items-center justify-center mb-4 ${TONE_ICON_CLASS[tone]}`}>
        <RoleIcon className="h-5 w-5" />
      </div>
      <div className="ara-eyebrow text-muted-foreground mb-1">{subtitle}</div>
      <h3 className={`text-xl font-semibold ${TONE_TEXT_CLASS[tone]} mb-4`}>
        {title}
      </h3>
      <ul className="space-y-2.5 flex-1">
        {items.map((item) => {
          const ItemIcon = item.icon;
          return (
            <li key={item.text} className="flex items-center gap-2.5 text-sm text-muted-foreground">
              <ItemIcon className="h-3.5 w-3.5 text-muted-foreground/70 flex-shrink-0" />
              {item.text}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function EngineItem({
  icon: Icon, tone, title, body,
}: {
  icon: typeof BarChart3;
  tone: Tone;
  title: string;
  body: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className={`h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0 ${TONE_ICON_CLASS[tone]}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <div className="text-sm font-semibold text-primary">{title}</div>
        <div className="text-xs text-muted-foreground leading-snug mt-0.5">{body}</div>
      </div>
    </div>
  );
}

function RegionCard({
  region, count, tone, frameworks,
}: {
  region: string;
  count: number;
  tone: Tone;
  frameworks: string[];
}) {
  return (
    <div className="ara-tile p-6 h-full">
      <div className="flex items-start justify-between mb-5">
        <div>
          <div className={`ara-eyebrow ${TONE_TEXT_CLASS[tone]}`}>Region</div>
          <h3 className="text-xl font-semibold text-primary mt-1">{region}</h3>
        </div>
        <div className={`ara-numeral text-4xl font-semibold ${TONE_TEXT_CLASS[tone]}`}>
          {count}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {frameworks.map((f) => (
          <span
            key={f}
            className={`text-xs px-2.5 py-1 rounded-md border ${TONE_BG_CLASS[tone]}`}
          >
            {f}
          </span>
        ))}
      </div>
    </div>
  );
}
