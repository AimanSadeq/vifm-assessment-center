import type { EngagementTechProgram } from "@/lib/competencies/engagement-tech-program";

export type TechCohortReportData = {
  engagementName: string;
  orgName: string | null;
  program: EngagementTechProgram;
  generatedAt: Date;
};

type Lang = "en" | "ar";

const L: Record<Lang, Record<string, string>> = {
  en: {
    brand: "Virginia Institute of Finance and Management",
    title: "Technical Certification — Cohort Report",
    organization: "Organization",
    engagement: "Engagement",
    generated: "Generated",
    summary: "Programme summary",
    domainsInScope: "Domains in scope",
    candidates: "Candidates",
    certifiedTotal: "Certifications issued",
    perDomain: "By domain",
    thDomain: "Domain",
    thStandard: "Standard",
    thTaken: "Taken",
    thCertified: "Certified",
    thPassRate: "Pass rate",
    certifiable: "Certifiable",
    indicativeOnly: "Indicative only",
    roster: "Certified roster",
    thCandidate: "Candidate",
    thLevel: "Level",
    thCredential: "Credential",
    rosterEmpty: "No certifications issued yet.",
    noScope: "No domains are in scope for this engagement yet.",
    confidential: "Confidential — for VIFM and the engaged client only.",
    indicativeCaption: "Indicative only — bank below the certification floor; no credentials are issued for this domain.",
  },
  ar: {
    brand: "معهد فرجينيا للتمويل والإدارة",
    title: "الاعتماد التقني — تقرير المجموعة",
    organization: "المؤسسة",
    engagement: "المشروع",
    generated: "تاريخ الإصدار",
    summary: "ملخص البرنامج",
    domainsInScope: "المجالات ضمن النطاق",
    candidates: "المرشحون",
    certifiedTotal: "الاعتمادات الصادرة",
    perDomain: "حسب المجال",
    thDomain: "المجال",
    thStandard: "المعيار",
    thTaken: "أدّوا",
    thCertified: "معتمدون",
    thPassRate: "نسبة النجاح",
    certifiable: "قابل للاعتماد",
    indicativeOnly: "استرشادي فقط",
    roster: "كشف المعتمدين",
    thCandidate: "المرشح",
    thLevel: "المستوى",
    thCredential: "الاعتماد",
    rosterEmpty: "لم تُصدَر أي اعتمادات بعد.",
    noScope: "لا توجد مجالات ضمن نطاق هذا المشروع بعد.",
    confidential: "سري — لمعهد VIFM والعميل المتعاقد فقط.",
    indicativeCaption: "استرشادي فقط — البنك دون حد الاعتماد؛ لا تُصدَر اعتمادات لهذا المجال.",
  },
};

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function renderTechCohortHtml(data: TechCohortReportData, lang: Lang): string {
  const t = L[lang];
  const rtl = lang === "ar";
  const { program } = data;

  const certifiedFor = (domainKey: string) =>
    program.candidates.filter((c) => c.perDomain[domainKey]?.certified && c.perDomain[domainKey]?.passedCut).length;
  const takenFor = (domainKey: string) =>
    program.candidates.filter((c) => c.perDomain[domainKey]?.taken).length;

  const totalCertified = program.inScope.reduce((sum, d) => sum + certifiedFor(d.key), 0);

  const dateStr = data.generatedAt.toLocaleDateString(lang === "ar" ? "ar" : "en-GB", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Per-domain stats table
  const domainRows = program.inScope
    .map((d) => {
      const taken = takenFor(d.key);
      const certified = certifiedFor(d.key);
      const rate = taken > 0 ? Math.round((certified / taken) * 100) : 0;
      const badge = d.certifiable
        ? `<span class="badge ok">${t.certifiable}</span>`
        : `<span class="badge warn">${t.indicativeOnly}</span>`;
      return `<tr>
        <td class="strong">${esc(d.name)}</td>
        <td>${badge}</td>
        <td class="num">${taken} / ${program.candidates.length}</td>
        <td class="num">${certified}</td>
        <td class="num">${d.certifiable ? `${rate}%` : "—"}</td>
      </tr>`;
    })
    .join("");

  // Certified roster
  const rosterRows: string[] = [];
  for (const d of program.inScope) {
    for (const c of program.candidates) {
      const s = c.perDomain[d.key];
      if (s?.certified && s.passedCut) {
        rosterRows.push(`<tr>
          <td class="strong">${esc(c.name)}</td>
          <td>${esc(d.name)}</td>
          <td class="num">${s.level ?? "—"}/5${s.levelLabel ? ` · ${esc(s.levelLabel)}` : ""}</td>
          <td class="mono">${s.credentialCode ? esc(s.credentialCode) : "—"}</td>
        </tr>`);
      }
    }
  }

  // Indicative-only caption (when any in-scope domain can't certify)
  const anyIndicative = program.inScope.some((d) => !d.certifiable);

  return `<!doctype html>
<html lang="${lang}" dir="${rtl ? "rtl" : "ltr"}">
<head>
<meta charset="utf-8" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&family=Open+Sans:wght@400;600;700&display=swap" rel="stylesheet" />
<style>
  @page { size: A4; margin: 18mm 14mm; }
  * { box-sizing: border-box; }
  body {
    font-family: ${rtl ? "'Cairo'," : ""} 'Open Sans', 'Segoe UI', Tahoma, sans-serif;
    color: #111232; margin: 0; font-size: 12px; line-height: 1.5;
  }
  .head { border-bottom: 3px solid #010131; padding-bottom: 10px; margin-bottom: 18px; }
  .brand { color: #5391D5; font-size: 11px; font-weight: 600; letter-spacing: .04em; }
  h1 { font-size: 20px; margin: 4px 0 2px; color: #010131; }
  .meta { color: #555; font-size: 11px; }
  .stats { display: flex; gap: 10px; margin: 16px 0 22px; }
  .stat { flex: 1; border: 1px solid #e3e6ee; border-radius: 8px; padding: 10px 12px; }
  .stat .v { font-size: 22px; font-weight: 700; color: #010131; }
  .stat .l { font-size: 10px; text-transform: uppercase; letter-spacing: .06em; color: #777; margin-top: 2px; }
  h2 { font-size: 13px; color: #010131; margin: 22px 0 8px; border-${rtl ? "right" : "left"}: 3px solid #5391D5; padding-${rtl ? "right" : "left"}: 8px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: ${rtl ? "right" : "left"}; padding: 7px 8px; border-bottom: 1px solid #eceef4; font-size: 11px; }
  th { background: #f6f8fc; color: #444; font-weight: 600; text-transform: uppercase; font-size: 9.5px; letter-spacing: .04em; }
  td.num, th.num { text-align: center; font-variant-numeric: tabular-nums; }
  td.strong { font-weight: 600; color: #010131; }
  td.mono { font-family: 'Courier New', monospace; font-size: 9.5px; color: #555; }
  .badge { display: inline-block; border-radius: 999px; padding: 1px 8px; font-size: 9px; font-weight: 600; }
  .badge.ok { background: #d1fae5; color: #065f46; }
  .badge.warn { background: #fef3c7; color: #92400e; }
  .caption { font-size: 10px; color: #92400e; background: #fffbeb; border: 1px solid #fde68a; border-radius: 6px; padding: 6px 9px; margin-top: 8px; }
  .empty { color: #888; font-size: 11px; padding: 8px 0; }
  .foot { margin-top: 26px; border-top: 1px solid #e3e6ee; padding-top: 8px; color: #888; font-size: 9.5px; display: flex; justify-content: space-between; }
</style>
</head>
<body>
  <div class="head">
    <div class="brand">${t.brand}</div>
    <h1>${t.title}</h1>
    <div class="meta">${t.engagement}: <b>${esc(data.engagementName)}</b>${
      data.orgName ? ` · ${t.organization}: ${esc(data.orgName)}` : ""
    } · ${t.generated}: ${dateStr}</div>
  </div>

  <div class="stats">
    <div class="stat"><div class="v">${program.inScope.length}</div><div class="l">${t.domainsInScope}</div></div>
    <div class="stat"><div class="v">${program.candidates.length}</div><div class="l">${t.candidates}</div></div>
    <div class="stat"><div class="v">${totalCertified}</div><div class="l">${t.certifiedTotal}</div></div>
  </div>

  ${
    program.inScope.length === 0
      ? `<p class="empty">${t.noScope}</p>`
      : `
  <h2>${t.perDomain}</h2>
  <table>
    <thead><tr>
      <th>${t.thDomain}</th><th>${t.thStandard}</th>
      <th class="num">${t.thTaken}</th><th class="num">${t.thCertified}</th><th class="num">${t.thPassRate}</th>
    </tr></thead>
    <tbody>${domainRows}</tbody>
  </table>
  ${anyIndicative ? `<div class="caption">${t.indicativeCaption}</div>` : ""}

  <h2>${t.roster}</h2>
  ${
    rosterRows.length === 0
      ? `<p class="empty">${t.rosterEmpty}</p>`
      : `<table>
    <thead><tr>
      <th>${t.thCandidate}</th><th>${t.thDomain}</th><th class="num">${t.thLevel}</th><th>${t.thCredential}</th>
    </tr></thead>
    <tbody>${rosterRows.join("")}</tbody>
  </table>`
  }
  `
  }

  <div class="foot"><span>${t.confidential}</span><span>${esc(data.engagementName)}</span></div>
</body>
</html>`;
}
