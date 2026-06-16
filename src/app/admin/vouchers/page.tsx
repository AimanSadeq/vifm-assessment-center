import { redirect } from "next/navigation";
import { requireRole, isAuthorizationError } from "@/lib/ara/auth-guards";
import { createServiceClient } from "@/lib/supabase/server";
import { BackLink } from "@/components/shared/back-link";
import { listFunctions } from "@/lib/technical-sandbox/service";
import { listVouchers } from "@/lib/technical-sandbox/vouchers";
import { VouchersClient as AraVouchersClient } from "@/app/ara/admin/vouchers/_components/vouchers-client";
import { VouchersClient as TechVouchersClient } from "@/app/admin/tech-sandbox/vouchers/_components/vouchers-client";
import { VoucherHub, type ServiceSummary } from "./_components/voucher-hub";

export const dynamic = "force-dynamic";
export const metadata = { title: "Vouchers" };

type CompanyRollup = {
  company: string;
  delegates: number;
  started: number;
  completed: number;
  lastRedeemed: string | null;
};

const summarize = (rows: { max: number; used: number }[]): ServiceSummary => {
  let codes = 0;
  let seats = 0;
  let redeemed = 0;
  for (const r of rows) {
    codes += 1;
    seats += Number(r.max) || 0;
    redeemed += Number(r.used) || 0;
  }
  return { codes, redeemed, outstanding: Math.max(0, seats - redeemed), available: true };
};

/**
 * Consolidated voucher hub - one admin home for every service that issues
 * redeem codes (ARC + Technical today). Reuses each service's existing manager
 * (table, actions, UI) as a tab; no schema change. Tolerant of a service's
 * tables being absent in an environment.
 */
export default async function VouchersHubPage({
  searchParams,
}: {
  searchParams?: { service?: string };
}) {
  const initialTab = searchParams?.service === "technical" ? "technical" : "arc";
  try {
    await requireRole(["admin"]);
  } catch (e) {
    if (isAuthorizationError(e)) redirect("/login");
    throw e;
  }
  const sb = createServiceClient();

  // ── ARC (AI Readiness Compass) ──
  let araSlot: React.ReactNode = null;
  let araSummary: ServiceSummary = { codes: 0, redeemed: 0, outstanding: 0, available: false };
  try {
    const [{ data: vouchers, error: vErr }, { data: orgs }, { data: redemptions }] = await Promise.all([
      sb
        .from("ara_vouchers")
        .select("id, code, label, client_name, tier, max_uses, used_count, status, expires_at, created_at")
        .order("created_at", { ascending: false })
        .limit(1000),
      sb.from("ara_organizations").select("id, name, region").order("name").limit(500),
      sb
        .from("ara_voucher_redemptions")
        .select("company_name, redeemed_at, respondent:ara_respondents(completed_at, first_opened_at)")
        .order("redeemed_at", { ascending: false })
        .limit(5000),
    ]);
    if (vErr) throw vErr;

    const byCompany = new Map<string, CompanyRollup>();
    for (const r of (redemptions ?? []) as Array<{
      company_name: string | null;
      redeemed_at: string;
      respondent: { completed_at: string | null; first_opened_at: string | null }[] | null;
    }>) {
      const key = (r.company_name ?? "-").trim() || "-";
      const resp = Array.isArray(r.respondent) ? r.respondent[0] : r.respondent;
      const row = byCompany.get(key) ?? { company: key, delegates: 0, started: 0, completed: 0, lastRedeemed: null };
      row.delegates += 1;
      if (resp?.first_opened_at) row.started += 1;
      if (resp?.completed_at) row.completed += 1;
      if (!row.lastRedeemed || r.redeemed_at > row.lastRedeemed) row.lastRedeemed = r.redeemed_at;
      byCompany.set(key, row);
    }
    const companies = Array.from(byCompany.values()).sort((a, b) => b.delegates - a.delegates);
    const vrows = vouchers ?? [];
    araSummary = summarize(vrows.map((v) => ({ max: v.max_uses as number, used: v.used_count as number })));
    araSlot = <AraVouchersClient vouchers={vrows} orgs={orgs ?? []} companies={companies} />;
  } catch {
    araSummary = { codes: 0, redeemed: 0, outstanding: 0, available: false };
  }

  // ── Technical Assessment ──
  let techSlot: React.ReactNode = null;
  let techSummary: ServiceSummary = { codes: 0, redeemed: 0, outstanding: 0, available: false };
  try {
    const [functions, vouchers] = await Promise.all([listFunctions(true), listVouchers()]);
    techSummary = summarize(vouchers.map((v) => ({ max: v.maxUses, used: v.usedCount })));
    techSlot =
      functions.length === 0 ? (
        <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          No active functions yet. Add functions in the Technical Assessment item bank before issuing vouchers.
        </p>
      ) : (
        <TechVouchersClient functions={functions} vouchers={vouchers} />
      );
  } catch {
    techSummary = { codes: 0, redeemed: 0, outstanding: 0, available: false };
  }

  return (
    <div className="space-y-6">
      <BackLink href="/admin" label="Back" history />
      <VoucherHub araSlot={araSlot} techSlot={techSlot} araSummary={araSummary} techSummary={techSummary} initialTab={initialTab} />
    </div>
  );
}
