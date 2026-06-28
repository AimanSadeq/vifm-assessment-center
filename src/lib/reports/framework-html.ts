import "server-only";
import type { DomainNode, FrameworkCounts } from "@/lib/competencies/framework-tree";

/**
 * VIFM Competency Framework -> printable HTML (Puppeteer PDF). Renders the
 * framework structure only: domains -> clusters (with definitions) ->
 * competencies (with definitions). Behavioural indicators are deliberately NOT
 * included in this document - it is the clean framework reference (the 41
 * competencies + their definitions). Fed by loadFrameworkTree(). English.
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
              return `<div class="comp">
                <div class="comp-head">
                  <span class="seq" style="background:${d.visual.tint};color:${d.visual.color}">${k.seq}</span>
                  <span class="comp-name">${esc(k.nameEn)}</span>
                </div>
                ${k.descEn ? `<p class="comp-desc">${esc(k.descEn)}</p>` : ""}
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
  .domain { margin-bottom: 14px; }
  .domain-head { display: flex; align-items: baseline; justify-content: space-between; color: #fff; border-radius: 7px; padding: 8px 12px; margin-bottom: 8px; break-after: avoid; page-break-after: avoid; }
  .domain-name { font-size: 15px; font-weight: 800; letter-spacing: .01em; }
  .domain-meta { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; opacity: .9; }
  .cluster { margin: 0 0 9px; }
  .cluster-name { font-size: 12px; font-weight: 800; color: #1E293B; border-left: 3px solid; padding-left: 8px; margin-bottom: 6px; break-after: avoid; page-break-after: avoid; }
  .cluster-def { display: block; font-size: 9.5px; font-weight: 600; color: #64748B; margin-top: 1px; }
  .comp { border: 1px solid #E6EBF2; border-radius: 8px; padding: 8px 10px; margin-bottom: 7px; page-break-inside: avoid; }
  .comp-head { display: flex; align-items: center; gap: 8px; }
  .seq { display: inline-grid; place-items: center; width: 24px; height: 20px; border-radius: 5px; font-size: 10px; font-weight: 800; }
  .comp-name { font-size: 12.5px; font-weight: 700; color: #1E293B; }
  .comp-desc { margin: 4px 0 0; font-size: 10px; color: #64748B; }
  .foot { margin-top: 16px; border-top: 1px solid #E6EBF2; padding-top: 8px; color: #888; font-size: 9px; }
</style>
</head>
<body>
  <div class="head">
    <div class="brand">Virginia Institute of Finance and Management</div>
    <h1>VIFM Competency Framework</h1>
    <div class="counts">${counts.domains} domains &middot; ${counts.clusters} clusters &middot; ${counts.competencies} competencies &middot; ${generated}</div>
  </div>
  ${domainsHtml}
  <div class="foot">VIFM-authored competency framework: ${counts.competencies} competencies across ${counts.domains} domains and ${counts.clusters} clusters, with their definitions. &copy; VIFM.</div>
</body>
</html>`;
}
