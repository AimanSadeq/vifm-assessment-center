import { NextResponse } from "next/server";
import { requireRole, isAuthorizationError } from "@/lib/ara/auth-guards";
import { loadProposal } from "@/lib/proposals/service";
import { buildProposalHtml, proposalRef } from "@/lib/proposals/proposal-html";
import { loadProposalEvidence } from "@/lib/proposals/evidence-summary";
import { getVifmLogoDataUri } from "@/lib/proposals/logo";
import { renderHtmlToPdfBuffer } from "@/lib/reports/html-to-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/admin/proposals/[id]/pdf - admin download of a proposal PDF. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    await requireRole(["admin"]);
  } catch (e) {
    if (isAuthorizationError(e)) return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    throw e;
  }
  const proposal = await loadProposal(params.id);
  if (!proposal) return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
  try {
    const evidence = await loadProposalEvidence();
    const html = buildProposalHtml(proposal, {
      logoWhite: getVifmLogoDataUri("white"),
      logoColor: getVifmLogoDataUri("color"),
      evidence,
    });
    const pdf = await renderHtmlToPdfBuffer(html, {
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
    console.error("[admin/proposals/pdf]", err);
    return NextResponse.json({ error: "Could not generate the proposal PDF." }, { status: 500 });
  }
}
