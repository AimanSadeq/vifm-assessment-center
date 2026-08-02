import { readFileSync } from "fs";
import { join } from "path";

// Public ARC sample - detailed individual AI-readiness report (bilingual EN/AR,
// print-to-PDF). Clearly-labelled demo data, no PII, no data fetch. Served as a
// branded shareable link (caliber.viftraining.com/samples/arc-report).
export const runtime = "nodejs";
export const dynamic = "force-static";

export function GET() {
  const html = readFileSync(
    join(process.cwd(), "public", "samples", "arc-report.html"),
    "utf-8",
  );
  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store, max-age=0",
    },
  });
}
