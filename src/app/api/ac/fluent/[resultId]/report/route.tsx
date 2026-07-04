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
import { requireRole, isAuthorizationError, getCurrentCaller } from "@/lib/ara/auth-guards";
import { getClientOrgId } from "@/lib/auth/get-org-id";
import { createServiceClient } from "@/lib/supabase/server";
import { FluentReport } from "@/lib/reports/fluent-report";
import type { FluentResult } from "@/lib/ai/fluent-english";
import { computeIntegritySignal, type IntegrityFlags, type IntegritySignal } from "@/lib/scoring/integrity";
import { recommendEnglishDevelopment, type EnglishRecommendations } from "@/lib/recommender/english";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// The report is EN-only React-PDF (Helvetica cannot shape Arabic), so an Arabic
// name would print as tofu. Fall back to the (Latin) email, then a generic label,
// so the identity line is always readable.
const hasArabic = (s: string) => /[؀-ۿݐ-ݿ]/.test(s);
const latinSafeName = (name: string | null, email: string | null): string => {
  const n = name?.trim();
  return n && !hasArabic(n) ? n : email?.trim() || "Candidate";
};

type Row = {
  id: string;
  created_at: string;
  taker_name: string | null;
  taker_email: string | null;
  result: (FluentResult & { reliability?: { low?: string; high?: string } }) | null;
  // Voucher redemption this result is stamped with (00044) - the link to a
  // camera-proctoring session (proctor_sessions.ref_id = the redemption token).
  voucher_redemption_id: string | null;
  // Advisory integrity telemetry (migration 00043). Persisted as the raw flags
  // plus a `signal` (CAL-FLU-601); absent on a 00042-only DB.
  integrity_flags: (IntegrityFlags & { signal?: IntegritySignal }) | null;
  organization_id: string | null;
};

export async function GET(req: Request, { params }: { params: { resultId: string } }) {
  // XP-13: staff-only deliverable. Additive: a client_manager may also download a
  // report, but only for a result belonging to their own organisation.
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
    const sb = createServiceClient();
    const { data } = await sb
      .from("eng_fluent_results")
      .select("id, created_at, taker_name, taker_email, result, integrity_flags, voucher_redemption_id, organization_id")
      .eq("id", params.resultId)
      .single();
    row = (data as Row) ?? null;
  } catch {
    row = null;
  }
  if (!row || !row.result) {
    return NextResponse.json({ error: "Result not found" }, { status: 404 });
  }
  if (clientMgrOrgId && row.organization_id !== clientMgrOrgId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const name = latinSafeName(row.taker_name, row.taker_email);
  const date = new Date(row.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const band = row.result.reliability;
  const rangeText = band?.low && band?.high ? (band.low === band.high ? band.low : `${band.low}-${band.high}`) : null;

  // Surface the advisory integrity signal in the report (CAL-FLU-601): prefer the
  // stored signal; recompute from the raw flags for older rows that predate it;
  // null on a 00042-only DB so the section is simply omitted.
  const integrity: IntegritySignal | null =
    row.integrity_flags?.signal && Array.isArray(row.integrity_flags.signal.reasons)
      ? row.integrity_flags.signal
      : row.integrity_flags
        ? computeIntegritySignal(row.integrity_flags)
        : null;

  // English-development recommendations (VIFM catalogue + pluggable partner
  // courses). Best-effort: a recommender failure must never block the report.
  let recommendations: EnglishRecommendations | null = null;
  try {
    recommendations = await recommendEnglishDevelopment({ result: row.result });
  } catch {
    recommendations = null;
  }

  // Camera-proctoring attestation: link this placement report to its Proctoring &
  // Integrity Report when the sitting was proctored. result -> redemption ->
  // proctor session (ref_id = the redemption token). Best-effort + tolerant of an
  // un-applied proctoring migration (no proctor_sessions table -> no attestation).
  let proctoring: { sessionId: string; reportUrl: string | null } | null = null;
  try {
    if (row.voucher_redemption_id) {
      const sbp = createServiceClient();
      const { data: red } = await sbp
        .from("eng_fluent_voucher_redemptions")
        .select("redemption_token")
        .eq("id", row.voucher_redemption_id)
        .maybeSingle<{ redemption_token: string }>();
      if (red?.redemption_token) {
        const { data: ps } = await sbp
          .from("proctor_sessions")
          .select("id, snapshot_count")
          .eq("context", "fluent")
          .eq("ref_id", red.redemption_token)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle<{ id: string; snapshot_count: number }>();
        if (ps && ps.snapshot_count > 0) {
          // Absolute URL for the embedded link. On Render behind Cloudflare,
          // new URL(req.url).origin is the INTERNAL host, so the link baked into
          // the PDF would be unreachable - prefer the configured public base and
          // fall back to the request origin only in local dev.
          const base = (
            process.env.NEXT_PUBLIC_SITE_URL ||
            process.env.NEXT_PUBLIC_APP_URL ||
            (process.env.NODE_ENV === "production" ? "https://caliber.viftraining.com" : new URL(req.url).origin)
          ).replace(/\/+$/, "");
          proctoring = { sessionId: ps.id, reportUrl: `${base}/api/admin/proctor/${ps.id}/report` };
        }
      }
    }
  } catch {
    proctoring = null;
  }

  const buffer = await renderToBuffer(
    <FluentReport data={{ name, date, result: row.result, rangeText, integrity, recommendations, proctoring }} />
  );
  const safe = name.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() || "candidate";
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="english-report-${safe}.pdf"`,
    },
  });
}
