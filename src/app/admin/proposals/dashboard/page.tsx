import Link from "next/link";
import { redirect } from "next/navigation";
import { FileText, Plus, LayoutList, Send, FileEdit, Trophy, XCircle } from "lucide-react";
import { requireRole, isAuthorizationError } from "@/lib/ara/auth-guards";
import { BackLink } from "@/components/shared/back-link";
import { loadProposals, type Proposal, type ProposalStatus } from "@/lib/proposals/service";
import { formatMoney } from "@/lib/proposals/pricing";
import { computeLicensing, normalizeLicensingModel } from "@/lib/proposals/licensing";
import { PipelineDonut } from "../_components/pipeline-donut";

export const dynamic = "force-dynamic";

type StatusMeta = {
  key: ProposalStatus;
  label: string;
  color: string; // chart / accent colour
  cardBg: string;
  chip: string;
  icon: typeof Send;
};

// "Sent" is the friendly label for the `issued` status.
const STATUSES: StatusMeta[] = [
  { key: "draft", label: "Draft", color: "#94a3b8", cardBg: "border-t-slate-400", chip: "bg-slate-100 text-slate-600", icon: FileEdit },
  { key: "issued", label: "Sent", color: "#5391D5", cardBg: "border-t-[#5391D5]", chip: "bg-[#5391D5]/10 text-[#5391D5]", icon: Send },
  { key: "won", label: "Won", color: "#00843D", cardBg: "border-t-emerald-500", chip: "bg-emerald-50 text-emerald-700", icon: Trophy },
  { key: "lost", label: "Lost", color: "#C0392B", cardBg: "border-t-rose-500", chip: "bg-rose-50 text-rose-600", icon: XCircle },
];

const MODE_LABEL: Record<string, string> = { licence: "Licence", engagement: "Engagement", combined: "Combined", per_project: "Project" };

function dominantCurrency(proposals: Proposal[]): string {
  const counts = new Map<string, number>();
  for (const p of proposals) counts.set(p.currency, (counts.get(p.currency) ?? 0) + 1);
  let best = "USD";
  let bestN = 0;
  for (const [cur, n] of counts) if (n > bestN) ((best = cur), (bestN = n));
  return best;
}

export default async function ProposalsDashboardPage() {
  try {
    await requireRole(["admin"]);
  } catch (e) {
    if (isAuthorizationError(e)) redirect("/login");
    throw e;
  }
  const proposals = await loadProposals();
  const currency = dominantCurrency(proposals);
  const money = (n: number) => formatMoney(n, currency);

  const byStatus = (s: ProposalStatus) => proposals.filter((p) => p.status === s);
  const valueOf = (list: Proposal[]) => list.reduce((sum, p) => sum + (p.total || 0), 0);

  const groups = STATUSES.map((m) => {
    const list = byStatus(m.key);
    return { ...m, list, count: list.length, value: valueOf(list) };
  });

  // Headline metrics.
  const total = proposals.length;
  const openValue = valueOf([...byStatus("draft"), ...byStatus("issued")]);
  const wonValue = valueOf(byStatus("won"));
  const wonN = byStatus("won").length;
  const lostN = byStatus("lost").length;
  const decided = wonN + lostN;
  const winRate = decided > 0 ? Math.round((wonN / decided) * 100) : null;
  const arr = proposals
    .filter((p) => p.pricingMode === "licence" && (p.status === "issued" || p.status === "won"))
    .reduce((sum, p) => sum + (computeLicensing(normalizeLicensingModel(p.licensingModel))?.annualRecurring ?? 0), 0);

  const donutData = groups.map((g) => ({ name: g.label, value: g.count, color: g.color }));

  const metricCard = (label: string, value: string, sub?: string) => (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="text-2xl font-semibold tabular-nums text-[#010131]">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
      {sub && <div className="mt-0.5 text-[11px] text-muted-foreground/70">{sub}</div>}
    </div>
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <BackLink href="/admin/proposals" label="Proposals" history />
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="inline-flex items-center gap-2 text-2xl font-semibold text-[#010131]">
            <FileText className="h-6 w-6 text-[#5391D5]" /> Proposals dashboard
          </h1>
          <p className="text-sm text-muted-foreground">Your proposal pipeline at a glance - draft, sent, won and lost.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/proposals" className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm text-foreground hover:bg-muted">
            <LayoutList className="h-4 w-4" /> All proposals
          </Link>
          <Link href="/admin/proposals/new" className="inline-flex items-center gap-1.5 rounded-md bg-[#010131] px-3.5 py-2 text-sm font-semibold text-white hover:bg-[#121140]">
            <Plus className="h-4 w-4" /> New proposal
          </Link>
        </div>
      </header>

      {total === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          No proposals yet. <Link href="/admin/proposals/new" className="text-[#5391D5] underline">Create your first proposal</Link> to see the pipeline here.
        </div>
      ) : (
        <>
          {/* Headline metrics */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {metricCard("Total proposals", String(total))}
            {metricCard("Open pipeline (draft + sent)", money(openValue))}
            {metricCard("Won value", money(wonValue))}
            {metricCard("Win rate", winRate === null ? "-" : `${winRate}%`, decided > 0 ? `${wonN} won / ${lostN} lost` : "no decided proposals yet")}
          </div>

          {/* Status pipeline + donut */}
          <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
            <div className="grid gap-3 sm:grid-cols-2">
              {groups.map((g) => (
                <a
                  key={g.key}
                  href={`#status-${g.key}`}
                  className={`rounded-xl border border-t-4 border-border bg-card p-4 shadow-sm transition hover:shadow ${g.cardBg}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground">
                      <g.icon className="h-4 w-4" style={{ color: g.color }} /> {g.label}
                    </span>
                    <span className="text-2xl font-semibold tabular-nums text-[#010131]">{g.count}</span>
                  </div>
                  <div className="mt-1 text-sm tabular-nums text-muted-foreground">{money(g.value)}</div>
                </a>
              ))}
            </div>
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">By status</div>
              <PipelineDonut data={donutData} total={total} />
              {arr > 0 && (
                <div className="mt-2 border-t border-border pt-2 text-center text-xs text-muted-foreground">
                  <span className="font-semibold text-[#010131]">{money(arr)}</span> annual recurring (sent + won licences)
                </div>
              )}
            </div>
          </div>

          {/* Per-status lists */}
          <div className="space-y-5">
            {groups.map((g) => (
              <section key={g.key} id={`status-${g.key}`} className="scroll-mt-6">
                <div className="mb-2 flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${g.chip}`}>
                    <g.icon className="h-3.5 w-3.5" /> {g.label}
                  </span>
                  <span className="text-xs text-muted-foreground">{g.count} · {money(g.value)}</span>
                </div>
                {g.list.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-border px-4 py-4 text-xs text-muted-foreground">No {g.label.toLowerCase()} proposals.</p>
                ) : (
                  <div className="overflow-hidden rounded-lg border border-border">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <tr>
                          <th className="px-4 py-2">Proposal</th>
                          <th className="px-4 py-2">Client</th>
                          <th className="px-4 py-2 text-right">Total</th>
                          <th className="px-4 py-2">Type</th>
                          <th className="px-4 py-2">{g.key === "issued" ? "Sent" : "Created"}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {g.list.map((p) => (
                          <tr key={p.id} className="border-t border-border hover:bg-muted/30">
                            <td className="px-4 py-2">
                              <Link href={`/admin/proposals/${p.id}`} className="font-medium text-[#010131] hover:underline">{p.title}</Link>
                            </td>
                            <td className="px-4 py-2 text-muted-foreground">{p.clientName}</td>
                            <td className="px-4 py-2 text-right tabular-nums">{formatMoney(p.total, p.currency)}</td>
                            <td className="px-4 py-2 text-muted-foreground">{MODE_LABEL[p.pricingMode] ?? "Project"}</td>
                            <td className="px-4 py-2 text-muted-foreground">
                              {new Date((g.key === "issued" && p.sentAt) ? p.sentAt : p.createdAt).toLocaleDateString("en-GB")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
