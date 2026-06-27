"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Copy, Ban, Ticket, SlidersHorizontal, ChevronLeft, ChevronRight, Building2, Users, Loader2, Upload, Link2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { VoucherClientEmailCard } from "@/components/shared/voucher-client-email-card";
import { VoucherDetailsFields, contactDisplayName, EMPTY_VOUCHER_DETAILS, type VoucherDetails } from "@/components/shared/voucher-details-fields";
import { emailVoucherLinksToDelegatesAction } from "@/lib/vouchers/email-actions";
import {
  createPrehireVoucherBatchAction,
  disablePrehireVoucherAction,
} from "./prehire-vouchers-actions";
import type { PrehireVoucherListItem, PrehireRequisitionOption } from "@/lib/prehire/vouchers";

export function PrehireVouchersClient({
  requisitions,
  vouchers,
}: {
  requisitions: PrehireRequisitionOption[];
  vouchers: PrehireVoucherListItem[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [requisitionId, setRequisitionId] = useState(requisitions[0]?.id ?? "");
  const [details, setDetails] = useState<VoucherDetails>(EMPTY_VOUCHER_DETAILS);
  const [count, setCount] = useState(1);
  const [seats, setSeats] = useState(1);

  // Wizard state
  const [step, setStep] = useState(1);
  const [target, setTarget] = useState<"client" | "delegates" | null>(null);
  const [generated, setGenerated] = useState<string[]>([]);
  const [delegateText, setDelegateText] = useState("");
  const [delegateBusy, setDelegateBusy] = useState(false);
  const [delegateMsg, setDelegateMsg] = useState<string | null>(null);

  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const redeemUrl = (code: string) => `${origin}/prehire/redeem?code=${code}`;
  const orgName = () => requisitions.find((r) => r.id === requisitionId)?.organization_name ?? null;

  async function copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied");
    } catch {
      toast.error("Could not copy.");
    }
  }

  function generate() {
    if (!requisitionId) {
      toast.error("Pick a requisition.");
      return;
    }
    startTransition(async () => {
      const res = await createPrehireVoucherBatchAction({
        requisitionId,
        label: details.projectLabel.trim() || undefined,
        count: Math.max(1, count),
        seatsPerCode: Math.max(1, seats),
        expiresAt: details.expiresAt || null,
        organizationName: details.clientName.trim() || orgName(),
      });
      if (res.ok) {
        setGenerated(res.codes);
        toast.success(`Created ${res.created} voucher${res.created === 1 ? "" : "s"}`);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  function importEmailsFromFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      const found = (text.match(/[^\s,;:<>"'()[\]]+@[^\s,;:<>"'()[\]]+\.[^\s,;:<>"'()[\]]+/g) ?? [])
        .map((e) => e.trim())
        .filter((e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e));
      if (!found.length) {
        setDelegateMsg("No email addresses found in that file.");
        return;
      }
      const existing = delegateText.split(/\r?\n/).map((l) => l.split(",")[0]?.trim().toLowerCase()).filter(Boolean);
      const merged = Array.from(new Set([...existing, ...found.map((e) => e.toLowerCase())]));
      setDelegateText(merged.join("\n"));
      setDelegateMsg(`Loaded ${found.length} email(s) from ${file.name}.`);
    };
    reader.onerror = () => setDelegateMsg("Could not read that file.");
    reader.readAsText(file);
  }

  async function sendToDelegates() {
    const parsed = delegateText
      .split(/\r?\n/)
      .map((line) => { const [email, ...rest] = line.split(","); return { email: (email ?? "").trim(), name: rest.join(",").trim() || undefined }; })
      .filter((d) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email));
    if (!parsed.length) {
      setDelegateMsg("Add at least one valid email.");
      return;
    }
    if (!requisitionId) {
      toast.error("Pick a requisition.");
      return;
    }
    setDelegateBusy(true);
    setDelegateMsg(null);
    const res = await createPrehireVoucherBatchAction({
      requisitionId,
      label: details.projectLabel.trim() || undefined,
      count: parsed.length,
      seatsPerCode: 1,
      expiresAt: details.expiresAt || null,
      organizationName: details.clientName.trim() || orgName(),
    });
    if (!res.ok) {
      setDelegateBusy(false);
      toast.error(res.error);
      return;
    }
    const codes = res.codes;
    setGenerated(codes);
    const recipients = parsed
      .map((d, i) => ({ email: d.email, name: d.name, link: codes[i] ? redeemUrl(codes[i]) : "" }))
      .filter((r) => r.link.length > 0);
    const mail = await emailVoucherLinksToDelegatesAction({ serviceLabel: "Pre-Hire®", recipients });
    setDelegateBusy(false);
    if ("error" in mail) {
      toast.error(mail.error);
      return;
    }
    setDelegateMsg(`Created ${codes.length} code(s) and emailed ${mail.sent} of ${mail.total} delegate(s).`);
    setDelegateText("");
    router.refresh();
  }

  function onDisable(id: string) {
    startTransition(async () => {
      const res = await disablePrehireVoucherAction(id);
      if (res.ok) {
        toast.success("Voucher disabled");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  const reqSelect = (
    <select
      value={requisitionId}
      onChange={(e) => setRequisitionId(e.target.value)}
      className="flex h-9 w-full max-w-xl rounded-md border border-input bg-background px-3 py-1 text-sm"
    >
      {requisitions.map((r) => (
        <option key={r.id} value={r.id}>
          {r.title}
          {r.organization_name ? ` - ${r.organization_name}` : ""}
        </option>
      ))}
    </select>
  );

  return (
    <div className="space-y-6">
      {requisitions.length === 0 ? (
        <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          No requisitions yet. Create a Pre-Hire requisition first, then issue vouchers against it.
        </p>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Issue Pre-Hire® vouchers</CardTitle>
            <p className="text-sm text-muted-foreground">
              {step === 1 && "Step 1 of 3 · Which role + a label"}
              {step === 2 && "Step 2 of 3 · How should the vouchers reach people?"}
              {step === 3 && target === "client" && "Step 3 of 3 · Generate and send to the client"}
              {step === 3 && target === "delegates" && "Step 3 of 3 · Email a link to each applicant"}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
              {["Role", "Delivery", "Issue"].map((s, i) => {
                const n = i + 1;
                return (
                  <span key={s} className="flex items-center gap-2">
                    <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold ${step === n ? "bg-[#010131] text-white" : step > n ? "bg-[#5391D5] text-white" : "bg-muted text-muted-foreground"}`}>{n}</span>
                    <span className={step === n ? "font-medium text-foreground" : "text-muted-foreground"}>{s}</span>
                    {n < 3 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
                  </span>
                );
              })}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* STEP 1 — requisition + label */}
            {step === 1 && (
              <>
                <VoucherDetailsFields value={details} onChange={setDetails} clientHint="Defaults to the requisition's organisation if left blank." />
                <div className="space-y-3 rounded-lg border border-dashed border-[#5391D5]/50 bg-[#5391D5]/5 p-3">
                  <div className="flex items-center gap-1.5 text-sm font-semibold text-[#010131]">
                    <SlidersHorizontal className="h-4 w-4 text-[#5391D5]" /> Pre-Hire options
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Requisition (the role these vouchers screen for)</Label>
                    {reqSelect}
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button onClick={() => setStep(2)} disabled={!requisitionId} className="gap-1.5">
                    Next <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </>
            )}

            {/* STEP 2 — delivery choice */}
            {step === 2 && (
              <>
                <p className="text-sm text-muted-foreground">
                  Do you want the vouchers sent to the client to distribute, or emailed to each applicant directly?
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <button type="button" onClick={() => { setTarget("client"); setGenerated([]); setStep(3); }} className="rounded-lg border border-border p-4 text-left transition hover:border-[#5391D5] hover:bg-[#5391D5]/5">
                    <div className="flex items-center gap-2 text-sm font-semibold text-[#010131]"><Building2 className="h-4 w-4 text-[#5391D5]" /> Send to the client</div>
                    <p className="mt-1 text-xs text-muted-foreground">Generate a batch, then email or copy the links to the client - they distribute to applicants.</p>
                  </button>
                  <button type="button" onClick={() => { setTarget("delegates"); setStep(3); }} className="rounded-lg border border-border p-4 text-left transition hover:border-[#5391D5] hover:bg-[#5391D5]/5">
                    <div className="flex items-center gap-2 text-sm font-semibold text-[#010131]"><Users className="h-4 w-4 text-[#5391D5]" /> Send to applicants</div>
                    <p className="mt-1 text-xs text-muted-foreground">Upload or paste a list of emails; each applicant gets their own link.</p>
                  </button>
                </div>
                <div>
                  <Button variant="outline" onClick={() => setStep(1)} className="gap-1.5"><ChevronLeft className="h-4 w-4" /> Back</Button>
                </div>
              </>
            )}

            {/* STEP 3a — to client */}
            {step === 3 && target === "client" && (
              <>
                <div className="flex flex-wrap items-end gap-3">
                  <div className="w-36 space-y-1.5">
                    <Label className="text-xs">How many vouchers</Label>
                    <Input type="number" min={1} max={500} value={count} onChange={(e) => setCount(Math.max(1, Number(e.target.value) || 1))} />
                  </div>
                  <div className="w-32 space-y-1.5">
                    <Label className="text-xs">Seats / code</Label>
                    <Input type="number" min={1} max={1000} value={seats} onChange={(e) => setSeats(Math.max(1, Number(e.target.value) || 1))} />
                  </div>
                  <Button onClick={generate} disabled={pending} className="gap-1.5">
                    {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ticket className="h-4 w-4" />} Generate
                  </Button>
                </div>
                {generated.length > 0 && (
                  <>
                    <div className="rounded-lg border border-border bg-muted/40 p-4">
                      <div className="mb-2 flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm font-medium">{generated.length} voucher link(s) ready</p>
                        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => copyText(generated.map(redeemUrl).join("\n"))}>
                          <Link2 className="h-3.5 w-3.5" /> Copy links
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">Copy the links and send them to the client yourself, or email the whole batch below.</p>
                    </div>
                    <VoucherClientEmailCard serviceLabel="Pre-Hire®" defaultOpen initialName={contactDisplayName(details)} initialEmail={details.contactEmail} items={generated.map((c) => ({ code: c, link: redeemUrl(c) }))} />
                  </>
                )}
                <div>
                  <Button variant="outline" onClick={() => setStep(2)} className="gap-1.5"><ChevronLeft className="h-4 w-4" /> Back</Button>
                </div>
              </>
            )}

            {/* STEP 3b — to applicants */}
            {step === 3 && target === "delegates" && (
              <>
                <p className="text-sm text-muted-foreground">
                  Upload a text/CSV file of applicant emails (or paste them, one per line as <code className="font-mono">email</code> or <code className="font-mono">email,name</code>). Each applicant gets their own single-use link emailed to them.
                </p>
                <div className="flex items-center gap-2">
                  <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted">
                    <Upload className="h-3.5 w-3.5" /> Upload list (CSV / TXT)
                    <input
                      type="file"
                      accept=".csv,.txt,.tsv,text/csv,text/plain"
                      className="hidden"
                      disabled={delegateBusy}
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) importEmailsFromFile(f); e.currentTarget.value = ""; }}
                    />
                  </label>
                  {delegateText.trim() && (
                    <button type="button" onClick={() => { setDelegateText(""); setDelegateMsg(null); }} className="text-xs text-muted-foreground hover:text-foreground hover:underline">Clear</button>
                  )}
                </div>
                <textarea
                  value={delegateText}
                  onChange={(e) => setDelegateText(e.target.value)}
                  rows={5}
                  placeholder={"one email per line\nahmed@client.com\nsara@client.com, Sara Ali"}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm"
                  disabled={delegateBusy}
                />
                {delegateMsg && <div className="rounded-md bg-emerald-50 p-2.5 text-sm text-emerald-700">{delegateMsg}</div>}
                <div className="flex flex-col items-stretch justify-between gap-2 sm:flex-row sm:items-center">
                  <Button variant="outline" onClick={() => setStep(2)} className="gap-1.5"><ChevronLeft className="h-4 w-4" /> Back</Button>
                  <Button onClick={sendToDelegates} disabled={delegateBusy || !delegateText.trim()} className="gap-1.5">
                    {delegateBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ticket className="h-4 w-4" />} Generate &amp; email each applicant
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Existing vouchers */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Existing vouchers</CardTitle>
        </CardHeader>
        <CardContent>
          {vouchers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No Pre-Hire vouchers issued yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Requisition</TableHead>
                  <TableHead>Seats</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Link</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vouchers.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell>
                      <span className="font-mono text-xs">{v.code}</span>
                      {v.label ? <span className="ms-2 text-xs text-muted-foreground">{v.label}</span> : null}
                      {v.assigned_email ? (
                        <span className="ms-2 text-xs text-muted-foreground">{v.assigned_name || v.assigned_email}</span>
                      ) : null}
                    </TableCell>
                    <TableCell>{v.requisition_title ?? "-"}</TableCell>
                    <TableCell className="tabular-nums">
                      {v.used_count}/{v.max_uses}
                    </TableCell>
                    <TableCell>
                      {v.status === "active" ? (
                        <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-50">{v.status}</Badge>
                      ) : (
                        <Badge variant="secondary">{v.status}</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <button
                        onClick={() => copyText(redeemUrl(v.code))}
                        className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
                      >
                        <Copy className="h-3 w-3" /> Copy
                      </button>
                    </TableCell>
                    <TableCell className="text-right">
                      {v.status === "active" && (
                        <button
                          onClick={() => onDisable(v.id)}
                          disabled={pending}
                          className="inline-flex items-center gap-1 text-xs text-rose-600 hover:underline disabled:opacity-50"
                        >
                          <Ban className="h-3 w-3" /> Disable
                        </button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
