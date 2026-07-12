import { NextResponse } from "next/server";
import { findProposalByToken, isProposalClientVisible, isProposalOfferExpired } from "@/lib/proposals/service";
import { buildProposalHtml } from "@/lib/proposals/proposal-html";
import { buildProposalHtmlAr } from "@/lib/proposals/proposal-html-ar";
import { loadProposalEvidence } from "@/lib/proposals/evidence-summary";
import { getVifmLogoDataUri } from "@/lib/proposals/logo";
import { proposalHtmlToWord, proposalFileBase } from "@/lib/proposals/word";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/proposals/[token]/word - public, token-gated Word (.doc) download.
 * Mirrors the PDF route: serves only a client-facing (issued/won), non-expired
 * proposal; drafts, withdrawn/superseded (lost), and past-validity offers 404.
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
    const name = proposalFileBase(proposal.clientName);
    const suffix = language === "ar" ? "-AR" : "";
    return new NextResponse(proposalHtmlToWord(html), {
      headers: {
        "Content-Type": "application/msword; charset=utf-8",
        "Content-Disposition": `attachment; filename="VIFM-Proposal-${name}${suffix}.doc"`,
      },
    });
  } catch (err) {
    console.error("[proposals/token/word]", err);
    return NextResponse.json({ error: "Could not generate the proposal Word document." }, { status: 500 });
  }
}
