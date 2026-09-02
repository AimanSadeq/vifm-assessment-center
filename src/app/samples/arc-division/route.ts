import { NextResponse } from "next/server";
import { renderSampleReport } from "@/lib/reports/sample-fixture";

/**
 * Public ARC sample - the DIVISION consolidation, rendered live from the
 * fixture (Corporate Services over Human Resources and Finance at Ufuq
 * Digital Authority). The cross-unit comparison is what a division engagement
 * sells on top of the department reports beneath it. See
 * src/lib/reports/sample-fixture.ts for why this is a real render. ?lang=ar
 * for Arabic - added before the sample set went to any prospect, because the
 * division head of a Saudi government client is this document's reader.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const lang = url.searchParams.get("lang") === "ar" ? "ar" : "en";
  try {
    const result = await renderSampleReport({ kind: "division", lang, origin: url.origin });
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
