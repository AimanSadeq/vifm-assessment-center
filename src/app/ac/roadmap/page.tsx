import Link from "next/link";
import {
  Target, Users, ClipboardCheck, Eye, GitMerge, Award, FileText, Recycle,
  Briefcase, BookOpen, Cpu, BarChart3, Globe, ShieldCheck,
  ArrowRight, Sparkles,
} from "lucide-react";
import { VifmLogo } from "@/components/shared/vifm-logo";
import { FadeIn } from "@/components/shared/ara/fade-in";
import { CountUp } from "@/components/shared/ara/count-up";
import { getServerT, type ServerT } from "@/lib/i18n/server";

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

// Data arrays carry i18n key suffixes (resolved against acTools.roadmap.*
// in the component body where the server `t` is available) instead of
// literal English, so the page renders in EN or AR per the locale cookie.
const JOURNEY: Array<{
  icon: typeof Target;
  tone: Tone;
  key: string;
}> = [
  { icon: Briefcase, tone: "blue",    key: "discover" },
  { icon: Target,    tone: "violet",  key: "calibrate" },
  { icon: BookOpen,  tone: "teal",    key: "design" },
  { icon: Users,     tone: "gold",    key: "recruit" },
  { icon: Eye,       tone: "emerald", key: "observe" },
  { icon: GitMerge,  tone: "rose",    key: "integrate" },
  { icon: Award,     tone: "blue",    key: "decide" },
  { icon: FileText,  tone: "violet",  key: "report" },
  { icon: Recycle,   tone: "gold",    key: "followup" },
];

const ADMIN_ITEMS = [
  { icon: Briefcase,    key: "engagements" },
  { icon: BookOpen,     key: "exerciseLibrary" },
  { icon: Target,       key: "matrix" },
  { icon: Users,        key: "assessorPool" },
  { icon: BarChart3,    key: "analytics" },
];

const ASSESSOR_ITEMS = [
  { icon: Eye,           key: "observationForm" },
  { icon: ClipboardCheck,key: "integrationWorksheets" },
  { icon: GitMerge,      key: "washup" },
  { icon: Award,         key: "oar" },
];

const CANDIDATE_ITEMS = [
  { icon: Globe,         key: "welcome" },
  { icon: ClipboardCheck,key: "schedule" },
  { icon: FileText,      key: "report" },
];

const NUMBERS: Array<{ value: number; labelKey: string; tone: Tone }> = [
  { value: 38, labelKey: "competencies",   tone: "blue" },
  { value: 4,  labelKey: "domains",        tone: "violet" },
  { value: 8,  labelKey: "clusters",       tone: "teal" },
  { value: 249,labelKey: "indicators",     tone: "gold" },
  { value: 114,labelKey: "devTips",        tone: "emerald" },
  { value: 6,  labelKey: "exerciseTypes",  tone: "rose" },
  { value: 5,  labelKey: "barsPoints",     tone: "blue" },
  { value: 6,  labelKey: "reportPages",    tone: "violet" },
];

// `name` and `nameAr` are intentional bilingual labels shown together
// regardless of locale, so they stay literal. Only `purposeKey` is translated.
const EXERCISES: Array<{ name: string; nameAr: string; minutes: string; purposeKey: string }> = [
  { name: "In-Basket / E-Tray",         nameAr: "صندوق الوارد",       minutes: "60–90", purposeKey: "inBasketPurpose" },
  { name: "Role Play",                  nameAr: "تمثيل الأدوار",       minutes: "30–45", purposeKey: "rolePlayPurpose" },
  { name: "Group Exercise",             nameAr: "تمرين جماعي",        minutes: "45–60", purposeKey: "groupPurpose" },
  { name: "Case Study",                 nameAr: "دراسة حالة",          minutes: "60–90", purposeKey: "casePurpose" },
  { name: "Oral Presentation",          nameAr: "عرض شفهي",            minutes: "20–30", purposeKey: "oralPurpose" },
  { name: "Competency-Based Interview", nameAr: "مقابلة قائمة على الجدارات", minutes: "45–60", purposeKey: "cbiPurpose" },
];

// `label` values are standards/legal names kept verbatim; only `bodyKey` translates.
const COMPLIANCE = [
  { label: "ISO 10667",                  bodyKey: "iso10667Body" },
  { label: "International AC Taskforce", bodyKey: "taskforceBody" },
  { label: "UAE PDPL",                   bodyKey: "uaePdplBody" },
  { label: "Saudi PDPL",                 bodyKey: "saudiPdplBody" },
  { label: "GDPR",                       bodyKey: "gdprBody" },
];

export default async function AcRoadmapPage() {
  const t = await getServerT();
  return (
    <div className="min-h-screen bg-background">
      {/* ─── Top bar ─── */}
      <header className="border-b bg-card/80 backdrop-blur sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/admin" className="flex items-center gap-2">
            <VifmLogo variant="color" size="sm" />
            <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.15em] text-muted-foreground font-medium border-l ps-3 ms-1">
              <Sparkles className="h-3 w-3 text-accent" />
              {t("acTools.roadmap.navAcLabel")}
            </span>
          </Link>
          <Link href="/ac/engage" className="text-xs text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1">
            {t("acTools.roadmap.navEngage")} <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </header>

      {/* ─── Hero ─── */}
      <section className="ara-hero relative overflow-hidden">
        <div className="max-w-6xl mx-auto px-6 pt-14 pb-20 relative">
          <div className="max-w-3xl relative z-10">
            <span className="ara-eyebrow text-accent">
              <Sparkles className="h-3 w-3" />
              {t("acTools.roadmap.heroEyebrow")}
            </span>
            <h1 className="ara-numeral text-4xl sm:text-5xl font-semibold text-white leading-[1.05] mt-4 mb-5">
              {t("acTools.roadmap.heroTitlePart1")}{" "}
              <span className="ara-accent-sweep">{t("acTools.roadmap.heroTitlePart2")}</span>
            </h1>
            <p className="text-lg text-white/75 max-w-2xl leading-relaxed">
              {t("acTools.roadmap.heroBody")}
            </p>
          </div>
        </div>
      </section>

      {/* ─── Journey ─── */}
      <section className="max-w-6xl mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <span className="ara-eyebrow">{t("acTools.roadmap.journeyEyebrow")}</span>
          <h2 className="text-3xl font-semibold text-primary mt-3">
            {t("acTools.roadmap.journeyTitle")}
          </h2>
          <p className="text-sm text-muted-foreground mt-3 max-w-2xl mx-auto">
            {t("acTools.roadmap.journeyIntro")}
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {JOURNEY.map((s, i) => (
            <FadeIn key={s.key} delay={i * 60}>
              <JourneyCard
                step={i + 1}
                total={JOURNEY.length}
                icon={s.icon}
                tone={s.tone}
                title={t(`acTools.roadmap.journey.${s.key}Title`)}
                subtitle={t(`acTools.roadmap.journey.${s.key}Subtitle`)}
                body={t(`acTools.roadmap.journey.${s.key}Body`)}
              />
            </FadeIn>
          ))}
        </div>
      </section>

      {/* ─── Platform map ─── */}
      <section className="ara-hero-subtle py-20 border-y">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <span className="ara-eyebrow">{t("acTools.roadmap.platformEyebrow")}</span>
            <h2 className="text-3xl font-semibold text-primary mt-3">
              {t("acTools.roadmap.platformTitle")}
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
            <FadeIn delay={0}>
              <RoleColumn t={t} tone="violet" roleIcon={Briefcase} title={t("acTools.roadmap.roles.adminTitle")} subtitle={t("acTools.roadmap.roles.adminSubtitle")} items={ADMIN_ITEMS} group="adminItems" />
            </FadeIn>
            <FadeIn delay={120}>
              <RoleColumn t={t} tone="blue"   roleIcon={Eye}        title={t("acTools.roadmap.roles.assessorTitle")}   subtitle={t("acTools.roadmap.roles.assessorSubtitle")}   items={ASSESSOR_ITEMS} group="assessorItems" />
            </FadeIn>
            <FadeIn delay={240}>
              <RoleColumn t={t} tone="teal"   roleIcon={Users}      title={t("acTools.roadmap.roles.candidateTitle")}  subtitle={t("acTools.roadmap.roles.candidateSubtitle")} items={CANDIDATE_ITEMS} group="candidateItems" />
            </FadeIn>
          </div>

          {/* Shared engine */}
          <FadeIn delay={360}>
            <div className="rounded-2xl border bg-card p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <span className="ara-eyebrow">{t("acTools.roadmap.sharedEngine")}</span>
                <div className="flex-1 h-px bg-border" />
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{t("acTools.roadmap.behindEveryScreen")}</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <EngineItem icon={GitMerge}    tone="blue"    title={t("acTools.roadmap.engine.washupTitle")}   body={t("acTools.roadmap.engine.washupBody")} />
                <EngineItem icon={Cpu}         tone="violet"  title={t("acTools.roadmap.engine.iccTitle")}  body={t("acTools.roadmap.engine.iccBody")} />
                <EngineItem icon={ShieldCheck} tone="emerald" title={t("acTools.roadmap.engine.biasTitle")}   body={t("acTools.roadmap.engine.biasBody")} />
                <EngineItem icon={FileText}    tone="gold"    title={t("acTools.roadmap.engine.reportTitle")} body={t("acTools.roadmap.engine.reportBody")} />
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ─── By the numbers ─── */}
      <section className="max-w-6xl mx-auto px-6 py-16">
        <div className="text-center mb-10">
          <span className="ara-eyebrow">{t("acTools.roadmap.glanceEyebrow")}</span>
          <h2 className="text-3xl font-semibold text-primary mt-3">
            {t("acTools.roadmap.glanceTitle")}
          </h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
          {NUMBERS.map((n, i) => (
            <FadeIn key={n.labelKey} delay={i * 50}>
              <div className={`rounded-xl border p-4 text-center ${TONE_BG_CLASS[n.tone]}`}>
                <div className={`ara-numeral text-3xl font-semibold ${TONE_TEXT_CLASS[n.tone]}`}>
                  <CountUp value={n.value} />
                </div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1.5">
                  {t(`acTools.roadmap.numbers.${n.labelKey}`)}
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
            <span className="ara-eyebrow">{t("acTools.roadmap.exerciseEyebrow")}</span>
            <h2 className="text-3xl font-semibold text-primary mt-3">
              {t("acTools.roadmap.exerciseTitle")}
            </h2>
            <p className="text-sm text-muted-foreground mt-3 max-w-2xl mx-auto">
              {t("acTools.roadmap.exerciseIntro")}
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {EXERCISES.map((e, i) => (
              <FadeIn key={e.name} delay={i * 50}>
                <article className="rounded-xl border bg-card p-5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-accent">{t("acTools.roadmap.minutesSuffix", { range: e.minutes })}</span>
                  </div>
                  <h3 className="text-base font-semibold text-primary">{e.name}</h3>
                  <p dir="rtl" className="text-xs text-muted-foreground mt-0.5 mb-3">{e.nameAr}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{t(`acTools.roadmap.exercisesLib.${e.purposeKey}`)}</p>
                </article>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Compliance ─── */}
      <section className="max-w-6xl mx-auto px-6 py-16">
        <div className="text-center mb-10">
          <span className="ara-eyebrow">{t("acTools.roadmap.complianceEyebrow")}</span>
          <h2 className="text-3xl font-semibold text-primary mt-3">
            {t("acTools.roadmap.complianceTitle")}
          </h2>
          <p className="text-sm text-muted-foreground mt-3 max-w-2xl mx-auto">
            {t("acTools.roadmap.complianceIntro")}
          </p>
        </div>
        <div className="grid md:grid-cols-3 lg:grid-cols-5 gap-3">
          {COMPLIANCE.map((c, i) => (
            <FadeIn key={c.label} delay={i * 60}>
              <div className="rounded-xl border bg-card p-4 h-full">
                <p className="text-[10px] uppercase tracking-widest text-accent font-semibold mb-1.5">
                  {c.label}
                </p>
                <p className="text-xs text-muted-foreground leading-snug">{t(`acTools.roadmap.compliance.${c.bodyKey}`)}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section className="ara-hero py-14 relative overflow-hidden">
        <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
          <span className="ara-eyebrow text-accent">{t("acTools.roadmap.ctaEyebrow")}</span>
          <h2 className="ara-numeral text-3xl font-semibold text-white mt-3 mb-4">
            {t("acTools.roadmap.ctaTitlePart1")} <br className="hidden sm:block" />
            <span className="ara-accent-sweep">{t("acTools.roadmap.ctaTitlePart2")}</span>
          </h2>
          <div className="flex flex-wrap justify-center gap-3 mt-6">
            <Link
              href="/ac/engage"
              className="ara-pulse inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-3 text-sm font-medium text-white hover:bg-accent/90 transition-colors"
            >
              {t("acTools.roadmap.ctaSeeTiers")} <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/admin"
              className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/5 px-5 py-3 text-sm font-medium text-white hover:bg-white/10 transition-colors backdrop-blur"
            >
              {t("acTools.roadmap.ctaOpenAdmin")}
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t bg-card/50">
        <div className="max-w-6xl mx-auto px-6 py-8 text-center text-xs text-muted-foreground">
          <div className="font-medium text-foreground mb-1">{t("acTools.roadmap.footerName")}</div>
          {t("acTools.roadmap.footerTagline")}
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
  t, tone, roleIcon: RoleIcon, title, subtitle, items, group,
}: {
  t: ServerT;
  tone: Tone;
  roleIcon: typeof Briefcase;
  title: string;
  subtitle: string;
  items: Array<{ icon: typeof Briefcase; key: string }>;
  group: string;
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
            <li key={item.key} className="flex items-center gap-2.5 text-sm text-muted-foreground">
              <ItemIcon className="h-3.5 w-3.5 text-muted-foreground/70 flex-shrink-0" />
              {t(`acTools.roadmap.${group}.${item.key}`)}
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
