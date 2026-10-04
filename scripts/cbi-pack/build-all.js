// Builds the whole pack: deck (pptx), then guide and report HTML rendered to PDF.
// Output folder: CBI_OUT or docs/samples/cbi. HTML intermediates are removed after rendering.
const fs = require("fs");
const { execFileSync } = require("child_process");
require("./build-deck");
const guide = require("./build-guide");
const report = require("./build-report");
for (const { htmlPath } of [guide, report]) {
  const pdfPath = htmlPath.replace(/\.html$/, ".pdf");
  execFileSync(process.execPath, [require.resolve("./render-pdf.js"), htmlPath, pdfPath], { stdio: "inherit" });
  fs.unlinkSync(htmlPath);
}
