"use client";

import { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import { Ticket, Copy, Download, Check, Ban, RotateCcw, Plus, X, Link2, Upload, BarChart3 } from "lucide-react";
import { fmtDate } from "@/lib/utils/format-date";
import { copyToClipboard } from "@/lib/utils/clipboard";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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

  function onGenerate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    fd.set("itemsPerFactor", itemsPerFactor);
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
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-[#010131]">
          <Ticket className="h-6 w-6 text-[#5391D5]" /> AI Readiness Compass - Vouchers
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Issue access codes for clients - one code per person, or a single seat-pool code the client
          distributes to many applicants. Every code provisions the full 60-question Personal ARC.
        </p>
      </div>

      {/* Assessment length - governs BOTH generation forms below (migration 00143). */}
      <Card>
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-[#010131]">Assessment length</p>
            <p className="text-xs text-muted-foreground">
              How many questions a redeemed code serves - set it per client need.
            </p>
          </div>
          <select
            value={itemsPerFactor}
            onChange={(e) => setItemsPerFactor(e.target.value)}
            className={`${selectClass} sm:w-72`}
            aria-label="Assessment length"
          >
            <option value="">Full ARC - 60 questions</option>
            <option value="12">48 questions (12 per factor)</option>
            <option value="9">36 questions (9 per factor)</option>
            <option value="6">24 questions (6 per factor)</option>
          </select>
        </CardContent>
      </Card>

      {/* Generate */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Generate codes</CardTitle>
          <CardDescription>Personal ARC · length set above · seat pool via &ldquo;uses per code&rdquo;.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onGenerate} className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="count"># of codes</Label>
              <Input id="count" name="count" type="number" min={1} max={500} defaultValue={1} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxUses">Uses per code (seat pool)</Label>
              <Input id="maxUses" name="maxUses" type="number" min={1} defaultValue={1} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="label">Label</Label>
              <Input id="label" name="label" placeholder="e.g. ADNOC pilot" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="organizationId">Client org (tag for tracking)</Label>
                <button
                  type="button"
                  onClick={() => { setShowAddClient((s) => !s); setClientError(null); }}
                  className="inline-flex items-center gap-1 text-xs font-medium text-[#5391D5] hover:underline"
                >
                  {showAddClient ? <><X className="h-3 w-3" /> Cancel</> : <><Plus className="h-3 w-3" /> Add client</>}
                </button>
              </div>
              <select
                id="organizationId"
                name="organizationId"
                className={selectClass}
                value={selectedOrg}
                onChange={(e) => {
                  const id = e.target.value;
                  setSelectedOrg(id);
                  const org = orgList.find((o) => o.id === id);
                  if (org) setBatchRegion(org.region);
                }}
              >
                <option value="">- none -</option>
                {orgList.map((o) => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>

              {showAddClient && (
                <div className="mt-2 space-y-2 rounded-md border border-border bg-muted/40 p-3">
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
            <div className="space-y-2">
              <Label htmlFor="clientName">Client name (free text, optional)</Label>
              <Input id="clientName" name="clientName" placeholder="If not in the list above" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="expiresAt">Expires (optional)</Label>
              <Input id="expiresAt" name="expiresAt" type="date" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="region">Region {selectedOrg && <span className="text-xs font-normal text-muted-foreground">(from client)</span>}</Label>
              <select
                id="region"
                name="region"
                className={selectClass}
                value={batchRegion}
                onChange={(e) => setBatchRegion(e.target.value)}
                disabled={!!selectedOrg}
              >
                <option value="uae">UAE</option>
                <option value="saudi">Saudi</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="language">Language</Label>
              <select id="language" name="language" className={selectClass} defaultValue="en">
                <option value="en">English</option>
                <option value="ar">Arabic</option>
              </select>
            </div>

            {error && <div className="sm:col-span-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

            <div className="sm:col-span-2">
              <Button type="submit" disabled={pending} className="gap-2">
                <Ticket className="h-4 w-4" /> {pending ? "Generating…" : "Generate"}
              </Button>
            </div>
          </form>

          {generated.length > 0 && (
            <div className="mt-5 rounded-lg border border-border bg-muted/40 p-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-medium">{generated.length} code(s) generated</p>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="gap-1" onClick={() => copy(generated.map(redeemLink).join("\n"), "all-links")}>
                    {copied === "all-links" ? <Check className="h-3.5 w-3.5" /> : <Link2 className="h-3.5 w-3.5" />} Copy links
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1" onClick={() => copy(generated.join("\n"), "all")}>
                    {copied === "all" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} Copy codes
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1" onClick={() => downloadCsv(["code,link", ...generated.map((c) => `${c},${redeemLink(c)}`)], "arc-vouchers")}>
                    <Download className="h-3.5 w-3.5" /> CSV
                  </Button>
                </div>
              </div>
              <p className="mb-2.5 text-xs text-muted-foreground">
                Each link opens the redeem page with the code prefilled - send it to the delegate to start.
              </p>
              <div className="space-y-1.5">
                {generated.map((c) => (
                  <div key={c} className="flex items-center justify-between gap-2 rounded bg-card px-2.5 py-1.5">
                    <div className="min-w-0">
                      <code className="text-xs font-medium">{c}</code>
                      <span className="block truncate text-[11px] text-muted-foreground">{redeemLink(c)}</span>
                    </div>
                    <Button size="sm" variant="ghost" className="shrink-0 gap-1" onClick={() => copy(redeemLink(c), `gen-${c}`)}>
                      {copied === `gen-${c}` ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Link2 className="h-3.5 w-3.5" />} Copy link
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Email codes to delegates */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Email codes to delegates</CardTitle>
          <CardDescription>
            One single-use code per email, sent as a one-click link. Uses the client selected above
            {selectedOrg ? "." : " (none - pick a client above to tag + inherit region)."}{" "}
            Paste a list, or upload a CSV / TXT of emails from the client.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
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
                  e.currentTarget.value = ""; // allow re-uploading the same file
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
          <Button onClick={emailDelegates} disabled={emailingDelegates} className="gap-2">
            <Ticket className="h-4 w-4" /> {emailingDelegates ? "Sending..." : "Generate & email"}
          </Button>
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
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="py-2 pe-3 font-medium">Code</th>
                    <th className="py-2 pe-3 font-medium">Label / Client</th>
                    <th className="py-2 pe-3 font-medium">Used</th>
                    <th className="py-2 pe-3 font-medium">Status</th>
                    <th className="py-2 pe-3 font-medium">Expires</th>
                    <th className="py-2 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {vouchers.map((v) => (
                    <tr key={v.id} className="border-b border-border/60">
                      <td className="py-2 pe-3">
                        <button className="inline-flex items-center gap-1 font-mono text-xs hover:underline" onClick={() => copy(v.code, v.id)}>
                          {v.code} {copied === v.id ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3 text-muted-foreground" />}
                        </button>
                      </td>
                      <td className="py-2 pe-3 text-muted-foreground">{v.label ?? v.client_name ?? "-"}</td>
                      <td className="py-2 pe-3 tabular-nums">{v.used_count}/{v.max_uses}</td>
                      <td className="py-2 pe-3">
                        <Badge variant={v.status === "active" ? "secondary" : "outline"}>{v.status}</Badge>
                      </td>
                      <td className="py-2 pe-3 text-muted-foreground">
                        {v.expires_at ? fmtDate(v.expires_at) : "-"}
                      </td>
                      <td className="py-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button size="sm" variant="ghost" className="gap-1" onClick={() => copy(redeemLink(v.code), `link-${v.id}`)} title={redeemLink(v.code)}>
                            {copied === `link-${v.id}` ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Link2 className="h-3.5 w-3.5" />} Link
                          </Button>
                          <Button size="sm" variant="ghost" className="gap-1" disabled={pending} onClick={() => toggle(v)}>
                            {v.status === "active" ? <><Ban className="h-3.5 w-3.5" /> Disable</> : <><RotateCcw className="h-3.5 w-3.5" /> Enable</>}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="py-2 pe-3 font-medium">Company</th>
                    <th className="py-2 pe-3 font-medium">Delegates</th>
                    <th className="py-2 pe-3 font-medium">Started</th>
                    <th className="py-2 pe-3 font-medium">Completed</th>
                    <th className="py-2 pe-3 font-medium">Completion</th>
                    <th className="py-2 pe-3 font-medium">Last redeemed</th>
                    <th className="py-2 font-medium text-right">Insights</th>
                  </tr>
                </thead>
                <tbody>
                  {companies.map((c) => {
                    const pct = c.delegates > 0 ? Math.round((c.completed / c.delegates) * 100) : 0;
                    return (
                      <tr key={c.company} className="border-b border-border/60">
                        <td className="py-2 pe-3 font-medium">{c.company}</td>
                        <td className="py-2 pe-3 tabular-nums">{c.delegates}</td>
                        <td className="py-2 pe-3 tabular-nums">{c.started}</td>
                        <td className="py-2 pe-3 tabular-nums">{c.completed}</td>
                        <td className="py-2 pe-3 tabular-nums">{pct}%</td>
                        <td className="py-2 pe-3 text-muted-foreground">
                          {c.lastRedeemed ? fmtDate(c.lastRedeemed) : "-"}
                        </td>
                        <td className="py-2 text-right">
                          <Link
                            href={`/ara/admin/vouchers/insights?company=${encodeURIComponent(c.company)}`}
                            className="inline-flex items-center gap-1 text-accent hover:underline"
                          >
                            <BarChart3 className="h-3.5 w-3.5" /> View
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
