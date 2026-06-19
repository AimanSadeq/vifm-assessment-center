/**
 * Fluent - comprehensive English placement REPORT (PDF).
 *
 *   GET /api/ac/fluent/[resultId]/report  -> downloadable comprehensive PDF
 *
 * The full per-skill breakdown (reading/listening/writing/speaking + writing
 * issues + definitions), distinct from the one-page certificate. Staff-only
 * (XP-13): takers never see results; an admin downloads/sends this. Reads the
 * stored `result` jsonb via the service client.
 */
import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { requireRole, isAuthorizationError } from "@/lib/ara/auth-guards";
import { createServiceClient } from "@/lib/supabase/server";
import { FluentReport } from "@/lib/reports/fluent-report";
import type { FluentResult } from "@/lib/ai/fluent-english";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Row = {
  id: string;
  created_at: string;
  taker_name: string | null;
  result: (FluentResult & { reliability?: { low?: string; high?: string } }) | null;
};

export async function GET(_req: Request, { params }: { params: { resultId: string } }) {
  // XP-13: staff-only deliverable.
  try {
    await requireRole(["admin", "consultant", "lead_assessor", "associate_assessor"]);
  } catch (e) {
    if (isAuthorizationError(e)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    throw e;
  }

  let row: Row | null = null;
  try {
    const sb = createServiceClient();
    const { data } = await sb
      .from("eng_fluent_results")
      .select("id, created_at, taker_name, result")
      .eq("id", params.resultId)
      .single();
    row = (data as Row) ?? null;
  } catch {
    row = null;
  }
  if (!row || !row.result) {
    return NextResponse.json({ error: "Result not found" }, { status: 404 });
  }

  const name = row.taker_name?.trim() || "Candidate";
  const date = new Date(row.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const band = row.result.reliability;
  const rangeText = band?.low && band?.high ? (band.low === band.high ? band.low : `${band.low}-${band.high}`) : null;

  const buffer = await renderToBuffer(<FluentReport data={{ name, date, result: row.result, rangeText }} />);
  const safe = name.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() || "candidate";
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="english-report-${safe}.pdf"`,
    },
  });
}
