import Link from "next/link";
import {
  ArrowRight, Check, Minus, Sparkles, Users, Building2, Crown,
} from "lucide-react";
import { VifmLogo } from "@/components/shared/vifm-logo";

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

const TIERS: Array<{
  key: TierKey;
  number: 1 | 2 | 3;
  label: string;
  scope: string;
  tagline: string;
  price: string;
  cta: string;
  ctaHref: string;
  tone: keyof typeof TIER_TONES;
  icon: typeof Users;
  facts: Array<{ label: string; value: string }>;
}> = [
  {
    key: "single",
    number: 1,
    label: "Single Engagement",
    scope: "One Assessment Centre, one role, ≤ 6 candidates",
    tagline: "Start with a discrete hiring or promotion decision.",
    price: "Fee-based engagement",
    cta: "Talk to a consultant",
    ctaHref: "mailto:contact@viftraining.com?subject=AC%20Single%20Engagement%20Enquiry",
    tone: "blue",
    icon: Users,
    facts: [
      { label: "Candidates",   value: "Up to 6" },
      { label: "Exercises",    value: "3–4" },
      { label: "Assessor pool", value: "2–3 lead assessors" },
      { label: "Report",       value: "6-page individual" },
    ],
  },
  {
    key: "programme",
    number: 2,
    label: "Programme",
    scope: "Multiple Assessment Centres in a hiring or promotion cycle",
    tagline: "Cohort-based talent decisions across roles or functions.",
    price: "Fee-based · volume-discounted",
    cta: "Discuss a programme",
    ctaHref: "mailto:contact@viftraining.com?subject=AC%20Programme%20Enquiry",
    tone: "violet",
    icon: Building2,
    facts: [
      { label: "Candidates",   value: "20–60" },
      { label: "Exercises",    value: "4–6 per cohort" },
      { label: "Assessor pool", value: "Lead + Associate" },
      { label: "Report",       value: "Individual + cohort analytics" },
    ],
  },
  {
    key: "partnership",
    number: 3,
    label: "Strategic Talent Partnership",
    scope: "12-month embedded engagement with a custom competency framework",
    tagline: "Make assessment a continuous capability, not a project.",
    price: "Premium retainer",
    cta: "Explore partnership",
    ctaHref: "mailto:contact@viftraining.com?subject=AC%20Strategic%20Talent%20Partnership%20Enquiry",
    tone: "gold",
    icon: Crown,
    facts: [
      { label: "Candidates",   value: "Unlimited" },
      { label: "Exercises",    value: "Library + bespoke" },
      { label: "Assessor pool", value: "Dedicated team" },
      { label: "Report",       value: "Branded + quarterly cohort reviews" },
    ],
  },
];

const CAPABILITIES: Array<{
  group: string;
  feature: string;
  single: boolean | string;
  programme: boolean | string;
  partnership: boolean | string;
}> = [
  // Scope
  { group: "Scope",          feature: "Scoped to a single role / decision", single: true, programme: true, partnership: true },
  { group: "Scope",          feature: "Multi-cohort across roles",          single: false, programme: true, partnership: true },
  { group: "Scope",          feature: "Custom competency framework",        single: false, programme: false, partnership: true },
  { group: "Scope",          feature: "Bilingual EN / AR materials",        single: true, programme: true, partnership: true },

  // Methodology
  { group: "Methodology",    feature: "VIFM 38-competency framework",       single: true, programme: true, partnership: true },
  { group: "Methodology",    feature: "Trained assessor pool",              single: "2–3", programme: "Lead + Associate", partnership: "Dedicated" },
  { group: "Methodology",    feature: "Behavioural observation + BARS rating", single: true, programme: true, partnership: true },
  { group: "Methodology",    feature: "Wash-up consensus engine",           single: true, programme: true, partnership: true },
  { group: "Methodology",    feature: "Inter-rater reliability (ICC) reporting", single: false, programme: true, partnership: true },
  { group: "Methodology",    feature: "Bias detection across assessor pool", single: false, programme: true, partnership: true },

  // Exercises
  { group: "Exercises",      feature: "In-Basket / E-Tray",                 single: true, programme: true, partnership: true },
  { group: "Exercises",      feature: "Role Play",                          single: true, programme: true, partnership: true },
  { group: "Exercises",      feature: "Group Exercise",                     single: false, programme: true, partnership: true },
  { group: "Exercises",      feature: "Case Study",                         single: false, programme: true, partnership: true },
  { group: "Exercises",      feature: "Oral Presentation",                  single: false, programme: true, partnership: true },
  { group: "Exercises",      feature: "Competency-Based Interview",         single: true, programme: true, partnership: true },
  { group: "Exercises",      feature: "Bespoke exercises commissioned for the client", single: false, programme: false, partnership: true },

  // Outputs
  { group: "Outputs",        feature: "Individual candidate report (6 pages)", single: true, programme: true, partnership: true },
  { group: "Outputs",        feature: "OAR + recommendation",               single: true, programme: true, partnership: true },
  { group: "Outputs",        feature: "Development tips per competency",    single: true, programme: true, partnership: true },
  { group: "Outputs",        feature: "Cohort analytics dashboard",         single: false, programme: true, partnership: true },
  { group: "Outputs",        feature: "Quarterly cohort review with the C-suite", single: false, programme: false, partnership: true },
  { group: "Outputs",        feature: "Year-on-year talent trajectory",     single: false, programme: false, partnership: true },

  // Compliance
  { group: "Compliance",     feature: "ISO 10667 alignment",                single: true, programme: true, partnership: true },
  { group: "Compliance",     feature: "GCC Taskforce on AC Guidelines (6th ed.)", single: true, programme: true, partnership: true },
  { group: "Compliance",     feature: "GDPR / UAE PDPL / Saudi PDPL data handling", single: true, programme: true, partnership: true },
  { group: "Compliance",     feature: "Audit trail on all rating decisions",  single: true, programme: true, partnership: true },
];

export default function AcEngagePage() {
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
          <Link
            href="/ara"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
          >
            AI Readiness Compass <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </header>

      {/* ─── Hero ─── */}
      <section className="ara-hero relative overflow-hidden">
        <div className="max-w-6xl mx-auto px-6 pt-14 pb-20 relative">
          <div className="max-w-3xl relative z-10">
            <span className="ara-eyebrow text-accent">
              <Sparkles className="h-3 w-3" />
              How to engage
            </span>
            <h1 className="ara-numeral text-4xl sm:text-5xl font-semibold text-white leading-[1.05] mt-4 mb-5">
              Three engagement shapes. <span className="ara-accent-sweep">One framework.</span>
            </h1>
            <p className="text-lg text-white/75 max-w-2xl leading-relaxed">
              Whether you&apos;re running a single hiring decision, a multi-role
              promotion cycle, or operating talent assessment as a continuous
              capability — the same VIFM-AC framework, assessor discipline, and
              report quality scales with you.
            </p>
          </div>
        </div>
      </section>

      {/* ─── Tier cards ─── */}
      <section className="max-w-6xl mx-auto px-6 -mt-10 relative z-10 pb-12">
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
                    Tier {t.number}
                  </span>
                </div>

                <h3 className="text-2xl font-semibold text-primary mb-1">
                  {t.label}
                </h3>
                <p className="text-sm text-muted-foreground mb-3">{t.scope}</p>

                <div className="mb-5">
                  <span
                    className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
                    style={{
                      background: tone.bgSoft,
                      color: tone.fg,
                      border: `1px solid ${tone.border}`,
                    }}
                  >
                    {t.price}
                  </span>
                </div>

                <p className="text-sm text-foreground italic mb-5 leading-relaxed">
                  {t.tagline}
                </p>

                <ul className="text-xs text-muted-foreground space-y-2 mb-6 flex-1">
                  {t.facts.map((f, i) => (
                    <li
                      key={f.label}
                      className={`flex justify-between ${i < t.facts.length - 1 ? "border-b pb-2" : ""}`}
                    >
                      <span>{f.label}</span>
                      <span className="font-semibold text-primary">{f.value}</span>
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
                  {t.cta} <ArrowRight className="h-4 w-4" />
                </Link>
              </article>
            );
          })}
        </div>
      </section>

      {/* ─── Capability matrix ─── */}
      <section className="ara-hero-subtle py-16 border-y">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-10 max-w-2xl mx-auto">
            <span className="ara-eyebrow">Side-by-side</span>
            <h2 className="text-3xl font-semibold text-primary mt-3">
              What is included at each tier
            </h2>
            <p className="text-sm text-muted-foreground mt-3">
              Tiers are cumulative — everything in Single Engagement is also in
              Programme. Everything in Programme is also in Strategic Talent
              Partnership.
            </p>
          </div>
          <CapabilityMatrix />
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section className="max-w-4xl mx-auto px-6 py-16 text-center">
        <h2 className="text-3xl font-semibold text-primary mb-3">
          Built on a 38-competency framework. Run by trained assessors.
        </h2>
        <p className="text-base text-muted-foreground max-w-xl mx-auto mb-8">
          VIFM has been delivering Assessment Centres across the GCC since 2008.
          Every engagement is anchored to the VIFM-AC framework, ISO 10667, and
          the International Taskforce on AC Guidelines.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            href="mailto:contact@viftraining.com?subject=AC%20Engagement%20Enquiry"
            className="ara-pulse inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-3 text-sm font-medium text-white hover:bg-accent/90 transition-colors"
          >
            Talk to a VIFM consultant <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/ara/engage"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-5 py-3 text-sm font-medium text-foreground hover:bg-muted transition-colors"
          >
            Or explore the AI Readiness Compass
          </Link>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="border-t bg-card/50">
        <div className="max-w-6xl mx-auto px-6 py-8 text-center text-xs text-muted-foreground">
          <div className="font-medium text-foreground mb-1">
            VIFM Assessment Center
          </div>
          The Big-4-calibre talent decision platform for the GCC.
        </div>
      </footer>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────

function CapabilityMatrix() {
  type Row = (typeof CAPABILITIES)[number];
  const grouped: Array<{ group: string; rows: Row[] }> = [];
  for (const row of CAPABILITIES) {
    const last = grouped[grouped.length - 1];
    if (last && last.group === row.group) last.rows.push(row);
    else grouped.push({ group: row.group, rows: [row] });
  }

  return (
    <div className="rounded-2xl border bg-card overflow-hidden shadow-sm">
      <div
        className="grid items-end border-b bg-card/95 backdrop-blur"
        style={{ gridTemplateColumns: "minmax(220px, 2fr) repeat(3, 1fr)" }}
      >
        <div className="p-4">
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">
            Capability
          </p>
        </div>
        {TIERS.map((t) => {
          const tone = TIER_TONES[t.tone];
          const Icon = t.icon;
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
                  Tier {t.number}
                </span>
              </div>
              <p className="text-sm font-semibold text-primary">{t.label}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{t.price.split("·")[0].trim()}</p>
            </div>
          );
        })}
      </div>

      {grouped.map((g) => (
        <div key={g.group}>
          <div className="px-4 py-2 bg-muted/30 border-b">
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">
              {g.group}
            </p>
          </div>
          {g.rows.map((row, idx) => (
            <div
              key={`${g.group}-${row.feature}`}
              className={`grid items-center ${idx > 0 ? "border-t" : ""}`}
              style={{ gridTemplateColumns: "minmax(220px, 2fr) repeat(3, 1fr)" }}
            >
              <div className="p-4 text-sm text-foreground">{row.feature}</div>
              <Cell value={row.single}      tone="blue" />
              <Cell value={row.programme}   tone="violet" />
              <Cell value={row.partnership} tone="gold" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function Cell({ value, tone }: { value: boolean | string; tone: keyof typeof TIER_TONES }) {
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
        {value}
      </span>
    </div>
  );
}
