import { createServiceClient } from "@/lib/supabase/server";
import { BackLink } from "@/components/shared/back-link";
import { VouchersClient } from "./_components/vouchers-client";

export const dynamic = "force-dynamic";

export const metadata = { title: "Vouchers · AI Readiness Compass" };

type VoucherRow = {
  id: string;
  code: string;
  label: string | null;
  client_name: string | null;
  tier: string;
  max_uses: number;
  used_count: number;
  status: string;
  expires_at: string | null;
  created_at: string;
};

type OrgOption = { id: string; name: string; region: string };

export type CompanyRollup = {
  company: string;
  delegates: number;
  started: number;
  completed: number;
  lastRedeemed: string | null;
};

type RedemptionRow = {
  company_name: string;
  redeemed_at: string;
  // PostgREST embeds the FK relation as an array.
  respondent: { completed_at: string | null; first_opened_at: string | null }[] | null;
};

export default async function VouchersAdminPage() {
  const sb = createServiceClient();
  const [{ data: vouchers }, { data: orgs }, { data: redemptions }] = await Promise.all([
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

  // Roll up redemptions by company for the insights table.
  const byCompany = new Map<string, CompanyRollup>();
  for (const r of (redemptions ?? []) as unknown as RedemptionRow[]) {
    const key = (r.company_name ?? "-").trim() || "-";
    const resp = Array.isArray(r.respondent) ? r.respondent[0] : r.respondent;
    const row =
      byCompany.get(key) ?? { company: key, delegates: 0, started: 0, completed: 0, lastRedeemed: null };
    row.delegates += 1;
    if (resp?.first_opened_at) row.started += 1;
    if (resp?.completed_at) row.completed += 1;
    if (!row.lastRedeemed || r.redeemed_at > row.lastRedeemed) row.lastRedeemed = r.redeemed_at;
    byCompany.set(key, row);
  }
  const companies = Array.from(byCompany.values()).sort((a, b) => b.delegates - a.delegates);

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-4">
        <BackLink href="/ara/admin" label="Back" history />
      </div>
      <VouchersClient
        vouchers={(vouchers ?? []) as VoucherRow[]}
        orgs={(orgs ?? []) as OrgOption[]}
        companies={companies}
      />
    </div>
  );
}
