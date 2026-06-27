"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Send, Link2, Copy, Loader2, Users, Upload, X, Check, Minus, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CollapsibleCard } from "@/components/shared/collapsible-card";
import { VoucherClientEmailCard } from "@/components/shared/voucher-client-email-card";
import { VoucherDetailsFields, contactDisplayName, EMPTY_VOUCHER_DETAILS, type VoucherDetails } from "@/components/shared/voucher-details-fields";
import type { IssuedVoucher } from "@/lib/role-readiness/vouchers";

type Mode = "individual" | "pool";
type Delegate = { email: string; name: string };
type IssueInput = {
  mode: Mode;
  emails?: string[];
  delegates?: Delegate[];
  seats?: number;
  sendEmails?: boolean;
  origin?: string;
  clientName?: string;
  projectLabel?: string;
  expiresAt?: string;
  contactName?: string;
  contactTitle?: string;
  contactEmail?: string;
};
type IssueResult = { ok: true; vouchers: IssuedVoucher[] } | { error: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Split one line into cells, honouring tab/semicolon separators and double-quoted
// CSV fields that contain commas (e.g. "Smith, John",jane@org.com -> 2 cells).
function splitLine(line: string): string[] {
  if (line.includes("\t")) return line.split("\t").map((c) => c.trim());
  const cells: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else cur += c;
    } else if (c === '"') inQuotes = true;
    else if (c === "," || c === ";") { cells.push(cur.trim()); cur = ""; }
    else cur += c;
  }
  cells.push(cur.trim());
  return cells;
}

// Parse a delegate list (.csv / .txt) into {name, email}. Per row: the cell that
// looks like an email is the email; the FIRST other non-empty cell is the name
// (names lead in typical "Name, Email[, Role, Dept]" sheets). Header/blank rows
// (no email) are skipped; duplicate emails are de-duped.
async function parseDelegateFile(file: File): Promise<{ delegates: Delegate[]; error?: string }> {
  let rows: string[][] = [];
  try {
    const text = (await file.text()).replace(/^﻿/, ""); // strip UTF-8 BOM
    rows = text.split(/\r?\n/).map(splitLine);
  } catch {
    return { delegates: [], error: "Could not read that file. Use a CSV or plain text file." };
  }
  const out: Delegate[] = [];
  const seen = new Set<string>();
  for (const cells of rows) {
    const trimmed = cells.map((c) => (c || "").trim()).filter(Boolean);
    const email = trimmed.find((c) => EMAIL_RE.test(c));
    if (!email) continue;
    const key = email.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const name = trimmed.find((c) => c !== email) || "";
    out.push({ email: key, name });
  }
  if (out.length === 0) return { delegates: [], error: "No rows with a valid email found. Use a name + email per row." };
  return { delegates: out };
}

// Role Readiness voucher issuance - same model as the other portals: individual
// single-use vouchers (one complete link per recipient, optionally emailed) OR one
// shared link with N seats. The parent supplies `onIssue`.
export function RrVoucherPanel({ onIssue }: { onIssue: (input: IssueInput) => Promise<IssueResult> }) {
  const [mode, setMode] = useState<Mode>("individual");
  const [step, setStep] = useState(1);
  const [details, setDetails] = useState<VoucherDetails>(EMPTY_VOUCHER_DETAILS);
  const [text, setText] = useState("");
  const [seats, setSeats] = useState(10);
  const [origin, setOrigin] = useState("");
  const [delegates, setDelegates] = useState<Delegate[]>([]);
  const [fileName, setFileName] = useState("");
  const [sendEmails, setSendEmails] = useState(false);
  const [result, setResult] = useState<{ mode: Mode; vouchers: IssuedVoucher[] } | null>(null);
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => setOrigin(window.location.origin), []);

  const redeemUrl = (v: IssuedVoucher) => {
    const p = new URLSearchParams({ code: v.code });
    if (v.email) p.set("email", v.email);
    if (v.name) p.set("name", v.name);
    return `${origin.replace(/\/$/, "")}/role-readiness/redeem?${p.toString()}`;
  };
  const copy = (s: string) => { navigator.clipboard.writeText(s); toast.success("Copied"); };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    const { delegates: parsed, error } = await parseDelegateFile(file);
    if (error) { toast.error(error); return; }
    setDelegates(parsed);
    setFileName(file.name);
    setSendEmails(true); // upload flow defaults to emailing each delegate
    toast.success(`Loaded ${parsed.length} delegate(s) from ${file.name}`);
  };
  const clearFile = () => { setDelegates([]); setFileName(""); if (fileRef.current) fileRef.current.value = ""; };

  const issue = () =>
    start(async () => {
      const det = {
        clientName: details.clientName.trim() || undefined,
        projectLabel: details.projectLabel.trim() || undefined,
        expiresAt: details.expiresAt || undefined,
        contactName: details.contactName.trim() || undefined,
        contactTitle: details.contactTitle.trim() || undefined,
        contactEmail: details.contactEmail.trim() || undefined,
      };
      const payload: IssueInput =
        mode === "individual"
          ? delegates.length > 0
            ? { mode, delegates, sendEmails, origin, ...det }
            : { mode, emails: text.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean), sendEmails, origin, ...det }
          : { mode, seats, ...det };
      const res = await onIssue(payload);
      if ("error" in res) { toast.error(res.error); return; }
      setResult({ mode, vouchers: res.vouchers });
      if (mode === "individual") { setText(""); clearFile(); }
      if (mode === "pool") toast.success(`Shared link created - ${res.vouchers[0]?.maxUses} seats`);
      else {
        const sent = res.vouchers.filter((v) => v.emailed).length;
        toast.success(sendEmails ? `Created ${res.vouchers.length} voucher(s), emailed ${sent}` : `Created ${res.vouchers.length} voucher(s)`);
      }
    });

  return (
    <CollapsibleCard title="Issue vouchers" icon={Send} defaultOpen={false}
      subtitle="Individual links per delegate (with optional email), or one shared multi-seat link">
      <div className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
        {["Details", "Delivery", "Issue"].map((s, i) => {
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

      {step === 1 && (
        <div className="space-y-4">
          <VoucherDetailsFields value={details} onChange={setDetails} />
          <div className="flex justify-end">
            <Button onClick={() => setStep(2)} className="gap-1.5">Next <ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <>
          <div className="mb-3">
            <Button variant="outline" size="sm" onClick={() => setStep(1)} className="gap-1.5"><ChevronLeft className="h-3.5 w-3.5" /> Back</Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <button type="button" onClick={() => { setMode("individual"); setStep(3); }} className="rounded-lg border border-border p-4 text-left transition hover:border-[#5391D5] hover:bg-[#5391D5]/5">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#010131]"><Send className="h-4 w-4 text-[#5391D5]" /> Send to delegates</div>
              <p className="mt-1 text-xs text-muted-foreground">A single-use link per delegate (upload or paste a list), optionally emailed to each.</p>
            </button>
            <button type="button" onClick={() => { setMode("pool"); setStep(3); }} className="rounded-lg border border-border p-4 text-left transition hover:border-[#5391D5] hover:bg-[#5391D5]/5">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#010131]"><Users className="h-4 w-4 text-[#5391D5]" /> One shared link</div>
              <p className="mt-1 text-xs text-muted-foreground">One link with the seats you choose - share it with the whole group.</p>
            </button>
          </div>
        </>
      )}

      {step === 3 && (
      <>
      <div className="mb-3">
        <Button variant="outline" size="sm" onClick={() => setStep(2)} className="gap-1.5"><ChevronLeft className="h-3.5 w-3.5" /> Back</Button>
      </div>

      {mode === "individual" ? (
        <>
          {/* Upload a delegate list */}
          <div className="mt-3 rounded-lg border border-dashed border-border p-3">
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => fileRef.current?.click()}>
                <Upload className="h-3.5 w-3.5" /> Upload delegate list
              </Button>
              <input ref={fileRef} type="file" accept=".csv,.txt,text/csv,text/plain" className="hidden"
                onChange={(e) => onFile(e.target.files?.[0])} />
              <span className="text-[11px] text-muted-foreground">CSV or text - a name + email per row (in Excel, Save As CSV).</span>
            </div>
            {delegates.length > 0 && (
              <div className="mt-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-foreground">{delegates.length} delegate(s) from {fileName}</span>
                  <button type="button" onClick={clearFile} className="inline-flex items-center gap-1 text-muted-foreground hover:text-destructive"><X className="h-3 w-3" /> Clear</button>
                </div>
                <div className="mt-1.5 max-h-32 overflow-y-auto rounded border bg-muted/40 p-2 text-[11px]">
                  {delegates.map((d) => (
                    <div key={d.email} className="flex justify-between gap-2 py-0.5">
                      <span className="truncate">{d.name || <span className="text-muted-foreground">(no name)</span>}</span>
                      <span className="shrink-0 font-mono text-muted-foreground">{d.email}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Or paste emails */}
          {delegates.length === 0 && (
            <>
              <p className="mt-3 text-xs text-muted-foreground">...or paste one email per line (no names). Each gets a single-use voucher + a complete link.</p>
              <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} dir="ltr"
                placeholder={"jane@org.com\nomar@org.com"}
                className="mt-2 w-full rounded-md border border-border bg-background p-3 font-mono text-xs focus:border-[#5391D5] focus:outline-none" />
            </>
          )}

          <label className="mt-3 flex cursor-pointer items-center gap-2 text-xs text-foreground">
            <input type="checkbox" checked={sendEmails} onChange={(e) => setSendEmails(e.target.checked)} className="h-3.5 w-3.5" />
            Email each delegate their link automatically
          </label>
          {sendEmails && (
            <p className="mt-1 text-[11px] text-muted-foreground">Emails send via VIFM. If one lands in spam, you can still copy the link below and send it yourself.</p>
          )}

          <Button onClick={issue} disabled={pending || (delegates.length === 0 && !text.trim())} className="mt-2 gap-2">
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Generate vouchers
          </Button>
        </>
      ) : (
        <>
          <p className="mt-3 text-xs text-muted-foreground">One code with the seats you choose - share the same link with your group.</p>
          <div className="mt-2 flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-xs">
              <span className="text-muted-foreground">Seats</span>
              <Input type="number" min={1} value={seats} onChange={(e) => setSeats(Math.max(1, Number(e.target.value) || 1))} className="w-32" />
            </label>
            <Button onClick={issue} disabled={pending || seats < 1} className="gap-2">
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />} Generate shared link
            </Button>
          </div>
        </>
      )}

      {result && result.mode === "individual" && (
        <div className="mt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Recipient</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Link</TableHead>
                <TableHead>Emailed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.vouchers.map((v) => (
                <TableRow key={v.code}>
                  <TableCell>{v.name ?? "-"}</TableCell>
                  <TableCell>{v.email ?? "-"}</TableCell>
                  <TableCell className="font-mono text-xs">{v.code}</TableCell>
                  <TableCell>
                    <button type="button" onClick={() => copy(redeemUrl(v))} className="inline-flex items-center gap-1 rounded border px-2 py-0.5 hover:bg-muted">
                      <Copy className="h-3 w-3" /> Copy
                    </button>
                  </TableCell>
                  <TableCell>
                    {v.emailed === undefined ? <Minus className="h-3.5 w-3.5 text-muted-foreground" />
                      : v.emailed ? <Check className="h-3.5 w-3.5 text-emerald-600" />
                      : <X className="h-3.5 w-3.5 text-rose-500" />}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="mt-2 text-[11px] text-muted-foreground">Each link prefills the delegate&apos;s name + email. Copy a link to send manually if needed.</p>
        </div>
      )}

      {result && result.mode === "pool" && result.vouchers[0] && (
        <div className="mt-4">
          <div className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground">
            <Users className="h-4 w-4 text-[#5391D5]" /> Shared link - {result.vouchers[0].maxUses} seats
          </div>
          <div className="mt-2 flex items-center gap-2">
            <input readOnly value={redeemUrl(result.vouchers[0])} onFocus={(e) => e.currentTarget.select()}
              className="flex-1 rounded-md border border-border bg-muted px-3 py-2 font-mono text-xs text-foreground" />
            <button type="button" onClick={() => copy(redeemUrl(result.vouchers[0]))} className="inline-flex items-center gap-1 rounded border px-3 py-2 text-xs hover:bg-muted">
              <Copy className="h-3 w-3" /> Copy link
            </button>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">Share this one link with your group. The first {result.vouchers[0].maxUses} people to open it can take the assessment.</p>
          <div className="mt-3">
            <VoucherClientEmailCard serviceLabel="Role Readiness" defaultOpen initialName={contactDisplayName(details)} initialEmail={details.contactEmail} items={[{ code: result.vouchers[0].code, link: redeemUrl(result.vouchers[0]) }]} />
          </div>
        </div>
      )}
      </>
      )}
    </CollapsibleCard>
  );
}
