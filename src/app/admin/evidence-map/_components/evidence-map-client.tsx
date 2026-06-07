"use client";

import { useState } from "react";
import Link from "next/link";
import {
  FlaskConical, LayoutGrid, Table2, CheckCircle2, CircleDashed, CircleSlash, MinusCircle, ExternalLink,
} from "lucide-react";
import { INSTRUMENTS } from "@/lib/evidence-map/types";
import type { Cell, CellStatus, EvidenceMetrics, MatrixRow } from "@/lib/evidence-map/types";
import { BulkEvidenceButtons } from "@/components/admin/bulk-evidence-buttons";

/**
 * Evidence & Validity Map — client view. Two tabs: a live Dashboard of
 * per-instrument data counts, and the tabulated Coverage Matrix. Plain
 * English (admin portal is not localized).
 */

type Props = {
  metrics: EvidenceMetrics;
  matrix: MatrixRow[];
  totals: Record<CellStatus, number>;
};

const fmt = (n: number | null) => (n === null ? "—" : n.toLocaleString());

const STATUS_STYLE: Record<CellStatus, { cell: string; dot: string; label: string }> = {
  documented: { cell: "bg-emerald-50 text-emerald-900", dot: "bg-emerald-500", label: "Documented" },
  partial:    { cell: "bg-amber-50 text-amber-900", dot: "bg-amber-500", label: "Partial / in progress" },
  missing:    { cell: "bg-rose-50 text-rose-900", dot: "bg-rose-500", label: "Missing" },
  na:         { cell: "bg-muted text-muted-foreground", dot: "bg-muted-foreground/40", label: "Not applicable" },
};

const STATUS_ICON: Record<CellStatus, typeof CheckCircle2> = {
  documented: CheckCircle2,
  partial: CircleDashed,
  missing: CircleSlash,
  na: MinusCircle,
};

export function EvidenceMapClient({ metrics, matrix, totals }: Props) {
  const [tab, setTab] = useState<"dashboard" | "matrix">("dashboard");

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-2 mb-1">
        <FlaskConical className="h-5 w-5 text-accent" />
        <h1 className="text-xl font-bold">Evidence &amp; Validity Map</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-4 max-w-3xl">
        Where every VIFM instrument stands on scientific provenance and psychometric defensibility.
        The dashboard counts move as data is collected; the matrix shows what is documented versus
        still open. Use this to answer a client&apos;s &ldquo;where do these come from, and how do you
        know they&apos;re valid?&rdquo;
      </p>

      {/* Legend + roll-up */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-5 text-xs">
        {(Object.keys(STATUS_STYLE) as CellStatus[]).map((s) => (
          <span key={s} className="inline-flex items-center gap-1.5">
            <span className={`h-2.5 w-2.5 rounded-full ${STATUS_STYLE[s].dot}`} />
            {STATUS_STYLE[s].label}
            <span className="text-muted-foreground">({totals[s]})</span>
          </span>
        ))}
      </div>

      <BulkEvidenceButtons show={["ac", "arc"]} />

      {/* Tabs */}
      <div className="inline-flex rounded-lg border bg-card p-1 mb-6">
        <TabButton active={tab === "dashboard"} onClick={() => setTab("dashboard")} icon={LayoutGrid}>
          Dashboard
        </TabButton>
        <TabButton active={tab === "matrix"} onClick={() => setTab("matrix")} icon={Table2}>
          Coverage matrix
        </TabButton>
      </div>

      {tab === "dashboard" ? <Dashboard metrics={metrics} /> : <Matrix matrix={matrix} />}
    </div>
  );
}

function TabButton({
  active, onClick, icon: Icon, children,
}: { active: boolean; onClick: () => void; icon: typeof LayoutGrid; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
        active ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      <Icon className="h-4 w-4" /> {children}
    </button>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────
function Dashboard({ metrics }: { metrics: EvidenceMetrics }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <InstrumentCard
        title="Assessment Center"
        href="/admin/ac-evidence"
        stats={[
          { label: "Competencies", value: fmt(metrics.ac.competenciesTotal) },
          { label: "Documented", value: fmt(metrics.ac.competenciesVerified), accent: "text-emerald-700" },
          { label: "AI proposed", value: fmt(metrics.ac.competenciesProposed), accent: "text-amber-700" },
          { label: "Indicators", value: fmt(metrics.ac.indicators) },
          { label: "Exercises", value: fmt(metrics.ac.exercises) },
          { label: "Ratings (ICC)", value: fmt(metrics.ac.ratings) },
        ]}
        bars={[bar("Evidence coverage", metrics.ac.competenciesVerified, metrics.ac.competenciesTotal)]}
      />
      <InstrumentCard
        title="ARC — AI Readiness Compass"
        href="/ara/admin/questions"
        stats={[
          { label: "Questions", value: fmt(metrics.arc.questionsTotal) },
          { label: "Documented", value: fmt(metrics.arc.questionsVerified), accent: "text-emerald-700" },
          { label: "AI proposed", value: fmt(metrics.arc.questionsProposed), accent: "text-amber-700" },
          { label: "Responses", value: fmt(metrics.arc.responses) },
          { label: "Completed respondents", value: fmt(metrics.arc.respondentsCompleted) },
          { label: "Assessments", value: fmt(metrics.arc.assessments) },
        ]}
        bars={[
          bar("Evidence coverage", metrics.arc.questionsVerified, metrics.arc.questionsTotal),
          bar("Individual CFA / α (N≥200)", metrics.arc.respondentsCompleted, 200),
          bar("Org reliability (N≥50)", metrics.arc.assessments, 50),
        ]}
      />
      <InstrumentCard
        title="Fluent (English)"
        stats={[
          { label: "Items", value: fmt(metrics.fluent.items) },
          { label: "Live", value: fmt(metrics.fluent.live), accent: "text-emerald-700" },
          { label: "Calibrated (IRT)", value: fmt(metrics.fluent.calibrated) },
          { label: "Human ratings (QWK)", value: fmt(metrics.fluent.humanRatings) },
          { label: "Results", value: fmt(metrics.fluent.results) },
        ]}
        bars={[bar("Items calibrated", metrics.fluent.calibrated, metrics.fluent.items)]}
      />
      <InstrumentCard
        title="Technical Certification"
        href="/admin/tech-assessment/items"
        stats={[
          { label: "Items", value: fmt(metrics.technical.items) },
          { label: "Approved", value: fmt(metrics.technical.approved), accent: "text-emerald-700" },
          { label: "Calibrated (IRT)", value: fmt(metrics.technical.calibrated) },
          { label: "Cut-scores set", value: fmt(metrics.technical.cutScores) },
          { label: "Results", value: fmt(metrics.technical.results) },
        ]}
        bars={[bar("Items approved", metrics.technical.approved, metrics.technical.items)]}
      />
      <InstrumentCard
        title="Reflect 360"
        stats={[
          { label: "Competencies", value: fmt(metrics.reflect.competencies) },
          { label: "Behaviours", value: fmt(metrics.reflect.behaviors) },
          { label: "AI-authored", value: fmt(metrics.reflect.behaviorsAi), accent: "text-amber-700" },
          { label: "Responses", value: fmt(metrics.reflect.responses) },
        ]}
        bars={[]}
      />
      <InstrumentCard
        title="Psychometrics"
        href="/admin/psychometrics"
        stats={[
          { label: "Items", value: fmt(metrics.psy.items) },
          { label: "Approved", value: fmt(metrics.psy.approved), accent: "text-emerald-700" },
          { label: "Norm rows", value: fmt(metrics.psy.norms) },
          { label: "Item responses", value: fmt(metrics.psy.itemResponses) },
          { label: "Results", value: fmt(metrics.psy.results) },
        ]}
        bars={[bar("Cronbach α sample (N≥200)", metrics.psy.itemResponses, 200)]}
      />
    </div>
  );
}

type BarSpec = { label: string; n: number | null; threshold: number | null; pct: number | null };
function bar(label: string, n: number | null, threshold: number | null): BarSpec {
  const pct = n === null || !threshold ? null : Math.min(100, Math.round((n / threshold) * 100));
  return { label, n, threshold, pct };
}

function InstrumentCard({
  title, href, stats, bars,
}: {
  title: string;
  href?: string;
  stats: Array<{ label: string; value: string; accent?: string }>;
  bars: BarSpec[];
}) {
  return (
    <div className="rounded-lg border bg-card p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold">{title}</h2>
        {href && (
          <Link href={href} className="inline-flex items-center gap-1 text-[11px] text-accent hover:underline">
            Manage <ExternalLink className="h-3 w-3" />
          </Link>
        )}
      </div>
      <div className="grid grid-cols-3 gap-3 mb-4">
        {stats.map((s) => (
          <div key={s.label}>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground leading-tight">{s.label}</p>
            <p className={`text-lg font-bold ${s.accent ?? ""}`}>{s.value}</p>
          </div>
        ))}
      </div>
      {bars.length > 0 && (
        <div className="space-y-2.5">
          {bars.map((b) => (
            <div key={b.label}>
              <div className="flex items-center justify-between text-[11px] mb-1">
                <span className="text-muted-foreground">{b.label}</span>
                <span className="font-medium">
                  {b.n === null ? "—" : b.threshold ? `${b.pct}%` : b.n}
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full ${(b.pct ?? 0) >= 100 ? "bg-emerald-500" : "bg-accent"}`}
                  style={{ width: `${b.pct ?? 0}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Coverage matrix ───────────────────────────────────────────────────
function Matrix({ matrix }: { matrix: MatrixRow[] }) {
  return (
    <div className="rounded-lg border bg-card overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="sticky left-0 z-10 bg-card text-left font-semibold p-3 min-w-[220px]">
              Validity / reliability evidence
            </th>
            {INSTRUMENTS.map((inst) => (
              <th key={inst.key} className="p-3 text-center font-semibold whitespace-nowrap min-w-[120px]">
                {inst.href ? (
                  <Link href={inst.href} className="hover:underline">{inst.label}</Link>
                ) : (
                  inst.label
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.map((row) => (
            <tr key={row.category} className="border-b border-border last:border-0 align-top">
              <td className="sticky left-0 z-10 bg-card p-3">
                <p className="font-medium leading-tight">{row.category}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{row.blurb}</p>
              </td>
              {INSTRUMENTS.map((inst) => (
                <MatrixCell key={inst.key} cell={row.cells[inst.key]} />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MatrixCell({ cell }: { cell: Cell }) {
  const style = STATUS_STYLE[cell.status];
  const Icon = STATUS_ICON[cell.status];
  return (
    <td className={`p-3 text-center ${style.cell}`} title={cell.note ?? style.label}>
      <div className="flex flex-col items-center gap-1">
        <Icon className="h-4 w-4" />
        {cell.note && <span className="text-[10px] leading-tight">{cell.note}</span>}
        {cell.live && (
          <span className="text-[8px] uppercase tracking-wider font-bold opacity-60">live</span>
        )}
      </div>
    </td>
  );
}
