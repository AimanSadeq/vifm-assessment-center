// Builds the full, self-contained HTML for a proposal PDF (rendered via
// renderHtmlToPdfBuffer). Caliber brand, A4 print CSS, EN. Sections: cover ->
// executive summary -> technical approach (per selected service) -> scope &
// deliverables -> commercials -> payment & terms. Pure string builder, no I/O.

import { formatMoney } from "./pricing";
import { proposalService } from "./constants";
import type { Proposal } from "./service";

function esc(s: string | null | undefined): string {
  return (s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function fmtDate(iso: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  } catch {
    return iso.slice(0, 10);
  }
}

export function buildProposalHtml(p: Proposal): string {
  const cur = p.currency || "USD";
  const money = (n: number) => formatMoney(n, cur);
  const discount = Math.round((p.subtotal - p.total) * 100) / 100;

  const scopeWithSeats = p.scope.filter((s) => (s.seats ?? 0) > 0);

  // Technical approach - one block per selected service.
  const technical = scopeWithSeats
    .map((s) => {
      const meta = proposalService(s.service);
      const blurb = meta?.blurb ?? "";
      const note = s.scopeNote ? `<p class="scope-note"><strong>Scope:</strong> ${esc(s.scopeNote)}</p>` : "";
      return `<div class="svc">
        <h3>${esc(s.label)} <span class="seats">${s.seats} participant${s.seats === 1 ? "" : "s"}</span></h3>
        <p>${esc(blurb)}</p>
        ${note}
      </div>`;
    })
    .join("\n");

  // Scope & deliverables table.
  const scopeRows = scopeWithSeats
    .map(
      (s) =>
        `<tr><td>${esc(s.label)}</td><td class="num">${s.seats}</td><td>${esc(
          s.scopeNote ?? "Full instrument",
        )}</td></tr>`,
    )
    .join("");

  // Commercials table.
  const lineRows = p.lineItems
    .map(
      (l) =>
        `<tr><td>${esc(l.label)}</td><td class="num">${l.seats}</td><td class="num">${money(
          l.unitRate,
        )}</td><td class="num">${money(l.subtotal)}</td></tr>`,
    )
    .join("");

  const discountRow =
    discount > 0
      ? `<tr><td colspan="3" class="tot-label">Discount (${p.discountPct}%)</td><td class="num">- ${money(
          discount,
        )}</td></tr>`
      : "";

  const validityLine = p.validUntil ? `This proposal is valid until <strong>${fmtDate(p.validUntil)}</strong>.` : "";

  const intro =
    p.introNote?.trim() ||
    `We are pleased to present this talent-intelligence proposal for ${esc(
      p.clientName,
    )}. It combines VIFM's assessment instruments into a single, defensible programme, with the technical approach and commercial detail set out below.`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<style>
  @page { size: A4; margin: 16mm 15mm 18mm; }
  * { box-sizing: border-box; }
  body { font-family: "Open Sans", Arial, Helvetica, sans-serif; color: #111232; font-size: 10.5pt; line-height: 1.5; margin: 0; }
  .cover { border-bottom: 3px solid #5391D5; padding-bottom: 14px; margin-bottom: 20px; }
  .eyebrow { color: #5391D5; font-size: 8.5pt; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; }
  h1 { color: #010131; font-size: 22pt; margin: 8px 0 6px; line-height: 1.1; }
  .meta { display: flex; flex-wrap: wrap; gap: 4px 28px; margin-top: 8px; color: #334155; font-size: 9.5pt; }
  .meta b { color: #010131; }
  h2 { color: #010131; font-size: 13.5pt; margin: 22px 0 8px; padding-top: 8px; border-top: 1px solid #e5e7eb; }
  h3 { color: #121140; font-size: 11.5pt; margin: 14px 0 3px; }
  h3 .seats { color: #5391D5; font-size: 9pt; font-weight: 600; }
  p { margin: 5px 0; }
  .scope-note { color: #475569; font-size: 9.5pt; }
  .svc { page-break-inside: avoid; margin-bottom: 8px; }
  table { width: 100%; border-collapse: collapse; margin: 10px 0 4px; font-size: 9.5pt; }
  th { text-align: left; background: #f1f5f9; color: #010131; font-weight: 700; padding: 7px 9px; border-bottom: 2px solid #cbd5e1; }
  td { padding: 6px 9px; border-bottom: 1px solid #e5e7eb; }
  td.num, th.num { text-align: right; white-space: nowrap; }
  .tot-label { text-align: right; color: #475569; }
  .total-row td { border-top: 2px solid #010131; font-weight: 800; color: #010131; font-size: 11pt; }
  .terms { background: #f8fafc; border-left: 3px solid #5391D5; border-radius: 0 6px 6px 0; padding: 10px 14px; margin-top: 8px; font-size: 9.5pt; color: #334155; }
  .footer { margin-top: 26px; padding-top: 10px; border-top: 1px solid #e5e7eb; color: #64748b; font-size: 8.5pt; }
  h2, h3 { page-break-after: avoid; }
  table, .svc, .terms { page-break-inside: avoid; }
</style>
</head>
<body>
  <div class="cover">
    <div class="eyebrow">VIFM Caliber&reg; &middot; Talent Intelligence Proposal</div>
    <h1>${esc(p.title)}</h1>
    <div class="meta">
      <div><b>Prepared for</b><br/>${esc(p.clientName)}${p.contactName ? `<br/>${esc(p.contactName)}` : ""}${
        p.contactEmail ? `<br/>${esc(p.contactEmail)}` : ""
      }</div>
      <div><b>Prepared by</b><br/>Virginia Institute of Finance<br/>and Management</div>
      <div><b>Date</b><br/>${fmtDate(p.createdAt)}</div>
      ${p.validUntil ? `<div><b>Valid until</b><br/>${fmtDate(p.validUntil)}</div>` : ""}
    </div>
  </div>

  <h2>Executive summary</h2>
  <p>${esc(intro)}</p>

  <h2>Technical approach</h2>
  ${technical || "<p>No services selected.</p>"}

  <h2>Scope &amp; deliverables</h2>
  <table>
    <thead><tr><th>Service</th><th class="num">Participants</th><th>Scope</th></tr></thead>
    <tbody>${scopeRows}</tbody>
  </table>
  <p class="scope-note">Each service produces its standard VIFM deliverables (individual reports and, where applicable, cohort analytics and verifiable credentials). Downloadable methodology briefs are available for every instrument on request.</p>

  <h2>Commercials</h2>
  <table>
    <thead><tr><th>Service</th><th class="num">Participants</th><th class="num">Rate / participant</th><th class="num">Subtotal</th></tr></thead>
    <tbody>
      ${lineRows}
      <tr><td colspan="3" class="tot-label">Subtotal</td><td class="num">${money(p.subtotal)}</td></tr>
      ${discountRow}
      <tr class="total-row"><td colspan="3" class="tot-label">Total (${esc(cur)})</td><td class="num">${money(p.total)}</td></tr>
    </tbody>
  </table>
  ${validityLine ? `<p class="scope-note">${validityLine}</p>` : ""}

  <h2>Payment &amp; terms</h2>
  ${p.paymentTerms ? `<p>${esc(p.paymentTerms)}</p>` : ""}
  <div class="terms">${esc(p.terms)}</div>

  <div class="footer">
    Virginia Institute of Finance and Management &middot; VIFM Caliber&reg; Talent Intelligence Platform &middot; Confidential
  </div>
</body>
</html>`;
}
