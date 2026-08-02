import { readFileSync } from "fs";
import { join } from "path";

// Public ARC sample - assessment-optimization recommendation (bilingual EN/AR,
// print-to-PDF). Client-facing note recommending the shortened 36-item form.
// No PII, no data fetch. Served as a branded shareable link
// (caliber.viftraining.com/samples/arc-recommendation).
export const runtime = "nodejs";
export const dynamic = "force-static";

export function GET() {
  const html = readFileSync(
    join(process.cwd(), "public", "samples", "arc-recommendation.html"),
    "utf-8",
  );
  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store, max-age=0",
    },
  });
}
