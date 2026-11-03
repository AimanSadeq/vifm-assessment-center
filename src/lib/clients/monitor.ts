// Org-scoped activity reader for the client portal (server-only). Returns the
// issued -> redeemed -> completed funnel + the list of completed sittings (with
// each one's report path) for a voucher service, filtered to the caller's org.
// Reads via the service client (these result tables are admin-RLS); the CALLER
// must already have gated role + resolved orgId from the profile.

import { createServiceClient } from "@/lib/supabase/server";
import { fetchAllPages, chunkIds } from "@/lib/ara/paginate";
import type { CaliberService } from "./portal-services";
import { usableIdentity } from "@/lib/privacy/purged";

export type ReportLink = { label: string; path: string };
export type ActivityRow = {
  id: string;
  name: string;
  date: string;
  summary: string;
  reportPath: string;
  /** Services with more than one report per sitting (Persona: Profile, Leadership, DARE, EQ). */
  reports?: ReportLink[];
};
/** A sitting that was redeemed or started but never submitted (Ahmad, 3 Nov 2026:
 *  a delegate who abandoned Techno was invisible because the lists show
 *  submitted sittings only). */
export type PendingRow = { id: string; name: string; startedAt: string | null; expiresAt: string | null; expired: boolean };
export type ServiceActivity = { issued: number; redeemed: number; completed: number; rows: ActivityRow[]; pending?: PendingRow[] };

const EMPTY: ServiceActivity = { issued: 0, redeemed: 0, completed: 0, rows: [] };

/** The four Persona deliverables for one session, in the order the Persona results page lists them. */
export function personaReportLinks(sessionId: string): ReportLink[] {
  return [
    { label: "Profile", path: `/api/ac/persona/${sessionId}/report` },
    { label: "Leadership", path: `/api/ac/persona/${sessionId}/leadership-report` },
    { label: "DARE", path: `/api/ac/persona/${sessionId}/dare-report` },
    { label: "EQ", path: `/api/ac/persona/${sessionId}/eq-report` },
  ];
}

function pendingRow(id: string, name: string | null | undefined, startedAt: string | null, expiresAt: string | null): PendingRow {
  return {
    id,
    name: usableIdentity(name)?.trim() || "Candidate",
    startedAt,
    expiresAt,
    expired: !!expiresAt && new Date(expiresAt).getTime() < Date.now(),
  };
}

async function countOrg(table: string, orgId: string, col = "id"): Promise<number> {
  try {
    const sb = createServiceClient();
    const { count } = await sb.from(table).select(col, { count: "exact", head: true }).eq("organization_id", orgId);
    return count ?? 0;
  } catch {
    return 0;
  }
}

async function countByName(table: string, orgName: string): Promise<number> {
  try {
    const sb = createServiceClient();
    const { count } = await sb.from(table).select("id", { count: "exact", head: true }).eq("organization_name", orgName);
    return count ?? 0;
  } catch {
    return 0;
  }
}

// Techno tables carry organization_id (vouchers 00190, sessions 00187) plus a
// legacy free-text organization_name. Count rows this org OWNS: organization_id
// primary, plus only the legacy rows with a NULL org_id matched by exact name -
// so a free-text org-name collision can't inflate another org's counts. Tolerant:
// on a DB where the org_id column is absent, degrade to name-only.
async function countOrgWithLegacyName(table: string, orgId: string, orgName: string | null): Promise<number> {
  const sb = createServiceClient();
  try {
    const byId = await sb.from(table).select("id", { count: "exact", head: true }).eq("organization_id", orgId);
    if (byId.error) throw byId.error; // org_id column absent -> name-only fallback
    let total = byId.count ?? 0;
    if (orgName) {
      const legacy = await sb
        .from(table)
        .select("id", { count: "exact", head: true })
        .is("organization_id", null)
        .eq("organization_name", orgName);
      total += legacy.count ?? 0;
    }
    return total;
  } catch {
    return orgName ? countByName(table, orgName) : 0;
  }
}

// ── Voucher ledger: every code the org has issued, who it went to, who redeemed ──

export type LedgerRedeemer = { name: string | null; email: string | null; when: string | null };
export type LedgerRow = {
  code: string;
  assigned: string | null; // assigned_email or label
  status: string;
  maxUses: number;
  usedCount: number;
  issuedAt: string | null;
  redeemers: LedgerRedeemer[];
};

const LEDGER_TABLES: Partial<Record<CaliberService, { vouchers: string; redemptions: string }>> = {
  fluent: { vouchers: "eng_fluent_vouchers", redemptions: "eng_fluent_voucher_redemptions" },
  logica: { vouchers: "cognitive_vouchers", redemptions: "cognitive_voucher_redemptions" },
  persona: { vouchers: "persona_vouchers", redemptions: "persona_voucher_redemptions" },
  techno: { vouchers: "technical_sandbox_vouchers", redemptions: "technical_sandbox_voucher_redemptions" },
};

type VRow = {
  id: string; code: string; label: string | null; status: string;
  max_uses: number | null; used_count: number | null; created_at: string | null;
  assigned_email?: string | null;
};

/** The org's issued vouchers for a service, with redemption identities.
 *  Tolerant: a missing table/column yields an empty ledger, never an error. */
export async function getVoucherLedger(service: CaliberService, orgId: string): Promise<LedgerRow[]> {
  const t = LEDGER_TABLES[service];
  if (!t) return [];
  const sb = createServiceClient();
  try {
    // Page every issued code (a fixed .limit(200) silently dropped the oldest
    // codes for a large org while the funnel's exact count showed the true total).
    let vouchers: VRow[] = [];
    if (service === "techno") {
      // Techno vouchers carry organization_id (00190) + a legacy organization_name.
      // Scope to org-id (proof of issuance) PLUS only legacy rows with a NULL org_id
      // matched by exact name - otherwise an org-name collision would list another
      // org's codes + redeemer identities. Mirrors the session-list split below.
      const { data: org } = await sb.from("organizations").select("name").eq("id", orgId).maybeSingle<{ name: string }>();
      const orgName = org?.name ?? null;
      const techCols = "id, code, label, status, max_uses, used_count, created_at";
      try {
        const byId = await fetchAllPages<VRow>((from, to) =>
          sb
            .from(t.vouchers)
            .select(techCols)
            .eq("organization_id", orgId)
            .order("created_at", { ascending: false })
            .order("id")
            .range(from, to),
        );
        let byName: VRow[] = [];
        if (orgName) {
          byName = await fetchAllPages<VRow>((from, to) =>
            sb
              .from(t.vouchers)
              .select(techCols)
              .is("organization_id", null)
              .eq("organization_name", orgName)
              .order("created_at", { ascending: false })
              .order("id")
              .range(from, to),
          );
        }
        const seen = new Set<string>();
        vouchers = [...byId, ...byName].filter((v) => (seen.has(v.id) ? false : (seen.add(v.id), true)));
      } catch {
        // Pre-00190 (no organization_id column): degrade to legacy name-only.
        if (!orgName) return [];
        vouchers = await fetchAllPages<VRow>((from, to) =>
          sb
            .from(t.vouchers)
            .select(techCols)
            .eq("organization_name", orgName)
            .order("created_at", { ascending: false })
            .order("id")
            .range(from, to),
        );
      }
    } else {
      // assigned_email first (00130); peel it off if the column isn't there.
      try {
        vouchers = await fetchAllPages<VRow>((from, to) =>
          sb
            .from(t.vouchers)
            .select("id, code, label, status, max_uses, used_count, created_at, assigned_email")
            .eq("organization_id", orgId)
            .order("created_at", { ascending: false })
            .order("id")
            .range(from, to),
        );
      } catch {
        vouchers = await fetchAllPages<VRow>((from, to) =>
          sb
            .from(t.vouchers)
            .select("id, code, label, status, max_uses, used_count, created_at")
            .eq("organization_id", orgId)
            .order("created_at", { ascending: false })
            .order("id")
            .range(from, to),
        );
      }
    }
    if (vouchers.length === 0) return [];

    // Redeemer identities per voucher (best-effort). Page + chunk the voucher-id
    // .in() so a large org keeps ALL redeemer identities (the fixed .limit(500)
    // oldest-first dropped the NEWEST redeemers once redemptions passed 500).
    const byVoucher = new Map<string, LedgerRedeemer[]>();
    try {
      // The redemption tables timestamp with `redeemed_at` (NOT created_at); the
      // prior select/order used created_at, which 42703'd and left EVERY ledger's
      // redeemer list silently empty. Use the real column so the identities show.
      type RedRow = { voucher_id: string; redeemer_name: string | null; redeemer_email: string | null; redeemed_at: string | null };
      for (const chunk of chunkIds(vouchers.map((v) => v.id))) {
        const reds = await fetchAllPages<RedRow>((from, to) =>
          sb
            .from(t.redemptions)
            .select("voucher_id, redeemer_name, redeemer_email, redeemed_at")
            .in("voucher_id", chunk)
            .order("redeemed_at", { ascending: true })
            .order("id")
            .range(from, to),
        );
        for (const r of reds) {
          if (!byVoucher.has(r.voucher_id)) byVoucher.set(r.voucher_id, []);
          // "[purged]" is the retention sentinel, not a person - show it as absent
          // rather than rendering it as a name in the client-facing ledger.
          byVoucher.get(r.voucher_id)!.push({
            name: usableIdentity(r.redeemer_name) ?? null,
            email: usableIdentity(r.redeemer_email) ?? null,
            when: r.redeemed_at,
          });
        }
      }
    } catch { /* redemptions table variant - ledger still lists the codes */ }

    return vouchers.map((v) => ({
      code: v.code,
      assigned: v.assigned_email ?? v.label ?? null,
      status: v.status,
      maxUses: Math.max(1, Number(v.max_uses ?? 1)),
      usedCount: Number(v.used_count ?? 0),
      issuedAt: v.created_at,
      redeemers: byVoucher.get(v.id) ?? [],
    }));
  } catch {
    return [];
  }
}

export async function getServiceActivity(service: CaliberService, orgId: string): Promise<ServiceActivity> {
  const sb = createServiceClient();
  try {
    if (service === "fluent") {
      const [issued, redeemed, completedCount] = await Promise.all([
        countOrg("eng_fluent_vouchers", orgId),
        countOrg("eng_fluent_voucher_redemptions", orgId),
        // TRUE completed count (head query) - independent of the 100-row display
        // cap below, so the funnel + insights donut can't undercount a large org.
        countOrg("eng_fluent_results", orgId),
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
      return { issued, redeemed, completed: completedCount, rows };
    }

    if (service === "logica") {
      const [issued, redeemed, completedRes] = await Promise.all([
        countOrg("cognitive_vouchers", orgId),
        countOrg("cognitive_voucher_redemptions", orgId),
        // TRUE completed count (head query), independent of the 100-row display cap.
        sb
          .from("psy_results")
          .select("id", { count: "exact", head: true })
          .eq("kind", "cognitive")
          .eq("organization_id", orgId),
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
      return { issued, redeemed, completed: completedRes.count ?? rows.length, rows };
    }

    if (service === "persona") {
      const [issued, redeemed, completedRes, listRes, pendingRes] = await Promise.all([
        countOrg("persona_vouchers", orgId),
        countOrg("persona_voucher_redemptions", orgId),
        // True completed count (head query) - independent of the 100-row display cap.
        sb
          .from("behavioral_assessment_sessions")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", orgId)
          .eq("status", "submitted"),
        sb
          .from("behavioral_assessment_sessions")
          .select("id, created_at, submitted_at, taker_name, status")
          .eq("organization_id", orgId)
          .eq("status", "submitted")
          .order("created_at", { ascending: false })
          .limit(100),
        sb
          .from("behavioral_assessment_sessions")
          .select("id, created_at, started_at, taker_name")
          .eq("organization_id", orgId)
          .neq("status", "submitted")
          .order("created_at", { ascending: false })
          .limit(100),
      ]);
      const list = (listRes.data ?? []) as { id: string; created_at: string; submitted_at: string | null; taker_name: string | null }[];
      const rows = list.map((r) => ({
        id: r.id,
        name: r.taker_name?.trim() || "Candidate",
        date: r.submitted_at || r.created_at,
        summary: "Completed",
        reportPath: `/api/ac/persona/${r.id}/report`,
        reports: personaReportLinks(r.id),
      }));
      const pendingList = (pendingRes.data ?? []) as { id: string; created_at: string; started_at: string | null; taker_name: string | null }[];
      const pending = pendingList.map((r) => pendingRow(r.id, r.taker_name, r.started_at ?? r.created_at, null));
      return { issued, redeemed, completed: completedRes.count ?? rows.length, rows, pending };
    }

    if (service === "techno") {
      const { data: org } = await sb.from("organizations").select("name").eq("id", orgId).maybeSingle<{ name: string }>();
      const orgName = org?.name ?? null;
      if (!orgName) return EMPTY;
      // org-id primary (+ legacy NULL-org_id name match) so a name collision can't
      // inflate the funnel with another org's vouchers/sittings.
      const [issued, redeemed] = await Promise.all([
        countOrgWithLegacyName("technical_sandbox_vouchers", orgId, orgName),
        countOrgWithLegacyName("technical_sandbox_sessions", orgId, orgName),
      ]);
      const cols = "access_token, candidate_name, submitted_at, overall_band";
      type TechRow = { access_token: string; candidate_name: string | null; submitted_at: string | null; overall_band: string | null };
      // Scope the PII-bearing list to sittings this org actually OWNS: the real
      // organization_id (migration 00187), plus - only for legacy rows with no
      // org_id - a strict name match. Without this, a free-text org-name collision
      // would list (and hand out report tokens for) another org's candidates. The
      // detail page enforces the same rule, so list and report stay consistent.
      const byId = await sb
        .from("technical_sandbox_sessions")
        .select(cols)
        .eq("organization_id", orgId)
        .not("submitted_at", "is", null)
        .order("submitted_at", { ascending: false })
        .limit(100);
      let listRows: TechRow[];
      if (byId.error) {
        // organization_id absent (pre-00187): degrade to the legacy name-only list.
        const legacy = await sb
          .from("technical_sandbox_sessions")
          .select(cols)
          .eq("organization_name", orgName)
          .not("submitted_at", "is", null)
          .order("submitted_at", { ascending: false })
          .limit(100);
        listRows = (legacy.data ?? []) as TechRow[];
      } else {
        const byName = await sb
          .from("technical_sandbox_sessions")
          .select(cols)
          .is("organization_id", null)
          .eq("organization_name", orgName)
          .not("submitted_at", "is", null)
          .order("submitted_at", { ascending: false })
          .limit(100);
        const seen = new Set<string>();
        listRows = [...((byId.data ?? []) as TechRow[]), ...((byName.data ?? []) as TechRow[])]
          .filter((r) => (seen.has(r.access_token) ? false : (seen.add(r.access_token), true)))
          .sort((a, b) => (b.submitted_at ?? "").localeCompare(a.submitted_at ?? ""))
          .slice(0, 100);
      }
      const rows = listRows.map((r) => ({
        id: r.access_token,
        name: r.candidate_name?.trim() || "Candidate",
        date: r.submitted_at || "",
        summary: r.overall_band || "Completed",
        reportPath: `/admin/tech-sandbox/results/${r.access_token}`,
      }));
      // TRUE completed count (submitted sittings this org owns) independent of the
      // 100-row display cap: org_id primary + legacy NULL-org_id name match, so a
      // large org's funnel/donut can't undercount and a name collision can't inflate.
      let completed = rows.length;
      const cBase = () =>
        sb.from("technical_sandbox_sessions").select("id", { count: "exact", head: true }).not("submitted_at", "is", null);
      const cById = await cBase().eq("organization_id", orgId);
      if (cById.error) {
        const cName = await cBase().eq("organization_name", orgName); // pre-00187: name-only
        completed = cName.count ?? rows.length;
      } else {
        const cName = await cBase().is("organization_id", null).eq("organization_name", orgName);
        completed = (cById.count ?? 0) + (cName.count ?? 0);
      }
      // Redeemed or started but never submitted: the same ownership rule as the
      // list above (org_id primary, legacy NULL-org_id name match), newest first.
      const pCols = "id, candidate_name, started_at, expires_at, created_at";
      type PendRow = { id: string; candidate_name: string | null; started_at: string | null; expires_at: string | null; created_at: string };
      const pBase = () => sb.from("technical_sandbox_sessions").select(pCols).is("submitted_at", null).order("created_at", { ascending: false }).limit(100);
      const pById = await pBase().eq("organization_id", orgId);
      let pendList: PendRow[];
      if (pById.error) {
        const legacy = await pBase().eq("organization_name", orgName);
        pendList = (legacy.data ?? []) as PendRow[];
      } else {
        const pName = await pBase().is("organization_id", null).eq("organization_name", orgName);
        const seenP = new Set<string>();
        pendList = [...((pById.data ?? []) as PendRow[]), ...((pName.data ?? []) as PendRow[])]
          .filter((r) => (seenP.has(r.id) ? false : (seenP.add(r.id), true)))
          .sort((a, b) => b.created_at.localeCompare(a.created_at))
          .slice(0, 100);
      }
      const pending = pendList.map((r) => pendingRow(r.id, r.candidate_name, r.started_at, r.expires_at));
      return { issued, redeemed, completed, rows, pending };
    }
  } catch {
    // tolerant: a missing org column / unmigrated table just yields the empty funnel
  }
  return EMPTY;
}
