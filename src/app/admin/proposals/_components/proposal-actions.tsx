"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Send, CheckCircle2, Copy, GitBranch } from "lucide-react";
import { PdfDownloadButton } from "@/components/shared/pdf-download-button";
import { sendProposalToClientAction, setStatusAction, duplicateAsRevisionAction } from "../actions";
import type { Proposal, ProposalStatus } from "@/lib/proposals/service";

export function ProposalActions({ proposal, clientUrl }: { proposal: Proposal; clientUrl: string }) {
  const router = useRouter();
  const [to, setTo] = useState(proposal.contactEmail ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [copied, setCopied] = useState(false);

  async function send() {
    setBusy(true);
    setMsg(null);
    const res = await sendProposalToClientAction({ id: proposal.id, to });
    setBusy(false);
    if ("error" in res) return setMsg({ ok: false, text: res.error });
    setMsg({ ok: true, text: `Sent to ${res.sentTo}. The proposal is now marked issued.` });
    router.refresh();
  }

  async function status(next: ProposalStatus) {
    setBusy(true);
    await setStatusAction(proposal.id, next);
    setBusy(false);
    router.refresh();
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(clientUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  async function revise() {
    setBusy(true);
    setMsg(null);
    const res = await duplicateAsRevisionAction(proposal.id);
    setBusy(false);
    if ("error" in res) return setMsg({ ok: false, text: res.error });
    router.push(`/admin/proposals/${res.id}`);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <PdfDownloadButton
          url={`/api/admin/proposals/${proposal.id}/pdf`}
          filename={`VIFM-Proposal-${proposal.clientName.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "Client"}.pdf`}
          label="Download PDF"
          className="inline-flex items-center gap-1.5 rounded-md bg-[#010131] px-3.5 py-2 text-sm font-medium text-white hover:bg-[#121140] disabled:opacity-60"
        />
        <PdfDownloadButton
          url={`/api/admin/proposals/${proposal.id}/pdf?language=ar`}
          filename={`VIFM-Proposal-${proposal.clientName.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "Client"}-AR.pdf`}
          label="تحميل PDF (عربي)"
          className="inline-flex items-center gap-1.5 rounded-md border border-[#010131] px-3.5 py-2 text-sm font-medium text-[#010131] hover:bg-muted disabled:opacity-60"
        />
        <PdfDownloadButton
          url={`/api/admin/proposals/${proposal.id}/word`}
          filename={`VIFM-Proposal-${proposal.clientName.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "Client"}.doc`}
          label="Download Word"
          busyLabel="Preparing Word…"
          className="inline-flex items-center gap-1.5 rounded-md border border-[#010131] px-3.5 py-2 text-sm font-medium text-[#010131] hover:bg-muted disabled:opacity-60"
        />
        <PdfDownloadButton
          url={`/api/admin/proposals/${proposal.id}/word?language=ar`}
          filename={`VIFM-Proposal-${proposal.clientName.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "Client"}-AR.doc`}
          label="تحميل Word (عربي)"
          busyLabel="جارٍ التحضير…"
          className="inline-flex items-center gap-1.5 rounded-md border border-[#010131] px-3.5 py-2 text-sm font-medium text-[#010131] hover:bg-muted disabled:opacity-60"
        />
      </div>

      {/* Split documents: a technical proposal (no pricing) and a financial proposal
          (all solutions, one combined price) - each as PDF or editable Word. */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/30 p-2.5">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Technical</span>
        <PdfDownloadButton
          url={`/api/admin/proposals/${proposal.id}/pdf?variant=technical`}
          filename={`VIFM-Proposal-${proposal.clientName.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "Client"}-Technical.pdf`}
          label="PDF"
          className="inline-flex items-center gap-1.5 rounded-md border border-[#010131] px-3 py-1.5 text-sm font-medium text-[#010131] hover:bg-muted disabled:opacity-60"
        />
        <PdfDownloadButton
          url={`/api/admin/proposals/${proposal.id}/word?variant=technical`}
          filename={`VIFM-Proposal-${proposal.clientName.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "Client"}-Technical.doc`}
          label="Word"
          busyLabel="Preparing…"
          className="inline-flex items-center gap-1.5 rounded-md border border-[#010131] px-3 py-1.5 text-sm font-medium text-[#010131] hover:bg-muted disabled:opacity-60"
        />
        <span className="ml-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Financial</span>
        <PdfDownloadButton
          url={`/api/admin/proposals/${proposal.id}/pdf?variant=financial`}
          filename={`VIFM-Proposal-${proposal.clientName.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "Client"}-Financial.pdf`}
          label="PDF"
          className="inline-flex items-center gap-1.5 rounded-md border border-[#010131] px-3 py-1.5 text-sm font-medium text-[#010131] hover:bg-muted disabled:opacity-60"
        />
        <PdfDownloadButton
          url={`/api/admin/proposals/${proposal.id}/word?variant=financial`}
          filename={`VIFM-Proposal-${proposal.clientName.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "Client"}-Financial.doc`}
          label="Word"
          busyLabel="Preparing…"
          className="inline-flex items-center gap-1.5 rounded-md border border-[#010131] px-3 py-1.5 text-sm font-medium text-[#010131] hover:bg-muted disabled:opacity-60"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {proposal.status !== "draft" && (
          <>
            <a href={clientUrl} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3.5 py-2 text-sm text-foreground hover:bg-muted">
              Open client view
            </a>
            <button onClick={copyLink}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3.5 py-2 text-sm text-foreground hover:bg-muted">
              <Copy className="h-4 w-4" /> {copied ? "Copied" : "Copy client link"}
            </button>
          </>
        )}
        <button onClick={revise} disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-3.5 py-2 text-sm text-foreground hover:bg-muted disabled:opacity-50">
          <GitBranch className="h-4 w-4" /> Duplicate as revision
        </button>
      </div>

      <div className="rounded-md border border-border bg-card p-3">
        <span className="text-sm font-medium text-foreground">Send to client</span>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input type="email" value={to} onChange={(e) => setTo(e.target.value)} placeholder="client@company.com"
            className="min-w-[16rem] flex-1 rounded-md border border-border bg-card px-3 py-2 text-sm" />
          <button onClick={send} disabled={busy || !to}
            className="inline-flex items-center gap-1.5 rounded-md bg-[#5391D5] px-3.5 py-2 text-sm font-medium text-white hover:bg-[#4380c4] disabled:opacity-50">
            <Send className="h-4 w-4" /> {busy ? "Sending…" : "Email proposal"}
          </button>
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">Emails the PDF + a link to the client view, and marks the proposal issued.</p>
        {msg && <p className={`mt-1.5 text-xs ${msg.ok ? "text-emerald-700" : "text-red-600"}`}>{msg.text}</p>}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">Status:</span>
        {(["draft", "issued", "won", "lost"] as ProposalStatus[]).map((st) => (
          <button key={st} onClick={() => status(st)} disabled={busy || proposal.status === st}
            className={`rounded-full border px-3 py-1 text-xs capitalize ${
              proposal.status === st ? "border-[#010131] bg-[#010131] text-white" : "border-border text-muted-foreground hover:bg-muted"
            }`}>
            {st === "issued" && proposal.status === st ? <CheckCircle2 className="mr-1 inline h-3 w-3" /> : null}
            {st}
          </button>
        ))}
      </div>
    </div>
  );
}
