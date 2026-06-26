import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { getCurrentCaller } from "@/lib/ara/auth-guards";
import { loadPlatformClients } from "@/lib/clients/registry";
import { BackLink } from "@/components/shared/back-link";
import { VoucherNav } from "@/components/shared/voucher-nav";
import { VouchersClient, type CognitiveVoucherRow } from "./_components/vouchers-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Logica® vouchers · VIFM" };

export default async function CognitiveVouchersPage() {
  const caller = await getCurrentCaller();
  if (!caller || caller.role !== "admin") return notFound();

  const sb = createServiceClient();
  const { data: vouchers } = await sb
    .from("cognitive_vouchers")
    .select("id, code, label, client_name, default_language, max_uses, used_count, status, expires_at, created_at")
    .order("created_at", { ascending: false })
    .returns<CognitiveVoucherRow[]>();
  const clients = await loadPlatformClients();

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <BackLink href="/ac/cognitive" label="Logica®" />
      <div className="mt-4 mb-6">
        <VoucherNav active="logica" />
      </div>
      <VouchersClient vouchers={vouchers ?? []} clients={clients.map((c) => c.name)} />
    </div>
  );
}
