// Org-scoped activity reader for the client portal (server-only). Returns the
// issued -> redeemed -> completed funnel + the list of completed sittings (with
// each one's report path) for a voucher service, filtered to the caller's org.
// Reads via the service client (these result tables are admin-RLS); the CALLER
// must already have gated role + resolved orgId from the profile.

import { createServiceClient } from "@/lib/supabase/server";
import type { CaliberService } from "./portal-services";

export type ActivityRow = { id: string; name: string; date: string; summary: string; reportPath: string };
export type ServiceActivity = { issued: number; redeemed: number; completed: number; rows: ActivityRow[] };

const EMPTY: ServiceActivity = { issued: 0, redeemed: 0, completed: 0, rows: [] };

async function countOrg(table: string, orgId: string, col = "id"): Promise<number> {
  try {
    const sb = createServiceClient();
    const { count } = await sb.from(table).select(col, { count: "exact", head: true }).eq("organization_id", orgId);
    return count ?? 0;
  } catch {
    return 0;
  }
}

// Techno keys on organization_name (no org id FK yet - name bridge).
async function countByName(table: string, orgName: string): Promise<number> {
  try {
    const sb = createServiceClient();
    const { count } = await sb.from(table).select("id", { count: "exact", head: true }).eq("organization_name", orgName);
    return count ?? 0;
  } catch {
    return 0;
  }
}

export async function getServiceActivity(service: CaliberService, orgId: string): Promise<ServiceActivity> {
  const sb = createServiceClient();
  try {
    if (service === "fluent") {
      const [issued, redeemed] = await Promise.all([
        countOrg("eng_fluent_vouchers", orgId),
        countOrg("eng_fluent_voucher_redemptions", orgId),
      ]);
      const { data } = await sb
        .from("eng_fluent_results")
        .select("id, created_at, taker_name, overall_cefr")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false })
        .limit(100);
      const list = (data ?? []) as { id: string; created_at: string; taker_name: string | null; overall_cefr: string | null }[];
      const rows = list.map((r) => ({
        id: r.id,
        name: r.taker_name?.trim() || "Candidate",
        date: r.created_at,
        summary: r.overall_cefr ? `CEFR ${r.overall_cefr}` : "Completed",
        reportPath: `/api/ac/fluent/${r.id}/report`,
      }));
      return { issued, redeemed, completed: rows.length, rows };
    }

    if (service === "logica") {
      const [issued, redeemed] = await Promise.all([
        countOrg("cognitive_vouchers", orgId),
        countOrg("cognitive_voucher_redemptions", orgId),
      ]);
      const { data } = await sb
        .from("psy_results")
        .select("id, created_at, taker_name, result")
        .eq("kind", "cognitive")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false })
        .limit(100);
      const list = (data ?? []) as { id: string; created_at: string; taker_name: string | null; result: { overall?: { band?: string } } | null }[];
      const rows = list.map((r) => ({
        id: r.id,
        name: r.taker_name?.trim() || "Candidate",
        date: r.created_at,
        summary: r.result?.overall?.band ? String(r.result.overall.band) : "Completed",
        reportPath: `/api/ac/cognitive/${r.id}/report`,
      }));
      return { issued, redeemed, completed: rows.length, rows };
    }

    if (service === "persona") {
      const [issued, redeemed] = await Promise.all([
        countOrg("persona_vouchers", orgId),
        countOrg("persona_voucher_redemptions", orgId),
      ]);
      const { data } = await sb
        .from("behavioral_assessment_sessions")
        .select("id, created_at, submitted_at, taker_name, status")
        .eq("organization_id", orgId)
        .eq("status", "submitted")
        .order("created_at", { ascending: false })
        .limit(100);
      const list = (data ?? []) as { id: string; created_at: string; submitted_at: string | null; taker_name: string | null }[];
      const rows = list.map((r) => ({
        id: r.id,
        name: r.taker_name?.trim() || "Candidate",
        date: r.submitted_at || r.created_at,
        summary: "Completed",
        reportPath: `/api/ac/persona/${r.id}/report`,
      }));
      return { issued, redeemed, completed: rows.length, rows };
    }

    if (service === "techno") {
      const { data: org } = await sb.from("organizations").select("name").eq("id", orgId).maybeSingle<{ name: string }>();
      const orgName = org?.name ?? null;
      if (!orgName) return EMPTY;
      const [issued, redeemed] = await Promise.all([
        countByName("technical_sandbox_vouchers", orgName),
        countByName("technical_sandbox_sessions", orgName),
      ]);
      const { data } = await sb
        .from("technical_sandbox_sessions")
        .select("access_token, candidate_name, submitted_at, overall_band")
        .eq("organization_name", orgName)
        .not("submitted_at", "is", null)
        .order("submitted_at", { ascending: false })
        .limit(100);
      const list = (data ?? []) as { access_token: string; candidate_name: string | null; submitted_at: string | null; overall_band: string | null }[];
      const rows = list.map((r) => ({
        id: r.access_token,
        name: r.candidate_name?.trim() || "Candidate",
        date: r.submitted_at || "",
        summary: r.overall_band || "Completed",
        reportPath: `/admin/tech-sandbox/results/${r.access_token}`,
      }));
      return { issued, redeemed, completed: rows.length, rows };
    }
  } catch {
    // tolerant: a missing org column / unmigrated table just yields the empty funnel
  }
  return EMPTY;
}
