// Local render check for the in-app SDC reports: builds the executive summary,
// IDP and group report from the fictional fixture through the same assemble +
// html code as the routes, and prints them to PDF with a local Chromium.
//
//   PUPPETEER_EXECUTABLE_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome \
//     npx tsx scripts/sdc-hipo/check-caliber-reports.ts /tmp/sdc-reports-check [bigCohortSize]
//
// Run from the repo root (the logo is read from public/images). The optional
// size adds a padded group report (Group-Large.pdf) to check pagination.

import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer";
import { assembleCandidate, assembleCohort } from "../../src/lib/reports/sdc-hipo/assemble";
import { renderSdcSummaryHtml, renderSdcIdpHtml, renderSdcGroupHtml } from "../../src/lib/reports/sdc-hipo/html";
import {
  FIXTURE_CANDIDATES, FIXTURE_ROSTER, FIXTURE_SJT, FIXTURE_PSY, FIXTURE_COMPETENCIES, FIXTURE_ORG,
} from "../../src/lib/reports/sdc-hipo/fixture";

async function main() {
  const out = process.argv[2] || "/tmp/sdc-reports-check";
  const big = Number(process.argv[3] || 0);
  fs.mkdirSync(out, { recursive: true });

  const cand = FIXTURE_CANDIDATES[0];
  const one = assembleCandidate({
    cand,
    roster: FIXTURE_ROSTER.find((r) => r.bundle_candidate_id === cand.id) ?? null,
    sjt: FIXTURE_SJT.find((s) => s.bundle_candidate_id === cand.id) ?? null,
    psy: FIXTURE_PSY.find((p) => p.id === cand.cognitive_result_id) ?? null,
    comps: FIXTURE_COMPETENCIES,
    orgName: FIXTURE_ORG,
  });
  if (!one.ok) throw new Error(one.error);
  const base = { roster: FIXTURE_ROSTER, sjt: FIXTURE_SJT, psy: FIXTURE_PSY, comps: FIXTURE_COMPETENCIES, orgName: FIXTURE_ORG };
  const docs: Array<[string, string]> = [
    ["Summary", renderSdcSummaryHtml(one.data)],
    ["IDP", renderSdcIdpHtml(one.data)],
    ["Group", renderSdcGroupHtml(assembleCohort({ ...base, cands: FIXTURE_CANDIDATES }))],
  ];
  if (big > 0) {
    // Pad the cohort with copies of the fixture people (new ids) to check pagination.
    const cands = [], roster = [...FIXTURE_ROSTER], sjt = [...FIXTURE_SJT], psy = [...FIXTURE_PSY];
    for (let i = 0; i < big; i++) {
      const src = FIXTURE_CANDIDATES[i % 12];
      const id = `big-${i}`;
      const cog = `big-cog-${i}`;
      cands.push({ ...src, id, full_name: `${src.full_name} ${i + 1}`, cognitive_result_id: cog });
      roster.push({ ...FIXTURE_ROSTER.find((r) => r.bundle_candidate_id === src.id)!, bundle_candidate_id: id });
      sjt.push({ ...FIXTURE_SJT.find((s) => s.bundle_candidate_id === src.id)!, bundle_candidate_id: id });
      psy.push({ ...FIXTURE_PSY.find((p) => p.id === src.cognitive_result_id)!, id: cog });
    }
    docs.push(["Group-Large", renderSdcGroupHtml(assembleCohort({ ...base, roster, sjt, psy, cands }))]);
  }

  const browser = await puppeteer.launch({
    ...(process.env.PUPPETEER_EXECUTABLE_PATH ? { executablePath: process.env.PUPPETEER_EXECUTABLE_PATH } : {}),
    headless: true,
    args: ["--no-sandbox", "--disable-gpu", "--font-render-hinting=none", ...(process.env.HTTPS_PROXY ? [`--proxy-server=${process.env.HTTPS_PROXY}`] : [])],
  });
  try {
    for (const [name, html] of docs) {
      fs.writeFileSync(path.join(out, `${name}.html`), html);
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "networkidle0", timeout: 60_000 });
      await page.evaluate(async () => { if (document.fonts && document.fonts.ready) await document.fonts.ready; });
      const fontOk = await page.evaluate(() => document.fonts.check('700 12px "Open Sans"'));
      // Same step as the route: the group report lays its ranking table out over pages.
      await page.evaluate(() => (window as unknown as { __sdcLayout?: () => number }).__sdcLayout?.());
      // Overflow check: nothing on a page may reach its footer or run past the right edge.
      const problems = await page.evaluate(() => {
        const out: string[] = [];
        document.querySelectorAll(".page").forEach((pg, i) => {
          const foot = pg.querySelector(".pfoot");
          if (!foot) return;
          const limit = foot.getBoundingClientRect().top;
          const right = pg.getBoundingClientRect().right;
          pg.querySelectorAll("*").forEach((el) => {
            if (foot.contains(el)) return;
            const r = el.getBoundingClientRect();
            if (r.height === 0) return;
            if (r.bottom > limit + 0.5) out.push(`page ${i + 1}: <${el.tagName.toLowerCase()} class="${el.className}"> ends ${Math.round(r.bottom - limit)}px into the footer`);
            if (r.right > right + 0.5) out.push(`page ${i + 1}: <${el.tagName.toLowerCase()}> runs ${Math.round(r.right - right)}px past the edge`);
            const h = el as HTMLElement;
            if (h.scrollWidth > h.clientWidth + 1 && getComputedStyle(h).overflow === "hidden" && !h.classList.contains("page")) out.push(`page ${i + 1}: <${el.tagName.toLowerCase()}> text clipped`);
          });
        });
        return out;
      });
      await page.pdf({ path: path.join(out, `${name}.pdf`), format: "A4", printBackground: true, preferCSSPageSize: true });
      console.log(`${name}.pdf written (Open Sans loaded: ${fontOk}; overflow: ${problems.length ? `\n  ${problems.slice(0, 8).join("\n  ")}` : "none"})`);
      await page.close();
    }
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
