import { notFound, redirect } from "next/navigation";
import { requireRole, isAuthorizationError } from "@/lib/ara/auth-guards";
import { BackLink } from "@/components/shared/back-link";
import { loadProposal } from "@/lib/proposals/service";
import { formatMoney } from "@/lib/proposals/pricing";
import { loadClientOptions, loadBundleOptions, loadRateMap } from "@/lib/proposals/options";
import { ProposalBuilder } from "../_components/proposal-builder";
import { ProposalActions } from "../_components/proposal-actions";

export const dynamic = "force-dynamic";

export default async function ProposalDetailPage({ params }: { params: { id: string } }) {
  try {
    await requireRole(["admin"]);
  } catch (e) {
    if (isAuthorizationError(e)) redirect("/login");
    throw e;
  }
  const proposal = await loadProposal(params.id);
  if (!proposal) notFound();
  const [clients, bundles, rates] = await Promise.all([loadClientOptions(), loadBundleOptions(), loadRateMap()]);

  const base = (process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "https://caliber.viftraining.com").replace(/\/$/, "");
  const clientUrl = `${base}/proposals/${proposal.accessToken}`;

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <BackLink href="/admin/proposals" label="Proposals" history />
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold text-[#010131]">{proposal.title}</h1>
          <p className="text-sm text-muted-foreground">
            {proposal.clientName} &middot; <span className="capitalize">{proposal.status}</span> &middot;{" "}
            <span className="font-semibold text-[#010131]">{formatMoney(proposal.total, proposal.currency)}</span>
          </p>
        </div>
      </header>

      <ProposalActions proposal={proposal} clientUrl={clientUrl} />

      <details className="rounded-lg border border-border bg-card">
        <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-foreground">Edit proposal</summary>
        <div className="border-t border-border p-4">
          <ProposalBuilder existing={proposal} clients={clients} bundles={bundles} rates={rates} />
        </div>
      </details>
    </div>
  );
}
