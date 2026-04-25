import Link from "next/link";
import {
  ArrowRight, Check, Minus, Sparkles, Building2, Network, Globe2,
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
};

/**
 * Tone token map - mirrors the ara-icon-* utilities in globals.css but
 * referenced as inline values so the page stays print/SSR-safe and does
 * not depend on Tailwind's JIT for arbitrary value classes.
 */
const TONE_MAP = {
  teal:   { fg: "#0D9488", bgSoft: "rgba(13, 148, 136, 0.08)", border: "rgba(13, 148, 136, 0.3)",  bgIcon: "rgba(13, 148, 136, 0.10)" },
  violet: { fg: "#7C3AED", bgSoft: "rgba(124, 58, 237, 0.06)", border: "rgba(124, 58, 237, 0.3)",  bgIcon: "rgba(124, 58, 237, 0.10)" },
  gold:   { fg: "#D97706", bgSoft: "rgba(217, 119, 6, 0.06)",  border: "rgba(217, 119, 6, 0.3)",   bgIcon: "rgba(217, 119, 6, 0.12)" },
} as const;

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
              Three stages. <span className="ara-accent-sweep">One Compass.</span>
            </h1>
            <p className="text-lg text-white/75 max-w-2xl leading-relaxed">
              Start with a complimentary department assessment. Expand to a
              division, then to the whole enterprise as your appetite grows.
              Same diagnostic engine, scope that scales with you.
            </p>
          </div>
        </div>
      </section>

      {/* ─── Stage cards ─── */}
      <section className="max-w-6xl mx-auto px-6 -mt-10 relative z-10 pb-12">
        <div className="grid gap-5 md:grid-cols-3">
          {ARA_STAGE_DEFINITIONS.map((stage, i) => {
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
                      Stage {stage.number}
                    </span>
                  </div>

                  <h3 className="text-2xl font-semibold text-primary mb-1">
                    {stage.label_en}
                  </h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    {stage.scope_en}
                  </p>

                  <div className="mb-5">
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

                  {/* At-a-glance facts */}
                  <ul className="text-xs text-muted-foreground space-y-2 mb-6 flex-1">
                    <li className="flex justify-between border-b pb-2">
                      <span>Pillars assessed</span>
                      <span className="font-semibold text-primary ara-numeral">
                        {stage.applicable_pillars.length} / 8
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

                  {stage.is_pro_bono ? (
                    <Link
                      href="/ara/consultant/assessments/new"
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
              Stages are cumulative. Everything in Department is also in Division.
              Everything in Division is also in Enterprise.
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
          Start with a department. Grow when ready.
        </h2>
        <p className="text-base text-muted-foreground max-w-xl mx-auto mb-8">
          Most engagements start with a complimentary Stage 1 to prove value
          inside one department, then progress to a paid Division or Enterprise
          engagement once internal sponsorship is secured.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/ara/consultant/assessments/new"
            className="ara-pulse inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-3 text-sm font-medium text-white hover:bg-accent/90 transition-colors"
          >
            Start a complimentary assessment <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="mailto:contact@viftraining.com?subject=AI%20Readiness%20Compass%20Engagement%20Enquiry"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-5 py-3 text-sm font-medium text-foreground hover:bg-muted transition-colors"
          >
            Talk to a VIFM consultant
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
// Comparison matrix — the structured table users can scan in
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
        style={{ gridTemplateColumns: "minmax(220px, 2fr) repeat(3, 1fr)" }}
      >
        <div className="p-4">
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">
            Capability
          </p>
        </div>
        {ARA_STAGE_DEFINITIONS.map((stage) => {
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
                  Stage {stage.number}
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
              style={{ gridTemplateColumns: "minmax(220px, 2fr) repeat(3, 1fr)" }}
            >
              <div className="p-4 text-sm text-foreground">
                {row.feature_en}
              </div>
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
