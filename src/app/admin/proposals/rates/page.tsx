import { redirect } from "next/navigation";
import { requireRole, isAuthorizationError } from "@/lib/ara/auth-guards";
import { BackLink } from "@/components/shared/back-link";
import { loadRates } from "@/lib/proposals/service";
import { PROPOSAL_SERVICES } from "@/lib/proposals/constants";
import { RatesEditor } from "../_components/rates-editor";

export const dynamic = "force-dynamic";

export default async function ProposalRatesPage() {
  try {
    await requireRole(["admin"]);
  } catch (e) {
    if (isAuthorizationError(e)) redirect("/login");
    throw e;
  }
  const rates = await loadRates();
  const byKey = new Map(rates.map((r) => [r.serviceKey, r]));
  const rows = PROPOSAL_SERVICES.map((s) => ({
    serviceKey: s.key,
    label: s.label,
    unitRate: byKey.get(s.key)?.unitRate ?? 0,
    currency: byKey.get(s.key)?.currency ?? "USD",
  }));

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <BackLink href="/admin/proposals" label="Proposals" history />
      <header>
        <h1 className="text-2xl font-semibold text-[#010131]">Proposal rate card</h1>
        <p className="text-sm text-muted-foreground">Set the per-participant rate for each service. Proposals derive their pricing from these.</p>
      </header>
      <RatesEditor rows={rows} />
    </div>
  );
}
