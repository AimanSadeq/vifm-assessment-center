"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Sparkles, ArrowDown } from "lucide-react";

/**
 * Inline configurator on /ac/engage that replaces the static
 * "tier X = N exercises" framing. The right unit on an Assessment
 * Centre is *competencies the client wants to assess* - exercises
 * follow from that. Reviewer feedback (2026-04-29 voice note):
 *
 *   "The number of exercises is determined by the competencies
 *    you need. … with any package, it's not 'the number of
 *    exercises is 3-4', it's always linked to the competencies."
 *
 * The thresholds below are the rules of thumb VIFM consultants
 * use in pre-sales conversations. Edit in one place - the picker
 * below it animates from this same source of truth.
 */

// The recommendation thresholds return only structural keys; the
// user-facing copy (tier label, format, exercise lines, duration,
// rationale) is resolved from acTools.configurator.* in the component
// where the i18n `t` is available, so the panel renders EN or AR.
type Recommendation = {
  tierKey: "single" | "programme" | "partnership";
  /** suffix into acTools.configurator.rec1..rec6 */
  recKey: string;
  /** how many exercise lines this rec has (ex1..exN) */
  exerciseCount: number;
};

function recommendForCompetencyCount(n: number): Recommendation {
  if (n <= 2) return { tierKey: "single", recKey: "rec1", exerciseCount: 2 };
  if (n <= 4) return { tierKey: "single", recKey: "rec2", exerciseCount: 3 };
  if (n <= 6) return { tierKey: "single", recKey: "rec3", exerciseCount: 4 };
  if (n <= 8) return { tierKey: "programme", recKey: "rec4", exerciseCount: 5 };
  if (n <= 10) return { tierKey: "programme", recKey: "rec5", exerciseCount: 7 };
  return { tierKey: "partnership", recKey: "rec6", exerciseCount: 6 };
}

const TIER_TONE: Record<Recommendation["tierKey"], { fg: string; bg: string; border: string }> = {
  single:      { fg: "#5391D5", bg: "rgba(83, 145, 213, 0.08)", border: "rgba(83, 145, 213, 0.30)" },
  programme:   { fg: "#7C3AED", bg: "rgba(124, 58, 237, 0.06)", border: "rgba(124, 58, 237, 0.30)" },
  partnership: { fg: "#D97706", bg: "rgba(217, 119, 6, 0.06)",  border: "rgba(217, 119, 6, 0.30)"  },
};

export function CompetencyConfigurator() {
  const { t } = useTranslation();
  const [count, setCount] = useState<number>(4);
  const rec = recommendForCompetencyCount(count);
  const tone = TIER_TONE[rec.tierKey];
  const exerciseKeys = Array.from(
    { length: rec.exerciseCount },
    (_, i) => `acTools.configurator.${rec.recKey}.ex${i + 1}`
  );

  return (
    <section className="max-w-6xl mx-auto px-6 -mt-8 mb-12 relative z-20">
      <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
        <div className="grid md:grid-cols-[1.1fr_1.4fr]">
          {/* Picker */}
          <div className="p-7 md:p-8 border-b md:border-b-0 md:border-e bg-gradient-to-br from-card to-muted/30">
            <span className="ara-eyebrow text-accent inline-flex items-center gap-1.5">
              <Sparkles className="h-3 w-3" />
              {t("acTools.configurator.eyebrow")}
            </span>
            <h2 className="text-xl sm:text-2xl font-semibold text-primary mt-3 mb-2 leading-tight">
              {t("acTools.configurator.heading")}
            </h2>
            <p className="text-sm text-muted-foreground mb-6">
              {t("acTools.configurator.intro")}
            </p>

            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => setCount((n) => Math.max(1, n - 1))}
                className="h-10 w-10 rounded-full border border-input bg-background text-lg font-semibold hover:bg-muted disabled:opacity-50"
                aria-label={t("acTools.configurator.decrease")}
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
                aria-label={t("acTools.configurator.rangeLabel")}
              />
              <button
                type="button"
                onClick={() => setCount((n) => Math.min(12, n + 1))}
                className="h-10 w-10 rounded-full border border-input bg-background text-lg font-semibold hover:bg-muted disabled:opacity-50"
                aria-label={t("acTools.configurator.increase")}
                disabled={count >= 12}
              >
                +
              </button>
            </div>
            <div className="mt-4 flex items-baseline gap-3">
              <span className="ara-numeral text-5xl font-semibold text-primary">{count}</span>
              <span className="text-sm text-muted-foreground">
                {count === 1 ? t("acTools.configurator.competencySingular") : t("acTools.configurator.competencyPlural")}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-2">
              {t("acTools.configurator.frameworkNote")}
            </p>
          </div>

          {/* Recommendation */}
          <div className="p-7 md:p-8" style={{ background: tone.bg }}>
            <div className="flex items-center gap-2 mb-2">
              <span
                className="text-[10px] font-semibold uppercase tracking-widest"
                style={{ color: tone.fg }}
              >
                {t("acTools.configurator.recommendedTier")}
              </span>
              <ArrowDown className="h-3 w-3 text-muted-foreground hidden md:block rotate-[-90deg]" />
            </div>
            <h3 className="text-2xl font-semibold mb-1" style={{ color: tone.fg }}>
              {t(`acTools.configurator.tiers.${rec.tierKey}Label`)}
            </h3>
            <p className="text-sm font-medium text-foreground mb-4">{t(`acTools.configurator.${rec.recKey}.format`)}</p>

            <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-2">
              {t("acTools.configurator.exerciseMix")}
            </p>
            <ul className="space-y-1.5 mb-4 text-sm">
              {exerciseKeys.map((k) => (
                <li key={k} className="flex items-start gap-2">
                  <span
                    className="inline-block h-1.5 w-1.5 rounded-full mt-2 shrink-0"
                    style={{ background: tone.fg }}
                  />
                  <span>{t(k)}</span>
                </li>
              ))}
            </ul>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs mb-4">
              <div className="rounded-md border bg-card p-3">
                <p className="uppercase tracking-widest text-muted-foreground font-semibold text-[10px] mb-1">
                  {t("acTools.configurator.duration")}
                </p>
                <p className="text-foreground font-medium">{t(`acTools.configurator.${rec.recKey}.duration`)}</p>
              </div>
              <div className="rounded-md border bg-card p-3">
                <p className="uppercase tracking-widest text-muted-foreground font-semibold text-[10px] mb-1">
                  {t("acTools.configurator.observedIn")}
                </p>
                <p className="text-foreground font-medium">{t("acTools.configurator.observedInValue")}</p>
              </div>
            </div>

            <p className="text-xs text-muted-foreground italic leading-relaxed">{t(`acTools.configurator.${rec.recKey}.rationale`)}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

export const COMPETENCY_PACKAGE_RULES_DOC =
  "Edit src/app/ac/engage/_components/competency-configurator.tsx to adjust thresholds and exercise mixes.";
