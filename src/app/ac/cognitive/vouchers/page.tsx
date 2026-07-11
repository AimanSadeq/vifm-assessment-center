import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { fetchAllPages } from "@/lib/ara/paginate";
import { getCurrentCaller } from "@/lib/ara/auth-guards";
import { loadPlatformClients } from "@/lib/clients/registry";
import { BackLink } from "@/components/shared/back-link";
import { VoucherNav } from "@/components/shared/voucher-nav";
import { VouchersClient, type CognitiveVoucherRow } from "./_components/vouchers-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Logica® vouchers · VIFM" };

export default async function CognitiveVouchersPage({
  searchParams,
}: {
  searchParams?: { subtests?: string };
}) {
  const caller = await getCurrentCaller();
  if (!caller || caller.role !== "admin") return notFound();

  // Prefill from the runner's "Issue voucher for this selection" link.
  const initialSubtests = (searchParams?.subtests ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const sb = createServiceClient();
  // Paginate the voucher list (newest-first, id-tiebroken): an unpaginated read
  // caps at 1000, so a client issued > 1000 codes across batches would have older
  // vouchers become invisible + unmanageable (can't be found to disable).
  const vouchers = await fetchAllPages<CognitiveVoucherRow>((from, to) =>
    sb
      .from("cognitive_vouchers")
      .select("id, code, label, client_name, default_language, max_uses, used_count, status, expires_at, created_at")
      .order("created_at", { ascending: false })
      .order("id")
      .range(from, to) as unknown as PromiseLike<{ data: CognitiveVoucherRow[] | null; error: { message: string } | null }>,
  ).catch(() => [] as CognitiveVoucherRow[]);
  const clients = await loadPlatformClients();

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <BackLink href="/ac/cognitive" label="Logica®" />
      <div className="mt-4 mb-6">
        <VoucherNav active="logica" />
      </div>
      <VouchersClient vouchers={vouchers} clients={clients.map((c) => c.name)} initialSubtests={initialSubtests} />
    </div>
  );
}
