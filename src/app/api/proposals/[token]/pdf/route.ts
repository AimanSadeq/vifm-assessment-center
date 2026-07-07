import { NextResponse } from "next/server";
import { findProposalByToken } from "@/lib/proposals/service";
import { buildProposalHtml, proposalRef } from "@/lib/proposals/proposal-html";
import { renderHtmlToPdfBuffer } from "@/lib/reports/html-to-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/proposals/[token]/pdf - public, token-gated client download.
 * Only ISSUED proposals are downloadable by token (a draft isn't client-facing).
 * The unguessable access_token + this status gate protect it; no account needed.
 * Auth is bypassed for this path in middleware.
 */
export async function GET(_req: Request, { params }: { params: { token: string } }) {
  const proposal = await findProposalByToken(params.token);
  if (!proposal || proposal.status === "draft") {
    return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
  }
  try {
    const pdf = await renderHtmlToPdfBuffer(buildProposalHtml(proposal), {
      pageFooter: { left: `VIFM Caliber® · ${proposalRef(proposal)} · Confidential` },
    });
    const name = proposal.clientName.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "Client";
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="VIFM-Proposal-${name}.pdf"`,
      },
    });
  } catch (err) {
    console.error("[proposals/token/pdf]", err);
    return NextResponse.json({ error: "Could not generate the proposal PDF." }, { status: 500 });
  }
}
