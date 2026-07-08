import Link from "next/link";
import { redirect } from "next/navigation";
import { FileText, Plus, SlidersHorizontal } from "lucide-react";
import { requireRole, isAuthorizationError } from "@/lib/ara/auth-guards";
import { BackLink } from "@/components/shared/back-link";
import { loadProposals } from "@/lib/proposals/service";
import { formatMoney } from "@/lib/proposals/pricing";
import { computeLicensing, normalizeLicensingModel } from "@/lib/proposals/licensing";

export const dynamic = "force-dynamic";

const STATUS_TONE: Record<string, string> = {
  draft: "bg-slate-100 text-slate-600",
  issued: "bg-[#5391D5]/10 text-[#5391D5]",
  won: "bg-emerald-50 text-emerald-700",
  lost: "bg-rose-50 text-rose-600",
};

export default async function ProposalsPage() {
  try {
    await requireRole(["admin"]);
  } catch (e) {
    if (isAuthorizationError(e)) redirect("/login");
    throw e;
  }
  const proposals = await loadProposals();

  // ARR = annual recurring across issued/won licence proposals (Phase 4 SaaS KPI).
  const licenceLive = proposals.filter((p) => p.pricingMode === "licence" && (p.status === "issued" || p.status === "won"));
  const arr = licenceLive.reduce((sum, p) => {
    const c = computeLicensing(normalizeLicensingModel(p.licensingModel));
    return sum + (c?.annualRecurring ?? 0);
  }, 0);
  const won = proposals.filter((p) => p.status === "won").length;
  const arrCurrency = licenceLive[0]?.currency ?? "USD";

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <BackLink href="/admin" label="Admin" history />
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="inline-flex items-center gap-2 text-2xl font-semibold text-[#010131]">
            <FileText className="h-6 w-6 text-[#5391D5]" /> Proposals
          </h1>
          <p className="text-sm text-muted-foreground">
            Assemble a technical + financial talent-intelligence proposal from your services, and send it to the client.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/proposals/rates" className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm text-foreground hover:bg-muted">
            <SlidersHorizontal className="h-4 w-4" /> Rate card
          </Link>
          <Link href="/admin/proposals/new" className="inline-flex items-center gap-1.5 rounded-md bg-[#010131] px-3.5 py-2 text-sm font-semibold text-white hover:bg-[#121140]">
            <Plus className="h-4 w-4" /> New proposal
          </Link>
        </div>
      </header>

      {proposals.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <div className="text-2xl font-semibold text-[#010131] tabular-nums">{formatMoney(arr, arrCurrency)}</div>
            <div className="text-xs text-muted-foreground">Annual recurring revenue (issued + won licences)</div>
          </div>
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <div className="text-2xl font-semibold text-[#010131] tabular-nums">{licenceLive.length}</div>
            <div className="text-xs text-muted-foreground">Active licence proposals</div>
          </div>
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <div className="text-2xl font-semibold text-[#010131] tabular-nums">{won}</div>
            <div className="text-xs text-muted-foreground">Won proposals</div>
          </div>
        </div>
      )}

      {proposals.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          No proposals yet. Start with <Link href="/admin/proposals/rates" className="text-[#5391D5] underline">the rate card</Link>, then create your first proposal.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5">Proposal</th>
                <th className="px-4 py-2.5">Client</th>
                <th className="px-4 py-2.5 text-right">Total</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">Created</th>
              </tr>
            </thead>
            <tbody>
              {proposals.map((p) => (
                <tr key={p.id} className="border-t border-border hover:bg-muted/30">
                  <td className="px-4 py-2.5">
                    <Link href={`/admin/proposals/${p.id}`} className="font-medium text-[#010131] hover:underline">{p.title}</Link>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{p.clientName}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{formatMoney(p.total, p.currency)}</td>
                  <td className="px-4 py-2.5">
                    <span className={`rounded-full px-2 py-0.5 text-xs capitalize ${STATUS_TONE[p.status] ?? ""}`}>{p.status}</span>
                    <span className="ml-1.5 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
                      {p.pricingMode === "licence" ? "Licence" : "Project"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{new Date(p.createdAt).toLocaleDateString("en-GB")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
