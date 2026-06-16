import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { getCurrentCaller } from "@/lib/ara/auth-guards";
import { loadPlatformClients } from "@/lib/clients/registry";
import { BackLink } from "@/components/shared/back-link";
import { VouchersClient, type PersonaVoucherRow } from "./_components/vouchers-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Persona vouchers · VIFM" };

export default async function PersonaVouchersPage() {
  const caller = await getCurrentCaller();
  if (!caller || caller.role !== "admin") return notFound();

  const sb = createServiceClient();
  const { data: vouchers } = await sb
    .from("persona_vouchers")
    .select("id, code, label, client_name, default_language, max_uses, used_count, status, expires_at, created_at")
    .order("created_at", { ascending: false })
    .returns<PersonaVoucherRow[]>();
  const clients = await loadPlatformClients();

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <BackLink href="/ac/persona" label="Persona" />
      <div className="mt-4 mb-6">
        <h1 className="text-2xl font-semibold text-[#010131]">Persona vouchers</h1>
        <p className="text-sm text-muted-foreground">
          Generate redeemable Persona self-assessment access codes, tag them to a client, and track seats.
          Delegates redeem at <code className="text-xs">/ac/persona/redeem</code> - no account needed.
        </p>
      </div>
      <VouchersClient vouchers={vouchers ?? []} clients={clients.map((c) => c.name)} />
    </div>
  );
}
