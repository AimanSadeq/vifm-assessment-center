import Link from "next/link";
import {
  Target, Users, ClipboardCheck, Eye, GitMerge, Award, FileText, Recycle,
  Briefcase, BookOpen, Cpu, BarChart3, Globe, ShieldCheck,
  ArrowRight, Sparkles,
} from "lucide-react";
import { VifmLogo } from "@/components/shared/vifm-logo";
import { FadeIn } from "@/components/shared/ara/fade-in";
import { CountUp } from "@/components/shared/ara/count-up";

export const metadata = {
  title: "Roadmap · VIFM Assessment Center",
};

/**
 * Internal-facing storytelling page for the AC. Walks a client (or a
 * new VIFM consultant) through the eight-step Assessment Centre journey
 * in a visual, scannable way.
 *
 * Mirrors the structure of /ara/roadmap so the two products share one
 * visual narrative. Tone-coded steps, FadeIn reveals, CountUp stats.
 */

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

const JOURNEY: Array<{
  icon: typeof Target;
  tone: Tone;
  title: string;
  subtitle: string;
  body: string;
}> = [
  {
    icon: Briefcase, tone: "blue",
    title: "Discover", subtitle: "Brief from the client",
    body: "Define target role, hiring or development objective, candidate population, success criteria, and timeline. Capture the competency profile up front.",
  },
  {
    icon: Target, tone: "violet",
    title: "Calibrate", subtitle: "Competency × exercise matrix",
    body: "Map each in-scope competency to the exercises that will measure it. Every competency lands in at least two exercises - cross-validation by design.",
  },
  {
    icon: BookOpen, tone: "teal",
    title: "Design", subtitle: "Exercises + briefing materials",
    body: "Build or adapt the in-basket, role play, group exercise, case study, oral presentation, and CBI guides. Bilingual EN / AR materials for GCC clients.",
  },
  {
    icon: Users, tone: "gold",
    title: "Recruit & invite", subtitle: "Candidates + assessors",
    body: "Add candidates to the engagement (bulk CSV or one-by-one), assign trained assessors, send branded invite emails with consent, schedule the AC dates.",
  },
  {
    icon: Eye, tone: "emerald",
    title: "Observe", subtitle: "Behavioural evidence capture",
    body: "Assessors run the AC and capture observations against the BARS rubric. Each observation tagged to a competency with positive/negative indicators.",
  },
  {
    icon: GitMerge, tone: "rose",
    title: "Integrate & wash-up", subtitle: "Consensus engine",
    body: "Each assessor consolidates their evidence in the integration worksheet, then the wash-up engine drives multi-rater consensus with live Realtime collaboration.",
  },
  {
    icon: Award, tone: "blue",
    title: "Decide", subtitle: "Overall Assessment Rating",
    body: "Wash-up produces an OAR (1-5) and a recommendation: Ready Now / Ready with Development / Not Ready. ICC computed across the assessor pool.",
  },
  {
    icon: FileText, tone: "violet",
    title: "Report", subtitle: "Branded 6-page deliverable",
    body: "Per-candidate report with cover, executive summary, competency detail (strengths + development areas), and tiered development recommendations.",
  },
  {
    icon: Recycle, tone: "gold",
    title: "Follow-up", subtitle: "Development plans + cohort review",
    body: "Reports released to candidates, cohort analytics shared with the client, and (for Programme / Partnership tiers) a quarterly cohort review with the C-suite.",
  },
];

const ADMIN_ITEMS = [
  { icon: Briefcase,    text: "Engagements (5-step wizard)" },
  { icon: BookOpen,     text: "Exercise library" },
  { icon: Target,       text: "Competency-to-exercise matrix" },
  { icon: Users,        text: "Assessor pool management" },
  { icon: BarChart3,    text: "Engagement analytics" },
];

const ASSESSOR_ITEMS = [
  { icon: Eye,           text: "Observation form (4 tabs)" },
  { icon: ClipboardCheck,text: "Integration worksheets" },
  { icon: GitMerge,      text: "Wash-up consensus (Realtime)" },
  { icon: Award,         text: "OAR finalisation" },
];

const CANDIDATE_ITEMS = [
  { icon: Globe,         text: "Welcome + bilingual consent" },
  { icon: ClipboardCheck,text: "Personalised AC schedule" },
  { icon: FileText,      text: "Released individual report" },
];

const NUMBERS: Array<{ value: number; label: string; tone: Tone }> = [
  { value: 38, label: "Competencies",          tone: "blue" },
  { value: 4,  label: "Domains",               tone: "violet" },
  { value: 8,  label: "Clusters",              tone: "teal" },
  { value: 249,label: "Behavioural indicators",tone: "gold" },
  { value: 114,label: "Development tips",      tone: "emerald" },
  { value: 6,  label: "Exercise types",        tone: "rose" },
  { value: 5,  label: "BARS rating points",    tone: "blue" },
  { value: 6,  label: "Report pages",          tone: "violet" },
];

const EXERCISES: Array<{ name: string; nameAr: string; minutes: string; purpose: string }> = [
  { name: "In-Basket / E-Tray",         nameAr: "صندوق الوارد",       minutes: "60–90", purpose: "Prioritisation, decision-making, written communication, delegation" },
  { name: "Role Play",                  nameAr: "تمثيل الأدوار",       minutes: "30–45", purpose: "Interpersonal influence, coaching, conflict handling, customer focus" },
  { name: "Group Exercise",             nameAr: "تمرين جماعي",        minutes: "45–60", purpose: "Teamwork, leadership, collaboration, persuasion under peer dynamics" },
  { name: "Case Study",                 nameAr: "دراسة حالة",          minutes: "60–90", purpose: "Strategic thinking, analysis, business judgement, structured reasoning" },
  { name: "Oral Presentation",          nameAr: "عرض شفهي",            minutes: "20–30", purpose: "Verbal communication, executive presence, narrative structure" },
  { name: "Competency-Based Interview", nameAr: "مقابلة قائمة على الجدارات", minutes: "45–60", purpose: "Behavioural evidence at depth, biographical pattern, motivation fit" },
];

const COMPLIANCE = [
  { label: "ISO 10667",        body: "Assessment of People in Work and Organizational Settings" },
  { label: "International AC Taskforce", body: "6th Edition Guidelines (2014, with 2024 supplement)" },
  { label: "UAE PDPL",         body: "Federal Decree-Law 45 of 2021" },
  { label: "Saudi PDPL",       body: "Royal Decree M/19, M/148" },
  { label: "GDPR",             body: "EU/UK candidate data" },
];

export default function AcRoadmapPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* ─── Top bar ─── */}
      <header className="border-b bg-card/80 backdrop-blur sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/admin" className="flex items-center gap-2">
            <VifmLogo variant="color" size="sm" />
            <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.15em] text-muted-foreground font-medium border-l ps-3 ms-1">
              <Sparkles className="h-3 w-3 text-accent" />
              Assessment Center
            </span>
          </Link>
          <Link href="/ac/engage" className="text-xs text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1">
            How to engage <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </header>

      {/* ─── Hero ─── */}
      <section className="ara-hero relative overflow-hidden">
        <div className="max-w-6xl mx-auto px-6 pt-14 pb-20 relative">
          <div className="max-w-3xl relative z-10">
            <span className="ara-eyebrow text-accent">
              <Sparkles className="h-3 w-3" />
              Roadmap
            </span>
            <h1 className="ara-numeral text-4xl sm:text-5xl font-semibold text-white leading-[1.05] mt-4 mb-5">
              The VIFM Assessment Center{" "}
              <span className="ara-accent-sweep">on one page.</span>
            </h1>
            <p className="text-lg text-white/75 max-w-2xl leading-relaxed">
              From a client brief to a released candidate report — the full
              nine-step journey, every component that powers it, and the
              standards it&apos;s anchored to.
            </p>
          </div>
        </div>
      </section>

      {/* ─── Journey ─── */}
      <section className="max-w-6xl mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <span className="ara-eyebrow">The journey</span>
          <h2 className="text-3xl font-semibold text-primary mt-3">
            Nine steps, brief to follow-up
          </h2>
          <p className="text-sm text-muted-foreground mt-3 max-w-2xl mx-auto">
            Every Assessment Centre engagement follows the same arc. Each step
            maps to a concrete portal screen, a defined role, and a documented
            artefact.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {JOURNEY.map((s, i) => (
            <FadeIn key={s.title} delay={i * 60}>
              <JourneyCard step={i + 1} total={JOURNEY.length} {...s} />
            </FadeIn>
          ))}
        </div>
      </section>

      {/* ─── Platform map ─── */}
      <section className="ara-hero-subtle py-20 border-y">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <span className="ara-eyebrow">Platform map</span>
            <h2 className="text-3xl font-semibold text-primary mt-3">
              Three roles, one shared engagement
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
            <FadeIn delay={0}>
              <RoleColumn tone="violet" roleIcon={Briefcase} title="VIFM Admin" subtitle="Run the engagement" items={ADMIN_ITEMS} />
            </FadeIn>
            <FadeIn delay={120}>
              <RoleColumn tone="blue"   roleIcon={Eye}        title="Assessor"   subtitle="Observe + integrate"   items={ASSESSOR_ITEMS} />
            </FadeIn>
            <FadeIn delay={240}>
              <RoleColumn tone="teal"   roleIcon={Users}      title="Candidate"  subtitle="Demonstrate competence"items={CANDIDATE_ITEMS} />
            </FadeIn>
          </div>

          {/* Shared engine */}
          <FadeIn delay={360}>
            <div className="rounded-2xl border bg-card p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <span className="ara-eyebrow">Shared engine</span>
                <div className="flex-1 h-px bg-border" />
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Behind every screen</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <EngineItem icon={GitMerge}    tone="blue"    title="Wash-up engine"   body="Realtime multi-rater consensus" />
                <EngineItem icon={Cpu}         tone="violet"  title="ICC computation"  body="Inter-rater reliability" />
                <EngineItem icon={ShieldCheck} tone="emerald" title="Bias detection"   body="Across the assessor pool" />
                <EngineItem icon={FileText}    tone="gold"    title="Report generator" body="React-PDF · 6 pages · brand-styled" />
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

      {/* ─── Exercise library ─── */}
      <section className="ara-hero-subtle py-16 border-y">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-10">
            <span className="ara-eyebrow">Exercise library</span>
            <h2 className="text-3xl font-semibold text-primary mt-3">
              Six exercise types, behaviourally validated
            </h2>
            <p className="text-sm text-muted-foreground mt-3 max-w-2xl mx-auto">
              Every exercise has a defined timing structure (instructions / preparation / meeting), a participant briefing, an assessor guide, and a competency-to-exercise matrix slot.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {EXERCISES.map((e, i) => (
              <FadeIn key={e.name} delay={i * 50}>
                <article className="rounded-xl border bg-card p-5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-accent">{e.minutes} min</span>
                  </div>
                  <h3 className="text-base font-semibold text-primary">{e.name}</h3>
                  <p dir="rtl" className="text-xs text-muted-foreground mt-0.5 mb-3">{e.nameAr}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{e.purpose}</p>
                </article>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Compliance ─── */}
      <section className="max-w-6xl mx-auto px-6 py-16">
        <div className="text-center mb-10">
          <span className="ara-eyebrow">Standards anchored</span>
          <h2 className="text-3xl font-semibold text-primary mt-3">
            Compliant by design
          </h2>
          <p className="text-sm text-muted-foreground mt-3 max-w-2xl mx-auto">
            Every Assessment Centre engagement runs against five published standards. Audit trail on every rating decision, immutable observation log, candidate consent captured before any data collection.
          </p>
        </div>
        <div className="grid md:grid-cols-3 lg:grid-cols-5 gap-3">
          {COMPLIANCE.map((c, i) => (
            <FadeIn key={c.label} delay={i * 60}>
              <div className="rounded-xl border bg-card p-4 h-full">
                <p className="text-[10px] uppercase tracking-widest text-accent font-semibold mb-1.5">
                  {c.label}
                </p>
                <p className="text-xs text-muted-foreground leading-snug">{c.body}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section className="ara-hero py-14 relative overflow-hidden">
        <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
          <span className="ara-eyebrow text-accent">Ready when you are</span>
          <h2 className="ara-numeral text-3xl font-semibold text-white mt-3 mb-4">
            The framework is ready. <br className="hidden sm:block" />
            <span className="ara-accent-sweep">Bring your first cohort.</span>
          </h2>
          <div className="flex flex-wrap justify-center gap-3 mt-6">
            <Link
              href="/ac/engage"
              className="ara-pulse inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-3 text-sm font-medium text-white hover:bg-accent/90 transition-colors"
            >
              See engagement tiers <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/admin"
              className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/5 px-5 py-3 text-sm font-medium text-white hover:bg-white/10 transition-colors backdrop-blur"
            >
              Open admin
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t bg-card/50">
        <div className="max-w-6xl mx-auto px-6 py-8 text-center text-xs text-muted-foreground">
          <div className="font-medium text-foreground mb-1">VIFM Assessment Center</div>
          The Big-4-calibre talent decision platform for the GCC.
        </div>
      </footer>
    </div>
  );
}

// ─── Helpers ───────────────────────────────────────────────────

function JourneyCard({
  step, total, icon: Icon, tone, title, subtitle, body,
}: {
  step: number;
  total: number;
  icon: typeof Target;
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
      <p className="text-sm text-muted-foreground mt-3 leading-relaxed flex-1">{body}</p>
    </div>
  );
}

function RoleColumn({
  tone, roleIcon: RoleIcon, title, subtitle, items,
}: {
  tone: Tone;
  roleIcon: typeof Briefcase;
  title: string;
  subtitle: string;
  items: Array<{ icon: typeof Briefcase; text: string }>;
}) {
  return (
    <div className="ara-tile p-6 h-full flex flex-col">
      <div className={`ara-tile-icon h-11 w-11 rounded-lg flex items-center justify-center mb-4 ${TONE_ICON_CLASS[tone]}`}>
        <RoleIcon className="h-5 w-5" />
      </div>
      <div className="ara-eyebrow text-muted-foreground mb-1">{subtitle}</div>
      <h3 className={`text-xl font-semibold ${TONE_TEXT_CLASS[tone]} mb-4`}>{title}</h3>
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
