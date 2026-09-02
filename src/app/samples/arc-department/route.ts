import { NextResponse } from "next/server";
import { renderSampleReport } from "@/lib/reports/sample-fixture";
import { selfOrigin } from "@/lib/reports/pdf-browser";

/**
 * Public ARC sample - the DEPARTMENT report, rendered live from the fixture
 * (Human Resources at Ufuq Digital Authority, deep-dive with the individual
 * layer on, so the Workforce AI Readiness section appears). ?lang=ar for
 * Arabic. See src/lib/reports/sample-fixture.ts for why this is a real render.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const lang = url.searchParams.get("lang") === "ar" ? "ar" : "en";
  try {
    const result = await renderSampleReport({ kind: "department", lang, origin: selfOrigin(request.url) });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return new NextResponse(new Uint8Array(result.pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${result.filename}"`,
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error) {
    console.error("[sample arc-department]", error);
    return NextResponse.json({ error: "Could not render the sample." }, { status: 500 });
  }
}
