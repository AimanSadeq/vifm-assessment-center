// Arabic (RTL) render of the proposal PDF - a full mirror of buildProposalHtml
// (proposal-html.ts) for `?language=ar`. Same structure, numbering, section
// selection, licence build-up and pricing modes; Arabic prose + RTL layout.
// Numbers/money/percentages are wrapped `dir="ltr"` so bidi keeps them readable
// inside the RTL flow. Arabic content is MSA, best-effort pending human review
// (project convention for Arabic translations).

import { formatMoney } from "./pricing";
import { computeLicensing, normalizeLicensingModel } from "./licensing";
import { resolveIncludedSections } from "./constants";
import { PORTAL_SERVICES, type CaliberService } from "@/lib/clients/portal-services";
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
  "Evidence & sample reports": "الأدلة ونماذج التقارير",
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

export function buildProposalHtmlAr(
  p: Proposal,
  opts?: { logoWhite?: string | null; logoColor?: string | null; evidence?: ProposalEvidence | null },
): string {
  const logoWhite = opts?.logoWhite ?? null;
  const logoColor = opts?.logoColor ?? null;
  const evidence = opts?.evidence ?? null;
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

  const isLicence = p.pricingMode === "licence";
  const lic = isLicence ? computeLicensing(normalizeLicensingModel(p.licensingModel)) : null;

  const scopeWithSeats = p.scope.filter((s) => (s.seats ?? 0) > 0);
  const totalParticipants = scopeWithSeats.reduce((n, s) => n + (s.seats ?? 0), 0);
  const serviceLabelsAr = scopeWithSeats.map((s) => serviceLabelAr(s.service, s.label));
  const serviceListAr =
    serviceLabelsAr.length <= 1 ? serviceLabelsAr.join("") : `${serviceLabelsAr.slice(0, -1).join("، ")} و${serviceLabelsAr[serviceLabelsAr.length - 1]}`;

  const jurisdiction = p.clientRegion === "saudi" ? "المملكة العربية السعودية" : "دولة الإمارات العربية المتحدة";
  const sectorPhrase =
    p.clientSector === "government" ? "جهة حكومية" : p.clientSector === "banking" ? "مؤسسة مصرفية ومالية" : "مؤسسة";

  // ── Proposed solution: per-service block. ──
  const technical = scopeWithSeats
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
      <tr class="total-row"><td class="tot-label">استثمار السنة الأولى (${esc(cur)})</td><td class="num">${m(lic.year1Subtotal)}</td></tr>
    </tbody>
  </table>
  <p class="scope-note"><strong>نمط النشر:</strong> ${lic.isSovereign ? "سيادي &ndash; نسخة مخصصة داخل الدولة لضمان مقر البيانات" : "سحابة مشتركة"}.</p>
  ${lic.hasBuffer ? `<p class="scope-note">تشمل الأحجام السنوية الملتزمة هامش استخدام بنسبة ${pc(lic.bufferPct)} دون رسوم إضافية. ويُحتسب الاستخدام الزائد عن الحجم الملتزم زائد الهامش ربع سنوياً بأثر رجعي بأسعار الوحدة المذكورة.</p>` : ""}
  <h3>العرض متعدد السنوات</h3>
  <table>
    <thead><tr><th>الفترة</th><th class="num">القيمة</th></tr></thead>
    <tbody>
      <tr><td>السنة الأولى (استثمار)</td><td class="num">${m(lic.year1Subtotal)}</td></tr>
      <tr><td>السنة الثانية${lic.upliftPct ? ` (متكرر +${pc(lic.upliftPct)})` : " (متكرر)"}</td><td class="num">${m(lic.year2Recurring)}</td></tr>
      <tr><td>السنة الثالثة (متكرر)</td><td class="num">${m(lic.year3Recurring)}</td></tr>
      <tr class="total-row"><td>إجمالي كلفة التملك لثلاث سنوات</td><td class="num">${m(lic.tco3)}</td></tr>
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
    .map((l) => `<tr><td>${esc(serviceLabelAr(l.service, l.label))}</td><td class="num">${nu(l.seats)}</td><td class="num">${m(l.unitRate)}</td><td class="num">${m(l.subtotal)}</td></tr>`)
    .join("");
  const discount = Math.round((p.subtotal - p.total) * 100) / 100;
  const discountRow = discount > 0 ? `<tr><td colspan="3" class="tot-label">خصم (${pc(p.discountPct)})</td><td class="num">- ${m(discount)}</td></tr>` : "";

  const intro =
    p.introNote?.trim() ||
    (isLicence
      ? `يسعدنا أن نقدم هذا العرض للحصول على ترخيص سنوي شامل لمنصة VIFM Caliber&reg; للذكاء في المواهب لصالح ${esc(p.clientName)}، بما يجمع ${serviceListAr || "خدمات الذكاء في المواهب من VIFM"} ضمن رحلة مرشح واحدة، ووحدة تحكم إدارية واحدة، وتقارير موحدة ثنائية اللغة. والنموذج التجاري هو ترخيص سنوي ملتزم؛ ويرد أدناه المنهج الفني وخطة التنفيذ والتفصيل الكامل لبناء الترخيص.`
      : `يسعدنا أن نقدم هذا العرض لتفعيل ${serviceListAr || "خدمات الذكاء في المواهب من VIFM"} لصالح ${esc(p.clientName)}، بما يغطي ${nu(totalParticipants)} مشاركاً. ويُقدَّم البرنامج عبر منصة VIFM Caliber&reg; للذكاء في المواهب، ويرد أدناه المنهج الفني وخطة التنفيذ والتفصيل التجاري.`);

  const validUntil = p.validUntil ? fmtDateAr(p.validUntil) : null;

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

  // ── Live evidence rows (Arabic). ──
  const evRows: string[] = [];
  if (evidence) {
    if (evidence.logica && (evidence.logica.alpha || evidence.logica.approved)) {
      const a = evidence.logica.alpha;
      evRows.push(
        `<li><b>الاستدلال المعرفي (Logica&reg;)</b> - ${a != null ? `ثبات الاتساق الداخلي (ألفا كرونباخ) حالياً <span dir="ltr">${a.toFixed(2)}</span> عبر ` : "حالياً "}${nu(evidence.logica.approved)} بنداً معتمداً على البنك الفعّال.</li>`,
      );
    }
    if (evidence.fluent && (evidence.fluent.calibrated || evidence.fluent.humanRatings)) {
      evRows.push(
        `<li><b>تحديد مستوى الإنجليزية (Fluent&reg;)</b> - ${nu(evidence.fluent.calibrated)} بنداً معايَراً مع ${nu(evidence.fluent.humanRatings)} تقييماً بشرياً لمراقبة توافق الذكاء الاصطناعي مع البشر.</li>`,
      );
    }
    if (evidence.technical && (evidence.technical.approved || evidence.technical.cutScores)) {
      evRows.push(
        `<li><b>الشهادة الفنية (Techno&reg;)</b> - ${nu(evidence.technical.approved)} بنداً معتمداً من الخبراء عبر ${nu(evidence.technical.cutScores)} درجة قطع موثقة.</li>`,
      );
    }
    if (evidence.arc && (evidence.arc.verified || evidence.arc.total)) {
      evRows.push(
        `<li><b>الجاهزية للذكاء الاصطناعي (AR COMPASS&reg;)</b> - ${nu(evidence.arc.verified)} من ${nu(evidence.arc.total)} سؤالاً خضعت للمراجعة البشرية.</li>`,
      );
    }
    if (evidence.reflect && (evidence.reflect.competencies || evidence.reflect.responses)) {
      evRows.push(
        `<li><b>التقييم القيادي 360 (Reflect 360&reg;)</b> - ${nu(evidence.reflect.competencies)} كفاءة و${nu(evidence.reflect.behaviors)} سلوكاً في الإطار المعتمد.</li>`,
      );
    }
  }
  const psyLive = evRows.length
    ? `<p class="scope-note" style="margin-top:8px;"><strong>الأدلة الحالية للمنصة</strong> (أرقام فعلية وقت إعداد هذا العرض، وتزداد قوة مع نمو أحجام الاستجابة):</p>
  <ul>
    ${evRows.join("\n    ")}
  </ul>`
    : "";

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link href="${AR_FONT_HREF}" rel="stylesheet" />
<style>
  @page { size: A4; margin: 16mm 15mm 20mm; }
  * { box-sizing: border-box; }
  body { font-family: "Noto Naskh Arabic", "Segoe UI", Tahoma, serif; direction: rtl; color: #111232; font-size: 11pt; line-height: 1.7; margin: 0; }

  .cover { background: #010131; color: #fff; border-radius: 10px; padding: 26mm 20mm; height: 250mm; display: flex; flex-direction: column; justify-content: space-between; page-break-after: always; }
  .cover .logo { height: 16mm; width: auto; display: block; margin-bottom: 16mm; }
  .cover .eyebrow { color: #93b8e6; font-size: 9pt; font-weight: 700; letter-spacing: .04em; }
  h1 { color: #010131; font-size: 22pt; margin: 8px 0 6px; line-height: 1.3; }
  .cover h1 { color: #fff; font-size: 26pt; line-height: 1.35; margin: 10px 0 0; border: 0; padding: 0; }
  .cover .accent { width: 64px; height: 4px; background: #5391D5; margin-top: 16px; }
  .cover .grid { display: flex; flex-wrap: wrap; gap: 10px 40px; margin-top: 26px; font-size: 10pt; }
  .cover .grid b { display: block; color: #93b8e6; font-size: 8pt; font-weight: 700; margin-bottom: 2px; }
  .cover .conf { color: rgba(255,255,255,.65); font-size: 8.5pt; line-height: 1.75; border-top: 1px solid rgba(255,255,255,.18); padding-top: 12px; }

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

  <div class="cover">
    <div>
      ${logoWhite ? `<img class="logo" src="${logoWhite}" alt="VIFM" />` : ""}
      <div class="eyebrow">VIFM Caliber&reg; &middot; عرض الذكاء في المواهب</div>
      <h1>${esc(p.title)}</h1>
      <div class="accent"></div>
      <div class="grid">
        <div><b>مُعدّ لصالح</b>${esc(p.clientName)}${p.contactName ? `<br/>${esc(p.contactName)}` : ""}${p.contactEmail ? `<br/><span dir="ltr">${esc(p.contactEmail)}</span>` : ""}</div>
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
  <p>${intro}</p>
  <div style="display:flex;gap:10px;margin:12px 0 4px;">
    <div style="flex:1;border:1px solid #e2e8f0;border-top:3px solid #5391D5;border-radius:6px;padding:8px 10px;"><b style="display:block;color:#010131;font-size:13pt;">${isLicence && lic ? m(lic.annualRecurring) : nu(totalParticipants)}</b><span style="color:#64748b;font-size:8.5pt;">${isLicence && lic ? "التكلفة المتكررة السنوية" : "المشاركون"}</span></div>
    <div style="flex:1;border:1px solid #e2e8f0;border-top:3px solid #5391D5;border-radius:6px;padding:8px 10px;"><b style="display:block;color:#010131;font-size:13pt;">${isLicence && lic ? m(lic.year1Subtotal) : m(p.total)}</b><span style="color:#64748b;font-size:8.5pt;">${isLicence && lic ? "استثمار السنة الأولى" : "إجمالي الاستثمار"}</span></div>
    ${validUntil ? `<div style="flex:1;border:1px solid #e2e8f0;border-top:3px solid #5391D5;border-radius:6px;padding:8px 10px;"><b style="display:block;color:#010131;font-size:12pt;">${validUntil}</b><span style="color:#64748b;font-size:8.5pt;">صلاحية العرض</span></div>` : ""}
  </div>
  ${roiHtml}

  <h2>${at("About VIFM")}</h2>
  <p>معهد فرجينيا للتمويل والإدارة (VIFM) معهد للتمويل والإدارة يخدم منطقة الخليج، ويجمع بين التدريب المهني ومنصة ذكاء مواهب مبنية لهذا الغرض هي VIFM Caliber&reg;. توفر المنصة تقييماً منظماً ثنائي اللغة (عربي/إنجليزي) عبر دورة حياة المواهب كاملة - من الفرز قبل التوظيف والشهادات الفنية إلى تحليل السلوك والقدرات المعرفية وتحديد مستوى الإنجليزية والتقييم القيادي 360 والجاهزية المؤسسية للذكاء الاصطناعي.</p>
  <p>كل أداة مبنية على منهجية موثقة، وتُدار بشكل آمن (مفاتيح إجابات محفوظة على الخادم وعشوائية لكل إدارة)، وتنتج مخرجات قابلة للمراجعة والدفاع عنها. وحيثما يسهم الذكاء الاصطناعي في التقييم فإنه يعمل تحت إشراف بشري موثق؛ وحيثما تُصدر شهادات فإنها قابلة للتحقق العلني.</p>

  <h2>${at("Understanding of your requirements")}</h2>
  <p>${esc(p.clientName)} ${sectorPhrase}${p.clientRegion ? ` تعمل في ${jurisdiction}` : ""} وتسعى إلى رؤية منظمة وقابلة للدفاع عنها لقدرات ${nu(totalParticipants)} مشاركاً من خلال ${serviceListAr}. ويُتوقع أن ينتج البرنامج تقارير فردية لأغراض التطوير ودعم القرار، إلى جانب تحليلات على مستوى المجموعة للفريق الراعي.</p>
  <p>يعالج الحل المبيّن أدناه هذه المتطلبات بأدوات ثنائية اللغة حيثما يتطلب الجمهور ذلك، وقابلة للتدقيق من طرف إلى طرف، ومتوائمة مع متطلبات حماية البيانات السارية في ${jurisdiction}. وأي تعديل للنطاق يُتفق عليه عند الانطلاق يُوثَّق في بيان العمل.</p>

  <h2>${at("Proposed solution & technical approach")}</h2>
  ${committedScope}${technical || "<p>لم يتم اختيار خدمات.</p>"}

  ${inc("Psychometric foundations") ? `<h2>${at("Psychometric foundations")}</h2>
  <p>تقوم الأدوات المقترحة على أسس قياس موثقة لا على مجموعات أسئلة عشوائية:</p>
  <ul>
    <li><b>عمود فقري موحد للكفاءات</b> - يرتبط القياس السلوكي بإطار VIFM المكوّن من 41 كفاءة، فتصف نتائج الأدوات المختلفة الأشخاص بلغة واحدة مشتركة.</li>
    <li><b>مقاييس معتمدة</b> - تستخدم التقييمات السلوكية مقاييس مرجعية محددة؛ ويرتبط تحديد مستوى الإنجليزية بالإطار الأوروبي المرجعي CEFR (من A1 إلى C2).</li>
    <li><b>بنوك بنود منسّقة</b> - تُصاغ البنود وتُراجع من الخبراء وتُصدر بإصدارات؛ ويُعاد ترتيب الخيارات عشوائياً لكل إدارة لحماية سلامة البنود.</li>
    <li><b>ضمانات جودة الاستجابة</b> - حيثما يقتضي المفهوم، تحمل الأدوات فحوص تشويه واتساق تُعرض على الاستشاري المراجع بدلاً من احتسابها تلقائياً بصمت.</li>
    <li><b>مراقبة الثبات</b> - تُتابع إحصاءات الاتساق الداخلي مع نمو أحجام الاستجابة، ولا يُفعّل التقرير المرجعي المعياري إلا عندما تكون العينة كافية.</li>
    <li><b>طبقات إبلاغ صادقة</b> - تُوسم كل نتيجة صراحةً بأنها استرشادية أو معتمدة؛ ولا توجد النتائج المعتمدة إلا حيث تقف خلفها درجة قطع موثقة وعملية مراجعة.</li>
  </ul>
  ${psyLive}` : ""}

  ${inc("Methodology & quality standards") ? `<h2>${at("Methodology & quality standards")}</h2>
  <ul>
    <li><b>منهجية موثقة لكل أداة</b> - تُرفق كل أداة بموجز منهجية منشور يغطي المفهوم ونموذج التقييم والحدود الصادقة، ويرافق هذا العرض عند الطلب.</li>
    <li><b>توافق مع الإرشادات المعتمدة</b> - يتوائم تصميم البرنامج مع معيار ISO 10667، ومع الإرشادات الدولية لعمليات مراكز التقييم في أعمال مراكز التقييم.</li>
    <li><b>إدارة آمنة</b> - تُحفظ مفاتيح الإجابات على الخادم ولا تصل إلى متصفح المشارك؛ والتصحيح يتم على الخادم؛ والجلسات تُستخدم مرة واحدة.</li>
    <li><b>إشراف بشري على تقييم الذكاء الاصطناعي</b> - حيثما يسهم الذكاء الاصطناعي، تُعاير المخرجات ويحتفظ شخص مؤهل بصلاحية المراجعة؛ ولا يكون أي قرار آلي نهائياً.</li>
    <li><b>تقديم ثنائي اللغة</b> - تتوفر تجارب المشاركين بالإنجليزية والعربية (مع الاتجاه من اليمين إلى اليسار) حيثما شُمل ذلك في النطاق.</li>
  </ul>` : ""}

  ${inc("Platform, integration & security") ? `<h2>${at("Platform, integration & security")}</h2>
  <ul>
    <li><b>منصة التقديم</b> - يعمل البرنامج على VIFM Caliber&reg;، وهي منصة سحابية لا تتطلب أي تثبيت لدى العميل؛ وينضم المشاركون عبر روابط دعوة شخصية على أي متصفح حديث.</li>
    <li><b>وضوح البرنامج</b> - يتلقى الفريق الراعي متابعة إنجاز مباشرة خلال نافذة التقييم، مع إدارة التذكيرات من قِبل VIFM.</li>
    <li><b>مخرجات قابلة للتحقق</b> - تحمل الشهادات المعتمدة رابط تحقق علنياً، فيمكن لأي طرف ثالث تأكيد صحتها دون التواصل مع VIFM.</li>
    <li><b>قابلية نقل البيانات</b> - تُصدَّر النتائج بصيغ قياسية (CSV / JSON) لأنظمة الموارد البشرية أو التتبع لدى العميل؛ وتُسلَّم التقارير الفردية بصيغة PDF.</li>
    <li><b>التكامل</b> - يمكن تحديد نطاق الدخول الموحد أو التكامل الأعمق مع الأنظمة في بيان العمل عند الحاجة.</li>
    <li><b>الوضع الأمني</b> - تشفير أثناء النقل والتخزين، ووصول قائم على الأدوار بضوابط على مستوى الصف، ومنطق تصحيح لا يصل إلى جهاز المشارك (انظر القسم ${NO("Data protection & privacy")}).</li>
  </ul>` : ""}

  ${inc("Implementation plan") ? `<h2>${at("Implementation plan")}</h2>
  <p class="scope-note">خطة استرشادية لمجموعة بهذا الحجم؛ ويُتفق على الجدول النهائي عند الانطلاق ويُوثَّق في بيان العمل.</p>
  <table>
    <thead><tr><th>المرحلة</th><th>التوقيت الاسترشادي</th><th>الأنشطة الرئيسية</th><th>المخرجات</th></tr></thead>
    <tbody>
      <tr><td><b>1 &middot; التعبئة</b></td><td>الأسبوع 1</td><td>الانطلاق، تأكيد نقطة اتصال واحدة، استلام قائمة المشاركين، تأكيد النطاق واللغات</td><td>جدول متفق عليه؛ حزمة تواصل</td></tr>
      <tr><td><b>2 &middot; الإعداد</b></td><td>الأسبوع 2</td><td>تهيئة البرنامج على المنصة، تجهيز الدعوات، تشغيل تجريبي لمجموعة صغيرة</td><td>إعداد مُتحقَّق؛ اعتماد التجربة</td></tr>
      <tr><td><b>3 &middot; نافذة التقييم</b></td><td>الأسابيع 3-5</td><td>إرسال الدعوات على دفعات، متابعة الإنجاز، إدارة التذكيرات، دعم المشاركين</td><td>لوحة إنجاز؛ تقارير حالة دورية</td></tr>
      <tr><td><b>4 &middot; الإبلاغ والإحاطة</b></td><td>الأسبوع 6</td><td>إصدار التقارير الفردية، تجميع تحليلات المجموعة، جلسة إحاطة للراعي</td><td>حزمة المخرجات الكاملة؛ الإحاطة والتوصيات</td></tr>
    </tbody>
  </table>` : ""}

  <h2>${at("Project governance & team")}</h2>
  <ul>
    <li><b>قائد الارتباط (VIFM)</b> - مالك واحد مسؤول عن التنفيذ والجوانب التجارية والتصعيد.</li>
    <li><b>منسق التقديم (VIFM)</b> - يدير الدعوات ومتابعة الإنجاز ودعم المشاركين طوال نافذة التقييم.</li>
    <li><b>الإشراف على التقييم والقياس النفسي (VIFM)</b> - يملك سلامة الأدوات وجودة التقييم ومراجعة أي إدارة مُعلَّمة.</li>
    <li><b>نقطة الاتصال الواحدة لدى العميل</b> - تسمّي ${esc(p.clientName)} منسقاً واحداً يملك قائمة المشاركين والتواصل الداخلي وقرارات الجدولة.</li>
    <li><b>الإيقاع</b> - حالة مكتوبة أسبوعياً خلال نافذة التقييم، مع مسار تصعيد ثابت إلى قائد الارتباط وإحاطة ختامية عند التسليم.</li>
  </ul>

  <h2>${at("Data protection & privacy")}</h2>
  <ul>
    <li>تُعالَج بيانات التقييم وفقاً لقوانين حماية البيانات السارية: المرسوم بقانون اتحادي إماراتي رقم 45 لسنة 2021، ونظام حماية البيانات الشخصية السعودي، واللائحة الأوروبية العامة لحماية البيانات حيثما انطبق.</li>
    <li>تُؤخذ موافقة المشارك قبل جمع أي بيانات تقييم؛ وتحمل سجلات المشاركة أثراً تدقيقياً.</li>
    <li>تُشفَّر البيانات أثناء النقل والتخزين؛ والوصول قائم على الأدوار ومحصور بما يتطلبه كل دور؛ ولا تصل مفاتيح الإجابات ومنطق التصحيح إلى جهاز المشارك.</li>
    <li>تُحتفظ البيانات الشخصية لمدة أقصاها 24 شهراً ما لم يُمدَّد ذلك تعاقدياً، ثم تُمحى وفق إجراءات الاحتفاظ لدى VIFM.</li>
    <li>تُتاح النتائج الفردية فقط للمستلمين المخوّلين لدى المؤسسة الراعية؛ وتحمي حدود إخفاء الهوية المساهمين في التقييم متعدد المصادر.</li>
  </ul>

  ${inc("AI governance & standards") ? `<h2>${at("AI governance & standards")}</h2>
  <ul>
    <li><b>الإنسان في الحلقة بالتصميم</b> - يساعد الذكاء الاصطناعي في صياغة البنود والنسخ والتقييم المبدئي؛ ويحتفظ شخص مؤهل بصلاحية المراجعة على أي مخرج يؤثر في مشارك، ولا يُؤتمت أي قرار توظيف أو ترقية.</li>
    <li><b>الشفافية</b> - يوضّح موجز منهجية كل أداة أين يسهم الذكاء الاصطناعي وأين لا يسهم، بما يمكّن العميل من إثبات التزاماته الحوكمية.</li>
    <li><b>المعايرة</b> - تُعاير المهام الإنتاجية المُقيَّمة بالذكاء الاصطناعي (كالكتابة والتحدث) مقابل تقييمات بشرية، مع مراقبة التوافق عبر الزمن.</li>
    <li><b>لا رفض تلقائي</b> - المركّبات الفرزية إشارات استرشادية؛ ويبقى القرار لدى مراجعي العميل، وتقول التقارير ذلك صراحةً.</li>
    <li><b>التوافق الإقليمي</b> - صُمم النهج ليكون قابلاً للدفاع عنه في ظل التوقعات الناشئة لحوكمة الذكاء الاصطناعي في الخليج${p.clientRegion === "saudi" ? "، بما في ذلك الإرشادات السارية في المملكة العربية السعودية" : ""}.</li>
  </ul>` : ""}

  <h2>${at("Service level & support")}</h2>
  <ul>
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
  }

  ${inc("Relevant experience") ? `<h2>${at("Relevant experience")}</h2>
  <p>تقدّم VIFM برامج تقييم وتطوير لمؤسسات مصرفية وحكومية وشركات عبر منطقة الخليج. وتحمل منصة Caliber سبع عائلات من الأدوات تمتد من استقطاب المواهب إلى تطويرها - تحليل السلوك، والقدرات المعرفية، والشهادات الفنية، وتحديد مستوى الإنجليزية، والفرز قبل التوظيف، والتقييم القيادي 360، والجاهزية المؤسسية للذكاء الاصطناعي - تُقدَّم ثنائية اللغة كمعيار.</p>
  <p>تتوفر مراجع العملاء وملخصات حالات مجهّلة ذات صلة بهذا الارتباط عند الطلب، بما يخضع لالتزامات السرية التي نقدمها لكل عميل - وهي ذات الالتزامات التي يقدمها هذا العرض لـ ${esc(p.clientName)}.</p>` : ""}

  <h2>${at("Commercial proposal")}</h2>
  ${
    isLicence && lic
      ? `<p>النموذج التجاري هو <strong>ترخيص سنوي شامل ملتزم</strong> لمنصة Caliber: تُسعَّر الخدمات المختارة إفرادياً حسب الحجم، ثم تُجمَّع بخصم الترخيص الملتزم. ويُدرج الدعم واتفاقية مستوى الخدمة كنسبة من الترخيص، ويغطي التنفيذ لمرة واحدة الإعداد والتهيئة والتكامل والتدريب.</p>
  ${licenceCommercial}`
      : `<table>
    <thead><tr><th>الخدمة</th><th class="num">المشاركون</th><th class="num">السعر / مشارك</th><th class="num">الإجمالي الفرعي</th></tr></thead>
    <tbody>
      ${lineRows}
      <tr><td colspan="3" class="tot-label">الإجمالي الفرعي</td><td class="num">${m(p.subtotal)}</td></tr>
      ${discountRow}
      <tr class="total-row"><td colspan="3" class="tot-label">الإجمالي (${esc(cur)})</td><td class="num">${m(p.total)}</td></tr>
    </tbody>
  </table>`
  }
  ${validUntil ? `<p class="scope-note">هذا العرض صالح حتى <strong>${validUntil}</strong>. والرسوم مذكورة بعملة ${esc(cur)} ولا تشمل أي ضرائب سارية تُضاف بالسعر المعمول به عند الاقتضاء.</p>` : `<p class="scope-note">الرسوم مذكورة بعملة ${esc(cur)} ولا تشمل أي ضرائب سارية تُضاف بالسعر المعمول به عند الاقتضاء.</p>`}
  ${p.paymentTerms ? `<h3>شروط الدفع</h3><p>${esc(p.paymentTerms)}</p>` : ""}

  ${inc("Assumptions & exclusions") ? `<h2>${at("Assumptions & exclusions")}</h2>
  <ul>
    <li>تقدّم ${esc(p.clientName)} قائمة مشاركين كاملة ودقيقة (الأسماء والبريد الإلكتروني) قبل فتح نافذة التقييم، وتسمّي نقطة اتصال واحدة مخوّلة باتخاذ قرارات الجدولة.</li>
    <li>يتوفر للمشاركين جهاز مناسب واتصال بالإنترنت؛ وتُكمَل التقييمات عن بُعد ما لم يُتفق على خلاف ذلك كتابةً.</li>
    <li>الأحجام كما ذُكرت؛ وتُعالَج أي تغييرات جوهرية في الأحجام أو النطاق أو اللغات بطلب تغيير كتابي وقد تعدّل الرسوم والجدول.</li>
    <li>يفترض الجدول الاسترشادي إصدار مراسلات العميل ضمن النوافذ المتفق عليها؛ وأي تأخر في تعبئة المشاركين يمدّد الجدول لا السعر.</li>
    <li>لا يشكّل هذا العرض عقداً؛ ويبدأ الارتباط عند توقيع بيان عمل يشير إلى هذا العرض.</li>
  </ul>` : ""}

  <h2>${at("Terms & conditions")}</h2>
  ${p.terms ? `<div class="terms-box">${esc(p.terms)}</div>` : ""}
  <ol class="clauses">
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
  </ol>

  ${inc("Definitions") ? `<h2>${at("Definitions")}</h2>
  <table>
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
  </table>` : ""}

  <div class="accept">
    <h2 style="border-top:0;padding-top:0;">${at("Acceptance & next steps")}</h2>
    <ul>
      <li><b><span dir="ltr">1.</span></b> تأكيد النطاق وأحجام المشاركين في القسم ${NO("Commercial proposal")} (أو طلب تعديلات - يُصدَر عرض مُنقَّح بالطريقة نفسها).</li>
      <li><b><span dir="ltr">2.</span></b> توقيع القبول أدناه${validUntil ? ` قبل تاريخ الصلاحية (${validUntil})` : ""}.</li>
      <li><b><span dir="ltr">3.</span></b> تُصدر VIFM بيان العمل مشيراً إلى <span dir="ltr">${ref}</span> للتوقيع.</li>
      <li><b><span dir="ltr">4.</span></b> يُجدوَل الانطلاق خلال خمسة أيام عمل من توقيع بيان العمل.</li>
    </ul>
    <p>يؤكد التوقيع أدناه قبول هذا العرض (المرجع <span dir="ltr">${ref}</span>) ويخوّل VIFM إعداد بيان العمل. ويبدأ الارتباط عند توقيع بيان العمل.</p>
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
    inc("Evidence & sample reports")
      ? `<div class="accept">
    <h2 style="border-top:0;padding-top:0;">${at("Evidence & sample reports")}</h2>
    <p>كل أداة في هذا العرض مدعومة بموجز منهجية موثق وأثر أدلة قابل للتدقيق. والأرقام أدناه لقطة حية للأدلة القياسية الحالية للمنصة، أُدرجت لتمكين ${esc(p.clientName)} من إثبات التزاماتها في الضمان والحوكمة. وتتوفر نماذج تقارير مجهّلة لكل خدمة عند الطلب.</p>
    ${
      evRows.length
        ? `<table>
      <thead><tr><th style="width:34%">الأداة</th><th>الأدلة القياسية الحالية</th></tr></thead>
      <tbody>
        ${evRows.map((r) => r.replace(/^<li>/, '<tr><td colspan="2">').replace(/<\/li>$/, "</td></tr>")).join("\n        ")}
      </tbody>
    </table>
    <p class="scope-note">تزداد إحصاءات الثبات والمعايرة قوةً مع نمو أحجام الاستجابة، ولا يُفعَّل التقرير المرجعي المعياري إلا عند كفاية عينة المقياس.</p>`
        : `<p class="scope-note">تتوفر تفاصيل الثبات والمعايرة والصدق لكل أداة في موجزات المنهجية المنشورة، وتُقدَّم عند الطلب.</p>`
    }
  </div>`
      : ""
  }

</body>
</html>`;
}
