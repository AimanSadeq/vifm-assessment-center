import { NextResponse } from "next/server";
import { renderSampleReport } from "@/lib/reports/sample-fixture";

/**
 * Public ARC sample - the DIVISION consolidation, rendered live from the
 * fixture (Corporate Services over Human Resources and Finance at Ufuq
 * Digital Authority). The cross-unit comparison is what a division engagement
 * sells on top of the department reports beneath it. See
 * src/lib/reports/sample-fixture.ts for why this is a real render.
 *
 * English only for now: the rollup page has no Arabic edition yet, so a ?lang
 * parameter is deliberately NOT accepted - advertising ?lang=ar and silently
 * returning English would be the kind of mismatch these samples exist to end.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  try {
    const result = await renderSampleReport({ kind: "division", lang: "en", origin: url.origin });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return new NextResponse(new Uint8Array(result.pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${result.filename}"`,
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error) {
    console.error("[sample arc-division]", error);
    return NextResponse.json({ error: "Could not render the sample." }, { status: 500 });
  }
}
