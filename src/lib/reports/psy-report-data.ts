// Shared data builder for the Logica (cognitive) result report - extracted from
// /api/ac/cognitive/[resultId]/report so the standalone route and the bundle
// combined report render the identical document from one code path.

import { createServiceClient } from "@/lib/supabase/server";
import type { PsyReportData, PsyReportScale } from "@/lib/reports/psychometric-report";
import {
  COGNITIVE_INSTRUMENT,
  BAND_LABEL_EN,
  COGNITIVE_SUBTESTS,
  cognitiveNarrative,
  type PsyBand,
} from "@/lib/psychometrics/framework";
import type { PsyResult } from "@/lib/psychometrics/scoring";

/**
 * The React-PDF report renders in Helvetica, which cannot shape Arabic glyphs -
 * an Arabic name would print as blank/tofu boxes on the identity line. Fall back
 * to the (Latin) email, then a generic label, so the report is always readable.
 * The Arabic name still shows correctly on the HTML cohort view. Exported so the
 * combined bundle cover can apply the same guard.
 */
export function latinSafeName(name: string | null, email: string | null): string {
  const n = name?.trim();
  if (n && !/[؀-ۿݐ-ݿ]/.test(n)) return n;
  return email?.trim() || "Candidate";
}

function scaleMeta(key: string): { name: string; predicts: string[]; definition?: string } {
  const d = COGNITIVE_SUBTESTS.find((x) => x.key === key);
  return { name: d?.name_en ?? key, predicts: d?.competencies ?? [], definition: d?.definition_en };
}

export type PsyReportBuild =
  | { ok: true; data: PsyReportData; organizationId: string | null }
  | { ok: false; status: number; error: string };

export async function buildPsyReportData(resultId: string): Promise<PsyReportBuild> {
  type Row = { kind: string; taker_name: string | null; taker_email: string | null; created_at: string; result: PsyResult | null; organization_id: string | null };
  let row: Row | null = null;
  try {
    const svc = createServiceClient();
    const { data } = await svc
      .from("psy_results")
      .select("kind, taker_name, taker_email, created_at, result, organization_id")
      .eq("id", resultId)
      .single();
    row = (data as Row) ?? null;
  } catch {
    row = null;
  }
  if (!row || !row.result) return { ok: false, status: 404, error: "Result not found" };

  const result = row.result;
  const tier: "indicative" | "calibrated" = result.tier === "calibrated" ? "calibrated" : "indicative";

  let normSource: string | null = null;
  if (tier === "calibrated") {
    try {
      const svc = createServiceClient();
      const { data } = await svc.from("psy_norms").select("source").eq("kind", row.kind).limit(1).maybeSingle();
      normSource = (data as { source?: string } | null)?.source ?? null;
    } catch {
      normSource = null;
    }
  }

  const scales: PsyReportScale[] = (result.scales ?? []).map((sc) => {
    const band = sc.band as PsyBand;
    const meta = scaleMeta(sc.key);
    return {
      key: sc.key,
      name: meta.name,
      predicts: meta.predicts,
      raw: sc.raw,
      rawLabel: `${Math.round(sc.raw)}%`,
      band,
      bandLabel: BAND_LABEL_EN[band] ?? sc.bandLabel,
      sten: sc.sten,
      percentile: sc.percentile,
      definition: meta.definition,
      narrative: cognitiveNarrative(sc.raw, false),
    };
  });

  // The general mental ability (g) composite is only meaningful across the full
  // reasoning battery. A scoped sitting (one or two subtests) must NOT present a
  // "g" it did not measure: suppress the composite for a single subtest, and for
  // a partial (2-3 of 4) relabel it honestly as a reasoning average.
  let overall: PsyReportData["overall"];
  if (result.overall && scales.length >= 2) {
    const b = result.overall.band as PsyBand;
    const fullBattery = scales.length >= COGNITIVE_SUBTESTS.length;
    overall = {
      label: fullBattery ? "General mental ability (g)" : "Reasoning average (partial battery)",
      normalized: result.overall.normalized,
      bandLabel: BAND_LABEL_EN[b] ?? result.overall.bandLabel,
      percentile: result.overall.percentile,
    };
  }

  return {
    ok: true,
    organizationId: row.organization_id,
    data: {
      kind: "cognitive",
      instrumentName: COGNITIVE_INSTRUMENT.name_en,
      takerName: latinSafeName(row.taker_name, row.taker_email),
      date: new Date(row.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }),
      tier,
      normSource,
      scales,
      overall,
    },
  };
}
