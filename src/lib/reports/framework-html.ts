import "server-only";
import type { DomainNode, FrameworkCounts } from "@/lib/competencies/framework-tree";

/**
 * VIFM Competency Framework -> printable HTML (Puppeteer PDF). Renders the full
 * framework (domains -> clusters -> competencies) AND the level-2 detail: the
 * positive + negative behavioural indicators per competency. English (the
 * catalogue's indicators are EN-only). Fed by loadFrameworkTree() so the PDF and
 * the on-screen /admin/framework reference share one source.
 */

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function renderFrameworkHtml(domains: DomainNode[], counts: FrameworkCounts): string {
  const generated = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  const domainsHtml = domains
    .map((d) => {
      const clustersHtml = d.clusters
        .map((c) => {
          const compsHtml = c.comps
            .map((k) => {
              const pos =
                k.positives.length > 0
                  ? `<ul class="ind pos">${k.positives.map((p) => `<li>${esc(p)}</li>`).join("")}</ul>`
                  : `<div class="ind-empty">-</div>`;
              const neg =
                k.negatives.length > 0
                  ? `<ul class="ind neg">${k.negatives.map((n) => `<li>${esc(n)}</li>`).join("")}</ul>`
                  : `<div class="ind-empty">-</div>`;
              return `<div class="comp">
                <div class="comp-head">
                  <span class="seq" style="background:${d.visual.tint};color:${d.visual.color}">${k.seq}</span>
                  <span class="comp-name">${esc(k.nameEn)}</span>
                </div>
                ${k.descEn ? `<p class="comp-desc">${esc(k.descEn)}</p>` : ""}
                <div class="ind-cols">
                  <div><div class="ind-title pos">Positive indicators</div>${pos}</div>
                  <div><div class="ind-title neg">Negative indicators</div>${neg}</div>
                </div>
              </div>`;
            })
            .join("");
          return `<div class="cluster">
            <div class="cluster-name" style="border-color:${d.visual.color}">${esc(c.nameEn)}${c.defEn ? `<span class="cluster-def">${esc(c.defEn)}</span>` : ""}</div>
            ${compsHtml}
          </div>`;
        })
        .join("");
      return `<section class="domain">
        <div class="domain-head" style="background:${d.visual.color}">
          <span class="domain-name">${esc(d.displayEn)}</span>
          <span class="domain-meta">${d.clusters.length} clusters &middot; ${d.compCount} competencies</span>
        </div>
        ${clustersHtml}
      </section>`;
    })
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link href="https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;600;700;800&display=swap" rel="stylesheet" />
<style>
  @page { size: A4; margin: 16mm 14mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Open Sans','Segoe UI',Tahoma,sans-serif; color: #111232; margin: 0; font-size: 11px; line-height: 1.45; }
  .head { border-bottom: 3px solid #010131; padding-bottom: 12px; margin-bottom: 16px; }
  .brand { color: #5391D5; font-size: 11px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; }
  h1 { font-size: 22px; margin: 4px 0 4px; color: #010131; }
  .counts { color: #555; font-size: 11px; }
  .domain { margin-bottom: 14px; page-break-inside: avoid; }
  .domain-head { display: flex; align-items: baseline; justify-content: space-between; color: #fff; border-radius: 7px; padding: 8px 12px; margin-bottom: 8px; }
  .domain-name { font-size: 15px; font-weight: 800; letter-spacing: .01em; }
  .domain-meta { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; opacity: .9; }
  .cluster { margin: 0 0 9px; }
  .cluster-name { font-size: 12px; font-weight: 800; color: #1E293B; border-left: 3px solid; padding-left: 8px; margin-bottom: 6px; }
  .cluster-def { display: block; font-size: 9.5px; font-weight: 600; color: #64748B; margin-top: 1px; }
  .comp { border: 1px solid #E6EBF2; border-radius: 8px; padding: 8px 10px; margin-bottom: 7px; page-break-inside: avoid; }
  .comp-head { display: flex; align-items: center; gap: 8px; }
  .seq { display: inline-grid; place-items: center; width: 24px; height: 20px; border-radius: 5px; font-size: 10px; font-weight: 800; }
  .comp-name { font-size: 12.5px; font-weight: 700; color: #1E293B; }
  .comp-desc { margin: 4px 0 6px; font-size: 10px; color: #64748B; }
  .ind-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .ind-title { font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: .06em; margin-bottom: 2px; }
  .ind-title.pos { color: #047857; }
  .ind-title.neg { color: #be123c; }
  .ind { margin: 0; padding: 0; list-style: none; }
  .ind li { position: relative; padding-left: 13px; font-size: 10px; margin-bottom: 2px; }
  .ind.pos li::before { content: "\\2713"; position: absolute; left: 0; color: #059669; font-weight: 700; }
  .ind.neg li::before { content: "\\2715"; position: absolute; left: 0; color: #e11d48; font-weight: 700; }
  .ind-empty { font-size: 10px; color: #9AA8BC; }
  .foot { margin-top: 16px; border-top: 1px solid #E6EBF2; padding-top: 8px; color: #888; font-size: 9px; }
</style>
</head>
<body>
  <div class="head">
    <div class="brand">Virginia Institute of Finance and Management</div>
    <h1>VIFM Competency Framework</h1>
    <div class="counts">${counts.domains} domains &middot; ${counts.clusters} clusters &middot; ${counts.competencies} competencies &middot; ${counts.indicators} behavioural indicators &middot; ${generated}</div>
  </div>
  ${domainsHtml}
  <div class="foot">VIFM-authored behavioural framework. Positive indicators show what strong looks like; negative indicators are the warning signs. Behavioural indicators are maintained in English. &copy; VIFM.</div>
</body>
</html>`;
}
