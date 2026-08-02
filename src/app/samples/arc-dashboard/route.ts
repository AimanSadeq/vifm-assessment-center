import { readFileSync } from "fs";
import { join } from "path";

// Public ARC sample dashboard - a static, self-contained interactive demo of the
// organizational AI-readiness dashboard (drill Overall -> Division -> Department
// -> Individual; EN/AR toggle). Clearly-labelled demo data, no PII, no data
// fetch. Served as a branded shareable link (caliber.viftraining.com/samples/
// arc-dashboard) so prospects can open the dynamic dashboard on any device.
// Read at build time (force-static) from the file that also lives under public/.
export const runtime = "nodejs";
export const dynamic = "force-static";

export function GET() {
  const html = readFileSync(
    join(process.cwd(), "public", "samples", "arc-dashboard.html"),
    "utf-8",
  );
  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
}
