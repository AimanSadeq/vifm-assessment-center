import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { methodologyBriefHtml } from "@/lib/reports/methodology-brief";
import { renderHtmlToPdfBuffer } from "@/lib/reports/html-to-pdf";

// Puppeteer needs the Node runtime, not Edge.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/ac/persona/methodology/pdf
 *
 * Public, no-account download of the Persona Methodology Brief as a branded PDF.
 * Reads docs/Persona-Methodology-Brief.md at request time so the doc stays the
 * single source of truth (no embedded copy to drift). Reuses methodologyMdToHtml
 * via methodologyBriefHtml, with the Persona eyebrow.
 */
export async function GET() {
  let md: string;
  try {
    md = await fs.readFile(path.join(process.cwd(), "docs", "Persona-Methodology-Brief.md"), "utf8");
  } catch {
    md =
      "# VIFM Persona - Methodology Brief\n\nThe methodology brief is temporarily unavailable. " +
      "For methodology questions, contact the VIFM consulting team: `contact@viftraining.com`.";
  }

  try {
    const html = methodologyBriefHtml(md, "VIFM Persona®");
    const pdf = await renderHtmlToPdfBuffer(html);
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'inline; filename="VIFM-Persona-Methodology-Brief.pdf"',
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (err) {
    console.error("[persona methodology/pdf] generation failed:", err);
    return NextResponse.json({ error: "Could not generate the methodology PDF." }, { status: 500 });
  }
}
