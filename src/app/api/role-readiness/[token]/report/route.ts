import { NextResponse } from "next/server";
import { findRrCandidateByToken } from "@/lib/role-readiness/candidate-access";
import { loadReadinessReportData } from "@/lib/role-readiness/report-data";
import { renderRoleReadinessHtml } from "@/lib/reports/role-readiness-html";
import { launchPdfBrowser } from "@/lib/reports/pdf-browser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { token: string } }) {
  const ctx = await findRrCandidateByToken(params.token);
  if (!ctx) return NextResponse.json({ error: "Invalid link" }, { status: 404 });

  const data = await loadReadinessReportData(ctx.candidate.id);
  if (!data) return NextResponse.json({ error: "No result yet" }, { status: 404 });

  const html = renderRoleReadinessHtml(data);
  const browser = await launchPdfBrowser();
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0", timeout: 60_000 });
    const pdf = await page.pdf({ format: "A4", printBackground: true });
    const safe = data.candidateName.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "candidate";
    return new NextResponse(Buffer.from(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="role-readiness-${safe}.pdf"`,
      },
    });
  } finally {
    await browser.close();
  }
}
