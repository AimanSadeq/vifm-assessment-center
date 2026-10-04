// Render an HTML file to A4 PDF with the preinstalled Chromium via puppeteer-core.
// Uses the repo's puppeteer (bundled Chromium) unless PUPPETEER_EXECUTABLE_PATH points at another Chrome.
const puppeteer = require("puppeteer");
const fs = require("fs");
(async () => {
  const [,, htmlPath, pdfPath, landscape] = process.argv;
  const browser = await puppeteer.launch({
    ...(process.env.PUPPETEER_EXECUTABLE_PATH ? { executablePath: process.env.PUPPETEER_EXECUTABLE_PATH } : {}),
    headless: true, args: ["--no-sandbox", "--disable-gpu", "--font-render-hinting=none"],
  });
  const page = await browser.newPage();
  await page.setContent(fs.readFileSync(htmlPath, "utf8"), { waitUntil: "networkidle0", timeout: 90000 });
  await page.evaluate(async () => { if (document.fonts && document.fonts.ready) await document.fonts.ready; });
  await page.pdf({ path: pdfPath, format: "A4", printBackground: true, landscape: landscape === "landscape",
    margin: { top: "0", right: "0", bottom: "0", left: "0" } });
  await browser.close();
  console.log("pdf written", pdfPath);
})().catch(e => { console.error(e); process.exit(1); });
