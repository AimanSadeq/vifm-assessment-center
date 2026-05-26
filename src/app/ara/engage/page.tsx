import Link from "next/link";
import {
  ArrowRight, Check, Minus, Sparkles, Building2, Network, Globe2, User,
} from "lucide-react";
import { AraTopBar } from "@/components/shared/ara-top-bar";
import { AnimatedCompass } from "@/components/shared/ara/animated-compass";
import { FadeIn } from "@/components/shared/ara/fade-in";
import {
  ARA_STAGE_DEFINITIONS, ARA_STAGE_CAPABILITIES,
} from "@/lib/constants/ara-stages";
import type { AraEngagementStage } from "@/types/ara";

export const metadata = {
  title: "Engage",
};

const STAGE_ICONS: Record<AraEngagementStage, typeof Building2> = {
  department: Building2,
  division: Network,
  enterprise: Globe2,
  individual: User,
};

/**
 * Tone token map - mirrors the ara-icon-* utilities in globals.css but
 * referenced as inline values so the page stays print/SSR-safe and does
 * not depend on Tailwind's JIT for arbitrary value classes.
 *
 * Four stage tones: Personal reuses the teal palette since both
 * Personal and Department are entry-level / complimentary tier - but
 * the comparison-matrix Cell tone keeps `teal` reserved for Personal
 * and re-tags Department's column with the same palette to keep the
 * card-tone agreement on screen.
 */
const TONE_MAP = {
  teal:   { fg: "#0D9488", bgSoft: "rgba(13, 148, 136, 0.08)", border: "rgba(13, 148, 136, 0.3)",  bgIcon: "rgba(13, 148, 136, 0.10)" },
  violet: { fg: "#7C3AED", bgSoft: "rgba(124, 58, 237, 0.06)", border: "rgba(124, 58, 237, 0.3)",  bgIcon: "rgba(124, 58, 237, 0.10)" },
  gold:   { fg: "#D97706", bgSoft: "rgba(217, 119, 6, 0.06)",  border: "rgba(217, 119, 6, 0.3)",   bgIcon: "rgba(217, 119, 6, 0.12)" },
} as const;

/**
 * Personal stage label override - `stage.number` is 1 for both
 * Department and Personal, so we show "Personal" instead of "Stage 1"
 * for the individual stage to keep the badge readable across the page.
 */
function stageBadge(stage: { id: string; number: number }): string {
  return stage.id === "individual" ? "Personal" : `Stage ${stage.number}`;
}

/**
 * Display order on this page - Personal first (lowest tier / free),
 * then ascending Department / Division / Enterprise. We don't reorder
 * the ARA_STAGE_DEFINITIONS export itself so other consumers (eg. the
 * consultant wizard, which filters Personal out) see the original order.
 */
const DISPLAY_ORDER: Array<"individual" | "department" | "division" | "enterprise"> = [
  "individual",
  "department",
  "division",
  "enterprise",
];
const STAGES_IN_DISPLAY_ORDER = DISPLAY_ORDER.map(
  (id) => ARA_STAGE_DEFINITIONS.find((s) => s.id === id)!
);

export default function AraEngagePage() {
  return (
    <div className="min-h-screen bg-background">
      <AraTopBar role="consultant" />

      {/* ─── Hero ─── */}
      <section className="ara-hero relative overflow-hidden">
        <div className="max-w-6xl mx-auto px-6 pt-14 pb-16 relative">
          {/* Floating compass - matches the brand cadence on /ara */}
          <div className="pointer-events-none hidden lg:block absolute top-8 right-0 w-[320px] h-[320px] opacity-80">
            <AnimatedCompass className="w-full h-full" />
          </div>

          <div className="max-w-3xl relative z-10">
            <span className="ara-eyebrow text-accent">
              <Sparkles className="h-3 w-3" />
              How to engage
            </span>
            <h1 className="ara-numeral text-4xl sm:text-5xl font-semibold text-white leading-[1.05] mt-4 mb-5">
              Four stages. <span className="ara-accent-sweep">One Compass.</span>
            </h1>
            <p className="text-lg text-white/75 max-w-2xl leading-relaxed">
              Start with a complimentary Personal Snapshot for one individual,
              or a complimentary Department assessment for one team. Expand
              to a Division or the whole Enterprise as your appetite grows.
              Same diagnostic engine, scope that scales with you.
            </p>
          </div>
        </div>
      </section>

      {/* ─── Stage cards ─── */}
      <section className="max-w-6xl mx-auto px-6 -mt-10 relative z-10 pb-12">
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {STAGES_IN_DISPLAY_ORDER.map((stage, i) => {
            const tone = TONE_MAP[stage.tone];
            const Icon = STAGE_ICONS[stage.id];
            return (
              <FadeIn key={stage.id} delay={i * 100}>
                <article
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
                      {stageBadge(stage)}
                    </span>
                  </div>

                  {/* Fixed-height rows so title, scope, and price-label
                       align across all four cards regardless of how the
                       scope text wraps at a given viewport width. */}
                  <h3 className="text-2xl font-semibold text-primary leading-tight mb-1 min-h-[2rem]">
                    {stage.label_en}
                  </h3>
                  <p className="text-sm text-muted-foreground mb-3 min-h-[3.25rem]">
                    {stage.scope_en}
                  </p>

                  <div className="mb-5 min-h-[1.75rem]">
                    <span
                      className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
                      style={{
                        background: tone.bgSoft,
                        color: tone.fg,
                        border: `1px solid ${tone.border}`,
                      }}
                    >
                      {stage.is_pro_bono && <Sparkles className="h-3 w-3" />}
                      {stage.price_label_en}
                    </span>
                  </div>

                  <p className="text-sm text-foreground italic mb-5 leading-relaxed">
                    {stage.tagline_en}
                  </p>

                  {/* At-a-glance facts - Personal uses 4 factors not pillars,
                       and a 1-page report rather than the multi-page formats. */}
                  <ul className="text-xs text-muted-foreground space-y-2 mb-6 flex-1">
                    <li className="flex justify-between border-b pb-2">
                      <span>{stage.id === "individual" ? "Factors assessed" : "Pillars assessed"}</span>
                      <span className="font-semibold text-primary ara-numeral">
                        {stage.id === "individual"
                          ? "4 personal"
                          : `${stage.applicable_pillars.length} / 8`}
                      </span>
                    </li>
                    <li className="flex justify-between border-b pb-2">
                      <span>Stakeholders</span>
                      <span className="font-semibold text-primary ara-numeral">
                        {stage.typical_respondents}
                      </span>
                    </li>
                    <li className="flex justify-between">
                      <span>Report</span>
                      <span className="font-semibold text-primary ara-numeral">
                        {stage.report_pages} pages
                      </span>
                    </li>
                  </ul>

                  {/* Workforce-layer cross-reference - only on the org tiers.
                       Pillar maturity alone misses adoption: the org can build
                       great Data + Strategy infrastructure while the workforce
                       doesn't actually use it. Surfacing the optional Mode-C
                       layer here means consultants and clients see the
                       capability/adoption pairing BEFORE they reach the
                       wizard, not as a buried toggle inside it. */}
                  {stage.id !== "individual" && (
                    <div className="rounded-md bg-accent/5 border border-accent/20 px-3 py-2 mb-4 text-[11px] leading-relaxed text-muted-foreground">
                      <span className="font-semibold text-accent">
                        + Workforce readiness layer (optional)
                      </span>{" "}
                      - each respondent also answers the four personal
                      factor items, so the report measures{" "}
                      <span className="italic">adoption</span> alongside{" "}
                      <span className="italic">capability</span>. People are
                      what makes a department.
                    </div>
                  )}

                  {stage.is_pro_bono ? (
                    <Link
                      href={stage.id === "individual"
                        ? "/ara/personal/start"
                        : "/ara/consultant/assessments/new"}
                      className="ara-pulse inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium text-white transition-colors w-full"
                      style={{ background: tone.fg }}
                    >
                      {stage.cta_en} <ArrowRight className="h-4 w-4" />
                    </Link>
                  ) : (
                    <Link
                      href="mailto:contact@viftraining.com?subject=AI%20Readiness%20Compass%20Engagement%20Enquiry"
                      className="inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium transition-colors w-full"
                      style={{
                        background: tone.bgSoft,
                        color: tone.fg,
                        border: `1px solid ${tone.border}`,
                      }}
                    >
                      {stage.cta_en} <ArrowRight className="h-4 w-4" />
                    </Link>
                  )}
                </article>
              </FadeIn>
            );
          })}
        </div>
      </section>

      {/* ─── Comparison table ─── */}
      <section className="ara-hero-subtle py-16 border-y">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-10 max-w-2xl mx-auto">
            <span className="ara-eyebrow">Side-by-side</span>
            <h2 className="text-3xl font-semibold text-primary mt-3">
              What is included at each stage
            </h2>
            <p className="text-sm text-muted-foreground mt-3">
              Personal is a complimentary self-assessment for one individual.
              Department, Division, and Enterprise are cumulative engagements
              for organisations - everything in Department is also in
              Division, and everything in Division is also in Enterprise.
            </p>
          </div>

          <FadeIn>
            <CapabilityMatrix />
          </FadeIn>
        </div>
      </section>

      {/* ─── Final CTA ─── */}
      <section className="max-w-4xl mx-auto px-6 py-16 text-center">
        <h2 className="text-3xl font-semibold text-primary mb-3">
          Start where you stand. Grow when ready.
        </h2>
        <p className="text-base text-muted-foreground max-w-xl mx-auto mb-8">
          Take a complimentary Personal Snapshot in five minutes, or run a
          complimentary Department assessment to prove value inside one team.
          Progress to a paid Division or Enterprise engagement when internal
          sponsorship is secured.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/ara/personal/start"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-5 py-3 text-sm font-medium text-foreground hover:bg-muted transition-colors"
          >
            Take the complimentary snapshot
          </Link>
          <Link
            href="/ara/consultant/assessments/new"
            className="ara-pulse inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-3 text-sm font-medium text-white hover:bg-accent/90 transition-colors"
          >
            Start a complimentary department assessment <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="mailto:contact@viftraining.com?subject=AI%20Readiness%20Compass%20Engagement%20Enquiry"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-5 py-3 text-sm font-medium text-foreground hover:bg-muted transition-colors"
          >
            Talk to a VIFM consultant
          </Link>
        </div>
      </section>

      {/* Training catalogue bridge - the diagnostic surfaces gap-driven
           course recommendations on every report, but a visitor on this
           marketing page may want to explore the broader VIFM curriculum
           independently. Linked from the homepage header and surfaced
           again here as a discrete bridge into /courses. */}
      <section className="border-t bg-muted/30">
        <div className="max-w-4xl mx-auto px-6 py-12 text-center">
          <h2 className="text-2xl font-semibold text-primary mb-2">
            Or browse VIFM&apos;s full training catalogue
          </h2>
          <p className="text-sm text-muted-foreground max-w-xl mx-auto mb-6">
            Over a hundred programmes across finance, AI, leadership, and
            governance - request a tailored quote for any of them. The
            diagnostic narrows the field; the catalogue shows the field.
          </p>
          <Link
            href="/courses"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-5 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
          >
            Open the training catalogue <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* Footer */}
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

// ─────────────────────────────────────────────────────────────
// Comparison matrix - the structured table users can scan in
// 30 seconds to see what's in / out at each stage.
// ─────────────────────────────────────────────────────────────

function CapabilityMatrix() {
  // Group capabilities by their `group` field, preserving the order they
  // appear in the constants module (which doubles as the visual order).
  type Row = (typeof ARA_STAGE_CAPABILITIES)[number];
  const grouped: Array<{ group: string; rows: Row[] }> = [];
  for (const row of ARA_STAGE_CAPABILITIES) {
    const last = grouped[grouped.length - 1];
    if (last && last.group === row.group) {
      last.rows.push(row);
    } else {
      grouped.push({ group: row.group, rows: [row] });
    }
  }

  return (
    <div className="rounded-2xl border bg-card overflow-hidden shadow-sm">
      {/* Header row - sticks at top of table on scroll */}
      <div
        className="grid items-end border-b bg-card/95 backdrop-blur"
        style={{ gridTemplateColumns: "minmax(220px, 2fr) repeat(4, 1fr)" }}
      >
        <div className="p-4">
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">
            Capability
          </p>
        </div>
        {STAGES_IN_DISPLAY_ORDER.map((stage) => {
          const tone = TONE_MAP[stage.tone];
          const Icon = STAGE_ICONS[stage.id];
          return (
            <div
              key={stage.id}
              className="p-4 text-center border-l"
              style={{ borderTopColor: tone.fg, borderTopWidth: "3px", borderTopStyle: "solid" }}
            >
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <Icon className="h-4 w-4" style={{ color: tone.fg }} />
                <span
                  className="text-[10px] font-semibold uppercase tracking-widest"
                  style={{ color: tone.fg }}
                >
                  {stageBadge(stage)}
                </span>
              </div>
              <p className="text-sm font-semibold text-primary">
                {stage.label_en}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {stage.is_pro_bono ? "Complimentary" : "Fee-based"}
              </p>
            </div>
          );
        })}
      </div>

      {/* Capability groups */}
      {grouped.map((g) => (
        <div key={g.group}>
          <div className="px-4 py-2 bg-muted/30 border-b">
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">
              {g.group}
            </p>
          </div>
          {g.rows.map((row, idx) => (
            <div
              key={`${g.group}-${row.feature_en}`}
              className={`grid items-center ${idx > 0 ? "border-t" : ""}`}
              style={{ gridTemplateColumns: "minmax(220px, 2fr) repeat(4, 1fr)" }}
            >
              <div className="p-4 text-sm text-foreground">
                {row.feature_en}
              </div>
              <Cell value={row.individual} tone="teal" />
              <Cell value={row.department} tone="teal" />
              <Cell value={row.division} tone="violet" />
              <Cell value={row.enterprise} tone="gold" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function Cell({
  value,
  tone,
}: {
  value: boolean | string;
  tone: keyof typeof TONE_MAP;
}) {
  const t = TONE_MAP[tone];
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
  // String value - rendered as a small chip with the stage's tone
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
