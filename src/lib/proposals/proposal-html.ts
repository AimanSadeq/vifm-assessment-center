// Builds the full, self-contained HTML for a proposal PDF (rendered via
// renderHtmlToPdfBuffer). Caliber brand, A4 print CSS, EN. A complete business
// proposal whose section architecture mirrors the VIFM Proposals Portal's
// Talent Intelligence template (proposals.viftraining.com): cover -> contents
// -> executive summary (names the offered services) -> about VIFM ->
// understanding of requirements -> proposed solution -> psychometric
// foundations -> methodology & standards -> platform, integration & security ->
// implementation plan -> governance -> data protection -> AI governance ->
// service level & support -> relevant experience -> commercials -> assumptions
// -> terms & conditions -> definitions -> acceptance & next steps.
// Pure string builder, no I/O.

import { formatMoney } from "./pricing";
import { proposalService, PROPOSAL_DELIVERABLES, resolveIncludedSections } from "./constants";
import { computeLicensing, normalizeLicensingModel } from "./licensing";
import { computeEngagement, normalizeEngagementModel, ENGAGEMENT_BASIS_LABEL, dataResidencyStatement, resolveDataResidency } from "./engagement";
import type { ProposalEvidence } from "./evidence-summary";
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
    /** Live reliability data for the Psychometric foundations + Evidence sections. */
    evidence?: ProposalEvidence | null;
  },
): string {
  const logoWhite = opts?.logoWhite ?? null;
  const logoColor = opts?.logoColor ?? null;
  const evidence = opts?.evidence ?? null;
  const cur = p.currency || "USD";
  const money = (n: number) => formatMoney(n, cur);
  const num = (n: number) => (n || 0).toLocaleString("en-US");
  const discount = Math.round((p.subtotal - p.total) * 100) / 100;
  const ref = proposalRef(p);

  // ── Section selection + numbering (Phase 2). Numbers/TOC derive from the
  // INCLUDED sections only, so removing an optional section renumbers cleanly.
  // Mandatory sections (the only cross-referenced ones) are always present. ──
  const included = resolveIncludedSections(p.sectionSelection);
  const includedSet = new Set(included);
  const inc = (title: string) => includedSet.has(title);
  const NO = (title: string) => {
    const i = included.indexOf(title);
    return i >= 0 ? i + 1 : 0;
  };
  const tcNo = NO("Terms & conditions");

  // ── Licence (SaaS) pricing mode. `lic` is null in per-project mode OR when the
  // licence model is empty, so every licence block gates on `isLicence && lic`. ──
  const isLicence = p.pricingMode === "licence";
  const lic = isLicence ? computeLicensing(normalizeLicensingModel(p.licensingModel)) : null;

  // ── Engagement (professional-services) pricing mode, e.g. Assessment Center. ──
  const isEngagement = p.pricingMode === "engagement";
  const eng = isEngagement ? computeEngagement(normalizeEngagementModel(p.engagementModel)) : null;

  // Data residency applies to every pricing mode (stored proposal-level in licenceData).
  const residency = resolveDataResidency((p.licenceData as Record<string, unknown> | null)?.dataResidency);

  const scopeWithSeats = p.scope.filter((s) => (s.seats ?? 0) > 0);
  const totalParticipants = scopeWithSeats.reduce((n, s) => n + (s.seats ?? 0), 0);
  const serviceLabels = scopeWithSeats.map((s) => s.label);
  const serviceList =
    serviceLabels.length <= 1
      ? serviceLabels.join("")
      : `${serviceLabels.slice(0, -1).join(", ")} and ${serviceLabels[serviceLabels.length - 1]}`;
  const singleService = scopeWithSeats.length === 1 ? scopeWithSeats[0].label : null;

  const jurisdiction =
    p.clientRegion === "saudi" ? "the Kingdom of Saudi Arabia" : "the United Arab Emirates";
  const sectorPhrase =
    p.clientSector === "government"
      ? "a government organization"
      : p.clientSector === "banking"
        ? "a banking and financial-services organization"
        : "an organization";

  // ── Proposed solution - one block per selected service, with deliverables. ──
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

  // ── Commercials table. ──
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

  // ── Licence commercial build-up (licence mode only). ──
  const licenceCommercial = lic
    ? `<table>
    <thead><tr><th>Service</th><th>Basis</th><th class="num">Annual volume</th><th class="num">Unit price</th><th class="num">Annual value</th></tr></thead>
    <tbody>
      ${lic.products
        .map(
          (pr) =>
            `<tr><td>${esc(pr.name)}</td><td>${esc(pr.basis)}</td><td class="num">${
              pr.isFixed ? "&mdash;" : num(pr.volume)
            }</td><td class="num">${pr.isFixed ? "&mdash;" : money(pr.unitPrice)}</td><td class="num">${money(
              pr.lineTotal,
            )}</td></tr>`,
        )
        .join("\n      ")}
      ${lic.bundles
        .map(
          (b) =>
            `<tr><td>${esc(b.name)}</td><td colspan="3">${esc(b.services)}</td><td class="num">${money(
              b.price,
            )}</td></tr>`,
        )
        .join("\n      ")}
      <tr><td colspan="4" class="tot-label">A-la-carte subtotal</td><td class="num">${money(lic.alaCarteTotal)}</td></tr>
    </tbody>
  </table>
  <table>
    <tbody>
      ${lic.hasBundleDiscount ? `<tr><td class="tot-label">Committed-licence discount (${num(lic.bundleDiscountPct)}%)</td><td class="num">- ${money(lic.discountAmount)}</td></tr>` : ""}
      <tr><td class="tot-label">Committed annual all-access licence</td><td class="num">${money(lic.annualLicence)}</td></tr>
      ${lic.hasSupport ? `<tr><td class="tot-label">Support &amp; SLA (${num(lic.supportPct)}%)</td><td class="num">${money(lic.supportAmount)}</td></tr>` : ""}
      ${lic.isSovereign && lic.sovereignAnnual > 0 ? `<tr><td class="tot-label">Sovereign annual (dedicated in-country)</td><td class="num">${money(lic.sovereignAnnual)}</td></tr>` : ""}
      <tr><td class="tot-label">Annual recurring</td><td class="num">${money(lic.annualRecurring)}</td></tr>
      ${lic.hasImplementationFee ? `<tr><td class="tot-label">Implementation &amp; onboarding (one-time)</td><td class="num">${money(lic.implementationFee)}</td></tr>` : ""}
      ${lic.isSovereign && lic.sovereignSetup > 0 ? `<tr><td class="tot-label">Sovereign setup (one-time)</td><td class="num">${money(lic.sovereignSetup)}</td></tr>` : ""}
      <tr class="total-row"><td class="tot-label">Year-1 investment (${esc(cur)})</td><td class="num">${money(lic.year1Subtotal)}</td></tr>
    </tbody>
  </table>
  <p class="scope-note"><strong>Deployment tier:</strong> ${lic.isSovereign ? "Sovereign &ndash; a dedicated in-country instance for data residency" : "Shared cloud"}.</p>
  ${lic.hasBuffer ? `<p class="scope-note">Committed annual volumes include a ${num(lic.bufferPct)}% usage buffer at no additional charge. Usage beyond the committed volume plus buffer is invoiced quarterly in arrears at the quoted unit prices.</p>` : ""}
  <h3>Multi-year view</h3>
  <table>
    <thead><tr><th>Period</th><th class="num">Amount</th></tr></thead>
    <tbody>
      <tr><td>Year 1 (investment)</td><td class="num">${money(lic.year1Subtotal)}</td></tr>
      <tr><td>Year 2${lic.upliftPct ? ` (recurring +${num(lic.upliftPct)}%)` : " (recurring)"}</td><td class="num">${money(lic.year2Recurring)}</td></tr>
      <tr><td>Year 3 (recurring)</td><td class="num">${money(lic.year3Recurring)}</td></tr>
      <tr class="total-row"><td>3-year total cost of ownership</td><td class="num">${money(lic.tco3)}</td></tr>
    </tbody>
  </table>
  ${
    lic.hasPilot && lic.pilot
      ? `<h3>Pilot option</h3>
  <div class="terms-box">A fixed-price pilot of ${num(lic.pilot.cohort)} participant${lic.pilot.cohort === 1 ? "" : "s"} over ${num(lic.pilot.durationWeeks)} week${lic.pilot.durationWeeks === 1 ? "" : "s"} at ${money(lic.pilot.price)}. On conversion to the annual licence within 90 days, ${num(lic.pilot.creditPct)}% of the pilot fee (${money(lic.pilot.creditAmount)}) is credited against Year 1. The pilot is an alternative entry path and is not included in the Year-1 total above.</div>`
      : ""
  }`
    : "";

  // ── Committed annual scope table (licence mode only), for Proposed solution. ──
  const committedScope = lic
    ? `<h3>Committed annual scope</h3>
  <table>
    <thead><tr><th>Service</th><th>Committed annual scope</th></tr></thead>
    <tbody>
      ${lic.products
        .map(
          (pr) =>
            `<tr><td>${esc(pr.name)}</td><td>${
              pr.isFixed ? "Included in the licence" : `Up to ${num(pr.volume)} ${esc(pr.basis)} per year`
            }</td></tr>`,
        )
        .join("\n      ")}
      ${lic.bundles.map((b) => `<tr><td>${esc(b.name)}</td><td>Included in the licence</td></tr>`).join("\n      ")}
    </tbody>
  </table>
  ${lic.hasBuffer ? `<p class="scope-note">Committed volumes include a ${num(lic.bufferPct)}% usage buffer at no additional charge; excess usage is invoiced quarterly in arrears at the quoted unit prices.</p>` : ""}`
    : "";

  // ── Engagement commercial (line-item quote) + solution description. ──
  const engagementCommercial = eng
    ? `<table>
    <thead><tr><th>Item</th><th>Basis</th><th class="num">Qty</th><th class="num">Unit rate</th><th class="num">Amount</th></tr></thead>
    <tbody>
      ${eng.lines
        .map(
          (l) =>
            `<tr><td>${esc(l.label)}</td><td>${esc(ENGAGEMENT_BASIS_LABEL[l.basis])}</td><td class="num">${l.basis === "fixed" ? "&mdash;" : num(l.quantity)}</td><td class="num">${money(l.unitRate)}</td><td class="num">${money(l.lineTotal)}</td></tr>`,
        )
        .join("\n      ")}
      <tr><td colspan="4" class="tot-label">Subtotal</td><td class="num">${money(eng.subtotal)}</td></tr>
      ${eng.hasDiscount ? `<tr><td colspan="4" class="tot-label">Discount (${num(eng.discountPct)}%)</td><td class="num">- ${money(eng.discountAmount)}</td></tr>` : ""}
      <tr class="total-row"><td colspan="4" class="tot-label">Total (${esc(cur)})</td><td class="num">${money(eng.total)}</td></tr>
    </tbody>
  </table>
  <p class="scope-note">This is a bespoke professional-services engagement priced on the scope above: fixed design and reporting fees, per-participant assessment, consultant-day assessor time, and per-delegate developmental feedback. Consultant days assume an assessor-to-delegate ratio appropriate to the exercise set; a change in cohort size or exercise design is handled by written change request.</p>`
    : "";

  const engagementSolution = eng
    ? `<div class="svc">
    <h3>${esc(eng.name)} <span class="seats">${num(eng.participants)} participant${eng.participants === 1 ? "" : "s"}</span></h3>
    <p>A full assessment-center engagement delivered and facilitated by VIFM consultants. Trained assessors observe each delegate across a set of role-relevant exercises (e.g. in-basket, role-play, group exercise, case study, oral presentation), classifying behaviour against the VIFM competency framework on a defined BARS scale.</p>
    <p class="deliv-head">How it runs</p>
    <ul class="deliv">
      <li><b>Design &amp; setup</b> - exercises, the exercise-to-competency matrix, role-player briefs and assessor calibration are configured to ${esc(p.clientName)}'s target role(s).</li>
      <li><b>Assessment days</b> - delegates complete the exercises under trained assessor observation; every competency is evidenced across at least two exercises.</li>
      <li><b>Wash-up &amp; integration</b> - assessors consolidate evidence in a structured wash-up to reach a defensible Overall Assessment Rating (OAR) with a Ready Now / Ready with Development / Not Ready recommendation per delegate.</li>
      <li><b>1:1 developmental feedback</b> - each delegate receives a dedicated feedback session with a consultant, translating the evidence into a personal development focus.</li>
      <li><b>Reporting</b> - an individual report per delegate plus a cohort integration and read-out for the sponsoring team.</li>
    </ul>
  </div>`
    : "";

  // The executive summary NAMES the offered service(s) - a proposal must say
  // what is being sold in its first breath, not just "assessment instruments".
  const intro =
    p.introNote?.trim() ||
    (isEngagement && eng
      ? `We are pleased to present this proposal for a ${esc(eng.name)} engagement for ${p.clientName}, assessing ${num(eng.participants)} participant${eng.participants === 1 ? "" : "s"}. This is a consultant-led programme - trained assessors, structured role-relevant exercises, a defensible overall assessment rating and 1:1 developmental feedback - supported by the VIFM Caliber® platform. The approach, delivery plan and commercial detail are set out below.`
      : isLicence
        ? `We are pleased to present this proposal for an annual, all-access licence to the VIFM Caliber® Talent Intelligence Platform for ${p.clientName}, combining ${serviceList || "VIFM's talent-intelligence services"} into one candidate journey, one admin console and combined bilingual reporting. The commercial model is a committed annual licence; the technical approach, delivery plan and full licence build-up are set out below.`
        : `We are pleased to present this proposal for the deployment of ${serviceList || "VIFM's talent-intelligence services"} for ${p.clientName}, covering ${num(totalParticipants)} participant${totalParticipants === 1 ? "" : "s"}. Delivered on the VIFM Caliber® Talent Intelligence Platform, the programme is set out below with its technical approach, delivery plan and commercial detail.`);

  const validUntil = p.validUntil ? fmtDate(p.validUntil) : null;

  // Cover subtitle names the commercial shape of the offer, per pricing mode.
  const coverSubtitle =
    isEngagement && eng
      ? `${esc(eng.name)} &middot; Consultant-led professional-services engagement`
      : isLicence
        ? "Annual all-access licence &middot; VIFM Caliber&reg; Talent Intelligence Platform"
        : "Talent-intelligence programme &middot; VIFM Caliber&reg;";

  // City, Country under the client name on the cover (either part optional).
  const clientLocation = [p.clientCity, p.clientCountry].filter((s) => s && s.trim()).join(", ");

  // ── Indicative-return (ROI) paragraph (Phase 2). Renders only when the
  // preparer supplied an average salary + hires/year (stored in licence_data.roi). ──
  const roiRaw = (p.licenceData && typeof p.licenceData === "object"
    ? (p.licenceData as Record<string, unknown>).roi
    : null) as { avgSalary?: number; hiresPerYear?: number; accuracyGainPct?: number } | null | undefined;
  const roiHtml = (() => {
    const avgSalary = Number(roiRaw?.avgSalary) || 0;
    const hires = Number(roiRaw?.hiresPerYear) || 0;
    if (avgSalary <= 0 || hires <= 0) return "";
    const gainPct = Number(roiRaw?.accuracyGainPct) > 0 ? Number(roiRaw?.accuracyGainPct) : 12;
    const misHire = 1.5 * avgSalary;
    const exposure = hires * misHire;
    const recovered = exposure * (gainPct / 100);
    const investment = p.total || 0;
    const timesOver = investment > 0 ? recovered / investment : 0;
    return `<p><strong>Indicative return.</strong> At an average annual salary of ${money(avgSalary)} and ${num(hires)} hire${hires === 1 ? "" : "s"} per year, the cost of a single mis-hire - conservatively 1.5&times; salary, about ${money(misHire)} - puts roughly ${money(exposure)} of value at risk each year. Improving selection accuracy by even ${gainPct}% recovers on the order of ${money(recovered)} annually${timesOver > 0 ? `, around ${timesOver.toFixed(1)}&times; the ${isLicence ? "Year-1" : "total"} investment in this programme` : ""}. These figures are illustrative, based on the inputs provided, and are not a guarantee of outcome.</p>`;
  })();

  // ── Live reliability snapshot for the Psychometric foundations + Evidence
  // sections (Phase 2). Each row renders only when a real, non-zero metric exists. ──
  const evRows: string[] = [];
  if (evidence) {
    if (evidence.logica && (evidence.logica.alpha || evidence.logica.approved)) {
      const a = evidence.logica.alpha;
      evRows.push(
        `<li><b>Cognitive reasoning (Logica&reg;)</b> - ${a != null ? `internal-consistency reliability (Cronbach's &alpha;) currently ${a.toFixed(2)} across ` : "currently "}${num(evidence.logica.approved)} vetted item${evidence.logica.approved === 1 ? "" : "s"} on the active bank${evidence.logica.tier ? ` (tier: ${esc(evidence.logica.tier)})` : ""}.</li>`,
      );
    }
    if (evidence.fluent && (evidence.fluent.calibrated || evidence.fluent.humanRatings)) {
      evRows.push(
        `<li><b>English placement (Fluent&reg;)</b> - ${num(evidence.fluent.calibrated)} calibrated item${evidence.fluent.calibrated === 1 ? "" : "s"} with ${num(evidence.fluent.humanRatings)} human rating${evidence.fluent.humanRatings === 1 ? "" : "s"} logged for AI-vs-human agreement monitoring (target QWK &ge; 0.70).</li>`,
      );
    }
    if (evidence.technical && (evidence.technical.approved || evidence.technical.cutScores)) {
      evRows.push(
        `<li><b>Technical certification (Techno&reg;)</b> - ${num(evidence.technical.approved)} SME-approved item${evidence.technical.approved === 1 ? "" : "s"} across ${num(evidence.technical.cutScores)} documented cut-score${evidence.technical.cutScores === 1 ? "" : "s"}${evidence.technical.calibrated ? `, ${num(evidence.technical.calibrated)} IRT-calibrated` : ""}.</li>`,
      );
    }
    if (evidence.arc && (evidence.arc.verified || evidence.arc.total)) {
      evRows.push(
        `<li><b>AI Readiness (AR COMPASS&reg;)</b> - ${num(evidence.arc.verified)} of ${num(evidence.arc.total)} questions human-reviewed${evidence.arc.responses ? `; ${num(evidence.arc.responses)} responses collected toward norm development` : ""}.</li>`,
      );
    }
    if (evidence.reflect && (evidence.reflect.competencies || evidence.reflect.responses)) {
      evRows.push(
        `<li><b>Leadership 360 (Reflect 360&reg;)</b> - ${num(evidence.reflect.competencies)} competenc${evidence.reflect.competencies === 1 ? "y" : "ies"} / ${num(evidence.reflect.behaviors)} behaviour${evidence.reflect.behaviors === 1 ? "" : "s"} in the seeded framework${evidence.reflect.responses ? `; ${num(evidence.reflect.responses)} rater responses to date` : ""}.</li>`,
      );
    }
  }
  const psyLive = evRows.length
    ? `<p class="scope-note" style="margin-top:8px;"><strong>Current platform evidence</strong> (live figures at the time of this proposal; they strengthen as response volumes grow):</p>
  <ul>
    ${evRows.join("\n    ")}
  </ul>`
    : "";

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

  /* Cover - premium: layered navy gradient + accent glow + faint V motif */
  .cover { position: relative; overflow: hidden; color: #fff; border-radius: 12px; padding: 24mm 22mm; height: 250mm;
    background:
      radial-gradient(115% 75% at 84% 6%, rgba(83,145,213,.30) 0%, rgba(83,145,213,0) 44%),
      linear-gradient(158deg, #0b0b30 0%, #010131 48%, #04051c 100%);
    display: flex; flex-direction: column; justify-content: space-between; page-break-after: always; }
  .cover .motif { position: absolute; right: -26mm; bottom: -30mm; width: 152mm; height: 152mm; opacity: .13; z-index: 0; }
  .cover .texture { position: absolute; inset: 0; z-index: 0; opacity: .55;
    background-image: radial-gradient(rgba(147,184,230,.11) 1px, transparent 1.2px);
    background-size: 22px 22px; -webkit-mask-image: linear-gradient(180deg, #000 0%, rgba(0,0,0,.35) 60%, transparent 100%); }
  .cover .layer { position: relative; z-index: 1; }
  .cover .topbar { display: flex; align-items: flex-start; justify-content: space-between; gap: 10mm; }
  .cover .logo { height: 15mm; width: auto; display: block; }
  .cover .meta-top { text-align: right; color: #93b8e6; font-size: 8pt; letter-spacing: .12em; text-transform: uppercase; line-height: 2; white-space: nowrap; }
  .cover .eyebrow { color: #9ec2ec; font-size: 9pt; font-weight: 700; letter-spacing: .22em; text-transform: uppercase; }
  .cover .title-wrap { position: relative; padding-left: 16px; margin-top: 30mm; }
  .cover .title-wrap::before { content: ""; position: absolute; left: 0; top: 4px; bottom: 10px; width: 3px; border-radius: 2px; background: linear-gradient(#5391D5, rgba(83,145,213,.15)); }
  h1 { color: #010131; font-size: 22pt; margin: 8px 0 6px; line-height: 1.1; }
  .cover h1 { color: #fff; font-size: 30pt; line-height: 1.12; margin: 8px 0 0; border: 0; padding: 0; font-weight: 800; letter-spacing: -.01em; }
  .cover .subtitle { color: #bcd3ef; font-size: 11.5pt; font-weight: 600; margin-top: 10px; }
  .cover .accent { width: 72px; height: 4px; background: #5391D5; border-radius: 2px; margin-top: 18px; }
  .cover .prepared { margin-top: 20px; }
  .cover .prepared b { display: block; color: #9ec2ec; font-size: 8pt; font-weight: 700; letter-spacing: .18em; text-transform: uppercase; margin-bottom: 4px; }
  .cover .prepared span { display: block; color: #fff; font-size: 16pt; font-weight: 800; letter-spacing: -.01em; line-height: 1.15; }
  .cover .prepared em { color: #bcd3ef; font-size: 10.5pt; font-weight: 600; font-style: normal; }
  .cover .prepared i { display: block; color: #9ec2ec; font-size: 9.5pt; font-weight: 600; font-style: normal; margin-top: 5px; letter-spacing: .01em; }
  .cover .creds { display: flex; flex-wrap: wrap; gap: 7px 16px; margin-top: 22px; color: #9ec2ec; font-size: 8pt; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; }
  .cover .creds span { position: relative; padding-left: 13px; }
  .cover .creds span::before { content: ""; position: absolute; left: 0; top: 50%; transform: translateY(-50%); width: 5px; height: 5px; border-radius: 50%; background: #5391D5; }
  .cover .panel { background: rgba(255,255,255,.05); border: 1px solid rgba(147,184,230,.22); border-top: 2px solid #5391D5; border-radius: 8px; padding: 15px 20px; }
  .cover .grid { display: flex; flex-wrap: wrap; gap: 12px 44px; font-size: 10pt; }
  .cover .grid b { display: block; color: #93b8e6; font-size: 7.5pt; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; margin-bottom: 3px; }
  .cover .conf { color: rgba(255,255,255,.6); font-size: 8pt; line-height: 1.6; margin-top: 14px; }

  /* Contents */
  .toc { page-break-after: always; }
  .toc-head { display: flex; align-items: center; justify-content: space-between; gap: 10mm; }
  .toc-head img { height: 10mm; width: auto; }
  .toc ol { margin: 10px 0 0; padding-left: 0; list-style: none; counter-reset: toc; column-count: 1; }
  .toc li { counter-increment: toc; padding: 5px 2px; border-bottom: 1px solid #eef2f7; font-size: 10.5pt; }
  .toc li::before { content: counter(toc) ".  "; color: #5391D5; font-weight: 700; }

  .eyebrow { color: #5391D5; font-size: 8.5pt; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; }
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

  /* Numbered legal clauses (prefix follows the T&C section number) */
  ol.clauses { margin: 8px 0 0; padding-left: 0; list-style: none; counter-reset: cl; }
  ol.clauses > li { counter-increment: cl; margin: 0 0 8px; padding-left: 38px; position: relative; font-size: 9.5pt; color: #334155; page-break-inside: avoid; }
  ol.clauses > li::before { content: "${tcNo}." counter(cl); position: absolute; left: 0; top: 0; color: #010131; font-weight: 700; }
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
    <div class="texture"></div>
    <svg class="motif" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M18 26 L100 178 L182 26" stroke="#5391D5" stroke-width="11" stroke-linejoin="round" stroke-linecap="round"/>
      <path d="M62 26 L100 96 L138 26" stroke="#9ec2ec" stroke-width="8" stroke-linejoin="round" stroke-linecap="round"/>
    </svg>
    <div class="layer">
      <div class="topbar">
        ${logoWhite ? `<img class="logo" src="${logoWhite}" alt="VIFM" />` : `<div class="eyebrow">VIFM Caliber&reg;</div>`}
        <div class="meta-top">${ref}<br/>${fmtDate(p.createdAt)}</div>
      </div>
      <div class="title-wrap">
        <div class="eyebrow">VIFM Caliber&reg; &middot; Talent Intelligence Proposal</div>
        <h1>${esc(p.title)}</h1>
        <div class="subtitle">${coverSubtitle}</div>
        <div class="accent"></div>
        <div class="prepared"><b>Prepared for</b><span>${esc(p.clientName)}${
          p.contactName ? ` <em>&middot; ${esc(p.contactName)}</em>` : ""
        }</span>${clientLocation ? `<i>${esc(clientLocation)}</i>` : ""}</div>
      </div>
      <div class="creds">
        <span>Bilingual EN / AR</span><span>Verifiable credentials</span><span>ISO 10667 aligned</span><span>GCC data residency</span>
      </div>
    </div>
    <div class="layer">
      <div class="panel">
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
  </div>

  <!-- Contents -->
  <div class="toc">
    <div class="toc-head">
      <div class="eyebrow">${ref}</div>
      ${logoColor ? `<img src="${logoColor}" alt="VIFM" />` : ""}
    </div>
    <h2 style="border-top:0;padding-top:0;">Contents</h2>
    <ol>
      ${included.map((s) => `<li>${esc(s)}</li>`).join("\n      ")}
    </ol>
  </div>

  <h2 style="border-top:0;padding-top:0;"><span class="no">${NO("Executive summary")}.</span>Executive summary</h2>
  <p>${esc(intro)}</p>
  <div class="facts">
    ${
      singleService
        ? `<div class="fact"><b>${esc(singleService)}</b><span>Service</span></div>`
        : `<div class="fact"><b>${scopeWithSeats.length}</b><span>Services</span></div>`
    }
    <div class="fact"><b>${isLicence && lic ? money(lic.annualRecurring) : num(totalParticipants)}</b><span>${isLicence && lic ? "Annual recurring" : "Participants"}</span></div>
    <div class="fact"><b>${isLicence && lic ? money(lic.year1Subtotal) : money(p.total)}</b><span>${isLicence && lic ? "Year-1 investment" : "Total investment"}</span></div>
    ${validUntil ? `<div class="fact"><b>${validUntil}</b><span>Offer validity</span></div>` : ""}
  </div>
  ${roiHtml}

  <h2><span class="no">${NO("About VIFM")}.</span>About VIFM</h2>
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

  <h2><span class="no">${NO("Understanding of your requirements")}.</span>Understanding of your requirements</h2>
  <p>${esc(p.clientName)} is ${sectorPhrase}${
    p.clientRegion ? ` operating in ${jurisdiction}` : ""
  } seeking a structured, defensible view of the capability of ${num(totalParticipants)} participant${
    totalParticipants === 1 ? "" : "s"
  } through ${esc(serviceList)}. The programme is expected to produce individual-level reporting for
  development and decision support, together with cohort-level analytics for the sponsoring team.</p>
  <p>The solution set out below addresses these requirements with instruments that are bilingual where the
  audience requires it, auditable end to end, and aligned with the data-protection expectations that apply in
  ${jurisdiction}. Any refinement of scope agreed during kickoff will be captured in the statement of work.</p>

  <h2><span class="no">${NO("Proposed solution & technical approach")}.</span>Proposed solution &amp; technical approach</h2>
  ${isEngagement ? engagementSolution : `${committedScope}${technical || "<p>No services selected.</p>"}`}
  <div class="svc"><h3>Data residency</h3><p>${dataResidencyStatement(residency)}</p></div>

  ${inc("Psychometric foundations") ? `<h2><span class="no">${NO("Psychometric foundations")}.</span>Psychometric foundations</h2>
  <p>The proposed instrument${scopeWithSeats.length === 1 ? " is" : "s are"} built on documented measurement
  foundations rather than ad-hoc question sets:</p>
  <ul>
    <li><b>A common competency spine</b> - behavioural measurement maps to the VIFM 41-competency framework (4 domains, 9 clusters), so results from different instruments describe people in one shared language.</li>
    <li><b>Recognised scales</b> - behavioural ratings use defined anchor scales; English placement is aligned to the CEFR (A1-C2); cognitive and technical results are reported as banded levels with their basis stated.</li>
    <li><b>Curated item banks</b> - items are drafted, SME-reviewed and versioned; option order is re-randomised per administration to protect item integrity.</li>
    <li><b>Response-quality safeguards</b> - where the construct warrants it, instruments carry distortion and consistency checks (e.g. social-desirability signals on self-report measures) that are surfaced to the reviewing consultant rather than silently auto-scored.</li>
    <li><b>Reliability monitoring</b> - internal-consistency statistics are tracked as response volumes grow, and norm-referenced reporting is enabled only when the underlying sample is adequate.</li>
    <li><b>Honest reporting tiers</b> - each result is explicitly labelled indicative or certified; certified outcomes exist only where a documented cut-score and review process stand behind them.</li>
  </ul>
  ${psyLive}` : ""}

  ${inc("Methodology & quality standards") ? `<h2><span class="no">${NO("Methodology & quality standards")}.</span>Methodology &amp; quality standards</h2>
  <ul>
    <li><b>Documented methodology per instrument</b> - each assessment ships with a published methodology brief covering construct, scoring model and honest limits; these briefs accompany this proposal on request.</li>
    <li><b>Alignment with recognised guidance</b> - programme design is aligned with ISO 10667 (assessment service delivery) and, for assessment-centre work, the International Taskforce Guidelines (6th edition).</li>
    <li><b>Secure administration</b> - answer keys are held server-side and never reach the participant's browser; grading is server-side; sessions are single-use.</li>
    <li><b>Human oversight of AI scoring</b> - where AI contributes to scoring or content generation, outputs are calibrated and a person retains review authority; no automated decision is final.</li>
    <li><b>Bilingual delivery</b> - participant-facing experiences are available in English and Arabic (full RTL) where scoped.</li>
  </ul>` : ""}

  ${inc("Platform, integration & security") ? `<h2><span class="no">${NO("Platform, integration & security")}.</span>Platform, integration &amp; security</h2>
  <ul>
    <li><b>Delivery platform</b> - the programme runs on VIFM Caliber&reg;, a cloud platform requiring no client-side installation; participants join through personal invitation links on any modern browser.</li>
    <li><b>Programme visibility</b> - the sponsoring team receives live completion monitoring during the assessment window, with reminders managed by VIFM.</li>
    <li><b>Verifiable outcomes</b> - certified credentials carry a public verification link, so any third party can confirm authenticity without contacting VIFM.</li>
    <li><b>Data portability</b> - results export in standard formats (CSV / JSON) for the client's HRIS or ATS; individual reports are delivered as PDF.</li>
    <li><b>Integration</b> - single sign-on or deeper system integration can be scoped in the statement of work where required.</li>
    <li><b>Security posture</b> - encryption in transit and at rest, role-based access with row-level controls, and scoring logic that never reaches the participant's device (see Section ${NO("Data protection & privacy")}).</li>
  </ul>` : ""}

  ${inc("Implementation plan") ? `<h2><span class="no">${NO("Implementation plan")}.</span>Implementation plan</h2>
  <p class="scope-note">Indicative plan for a cohort of this size; the definitive schedule is agreed at kickoff and confirmed in the statement of work.</p>
  <table>
    <thead><tr><th>Phase</th><th>Indicative timing</th><th>Key activities</th><th>Outputs</th></tr></thead>
    <tbody>
      <tr><td><b>1 &middot; Mobilisation</b></td><td>Week 1</td><td>Kickoff, single point of contact confirmed, participant list received, scope and languages confirmed</td><td>Agreed schedule; communications pack</td></tr>
      <tr><td><b>2 &middot; Configuration</b></td><td>Week 2</td><td>Programme configured on Caliber, invitations prepared, pilot run with a small group</td><td>Validated setup; pilot sign-off</td></tr>
      <tr><td><b>3 &middot; Assessment window</b></td><td>Weeks 3-5</td><td>Invitations issued in waves, completion monitored, reminders managed, participant support</td><td>Completion dashboard; interim status reports</td></tr>
      <tr><td><b>4 &middot; Reporting &amp; debrief</b></td><td>Week 6</td><td>Individual reports released, cohort analytics compiled, sponsor debrief session</td><td>Full deliverable set; debrief and recommendations</td></tr>
    </tbody>
  </table>` : ""}

  <h2><span class="no">${NO("Project governance & team")}.</span>Project governance &amp; team</h2>
  <ul>
    <li><b>Engagement lead (VIFM)</b> - single accountable owner for delivery, commercials and escalation.</li>
    <li><b>Delivery coordinator (VIFM)</b> - manages invitations, completion monitoring and participant support throughout the assessment window.</li>
    <li><b>Assessment &amp; psychometrics oversight (VIFM)</b> - owns instrument integrity, scoring quality and the review of any flagged administrations.</li>
    <li><b>Client single point of contact</b> - ${esc(p.clientName)} nominates one coordinator to own the participant list, internal communications and scheduling decisions.</li>
    <li><b>Cadence</b> - weekly written status during the assessment window, with a standing escalation path to the engagement lead and a closing debrief at handover.</li>
  </ul>

  <h2><span class="no">${NO("Data protection & privacy")}.</span>Data protection &amp; privacy</h2>
  <ul>
    <li>Assessment data is processed in line with applicable data-protection law: UAE Federal Decree-Law No. 45 of 2021, the Saudi Personal Data Protection Law, and the GDPR where relevant.</li>
    <li>Participant consent is captured before any assessment data is collected; participation records carry an audit trail.</li>
    <li>Data is encrypted in transit and at rest; access is role-based and limited to what each role requires; answer keys and scoring logic never reach the participant's device.</li>
    <li>Personal data is retained for a maximum of 24 months unless contractually extended, after which it is purged under VIFM's retention procedures; erasure requests are honoured within the engagement's legal constraints.</li>
    <li>Individual results are released only to the sponsoring organization's authorised recipients; anonymity thresholds protect multi-rater feedback contributors.</li>
  </ul>

  ${inc("AI governance & standards") ? `<h2><span class="no">${NO("AI governance & standards")}.</span>AI governance &amp; standards</h2>
  <ul>
    <li><b>Human-in-the-loop by design</b> - AI assists with item drafting, transcription and first-pass scoring; a qualified person retains review authority over any output that affects a participant, and no hiring or promotion decision is automated.</li>
    <li><b>Transparency</b> - each instrument's methodology brief states where AI contributes and where it does not, so the client can evidence its own governance obligations.</li>
    <li><b>Calibration</b> - AI-scored productive tasks (e.g. writing and speaking) are calibrated against human ratings, with agreement monitored over time.</li>
    <li><b>Never an auto-reject</b> - screening composites are advisory signals; the decision remains with the client's own reviewers, and the reports say so explicitly.</li>
    <li><b>Regional alignment</b> - the approach is designed to be defensible under emerging GCC AI-governance expectations${p.clientRegion === "saudi" ? ", including guidance applicable in the Kingdom of Saudi Arabia" : ""}.</li>
  </ul>` : ""}

  <h2><span class="no">${NO("Service level & support")}.</span>Service level &amp; support</h2>
  <ul>
    <li><b>Named team</b> - an engagement lead and a delivery coordinator are assigned for the duration of the programme (see Section ${NO("Project governance & team")}).</li>
    <li><b>Support window</b> - programme and participant support during GCC business hours (Sunday-Thursday), with initial response within one business day.</li>
    <li><b>Participant support</b> - access issues, invitation resends and completion queries are handled by VIFM directly, keeping the client's coordinator out of day-to-day traffic.</li>
    <li><b>Continuity</b> - the platform is operated to avoid participant-visible interruptions during the agreed assessment window; planned maintenance is scheduled around it.</li>
    ${isLicence ? "" : `<li><b>Formal SLA</b> - where the client requires committed availability and response metrics, they are documented in the statement of work.</li>`}
  </ul>
  ${
    isLicence
      ? `<p class="scope-note">The following service levels apply under the annual licence:</p>
  <ul>
    <li><b>Platform uptime</b> - 99.5% monthly uptime guarantee, excluding scheduled maintenance.</li>
    <li><b>Response times</b> - critical issues within 4 business hours; standard requests within 1 business day.</li>
    <li><b>Support hours</b> - 09:00-18:00 AST, Sunday-Thursday (full GCC coverage).</li>
    <li><b>Service credits</b> - a pro-rated service credit applies for any month below the uptime guarantee, as the exclusive remedy for availability.</li>
  </ul>`
      : ""
  }

  ${inc("Relevant experience") ? `<h2><span class="no">${NO("Relevant experience")}.</span>Relevant experience</h2>
  <p>VIFM delivers assessment and development programmes for banking, government and corporate organizations
  across the GCC. The Caliber platform carries seven instrument families spanning talent acquisition and
  talent development - behavioural profiling, cognitive aptitude, technical certification, English placement,
  pre-hire screening, 360&deg; leadership feedback and organizational AI-readiness - delivered bilingually as
  standard.</p>
  <p>Client references and anonymised case summaries relevant to this engagement are available on request,
  subject to the confidentiality commitments we make to every client - the same commitments this proposal
  makes to ${esc(p.clientName)}.</p>` : ""}

  <h2><span class="no">${NO("Commercial proposal")}.</span>Commercial proposal</h2>
  ${
    isEngagement && eng
      ? `<p>The commercial model is a bespoke <strong>professional-services engagement</strong>, priced by line item below - fixed design and reporting fees, per-participant assessment, consultant-day assessor time, and per-delegate developmental feedback.</p>
  ${engagementCommercial}`
      : isLicence && lic
        ? `<p>The commercial model is a committed <strong>annual all-access licence</strong> to the Caliber platform: the selected services are volume-priced a la carte, then bundled at a committed-licence discount. Support &amp; SLA is included as a percentage of the licence, and one-time implementation covers onboarding, configuration, integration and training.</p>
  ${licenceCommercial}`
        : `<table>
    <thead><tr><th>Service</th><th class="num">Participants</th><th class="num">Rate / participant</th><th class="num">Subtotal</th></tr></thead>
    <tbody>
      ${lineRows}
      <tr><td colspan="3" class="tot-label">Subtotal</td><td class="num">${money(p.subtotal)}</td></tr>
      ${discountRow}
      <tr class="total-row"><td colspan="3" class="tot-label">Total (${esc(cur)})</td><td class="num">${money(p.total)}</td></tr>
    </tbody>
  </table>`
  }
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

  ${inc("Assumptions & exclusions") ? `<h2><span class="no">${NO("Assumptions & exclusions")}.</span>Assumptions &amp; exclusions</h2>
  <ul>
    <li>${esc(p.clientName)} provides a complete, accurate participant list (names and email addresses) before the assessment window opens, and nominates a single point of contact empowered to make scheduling decisions.</li>
    <li>Participants have access to a suitable device and internet connection; assessments are completed remotely unless otherwise agreed in writing.</li>
    <li>Volumes are as quoted; material changes to volumes, scope or languages are handled by written change request and may revise fees and timeline.</li>
    <li>The indicative timeline assumes client-side communications are issued within the agreed windows; delays in participant mobilisation extend the schedule, not the price.</li>
    <li>This proposal does not constitute a contract; the engagement commences on signature of a statement of work referencing this proposal.</li>
  </ul>` : ""}

  <h2><span class="no">${tcNo}.</span>Terms &amp; conditions</h2>
  ${p.terms ? `<div class="terms-box">${esc(p.terms)}</div>` : ""}
  <ol class="clauses">
    <li><b>Confidentiality.</b> Each party will keep the other's confidential information confidential, use it only for this engagement, and disclose it only to personnel who need it and are bound by equivalent obligations. This clause survives the engagement.</li>
    <li><b>Intellectual property.</b> VIFM retains all rights in its instruments, item banks, frameworks, methodologies, software and report formats. ${esc(p.clientName)} receives a non-exclusive, non-transferable right to use the deliverables internally for the purposes of this engagement. Participant-level data remains subject to the data-protection terms herein.</li>
    <li><b>Data protection.</b> The parties will comply with applicable data-protection law as described in Section ${NO("Data protection & privacy")}. VIFM acts as a processor of participant personal data on the client's documented instructions, save where law provides otherwise.</li>
    <li><b>Fees and payment.</b> Fees are as set out in Section ${NO("Commercial proposal")} and are payable per the stated payment terms. Invoices are due within 30 days of issue unless otherwise agreed in the statement of work. Late amounts may bear a reasonable financing charge where permitted by law.</li>
    <li><b>Limitation of liability.</b> Neither party is liable for indirect or consequential loss. Each party's aggregate liability under this engagement is capped at the total fees paid or payable under it, save for liability that cannot be limited by law. Assessment outputs inform - and do not replace - the client's own decisions; VIFM is not liable for employment decisions made by the client.</li>
    <li><b>Term and termination.</b> Either party may terminate for convenience on 30 days' written notice, or immediately on the other's material, uncured breach. On termination, the client pays for work performed and deliverables completed to the termination date.</li>
    <li><b>Force majeure.</b> Neither party is liable for delay or failure caused by events beyond its reasonable control, provided it notifies the other promptly and mitigates the impact.</li>
    <li><b>Non-solicitation.</b> During the engagement and for six months after, neither party will actively solicit for employment the other's personnel directly engaged in the delivery of this programme.</li>
    <li><b>Governing law.</b> This proposal and any resulting engagement are governed by the laws of ${jurisdiction}, and the parties submit to the exclusive jurisdiction of its courts, unless the signed statement of work provides otherwise.</li>
    <li><b>Entire agreement and precedence.</b> The signed statement of work, together with this proposal, constitutes the entire agreement for the engagement. In case of conflict, the signed statement of work prevails over this proposal.</li>
    ${
      isLicence && lic
        ? `<li><b>Committed volumes and usage buffer.</b> The licence includes the committed annual volumes set out in Section ${NO("Commercial proposal")}, with a ${num(lic.bufferPct)}% usage buffer at no additional charge. Usage beyond the committed volume plus buffer is invoiced quarterly in arrears at the quoted unit prices; unused volume does not roll over unless agreed in writing.</li>
    <li><b>Renewal.</b> The licence term is 12 months, renewable, with 60 days' notice of non-renewal.${lic.upliftPct ? ` Where a multi-year term is agreed, the annual recurring charge is capped at a ${num(lic.upliftPct)}% uplift per year.` : ""}</li>
    <li><b>Exit and data export.</b> On termination or expiry, ${esc(p.clientName)} receives a full export of its data in standard formats within 15 business days, followed by certified deletion under VIFM's retention procedures.</li>
    <li><b>Service credits.</b> The service credits set out in Section ${NO("Service level & support")} are the client's exclusive remedy for any failure to meet the availability guarantee.</li>
    <li><b>Suspension.</b> VIFM may suspend access for undisputed amounts overdue by more than 30 days, on 10 business days' prior written notice.</li>`
        : ""
    }
  </ol>

  ${inc("Definitions") ? `<h2><span class="no">${NO("Definitions")}.</span>Definitions</h2>
  <table>
    <thead><tr><th style="width:34%">Term</th><th>Meaning in this proposal</th></tr></thead>
    <tbody>
      <tr><td><b>Participant</b></td><td>An individual invited by ${esc(p.clientName)} to complete one or more of the scoped assessments.</td></tr>
      <tr><td><b>Sitting</b></td><td>One completed administration of an instrument by one participant.</td></tr>
      <tr><td><b>Instrument</b></td><td>A named VIFM assessment service (e.g. ${esc(serviceLabels[0] ?? "Persona")}) with its own documented methodology.</td></tr>
      <tr><td><b>Indicative result</b></td><td>A development-grade output without a formal cut-score; labelled as such and not a credential.</td></tr>
      <tr><td><b>Certified credential</b></td><td>An outcome issued only where a documented cut-score is met; publicly verifiable by its verification link.</td></tr>
      <tr><td><b>Assessment window</b></td><td>The agreed period during which participants complete their sittings.</td></tr>
      <tr><td><b>Statement of work (SOW)</b></td><td>The signed document that puts this proposal into effect and governs the engagement.</td></tr>
      ${
        isLicence && lic
          ? `<tr><td><b>Committed Volume</b></td><td>The maximum annual usage of a service included in the licence, shown as "Up to N per year" in the scope and commercial tables.</td></tr>
      <tr><td><b>Usage Buffer</b></td><td>A further ${num(lic.bufferPct)}% of each committed volume, provided at no charge before excess usage applies.</td></tr>
      <tr><td><b>Excess Usage</b></td><td>Usage beyond the committed volume plus buffer, invoiced quarterly in arrears at the quoted unit prices.</td></tr>
      <tr><td><b>Annual Recurring</b></td><td>The committed annual licence plus support &amp; SLA (and any sovereign annual charge) - the recurring yearly fee, exclusive of one-time implementation.</td></tr>
      <tr><td><b>Sovereign Deployment</b></td><td>An optional dedicated in-country platform instance for data residency, adding a one-time setup fee and an annual charge.</td></tr>`
          : ""
      }
    </tbody>
  </table>` : ""}

  <div class="accept">
    <h2 style="border-top:0;padding-top:0;"><span class="no">${NO("Acceptance & next steps")}.</span>Acceptance &amp; next steps</h2>
    <ul>
      <li><b>1.</b> Confirm the scope and participant volumes in Section ${NO("Commercial proposal")} (or request adjustments - a revised proposal is issued the same way).</li>
      <li><b>2.</b> Sign the acceptance below${validUntil ? ` before the validity date (${validUntil})` : ""}.</li>
      <li><b>3.</b> VIFM issues the statement of work referencing <b>${ref}</b> for signature.</li>
      <li><b>4.</b> Kickoff is scheduled within five business days of the signed statement of work.</li>
    </ul>
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

  ${
    inc("Evidence & sample reports")
      ? `<div class="accept">
    <h2 style="border-top:0;padding-top:0;"><span class="no">${NO("Evidence & sample reports")}.</span>Evidence &amp; sample reports</h2>
    <p>Every instrument in this proposal is backed by a documented methodology brief and an auditable evidence
    trail. The figures below are a live snapshot of the platform's current measurement evidence; they are
    included so ${esc(p.clientName)} can evidence its own assurance and governance obligations. Anonymised
    sample candidate and cohort reports for each scoped service are available on request and can be appended to
    the signed statement of work.</p>
    ${
      evRows.length
        ? `<table>
      <thead><tr><th style="width:34%">Instrument</th><th>Current measurement evidence</th></tr></thead>
      <tbody>
        ${evRows.map((r) => r.replace(/^<li>/, "<tr><td colspan=\"2\">").replace(/<\/li>$/, "</td></tr>")).join("\n        ")}
      </tbody>
    </table>
    <p class="scope-note">Reliability and calibration statistics strengthen as response volumes grow; norm-referenced
    reporting is enabled only once a scale's sample is adequate. Where a metric is not yet shown, the instrument
    reports on its documented indicative basis.</p>`
        : `<p class="scope-note">Detailed reliability, calibration and validity evidence per instrument is available in the
    published methodology briefs, provided on request and forming part of this proposal by reference.</p>`
    }
  </div>`
      : ""
  }

</body>
</html>`;
}
