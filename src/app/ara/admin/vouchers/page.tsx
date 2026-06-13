import { createServiceClient } from "@/lib/supabase/server";
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

type OrgOption = { id: string; name: string };

export default async function VouchersAdminPage() {
  const sb = createServiceClient();
  const [{ data: vouchers }, { data: orgs }] = await Promise.all([
    sb
      .from("ara_vouchers")
      .select("id, code, label, client_name, tier, max_uses, used_count, status, expires_at, created_at")
      .order("created_at", { ascending: false })
      .limit(1000),
    sb.from("ara_organizations").select("id, name").order("name").limit(500),
  ]);

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <VouchersClient
        vouchers={(vouchers ?? []) as VoucherRow[]}
        orgs={(orgs ?? []) as OrgOption[]}
      />
    </div>
  );
}
