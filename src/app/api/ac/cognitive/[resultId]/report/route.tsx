/**
 * VIFM Cognitive Ability - professional result report (PDF).
 *
 *   GET /api/ac/cognitive/[resultId]/report  → downloadable PDF
 *
 * Reads the stored result via the service client (psy_results is admin-RLS; the
 * result id is an unguessable uuid handed back to the taker after scoring, mirror
 * of the Fluent certificate). English React-PDF. 404s cleanly if the row/table is
 * absent. Norm-references the display only when the stored result is `calibrated`.
 */

import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { requireRole, isAuthorizationError, getCurrentCaller } from "@/lib/ara/auth-guards";
import { getClientOrgId } from "@/lib/auth/get-org-id";
import { createServiceClient } from "@/lib/supabase/server";
import { PsychometricReport, type PsyReportData, type PsyReportScale } from "@/lib/reports/psychometric-report";
import {
  COGNITIVE_INSTRUMENT, PERSONALITY_INSTRUMENT, BAND_LABEL_EN,
  COGNITIVE_SUBTESTS, BIG_FIVE, cognitiveNarrative, type PsyBand,
} from "@/lib/psychometrics/framework";
import type { PsyResult } from "@/lib/psychometrics/scoring";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Resolve a scale's display name, the competencies it predicts (Foundations), and (cognitive) a fuller definition. */
function scaleMeta(kind: string, key: string): { name: string; predicts: string[]; definition?: string } {
  if (kind === "cognitive") {
    const d = COGNITIVE_SUBTESTS.find((x) => x.key === key);
    return { name: d?.name_en ?? key, predicts: d?.competencies ?? [], definition: d?.definition_en };
  }
  const d = BIG_FIVE.find((x) => x.key === key);
  return { name: d?.name_en ?? key, predicts: d?.competencies ?? [] };
}

function notFound(): Response {
  return new Response(
    `<!doctype html><meta charset="utf-8"><title>Report not found</title>` +
      `<body style="font-family:system-ui;padding:3rem;color:#010131">` +
      `<h1>Report not available</h1><p>This result could not be found. It may have expired or not been saved.</p></body>`,
    { status: 404, headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

type Row = { kind: string; taker_name: string | null; created_at: string; result: PsyResult | null; organization_id: string | null };

export async function GET(_req: Request, { params }: { params: { resultId: string } }) {
  // XP-13: staff-only. Takers never see their cognitive result; an admin
  // downloads/sends it from the cohort view. Additive: a client_manager may also
  // download, but only for a result in their own organisation.
  let clientMgrOrgId: string | null = null;
  try {
    await requireRole(["admin", "consultant", "lead_assessor", "associate_assessor"]);
  } catch (e) {
    if (!isAuthorizationError(e)) throw e;
    const caller = await getCurrentCaller();
    if (caller?.role === "client_manager") {
      clientMgrOrgId = await getClientOrgId();
      if (!clientMgrOrgId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    } else {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  let row: Row | null = null;
  try {
    const svc = createServiceClient();
    const { data } = await svc
      .from("psy_results")
      .select("kind, taker_name, created_at, result, organization_id")
      .eq("id", params.resultId)
      .single();
    row = (data as Row) ?? null;
  } catch {
    row = null;
  }
  if (!row || !row.result) return notFound();
  if (clientMgrOrgId && row.organization_id !== clientMgrOrgId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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

  const data: PsyReportData = {
    kind: isCog ? "cognitive" : "personality",
    instrumentName: isCog ? COGNITIVE_INSTRUMENT.name_en : PERSONALITY_INSTRUMENT.name_en,
    takerName: row.taker_name?.trim() || "Candidate",
    date: new Date(row.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }),
    tier,
    normSource,
    scales,
    overall,
    validity: result.validity,
  };

  const safeName = data.takerName.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "candidate";
  const buffer = await renderToBuffer(<PsychometricReport data={data} />);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="VIFM-Psychometric-Report-${safeName}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
