"use server";

import { requireRole, isAuthorizationError } from "@/lib/ara/auth-guards";
import { renderHtmlToPdfBuffer } from "@/lib/reports/html-to-pdf";
import { sendEmail } from "@/lib/integrations/email";
import { buildProposalHtml } from "@/lib/proposals/proposal-html";
import { loadProposalEvidence } from "@/lib/proposals/evidence-summary";
import {
  createProposal,
  updateProposal,
  setProposalStatus,
  markProposalSent,
  loadProposal,
  setRate,
  type ProposalInput,
  type ProposalStatus,
} from "@/lib/proposals/service";

type Result<T> = ({ ok: true } & T) | { error: string };

async function gate(): Promise<{ error: string } | null> {
  try {
    await requireRole(["admin"]);
    return null;
  } catch (e) {
    if (isAuthorizationError(e)) return { error: "Not authorized." };
    throw e;
  }
}

function appBase(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    "https://caliber.viftraining.com"
  ).replace(/\/$/, "");
}

export async function setRateAction(input: { serviceKey: string; unitRate: number; currency: string }) {
  const denied = await gate();
  if (denied) return denied;
  return setRate(input.serviceKey, input.unitRate, input.currency);
}

export async function createProposalAction(input: ProposalInput): Promise<Result<{ id: string }>> {
  const denied = await gate();
  if (denied) return denied;
  if (!input.title?.trim() || !input.clientName?.trim()) return { error: "Title and client are required." };
  return createProposal(input);
}

export async function updateProposalAction(
  id: string,
  input: ProposalInput,
): Promise<{ ok: true } | { error: string }> {
  const denied = await gate();
  if (denied) return denied;
  return updateProposal(id, input);
}

export async function setStatusAction(
  id: string,
  status: ProposalStatus,
): Promise<{ ok: true } | { error: string }> {
  const denied = await gate();
  if (denied) return denied;
  return setProposalStatus(id, status);
}

/** Generate the PDF, email it to the client, mark issued + sent. */
export async function sendProposalToClientAction(input: {
  id: string;
  to: string;
}): Promise<Result<{ sentTo: string }>> {
  const denied = await gate();
  if (denied) return denied;
  const to = input.to.trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) return { error: "Enter a valid client email." };

  const proposal = await loadProposal(input.id);
  if (!proposal) return { error: "Proposal not found." };

  let pdfBase64: string;
  try {
    const evidence = await loadProposalEvidence();
    const pdf = await renderHtmlToPdfBuffer(buildProposalHtml(proposal, { evidence }));
    pdfBase64 = Buffer.from(pdf).toString("base64");
  } catch {
    return { error: "Could not generate the proposal PDF." };
  }

  const viewUrl = `${appBase()}/proposals/${proposal.accessToken}`;
  const ok = await sendEmail({
    to,
    template: "proposal_delivery",
    data: {
      clientName: proposal.clientName,
      proposalTitle: proposal.title,
      viewUrl,
      validUntil: proposal.validUntil ? new Date(proposal.validUntil).toLocaleDateString("en-GB") : "-",
    },
    attachments: [
      {
        filename: `VIFM-Proposal-${proposal.clientName.replace(/[^a-z0-9]+/gi, "-")}.pdf`,
        contentBase64: pdfBase64,
        contentType: "application/pdf",
      },
    ],
  });

  if (proposal.status === "draft") await setProposalStatus(input.id, "issued");
  await markProposalSent(input.id, to);
  if (!ok) return { error: "Proposal saved as issued, but the email could not be sent. Share the client link instead." };
  return { ok: true, sentTo: to };
}
