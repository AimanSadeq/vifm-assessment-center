import { redirect } from "next/navigation";
import { requireRole, isAuthorizationError } from "@/lib/ara/auth-guards";
import { BackLink } from "@/components/shared/back-link";
import { ProposalBuilder } from "../_components/proposal-builder";
import { loadClientOptions, loadBundleOptions, loadRateMap } from "@/lib/proposals/options";

export const dynamic = "force-dynamic";

export default async function NewProposalPage() {
  try {
    await requireRole(["admin"]);
  } catch (e) {
    if (isAuthorizationError(e)) redirect("/login");
    throw e;
  }
  const [clients, bundles, rates] = await Promise.all([loadClientOptions(), loadBundleOptions(), loadRateMap()]);

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <BackLink href="/admin/proposals" label="Proposals" history />
      <header>
        <h1 className="text-2xl font-semibold text-[#010131]">New proposal</h1>
        <p className="text-sm text-muted-foreground">
          Pick a client, optionally prefill from a bundle, set participants per service, and the commercials compute automatically.
        </p>
      </header>
      <ProposalBuilder clients={clients} bundles={bundles} rates={rates} />
    </div>
  );
}
