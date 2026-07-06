import { notFound } from "next/navigation";
import { Download } from "lucide-react";
import { findProposalByToken } from "@/lib/proposals/service";
import { formatMoney } from "@/lib/proposals/pricing";

export const dynamic = "force-dynamic";

export const metadata = { title: "Your VIFM Proposal" };

/**
 * Public, token-gated client view of an ISSUED proposal. No account: the
 * unguessable access_token + the issued-status gate protect it (auth is bypassed
 * in middleware). Drafts 404 so an in-progress proposal is never client-visible.
 */
export default async function ClientProposalPage({ params }: { params: { token: string } }) {
  const p = await findProposalByToken(params.token);
  if (!p || p.status === "draft") notFound();
  const money = (n: number) => formatMoney(n, p.currency);
  const discount = Math.round((p.subtotal - p.total) * 100) / 100;
  const validUntil = p.validUntil ? new Date(p.validUntil).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : null;

  return (
    <div className="min-h-screen bg-[#f5f7fa] py-10 px-4">
      <div className="mx-auto max-w-3xl">
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b-4 border-[#5391D5] bg-[#010131] px-8 py-7 text-white">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#93b8e6]">
              VIFM Caliber&reg; &middot; Talent Intelligence Proposal
            </p>
            <h1 className="mt-2 text-2xl font-semibold leading-tight">{p.title}</h1>
            <p className="mt-2 text-sm text-white/75">
              Prepared for {p.clientName}
              {validUntil ? ` · valid until ${validUntil}` : ""}
            </p>
          </div>

          <div className="px-8 py-7 space-y-6">
            {p.introNote && <p className="text-sm leading-relaxed text-[#111232]">{p.introNote}</p>}

            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-[#010131]">What&apos;s included</h2>
              <ul className="mt-2 space-y-1.5">
                {p.scope
                  .filter((s) => (s.seats ?? 0) > 0)
                  .map((s) => (
                    <li key={s.service} className="flex items-baseline justify-between gap-4 text-sm text-[#111232]">
                      <span>
                        {s.label}
                        {s.scopeNote ? <span className="text-slate-500"> &middot; {s.scopeNote}</span> : null}
                      </span>
                      <span className="shrink-0 tabular-nums text-slate-500">{s.seats} participant{s.seats === 1 ? "" : "s"}</span>
                    </li>
                  ))}
              </ul>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-4">
              <div className="flex items-baseline justify-between text-sm text-slate-600">
                <span>Subtotal</span>
                <span className="tabular-nums">{money(p.subtotal)}</span>
              </div>
              {discount > 0 && (
                <div className="mt-1 flex items-baseline justify-between text-sm text-slate-600">
                  <span>Discount ({p.discountPct}%)</span>
                  <span className="tabular-nums">- {money(discount)}</span>
                </div>
              )}
              <div className="mt-2 flex items-baseline justify-between border-t border-slate-300 pt-2 text-lg font-bold text-[#010131]">
                <span>Total ({p.currency})</span>
                <span className="tabular-nums">{money(p.total)}</span>
              </div>
            </div>

            <a
              href={`/api/proposals/${p.accessToken}/pdf`}
              className="inline-flex items-center gap-2 rounded-md bg-[#010131] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#121140]"
            >
              <Download className="h-4 w-4" /> Download the full proposal (PDF)
            </a>

            {p.paymentTerms && <p className="text-xs leading-relaxed text-slate-500">{p.paymentTerms}</p>}
          </div>
        </div>
        <p className="mt-4 text-center text-xs text-slate-400">
          Virginia Institute of Finance and Management &middot; Confidential
        </p>
      </div>
    </div>
  );
}
