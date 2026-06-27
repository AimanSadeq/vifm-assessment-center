"use client";

import { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import { Ticket, Copy, Download, Check, Ban, RotateCcw, Plus, X, Link2, Upload, BarChart3, SlidersHorizontal, ChevronLeft, ChevronRight, Building2, Users } from "lucide-react";
import { fmtDate } from "@/lib/utils/format-date";
import { copyToClipboard } from "@/lib/utils/clipboard";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { VoucherClientEmailCard } from "@/components/shared/voucher-client-email-card";
import { createVoucherBatchAction, setVoucherStatusAction, createClientOrgAction, emailVouchersToDelegatesAction } from "../actions";

type VoucherRow = {
  id: string;
  code: string;
  label: string | null;
  client_name: string | null;
  tier: string;
  max_uses: number;
  used_count: number;
  status: string;
  expires_at: string | null;
  created_at: string;
};
type OrgOption = { id: string; name: string; region: string };
type CompanyRollup = {
  company: string;
  delegates: number;
  started: number;
  completed: number;
  lastRedeemed: string | null;
};

const selectClass =
  "h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

// Canonical redeem base. Prefer the live origin (set after mount); fall back to
// the configured site URL so a server-rendered link is still valid.
const SITE_FALLBACK = (process.env.NEXT_PUBLIC_SITE_URL || "https://caliber.viftraining.com").replace(/\/+$/, "");

export function VouchersClient({
  vouchers,
  orgs,
  companies,
}: {
  vouchers: VoucherRow[];
  orgs: OrgOption[];
  companies: CompanyRollup[];
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [generated, setGenerated] = useState<string[]>([]);
  const [copied, setCopied] = useState<string | null>(null);
  // Per-client ARC length - applies to BOTH generation forms. "" = the full
  // deep-dive (60); otherwise the max individual-layer questions per factor.
  const [itemsPerFactor, setItemsPerFactor] = useState("");

  // ── Issue wizard state ──
  const [step, setStep] = useState(1);
  const [target, setTarget] = useState<"client" | "delegates" | null>(null);
  const [count, setCount] = useState(1);
  const [maxUses, setMaxUses] = useState(1);
  const [engagementLabel, setEngagementLabel] = useState("");
  const [language, setLanguage] = useState("en");
  const [contactName, setContactName] = useState("");
  const [contactTitle, setContactTitle] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [expiresAt, setExpiresAt] = useState("");

  // Live origin for shareable redeem links (window is client-only).
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const redeemLink = (code: string) =>
    `${origin || SITE_FALLBACK}/ara/redeem?code=${encodeURIComponent(code)}`;

  // Client orgs are stateful so a newly-added client appears + auto-selects.
  const [orgList, setOrgList] = useState<OrgOption[]>(orgs);
  const [selectedOrg, setSelectedOrg] = useState("");
  // Region inherits from the tagged client; only editable when no client is set.
  const [batchRegion, setBatchRegion] = useState("uae");
  const [showAddClient, setShowAddClient] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [newClientRegion, setNewClientRegion] = useState("uae");
  const [newClientSector, setNewClientSector] = useState("general");
  const [clientError, setClientError] = useState<string | null>(null);
  const [savingClient, setSavingClient] = useState(false);

  // "Email to delegates" state
  const [delegateEmails, setDelegateEmails] = useState("");
  const [emailingDelegates, setEmailingDelegates] = useState(false);
  const [emailResult, setEmailResult] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);

  async function emailDelegates() {
    setEmailError(null);
    setEmailResult(null);
    if (delegateEmails.trim().length < 3) {
      setEmailError("Enter at least one email address.");
      return;
    }
    setEmailingDelegates(true);
    const fd = new FormData();
    fd.set("emails", delegateEmails);
    fd.set("itemsPerFactor", itemsPerFactor);
    if (selectedOrg) fd.set("organizationId", selectedOrg);
    if (expiresAt) fd.set("expiresAt", expiresAt);
    fd.set("contactName", contactName);
    fd.set("contactTitle", contactTitle);
    fd.set("contactEmail", contactEmail);
    const res = await emailVouchersToDelegatesAction(fd);
    setEmailingDelegates(false);
    if (!res.ok) {
      setEmailError(res.error);
      return;
    }
    setEmailResult(`Sent ${res.sent} of ${res.total} invitation(s).`);
    setDelegateEmails("");
  }

  // Pull a delegate list straight from a file (CSV / TXT exported from Excel).
  // We extract every email-looking token regardless of column layout, dedupe
  // against what's already in the box, and fill the textarea.
  function importEmailsFromFile(file: File) {
    setEmailError(null);
    setEmailResult(null);
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      const found = (text.match(/[^\s,;:<>"'()[\]]+@[^\s,;:<>"'()[\]]+\.[^\s,;:<>"'()[\]]+/g) ?? [])
        .map((e) => e.trim().toLowerCase())
        .filter((e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e));
      if (found.length === 0) {
        setEmailError("No email addresses found in that file. Use a CSV/TXT with one email per row.");
        return;
      }
      const existing = delegateEmails.split(/[\n,;]+/).map((e) => e.trim().toLowerCase()).filter(Boolean);
      const merged = Array.from(new Set([...existing, ...found]));
      setDelegateEmails(merged.join("\n"));
      setEmailResult(`Loaded ${found.length} email(s) from ${file.name}. ${merged.length} unique in the list.`);
    };
    reader.onerror = () => setEmailError("Could not read that file.");
    reader.readAsText(file);
  }

  async function saveClient() {
    setClientError(null);
    if (newClientName.trim().length < 2) {
      setClientError("Enter a client name.");
      return;
    }
    setSavingClient(true);
    const fd = new FormData();
    fd.set("name", newClientName.trim());
    fd.set("region", newClientRegion);
    fd.set("sector", newClientSector);
    const res = await createClientOrgAction(fd);
    setSavingClient(false);
    if (!res.ok) {
      setClientError(res.error);
      return;
    }
    setOrgList((prev) => [res.org, ...prev]);
    setSelectedOrg(res.org.id);
    setBatchRegion(res.org.region);
    setNewClientName("");
    setShowAddClient(false);
  }

  function copy(text: string, key: string) {
    void copyToClipboard(text)
      .then(() => {
        setCopied(key);
        setTimeout(() => setCopied(null), 1500);
      })
      .catch(() => {
        /* clipboard + fallback both blocked (e.g. iframe) - don't crash */
      });
  }

  function downloadCsv(lines: string[], prefix = "arc-export") {
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${prefix}-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function generate() {
    setError(null);
    const fd = new FormData();
    fd.set("count", String(count));
    fd.set("maxUses", String(maxUses));
    fd.set("organizationId", selectedOrg);
    fd.set("label", engagementLabel);
    fd.set("region", batchRegion);
    fd.set("language", language);
    fd.set("itemsPerFactor", itemsPerFactor);
    if (expiresAt) fd.set("expiresAt", expiresAt);
    fd.set("contactName", contactName);
    fd.set("contactTitle", contactTitle);
    fd.set("contactEmail", contactEmail);
    startTransition(async () => {
      const res = await createVoucherBatchAction(fd);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setGenerated(res.codes);
    });
  }

  function toggle(v: VoucherRow) {
    startTransition(async () => {
      await setVoucherStatusAction(v.id, v.status === "active" ? "disabled" : "active");
    });
  }

  return (
    <div className="space-y-8">
      {/* ── Issue wizard ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Issue ARC vouchers</CardTitle>
          <CardDescription>
            {step === 1 && "Step 1 of 3 · Who is this for, and how should it be scored?"}
            {step === 2 && "Step 2 of 3 · How should the vouchers reach people?"}
            {step === 3 && target === "client" && "Step 3 of 3 · Send the batch to the client"}
            {step === 3 && target === "delegates" && "Step 3 of 3 · Email a link to each delegate"}
          </CardDescription>
          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
            {["Client & scope", "Delivery", "Issue"].map((s, i) => {
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
          {error && <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

          {/* STEP 1 — client + scope */}
          {step === 1 && (
            <>
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex-1 min-w-[14rem] space-y-1.5">
                  <Label className="text-xs">Which client?</Label>
                  <select
                    className={selectClass}
                    value={selectedOrg}
                    onChange={(e) => {
                      const id = e.target.value;
                      setSelectedOrg(id);
                      const org = orgList.find((o) => o.id === id);
                      if (org) setBatchRegion(org.region);
                    }}
                  >
                    <option value="">- select a client -</option>
                    {orgList.map((o) => (
                      <option key={o.id} value={o.id}>{o.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex-1 min-w-[12rem] space-y-1.5">
                  <Label htmlFor="engLabel" className="text-xs">Project label</Label>
                  <Input id="engLabel" value={engagementLabel} onChange={(e) => setEngagementLabel(e.target.value)} placeholder="e.g. ADNOC AI Readiness 2026" />
                </div>
                <div className="w-44 space-y-1.5">
                  <Label className="text-xs">Expiry date</Label>
                  <Input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
                </div>
              </div>
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex-1 min-w-[12rem] space-y-1.5">
                  <Label className="text-xs">Client contact name</Label>
                  <Input value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="e.g. Sara Ahmed" />
                </div>
                <div className="flex-1 min-w-[10rem] space-y-1.5">
                  <Label className="text-xs">Contact title</Label>
                  <Input value={contactTitle} onChange={(e) => setContactTitle(e.target.value)} placeholder="e.g. L&D Director" />
                </div>
                <div className="flex-1 min-w-[12rem] space-y-1.5">
                  <Label className="text-xs">Contact email (for sending vouchers)</Label>
                  <Input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="contact@client.com" />
                </div>
              </div>
              <div>
                <button
                  type="button"
                  onClick={() => { setShowAddClient((s) => !s); setClientError(null); }}
                  className="inline-flex items-center gap-1 text-xs font-medium text-[#5391D5] hover:underline"
                >
                  {showAddClient ? <><X className="h-3 w-3" /> Cancel</> : <><Plus className="h-3 w-3" /> Add a new client</>}
                </button>
                {showAddClient && (
                  <div className="mt-2 space-y-2 rounded-md border border-border bg-card p-3 sm:max-w-md">
                    <Input
                      placeholder="New client / organisation name"
                      value={newClientName}
                      onChange={(e) => setNewClientName(e.target.value)}
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <select className={selectClass} value={newClientRegion} onChange={(e) => setNewClientRegion(e.target.value)}>
                        <option value="uae">UAE</option>
                        <option value="saudi">Saudi</option>
                      </select>
                      <select className={selectClass} value={newClientSector} onChange={(e) => setNewClientSector(e.target.value)}>
                        <option value="general">General</option>
                        <option value="banking">Banking</option>
                        <option value="government">Government</option>
                      </select>
                    </div>
                    {clientError && <p className="text-xs text-destructive">{clientError}</p>}
                    <Button type="button" size="sm" onClick={saveClient} disabled={savingClient} className="gap-1">
                      <Plus className="h-3.5 w-3.5" /> {savingClient ? "Saving…" : "Save client"}
                    </Button>
                  </div>
                )}
              </div>

              {/* ARC options */}
              <div className="space-y-3 rounded-lg border border-dashed border-[#5391D5]/50 bg-[#5391D5]/5 p-3">
                <div className="flex items-center gap-1.5 text-sm font-semibold text-[#010131]">
                  <SlidersHorizontal className="h-4 w-4 text-[#5391D5]" /> ARC options
                </div>
                <div className="flex flex-wrap items-end gap-3">
                  <div className="w-72 space-y-1.5">
                    <Label className="text-xs">Assessment length</Label>
                    <select value={itemsPerFactor} onChange={(e) => setItemsPerFactor(e.target.value)} className={selectClass} aria-label="Assessment length">
                      <option value="">Full ARC - 60 questions</option>
                      <option value="12">48 questions (12 per factor)</option>
                      <option value="9">36 questions (9 per factor)</option>
                      <option value="6">24 questions (6 per factor)</option>
                    </select>
                  </div>
                  <div className="w-40 space-y-1.5">
                    <Label className="text-xs">Region {selectedOrg && <span className="text-[10px] font-normal text-muted-foreground">(from client)</span>}</Label>
                    <select className={selectClass} value={batchRegion} onChange={(e) => setBatchRegion(e.target.value)} disabled={!!selectedOrg}>
                      <option value="uae">UAE</option>
                      <option value="saudi">Saudi</option>
                    </select>
                  </div>
                  <div className="w-40 space-y-1.5">
                    <Label className="text-xs">Language</Label>
                    <select className={selectClass} value={language} onChange={(e) => setLanguage(e.target.value)}>
                      <option value="en">English</option>
                      <option value="ar">Arabic</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={() => setStep(2)} disabled={!selectedOrg && !engagementLabel.trim()} className="gap-1.5">
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
                  onClick={() => { setTarget("client"); setGenerated([]); setStep(3); }}
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
              <div className="flex justify-start">
                <Button variant="outline" onClick={() => setStep(1)} className="gap-1.5"><ChevronLeft className="h-4 w-4" /> Back</Button>
              </div>
            </>
          )}

          {/* STEP 3 — to client */}
          {step === 3 && target === "client" && (
            <>
              <div className="flex flex-wrap items-end gap-3">
                <div className="w-36 space-y-1.5">
                  <Label className="text-xs">How many vouchers</Label>
                  <Input type="number" min={1} max={500} value={count} onChange={(e) => setCount(Math.max(1, Number(e.target.value) || 1))} />
                </div>
                <div className="w-32 space-y-1.5">
                  <Label className="text-xs">Uses per code</Label>
                  <Input type="number" min={1} value={maxUses} onChange={(e) => setMaxUses(Math.max(1, Number(e.target.value) || 1))} />
                </div>
                <Button onClick={generate} disabled={pending} className="gap-1.5">
                  <Ticket className="h-4 w-4" /> {pending ? "Generating…" : "Generate"}
                </Button>
              </div>

              {generated.length > 0 && (
                <>
                  <div className="rounded-lg border border-border bg-muted/40 p-4">
                    <div className="mb-2 flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-sm font-medium">{generated.length} voucher link(s) ready</p>
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" className="gap-1" onClick={() => copy(generated.map(redeemLink).join("\n"), "all-links")}>
                          {copied === "all-links" ? <Check className="h-3.5 w-3.5" /> : <Link2 className="h-3.5 w-3.5" />} Copy links
                        </Button>
                        <Button size="sm" variant="outline" className="gap-1" onClick={() => downloadCsv(["code,link", ...generated.map((c) => `${c},${redeemLink(c)}`)], "arc-vouchers")}>
                          <Download className="h-3.5 w-3.5" /> CSV
                        </Button>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">Copy the links and send them to the client yourself, or email the whole batch below.</p>
                  </div>
                  <VoucherClientEmailCard
                    serviceLabel="AI Readiness Compass®"
                    defaultOpen
                    initialName={contactTitle ? `${contactName} (${contactTitle})`.trim() : contactName}
                    initialEmail={contactEmail}
                    items={generated.map((c) => ({ code: c, link: redeemLink(c) }))}
                  />
                </>
              )}

              <div className="flex justify-start">
                <Button variant="outline" onClick={() => setStep(2)} className="gap-1.5"><ChevronLeft className="h-4 w-4" /> Back</Button>
              </div>
            </>
          )}

          {/* STEP 3 — to delegates */}
          {step === 3 && target === "delegates" && (
            <>
              <p className="text-sm text-muted-foreground">
                Upload a text/CSV file of delegate emails (or paste them). Each delegate gets their own single-use link emailed to them.
              </p>
              <div className="flex items-center gap-2">
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted">
                  <Upload className="h-3.5 w-3.5" /> Upload list (CSV / TXT)
                  <input
                    type="file"
                    accept=".csv,.txt,.tsv,text/csv,text/plain"
                    className="hidden"
                    disabled={emailingDelegates}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) importEmailsFromFile(f);
                      e.currentTarget.value = "";
                    }}
                  />
                </label>
                {delegateEmails.trim() && (
                  <button
                    type="button"
                    onClick={() => { setDelegateEmails(""); setEmailResult(null); setEmailError(null); }}
                    className="text-xs text-muted-foreground hover:text-foreground hover:underline"
                  >
                    Clear
                  </button>
                )}
              </div>
              <textarea
                className="w-full min-h-[110px] rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder={"one email per line\nahmed@client.com\nsara@client.com"}
                value={delegateEmails}
                onChange={(e) => setDelegateEmails(e.target.value)}
                disabled={emailingDelegates}
              />
              {emailError && <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{emailError}</div>}
              {emailResult && <div className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-700">{emailResult}</div>}
              <div className="flex flex-col items-stretch justify-between gap-2 sm:flex-row sm:items-center">
                <Button variant="outline" onClick={() => setStep(2)} className="gap-1.5"><ChevronLeft className="h-4 w-4" /> Back</Button>
                <Button onClick={emailDelegates} disabled={emailingDelegates || !delegateEmails.trim()} className="gap-1.5">
                  <Ticket className="h-4 w-4" /> {emailingDelegates ? "Sending..." : "Generate & email each delegate"}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">All vouchers ({vouchers.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {vouchers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No vouchers yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Label / Client</TableHead>
                  <TableHead>Used</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vouchers.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell>
                      <button className="inline-flex items-center gap-1 font-mono text-xs hover:underline" onClick={() => copy(v.code, v.id)}>
                        {v.code} {copied === v.id ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3 text-muted-foreground" />}
                      </button>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{v.label ?? v.client_name ?? "-"}</TableCell>
                    <TableCell className="tabular-nums">{v.used_count}/{v.max_uses}</TableCell>
                    <TableCell>
                      <Badge variant={v.status === "active" ? "secondary" : "outline"}>{v.status}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {v.expires_at ? fmtDate(v.expires_at) : "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button size="sm" variant="ghost" className="gap-1" onClick={() => copy(redeemLink(v.code), `link-${v.id}`)} title={redeemLink(v.code)}>
                          {copied === `link-${v.id}` ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Link2 className="h-3.5 w-3.5" />} Link
                        </Button>
                        <Button size="sm" variant="ghost" className="gap-1" disabled={pending} onClick={() => toggle(v)}>
                          {v.status === "active" ? <><Ban className="h-3.5 w-3.5" /> Disable</> : <><RotateCcw className="h-3.5 w-3.5" /> Enable</>}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Redemptions by company */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Redemptions by company</CardTitle>
              <CardDescription>How each company&apos;s delegates are progressing through the Compass.</CardDescription>
            </div>
            {companies.length > 0 && (
              <div className="flex items-center gap-2">
                <Link href="/ara/admin/vouchers/insights">
                  <Button size="sm" variant="outline" className="gap-1">
                    <BarChart3 className="h-3.5 w-3.5" /> Cohort insights
                  </Button>
                </Link>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1"
                  onClick={() =>
                    downloadCsv([
                      "company,delegates,started,completed,last_redeemed",
                      ...companies.map((c) =>
                        [c.company, c.delegates, c.started, c.completed, c.lastRedeemed ?? ""].join(",")
                      ),
                    ])
                  }
                >
                  <Download className="h-3.5 w-3.5" /> CSV
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {companies.length === 0 ? (
            <p className="text-sm text-muted-foreground">No redemptions yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company</TableHead>
                  <TableHead>Delegates</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Completed</TableHead>
                  <TableHead>Completion</TableHead>
                  <TableHead>Last redeemed</TableHead>
                  <TableHead className="text-right">Insights</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {companies.map((c) => {
                  const pct = c.delegates > 0 ? Math.round((c.completed / c.delegates) * 100) : 0;
                  return (
                    <TableRow key={c.company}>
                      <TableCell className="font-medium">{c.company}</TableCell>
                      <TableCell className="tabular-nums">{c.delegates}</TableCell>
                      <TableCell className="tabular-nums">{c.started}</TableCell>
                      <TableCell className="tabular-nums">{c.completed}</TableCell>
                      <TableCell className="tabular-nums">{pct}%</TableCell>
                      <TableCell className="text-muted-foreground">
                        {c.lastRedeemed ? fmtDate(c.lastRedeemed) : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Link
                          href={`/ara/admin/vouchers/insights?company=${encodeURIComponent(c.company)}`}
                          className="inline-flex items-center gap-1 text-accent hover:underline"
                        >
                          <BarChart3 className="h-3.5 w-3.5" /> View
                        </Link>
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
