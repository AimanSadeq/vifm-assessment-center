import { NextResponse } from "next/server";
import { requireRole, isAuthorizationError } from "@/lib/ara/auth-guards";
import { loadProposal } from "@/lib/proposals/service";
import { buildProposalHtml } from "@/lib/proposals/proposal-html";
import { buildProposalHtmlAr } from "@/lib/proposals/proposal-html-ar";
import { loadProposalEvidence } from "@/lib/proposals/evidence-summary";
import { getVifmLogoDataUri } from "@/lib/proposals/logo";
import { proposalHtmlToWord, proposalFileBase } from "@/lib/proposals/word";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/admin/proposals/[id]/word - admin download of a proposal as Word (.doc). */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    await requireRole(["admin"]);
  } catch (e) {
    if (isAuthorizationError(e)) return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    throw e;
  }
  const proposal = await loadProposal(params.id);
  if (!proposal) return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
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
    console.error("[admin/proposals/word]", err);
    return NextResponse.json({ error: "Could not generate the proposal Word document." }, { status: 500 });
  }
}
