import Link from "next/link";
import {
  ArrowRight, Check, Minus, Sparkles, Users, Building2, Crown, FileDown,
} from "lucide-react";
import { VifmLogo } from "@/components/shared/vifm-logo";
import { getServerT, type ServerT } from "@/lib/i18n/server";
import { CompetencyConfigurator } from "./_components/competency-configurator";
import { BackLink } from "@/components/shared/back-link";

export const metadata = {
  title: "Engage · VIFM Assessment Center",
};

/**
 * Public pricing / comparison page for the VIFM Assessment Center.
 *
 * Mirrors the structure of /ara/engage (the AI Readiness Compass
 * pricing page) so both products share one cohesive engagement
 * narrative across the portal. Three tiers:
 *
 *   1. Single Engagement      - one AC for one role
 *   2. Programme              - hiring or promotion cycle, multiple ACs
 *   3. Strategic Talent Partnership - 12-month embedded retainer
 *
 * Color tones match the Compass palette so AC and ARA feel like one
 * product family.
 */

const TIER_TONES = {
  blue:   { fg: "#5391D5", bgSoft: "rgba(83, 145, 213, 0.08)",  border: "rgba(83, 145, 213, 0.30)",  bgIcon: "rgba(83, 145, 213, 0.10)" },
  violet: { fg: "#7C3AED", bgSoft: "rgba(124, 58, 237, 0.06)", border: "rgba(124, 58, 237, 0.30)",  bgIcon: "rgba(124, 58, 237, 0.10)" },
  gold:   { fg: "#D97706", bgSoft: "rgba(217, 119, 6, 0.06)",  border: "rgba(217, 119, 6, 0.30)",   bgIcon: "rgba(217, 119, 6, 0.12)" },
} as const;

type TierKey = "single" | "programme" | "partnership";

// User-facing strings carry i18n key suffixes resolved against
// acTools.engage.* in the component body (where the server `tr` binding
// is available - named `tr` because `t` is used as the .map() iterator
// variable throughout this file). Non-text fields (href, tone, icon) stay.
const TIERS: Array<{
  key: TierKey;
  number: 1 | 2 | 3;
  /** key suffix into acTools.engage.tiers.* for label/scope/tagline/price/cta */
  k: string;
  ctaHref: string;
  /** Static sample-report PDF served from /public/samples/. Generated
   *  via scripts/build-sample-reports.ts so prospects see exactly the
   *  shape of the deliverable they'll get. */
  sampleHref: string;
  tone: keyof typeof TIER_TONES;
  icon: typeof Users;
  /** Tier-card facts. We deliberately don't sell on page count
   *  ("8 pages / 27 pages") because the reviewer (2026-04-29 voice
   *  note) flagged that as a turn-off - clients care about content,
   *  not length. So `Report` describes what's *in* the report.
   *  `labelKey` -> acTools.engage.fact*, `valueKey` -> acTools.engage.tiers.* */
  facts: Array<{ labelKey: string; valueKey: string }>;
}> = [
  {
    key: "single",
    number: 1,
    k: "single",
    ctaHref: "mailto:contact@viftraining.com?subject=AC%20Single%20Engagement%20Enquiry",
    sampleHref: "/samples/VIFM-AC-Sample-Report-Single.pdf",
    tone: "blue",
    icon: Users,
    facts: [
      { labelKey: "factCandidates",   valueKey: "singleCandidates" },
      { labelKey: "factDrivenBy",     valueKey: "singleDrivenBy" },
      { labelKey: "factAssessorPool", valueKey: "singleAssessorPool" },
      { labelKey: "factReport",       valueKey: "singleReport" },
    ],
  },
  {
    key: "programme",
    number: 2,
    k: "programme",
    ctaHref: "mailto:contact@viftraining.com?subject=AC%20Programme%20Enquiry",
    sampleHref: "/samples/VIFM-AC-Sample-Report-Programme.pdf",
    tone: "violet",
    icon: Building2,
    facts: [
      { labelKey: "factCandidates",   valueKey: "programmeCandidates" },
      { labelKey: "factDrivenBy",     valueKey: "programmeDrivenBy" },
      { labelKey: "factAssessorPool", valueKey: "programmeAssessorPool" },
      { labelKey: "factReport",       valueKey: "programmeReport" },
    ],
  },
  {
    key: "partnership",
    number: 3,
    k: "partnership",
    ctaHref: "mailto:contact@viftraining.com?subject=AC%20Strategic%20Talent%20Partnership%20Enquiry",
    sampleHref: "/samples/VIFM-AC-Sample-Report-Partnership.pdf",
    tone: "gold",
    icon: Crown,
    facts: [
      { labelKey: "factCandidates",   valueKey: "partnershipCandidates" },
      { labelKey: "factDrivenBy",     valueKey: "partnershipDrivenBy" },
      { labelKey: "factAssessorPool", valueKey: "partnershipAssessorPool" },
      { labelKey: "factReport",       valueKey: "partnershipReport" },
    ],
  },
];

// `groupKey` -> acTools.engage.groups.*, `featureKey` -> acTools.engage.features.*.
// Boolean cells render a tick/dash; string cells carry a value key into
// acTools.engage.values.* (resolved in <Cell> via the `tr` passed down).
const CAPABILITIES: Array<{
  groupKey: string;
  featureKey: string;
  single: boolean | string;
  programme: boolean | string;
  partnership: boolean | string;
}> = [
  // Scope
  { groupKey: "scope",          featureKey: "scopedSingleRole",   single: true, programme: true, partnership: true },
  { groupKey: "scope",          featureKey: "multiCohort",        single: false, programme: true, partnership: true },
  { groupKey: "scope",          featureKey: "customFramework",    single: false, programme: false, partnership: true },
  { groupKey: "scope",          featureKey: "bilingualMaterials", single: true, programme: true, partnership: true },

  // Methodology
  { groupKey: "methodology",    featureKey: "frameworkCompetency",     single: true, programme: true, partnership: true },
  { groupKey: "methodology",    featureKey: "trainedPool",             single: "leadAssessors", programme: "leadAssociate", partnership: "dedicated" },
  { groupKey: "methodology",    featureKey: "behaviouralObservation",  single: true, programme: true, partnership: true },
  { groupKey: "methodology",    featureKey: "washupEngine",            single: true, programme: true, partnership: true },
  { groupKey: "methodology",    featureKey: "iccReporting",            single: false, programme: true, partnership: true },
  { groupKey: "methodology",    featureKey: "biasDetection",           single: false, programme: true, partnership: true },

  // Exercises
  { groupKey: "exercises",      featureKey: "inBasket",          single: true, programme: true, partnership: true },
  { groupKey: "exercises",      featureKey: "rolePlay",          single: true, programme: true, partnership: true },
  { groupKey: "exercises",      featureKey: "groupExercise",     single: false, programme: true, partnership: true },
  { groupKey: "exercises",      featureKey: "caseStudy",         single: false, programme: true, partnership: true },
  { groupKey: "exercises",      featureKey: "oralPresentation",  single: false, programme: true, partnership: true },
  { groupKey: "exercises",      featureKey: "cbi",               single: true, programme: true, partnership: true },
  { groupKey: "exercises",      featureKey: "bespokeExercises",  single: false, programme: false, partnership: true },

  // Outputs
  { groupKey: "outputs",        featureKey: "individualReport",  single: true, programme: true, partnership: true },
  { groupKey: "outputs",        featureKey: "oarRecommendation", single: true, programme: true, partnership: true },
  { groupKey: "outputs",        featureKey: "developmentTips",   single: true, programme: true, partnership: true },
  { groupKey: "outputs",        featureKey: "cohortDashboard",   single: false, programme: true, partnership: true },
  { groupKey: "outputs",        featureKey: "quarterlyReview",   single: false, programme: false, partnership: true },
  { groupKey: "outputs",        featureKey: "yoyTrajectory",     single: false, programme: false, partnership: true },

  // Compliance
  { groupKey: "compliance",     featureKey: "iso10667",            single: true, programme: true, partnership: true },
  { groupKey: "compliance",     featureKey: "taskforceGuidelines", single: true, programme: true, partnership: true },
  { groupKey: "compliance",     featureKey: "dataHandling",        single: true, programme: true, partnership: true },
  { groupKey: "compliance",     featureKey: "auditTrail",          single: true, programme: true, partnership: true },
];

export default async function AcEngagePage() {
  const tr = await getServerT();
  return (
    <div className="min-h-screen bg-background">
      <BackLink href="/" label="Back" history />
      {/* ─── Top bar ─── */}
      <header className="border-b bg-card/80 backdrop-blur sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/admin" className="flex items-center gap-2">
            <VifmLogo variant="color" size="sm" />
            <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.15em] text-muted-foreground font-medium border-l ps-3 ms-1">
              <Sparkles className="h-3 w-3 text-accent" />
              {tr("acTools.engage.navAcLabel")}
            </span>
          </Link>
          <Link
            href="/ara"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
          >
            {tr("acTools.engage.navCompass")} <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </header>

      {/* ─── Hero ─── */}
      <section className="ara-hero relative overflow-hidden">
        <div className="max-w-6xl mx-auto px-6 pt-14 pb-20 relative">
          <div className="max-w-3xl relative z-10">
            <span className="ara-eyebrow text-accent">
              <Sparkles className="h-3 w-3" />
              {tr("acTools.engage.heroEyebrow")}
            </span>
            <h1 className="ara-numeral text-4xl sm:text-5xl font-semibold text-white leading-[1.05] mt-4 mb-5">
              {tr("acTools.engage.heroTitlePart1")} <span className="ara-accent-sweep">{tr("acTools.engage.heroTitlePart2")}</span>
            </h1>
            <p className="text-lg text-white/75 max-w-2xl leading-relaxed">
              {tr("acTools.engage.heroBody")}
            </p>
          </div>
        </div>
      </section>

      {/* ─── Competency-count configurator (recommends a tier) ─── */}
      <CompetencyConfigurator />

      {/* ─── Tier cards ─── */}
      <section className="max-w-6xl mx-auto px-6 relative z-10 pb-12">
        <div className="grid gap-5 md:grid-cols-3">
          {TIERS.map((t) => {
            const tone = TIER_TONES[t.tone];
            const Icon = t.icon;
            return (
              <article
                key={t.key}
                className="ara-tile p-6 h-full flex flex-col"
                style={{ borderTop: `3px solid ${tone.fg}` }}
              >
                <div className="flex items-center justify-between mb-4">
                  <div
                    className="ara-tile-icon h-10 w-10 rounded-lg flex items-center justify-center"
                    style={{ background: tone.bgIcon, color: tone.fg }}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <span
                    className="text-[10px] font-semibold uppercase tracking-widest"
                    style={{ color: tone.fg }}
                  >
                    {tr("acTools.engage.tierBadge", { number: t.number })}
                  </span>
                </div>

                <h3 className="text-2xl font-semibold text-primary mb-1">
                  {tr(`acTools.engage.tiers.${t.k}Label`)}
                </h3>
                <p className="text-sm text-muted-foreground mb-3">{tr(`acTools.engage.tiers.${t.k}Scope`)}</p>

                <div className="mb-5">
                  <span
                    className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
                    style={{
                      background: tone.bgSoft,
                      color: tone.fg,
                      border: `1px solid ${tone.border}`,
                    }}
                  >
                    {tr(`acTools.engage.tiers.${t.k}Price`)}
                  </span>
                </div>

                <p className="text-sm text-foreground italic mb-5 leading-relaxed">
                  {tr(`acTools.engage.tiers.${t.k}Tagline`)}
                </p>

                <ul className="text-xs text-muted-foreground space-y-2 mb-6 flex-1">
                  {t.facts.map((f, i) => (
                    <li
                      key={f.labelKey}
                      className={`flex justify-between ${i < t.facts.length - 1 ? "border-b pb-2" : ""}`}
                    >
                      <span>{tr(`acTools.engage.${f.labelKey}`)}</span>
                      <span className="font-semibold text-primary">{tr(`acTools.engage.tiers.${f.valueKey}`)}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  href={t.ctaHref}
                  className="inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium transition-colors w-full"
                  style={{
                    background: tone.bgSoft,
                    color: tone.fg,
                    border: `1px solid ${tone.border}`,
                  }}
                >
                  {tr(`acTools.engage.tiers.${t.k}Cta`)} <ArrowRight className="h-4 w-4" />
                </Link>
                <a
                  href={t.sampleHref}
                  download
                  className="mt-2 inline-flex items-center justify-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  <FileDown className="h-3.5 w-3.5" />
                  {tr("acTools.engage.downloadSample")}
                </a>
              </article>
            );
          })}
        </div>
      </section>

      {/* ─── Capability matrix ─── */}
      <section className="ara-hero-subtle py-16 border-y">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-10 max-w-2xl mx-auto">
            <span className="ara-eyebrow">{tr("acTools.engage.matrixEyebrow")}</span>
            <h2 className="text-3xl font-semibold text-primary mt-3">
              {tr("acTools.engage.matrixTitle")}
            </h2>
            <p className="text-sm text-muted-foreground mt-3">
              {tr("acTools.engage.matrixIntro")}
            </p>
          </div>
          <CapabilityMatrix tr={tr} />
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section className="max-w-4xl mx-auto px-6 py-16 text-center">
        <h2 className="text-3xl font-semibold text-primary mb-3">
          {tr("acTools.engage.ctaTitle")}
        </h2>
        <p className="text-base text-muted-foreground max-w-xl mx-auto mb-8">
          {tr("acTools.engage.ctaBody")}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            href="mailto:contact@viftraining.com?subject=AC%20Engagement%20Enquiry"
            className="ara-pulse inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-3 text-sm font-medium text-white hover:bg-accent/90 transition-colors"
          >
            {tr("acTools.engage.ctaPrimary")} <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/ara/engage"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-5 py-3 text-sm font-medium text-foreground hover:bg-muted transition-colors"
          >
            {tr("acTools.engage.ctaSecondary")}
          </Link>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="border-t bg-card/50">
        <div className="max-w-6xl mx-auto px-6 py-8 text-center text-xs text-muted-foreground">
          <div className="font-medium text-foreground mb-1">
            {tr("acTools.engage.footerName")}
          </div>
          {tr("acTools.engage.footerTagline")}
        </div>
      </footer>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────

function CapabilityMatrix({ tr }: { tr: ServerT }) {
  type Row = (typeof CAPABILITIES)[number];
  const grouped: Array<{ groupKey: string; rows: Row[] }> = [];
  for (const row of CAPABILITIES) {
    const last = grouped[grouped.length - 1];
    if (last && last.groupKey === row.groupKey) last.rows.push(row);
    else grouped.push({ groupKey: row.groupKey, rows: [row] });
  }

  return (
    <div className="rounded-2xl border bg-card overflow-hidden shadow-sm">
      <div
        className="grid items-end border-b bg-card/95 backdrop-blur"
        style={{ gridTemplateColumns: "minmax(220px, 2fr) repeat(3, 1fr)" }}
      >
        <div className="p-4">
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">
            {tr("acTools.engage.capabilityCol")}
          </p>
        </div>
        {TIERS.map((t) => {
          const tone = TIER_TONES[t.tone];
          const Icon = t.icon;
          // Take the part before the first "·" separator for the compact label.
          const priceShort = tr(`acTools.engage.tiers.${t.k}Price`).split("·")[0].trim();
          return (
            <div
              key={t.key}
              className="p-4 text-center border-l"
              style={{ borderTopColor: tone.fg, borderTopWidth: "3px", borderTopStyle: "solid" }}
            >
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <Icon className="h-4 w-4" style={{ color: tone.fg }} />
                <span
                  className="text-[10px] font-semibold uppercase tracking-widest"
                  style={{ color: tone.fg }}
                >
                  {tr("acTools.engage.tierBadge", { number: t.number })}
                </span>
              </div>
              <p className="text-sm font-semibold text-primary">{tr(`acTools.engage.tiers.${t.k}Label`)}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{priceShort}</p>
            </div>
          );
        })}
      </div>

      {grouped.map((g) => (
        <div key={g.groupKey}>
          <div className="px-4 py-2 bg-muted/30 border-b">
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">
              {tr(`acTools.engage.groups.${g.groupKey}`)}
            </p>
          </div>
          {g.rows.map((row, idx) => (
            <div
              key={`${g.groupKey}-${row.featureKey}`}
              className={`grid items-center ${idx > 0 ? "border-t" : ""}`}
              style={{ gridTemplateColumns: "minmax(220px, 2fr) repeat(3, 1fr)" }}
            >
              <div className="p-4 text-sm text-foreground">{tr(`acTools.engage.features.${row.featureKey}`)}</div>
              <Cell value={row.single}      tone="blue"   tr={tr} />
              <Cell value={row.programme}   tone="violet" tr={tr} />
              <Cell value={row.partnership} tone="gold"   tr={tr} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function Cell({ value, tone, tr }: { value: boolean | string; tone: keyof typeof TIER_TONES; tr: ServerT }) {
  const t = TIER_TONES[tone];
  if (value === true) {
    return (
      <div className="p-4 text-center border-l">
        <span
          className="inline-flex items-center justify-center h-6 w-6 rounded-full"
          style={{ background: t.bgIcon, color: t.fg }}
        >
          <Check className="h-3.5 w-3.5" />
        </span>
      </div>
    );
  }
  if (value === false) {
    return (
      <div className="p-4 text-center border-l">
        <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-muted text-muted-foreground/60">
          <Minus className="h-3.5 w-3.5" />
        </span>
      </div>
    );
  }
  return (
    <div className="p-4 text-center border-l">
      <span
        className="inline-block text-xs font-medium px-2 py-1 rounded-md"
        style={{
          background: t.bgSoft,
          color: t.fg,
          border: `1px solid ${t.border}`,
        }}
      >
        {tr(`acTools.engage.values.${value}`)}
      </span>
    </div>
  );
}
