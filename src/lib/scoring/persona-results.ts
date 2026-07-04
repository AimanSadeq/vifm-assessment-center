// ─────────────────────────────────────────────────────────────
// Admin "completed Persona results" loader (server, service-role read).
//
// Lists submitted standalone Persona sittings (voucher / self-served, i.e.
// candidate_id IS NULL) with the data a recruiter needs for the hiring pilot:
// purpose, the target role, the computed FIT % + band (for hiring), the overall
// self-rating, and a link target for the report PDF. Reuses the same fit math
// as the report route (computeFit over the role competencies actually served).
// Tolerant of migrations 00110 / 00106 not being applied.
// ─────────────────────────────────────────────────────────────
import { createServiceClient } from "@/lib/supabase/server";
import { selfScoreByCompetency, overallSelfScore, type PersonaScoreRow } from "./behavioral";
import { computeFit, type FitBandKey } from "./persona-fit";
import { loadPersonaRoleOptions } from "./persona-roles";

export type PersonaResultRow = {
  id: string;
  takerName: string | null;
  orgName: string | null;
  purpose: "development" | "hiring";
  roleName: string | null;
  fitPct: number | null;
  fitBand: FitBandKey | null;
  overall: number | null;
  itemCount: number;
  submittedAt: string;
};

type SessionRow = {
  id: string;
  created_at: string;
  submitted_at: string | null;
  taker_name: string | null;
  purpose?: string | null;
  target_role_profile_id?: string | null;
  organization?: { name: string } | { name: string }[] | null;
};

function orgNameOf(r: SessionRow): string | null {
  const o = r.organization;
  if (!o) return null;
  return Array.isArray(o) ? o[0]?.name ?? null : o.name ?? null;
}

export type PersonaClientCount = { client: string; completed: number; inProgress: number };

/**
 * Completed + in-progress standalone Persona sittings grouped by client org, for
 * the discoverability panel on the vouchers page (so "I issued vouchers to X"
 * leads straight to "here are X's results"). Service-role read; tolerant of the
 * org table / columns being absent (returns []).
 */
export async function personaResultCountsByClient(): Promise<PersonaClientCount[]> {
  try {
    const sb = createServiceClient();
    const { data, error } = await sb
      .from("behavioral_assessment_sessions")
      .select("status, organization_id")
      .is("candidate_id", null)
      .in("status", ["submitted", "in_progress"])
      .not("organization_id", "is", null)
      .limit(3000);
    if (error || !data) return [];
    const rows = data as { status: string; organization_id: string | null }[];
    const orgIds = Array.from(new Set(rows.map((r) => r.organization_id).filter((x): x is string => !!x)));
    if (orgIds.length === 0) return [];
    const { data: orgs } = await sb.from("organizations").select("id, name").in("id", orgIds);
    const nameById = new Map((orgs ?? []).map((o: { id: string; name: string }) => [o.id, o.name]));
    const map = new Map<string, { completed: number; inProgress: number }>();
    for (const r of rows) {
      const name = r.organization_id ? nameById.get(r.organization_id) : null;
      if (!name) continue;
      if (!map.has(name)) map.set(name, { completed: 0, inProgress: 0 });
      const e = map.get(name)!;
      if (r.status === "submitted") e.completed += 1;
      else e.inProgress += 1;
    }
    return Array.from(map.entries())
      .map(([client, c]) => ({ client, ...c }))
      .sort((a, b) => b.completed - a.completed || a.client.localeCompare(b.client));
  } catch {
    return [];
  }
}

export type PersonaRedeemer = {
  name: string | null;
  email: string | null;
  redeemedAt: string;
  status: "completed" | "in_progress" | "not_started";
  resultId: string | null;
};
export type PersonaVoucherActivity = {
  code: string;
  clientName: string | null;
  contactName: string | null;
  contactEmail: string | null;
  createdAt: string;
  usedCount: number;
  maxUses: number;
  redeemers: PersonaRedeemer[];
};

/**
 * Per-voucher issuance + redemption activity for the Persona vouchers page: when
 * each voucher was issued, to which client (+ contact), and the named delegates
 * who redeemed it with their completion status + result link. Answers "when did
 * I issue these, to whom, and who actually did it". Tolerant of the contact
 * columns (migration 00168) being absent.
 */
export async function personaVoucherActivity(limit = 100): Promise<PersonaVoucherActivity[]> {
  try {
    const sb = createServiceClient();
    type VRow = {
      id: string; code: string; client_name: string | null;
      contact_name?: string | null; contact_email?: string | null;
      used_count: number | null; max_uses: number | null; created_at: string;
    };
    const r1 = await sb
      .from("persona_vouchers")
      .select("id, code, client_name, contact_name, contact_email, used_count, max_uses, created_at")
      .order("created_at", { ascending: false })
      .limit(limit);
    let rows = r1.data as unknown as VRow[] | null;
    if (r1.error) {
      const r2 = await sb
        .from("persona_vouchers")
        .select("id, code, client_name, used_count, max_uses, created_at")
        .order("created_at", { ascending: false })
        .limit(limit);
      rows = r2.data as unknown as VRow[] | null;
    }
    const vouchers = rows ?? [];
    if (vouchers.length === 0) return [];

    const vIds = vouchers.map((v) => v.id);
    const { data: redemptions } = await sb
      .from("persona_voucher_redemptions")
      .select("voucher_id, redeemer_name, redeemer_email, redeemed_at, result_id")
      .in("voucher_id", vIds)
      .order("redeemed_at", { ascending: true });

    const resultIds = (redemptions ?? [])
      .map((r) => r.result_id as string | null)
      .filter((x): x is string => !!x);
    const statusById = new Map<string, string>();
    if (resultIds.length) {
      const { data: sessions } = await sb
        .from("behavioral_assessment_sessions")
        .select("id, status")
        .in("id", resultIds);
      for (const s of sessions ?? []) statusById.set(s.id as string, s.status as string);
    }

    const byVoucher = new Map<string, PersonaRedeemer[]>();
    for (const r of redemptions ?? []) {
      const vid = r.voucher_id as string;
      if (!byVoucher.has(vid)) byVoucher.set(vid, []);
      const rid = (r.result_id as string | null) ?? null;
      const status: PersonaRedeemer["status"] = !rid
        ? "not_started"
        : statusById.get(rid) === "submitted"
          ? "completed"
          : "in_progress";
      byVoucher.get(vid)!.push({
        name: (r.redeemer_name as string | null) ?? null,
        email: (r.redeemer_email as string | null) ?? null,
        redeemedAt: r.redeemed_at as string,
        status,
        resultId: rid,
      });
    }

    return vouchers.map((v) => ({
      code: v.code,
      clientName: v.client_name ?? null,
      contactName: v.contact_name ?? null,
      contactEmail: v.contact_email ?? null,
      createdAt: v.created_at,
      usedCount: Number(v.used_count) || 0,
      maxUses: Number(v.max_uses) || 0,
      redeemers: byVoucher.get(v.id) ?? [],
    }));
  } catch {
    return [];
  }
}

export async function listPersonaResults(limit = 500): Promise<PersonaResultRow[] | null> {
  try {
    const sb = createServiceClient();
    const wide = "id, created_at, submitted_at, taker_name, purpose, target_role_profile_id";
    const basic = "id, created_at, submitted_at, taker_name";
    const run = (cols: string) =>
      sb
        .from("behavioral_assessment_sessions")
        .select(cols)
        .eq("status", "submitted")
        .is("candidate_id", null)
        .order("created_at", { ascending: false })
        .limit(limit);

    // Prefer the wide select + org join; degrade gracefully (00110 / 00106 absent).
    let res = (await run(`${wide}, organization:organizations(name)`)) as { data: SessionRow[] | null; error: unknown };
    if (res.error) res = (await run(wide)) as typeof res;
    if (res.error) res = (await run(`${basic}, organization:organizations(name)`)) as typeof res;
    if (res.error) res = (await run(basic)) as typeof res;
    if (res.error) return null;
    const sessions = res.data ?? [];
    if (sessions.length === 0) return [];

    const ids = sessions.map((s) => s.id);
    // Page through the responses: the API caps a single select at ~1000 rows, and
    // a busy bank can have thousands of Persona answers, so an unpaged fetch would
    // silently drop the responses for most sittings (they'd show "-" with no report
    // link). Range-paginate until a short page comes back.
    type RespRow = PersonaScoreRow & { session_id: string };
    const responses: RespRow[] = [];
    const PAGE = 1000;
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await sb
        .from("behavioral_assessment_responses")
        .select("session_id, competency_id, raw_score, is_reverse, item_type, answer_data")
        .in("session_id", ids)
        .range(from, from + PAGE - 1);
      if (error || !data || data.length === 0) break;
      responses.push(...(data as unknown as RespRow[]));
      if (data.length < PAGE) break;
    }

    // Group raw rows per session; the ipsative-aware helpers collapse forced-choice
    // rows correctly (instead of averaging raw 5/1/3 as Likert).
    const bySession = new Map<string, PersonaScoreRow[]>();
    for (const r of responses) {
      const sid = r.session_id;
      if (!bySession.has(sid)) bySession.set(sid, []);
      bySession.get(sid)!.push(r);
    }

    const roles = await loadPersonaRoleOptions();
    const roleById = new Map(roles.map((r) => [r.id, r]));

    return sessions.map((s): PersonaResultRow => {
      const rows = bySession.get(s.id) ?? [];
      const scoreById = selfScoreByCompetency(rows);
      const overall = overallSelfScore(rows);

      const purpose: "development" | "hiring" = s.purpose === "hiring" ? "hiring" : "development";
      // A role can be bound for BOTH purposes now (hiring fit + development plan);
      // the fit % doubles as "current alignment to target" for development rows.
      let roleName: string | null = null;
      let fitPct: number | null = null;
      let fitBand: FitBandKey | null = null;
      if (s.target_role_profile_id) {
        const role = roleById.get(s.target_role_profile_id);
        if (role) {
          roleName = role.name;
          // Fit over the role competencies actually served (mirrors the report route).
          const measured = role.comps.filter((c) => scoreById.has(c.competencyId));
          const f = computeFit(scoreById, measured);
          if (f) {
            fitPct = f.fitPct;
            fitBand = f.band;
          }
        }
      }

      return {
        id: s.id,
        takerName: s.taker_name,
        orgName: orgNameOf(s),
        purpose,
        roleName,
        fitPct,
        fitBand,
        overall,
        itemCount: rows.length,
        submittedAt: s.submitted_at ?? s.created_at,
      };
    });
  } catch {
    return null;
  }
}
