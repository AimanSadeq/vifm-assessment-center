import { notFound } from "next/navigation";
import { findProposalByToken, isProposalClientVisible, isProposalOfferExpired } from "@/lib/proposals/service";
import { formatMoney } from "@/lib/proposals/pricing";
import { PdfDownloadButton } from "@/components/shared/pdf-download-button";

export const dynamic = "force-dynamic";

export const metadata = { title: "Your VIFM Proposal" };

/**
 * Public, token-gated client view. No account: the unguessable access_token + a
 * client-facing-status allowlist protect it (auth is bypassed in middleware).
 * A draft (WIP) or a `lost` (withdrawn/superseded) proposal 404s; a past-validity
 * proposal renders a short "expired" notice with no pricing and no downloads.
 */
export default async function ClientProposalPage({ params }: { params: { token: string } }) {
  const p = await findProposalByToken(params.token);
  if (!p || !isProposalClientVisible(p)) notFound();
  // Only an outstanding `issued` offer expires; a `won` deal stays viewable (the
  // renewal flow re-points won clients here long after the original validity date).
  const expired = isProposalOfferExpired(p);
  const money = (n: number) => formatMoney(n, p.currency);
  // The generic Subtotal / "Discount (X%)" / Total box is only coherent for
  // per-project pricing. For licence/combined/engagement the stored subtotal is a
  // pre-discount a-la-carte figure and total folds in support/implementation/
  // sovereign/residency fees, so `subtotal - total` is NOT `discountPct%` of the
  // subtotal (and total can exceed subtotal) - showing that box mislabels the deal.
  const showItemisedTotals = p.pricingMode === "per_project";
  const discount = Math.round((p.subtotal - p.total) * 100) / 100;
  // Pin date-only values to noon UTC so the validity date never drifts a day
  // with the server's timezone (same rule as the PDF builder).
  const validUntil = p.validUntil
    ? new Date(`${p.validUntil.slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      })
    : null;

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

          {expired ? (
            <div className="px-8 py-10 text-center">
              <h2 className="text-lg font-semibold text-[#010131]">This proposal has expired</h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-500">
                The validity period for this proposal has passed{validUntil ? ` (${validUntil})` : ""}. Please contact your
                VIFM representative for an updated proposal.
              </p>
            </div>
          ) : (
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
                        <span className="shrink-0 tabular-nums text-slate-500">{(s.seats || 0).toLocaleString("en-US")} participant{s.seats === 1 ? "" : "s"}</span>
                      </li>
                    ))}
                </ul>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-4">
                {showItemisedTotals ? (
                  <>
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
                  </>
                ) : (
                  <>
                    <div className="flex items-baseline justify-between text-lg font-bold text-[#010131]">
                      <span>Total ({p.currency})</span>
                      <span className="tabular-nums">{money(p.total)}</span>
                    </div>
                    <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
                      The full pricing breakdown, including any committed-term savings and one-time fees, is in the PDF below.
                    </p>
                  </>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <PdfDownloadButton
                  url={`/api/proposals/${p.accessToken}/pdf`}
                  filename={`VIFM-Proposal-${p.clientName.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "Client"}.pdf`}
                  label="Download the full proposal (PDF)"
                  className="inline-flex items-center gap-2 rounded-md bg-[#010131] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#121140] disabled:opacity-60"
                />
                <PdfDownloadButton
                  url={`/api/proposals/${p.accessToken}/pdf?language=ar`}
                  filename={`VIFM-Proposal-${p.clientName.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "Client"}-AR.pdf`}
                  label="النسخة العربية (PDF)"
                  className="inline-flex items-center gap-2 rounded-md border border-[#010131] px-5 py-2.5 text-sm font-semibold text-[#010131] hover:bg-slate-50 disabled:opacity-60"
                />
                <PdfDownloadButton
                  url={`/api/proposals/${p.accessToken}/word`}
                  filename={`VIFM-Proposal-${p.clientName.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "Client"}.doc`}
                  label="Download as Word"
                  busyLabel="Preparing Word…"
                  className="inline-flex items-center gap-2 rounded-md border border-[#010131] px-5 py-2.5 text-sm font-semibold text-[#010131] hover:bg-slate-50 disabled:opacity-60"
                />
              </div>

              {p.paymentTerms && <p className="text-xs leading-relaxed text-slate-500">{p.paymentTerms}</p>}
            </div>
          )}
        </div>
        <p className="mt-4 text-center text-xs text-slate-400">
          Virginia Institute of Finance and Management &middot; Confidential
        </p>
      </div>
    </div>
  );
}
