import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { methodologyBriefHtml } from "@/lib/reports/methodology-brief";
import { renderHtmlToPdfBuffer } from "@/lib/reports/html-to-pdf";
import { findMethodologyBrief } from "@/lib/reports/methodology-briefs-registry";

// Puppeteer needs the Node runtime, not Edge.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/methodology/[service]/pdf
 *
 * Public, no-account download of any VIFM service's Methodology Brief as a
 * branded PDF. The service slug resolves (via METHODOLOGY_BRIEFS) to a docs/
 * markdown file - the single source of truth - which is read at request time
 * and rendered with methodologyBriefHtml + the service's current-brand eyebrow.
 * Mirrors the established /api/ara/methodology/pdf and /api/ac/persona/methodology/pdf
 * routes; this one is generic so every service is covered from one place.
 */
export async function GET(_req: Request, { params }: { params: { service: string } }) {
  const meta = findMethodologyBrief(params.service);
  if (!meta) {
    return NextResponse.json({ error: "Unknown methodology brief." }, { status: 404 });
  }

  let md: string;
  try {
    md = await fs.readFile(path.join(process.cwd(), "docs", meta.file), "utf8");
  } catch {
    // Tolerant fallback - never 500 a public download.
    md =
      `# ${meta.service} - Methodology Brief\n\nThe methodology brief is temporarily unavailable. ` +
      "For methodology questions, contact the VIFM consulting team: `contact@viftraining.com`.";
  }

  try {
    const html = methodologyBriefHtml(md, meta.eyebrow);
    const pdf = await renderHtmlToPdfBuffer(html);
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${meta.filename}"`,
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (err) {
    console.error(`[methodology/${params.service}/pdf] generation failed:`, err);
    return NextResponse.json({ error: "Could not generate the methodology PDF." }, { status: 500 });
  }
}
