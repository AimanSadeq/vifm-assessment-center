"use client";

import { useState } from "react";
import { Sparkles, ArrowDown } from "lucide-react";

/**
 * Inline configurator on /ac/engage that replaces the static
 * "tier X = N exercises" framing. The right unit on an Assessment
 * Centre is *competencies the client wants to assess* — exercises
 * follow from that. Reviewer feedback (2026-04-29 voice note):
 *
 *   "The number of exercises is determined by the competencies
 *    you need. … with any package, it's not 'the number of
 *    exercises is 3-4', it's always linked to the competencies."
 *
 * The thresholds below are the rules of thumb VIFM consultants
 * use in pre-sales conversations. Edit in one place — the picker
 * below it animates from this same source of truth.
 */

type Recommendation = {
  tierKey: "single" | "programme" | "partnership";
  tierLabel: string;
  format: string;
  exercises: string[];
  duration: string;
  rationale: string;
};

function recommendForCompetencyCount(n: number): Recommendation {
  if (n <= 2) {
    return {
      tierKey: "single",
      tierLabel: "Single Engagement",
      format: "Targeted half-day",
      exercises: ["1 competency-based interview", "1 short exercise (in-tray or role play)"],
      duration: "Half-day · ~3 hours per candidate",
      rationale:
        "Two competencies are best served by one interview plus one situational exercise — enough triangulation without over-engineering.",
    };
  }
  if (n <= 4) {
    return {
      tierKey: "single",
      tierLabel: "Single Engagement",
      format: "Standard half-day",
      exercises: [
        "1 competency-based interview",
        "1 in-tray / e-tray",
        "1 role-play simulation",
      ],
      duration: "Half-day · ~4 hours per candidate",
      rationale:
        "3-4 competencies fit comfortably inside a half-day with three observation surfaces, hitting the AC requirement of each competency observed in at least 2 exercises.",
    };
  }
  if (n <= 6) {
    return {
      tierKey: "single",
      tierLabel: "Single Engagement",
      format: "Full-day",
      exercises: [
        "1 competency-based interview",
        "1 in-tray / e-tray",
        "1 role-play simulation",
        "1 case study or oral presentation",
      ],
      duration: "Full-day · ~6 hours per candidate",
      rationale:
        "5-6 competencies need a fourth surface to keep each competency observed across multiple exercises with sufficient evidence.",
    };
  }
  if (n <= 8) {
    return {
      tierKey: "programme",
      tierLabel: "Programme",
      format: "Full-day with group exercise",
      exercises: [
        "1 competency-based interview",
        "1 in-tray / e-tray",
        "1 role-play simulation",
        "1 case study or oral presentation",
        "1 group exercise",
      ],
      duration: "Full-day · ~7 hours per candidate · cohort scheduling",
      rationale:
        "7-8 competencies require business simulations across both individual and group surfaces. This is where cohort scheduling (3-6 candidates per session) becomes the efficient delivery shape.",
    };
  }
  if (n <= 10) {
    return {
      tierKey: "programme",
      tierLabel: "Programme",
      format: "Day-and-a-half multi-cohort",
      exercises: [
        "1 competency-based interview",
        "1 in-tray / e-tray",
        "1 role-play (peer)",
        "1 role-play (subordinate)",
        "1 case study",
        "1 oral presentation",
        "1 group exercise",
      ],
      duration: "1.5 days · cohort scheduling required",
      rationale:
        "9-10 competencies cross the threshold where bespoke exercises become worth commissioning. Programme tier is the natural fit.",
    };
  }
  return {
    tierKey: "partnership",
    tierLabel: "Strategic Talent Partnership",
    format: "Multi-day, custom framework",
    exercises: [
      "Behavioural event interview",
      "Bespoke business simulation suite",
      "Multi-rater group exercise",
      "Strategic case study",
      "Executive presentation panel",
      "360 collateral review",
    ],
    duration: "2 days · custom framework + dedicated assessor team",
    rationale:
      "Beyond 10 competencies, you're assessing the whole executive profile. The Partnership tier covers a custom framework, dedicated assessors, and quarterly trajectory reviews.",
  };
}

const TIER_TONE: Record<Recommendation["tierKey"], { fg: string; bg: string; border: string }> = {
  single:      { fg: "#5391D5", bg: "rgba(83, 145, 213, 0.08)", border: "rgba(83, 145, 213, 0.30)" },
  programme:   { fg: "#7C3AED", bg: "rgba(124, 58, 237, 0.06)", border: "rgba(124, 58, 237, 0.30)" },
  partnership: { fg: "#D97706", bg: "rgba(217, 119, 6, 0.06)",  border: "rgba(217, 119, 6, 0.30)"  },
};

export function CompetencyConfigurator() {
  const [count, setCount] = useState<number>(4);
  const rec = recommendForCompetencyCount(count);
  const tone = TIER_TONE[rec.tierKey];

  return (
    <section className="max-w-6xl mx-auto px-6 -mt-8 mb-12 relative z-20">
      <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
        <div className="grid md:grid-cols-[1.1fr_1.4fr]">
          {/* Picker */}
          <div className="p-7 md:p-8 border-b md:border-b-0 md:border-e bg-gradient-to-br from-card to-muted/30">
            <span className="ara-eyebrow text-accent inline-flex items-center gap-1.5">
              <Sparkles className="h-3 w-3" />
              Configure your AC
            </span>
            <h2 className="text-xl sm:text-2xl font-semibold text-primary mt-3 mb-2 leading-tight">
              How many competencies do you need to assess?
            </h2>
            <p className="text-sm text-muted-foreground mb-6">
              The right tier and exercise mix is driven by competency count,
              not a fixed package. Move the slider to see the recommended
              shape.
            </p>

            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => setCount((n) => Math.max(1, n - 1))}
                className="h-10 w-10 rounded-full border border-input bg-background text-lg font-semibold hover:bg-muted disabled:opacity-50"
                aria-label="Decrease"
                disabled={count <= 1}
              >
                −
              </button>
              <input
                type="range"
                min={1}
                max={12}
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
                className="flex-1 accent-accent"
                aria-label="Number of competencies"
              />
              <button
                type="button"
                onClick={() => setCount((n) => Math.min(12, n + 1))}
                className="h-10 w-10 rounded-full border border-input bg-background text-lg font-semibold hover:bg-muted disabled:opacity-50"
                aria-label="Increase"
                disabled={count >= 12}
              >
                +
              </button>
            </div>
            <div className="mt-4 flex items-baseline gap-3">
              <span className="ara-numeral text-5xl font-semibold text-primary">{count}</span>
              <span className="text-sm text-muted-foreground">
                {count === 1 ? "competency" : "competencies"}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-2">
              Drawn from VIFM&apos;s 38-competency framework. Range: 1–12 typical;
              custom frameworks supported on the Partnership tier.
            </p>
          </div>

          {/* Recommendation */}
          <div className="p-7 md:p-8" style={{ background: tone.bg }}>
            <div className="flex items-center gap-2 mb-2">
              <span
                className="text-[10px] font-semibold uppercase tracking-widest"
                style={{ color: tone.fg }}
              >
                Recommended tier
              </span>
              <ArrowDown className="h-3 w-3 text-muted-foreground hidden md:block rotate-[-90deg]" />
            </div>
            <h3 className="text-2xl font-semibold mb-1" style={{ color: tone.fg }}>
              {rec.tierLabel}
            </h3>
            <p className="text-sm font-medium text-foreground mb-4">{rec.format}</p>

            <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-2">
              Exercise mix
            </p>
            <ul className="space-y-1.5 mb-4 text-sm">
              {rec.exercises.map((e) => (
                <li key={e} className="flex items-start gap-2">
                  <span
                    className="inline-block h-1.5 w-1.5 rounded-full mt-2 shrink-0"
                    style={{ background: tone.fg }}
                  />
                  <span>{e}</span>
                </li>
              ))}
            </ul>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs mb-4">
              <div className="rounded-md border bg-card p-3">
                <p className="uppercase tracking-widest text-muted-foreground font-semibold text-[10px] mb-1">
                  Duration
                </p>
                <p className="text-foreground font-medium">{rec.duration}</p>
              </div>
              <div className="rounded-md border bg-card p-3">
                <p className="uppercase tracking-widest text-muted-foreground font-semibold text-[10px] mb-1">
                  Each competency observed in
                </p>
                <p className="text-foreground font-medium">≥ 2 exercises (AC discipline)</p>
              </div>
            </div>

            <p className="text-xs text-muted-foreground italic leading-relaxed">{rec.rationale}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

export const COMPETENCY_PACKAGE_RULES_DOC =
  "Edit src/app/ac/engage/_components/competency-configurator.tsx to adjust thresholds and exercise mixes.";
