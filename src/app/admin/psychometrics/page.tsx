export const dynamic = "force-dynamic";

import Link from "next/link";
import { BrainCircuit, FlaskConical, Database, Gauge, ArrowUpRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BackLink } from "@/components/shared/back-link";
import { loadPsyBank } from "@/lib/psychometrics/bank";
import { PSY_TIER } from "@/lib/psychometrics/calibration";
import { BankConsole } from "./_components/bank-console";

export default async function PsychometricsBankPage() {
  const view = await loadPsyBank();
  const calibratedScales = view.instruments.flatMap((i) => i.scales).filter((s) => s.tier === "calibrated").length;
  const totalScales = view.instruments.flatMap((i) => i.scales).length;

  return (
    <div className="space-y-6">
      <BackLink href="/" label="All services" />

      {/* Header */}
      <div className="rounded-md border bg-gradient-to-r from-[#1e1b4b] to-[#4338ca] text-white p-5">
        <div className="flex items-start gap-3">
          <BrainCircuit className="h-8 w-8 text-indigo-200 shrink-0" />
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wide text-indigo-100/80">Psychometrics · Tier 2</p>
            <h1 className="text-2xl font-bold leading-tight">Item bank &amp; calibration</h1>
            <p className="text-sm text-indigo-50/90 mt-1 max-w-3xl">
              The SME workflow that promotes the indicative runner to a norm-referenced instrument.
              Build a reviewed item bank per scale, accumulate responses for reliability, load a norm
              group, and each scale flips from Tier&nbsp;1 (indicative) to Tier&nbsp;2 (calibrated).
              Psychometrics yields scores and a defensible report — never a pass/fail credential.
            </p>
            <p className="text-xs text-indigo-100/80 mt-2">
              {calibratedScales} of {totalScales} scales calibrated
            </p>
          </div>
        </div>
      </div>

      {/* The three gates */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">How a scale becomes calibrated</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3 text-sm">
          <div className="flex items-start gap-2">
            <FlaskConical className="h-5 w-5 text-indigo-500 shrink-0" />
            <div>
              <p className="font-semibold text-dark">Content</p>
              <p className="text-slate-500">≥ {PSY_TIER.minApprovedPerScale} SME-approved items per scale. AI-draft a batch below, then review each into the bank.</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Gauge className="h-5 w-5 text-indigo-500 shrink-0" />
            <div>
              <p className="font-semibold text-dark">Reliability</p>
              <p className="text-slate-500">Cronbach&apos;s α ≥ {PSY_TIER.minAlpha}, computed from real responses to the approved bank items.</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Database className="h-5 w-5 text-indigo-500 shrink-0" />
            <div>
              <p className="font-semibold text-dark">Norms</p>
              <p className="text-slate-500">A norm group of ≥ {PSY_TIER.minNormN} (psy_norms) so raw scores become percentiles and stens.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Migration hints (tolerant) */}
      {!view.tablesReady && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          The psychometrics bank tables aren&apos;t fully present yet. Apply migration <code>00065_psychometrics.sql</code> to enable item authoring.
        </div>
      )}
      {view.tablesReady && !view.normsReady && (
        <div className="rounded-md border border-indigo-200 bg-indigo-50 p-3 text-sm text-indigo-800">
          Norm-referencing is dark until migration <code>00067_psychometrics_calibration.sql</code> is applied and a norm group is loaded.
          Until then scales stay Tier-1 indicative even with a full item bank.
        </div>
      )}

      <BankConsole view={view} />

      <p className="text-xs text-slate-400">
        Take the assessment at{" "}
        <Link href="/ac/psychometrics" className="inline-flex items-center gap-0.5 text-accent hover:underline">
          the runner <ArrowUpRight className="h-3 w-3" />
        </Link>
        . Once a scale clears all three gates, its results are reported as percentiles/stens against the norm group.
      </p>
    </div>
  );
}
