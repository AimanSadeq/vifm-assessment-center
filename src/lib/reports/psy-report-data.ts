// Shared data builder for the Logica (cognitive) result report - extracted from
// /api/ac/cognitive/[resultId]/report so the standalone route and the bundle
// combined report render the identical document from one code path.

import { createServiceClient } from "@/lib/supabase/server";
import type { PsyReportData, PsyReportScale } from "@/lib/reports/psychometric-report";
import {
  COGNITIVE_INSTRUMENT,
  PERSONALITY_INSTRUMENT,
  BAND_LABEL_EN,
  COGNITIVE_SUBTESTS,
  BIG_FIVE,
  cognitiveNarrative,
  type PsyBand,
} from "@/lib/psychometrics/framework";
import type { PsyResult } from "@/lib/psychometrics/scoring";

function scaleMeta(kind: string, key: string): { name: string; predicts: string[]; definition?: string } {
  if (kind === "cognitive") {
    const d = COGNITIVE_SUBTESTS.find((x) => x.key === key);
    return { name: d?.name_en ?? key, predicts: d?.competencies ?? [], definition: d?.definition_en };
  }
  const d = BIG_FIVE.find((x) => x.key === key);
  return { name: d?.name_en ?? key, predicts: d?.competencies ?? [] };
}

export type PsyReportBuild =
  | { ok: true; data: PsyReportData; organizationId: string | null }
  | { ok: false; status: number; error: string };

export async function buildPsyReportData(resultId: string): Promise<PsyReportBuild> {
  type Row = { kind: string; taker_name: string | null; created_at: string; result: PsyResult | null; organization_id: string | null };
  let row: Row | null = null;
  try {
    const svc = createServiceClient();
    const { data } = await svc
      .from("psy_results")
      .select("kind, taker_name, created_at, result, organization_id")
      .eq("id", resultId)
      .single();
    row = (data as Row) ?? null;
  } catch {
    row = null;
  }
  if (!row || !row.result) return { ok: false, status: 404, error: "Result not found" };

  const result = row.result;
  const isCog = row.kind === "cognitive";
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
    const meta = scaleMeta(row!.kind, sc.key);
    return {
      key: sc.key,
      name: meta.name,
      predicts: meta.predicts,
      raw: sc.raw,
      rawLabel: isCog ? `${Math.round(sc.raw)}%` : `${sc.raw.toFixed(1)} / 5`,
      band,
      bandLabel: BAND_LABEL_EN[band] ?? sc.bandLabel,
      sten: sc.sten,
      percentile: sc.percentile,
      definition: meta.definition,
      narrative: isCog ? cognitiveNarrative(sc.raw, false) : undefined,
    };
  });

  let overall: PsyReportData["overall"];
  if (isCog && result.overall) {
    const b = result.overall.band as PsyBand;
    overall = {
      label: "General mental ability (g)",
      normalized: result.overall.normalized,
      bandLabel: BAND_LABEL_EN[b] ?? result.overall.bandLabel,
      percentile: result.overall.percentile,
    };
  }

  return {
    ok: true,
    organizationId: row.organization_id,
    data: {
      kind: isCog ? "cognitive" : "personality",
      instrumentName: isCog ? COGNITIVE_INSTRUMENT.name_en : PERSONALITY_INSTRUMENT.name_en,
      takerName: row.taker_name?.trim() || "Candidate",
      date: new Date(row.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }),
      tier,
      normSource,
      scales,
      overall,
      validity: result.validity,
    },
  };
}
