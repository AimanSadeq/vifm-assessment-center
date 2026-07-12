import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { fetchAllPages } from "@/lib/ara/paginate";
import { getCurrentCaller } from "@/lib/ara/auth-guards";
import { loadPlatformClients } from "@/lib/clients/registry";
import { BackLink } from "@/components/shared/back-link";
import { VoucherNav } from "@/components/shared/voucher-nav";
import { VouchersClient, type FluentVoucherRow } from "./_components/vouchers-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Fluent® vouchers · VIFM" };

export default async function FluentVouchersPage() {
  // Admin-only surface (middleware guarantees a session; gate the role here too).
  const caller = await getCurrentCaller();
  if (!caller || caller.role !== "admin") return notFound();

  const sb = createServiceClient();
  // Paginate the voucher list (newest-first, id-tiebroken): an unpaginated read
  // caps at 1000, so a client issued > 1000 codes across batches would have older
  // vouchers become invisible + unmanageable (can't be found to disable).
  const vouchers = await fetchAllPages<FluentVoucherRow>((from, to) =>
    sb
      .from("eng_fluent_vouchers")
      .select("id, code, label, client_name, default_language, max_uses, used_count, status, expires_at, created_at, proctor_enabled")
      .order("created_at", { ascending: false })
      .order("id")
      .range(from, to) as unknown as PromiseLike<{ data: FluentVoucherRow[] | null; error: { message: string } | null }>,
  ).catch(() => [] as FluentVoucherRow[]);
  const clients = await loadPlatformClients();

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <BackLink href="/ac/fluent" label="Fluent®" />
      <div className="mt-4 mb-6">
        <VoucherNav active="fluent" />
      </div>
      <VouchersClient vouchers={vouchers} clients={clients.map((c) => c.name)} />
    </div>
  );
}
