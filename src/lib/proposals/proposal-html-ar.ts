// Arabic (RTL) render of the proposal PDF - a full mirror of buildProposalHtml
// (proposal-html.ts) for `?language=ar`. Same structure, numbering, section
// selection, licence build-up and pricing modes; Arabic prose + RTL layout.
// Numbers/money/percentages are wrapped `dir="ltr"` so bidi keeps them readable
// inside the RTL flow. Arabic content is MSA, best-effort pending human review
// (project convention for Arabic translations).

import { formatMoney } from "./pricing";
import { computeLicensing, normalizeLicensingModel } from "./licensing";
import { computeEngagement, normalizeEngagementModel, resolveDataResidency, withEngagementResidency, type EngagementBasis, type DataResidency } from "./engagement";
import { resolveIncludedSections } from "./constants";
import { PORTAL_SERVICES, type CaliberService } from "@/lib/clients/portal-services";
import { sanitizeRichHtml, isRichHtml } from "./rich-text";
import type { ProposalEvidence } from "./evidence-summary";
import type { Proposal } from "./service";
import { proposalRef } from "./proposal-html";

// Same Noto Naskh Arabic webfont as the shared AR_FONT_HREF; inlined so this
// stays a pure string builder (no server-only import chain).
const AR_FONT_HREF = "https://fonts.googleapis.com/css2?family=Noto+Naskh+Arabic:wght@400;500;600;700&display=swap";

function esc(s: string | null | undefined): string {
  return (s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function fmtDateAr(iso: string | null): string {
  if (!iso) return "";
  try {
    const mm = iso.match(/^(\d{4}-\d{2}-\d{2})/);
    const d = mm ? new Date(`${mm[1]}T12:00:00Z`) : new Date(iso);
    return d.toLocaleDateString("ar-EG", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  } catch {
    return iso.slice(0, 10);
  }
}

/** Arabic section titles, keyed by the canonical EN title used everywhere else. */
const TITLE_AR: Record<string, string> = {
  "Executive summary": "الملخص التنفيذي",
  "About VIFM": "عن VIFM",
  "Understanding of your requirements": "فهم متطلباتكم",
  "Proposed solution & technical approach": "الحل المقترح والمنهجية الفنية",
  "Psychometric foundations": "الأسس القياسية النفسية",
  "Methodology & quality standards": "المنهجية ومعايير الجودة",
  "Platform, integration & security": "المنصة والتكامل والأمن",
  "Implementation plan": "خطة التنفيذ",
  "Project governance & team": "حوكمة المشروع والفريق",
  "Data protection & privacy": "حماية البيانات والخصوصية",
  "AI governance & standards": "حوكمة الذكاء الاصطناعي والمعايير",
  "Service level & support": "مستوى الخدمة والدعم",
  "Relevant experience": "الخبرات ذات الصلة",
  "Commercial proposal": "العرض التجاري",
  "Assumptions & exclusions": "الافتراضات والاستثناءات",
  "Terms & conditions": "الشروط والأحكام",
  "Definitions": "التعريفات",
  "Acceptance & next steps": "القبول والخطوات التالية",
  "Sample reports": "نماذج التقارير",
};

const BASIS_AR: Record<string, string> = {
  "per candidate": "لكل مرشح",
  "per employee": "لكل موظف",
  "per individual": "لكل فرد",
  "per leader": "لكل قائد",
  "per business unit": "لكل وحدة عمل",
};

function serviceLabelAr(key: string, fallback: string): string {
  return PORTAL_SERVICES.find((s) => s.id === (key as CaliberService))?.labelAr ?? fallback;
}

type ProposalRenderOptsAr = { logoWhite?: string | null; logoColor?: string | null; evidence?: ProposalEvidence | null };

/** Full Arabic (RTL) HTML string for the proposal PDF/Word. */
export function buildProposalHtmlAr(p: Proposal, opts?: ProposalRenderOptsAr): string {
  return renderProposalDocAr(p, opts).html;
}

/** Each section's DEFAULT (boilerplate) Arabic body HTML, keyed by ENGLISH section title
 *  (the same key the editor + overrides use). Powers the on-page editor's AR pre-fill. */
export function proposalSectionDefaultsAr(p: Proposal): Record<string, string> {
  return renderProposalDocAr(p).sectionDefaults;
}

function renderProposalDocAr(
  p: Proposal,
  opts?: ProposalRenderOptsAr,
): { html: string; sectionDefaults: Record<string, string> } {
  const logoWhite = opts?.logoWhite ?? null;
  const logoColor = opts?.logoColor ?? null;
  const cur = p.currency || "USD";
  // Money + integers wrapped LTR so digits/currency read correctly inside RTL.
  const m = (n: number) => `<span dir="ltr">${esc(formatMoney(n, cur))}</span>`;
  const nu = (n: number) => `<span dir="ltr">${esc((n || 0).toLocaleString("en-US"))}</span>`;
  const pc = (n: number) => `<span dir="ltr">${esc(String(n))}%</span>`;
  const ref = proposalRef(p);

  const included = resolveIncludedSections(p.sectionSelection);
  const includedSet = new Set(included);
  const inc = (title: string) => includedSet.has(title);
  const NO = (title: string) => {
    const i = included.indexOf(title);
    return i >= 0 ? `<span dir="ltr">${i + 1}</span>` : "";
  };
  const tcNoRaw = included.indexOf("Terms & conditions") + 1;
  const at = (title: string) => `<span class="no">${NO(title)}.</span>${esc(TITLE_AR[title] ?? title)}`;

  const isCombined = p.pricingMode === "combined";
  const combinedServicesMode = ((): "per_project" | "licence" | "none" => {
    const v = (p.licenceData as Record<string, unknown> | null)?.combinedServicesMode;
    return v === "licence" ? "licence" : v === "none" ? "none" : "per_project";
  })();
  const isLicence = p.pricingMode === "licence";
  const lic =
    isLicence || (isCombined && combinedServicesMode === "licence")
      ? computeLicensing(normalizeLicensingModel(p.licensingModel))
      : null;
  const isEngagement = p.pricingMode === "engagement";
  const residency = resolveDataResidency((p.licenceData as Record<string, unknown> | null)?.dataResidency);
  const drFee = Math.max(0, Number((p.licenceData as Record<string, unknown> | null)?.dataResidencyFee) || 0);
  const hasDrFee = drFee > 0;
  const DR_LABEL_AR: Record<DataResidency, string> = { ksa: "السعودية", uae: "الإمارات", vifm: "سحابة VIFM" };
  const drRowLabelAr = `سيادة البيانات - ${DR_LABEL_AR[residency]}`;
  const eng = isEngagement
    ? computeEngagement(normalizeEngagementModel(withEngagementResidency(p.engagementModel, drRowLabelAr, drFee)))
    : isCombined
      ? computeEngagement(normalizeEngagementModel(p.engagementModel))
      : null;
  // Combined services block: the per-seat lines + residency (engagement excluded).
  const combinedServiceLines =
    isCombined && combinedServicesMode === "per_project"
      ? p.lineItems.filter((l) => l.service !== "engagement")
      : [];
  const combinedServicesSubtotal = combinedServiceLines.reduce((s, l) => s + l.subtotal, 0);
  const BASIS_LABEL_AR: Record<EngagementBasis, string> = {
    fixed: "ثابت",
    per_participant: "لكل مشارك",
    per_day: "لكل يوم استشاري",
    per_session: "لكل جلسة تغذية راجعة",
  };
  const dataResidencyStatementAr = (r: DataResidency): string => {
    switch (r) {
      case "ksa":
        return "تُخزَّن جميع بيانات المرشحين والتقييم وتُعالَج داخل المملكة العربية السعودية، بما يلبي متطلبات سيادة البيانات داخل المملكة.";
      case "uae":
        return "تُخزَّن جميع بيانات المرشحين والتقييم وتُعالَج داخل دولة الإمارات العربية المتحدة، بما يلبي متطلبات سيادة البيانات داخل الدولة.";
      default:
        return "تُستضاف جميع بيانات المرشحين والتقييم على سحابة VIFM المُدارة، مع إتاحة سيادة البيانات داخل الدولة (السعودية أو الإمارات) عند الطلب.";
    }
  };

  const scopeWithSeats = p.scope.filter((s) => (s.seats ?? 0) > 0);
  const totalParticipants = scopeWithSeats.reduce((n, s) => n + (s.seats ?? 0), 0);
  const serviceLabelsAr = scopeWithSeats.map((s) => serviceLabelAr(s.service, s.label));
  const serviceListAr =
    serviceLabelsAr.length <= 1 ? serviceLabelsAr.join("") : `${serviceLabelsAr.slice(0, -1).join("، ")} و${serviceLabelsAr[serviceLabelsAr.length - 1]}`;

  // Combined mode: the per-service Proposed-solution loop skips the synthetic
  // "engagement" scope row (it has its own solution block).
  const serviceScopeRows = isCombined ? scopeWithSeats.filter((s) => s.service !== "engagement") : scopeWithSeats;
  const combinedSvcLabelsAr =
    combinedServicesMode === "licence" && lic
      ? lic.products.map((pr) => serviceLabelAr(pr.key, pr.name))
      : serviceScopeRows.map((s) => serviceLabelAr(s.service, s.label));
  const combinedSvcListAr =
    combinedSvcLabelsAr.length <= 1
      ? combinedSvcLabelsAr.join("")
      : `${combinedSvcLabelsAr.slice(0, -1).join("، ")} و${combinedSvcLabelsAr[combinedSvcLabelsAr.length - 1]}`;

  const jurisdiction = p.clientRegion === "saudi" ? "المملكة العربية السعودية" : "دولة الإمارات العربية المتحدة";
  const sectorPhrase =
    p.clientSector === "government" ? "جهة حكومية" : p.clientSector === "banking" ? "مؤسسة مصرفية ومالية" : "مؤسسة";

  // ── Proposed solution: per-service block. ──
  const technical = serviceScopeRows
    .map((s) => {
      const label = serviceLabelAr(s.service, s.label);
      const note = s.scopeNote ? `<p class="scope-note"><strong>نطاق هذه الخدمة:</strong> ${esc(s.scopeNote)}</p>` : "";
      return `<div class="svc">
        <h3>${esc(label)} <span class="seats">${nu(s.seats)} مشارك</span></h3>
        <p>خدمة تقييم من VIFM Caliber&reg; تُدار بشكل آمن بمنهجية موثقة، وتنتج مخرجات قابلة للمراجعة والدفاع عنها، ثنائية اللغة عند الحاجة.</p>
        ${note}
      </div>`;
    })
    .join("\n");

  // ── Licence commercial build-up (Arabic). ──
  const licenceCommercial = lic
    ? `<table>
    <thead><tr><th>الخدمة</th><th>الأساس</th><th class="num">الحجم السنوي</th><th class="num">سعر الوحدة</th><th class="num">القيمة السنوية</th></tr></thead>
    <tbody>
      ${lic.products
        .map(
          (pr) =>
            `<tr><td>${esc(serviceLabelAr(pr.key, pr.name))}</td><td>${esc(BASIS_AR[pr.basis] ?? pr.basis)}</td><td class="num">${pr.isFixed ? "&mdash;" : nu(pr.volume)}</td><td class="num">${pr.isFixed ? "&mdash;" : m(pr.unitPrice)}</td><td class="num">${m(pr.lineTotal)}</td></tr>`,
        )
        .join("\n      ")}
      <tr><td colspan="4" class="tot-label">الإجمالي الإفرادي</td><td class="num">${m(lic.alaCarteTotal)}</td></tr>
    </tbody>
  </table>
  <table>
    <tbody>
      ${lic.hasBundleDiscount ? `<tr><td class="tot-label">خصم الترخيص الملتزم (${pc(lic.bundleDiscountPct)})</td><td class="num">- ${m(lic.discountAmount)}</td></tr>` : ""}
      <tr><td class="tot-label">الترخيص السنوي الشامل الملتزم</td><td class="num">${m(lic.annualLicence)}</td></tr>
      ${lic.hasSupport ? `<tr><td class="tot-label">الدعم واتفاقية مستوى الخدمة (${pc(lic.supportPct)})</td><td class="num">${m(lic.supportAmount)}</td></tr>` : ""}
      ${lic.isSovereign && lic.sovereignAnnual > 0 ? `<tr><td class="tot-label">الاستضافة السيادية السنوية (داخل الدولة)</td><td class="num">${m(lic.sovereignAnnual)}</td></tr>` : ""}
      <tr><td class="tot-label">التكلفة المتكررة السنوية</td><td class="num">${m(lic.annualRecurring)}</td></tr>
      ${lic.hasImplementationFee ? `<tr><td class="tot-label">التنفيذ والإعداد (لمرة واحدة)</td><td class="num">${m(lic.implementationFee)}</td></tr>` : ""}
      ${lic.isSovereign && lic.sovereignSetup > 0 ? `<tr><td class="tot-label">إعداد الاستضافة السيادية (لمرة واحدة)</td><td class="num">${m(lic.sovereignSetup)}</td></tr>` : ""}
      ${hasDrFee ? `<tr><td class="tot-label">${drRowLabelAr} (لمرة واحدة)</td><td class="num">${m(drFee)}</td></tr>` : ""}
      <tr class="total-row"><td class="tot-label">استثمار السنة الأولى (${esc(cur)})</td><td class="num">${m(lic.year1Subtotal + drFee)}</td></tr>
    </tbody>
  </table>
  <p class="scope-note"><strong>نمط النشر:</strong> ${lic.isSovereign ? "سيادي &ndash; نسخة مخصصة داخل الدولة لضمان مقر البيانات" : "سحابة مشتركة"}.</p>
  ${lic.hasBuffer ? `<p class="scope-note">تشمل الأحجام السنوية الملتزمة هامش استخدام بنسبة ${pc(lic.bufferPct)} دون رسوم إضافية. ويُحتسب الاستخدام الزائد عن الحجم الملتزم زائد الهامش ربع سنوياً بأثر رجعي بأسعار الوحدة المذكورة.</p>` : ""}
  <h3>العرض متعدد السنوات</h3>
  <table>
    <thead><tr><th>الفترة</th><th class="num">القيمة</th></tr></thead>
    <tbody>
      <tr><td>السنة الأولى (استثمار)</td><td class="num">${m(lic.year1Subtotal + drFee)}</td></tr>
      <tr><td>السنة الثانية${lic.upliftPct ? ` (متكرر +${pc(lic.upliftPct)})` : " (متكرر)"}</td><td class="num">${m(lic.year2Recurring)}</td></tr>
      <tr><td>السنة الثالثة (متكرر)</td><td class="num">${m(lic.year3Recurring)}</td></tr>
      <tr class="total-row"><td>إجمالي كلفة التملك لثلاث سنوات</td><td class="num">${m(lic.tco3 + drFee)}</td></tr>
    </tbody>
  </table>
  ${
    lic.hasPilot && lic.pilot
      ? `<h3>خيار التجربة الاسترشادية</h3>
  <div class="terms-box">تجربة بسعر ثابت تشمل ${nu(lic.pilot.cohort)} مشاركاً على مدى ${nu(lic.pilot.durationWeeks)} أسبوعاً بمبلغ ${m(lic.pilot.price)}. وعند التحول إلى الترخيص السنوي خلال 90 يوماً، يُخصم ${pc(lic.pilot.creditPct)} من رسوم التجربة (${m(lic.pilot.creditAmount)}) من السنة الأولى. وهذه التجربة مسار دخول بديل ولا تُدرج ضمن إجمالي السنة الأولى أعلاه.</div>`
      : ""
  }`
    : "";

  const committedScope = lic
    ? `<h3>النطاق السنوي الملتزم</h3>
  <table>
    <thead><tr><th>الخدمة</th><th>النطاق السنوي الملتزم</th></tr></thead>
    <tbody>
      ${lic.products
        .map(
          (pr) =>
            `<tr><td>${esc(serviceLabelAr(pr.key, pr.name))}</td><td>${pr.isFixed ? "مشمول في الترخيص" : `حتى ${nu(pr.volume)} ${esc(BASIS_AR[pr.basis] ?? pr.basis)} سنوياً`}</td></tr>`,
        )
        .join("\n      ")}
    </tbody>
  </table>`
    : "";

  // ── Per-project commercial table (Arabic). ──
  const lineRows = p.lineItems
    .map((l) => `<tr><td>${esc(serviceLabelAr(l.service, l.label))}</td><td class="num">${l.service === "data_residency" ? "&mdash;" : nu(l.seats)}</td><td class="num">${l.service === "data_residency" ? "&mdash;" : m(l.unitRate)}</td><td class="num">${m(l.subtotal)}</td></tr>`)
    .join("");
  const discount = Math.round((p.subtotal - p.total) * 100) / 100;
  const discountRow = discount > 0 ? `<tr><td colspan="3" class="tot-label">خصم (${pc(p.discountPct)})</td><td class="num">- ${m(discount)}</td></tr>` : "";

  // ── Per-service blocks (per-project, 2+ services): each service in its own block,
  // then total-of-all-services + data residency + discount + grand total (Arabic). ──
  const serviceLinesAr = p.lineItems.filter((l) => l.service !== "data_residency");
  const drLinesAr = p.lineItems.filter((l) => l.service === "data_residency");
  const servicesSubtotalAr = serviceLinesAr.reduce((s, l) => s + l.subtotal, 0);
  const multiServicePerProjectAr = serviceLinesAr.length > 1;
  const serviceBlocksCommercialAr = `
    <div class="svc-cards">
      ${serviceLinesAr
        .map(
          (l) =>
            `<div class="svc-card"><div class="svc-card-head">${esc(serviceLabelAr(l.service, l.label))}</div><table><tbody><tr><td>${nu(
              l.seats,
            )} مشارك &times; ${m(l.unitRate)} لكل مشارك</td><td class="num">${m(l.subtotal)}</td></tr></tbody></table></div>`,
        )
        .join("")}
    </div>
    <table class="svc-summary"><tbody>
      <tr><td class="tot-label">إجمالي جميع الخدمات</td><td class="num">${m(servicesSubtotalAr)}</td></tr>
      ${drLinesAr.map((d) => `<tr><td class="tot-label">${esc(drRowLabelAr)}</td><td class="num">${m(d.subtotal)}</td></tr>`).join("")}
      ${discount > 0 ? `<tr><td class="tot-label">خصم (${pc(p.discountPct)})</td><td class="num">- ${m(discount)}</td></tr>` : ""}
      <tr class="total-row"><td class="tot-label">الإجمالي الكلي (${esc(cur)})</td><td class="num">${m(p.total)}</td></tr>
    </tbody></table>`;

  // ── Per-section text overrides (Feature 1). This renderer reads the AR text from
  // licence_data.sectionOverrides["<title>"].ar. Keyed by the ENGLISH section title
  // (the same key the builder + EN renderer use). Blank = keep the standard wording. ──
  const overrides =
    (p.licenceData && typeof p.licenceData === "object"
      ? ((p.licenceData as Record<string, unknown>).sectionOverrides as Record<string, { en?: string; ar?: string }> | undefined)
      : undefined) ?? {};
  // Every section is prose-editable (mirrors EN): computed sections keep their generated
  // table outside secBody, so nothing prepends via this set. The only prepend left is the
  // table auto-detect below.
  const OVERRIDE_PREPEND = new Set<string>([]);
  const FORCE_REPLACE = new Set(["Definitions"]);
  const ovText = (title: string): string => (overrides[title]?.ar ?? "").trim();
  const renderOverride = (text: string): string =>
    text
      .split(/\n\s*\n/)
      .map((b) => b.trim())
      .filter(Boolean)
      .map((b) => {
        const lines = b.split(/\n/).map((l) => l.trim());
        return lines.every((l) => l.startsWith("- "))
          ? `<ul>${lines.map((l) => `<li>${esc(l.slice(2))}</li>`).join("")}</ul>`
          : `<p>${esc(b).replace(/\n/g, "<br/>")}</p>`;
      })
      .join("");
  const renderOverrideContent = (text: string): string => (isRichHtml(text) ? sanitizeRichHtml(text) : renderOverride(text));
  const sectionDefaults: Record<string, string> = {};
  const secBody = (title: string, defaultHtml: string): string => {
    sectionDefaults[title] = defaultHtml;
    const o = ovText(title);
    if (!o) return defaultHtml;
    const rendered = renderOverrideContent(o);
    // Prepend for the OVERRIDE_PREPEND set AND any table-bearing default (mirrors EN;
    // renderOverride has no table support, so a replace would destroy the table).
    const prepend = !FORCE_REPLACE.has(title) && (OVERRIDE_PREPEND.has(title) || /<table/i.test(defaultHtml));
    return prepend ? rendered + defaultHtml : rendered;
  };
  const secIntro = (title: string): string => {
    const o = ovText(title);
    return o ? renderOverrideContent(o) : "";
  };

  // ── Engagement (professional-services) commercial + solution, Arabic. ──
  const engLineRowAr = (l: { label: string; basis: EngagementBasis; quantity: number; unitRate: number; lineTotal: number }) =>
    `<tr><td>${esc(l.label)}</td><td>${esc(BASIS_LABEL_AR[l.basis])}</td><td class="num">${l.basis === "fixed" ? "&mdash;" : nu(l.quantity)}</td><td class="num">${m(l.unitRate)}</td><td class="num">${m(l.lineTotal)}</td></tr>`;
  const engBodyAr = eng
    ? eng.titledCount >= 2
      ? eng.groups
          .map((g) =>
            g.name.trim()
              ? `<tr class="grp-row"><td colspan="5">${esc(g.name)}${g.participants ? ` &middot; ${nu(g.participants)} مشارك` : ""}</td></tr>${g.lines.map(engLineRowAr).join("")}<tr><td colspan="4" class="tot-label">الإجمالي الفرعي لـ${esc(g.name)}</td><td class="num">${m(g.subtotal)}</td></tr>`
              : g.lines.map(engLineRowAr).join(""),
          )
          .join("")
      : eng.lines.map(engLineRowAr).join("")
    : "";
  const engagementCommercialAr = eng
    ? `<table>
    <thead><tr><th>البند</th><th>الأساس</th><th class="num">الكمية</th><th class="num">سعر الوحدة</th><th class="num">المبلغ</th></tr></thead>
    <tbody>
      ${engBodyAr}
      <tr><td colspan="4" class="tot-label">الإجمالي الفرعي</td><td class="num">${m(eng.subtotal)}</td></tr>
      ${eng.hasDiscount ? `<tr><td colspan="4" class="tot-label">خصم (${pc(eng.discountPct)})</td><td class="num">- ${m(eng.discountAmount)}</td></tr>` : ""}
      <tr class="total-row"><td colspan="4" class="tot-label">الإجمالي (${esc(cur)})</td><td class="num">${m(eng.total)}</td></tr>
    </tbody>
  </table>
  <p class="scope-note">هذا ارتباط خدمات مهنية مخصص مُسعَّر وفق النطاق أعلاه: رسوم تصميم وإبلاغ ثابتة، وتقييم لكل مشارك، ووقت مقيّمين بالأيام الاستشارية، وتغذية راجعة تطويرية لكل متدرب. وتُعالَج أي تغييرات في حجم المجموعة أو تصميم التمارين بطلب تغيير كتابي.</p>`
    : "";

  const engagementSolutionAr = eng
    ? `<div class="svc">
    <h3>${eng.titledCount >= 2 ? esc(eng.groups.filter((g) => g.name.trim()).map((g) => g.name).join("  ·  ")) : `${esc(eng.name)} <span class="seats">${nu(eng.participants)} مشارك</span>`}</h3>
    <p>ارتباط مركز تقييم متكامل يُدار ويُيسَّر بواسطة استشاريي VIFM. يراقب مقيّمون مدربون كل متدرب عبر مجموعة من التمارين المرتبطة بالدور (مثل الحقيبة الواردة، ولعب الأدوار، وتمرين المجموعة، ودراسة الحالة، والعرض الشفهي)، ويصنّفون السلوك وفق إطار كفاءات VIFM على مقياس سلوكي محدد.</p>
    <p class="deliv-head">آلية التنفيذ</p>
    <ul class="deliv">
      <li><b>التصميم والإعداد</b> - تُهيَّأ التمارين ومصفوفة التمارين-الكفاءات وموجزات لاعبي الأدوار ومعايرة المقيّمين على الدور المستهدف لدى ${esc(p.clientName)}.</li>
      <li><b>أيام التقييم</b> - يكمل المتدربون التمارين تحت ملاحظة مقيّمين مدربين، مع تغطية كل كفاءة عبر تمرينين على الأقل.</li>
      <li><b>الدمج والمواءمة</b> - يوحّد المقيّمون الأدلة في جلسة دمج منظمة للوصول إلى تقييم عام (OAR) قابل للدفاع عنه مع توصية "جاهز الآن / جاهز مع التطوير / غير جاهز" لكل متدرب.</li>
      <li><b>التغذية الراجعة التطويرية الفردية</b> - يتلقى كل متدرب جلسة تغذية راجعة مخصصة مع استشاري، تترجم الأدلة إلى محور تطوير شخصي.</li>
      <li><b>الإبلاغ</b> - تقرير فردي لكل متدرب إضافة إلى تقرير دمج وقراءة للمجموعة للفريق الراعي.</li>
    </ul>
  </div>`
    : "";

  // ── Combined commercial (Arabic): services block + engagement block + one grand total. ──
  const combinedServicesDiscountAr = combinedServicesSubtotal * (p.discountPct || 0) / 100;
  const combinedServicesTableAr =
    combinedServicesMode === "licence" && lic
      ? licenceCommercial
      : combinedServiceLines.length > 0
        ? `<table>
    <thead><tr><th>الخدمة</th><th class="num">المشاركون</th><th class="num">السعر / مشارك</th><th class="num">الإجمالي الفرعي</th></tr></thead>
    <tbody>
      ${combinedServiceLines
        .map(
          (l) =>
            `<tr><td>${esc(l.service === "data_residency" ? drRowLabelAr : serviceLabelAr(l.service, l.label))}</td><td class="num">${l.service === "data_residency" ? "&mdash;" : nu(l.seats)}</td><td class="num">${l.service === "data_residency" ? "&mdash;" : m(l.unitRate)}</td><td class="num">${m(l.subtotal)}</td></tr>`,
        )
        .join("")}
      <tr><td colspan="3" class="tot-label">الإجمالي الفرعي للخدمات</td><td class="num">${m(combinedServicesSubtotal)}</td></tr>
      ${combinedServicesDiscountAr > 0 ? `<tr><td colspan="3" class="tot-label">خصم (${pc(p.discountPct)})</td><td class="num">- ${m(combinedServicesDiscountAr)}</td></tr>` : ""}
      <tr class="total-row"><td colspan="3" class="tot-label">إجمالي الخدمات (${esc(cur)})</td><td class="num">${m(combinedServicesSubtotal - combinedServicesDiscountAr)}</td></tr>
    </tbody>
  </table>`
        : "";
  const combinedCommercialAr = `${
    combinedServicesTableAr
      ? `<h3>${combinedServicesMode === "licence" ? "ترخيص المنصة" : "خدمات التقييم"}</h3>
  ${combinedServicesTableAr}`
      : ""
  }${
    eng
      ? `<h3>الارتباط الاستشاري</h3>
  ${engagementCommercialAr}`
      : ""
  }
  <table><tbody><tr class="total-row"><td class="tot-label">الإجمالي المجمّع (${esc(cur)})</td><td class="num">${m(p.total)}</td></tr></tbody></table>`;

  const intro =
    p.introNote?.trim() ||
    (isCombined
      ? `يسعدنا أن نقدم هذا العرض المجمّع لصالح ${esc(p.clientName)}، بما يجمع ${combinedSvcListAr || "خدمات الذكاء في المواهب من VIFM"}${eng ? ` وارتباط ${esc(eng.name)} بقيادة استشاري` : ""} في عرض تجاري واحد. ويُحدَّد نطاق كل عنصر ويُسعَّر تحت إجماليه الفرعي أدناه، بإجمالي مجمّع واحد؛ ويرد أدناه المنهج الفني وخطة التنفيذ.`
      : isEngagement && eng
      ? `يسعدنا أن نقدم هذا العرض لارتباط ${esc(eng.name)} لصالح ${esc(p.clientName)}، لتقييم ${nu(eng.participants)} مشاركاً. وهو برنامج بقيادة الاستشاريين - مقيّمون مدربون، وتمارين منظمة مرتبطة بالدور، وتقييم عام قابل للدفاع عنه، وتغذية راجعة تطويرية فردية - مدعوم بمنصة VIFM Caliber&reg;. ويرد أدناه المنهج وخطة التنفيذ والتفصيل التجاري.`
      : isLicence
        ? `يسعدنا أن نقدم هذا العرض للحصول على ترخيص سنوي شامل لمنصة VIFM Caliber&reg; للذكاء في المواهب لصالح ${esc(p.clientName)}، بما يجمع ${serviceListAr || "خدمات الذكاء في المواهب من VIFM"} ضمن رحلة مرشح واحدة، ووحدة تحكم إدارية واحدة، وتقارير موحدة ثنائية اللغة. والنموذج التجاري هو ترخيص سنوي ملتزم؛ ويرد أدناه المنهج الفني وخطة التنفيذ والتفصيل الكامل لبناء الترخيص.`
        : `يسعدنا أن نقدم هذا العرض لتفعيل ${serviceListAr || "خدمات الذكاء في المواهب من VIFM"} لصالح ${esc(p.clientName)}، بما يغطي ${nu(totalParticipants)} مشاركاً. ويُقدَّم البرنامج عبر منصة VIFM Caliber&reg; للذكاء في المواهب، ويرد أدناه المنهج الفني وخطة التنفيذ والتفصيل التجاري.`);

  const validUntil = p.validUntil ? fmtDateAr(p.validUntil) : null;

  // Cover subtitle (names the commercial shape of the offer) + client location.
  const coverSubtitleAr =
    isCombined
      ? "برنامج مجمّع &middot; خدمات المنصة + ارتباط استشاري"
      : isEngagement && eng
      ? `${esc(eng.name)} &middot; ارتباط خدمات مهنية بقيادة استشاري`
      : isLicence
        ? "رخصة سنوية شاملة &middot; منصة VIFM Caliber&reg; للذكاء في المواهب"
        : "حل الذكاء في المواهب &middot; منصة VIFM Caliber&reg;";
  const clientLocationAr = [p.clientCity, p.clientCountry].filter((s) => s && s.trim()).join("، ");

  // Executive-summary fact strip (Arabic). Combined mode: service count + engagement
  // participants + combined investment; other modes keep their existing two facts.
  const combinedSvcCountAr = combinedServicesMode === "licence" && lic ? lic.products.length + lic.bundles.length : serviceScopeRows.length;
  const factCardAr = (big: string, label: string, small = false) =>
    `<div style="flex:1;border:1px solid #e2e8f0;border-top:3px solid #5391D5;border-radius:6px;padding:8px 10px;"><b style="display:block;color:#010131;font-size:${small ? "12pt" : "13pt"};">${big}</b><span style="color:#64748b;font-size:8.5pt;">${label}</span></div>`;
  const factsInnerAr = isCombined
    ? `${factCardAr(nu(combinedSvcCountAr), "الخدمات")}
    ${eng ? factCardAr(nu(eng.participants), "مشاركو الارتباط") : ""}
    ${factCardAr(m(p.total), "الاستثمار المجمّع")}
    ${validUntil ? factCardAr(validUntil, "صلاحية العرض", true) : ""}`
    : `${factCardAr(isLicence && lic ? m(lic.annualRecurring) : nu(totalParticipants), isLicence && lic ? "التكلفة المتكررة السنوية" : "المشاركون")}
    ${factCardAr(isLicence && lic ? m(lic.year1Subtotal + drFee) : m(p.total), isLicence && lic ? "استثمار السنة الأولى" : "إجمالي الاستثمار")}
    ${validUntil ? factCardAr(validUntil, "صلاحية العرض", true) : ""}`;

  // ── ROI paragraph (Arabic). ──
  const roiRaw = (p.licenceData && typeof p.licenceData === "object" ? (p.licenceData as Record<string, unknown>).roi : null) as
    | { avgSalary?: number; hiresPerYear?: number; accuracyGainPct?: number }
    | null
    | undefined;
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
    return `<p><strong>العائد الاسترشادي.</strong> عند متوسط راتب سنوي قدره ${m(avgSalary)} و${nu(hires)} تعييناً سنوياً، فإن كلفة التعيين الخاطئ الواحد - وهي بتحفظ ١٫٥ ضعف الراتب، أي نحو ${m(misHire)} - تضع نحو ${m(exposure)} من القيمة في دائرة الخطر سنوياً. وتحسين دقة الاختيار بنسبة ${pc(gainPct)} فقط يستعيد ما يقارب ${m(recovered)} سنوياً${timesOver > 0 ? `، أي نحو <span dir="ltr">${timesOver.toFixed(1)}&times;</span> ${isLicence ? "استثمار السنة الأولى" : "الاستثمار الإجمالي"} في هذا البرنامج` : ""}. وهذه الأرقام استرشادية استناداً إلى المدخلات المقدمة وليست ضماناً للنتائج.</p>`;
  })();

  // ── Sample reports (Section 19, Arabic): the reports included in the agreed
  // scope per selected service, instead of raw platform-evidence figures. ──
  const sampleServiceRows = isCombined ? serviceScopeRows : scopeWithSeats;
  const sampleServiceItems = sampleServiceRows
    .map((s) => `<li>${esc(s.label)} - تقرير فردي لكل مشارك وتحليلات تجميعية للجهة الراعية</li>`)
    .join("\n      ");
  const engReportsItem = eng
    ? `<li>${esc(eng.name)} - تقرير فردي لكل متدرب (ملف الكفاءات، التقييم العام، وبؤرة التطوير) وتقرير تجميعي للفريق الراعي</li>`
    : "";
  const sampleReportsBody = sampleServiceItems || engReportsItem
    ? `<ul class="deliv">
      ${sampleServiceItems}${engReportsItem}
    </ul>`
    : "<p>تُؤكَّد التقارير المدرجة في النطاق عند الانطلاق وتُوثَّق في بيان العمل.</p>";

  // ── Computed sections: editable intro PROSE (secBody) + a generated table kept LIVE
  // below (mirrors EN). ──
  const commercialIntroHtml = isCombined
    ? `<p>يجمع النموذج التجاري بين ${combinedServicesMode === "licence" ? "<strong>ترخيص سنوي شامل</strong>" : "<strong>خدمات منصة لكل مشارك</strong>"}${eng ? " و<strong>ارتباط خدمات مهنية مخصص</strong>" : ""}. ويُدرَج كل جزء تحت إجماليه الفرعي أدناه، ويُختَم بإجمالي مجمّع واحد.</p>`
    : isEngagement && eng
      ? `<p>النموذج التجاري هو <strong>ارتباط خدمات مهنية مخصص</strong>، مُسعَّر بالبنود أدناه - رسوم تصميم وإبلاغ ثابتة، وتقييم لكل مشارك، ووقت مقيّمين بالأيام الاستشارية، وتغذية راجعة تطويرية لكل متدرب.</p>`
      : isLicence && lic
        ? `<p>النموذج التجاري هو <strong>ترخيص سنوي شامل ملتزم</strong> لمنصة Caliber: تُسعَّر الخدمات المختارة إفرادياً حسب الحجم، ثم تُجمَّع بخصم الترخيص الملتزم. ويُدرج الدعم واتفاقية مستوى الخدمة كنسبة من الترخيص، ويغطي التنفيذ لمرة واحدة الإعداد والتهيئة والتكامل والتدريب.</p>`
        : `<p>النموذج التجاري رسم بسيط لكل مشارك: تُسعَّر كل خدمة مختارة لكل مشارك وتُدرَج أدناه.</p>`;
  const commercialTableHtml = isCombined
    ? combinedCommercialAr
    : isEngagement && eng
      ? engagementCommercialAr
      : isLicence && lic
        ? licenceCommercial
        : multiServicePerProjectAr
          ? serviceBlocksCommercialAr
          : `<table>
    <thead><tr><th>الخدمة</th><th class="num">المشاركون</th><th class="num">السعر / مشارك</th><th class="num">الإجمالي الفرعي</th></tr></thead>
    <tbody>
      ${lineRows}
      <tr><td colspan="3" class="tot-label">الإجمالي الفرعي</td><td class="num">${m(p.subtotal)}</td></tr>
      ${discountRow}
      <tr class="total-row"><td colspan="3" class="tot-label">الإجمالي (${esc(cur)})</td><td class="num">${m(p.total)}</td></tr>
    </tbody>
  </table>`;
  const sampleReportsProseHtml = `<p>تُدرَج أدناه التقارير والمُخرَجات المشمولة في النطاق المتفق عليه، لكل خدمة مختارة. ويُقدَّم كل تقرير بصيغة PDF احترافية وثنائية اللغة عند الطلب. وتتوفر نماذج تقارير مجهّلة (فردية وتجميعية) لكل خدمة مشمولة عند الطلب، ويمكن إرفاقها ببيان العمل الموقّع.</p>`;

  const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link href="${AR_FONT_HREF}" rel="stylesheet" />
<style>
  @page { size: A4; margin: 16mm 15mm 20mm; }
  * { box-sizing: border-box; }
  body { font-family: "Noto Naskh Arabic", "Segoe UI", Tahoma, serif; direction: rtl; color: #111232; font-size: 11pt; line-height: 1.7; margin: 0; }

  /* Cover - premium: layered navy gradient + accent glow + faint V motif (RTL) */
  .cover { position: relative; overflow: hidden; color: #fff; border-radius: 12px; padding: 24mm 22mm; height: 250mm;
    background:
      radial-gradient(115% 75% at 16% 6%, rgba(83,145,213,.30) 0%, rgba(83,145,213,0) 44%),
      linear-gradient(202deg, #0b0b30 0%, #010131 48%, #04051c 100%);
    display: flex; flex-direction: column; justify-content: space-between; page-break-after: always; }
  .cover .motif { position: absolute; left: -26mm; bottom: -30mm; width: 152mm; height: 152mm; opacity: .13; z-index: 0; }
  .cover .texture { position: absolute; inset: 0; z-index: 0; opacity: .55;
    background-image: radial-gradient(rgba(147,184,230,.11) 1px, transparent 1.2px);
    background-size: 22px 22px; -webkit-mask-image: linear-gradient(180deg, #000 0%, rgba(0,0,0,.35) 60%, transparent 100%); }
  .cover .layer { position: relative; z-index: 1; }
  .cover .topbar { display: flex; align-items: flex-start; justify-content: space-between; gap: 10mm; }
  .cover .logo { height: 15mm; width: auto; display: block; }
  .cover .meta-top { text-align: left; color: #93b8e6; font-size: 8pt; line-height: 2; white-space: nowrap; }
  .cover .eyebrow { color: #9ec2ec; font-size: 10pt; font-weight: 700; }
  .cover .title-wrap { position: relative; padding-right: 16px; margin-top: 30mm; }
  .cover .title-wrap::before { content: ""; position: absolute; right: 0; top: 4px; bottom: 10px; width: 3px; border-radius: 2px; background: linear-gradient(#5391D5, rgba(83,145,213,.15)); }
  h1 { color: #010131; font-size: 22pt; margin: 8px 0 6px; line-height: 1.3; }
  .cover h1 { color: #fff; font-size: 25pt; line-height: 1.3; margin: 10px 0 0; border: 0; padding: 0; font-weight: 800; }
  .cover .subtitle { color: #bcd3ef; font-size: 12pt; font-weight: 600; margin-top: 10px; line-height: 1.6; }
  .cover .accent { width: 72px; height: 4px; background: #5391D5; border-radius: 2px; margin-top: 18px; }
  .cover .prepared { margin-top: 20px; }
  .cover .prepared b { display: block; color: #9ec2ec; font-size: 9pt; font-weight: 700; margin-bottom: 4px; }
  .cover .prepared span { display: block; color: #fff; font-size: 16pt; font-weight: 800; line-height: 1.3; }
  .cover .prepared em { color: #bcd3ef; font-size: 11pt; font-weight: 600; font-style: normal; }
  .cover .prepared i { display: block; color: #9ec2ec; font-size: 10.5pt; font-weight: 600; font-style: normal; margin-top: 5px; }
  .cover .creds { display: flex; flex-wrap: wrap; gap: 7px 16px; margin-top: 22px; color: #9ec2ec; font-size: 9pt; font-weight: 600; }
  .cover .creds span { position: relative; padding-right: 13px; }
  .cover .creds span::before { content: ""; position: absolute; right: 0; top: 50%; transform: translateY(-50%); width: 5px; height: 5px; border-radius: 50%; background: #5391D5; }
  .cover .panel { background: rgba(255,255,255,.05); border: 1px solid rgba(147,184,230,.22); border-top: 2px solid #5391D5; border-radius: 8px; padding: 15px 20px; }
  .cover .grid { display: flex; flex-wrap: wrap; gap: 12px 44px; font-size: 10.5pt; }
  .cover .grid b { display: block; color: #93b8e6; font-size: 8pt; font-weight: 700; margin-bottom: 3px; }
  .cover .conf { color: rgba(255,255,255,.6); font-size: 8.5pt; line-height: 1.7; margin-top: 14px; }

  .toc { page-break-after: always; }
  .toc-head { display: flex; align-items: center; justify-content: space-between; gap: 10mm; }
  .toc-head img { height: 10mm; width: auto; }
  .toc ol { margin: 10px 0 0; padding-right: 0; list-style: none; counter-reset: toc; }
  .toc li { counter-increment: toc; padding: 5px 2px; border-bottom: 1px solid #eef2f7; font-size: 10.5pt; }
  .toc li::before { content: counter(toc) ".  "; color: #5391D5; font-weight: 700; }

  .eyebrow { color: #5391D5; font-size: 9pt; font-weight: 700; }
  h2 { color: #010131; font-size: 13.5pt; margin: 22px 0 8px; padding-top: 8px; border-top: 1px solid #e5e7eb; }
  h2 .no { color: #5391D5; margin-left: 6px; }
  h3 { color: #121140; font-size: 11.5pt; margin: 14px 0 3px; }
  h3 .seats { color: #5391D5; font-size: 9pt; font-weight: 600; }
  p { margin: 5px 0; }
  ul { margin: 4px 0 8px; padding-right: 18px; }
  li { margin: 2px 0; }
  .scope-note { color: #475569; font-size: 9.5pt; }
  .svc { page-break-inside: avoid; margin-bottom: 12px; }

  table { width: 100%; border-collapse: collapse; margin: 10px 0 4px; font-size: 9.5pt; }
  th { text-align: start; background: #f1f5f9; color: #010131; font-weight: 700; padding: 7px 9px; border-bottom: 2px solid #cbd5e1; }
  td { padding: 6px 9px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
  td.num, th.num { text-align: end; white-space: nowrap; }
  .tot-label { text-align: end; color: #475569; }
  .total-row td { border-top: 2px solid #010131; font-weight: 800; color: #010131; font-size: 11pt; }
  .grp-row td { background: #eef4fb; color: #010131; font-weight: 700; font-size: 10pt; border-top: 1px solid #cbd5e1; }
  /* Per-service commercial blocks (multi-service per-project) */
  .svc-cards { margin: 8px 0 2px; }
  .svc-card { border: 1px solid #e2e8f0; border-top: 3px solid #5391D5; border-radius: 6px; padding: 7px 12px; margin: 8px 0; page-break-inside: avoid; }
  .svc-card-head { color: #010131; font-weight: 700; font-size: 10.5pt; }
  .svc-card table { margin: 3px 0 0; }
  .svc-card td { border-bottom: none; padding: 3px 0; color: #334155; }
  .svc-summary { margin-top: 4px; page-break-inside: avoid; }
  .terms-box { background: #f8fafc; border-right: 3px solid #5391D5; border-radius: 6px 0 0 6px; padding: 10px 14px; margin-top: 8px; font-size: 9.5pt; color: #334155; }

  ol.clauses { margin: 8px 0 0; padding-right: 0; list-style: none; counter-reset: cl; }
  ol.clauses > li { counter-increment: cl; margin: 0 0 8px; padding-right: 42px; position: relative; font-size: 9.5pt; color: #334155; page-break-inside: avoid; }
  ol.clauses > li::before { content: "${tcNoRaw}." counter(cl); position: absolute; right: 0; top: 0; color: #010131; font-weight: 700; direction: ltr; }
  ol.clauses b { color: #010131; }

  .accept { page-break-before: always; }
  .sig-grid { display: flex; gap: 18px; margin-top: 18px; }
  .sig { flex: 1; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 16px; }
  .sig h4 { margin: 0 0 10px; color: #010131; font-size: 10.5pt; }
  .sig .line { border-bottom: 1px solid #94a3b8; height: 22px; margin-bottom: 4px; }
  .sig .lbl { color: #64748b; font-size: 8.5pt; margin-bottom: 12px; }

  h2, h3 { page-break-after: avoid; }
  table, .svc, .terms-box, .sig-grid { page-break-inside: avoid; }
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
        <div class="meta-top"><span dir="ltr">${ref}</span><br/>${fmtDateAr(p.createdAt)}</div>
      </div>
      <div class="title-wrap">
        <div class="eyebrow">VIFM Caliber&reg; &middot; عرض الذكاء في المواهب</div>
        <h1>${esc(p.title)}</h1>
        <div class="subtitle">${coverSubtitleAr}</div>
        <div class="accent"></div>
        <div class="prepared"><b>مُعدّ لصالح</b><span>${esc(p.clientName)}</span>${clientLocationAr ? `<i>${esc(clientLocationAr)}</i>` : ""}</div>
      </div>
      <div class="creds">
        <span>ثنائي اللغة عربي / إنجليزي</span><span>شهادات قابلة للتحقق</span><span>متوافق مع ISO 10667</span><span>سيادة بيانات خليجية</span>
      </div>
    </div>
    <div class="layer">
      <div class="panel">
        <div class="grid">
          <div><b>مُعدّ لصالح</b>${esc(p.clientName)}</div>
          <div><b>مُعدّ بواسطة</b>معهد فرجينيا للتمويل والإدارة</div>
          <div><b>المرجع</b><span dir="ltr">${ref}</span></div>
          <div><b>التاريخ</b>${fmtDateAr(p.createdAt)}</div>
          ${validUntil ? `<div><b>صالح حتى</b>${validUntil}</div>` : ""}
        </div>
      </div>
      <div class="conf">
        يحتوي هذا المستند على معلومات سرية ومملوكة لمعهد فرجينيا للتمويل والإدارة (VIFM)، وهو مُعدّ حصرياً لصالح ${esc(p.clientName)}. ولا يجوز نسخه أو الإفصاح عنه لأي طرف ثالث، كلياً أو جزئياً، دون موافقة خطية مسبقة من VIFM.
      </div>
    </div>
  </div>

  <div class="toc">
    <div class="toc-head">
      <div class="eyebrow"><span dir="ltr">${ref}</span></div>
      ${logoColor ? `<img src="${logoColor}" alt="VIFM" />` : ""}
    </div>
    <h2 style="border-top:0;padding-top:0;">المحتويات</h2>
    <ol>
      ${included.map((s) => `<li>${esc(TITLE_AR[s] ?? s)}</li>`).join("\n      ")}
    </ol>
  </div>

  <h2 style="border-top:0;padding-top:0;">${at("Executive summary")}</h2>
  ${secBody("Executive summary", `<p>${intro}</p>`)}
  <div style="display:flex;gap:10px;margin:12px 0 4px;">
    ${factsInnerAr}
  </div>
  ${roiHtml}

  <h2>${at("About VIFM")}</h2>
  ${secBody("About VIFM", `<p>معهد فرجينيا للتمويل والإدارة (VIFM) معهد للتمويل والإدارة يخدم منطقة الخليج، ويجمع بين التدريب المهني ومنصة ذكاء مواهب مبنية لهذا الغرض هي VIFM Caliber&reg;. توفر المنصة تقييماً منظماً ثنائي اللغة (عربي/إنجليزي) عبر دورة حياة المواهب كاملة - من الفرز قبل التوظيف والشهادات الفنية إلى تحليل السلوك والقدرات المعرفية وتحديد مستوى الإنجليزية والتقييم القيادي 360 والجاهزية المؤسسية للذكاء الاصطناعي.</p>
  <p>كل أداة مبنية على منهجية موثقة، وتُدار بشكل آمن (مفاتيح إجابات محفوظة على الخادم وعشوائية لكل إدارة)، وتنتج مخرجات قابلة للمراجعة والدفاع عنها. وحيثما يسهم الذكاء الاصطناعي في التقييم فإنه يعمل تحت إشراف بشري موثق؛ وحيثما تُصدر شهادات فإنها قابلة للتحقق العلني.</p>`)}

  <h2>${at("Understanding of your requirements")}</h2>
  ${secBody("Understanding of your requirements", `<p>${esc(p.clientName)} ${sectorPhrase}${p.clientRegion ? ` تعمل في ${jurisdiction}` : ""} وتسعى إلى رؤية منظمة وقابلة للدفاع عنها لقدرات ${nu(totalParticipants)} مشاركاً من خلال ${serviceListAr}. ويُتوقع أن ينتج البرنامج تقارير فردية لأغراض التطوير ودعم القرار، إلى جانب تحليلات على مستوى المجموعة للفريق الراعي.</p>
  <p>يعالج الحل المبيّن أدناه هذه المتطلبات بأدوات ثنائية اللغة حيثما يتطلب الجمهور ذلك، وقابلة للتدقيق من طرف إلى طرف، ومتوائمة مع متطلبات حماية البيانات السارية في ${jurisdiction}. وأي تعديل للنطاق يُتفق عليه عند الانطلاق يُوثَّق في بيان العمل.</p>`)}

  <h2>${at("Proposed solution & technical approach")}</h2>
  ${secBody(
    "Proposed solution & technical approach",
    `${
      isEngagement
        ? engagementSolutionAr
        : isCombined
          ? `${combinedServicesMode === "licence" ? committedScope : ""}${technical}${engagementSolutionAr}`
          : `${committedScope}${technical || "<p>لم يتم اختيار خدمات.</p>"}`
    }`,
  )}
  <div class="svc"><h3>سيادة البيانات</h3><p>${dataResidencyStatementAr(residency)}</p></div>

  ${inc("Psychometric foundations") ? `<h2>${at("Psychometric foundations")}</h2>
  ${secBody("Psychometric foundations", `<p>تقوم الأدوات المقترحة على أسس قياس موثقة لا على مجموعات أسئلة عشوائية:</p>
  <ul>
    <li><b>عمود فقري موحد للكفاءات</b> - يرتبط القياس السلوكي بإطار VIFM المكوّن من 41 كفاءة، فتصف نتائج الأدوات المختلفة الأشخاص بلغة واحدة مشتركة.</li>
    <li><b>مقاييس معتمدة</b> - تستخدم التقييمات السلوكية مقاييس مرجعية محددة؛ ويرتبط تحديد مستوى الإنجليزية بالإطار الأوروبي المرجعي CEFR (من A1 إلى C2).</li>
    <li><b>بنوك بنود منسّقة</b> - تُصاغ البنود وتُراجع من الخبراء وتُصدر بإصدارات؛ ويُعاد ترتيب الخيارات عشوائياً لكل إدارة لحماية سلامة البنود.</li>
    <li><b>ضمانات جودة الاستجابة</b> - حيثما يقتضي المفهوم، تحمل الأدوات فحوص تشويه واتساق تُعرض على الاستشاري المراجع بدلاً من احتسابها تلقائياً بصمت.</li>
    <li><b>مراقبة الثبات</b> - تُتابع إحصاءات الاتساق الداخلي مع نمو أحجام الاستجابة، ولا يُفعّل التقرير المرجعي المعياري إلا عندما تكون العينة كافية.</li>
    <li><b>طبقات إبلاغ صادقة</b> - تُوسم كل نتيجة صراحةً بأنها استرشادية أو معتمدة؛ ولا توجد النتائج المعتمدة إلا حيث تقف خلفها درجة قطع موثقة وعملية مراجعة.</li>
  </ul>`)}` : ""}

  ${inc("Methodology & quality standards") ? `<h2>${at("Methodology & quality standards")}</h2>
  ${secBody("Methodology & quality standards", `<ul>
    <li><b>منهجية موثقة لكل أداة</b> - تُرفق كل أداة بموجز منهجية منشور يغطي المفهوم ونموذج التقييم والحدود الصادقة، ويرافق هذا العرض عند الطلب.</li>
    <li><b>توافق مع الإرشادات المعتمدة</b> - يتوائم تصميم البرنامج مع معيار ISO 10667، ومع الإرشادات الدولية لعمليات مراكز التقييم في أعمال مراكز التقييم.</li>
    <li><b>إدارة آمنة</b> - تُحفظ مفاتيح الإجابات على الخادم ولا تصل إلى متصفح المشارك؛ والتصحيح يتم على الخادم؛ والجلسات تُستخدم مرة واحدة.</li>
    <li><b>مراقبة نزاهة بإطار صريح</b> - تلتقط التقييمات مؤشرات نزاهة استرشادية (نشاط التبويبات، واللصق، وتوقيت الإجابة، ومراقبة الكاميرا الاختيارية حيثما تُفعّل) تستدعي مراجعة بشرية للجلسة المُعلَّمة. هذه مراقبة استرشادية وليست مراقبة اختبارية صارمة - ولا يؤدي أي مؤشر إلى إسقاط مشارك تلقائيًا.</li>
    <li><b>إشراف بشري على تقييم الذكاء الاصطناعي</b> - حيثما يسهم الذكاء الاصطناعي، تُعاير المخرجات ويحتفظ شخص مؤهل بصلاحية المراجعة؛ ولا يكون أي قرار آلي نهائياً.</li>
    <li><b>تقديم ثنائي اللغة</b> - تتوفر تجارب المشاركين بالإنجليزية والعربية (مع الاتجاه من اليمين إلى اليسار) حيثما شُمل ذلك في النطاق.</li>
  </ul>`)}` : ""}

  ${inc("Platform, integration & security") ? `<h2>${at("Platform, integration & security")}</h2>
  ${secBody("Platform, integration & security", `<ul>
    <li><b>منصة التقديم</b> - يعمل البرنامج على VIFM Caliber&reg;، وهي منصة سحابية لا تتطلب أي تثبيت لدى العميل؛ وينضم المشاركون عبر روابط دعوة شخصية على أي متصفح حديث.</li>
    <li><b>وضوح البرنامج</b> - يتلقى الفريق الراعي متابعة إنجاز مباشرة خلال نافذة التقييم، مع إدارة التذكيرات من قِبل VIFM.</li>
    <li><b>مخرجات قابلة للتحقق</b> - تحمل الشهادات المعتمدة رابط تحقق علنياً، فيمكن لأي طرف ثالث تأكيد صحتها دون التواصل مع VIFM.</li>
    <li><b>قابلية نقل البيانات</b> - تُصدَّر النتائج بصيغ قياسية (CSV / JSON) لأنظمة الموارد البشرية أو التتبع لدى العميل؛ وتُسلَّم التقارير الفردية بصيغة PDF.</li>
    <li><b>التكامل</b> - يمكن تحديد نطاق الدخول الموحد أو التكامل الأعمق مع الأنظمة في بيان العمل عند الحاجة.</li>
    <li><b>الوضع الأمني</b> - تشفير أثناء النقل والتخزين، ووصول قائم على الأدوار بضوابط على مستوى الصف، ومنطق تصحيح لا يصل إلى جهاز المشارك (انظر القسم ${NO("Data protection & privacy")}).</li>
  </ul>`)}` : ""}

  ${inc("Implementation plan") ? `<h2>${at("Implementation plan")}</h2>
  ${secBody("Implementation plan", `<p class="scope-note">خطة استرشادية لمجموعة بهذا الحجم؛ ويُتفق على الجدول النهائي عند الانطلاق ويُوثَّق في بيان العمل.</p>`)}
  <table>
    <thead><tr><th>المرحلة</th><th>التوقيت الاسترشادي</th><th>الأنشطة الرئيسية</th><th>المخرجات</th></tr></thead>
    <tbody>
      <tr><td><b>1 &middot; التعبئة</b></td><td>الأسبوع 1</td><td>الانطلاق، تأكيد نقطة اتصال واحدة، استلام قائمة المشاركين، تأكيد النطاق واللغات</td><td>جدول متفق عليه؛ حزمة تواصل</td></tr>
      <tr><td><b>2 &middot; الإعداد</b></td><td>الأسبوع 2</td><td>تهيئة الحل على المنصة، تجهيز الدعوات، تشغيل تجريبي لمجموعة صغيرة</td><td>إعداد مُتحقَّق؛ اعتماد التجربة</td></tr>
      <tr><td><b>3 &middot; نافذة التقييم</b></td><td>الأسبوع 3</td><td>إرسال الدعوات على دفعات، متابعة الإنجاز، إدارة التذكيرات، دعم المشاركين</td><td>لوحة إنجاز؛ تقارير حالة دورية</td></tr>
      <tr><td><b>4 &middot; الإبلاغ والإحاطة</b></td><td>الأسبوع 4</td><td>إصدار التقارير الفردية، تجميع تحليلات المجموعة، جلسة إحاطة للراعي</td><td>حزمة المخرجات الكاملة؛ الإحاطة والتوصيات</td></tr>
    </tbody>
  </table>` : ""}

  <h2>${at("Project governance & team")}</h2>
  ${secBody("Project governance & team", `<ul>
    <li><b>قائد الارتباط (VIFM)</b> - مالك واحد مسؤول عن التنفيذ والجوانب التجارية والتصعيد.</li>
    <li><b>منسق التقديم (VIFM)</b> - يدير الدعوات ومتابعة الإنجاز ودعم المشاركين طوال نافذة التقييم.</li>
    <li><b>الإشراف على التقييم والقياس النفسي (VIFM)</b> - يملك سلامة الأدوات وجودة التقييم ومراجعة أي إدارة مُعلَّمة.</li>
    <li><b>نقطة الاتصال الواحدة لدى العميل</b> - تسمّي ${esc(p.clientName)} منسقاً واحداً يملك قائمة المشاركين والتواصل الداخلي وقرارات الجدولة.</li>
    <li><b>الإيقاع</b> - حالة مكتوبة أسبوعياً خلال نافذة التقييم، مع مسار تصعيد ثابت إلى قائد الارتباط وإحاطة ختامية عند التسليم.</li>
  </ul>`)}

  <h2>${at("Data protection & privacy")}</h2>
  ${secBody("Data protection & privacy", `<ul>
    <li>تُعالَج بيانات التقييم وفقاً لقوانين حماية البيانات السارية: المرسوم بقانون اتحادي إماراتي رقم 45 لسنة 2021، ونظام حماية البيانات الشخصية السعودي، واللائحة الأوروبية العامة لحماية البيانات حيثما انطبق.</li>
    <li>تُؤخذ موافقة المشارك قبل جمع أي بيانات تقييم؛ وتحمل سجلات المشاركة أثراً تدقيقياً.</li>
    <li>تُشفَّر البيانات أثناء النقل والتخزين؛ والوصول قائم على الأدوار ومحصور بما يتطلبه كل دور؛ ولا تصل مفاتيح الإجابات ومنطق التصحيح إلى جهاز المشارك.</li>
    <li>تُحتفظ البيانات الشخصية لمدة أقصاها 24 شهراً ما لم يُمدَّد ذلك تعاقدياً، ثم تُمحى وفق إجراءات الاحتفاظ لدى VIFM.</li>
    <li>تُتاح النتائج الفردية فقط للمستلمين المخوّلين لدى المؤسسة الراعية؛ وتحمي حدود إخفاء الهوية المساهمين في التقييم متعدد المصادر.</li>
  </ul>`)}

  ${inc("AI governance & standards") ? `<h2>${at("AI governance & standards")}</h2>
  ${secBody("AI governance & standards", `<ul>
    <li><b>الإنسان في الحلقة بالتصميم</b> - يساعد الذكاء الاصطناعي في صياغة البنود والنسخ والتقييم المبدئي؛ ويحتفظ شخص مؤهل بصلاحية المراجعة على أي مخرج يؤثر في مشارك، ولا يُؤتمت أي قرار توظيف أو ترقية.</li>
    <li><b>الشفافية</b> - يوضّح موجز منهجية كل أداة أين يسهم الذكاء الاصطناعي وأين لا يسهم، بما يمكّن العميل من إثبات التزاماته الحوكمية.</li>
    <li><b>المعايرة</b> - تُعاير المهام الإنتاجية المُقيَّمة بالذكاء الاصطناعي (كالكتابة والتحدث) مقابل تقييمات بشرية، مع مراقبة التوافق عبر الزمن.</li>
    <li><b>لا رفض تلقائي</b> - المركّبات الفرزية إشارات استرشادية؛ ويبقى القرار لدى مراجعي العميل، وتقول التقارير ذلك صراحةً.</li>
    <li><b>التوافق الإقليمي</b> - صُمم النهج ليكون قابلاً للدفاع عنه في ظل التوقعات الناشئة لحوكمة الذكاء الاصطناعي في الخليج${p.clientRegion === "saudi" ? "، بما في ذلك الإرشادات السارية في المملكة العربية السعودية" : ""}.</li>
  </ul>`)}` : ""}

  <h2 style="page-break-before: always;">${at("Service level & support")}</h2>
  ${secBody("Service level & support", `<ul>
    <li><b>فريق مُسمّى</b> - يُخصَّص قائد ارتباط ومنسق تقديم طوال مدة البرنامج (انظر القسم ${NO("Project governance & team")}).</li>
    <li><b>نافذة الدعم</b> - دعم للبرنامج وللمشاركين خلال ساعات العمل في الخليج (الأحد-الخميس)، مع استجابة أولية خلال يوم عمل واحد.</li>
    <li><b>دعم المشاركين</b> - تتولى VIFM مباشرةً مشكلات الدخول وإعادة إرسال الدعوات واستفسارات الإنجاز، بما يبعد منسق العميل عن الأعمال اليومية.</li>
    <li><b>الاستمرارية</b> - تُشغَّل المنصة لتجنّب أي انقطاعات ظاهرة للمشاركين خلال نافذة التقييم المتفق عليها.</li>
    ${isLicence ? "" : `<li><b>اتفاقية مستوى خدمة رسمية</b> - حيثما يتطلب العميل مقاييس توافر واستجابة ملتزمة، تُوثَّق في بيان العمل.</li>`}
  </ul>
  ${
    isLicence
      ? `<p class="scope-note">تنطبق مستويات الخدمة التالية بموجب الترخيص السنوي:</p>
  <ul>
    <li><b>توافر المنصة</b> - ضمان توافر شهري بنسبة <span dir="ltr">99.5%</span>، باستثناء الصيانة المجدولة.</li>
    <li><b>أزمنة الاستجابة</b> - المشكلات الحرجة خلال 4 ساعات عمل؛ والطلبات القياسية خلال يوم عمل واحد.</li>
    <li><b>ساعات الدعم</b> - <span dir="ltr">09:00-18:00</span> بتوقيت السعودية، الأحد-الخميس (تغطية خليجية كاملة).</li>
    <li><b>أرصدة الخدمة</b> - يُطبَّق رصيد خدمة تناسبي عن أي شهر يقل عن ضمان التوافر، بوصفه التعويض الحصري عن التوافر.</li>
  </ul>`
      : ""
  }`)}

  ${inc("Relevant experience") ? `<h2>${at("Relevant experience")}</h2>
  ${secBody("Relevant experience", `<p>تقدّم VIFM برامج تقييم وتطوير لمؤسسات مصرفية وحكومية وشركات عبر منطقة الخليج. وتحمل منصة Caliber سبع عائلات من الأدوات تمتد من استقطاب المواهب إلى تطويرها - تحليل السلوك، والقدرات المعرفية، والشهادات الفنية، وتحديد مستوى الإنجليزية، والفرز قبل التوظيف، والتقييم القيادي 360، والجاهزية المؤسسية للذكاء الاصطناعي - تُقدَّم ثنائية اللغة كمعيار.</p>
  <p>تتوفر مراجع العملاء وملخصات حالات مجهّلة ذات صلة بهذا الارتباط عند الطلب، بما يخضع لالتزامات السرية التي نقدمها لكل عميل - وهي ذات الالتزامات التي يقدمها هذا العرض لـ ${esc(p.clientName)}.</p>`)}` : ""}

  <h2>${at("Commercial proposal")}</h2>
  ${secBody("Commercial proposal", commercialIntroHtml)}
  ${commercialTableHtml}
  ${validUntil ? `<p class="scope-note">هذا العرض صالح حتى <strong>${validUntil}</strong>. والرسوم مذكورة بعملة ${esc(cur)} ولا تشمل أي ضرائب سارية تُضاف بالسعر المعمول به عند الاقتضاء.</p>` : `<p class="scope-note">الرسوم مذكورة بعملة ${esc(cur)} ولا تشمل أي ضرائب سارية تُضاف بالسعر المعمول به عند الاقتضاء.</p>`}
  ${p.paymentTerms ? `<h3>شروط الدفع</h3><p>${esc(p.paymentTerms)}</p>` : ""}

  ${inc("Assumptions & exclusions") ? `<h2>${at("Assumptions & exclusions")}</h2>
  ${secBody("Assumptions & exclusions", `<ul>
    <li>تقدّم ${esc(p.clientName)} قائمة مشاركين كاملة ودقيقة (الأسماء والبريد الإلكتروني) قبل فتح نافذة التقييم، وتسمّي نقطة اتصال واحدة مخوّلة باتخاذ قرارات الجدولة.</li>
    <li>يتوفر للمشاركين جهاز مناسب واتصال بالإنترنت؛ وتُكمَل التقييمات عن بُعد ما لم يُتفق على خلاف ذلك كتابةً.</li>
    <li>الأحجام كما ذُكرت؛ وتُعالَج أي تغييرات جوهرية في الأحجام أو النطاق أو اللغات بطلب تغيير كتابي وقد تعدّل الرسوم والجدول.</li>
    <li>يفترض الجدول الاسترشادي إصدار مراسلات العميل ضمن النوافذ المتفق عليها؛ وأي تأخر في تعبئة المشاركين يمدّد الجدول لا السعر.</li>
    <li>لا يشكّل هذا العرض عقداً؛ ويبدأ الارتباط عند توقيع بيان عمل يشير إلى هذا العرض.</li>
  </ul>`)}` : ""}

  <h2>${at("Terms & conditions")}</h2>
  ${p.terms ? `<div class="terms-box">${esc(p.terms)}</div>` : ""}
  ${secBody("Terms & conditions", `<ol class="clauses">
    <li><b>السرية.</b> يحافظ كل طرف على سرية معلومات الطرف الآخر، ويستخدمها فقط لهذا الارتباط، ويفصح عنها فقط لمن يحتاجها من الأفراد الملتزمين بتعهدات مماثلة. ويبقى هذا البند سارياً بعد انتهاء الارتباط.</li>
    <li><b>الملكية الفكرية.</b> تحتفظ VIFM بجميع الحقوق في أدواتها وبنوك بنودها وأطرها ومنهجياتها وبرمجياتها وصيغ تقاريرها. وتحصل ${esc(p.clientName)} على حق غير حصري وغير قابل للتحويل لاستخدام المخرجات داخلياً لأغراض هذا الارتباط.</li>
    <li><b>حماية البيانات.</b> يلتزم الطرفان بقوانين حماية البيانات السارية كما هو موضح في القسم ${NO("Data protection & privacy")}. وتعمل VIFM كمعالج لبيانات المشاركين الشخصية بناءً على تعليمات العميل الموثقة، ما لم يقض القانون بخلاف ذلك.</li>
    <li><b>الرسوم والدفع.</b> الرسوم كما هي مبينة في القسم ${NO("Commercial proposal")} وتُستحق وفق شروط الدفع المذكورة. وتُستحق الفواتير خلال 30 يوماً من إصدارها ما لم يُتفق على خلاف ذلك في بيان العمل.</li>
    <li><b>حدود المسؤولية.</b> لا يُسأل أي طرف عن خسارة غير مباشرة أو تبعية. وتُحدَّد المسؤولية الإجمالية لكل طرف بإجمالي الرسوم المدفوعة أو المستحقة، عدا ما لا يمكن تحديده قانوناً. ومخرجات التقييم تُرشِد قرارات العميل ولا تحل محلها.</li>
    <li><b>المدة والإنهاء.</b> يجوز لأي طرف الإنهاء للراحة بإشعار خطي مدته 30 يوماً، أو فوراً عند إخلال جوهري غير مُعالَج من الطرف الآخر. وعند الإنهاء يدفع العميل مقابل العمل المنجز والمخرجات المكتملة حتى تاريخ الإنهاء.</li>
    <li><b>القوة القاهرة.</b> لا يُسأل أي طرف عن تأخر أو إخفاق بسبب أحداث خارجة عن سيطرته المعقولة، شريطة إخطار الطرف الآخر فوراً وتخفيف الأثر.</li>
    <li><b>عدم الاستقطاب.</b> خلال الارتباط ولستة أشهر بعده، لا يستقطب أي طرف للعمل موظفي الطرف الآخر المشاركين مباشرةً في تنفيذ هذا البرنامج.</li>
    <li><b>القانون الحاكم.</b> يخضع هذا العرض وأي ارتباط ناتج عنه لقوانين ${jurisdiction}، ويخضع الطرفان للاختصاص الحصري لمحاكمها، ما لم ينص بيان العمل الموقّع على خلاف ذلك.</li>
    <li><b>الاتفاق الكامل والأولوية.</b> يشكّل بيان العمل الموقّع، مع هذا العرض، الاتفاق الكامل للارتباط. وفي حال التعارض يسود بيان العمل الموقّع على هذا العرض.</li>
    ${
      isLicence && lic
        ? `<li><b>الأحجام الملتزمة وهامش الاستخدام.</b> يشمل الترخيص الأحجام السنوية الملتزمة المبينة في القسم ${NO("Commercial proposal")}، مع هامش استخدام بنسبة ${pc(lic.bufferPct)} دون رسوم إضافية. ويُحتسب الاستخدام الزائد عن الحجم الملتزم زائد الهامش ربع سنوياً بأثر رجعي بأسعار الوحدة المذكورة، ولا يُرحَّل الحجم غير المستخدم ما لم يُتفق على ذلك كتابةً.</li>
    <li><b>التجديد.</b> مدة الترخيص 12 شهراً قابلة للتجديد، بإشعار عدم تجديد مدته 60 يوماً.${lic.upliftPct ? ` وعند الاتفاق على مدة متعددة السنوات، تُقيَّد الزيادة السنوية في التكلفة المتكررة بنسبة لا تتجاوز ${pc(lic.upliftPct)} سنوياً.` : ""}</li>
    <li><b>الخروج وتصدير البيانات.</b> عند الإنهاء أو الانتهاء، تحصل ${esc(p.clientName)} على تصدير كامل لبياناتها بصيغ قياسية خلال 15 يوم عمل، يتبعه محو موثق وفق إجراءات الاحتفاظ لدى VIFM.</li>
    <li><b>أرصدة الخدمة.</b> تُعد أرصدة الخدمة المبينة في القسم ${NO("Service level & support")} التعويض الحصري للعميل عن أي إخفاق في تحقيق ضمان التوافر.</li>
    <li><b>الإيقاف.</b> يجوز لـ VIFM إيقاف الوصول عن المبالغ غير المتنازع عليها المتأخرة أكثر من 30 يوماً، بإشعار خطي مسبق مدته 10 أيام عمل.</li>`
        : ""
    }
  </ol>`)}

  ${inc("Definitions") ? `<h2>${at("Definitions")}</h2>
  ${secBody("Definitions", `<table>
    <thead><tr><th style="width:34%">المصطلح</th><th>المعنى في هذا العرض</th></tr></thead>
    <tbody>
      <tr><td><b>المشارك</b></td><td>فرد تدعوه ${esc(p.clientName)} لإكمال واحد أو أكثر من التقييمات المشمولة.</td></tr>
      <tr><td><b>الجلسة</b></td><td>إدارة واحدة مكتملة لأداة من مشارك واحد.</td></tr>
      <tr><td><b>الأداة</b></td><td>خدمة تقييم مسماة من VIFM لها منهجيتها الموثقة.</td></tr>
      <tr><td><b>النتيجة الاسترشادية</b></td><td>مخرج بمستوى تطويري دون درجة قطع رسمية؛ يُوسم كذلك وليس شهادة.</td></tr>
      <tr><td><b>الشهادة المعتمدة</b></td><td>مخرج يُصدر فقط عند تحقق درجة قطع موثقة؛ قابل للتحقق العلني عبر رابط التحقق.</td></tr>
      <tr><td><b>نافذة التقييم</b></td><td>الفترة المتفق عليها التي يكمل خلالها المشاركون جلساتهم.</td></tr>
      <tr><td><b>بيان العمل (SOW)</b></td><td>المستند الموقّع الذي يُفعِّل هذا العرض ويحكم الارتباط.</td></tr>
      ${
        isLicence && lic
          ? `<tr><td><b>الحجم الملتزم</b></td><td>أقصى استخدام سنوي لخدمة مشمولة في الترخيص، يُبيَّن بصيغة "حتى N سنوياً".</td></tr>
      <tr><td><b>هامش الاستخدام</b></td><td>نسبة ${pc(lic.bufferPct)} إضافية من كل حجم ملتزم، تُمنح دون رسوم قبل تطبيق الاستخدام الزائد.</td></tr>
      <tr><td><b>الاستخدام الزائد</b></td><td>الاستخدام الزائد عن الحجم الملتزم زائد الهامش، ويُحتسب ربع سنوياً بأثر رجعي بأسعار الوحدة.</td></tr>
      <tr><td><b>التكلفة المتكررة السنوية</b></td><td>الترخيص السنوي الملتزم زائد الدعم واتفاقية مستوى الخدمة (وأي رسوم سيادية سنوية) - الرسم السنوي المتكرر باستثناء التنفيذ لمرة واحدة.</td></tr>
      <tr><td><b>النشر السيادي</b></td><td>نسخة منصة مخصصة داخل الدولة لمقر البيانات، تضيف رسم إعداد لمرة واحدة ورسماً سنوياً.</td></tr>`
          : ""
      }
    </tbody>
  </table>`)}` : ""}

  <div class="accept">
    <h2 style="border-top:0;padding-top:0;">${at("Acceptance & next steps")}</h2>
    ${secBody("Acceptance & next steps", `<ul>
      <li><b><span dir="ltr">1.</span></b> تأكيد النطاق وأحجام المشاركين في القسم ${NO("Commercial proposal")} (أو طلب تعديلات - يُصدَر عرض مُنقَّح بالطريقة نفسها).</li>
      <li><b><span dir="ltr">2.</span></b> توقيع القبول أدناه${validUntil ? ` قبل تاريخ الصلاحية (${validUntil})` : ""}.</li>
      <li><b><span dir="ltr">3.</span></b> تُصدر VIFM بيان العمل مشيراً إلى <span dir="ltr">${ref}</span> للتوقيع.</li>
      <li><b><span dir="ltr">4.</span></b> يُجدوَل الانطلاق خلال خمسة أيام عمل من توقيع بيان العمل.</li>
    </ul>
    <p>يؤكد التوقيع أدناه قبول هذا العرض (المرجع <span dir="ltr">${ref}</span>) ويخوّل VIFM إعداد بيان العمل. ويبدأ الارتباط عند توقيع بيان العمل.</p>`)}
    <div class="sig-grid">
      <div class="sig">
        <h4>عن ${esc(p.clientName)}</h4>
        <div class="line"></div><div class="lbl">الاسم</div>
        <div class="line"></div><div class="lbl">المنصب</div>
        <div class="line"></div><div class="lbl">التوقيع</div>
        <div class="line"></div><div class="lbl">التاريخ</div>
      </div>
      <div class="sig">
        <h4>عن معهد فرجينيا للتمويل والإدارة</h4>
        <div class="line"></div><div class="lbl">الاسم</div>
        <div class="line"></div><div class="lbl">المنصب</div>
        <div class="line"></div><div class="lbl">التوقيع</div>
        <div class="line"></div><div class="lbl">التاريخ</div>
      </div>
    </div>
    <p class="scope-note" style="margin-top:14px;">للاستفسار عن هذا العرض: <span dir="ltr">info@viftraining.com</span> &middot; <span dir="ltr">viftraining.com</span></p>
  </div>

  ${
    inc("Sample reports")
      ? `<div class="accept">
    <h2 style="border-top:0;padding-top:0;">${at("Sample reports")}</h2>
    ${secBody("Sample reports", `${sampleReportsProseHtml}${sampleReportsBody}`)}
  </div>`
      : ""
  }

</body>
</html>`;
  return { html, sectionDefaults };
}
