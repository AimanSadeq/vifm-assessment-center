// Builds the full, self-contained HTML for a proposal PDF (rendered via
// renderHtmlToPdfBuffer). Caliber brand, A4 print CSS, EN. A complete business
// proposal: cover -> contents -> executive summary -> about VIFM ->
// understanding of requirements -> proposed solution (per service, with
// deliverables) -> methodology & standards -> implementation plan ->
// governance -> data protection -> commercials -> assumptions & exclusions ->
// terms & conditions -> acceptance page. Pure string builder, no I/O.

import { formatMoney } from "./pricing";
import { proposalService, PROPOSAL_DELIVERABLES } from "./constants";
import type { CaliberService } from "@/lib/clients/portal-services";
import type { Proposal } from "./service";

function esc(s: string | null | undefined): string {
  return (s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function fmtDate(iso: string | null): string {
  if (!iso) return "";
  try {
    // Pin to noon UTC so a date-only value ("2026-08-06") renders as the SAME
    // calendar day in every timezone - a raw new Date() parse drifts a day on
    // machines behind UTC, which is unacceptable on a legal validity date.
    const m = iso.match(/^(\d{4}-\d{2}-\d{2})/);
    const d = m ? new Date(`${m[1]}T12:00:00Z`) : new Date(iso);
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  } catch {
    return iso.slice(0, 10);
  }
}

/** Human reference number, stable per proposal (year + id prefix). */
export function proposalRef(p: Proposal): string {
  const year = (() => {
    try {
      return new Date(p.createdAt).getFullYear();
    } catch {
      return "";
    }
  })();
  return `VIFM-P-${year}-${p.id.replace(/-/g, "").slice(0, 6).toUpperCase()}`;
}

export function buildProposalHtml(
  p: Proposal,
  opts?: {
    /** Monochrome white VIFM logo (data URI) - dark cover, per the Brand Kit. */
    logoWhite?: string | null;
    /** Primary color VIFM logo (data URI) - light pages, per the Brand Kit. */
    logoColor?: string | null;
  },
): string {
  const logoWhite = opts?.logoWhite ?? null;
  const logoColor = opts?.logoColor ?? null;
  const cur = p.currency || "USD";
  const money = (n: number) => formatMoney(n, cur);
  const num = (n: number) => (n || 0).toLocaleString("en-US");
  const discount = Math.round((p.subtotal - p.total) * 100) / 100;
  const ref = proposalRef(p);

  const scopeWithSeats = p.scope.filter((s) => (s.seats ?? 0) > 0);
  const totalParticipants = scopeWithSeats.reduce((n, s) => n + (s.seats ?? 0), 0);
  const serviceLabels = scopeWithSeats.map((s) => s.label);
  const serviceList =
    serviceLabels.length <= 1
      ? serviceLabels.join("")
      : `${serviceLabels.slice(0, -1).join(", ")} and ${serviceLabels[serviceLabels.length - 1]}`;

  const jurisdiction =
    p.clientRegion === "saudi" ? "the Kingdom of Saudi Arabia" : "the United Arab Emirates";
  const sectorPhrase =
    p.clientSector === "government"
      ? "a government organization"
      : p.clientSector === "banking"
        ? "a banking and financial-services organization"
        : "an organization";

  // ── 4. Proposed solution - one block per selected service, with deliverables. ──
  const technical = scopeWithSeats
    .map((s) => {
      const meta = proposalService(s.service);
      const blurb = meta?.blurb ?? "";
      const note = s.scopeNote
        ? `<p class="scope-note"><strong>Scope for this engagement:</strong> ${esc(s.scopeNote)}</p>`
        : "";
      const deliverables = (PROPOSAL_DELIVERABLES[s.service as CaliberService] ?? [])
        .map((d) => `<li>${esc(d)}</li>`)
        .join("");
      return `<div class="svc">
        <h3>${esc(s.label)} <span class="seats">${num(s.seats)} participant${s.seats === 1 ? "" : "s"}</span></h3>
        <p>${esc(blurb)}</p>
        ${note}
        ${deliverables ? `<p class="deliv-head">Deliverables</p><ul class="deliv">${deliverables}</ul>` : ""}
      </div>`;
    })
    .join("\n");

  // ── 9. Commercials table. ──
  const lineRows = p.lineItems
    .map(
      (l) =>
        `<tr><td>${esc(l.label)}</td><td class="num">${num(l.seats)}</td><td class="num">${money(
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

  const intro =
    p.introNote?.trim() ||
    `We are pleased to present this talent-intelligence proposal for ${p.clientName}. It combines VIFM's assessment instruments into a single, defensible programme, with the technical approach, delivery plan and commercial detail set out in the sections that follow.`;

  const validUntil = p.validUntil ? fmtDate(p.validUntil) : null;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;600;700;800&display=swap" />
<style>
  @page { size: A4; margin: 16mm 15mm 20mm; }
  * { box-sizing: border-box; }
  body { font-family: "Open Sans", Arial, Helvetica, sans-serif; color: #111232; font-size: 10.5pt; line-height: 1.5; margin: 0; }

  /* Cover */
  .cover { background: #010131; color: #fff; border-radius: 10px; padding: 26mm 20mm; height: 250mm; display: flex; flex-direction: column; justify-content: space-between; page-break-after: always; }
  .cover .logo { height: 16mm; width: auto; display: block; margin-bottom: 16mm; }
  .cover .eyebrow { color: #93b8e6; font-size: 9pt; font-weight: 700; letter-spacing: .16em; text-transform: uppercase; }
  .cover h1 { color: #fff; font-size: 26pt; line-height: 1.15; margin: 10px 0 0; border: 0; padding: 0; }
  .cover .accent { width: 64px; height: 4px; background: #5391D5; margin-top: 16px; }
  .cover .grid { display: flex; flex-wrap: wrap; gap: 10px 40px; margin-top: 26px; font-size: 10pt; }
  .cover .grid b { display: block; color: #93b8e6; font-size: 8pt; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; margin-bottom: 2px; }
  .cover .conf { color: rgba(255,255,255,.65); font-size: 8.5pt; line-height: 1.55; border-top: 1px solid rgba(255,255,255,.18); padding-top: 12px; }

  /* Contents */
  .toc { page-break-after: always; }
  .toc-head { display: flex; align-items: center; justify-content: space-between; gap: 10mm; }
  .toc-head img { height: 10mm; width: auto; }
  .toc ol { margin: 10px 0 0; padding-left: 0; list-style: none; counter-reset: toc; column-count: 1; }
  .toc li { counter-increment: toc; padding: 6px 2px; border-bottom: 1px solid #eef2f7; font-size: 10.5pt; }
  .toc li::before { content: counter(toc) ".  "; color: #5391D5; font-weight: 700; }

  .eyebrow { color: #5391D5; font-size: 8.5pt; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; }
  h1 { color: #010131; font-size: 22pt; margin: 8px 0 6px; line-height: 1.1; }
  h2 { color: #010131; font-size: 13.5pt; margin: 22px 0 8px; padding-top: 8px; border-top: 1px solid #e5e7eb; }
  h2 .no { color: #5391D5; margin-right: 6px; }
  h3 { color: #121140; font-size: 11.5pt; margin: 14px 0 3px; }
  h3 .seats { color: #5391D5; font-size: 9pt; font-weight: 600; }
  p { margin: 5px 0; }
  ul { margin: 4px 0 8px; padding-left: 18px; }
  li { margin: 2px 0; }
  .scope-note { color: #475569; font-size: 9.5pt; }
  .svc { page-break-inside: avoid; margin-bottom: 12px; }
  .deliv-head { font-size: 9pt; font-weight: 700; color: #010131; text-transform: uppercase; letter-spacing: .08em; margin: 7px 0 2px; }
  ul.deliv { margin-top: 2px; }
  ul.deliv li { font-size: 9.5pt; color: #334155; }

  /* Key facts strip */
  .facts { display: flex; gap: 10px; margin: 12px 0 4px; }
  .fact { flex: 1; border: 1px solid #e2e8f0; border-top: 3px solid #5391D5; border-radius: 6px; padding: 8px 10px; }
  .fact b { display: block; color: #010131; font-size: 13pt; }
  .fact span { color: #64748b; font-size: 8.5pt; text-transform: uppercase; letter-spacing: .08em; }

  table { width: 100%; border-collapse: collapse; margin: 10px 0 4px; font-size: 9.5pt; }
  th { text-align: left; background: #f1f5f9; color: #010131; font-weight: 700; padding: 7px 9px; border-bottom: 2px solid #cbd5e1; }
  td { padding: 6px 9px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
  td.num, th.num { text-align: right; white-space: nowrap; }
  .tot-label { text-align: right; color: #475569; }
  .total-row td { border-top: 2px solid #010131; font-weight: 800; color: #010131; font-size: 11pt; }
  .terms-box { background: #f8fafc; border-left: 3px solid #5391D5; border-radius: 0 6px 6px 0; padding: 10px 14px; margin-top: 8px; font-size: 9.5pt; color: #334155; }

  /* Numbered legal clauses */
  ol.clauses { margin: 8px 0 0; padding-left: 0; list-style: none; counter-reset: cl; }
  ol.clauses > li { counter-increment: cl; margin: 0 0 8px; padding-left: 34px; position: relative; font-size: 9.5pt; color: #334155; page-break-inside: avoid; }
  ol.clauses > li::before { content: "11." counter(cl); position: absolute; left: 0; top: 0; color: #010131; font-weight: 700; }
  ol.clauses b { color: #010131; }

  /* Acceptance page */
  .accept { page-break-before: always; }
  .sig-grid { display: flex; gap: 18px; margin-top: 18px; }
  .sig { flex: 1; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 16px; }
  .sig h4 { margin: 0 0 10px; color: #010131; font-size: 10.5pt; text-transform: uppercase; letter-spacing: .08em; }
  .sig .line { border-bottom: 1px solid #94a3b8; height: 22px; margin-bottom: 4px; }
  .sig .lbl { color: #64748b; font-size: 8.5pt; margin-bottom: 12px; }

  h2, h3 { page-break-after: avoid; }
  table, .svc, .terms-box, .facts, .sig-grid { page-break-inside: avoid; }
</style>
</head>
<body>

  <!-- Cover -->
  <div class="cover">
    <div>
      ${logoWhite ? `<img class="logo" src="${logoWhite}" alt="VIFM" />` : ""}
      <div class="eyebrow">VIFM Caliber&reg; &middot; Talent Intelligence Proposal</div>
      <h1>${esc(p.title)}</h1>
      <div class="accent"></div>
      <div class="grid">
        <div><b>Prepared for</b>${esc(p.clientName)}${p.contactName ? `<br/>${esc(p.contactName)}` : ""}${
          p.contactEmail ? `<br/>${esc(p.contactEmail)}` : ""
        }</div>
        <div><b>Prepared by</b>Virginia Institute of Finance<br/>and Management</div>
        <div><b>Reference</b>${ref}</div>
        <div><b>Date</b>${fmtDate(p.createdAt)}</div>
        ${validUntil ? `<div><b>Valid until</b>${validUntil}</div>` : ""}
      </div>
    </div>
    <div class="conf">
      This document contains confidential and proprietary information of the Virginia Institute of Finance and
      Management (VIFM) and is prepared exclusively for ${esc(p.clientName)}. It may not be reproduced or
      disclosed to any third party, in whole or in part, without VIFM's prior written consent.
    </div>
  </div>

  <!-- Contents -->
  <div class="toc">
    <div class="toc-head">
      <div class="eyebrow">${ref}</div>
      ${logoColor ? `<img src="${logoColor}" alt="VIFM" />` : ""}
    </div>
    <h2 style="border-top:0;padding-top:0;">Contents</h2>
    <ol>
      <li>Executive summary</li>
      <li>About VIFM</li>
      <li>Understanding of your requirements</li>
      <li>Proposed solution &amp; technical approach</li>
      <li>Methodology &amp; quality standards</li>
      <li>Implementation plan</li>
      <li>Project governance &amp; team</li>
      <li>Data protection &amp; security</li>
      <li>Commercial proposal</li>
      <li>Assumptions &amp; exclusions</li>
      <li>Terms &amp; conditions</li>
      <li>Acceptance &amp; authorization</li>
    </ol>
  </div>

  <h2 style="border-top:0;padding-top:0;"><span class="no">1.</span>Executive summary</h2>
  <p>${esc(intro)}</p>
  <div class="facts">
    <div class="fact"><b>${scopeWithSeats.length}</b><span>Service${scopeWithSeats.length === 1 ? "" : "s"}</span></div>
    <div class="fact"><b>${num(totalParticipants)}</b><span>Participants</span></div>
    ${
      "" /* Currency already renders in the value (formatMoney) and in Section 9's
            "Total (USD)" row - repeating it here wrapped the label to two lines
            and broke the strip's alignment. */
    }
    <div class="fact"><b>${money(p.total)}</b><span>Total investment</span></div>
    ${validUntil ? `<div class="fact"><b>${validUntil}</b><span>Offer validity</span></div>` : ""}
  </div>

  <h2><span class="no">2.</span>About VIFM</h2>
  <p>The Virginia Institute of Finance and Management (VIFM) is a finance and management institute serving the
  GCC, combining professional training with a purpose-built talent-intelligence platform, VIFM Caliber&reg;.
  Caliber delivers structured, bilingual (English/Arabic) assessment across the full talent lifecycle - from
  pre-hire screening and technical certification to behavioural profiling, cognitive aptitude, English
  placement, 360&deg; leadership feedback and organizational AI-readiness.</p>
  <p>Every instrument is built on a documented methodology, delivered securely (server-held answer keys,
  per-administration randomisation), and produces defensible, review-ready outputs. Where AI contributes to
  scoring, it operates under documented human oversight; where credentials are issued, they are publicly
  verifiable. Published methodology briefs for each instrument are available on request and form part of this
  proposal by reference.</p>

  <h2><span class="no">3.</span>Understanding of your requirements</h2>
  <p>${esc(p.clientName)} is ${sectorPhrase}${
    p.clientRegion ? ` operating in ${jurisdiction}` : ""
  } seeking a structured, defensible view of the capability of ${num(totalParticipants)} participant${
    totalParticipants === 1 ? "" : "s"
  } through ${esc(serviceList)}. The programme is expected to produce individual-level reporting for
  development and decision support, together with cohort-level analytics for the sponsoring team.</p>
  <p>The solution set out below addresses these requirements with instruments that are bilingual where the
  audience requires it, auditable end to end, and aligned with the data-protection expectations that apply in
  ${jurisdiction}. Any refinement of scope agreed during kickoff will be captured in the statement of work.</p>

  <h2><span class="no">4.</span>Proposed solution &amp; technical approach</h2>
  ${technical || "<p>No services selected.</p>"}

  <h2><span class="no">5.</span>Methodology &amp; quality standards</h2>
  <ul>
    <li><b>Documented methodology per instrument</b> - each assessment ships with a published methodology brief covering construct, scoring model and honest limits; these briefs accompany this proposal on request.</li>
    <li><b>Alignment with recognised guidance</b> - programme design is aligned with ISO 10667 (assessment service delivery) and, for assessment-centre work, the International Taskforce Guidelines (6th edition).</li>
    <li><b>Secure administration</b> - answer keys are held server-side and never reach the participant's browser; grading is server-side; option order is re-randomised per administration; sessions are single-use.</li>
    <li><b>Human oversight of AI scoring</b> - where AI contributes to scoring or content generation, outputs are calibrated and a person retains review authority; no automated decision is final.</li>
    <li><b>Bilingual delivery</b> - participant-facing experiences are available in English and Arabic (full RTL) where scoped.</li>
    <li><b>Honest positioning</b> - indicative instruments are labelled indicative; certified outcomes are issued only where documented cut-scores are met, as publicly verifiable credentials.</li>
  </ul>

  <h2><span class="no">6.</span>Implementation plan</h2>
  <p class="scope-note">Indicative plan for a cohort of this size; the definitive schedule is agreed at kickoff and confirmed in the statement of work.</p>
  <table>
    <thead><tr><th>Phase</th><th>Indicative timing</th><th>Key activities</th><th>Outputs</th></tr></thead>
    <tbody>
      <tr><td><b>1 &middot; Mobilisation</b></td><td>Week 1</td><td>Kickoff, single point of contact confirmed, participant list received, scope and languages confirmed</td><td>Agreed schedule; communications pack</td></tr>
      <tr><td><b>2 &middot; Configuration</b></td><td>Week 2</td><td>Programme configured on Caliber, invitations prepared, pilot run with a small group</td><td>Validated setup; pilot sign-off</td></tr>
      <tr><td><b>3 &middot; Assessment window</b></td><td>Weeks 3-5</td><td>Invitations issued in waves, completion monitored, reminders managed, participant support</td><td>Completion dashboard; interim status reports</td></tr>
      <tr><td><b>4 &middot; Reporting &amp; debrief</b></td><td>Week 6</td><td>Individual reports released, cohort analytics compiled, sponsor debrief session</td><td>Full deliverable set; debrief and recommendations</td></tr>
    </tbody>
  </table>

  <h2><span class="no">7.</span>Project governance &amp; team</h2>
  <ul>
    <li><b>Engagement lead (VIFM)</b> - single accountable owner for delivery, commercials and escalation.</li>
    <li><b>Delivery coordinator (VIFM)</b> - manages invitations, completion monitoring and participant support throughout the assessment window.</li>
    <li><b>Assessment &amp; psychometrics oversight (VIFM)</b> - owns instrument integrity, scoring quality and the review of any flagged administrations.</li>
    <li><b>Client single point of contact</b> - ${esc(p.clientName)} nominates one coordinator to own the participant list, internal communications and scheduling decisions.</li>
    <li><b>Cadence</b> - weekly written status during the assessment window, with a standing escalation path to the engagement lead and a closing debrief at handover.</li>
  </ul>

  <h2><span class="no">8.</span>Data protection &amp; security</h2>
  <ul>
    <li>Assessment data is processed in line with applicable data-protection law: UAE Federal Decree-Law No. 45 of 2021, the Saudi Personal Data Protection Law, and the GDPR where relevant.</li>
    <li>Participant consent is captured before any assessment data is collected; participation records carry an audit trail.</li>
    <li>Data is encrypted in transit and at rest; access is role-based and limited to what each role requires; answer keys and scoring logic never reach the participant's device.</li>
    <li>Personal data is retained for a maximum of 24 months unless contractually extended, after which it is purged under VIFM's retention procedures; erasure requests are honoured within the engagement's legal constraints.</li>
    <li>Individual results are released only to the sponsoring organization's authorised recipients; anonymity thresholds protect multi-rater feedback contributors.</li>
  </ul>

  <h2><span class="no">9.</span>Commercial proposal</h2>
  <table>
    <thead><tr><th>Service</th><th class="num">Participants</th><th class="num">Rate / participant</th><th class="num">Subtotal</th></tr></thead>
    <tbody>
      ${lineRows}
      <tr><td colspan="3" class="tot-label">Subtotal</td><td class="num">${money(p.subtotal)}</td></tr>
      ${discountRow}
      <tr class="total-row"><td colspan="3" class="tot-label">Total (${esc(cur)})</td><td class="num">${money(p.total)}</td></tr>
    </tbody>
  </table>
  ${validUntil ? `<p class="scope-note">This proposal is valid until <strong>${validUntil}</strong>. Fees are quoted in ${esc(cur)} and are exclusive of any applicable taxes, which will be added at the prevailing rate where required.</p>` : `<p class="scope-note">Fees are quoted in ${esc(cur)} and are exclusive of any applicable taxes, which will be added at the prevailing rate where required.</p>`}
  ${p.paymentTerms ? `<h3>Payment terms</h3><p>${esc(p.paymentTerms)}</p>` : ""}
  <h3>Included in the fees</h3>
  <ul>
    <li>Platform delivery for the scoped participants, invitations and completion monitoring, participant support during the assessment window, the standard deliverable set per service, and one sponsor debrief session.</li>
  </ul>
  <h3>Not included</h3>
  <ul>
    <li>On-site delivery, travel and accommodation; instrument customisation beyond the stated scope; additional participants beyond the quoted volumes (chargeable at the quoted per-participant rate); and any third-party costs - each quotable separately on request.</li>
  </ul>

  <h2><span class="no">10.</span>Assumptions &amp; exclusions</h2>
  <ul>
    <li>${esc(p.clientName)} provides a complete, accurate participant list (names and email addresses) before the assessment window opens, and nominates a single point of contact empowered to make scheduling decisions.</li>
    <li>Participants have access to a suitable device and internet connection; assessments are completed remotely unless otherwise agreed in writing.</li>
    <li>Volumes are as quoted; material changes to volumes, scope or languages are handled by written change request and may revise fees and timeline.</li>
    <li>The indicative timeline assumes client-side communications are issued within the agreed windows; delays in participant mobilisation extend the schedule, not the price.</li>
    <li>This proposal does not constitute a contract; the engagement commences on signature of a statement of work referencing this proposal.</li>
  </ul>

  <h2><span class="no">11.</span>Terms &amp; conditions</h2>
  ${p.terms ? `<div class="terms-box">${esc(p.terms)}</div>` : ""}
  <ol class="clauses">
    <li><b>Confidentiality.</b> Each party will keep the other's confidential information confidential, use it only for this engagement, and disclose it only to personnel who need it and are bound by equivalent obligations. This clause survives the engagement.</li>
    <li><b>Intellectual property.</b> VIFM retains all rights in its instruments, item banks, frameworks, methodologies, software and report formats. ${esc(p.clientName)} receives a non-exclusive, non-transferable right to use the deliverables internally for the purposes of this engagement. Participant-level data remains subject to the data-protection terms herein.</li>
    <li><b>Data protection.</b> The parties will comply with applicable data-protection law as described in Section 8. VIFM acts as a processor of participant personal data on the client's documented instructions, save where law provides otherwise.</li>
    <li><b>Fees and payment.</b> Fees are as set out in Section 9 and are payable per the stated payment terms. Invoices are due within 30 days of issue unless otherwise agreed in the statement of work. Late amounts may bear a reasonable financing charge where permitted by law.</li>
    <li><b>Limitation of liability.</b> Neither party is liable for indirect or consequential loss. Each party's aggregate liability under this engagement is capped at the total fees paid or payable under it, save for liability that cannot be limited by law. Assessment outputs inform - and do not replace - the client's own decisions; VIFM is not liable for employment decisions made by the client.</li>
    <li><b>Term and termination.</b> Either party may terminate for convenience on 30 days' written notice, or immediately on the other's material, uncured breach. On termination, the client pays for work performed and deliverables completed to the termination date.</li>
    <li><b>Force majeure.</b> Neither party is liable for delay or failure caused by events beyond its reasonable control, provided it notifies the other promptly and mitigates the impact.</li>
    <li><b>Non-solicitation.</b> During the engagement and for six months after, neither party will actively solicit for employment the other's personnel directly engaged in the delivery of this programme.</li>
    <li><b>Governing law.</b> This proposal and any resulting engagement are governed by the laws of ${jurisdiction}, and the parties submit to the exclusive jurisdiction of its courts, unless the signed statement of work provides otherwise.</li>
    <li><b>Entire agreement and precedence.</b> The signed statement of work, together with this proposal, constitutes the entire agreement for the engagement. In case of conflict, the signed statement of work prevails over this proposal.</li>
  </ol>

  <div class="accept">
    <h2 style="border-top:0;padding-top:0;"><span class="no">12.</span>Acceptance &amp; authorization</h2>
    <p>Signature below confirms acceptance of this proposal (reference <b>${ref}</b>) and authorises VIFM to
    prepare the statement of work. The engagement commences on signature of the statement of work.</p>
    <div class="sig-grid">
      <div class="sig">
        <h4>For ${esc(p.clientName)}</h4>
        <div class="line"></div><div class="lbl">Name</div>
        <div class="line"></div><div class="lbl">Title</div>
        <div class="line"></div><div class="lbl">Signature</div>
        <div class="line"></div><div class="lbl">Date</div>
      </div>
      <div class="sig">
        <h4>For Virginia Institute of Finance and Management</h4>
        <div class="line"></div><div class="lbl">Name</div>
        <div class="line"></div><div class="lbl">Title</div>
        <div class="line"></div><div class="lbl">Signature</div>
        <div class="line"></div><div class="lbl">Date</div>
      </div>
    </div>
    <p class="scope-note" style="margin-top:14px;">Questions about this proposal: ${
      p.contactName ? `your VIFM engagement lead, or ` : ""
    }info@viftraining.com &middot; viftraining.com</p>
  </div>

</body>
</html>`;
}
