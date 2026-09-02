import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { buildPersonalReportPdf } from "@/lib/reports/personal-report-build";

/**
 * Public ARC sample - the detailed individual AI-readiness report.
 *
 * Served as the REAL report for a fictional, sandbox-flagged respondent
 * ("Abdullah Alanazi", Ufuq Digital Authority), generated through the same
 * builder every real respondent's report comes from. It used to be a
 * hand-authored HTML page built on a three-construct model the product never
 * measured; a prospect who bought off it would have received something
 * different. Now whatever the product produces is what the prospect sees.
 *
 * ?lang=ar for Arabic. Auth is bypassed for /samples/* in middleware; the only
 * thing this route can ever reveal is the sample fixture, looked up by a fixed
 * marker address, so no real respondent is reachable through it.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SAMPLE_RESPONDENT_EMAIL = "abdullah.alanazi@sample.ufuq.invalid";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const lang = url.searchParams.get("lang") === "ar" ? "ar" : "en";

  const sb = createServiceClient();
  const { data: r } = await sb
    .from("ara_respondents")
    .select("access_token, assessment:ara_assessments!inner(is_sandbox)")
    .eq("email", SAMPLE_RESPONDENT_EMAIL)
    .maybeSingle<{ access_token: string; assessment: { is_sandbox: boolean } }>();
  if (!r || !r.assessment?.is_sandbox) {
    return NextResponse.json(
      { error: "The sample fixture is not provisioned on this environment." },
      { status: 404 }
    );
  }

  try {
    const result = await buildPersonalReportPdf({ token: r.access_token, lang });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return new NextResponse(new Uint8Array(result.pdf), {
      headers: {
        "Content-Type": "application/pdf",
        // Inline so it opens in the browser from the shared link.
        "Content-Disposition": `inline; filename="ARC-Detailed-Individual-Report-Sample-${lang}.pdf"`,
        // The fixture only changes when we re-seed it; an hour of caching keeps
        // a shared link cheap without letting a stale render linger for long.
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error) {
    console.error("[sample arc-report]", error);
    const unavailable = error instanceof Error && error.message === "PDF_RENDERER_UNAVAILABLE";
    return NextResponse.json(
      { error: unavailable ? "The PDF renderer is temporarily unavailable." : "Could not render the sample." },
      { status: unavailable ? 503 : 500 }
    );
  }
}
