import { NextResponse } from "next/server";
import { findProposalByToken, isProposalClientVisible, isProposalOfferExpired } from "@/lib/proposals/service";
import { buildProposalHtml, proposalRef } from "@/lib/proposals/proposal-html";
import { buildProposalHtmlAr } from "@/lib/proposals/proposal-html-ar";
import { loadProposalEvidence } from "@/lib/proposals/evidence-summary";
import { getVifmLogoDataUri } from "@/lib/proposals/logo";
import { renderHtmlToPdfBuffer } from "@/lib/reports/html-to-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/proposals/[token]/pdf - public, token-gated client download.
 * Serves only a client-facing status (issued/won) that hasn't expired: a draft
 * isn't client-facing, a `lost` proposal has been withdrawn/superseded, and a
 * past-validity offer must not be downloadable. The unguessable access_token +
 * these gates protect it; no account needed. Auth is bypassed for this path.
 */
export async function GET(req: Request, { params }: { params: { token: string } }) {
  const proposal = await findProposalByToken(params.token);
  if (!proposal || !isProposalClientVisible(proposal) || isProposalOfferExpired(proposal)) {
    return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
  }
  const language = new URL(req.url).searchParams.get("language") === "ar" ? "ar" : "en";
  try {
    const evidence = await loadProposalEvidence();
    const opts = {
      logoWhite: getVifmLogoDataUri("white"),
      logoColor: getVifmLogoDataUri("color"),
      evidence,
    };
    const html = language === "ar" ? buildProposalHtmlAr(proposal, opts) : buildProposalHtml(proposal, opts);
    const footLabel = language === "ar" ? "سري" : "Confidential";
    const pdf = await renderHtmlToPdfBuffer(html, {
      pageFooter: { left: `VIFM Caliber® · ${proposalRef(proposal)} · ${footLabel}` },
    });
    const name = proposal.clientName.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "Client";
    const suffix = language === "ar" ? "-AR" : "";
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="VIFM-Proposal-${name}${suffix}.pdf"`,
      },
    });
  } catch (err) {
    console.error("[proposals/token/pdf]", err);
    return NextResponse.json({ error: "Could not generate the proposal PDF." }, { status: 500 });
  }
}
