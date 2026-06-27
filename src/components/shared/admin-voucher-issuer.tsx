"use client";

import { useState, useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { VoucherClientEmailCard } from "@/components/shared/voucher-client-email-card";
import { Loader2, Ticket, Copy, Ban, Link2, Mail, SlidersHorizontal, Upload, ChevronLeft, ChevronRight, Building2, Users } from "lucide-react";
import { fmtDate } from "@/lib/utils/format-date";
import { copyToClipboard } from "@/lib/utils/clipboard";
import { emailVoucherLinksToDelegatesAction } from "@/lib/vouchers/email-actions";

// ─────────────────────────────────────────────────────────────
// Shared admin voucher-issuer shell - a guided 3-step wizard used by every
// service's admin voucher page: (1) details + per-service options, (2) deliver
// to the client or to delegates, (3a) generate a batch then copy/email it to the
// client, or (3b) upload/paste a delegate list and email each one their own
// link. Each service supplies its own options + generate/disable actions, so the
// flow is identical and only the options block differs.
// ─────────────────────────────────────────────────────────────

export type AdminVoucherRow = {
  id: string;
  code: string;
  label: string | null;
  client_name: string | null;
  max_uses: number;
  used_count: number;
  status: string;
  expires_at: string | null;
  created_at: string;
};

export type GenerateCommon = {
  count: number;
  maxUses: number;
  clientName: string;
  label: string;
  expiresAt: string | null;
};

export type AdminVoucherIssuerProps = {
  /** public redeem route, e.g. "/ac/fluent/redeem" - used to build copy links */
  redeemPath: string;
  clients: string[];
  vouchers: AdminVoucherRow[];
  /** Per-service inline options rendered in step 1 (small fields). */
  options?: ReactNode;
  /** Per-service options rendered as a full-width block in step 1
   *  (for richer panels, e.g. Persona's purpose + scope picker). */
  optionsBlock?: ReactNode;
  /** Short service name for the options callout header + emails, e.g. "Fluent". */
  optionsLabel?: string;
  onGenerate: (c: GenerateCommon) => Promise<{ codes: string[] } | { error: string }>;
  onDisable?: (id: string) => Promise<{ ok: true } | { error: string }>;
  /** Optional per-row "email this code" action (parent owns the prompt + toasts). */
  onEmailRow?: (code: string) => Promise<void>;
  /** Per-service badge shown next to the client in each table row (e.g. "Proctored"). */
  rowBadge?: (v: AdminVoucherRow) => ReactNode;
  /** Hide common fields a service doesn't use. */
  showClient?: boolean;
  showLabel?: boolean;
  showExpiry?: boolean;
  clientPlaceholder?: string;
};

export function AdminVoucherIssuer({
  redeemPath,
  clients,
  vouchers,
  options,
  onGenerate,
  onDisable,
  onEmailRow,
  optionsBlock,
  optionsLabel,
  rowBadge,
  showClient = true,
  showLabel = true,
  showExpiry = true,
  clientPlaceholder = "Tag to a client org",
}: AdminVoucherIssuerProps) {
  const router = useRouter();
  const serviceLabel = optionsLabel ?? "assessment";

  // Wizard state
  const [step, setStep] = useState(1);
  const [target, setTarget] = useState<"client" | "delegates" | null>(null);

  // Shared fields
  const [count, setCount] = useState(1);
  const [label, setLabel] = useState("");
  const [clientName, setClientName] = useState("");
  const [maxUses, setMaxUses] = useState(1);
  const [expiresAt, setExpiresAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [lastCodes, setLastCodes] = useState<string[]>([]);

  // Delegate path state
  const [delegates, setDelegates] = useState("");
  const [delegateBusy, setDelegateBusy] = useState(false);
  const [delegateMsg, setDelegateMsg] = useState<string | null>(null);

  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const fullLink = (code: string) => `${origin}${redeemPath}?code=${encodeURIComponent(code)}`;

  const copy = async (text: string) => {
    try {
      await copyToClipboard(text);
      toast.message("Copied to clipboard.");
    } catch {
      toast.error("Copy failed.");
    }
  };

  const generate = async () => {
    setBusy(true);
    const res = await onGenerate({ count, maxUses, clientName, label, expiresAt: expiresAt || null });
    setBusy(false);
    if ("error" in res) {
      toast.error(res.error);
      return;
    }
    setLastCodes(res.codes);
    toast.success(`Generated ${res.codes.length} code${res.codes.length === 1 ? "" : "s"}.`);
    router.refresh();
  };

  const disable = async (id: string) => {
    if (!onDisable) return;
    if (!confirm("Disable this voucher? Unredeemed seats become unusable.")) return;
    const res = await onDisable(id);
    if ("error" in res) toast.error(res.error);
    else {
      toast.success("Voucher disabled.");
      router.refresh();
    }
  };

  const parseDelegates = (raw: string): { email: string; name?: string }[] =>
    raw
      .split(/\r?\n/)
      .map((line) => {
        const [email, ...rest] = line.split(",");
        return { email: (email ?? "").trim(), name: rest.join(",").trim() || undefined };
      })
      .filter((d) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email));

  // Pull emails from an uploaded CSV/TXT regardless of column layout.
  const importEmailsFromFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      const found = (text.match(/[^\s,;:<>"'()[\]]+@[^\s,;:<>"'()[\]]+\.[^\s,;:<>"'()[\]]+/g) ?? [])
        .map((e) => e.trim())
        .filter((e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e));
      if (!found.length) {
        toast.error("No email addresses found in that file.");
        return;
      }
      const existing = delegates.split(/\r?\n/).map((l) => l.split(",")[0]?.trim().toLowerCase()).filter(Boolean);
      const merged = Array.from(new Set([...existing, ...found.map((e) => e.toLowerCase())]));
      setDelegates(merged.join("\n"));
      setDelegateMsg(`Loaded ${found.length} email(s) from ${file.name}.`);
    };
    reader.onerror = () => toast.error("Could not read that file.");
    reader.readAsText(file);
  };

  const sendToDelegates = async () => {
    const parsed = parseDelegates(delegates);
    if (!parsed.length) {
      toast.error("Add at least one email (one per line, optionally email,name).");
      return;
    }
    setDelegateBusy(true);
    setDelegateMsg(null);
    // One single-use code per delegate, then email each their own link.
    const res = await onGenerate({ count: parsed.length, maxUses: 1, clientName, label, expiresAt: expiresAt || null });
    if ("error" in res) {
      setDelegateBusy(false);
      toast.error(res.error);
      return;
    }
    const codes = res.codes;
    setLastCodes(codes);
    const recipients = parsed
      .map((d, i) => ({ email: d.email, name: d.name, link: codes[i] ? fullLink(codes[i]) : "" }))
      .filter((r) => r.link.length > 0);
    const mail = await emailVoucherLinksToDelegatesAction({ serviceLabel, recipients });
    setDelegateBusy(false);
    if ("error" in mail) {
      toast.error(mail.error);
      return;
    }
    setDelegateMsg(`Generated ${codes.length} code(s) and emailed ${mail.sent} of ${mail.total} delegate(s).`);
    toast.success(`Emailed ${mail.sent} of ${mail.total} delegate(s).`);
    setDelegates("");
    router.refresh();
  };

  return (
    <div className="space-y-6">
      {/* ── Issue wizard ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Issue {optionsLabel ? `${optionsLabel} ` : ""}vouchers</CardTitle>
          <p className="text-sm text-muted-foreground">
            {step === 1 && "Step 1 of 3 · Who is this for?"}
            {step === 2 && "Step 2 of 3 · How should the vouchers reach people?"}
            {step === 3 && target === "client" && "Step 3 of 3 · Send the batch to the client"}
            {step === 3 && target === "delegates" && "Step 3 of 3 · Email a link to each delegate"}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
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
        </CardHeader>
        <CardContent className="space-y-4">
          {/* STEP 1 — details + options */}
          {step === 1 && (
            <>
              <div className="flex flex-wrap items-end gap-3">
                {showClient && (
                  <div className="flex-1 min-w-[12rem] space-y-1.5">
                    <Label className="text-xs">Client (optional)</Label>
                    <Input value={clientName} onChange={(e) => setClientName(e.target.value)} list="avi-client-list" placeholder={clientPlaceholder} />
                    <datalist id="avi-client-list">
                      {clients.map((c) => (
                        <option key={c} value={c} />
                      ))}
                    </datalist>
                  </div>
                )}
                {showLabel && (
                  <div className="flex-1 min-w-[10rem] space-y-1.5">
                    <Label className="text-xs">Label (optional)</Label>
                    <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Q3 intake" />
                  </div>
                )}
                {showExpiry && (
                  <div className="w-44 space-y-1.5">
                    <Label className="text-xs">Expires (optional)</Label>
                    <Input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
                  </div>
                )}
              </div>
              {options && (
                <div className="rounded-lg border border-dashed border-[#5391D5]/50 bg-[#5391D5]/5 p-3">
                  <div className="mb-2.5 flex items-center gap-1.5 text-sm font-semibold text-[#010131]">
                    <SlidersHorizontal className="h-4 w-4 text-[#5391D5]" />
                    {optionsLabel ? `${optionsLabel} options` : "Options"}
                  </div>
                  <div className="flex flex-wrap items-end gap-3">{options}</div>
                </div>
              )}
              {optionsBlock}
              <div className="flex justify-end">
                <Button onClick={() => setStep(2)} className="gap-1.5">
                  Next <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </>
          )}

          {/* STEP 2 — delivery choice */}
          {step === 2 && (
            <>
              <p className="text-sm text-muted-foreground">
                Do you want the vouchers sent to the client to distribute, or emailed to each delegate directly?
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => { setTarget("client"); setLastCodes([]); setStep(3); }}
                  className="rounded-lg border border-border p-4 text-left transition hover:border-[#5391D5] hover:bg-[#5391D5]/5"
                >
                  <div className="flex items-center gap-2 text-sm font-semibold text-[#010131]"><Building2 className="h-4 w-4 text-[#5391D5]" /> Send to the client</div>
                  <p className="mt-1 text-xs text-muted-foreground">Generate a batch, then email or copy the links to the client - they distribute to their people.</p>
                </button>
                <button
                  type="button"
                  onClick={() => { setTarget("delegates"); setStep(3); }}
                  className="rounded-lg border border-border p-4 text-left transition hover:border-[#5391D5] hover:bg-[#5391D5]/5"
                >
                  <div className="flex items-center gap-2 text-sm font-semibold text-[#010131]"><Users className="h-4 w-4 text-[#5391D5]" /> Send to delegates</div>
                  <p className="mt-1 text-xs text-muted-foreground">Upload or paste a list of emails; each delegate gets their own link.</p>
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
                  <Input type="number" min={1} value={maxUses} onChange={(e) => setMaxUses(Math.max(1, Number(e.target.value) || 1))} />
                </div>
                <Button onClick={generate} disabled={busy} className="gap-1.5">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ticket className="h-4 w-4" />} Generate
                </Button>
              </div>
              {lastCodes.length > 0 && (
                <>
                  <div className="rounded-lg border border-border bg-muted/40 p-4">
                    <div className="mb-2 flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-sm font-medium">{lastCodes.length} voucher link(s) ready</p>
                      <Button size="sm" variant="outline" className="gap-1.5" onClick={() => copy(lastCodes.map(fullLink).join("\n"))}>
                        <Link2 className="h-3.5 w-3.5" /> Copy links
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">Copy the links and send them to the client yourself, or email the whole batch below.</p>
                  </div>
                  <VoucherClientEmailCard serviceLabel={serviceLabel} defaultOpen items={lastCodes.map((c) => ({ code: c, link: fullLink(c) }))} />
                </>
              )}
              <div>
                <Button variant="outline" onClick={() => setStep(2)} className="gap-1.5"><ChevronLeft className="h-4 w-4" /> Back</Button>
              </div>
            </>
          )}

          {/* STEP 3b — to delegates */}
          {step === 3 && target === "delegates" && (
            <>
              <p className="text-sm text-muted-foreground">
                Upload a text/CSV file of delegate emails (or paste them, one per line as <code className="font-mono">email</code> or <code className="font-mono">email,name</code>). Each delegate gets their own single-use link emailed to them.
              </p>
              <div className="flex items-center gap-2">
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted">
                  <Upload className="h-3.5 w-3.5" /> Upload list (CSV / TXT)
                  <input
                    type="file"
                    accept=".csv,.txt,.tsv,text/csv,text/plain"
                    className="hidden"
                    disabled={delegateBusy}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) importEmailsFromFile(f);
                      e.currentTarget.value = "";
                    }}
                  />
                </label>
                {delegates.trim() && (
                  <button type="button" onClick={() => { setDelegates(""); setDelegateMsg(null); }} className="text-xs text-muted-foreground hover:text-foreground hover:underline">
                    Clear
                  </button>
                )}
              </div>
              <textarea
                value={delegates}
                onChange={(e) => setDelegates(e.target.value)}
                rows={5}
                placeholder={"one email per line\nahmed@client.com\nsara@client.com, Sara Ali"}
                className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm"
                disabled={delegateBusy}
              />
              {delegateMsg && <div className="rounded-md bg-emerald-50 p-2.5 text-sm text-emerald-700">{delegateMsg}</div>}
              <div className="flex flex-col items-stretch justify-between gap-2 sm:flex-row sm:items-center">
                <Button variant="outline" onClick={() => setStep(2)} className="gap-1.5"><ChevronLeft className="h-4 w-4" /> Back</Button>
                <Button onClick={sendToDelegates} disabled={delegateBusy || !delegates.trim()} className="gap-1.5">
                  {delegateBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ticket className="h-4 w-4" />} Generate &amp; email each delegate
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All vouchers</CardTitle>
        </CardHeader>
        <CardContent>
          {vouchers.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No vouchers yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  {showClient && <TableHead>Client</TableHead>}
                  {showLabel && <TableHead>Label</TableHead>}
                  <TableHead>Seats</TableHead>
                  <TableHead>Status</TableHead>
                  {showExpiry && <TableHead>Expires</TableHead>}
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vouchers.map((v) => {
                  const exhausted = v.used_count >= v.max_uses;
                  return (
                    <TableRow key={v.id}>
                      <TableCell className="font-mono text-xs">{v.code}</TableCell>
                      {showClient && (
                        <TableCell className="text-sm">
                          {v.client_name ?? "-"}
                          {rowBadge?.(v)}
                        </TableCell>
                      )}
                      {showLabel && <TableCell className="text-sm text-muted-foreground">{v.label ?? "-"}</TableCell>}
                      <TableCell className="text-sm tabular-nums">
                        {v.used_count}/{v.max_uses}
                      </TableCell>
                      <TableCell>
                        {v.status === "disabled" ? (
                          <Badge variant="secondary">Disabled</Badge>
                        ) : exhausted ? (
                          <Badge variant="outline">Fully used</Badge>
                        ) : (
                          <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-50">Active</Badge>
                        )}
                      </TableCell>
                      {showExpiry && <TableCell className="text-xs text-muted-foreground">{fmtDate(v.expires_at)}</TableCell>}
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" className="h-8 gap-1 px-2 text-xs" title="Copy redemption link (send to client)" onClick={() => copy(fullLink(v.code))}>
                            <Link2 className="h-3.5 w-3.5" /> Link
                          </Button>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Copy code only" onClick={() => copy(v.code)}>
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                          {onEmailRow && v.status === "active" && (
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Email link" onClick={() => onEmailRow(v.code)}>
                              <Mail className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {onDisable && v.status === "active" && (
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive" title="Disable" onClick={() => disable(v.id)}>
                              <Ban className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
