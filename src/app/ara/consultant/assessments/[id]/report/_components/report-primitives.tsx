import {
  CheckCircle2, Info, AlertTriangle, Circle, HelpCircle,
  FileText, Link as LinkIcon, Presentation, File,
} from "lucide-react";

/* ─────────────────────────────────────────────────────────────
   Report design primitives.

   Shared visual language for the AI Readiness Compass PDF report.
   Everything here is print-safe: no position:sticky, no CSS Grid
   features the Puppeteer print engine drops, inline styles only so
   nothing depends on component-scoped Tailwind.
   ───────────────────────────────────────────────────────────── */

// ─── Design tokens (mirrored from report.css CSS vars for inline use) ──
export const TOKENS = {
  navy:      "#010131",
  navy2:     "#111232",
  accent:    "#5391D5",
  teal:      "#2DD4BF",
  emerald:   "#34D399",
  amber:     "#FBBF24",
  gold:      "#FBBF24",
  rose:      "#FB7185",
  violet:    "#A78BFA",
  ink:       "#121232",
  ink2:      "#374151",
  mute:      "#6b7280",
  line:      "#e5e7eb",
  bgSoft:    "#fafbfc",
  bgPanel:   "#f9fafb",
} as const;

// ─── 1. SectionHeader ─────────────────────────────────────────
export function SectionHeader({ eyebrow, title, kicker }: {
  eyebrow?: string;
  title: string;
  kicker?: string;
}) {
  return (
    <header style={{ marginBottom: "14pt" }}>
      {eyebrow && (
        <p style={{
          fontSize: "8.5pt", letterSpacing: "0.14em", color: TOKENS.mute,
          textTransform: "uppercase", fontWeight: 600, margin: 0,
        }}>
          {eyebrow}
        </p>
      )}
      <h2 style={{
        fontSize: "22pt", fontWeight: 700, color: TOKENS.navy,
        margin: "4pt 0 0", letterSpacing: "-0.01em", borderBottom: "none",
        padding: 0,
      }}>
        {title}
      </h2>
      <div style={{
        display: "flex", alignItems: "center", gap: "12pt",
        marginTop: "8pt", paddingBottom: "10pt",
        borderBottom: `1pt solid ${TOKENS.line}`,
      }}>
        <div style={{ width: "24pt", height: "2pt", background: TOKENS.accent }} />
        {kicker && (
          <p style={{ fontSize: "9.5pt", color: TOKENS.mute, margin: 0 }}>
            {kicker}
          </p>
        )}
      </div>
    </header>
  );
}

// ─── 2. StatTile + StatStrip ──────────────────────────────────
export function StatTile({ label, value, suffix, accent, accentColor = TOKENS.accent }: {
  label: string;
  value: string;
  suffix?: string;
  accent?: string;
  accentColor?: string;
}) {
  return (
    <div style={{
      padding: "14pt 16pt", background: TOKENS.bgSoft,
      border: `1pt solid ${TOKENS.line}`, borderRadius: "6pt",
      borderTop: `3pt solid ${accentColor}`,
    }}>
      <p style={{
        fontSize: "8.5pt", letterSpacing: "0.08em", textTransform: "uppercase",
        color: TOKENS.mute, margin: 0, fontWeight: 600,
      }}>
        {label}
      </p>
      <p style={{
        fontSize: "26pt", fontWeight: 700, color: TOKENS.navy,
        margin: "4pt 0 0", lineHeight: 1, fontVariantNumeric: "tabular-nums",
        letterSpacing: "-0.02em",
      }}>
        {value}
        {suffix && (
          <span style={{
            fontSize: "12pt", color: TOKENS.mute, fontWeight: 400,
            marginLeft: "4pt",
          }}>
            {suffix}
          </span>
        )}
      </p>
      {accent && (
        <p style={{
          fontSize: "9pt", color: accentColor, margin: "4pt 0 0",
          fontWeight: 500,
        }}>
          {accent}
        </p>
      )}
    </div>
  );
}

export function StatStrip({ children }: { children: React.ReactNode }) {
  return <div className="stat-strip">{children}</div>;
}

// ─── 3. Metric (compact metric used inside tighter strips) ───
export function Metric({ label, value, suffix, tone = "neutral" }: {
  label: string;
  value: string;
  suffix?: string;
  tone?: "neutral" | "positive" | "negative" | "warning" | "brand";
}) {
  const color =
    tone === "positive" ? TOKENS.emerald :
    tone === "negative" ? TOKENS.rose :
    tone === "warning"  ? TOKENS.amber :
    tone === "brand"    ? TOKENS.accent :
                          TOKENS.navy;
  return (
    <div style={{ padding: "8pt 0" }}>
      <p style={{
        fontSize: "8pt", letterSpacing: "0.08em", textTransform: "uppercase",
        color: TOKENS.mute, margin: 0, fontWeight: 600,
      }}>
        {label}
      </p>
      <p style={{
        fontSize: "18pt", fontWeight: 700, color,
        margin: "2pt 0 0", lineHeight: 1, fontVariantNumeric: "tabular-nums",
        letterSpacing: "-0.01em",
      }}>
        {value}
      </p>
      {suffix && (
        <p style={{ fontSize: "8.5pt", color: TOKENS.mute, margin: "2pt 0 0" }}>
          {suffix}
        </p>
      )}
    </div>
  );
}

// ─── 4. FindingCard ───────────────────────────────────────────
export type FindingType = "strength" | "observation" | "risk";

const FINDING_TOKENS: Record<FindingType, {
  label: string; color: string; bg: string; Icon: typeof CheckCircle2;
}> = {
  strength:    { label: "Strength",    color: "#065f46", bg: "#ecfdf5", Icon: CheckCircle2 },
  observation: { label: "Observation", color: "#1e3a8a", bg: "#eff6ff", Icon: Info },
  risk:        { label: "Risk",        color: "#9f1239", bg: "#fef2f2", Icon: AlertTriangle },
};

/**
 * Heuristic that infers the finding type from the note text. Used until
 * the schema grows a first-class note_type column.
 *
 * Checks strength signals first (they are more specific phrases), then
 * risk signals, then defaults to "observation". Bare single words like
 * "risk" are deliberately excluded from the risk regex because they
 * collide with proper nouns (e.g. a team name "Risk+Data").
 */
export function inferFindingType(text: string): FindingType {
  const t = text.toLowerCase();

  // 1. Strength signals - specific phrases a consultant would write when
  // praising an organisation.
  if (/\b(notable strength|unusually strong|documented\s|approved\s|ring-fenced|board-level|exceeds|running consistently|formally chartered|mature\b|operational\b|is live|above\s+.*\s+peer|competitive differentiator|strong for a|leading practice|audit-ready)\b/.test(t)) {
    return "strength";
  }

  // 2. Risk signals - specific, ideally multi-word patterns so single
  // words don't accidentally match when they appear in neutral context
  // (e.g. "breach" inside a playbook scenario description).
  if (/\b(gap identified|primary gap|shadow ai|lack of|lacking\s|missing\b|unapproved tools?|data breach|security breach|weak discipline|no formal|no structured|under-promoted|frozen middle|ad-hoc\s|not consistently|audit finding|becomes a compliance finding|no retirement|weak:?\s+\w+\b)\b/.test(t)) {
    return "risk";
  }

  return "observation";
}

export function FindingCard({ type, index, text }: {
  type: FindingType;
  index: number;
  text: string;
}) {
  const t = FINDING_TOKENS[type];

  // Split into headline (first sentence) + body (remainder) for hierarchy.
  const sentences = text.split(/(?<=[.!?])\s+/);
  const headline = sentences[0];
  const body = sentences.slice(1).join(" ");

  return (
    <article style={{
      display: "grid",
      gridTemplateColumns: "32pt 1fr",
      gap: "12pt",
      padding: "12pt 14pt",
      background: t.bg,
      borderLeft: `3pt solid ${t.color}`,
      borderRadius: "4pt",
      breakInside: "avoid",
      pageBreakInside: "avoid",
    }}>
      <div style={{
        display: "flex", flexDirection: "column",
        alignItems: "center", gap: "6pt",
      }}>
        <t.Icon size={18} color={t.color} strokeWidth={2.25} />
        <span style={{
          fontSize: "8pt", fontWeight: 700, color: t.color,
          letterSpacing: "0.05em", fontVariantNumeric: "tabular-nums",
        }}>
          {String(index).padStart(2, "0")}
        </span>
      </div>
      <div>
        <p style={{
          fontSize: "8pt", letterSpacing: "0.1em", color: t.color,
          textTransform: "uppercase", fontWeight: 700, margin: "0 0 4pt",
        }}>
          {t.label}
        </p>
        <p style={{
          fontSize: "10.5pt", fontWeight: 600, color: TOKENS.navy,
          margin: "0 0 4pt", lineHeight: 1.35,
        }}>
          {headline}
        </p>
        {body && (
          <p style={{
            fontSize: "10pt", color: TOKENS.ink2, margin: 0,
            lineHeight: 1.55,
          }}>
            {body}
          </p>
        )}
      </div>
    </article>
  );
}

// ─── 5. Callout ──────────────────────────────────────────────
export function Callout({ tone = "info", icon: Icon, title, children }: {
  tone?: "info" | "warn" | "danger" | "success";
  icon?: typeof AlertTriangle;
  title: string;
  children: React.ReactNode;
}) {
  const map = {
    info:    { bg: "#eff6ff", bd: TOKENS.accent, fg: "#1e3a8a", DefaultIcon: Info },
    warn:    { bg: "#fffbeb", bd: TOKENS.amber,  fg: "#78350f", DefaultIcon: AlertTriangle },
    danger:  { bg: "#fef2f2", bd: TOKENS.rose,   fg: "#9f1239", DefaultIcon: AlertTriangle },
    success: { bg: "#f0fdf4", bd: TOKENS.emerald, fg: "#065f46", DefaultIcon: CheckCircle2 },
  }[tone];

  const DisplayIcon = Icon ?? map.DefaultIcon;
  return (
    <aside style={{
      display: "grid", gridTemplateColumns: "20pt 1fr",
      gap: "10pt", padding: "12pt 14pt", background: map.bg,
      borderLeft: `3pt solid ${map.bd}`, borderRadius: "4pt",
      margin: "12pt 0",
      breakInside: "avoid",
    }}>
      <DisplayIcon size={18} color={map.bd} strokeWidth={2.25} />
      <div>
        <p style={{
          fontSize: "9.5pt", fontWeight: 700, color: map.fg,
          margin: "0 0 4pt", textTransform: "uppercase", letterSpacing: "0.06em",
        }}>
          {title}
        </p>
        <div style={{
          fontSize: "10pt", color: TOKENS.ink2, lineHeight: 1.5,
        }}>
          {children}
        </div>
      </div>
    </aside>
  );
}

export function EmptyCallout({ children }: { children: React.ReactNode }) {
  return (
    <aside style={{
      padding: "18pt 14pt", background: TOKENS.bgPanel,
      border: `1pt dashed ${TOKENS.line}`, borderRadius: "6pt",
      textAlign: "center",
      margin: "8pt 0",
    }}>
      <p style={{
        fontSize: "9.5pt", color: TOKENS.mute, margin: 0, fontStyle: "italic",
      }}>
        {children}
      </p>
    </aside>
  );
}

// ─── 6. Chip ─────────────────────────────────────────────────
export function Chip({ color, variant = "solid", children }: {
  color: string;
  variant?: "solid" | "outline";
  children: React.ReactNode;
}) {
  if (variant === "solid") {
    return (
      <span style={{
        display: "inline-flex", alignItems: "center", gap: "4pt",
        padding: "2pt 8pt", background: color, color: "white",
        fontSize: "8pt", fontWeight: 700, borderRadius: "10pt",
        letterSpacing: "0.04em", textTransform: "uppercase",
        whiteSpace: "nowrap",
      }}>
        {children}
      </span>
    );
  }
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: "4pt",
      padding: "2pt 8pt", background: "transparent", color,
      border: `1pt solid ${color}`, fontSize: "8pt", fontWeight: 700,
      borderRadius: "10pt", letterSpacing: "0.04em",
      textTransform: "uppercase", whiteSpace: "nowrap",
    }}>
      {children}
    </span>
  );
}

// ─── 7. StatusChip (for compliance legend, etc.) ─────────────
export function StatusChip({ color, label, body }: {
  color: string; label: string; body: string;
}) {
  return (
    <div style={{
      display: "flex", gap: "8pt", alignItems: "flex-start",
      padding: "8pt 10pt", background: TOKENS.bgSoft,
      border: `1pt solid ${TOKENS.line}`, borderRadius: "4pt",
    }}>
      <Circle size={12} color={color} fill={color} strokeWidth={0}
        style={{ marginTop: "2pt", flexShrink: 0 }} />
      <div>
        <p style={{
          fontSize: "9.5pt", fontWeight: 600, color: TOKENS.navy,
          margin: "0 0 2pt",
        }}>
          {label}
        </p>
        <p style={{ fontSize: "9pt", color: TOKENS.mute, margin: 0 }}>
          {body}
        </p>
      </div>
    </div>
  );
}

// ─── 8. FileTypeIcon ─────────────────────────────────────────
export function FileTypeIcon({ type, size = 20 }: {
  type: "url" | "pdf" | "word" | "powerpoint" | string;
  size?: number;
}) {
  const colorMap: Record<string, string> = {
    pdf:        TOKENS.rose,
    word:       TOKENS.accent,
    powerpoint: TOKENS.amber,
    url:        TOKENS.teal,
  };
  const color = colorMap[type] ?? TOKENS.mute;

  const IconComponent =
    type === "url" ? LinkIcon :
    type === "powerpoint" ? Presentation :
    type === "word" ? FileText :
    type === "pdf" ? FileText :
    File;

  return <IconComponent size={size} color={color} strokeWidth={1.75} />;
}

// ─── 9. FindingsPanel (for Exec Summary strengths/gaps cards) ─
export function FindingsPanel({ variant, title, items }: {
  variant: "strength" | "gap";
  title: string;
  items: Array<{ headline: string; metric: string }>;
}) {
  const color = variant === "strength" ? TOKENS.emerald : TOKENS.rose;
  const Icon = variant === "strength" ? CheckCircle2 : AlertTriangle;

  return (
    <div style={{
      padding: "14pt 16pt", background: "white",
      border: `1pt solid ${TOKENS.line}`, borderRadius: "6pt",
      borderTop: `3pt solid ${color}`,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "6pt",
        marginBottom: "10pt" }}>
        <Icon size={16} color={color} strokeWidth={2.25} />
        <p style={{
          fontSize: "9.5pt", fontWeight: 700, color: TOKENS.navy,
          margin: 0, letterSpacing: "0.05em", textTransform: "uppercase",
        }}>
          {title}
        </p>
      </div>
      {items.length === 0 ? (
        <p style={{ fontSize: "9.5pt", color: TOKENS.mute, margin: 0, fontStyle: "italic" }}>
          {variant === "strength" ? "No pillars at Advanced or above yet." : "No pillars below Developing - solid foundation."}
        </p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {items.map((item, i) => (
            <li key={i} style={{
              display: "flex", justifyContent: "space-between", alignItems: "baseline",
              gap: "10pt", padding: "6pt 0",
              borderTop: i === 0 ? "none" : `1pt solid ${TOKENS.line}`,
            }}>
              <span style={{ fontSize: "10pt", fontWeight: 600, color: TOKENS.navy }}>
                {item.headline}
              </span>
              <span style={{
                fontSize: "9.5pt", color, fontWeight: 600,
                fontVariantNumeric: "tabular-nums",
              }}>
                {item.metric}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── 10. PageFooter ──────────────────────────────────────────
export function PageFooter({ pageNumber, total, section, isSandbox }: {
  pageNumber: number;
  total: number;
  section: string;
  isSandbox?: boolean;
}) {
  return (
    <footer style={{
      position: "absolute", bottom: "10mm", left: "18mm", right: "18mm",
      display: "flex", justifyContent: "space-between",
      fontSize: "8pt", color: TOKENS.mute,
      borderTop: `1pt solid ${TOKENS.line}`, paddingTop: "4pt",
    }}>
      <span style={{ letterSpacing: "0.08em" }}>
        {isSandbox ? "CONFIDENTIAL · SAMPLE" : "CONFIDENTIAL · VIFM INTERNAL"}
      </span>
      <span>{section}</span>
      <span style={{ fontVariantNumeric: "tabular-nums" }}>
        {pageNumber} / {total}
      </span>
    </footer>
  );
}

// ─── 11. RecommendationCard (for the deep-dive recommendations page)
export type RecommendationHorizon = "quick" | "build" | "transform";
export type RecommendationEffort = "Low" | "Medium" | "High";

export function RecommendationCard({ rec, index }: {
  rec: {
    title: string;
    body: string;
    horizon: RecommendationHorizon;
    effort: RecommendationEffort;
    outcome: string;
  };
  index: number;
}) {
  const horizonColor = {
    quick: TOKENS.teal,
    build: TOKENS.accent,
    transform: TOKENS.navy,
  }[rec.horizon];
  const horizonLabel = {
    quick: "Quick Win",
    build: "Build",
    transform: "Transform",
  }[rec.horizon];
  const effortColor = {
    Low: TOKENS.emerald,
    Medium: TOKENS.amber,
    High: TOKENS.rose,
  }[rec.effort];

  return (
    <article style={{
      padding: "14pt 16pt", background: "white",
      border: `1pt solid ${TOKENS.line}`, borderRadius: "6pt",
      borderTop: `3pt solid ${horizonColor}`,
      breakInside: "avoid", pageBreakInside: "avoid",
    }}>
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "baseline",
      }}>
        <span style={{
          fontSize: "10pt", fontWeight: 700, color: TOKENS.mute,
          fontVariantNumeric: "tabular-nums", letterSpacing: "0.04em",
        }}>
          {String(index).padStart(2, "0")}
        </span>
        <div style={{ display: "flex", gap: "6pt" }}>
          <Chip color={horizonColor}>{horizonLabel}</Chip>
          <Chip color={effortColor} variant="outline">{rec.effort} effort</Chip>
        </div>
      </div>
      <h4 style={{
        fontSize: "12pt", fontWeight: 600, color: TOKENS.navy,
        margin: "8pt 0 6pt",
      }}>
        {rec.title}
      </h4>
      <p style={{
        fontSize: "10pt", color: TOKENS.ink2, lineHeight: 1.55,
        margin: "0 0 10pt",
      }}>
        {rec.body}
      </p>
      <div style={{
        borderTop: `1pt dashed ${TOKENS.line}`, paddingTop: "8pt",
        fontSize: "9pt", color: TOKENS.mute,
      }}>
        <strong style={{ color: TOKENS.ink2 }}>Expected outcome · </strong>
        {rec.outcome}
      </div>
    </article>
  );
}

/**
 * Recommendations derived from score band. Produces 3 tiered actions
 * for every pillar, with horizon + effort + outcome. Used on the
 * Pillar Deep Dive Recommendations page.
 */
export function recommendationsFor(pillarName: string, score: number | null) {
  const n = pillarName.toLowerCase();
  if (score == null || score < 2.0) {
    return [
      {
        title: "Establish foundational understanding",
        body: `Run a half-day leadership brief on ${n} covering vocabulary, business relevance, and regional precedents from UAE and Saudi peers.`,
        horizon: "quick" as const, effort: "Low" as const,
        outcome: `Shared leadership vocabulary and an initial mandate for ${n}.`,
      },
      {
        title: "Appoint accountable owner & seed budget",
        body: `Name a C-suite sponsor and ring-fence initial budget (suggest AED 500k-1.5M starter) to fund discovery work.`,
        horizon: "quick" as const, effort: "Medium" as const,
        outcome: "Governance line of sight and a funded first initiative.",
      },
      {
        title: "Baseline against peers",
        body: `Commission a peer scan across 3 comparable GCC organisations on ${n} to set an evidence-based target.`,
        horizon: "build" as const, effort: "Medium" as const,
        outcome: "Target benchmark with named peers and aspirational KPIs.",
      },
    ];
  }
  if (score < 3.0) {
    return [
      {
        title: "Formalise policies and processes",
        body: `Document and publish the working policies governing ${n}. Move from tacit practice to signed-off governance artefacts.`,
        horizon: "quick" as const, effort: "Medium" as const,
        outcome: "Published policy pack and acknowledgement record.",
      },
      {
        title: "Pilot one initiative with success metrics",
        body: `Launch a single well-scoped pilot with measurable KPIs to prove the organisation can execute on ${n}.`,
        horizon: "build" as const, effort: "Medium" as const,
        outcome: "One reference pilot with pre/post evidence.",
      },
      {
        title: "Build cross-functional engagement",
        body: `Stand up a ${n} working group with at least three business-unit representatives meeting monthly.`,
        horizon: "build" as const, effort: "Low" as const,
        outcome: "Active cross-functional forum with documented decisions.",
      },
    ];
  }
  if (score < 4.0) {
    return [
      {
        title: "Scale proven pilots into production",
        body: `Take the 1-2 strongest pilots and productionise them with formal handover into business-as-usual operations.`,
        horizon: "quick" as const, effort: "Medium" as const,
        outcome: "Productionised use cases with named owners and ROI targets.",
      },
      {
        title: "Close the gap to the AI Ready benchmark",
        body: `Targeted upskilling and process tightening to lift ${n} above the 4.0 benchmark within 2 quarters.`,
        horizon: "build" as const, effort: "High" as const,
        outcome: `${pillarName} score sustainably at or above 4.00.`,
      },
      {
        title: "Introduce measurement and review cadence",
        body: `Quarterly KPI review at executive level with documented minutes and action tracking on ${n}.`,
        horizon: "build" as const, effort: "Low" as const,
        outcome: "Quarterly review loop with accountable owners.",
      },
    ];
  }
  // Score >= 4.0 (Advanced / Leading)
  return [
    {
      title: "Share practices internally as a centre of excellence",
      body: `Codify what works in ${n} and publish it as an internal CoE playbook other functions can adopt.`,
      horizon: "quick" as const, effort: "Low" as const,
      outcome: "Internal playbook referenced by at least two other pillars.",
    },
    {
      title: "Mentor weaker pillars using the patterns that worked here",
      body: `Assign a ${n} champion to each of the 2-3 gap pillars for 6 months of embedded mentoring.`,
      horizon: "build" as const, effort: "Medium" as const,
      outcome: "Measurable maturity lift in mentored pillars.",
    },
    {
      title: "Continue annual benchmarking to retain leadership",
      body: `Re-run the Compass annually against peer organisations to keep ${n} at the leading edge.`,
      horizon: "transform" as const, effort: "Low" as const,
      outcome: "Sustained leadership position with documented year-on-year delta.",
    },
  ];
}

// ─── 12. Helper: score -> tone (used across the report) ──────
export function toneForScore(score: number | null): "positive" | "neutral" | "negative" {
  if (score == null) return "neutral";
  if (score >= 4.0) return "positive";
  if (score < 3.0) return "negative";
  return "neutral";
}
