"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Ticket, Copy, Ban, Link2, Mail, Send } from "lucide-react";
import { fmtDate } from "@/lib/utils/format-date";
import { copyToClipboard } from "@/lib/utils/clipboard";
import {
  generateCognitiveVouchersAction,
  disableCognitiveVoucherAction,
  emailVoucherDelegatesAction,
  emailExistingVoucherCodeAction,
} from "../actions";

export type CognitiveVoucherRow = {
  id: string;
  code: string;
  label: string | null;
  client_name: string | null;
  default_language: "en" | "ar";
  max_uses: number;
  used_count: number;
  status: "active" | "disabled";
  expires_at: string | null;
  created_at: string;
};

const REDEEM_PATH = "/ac/cognitive/redeem";

export function VouchersClient({ vouchers, clients }: { vouchers: CognitiveVoucherRow[]; clients: string[] }) {
  const router = useRouter();
  const [count, setCount] = useState(1);
  const [label, setLabel] = useState("");
  const [clientName, setClientName] = useState("");
  const [projectLabel, setProjectLabel] = useState("");
  const [maxUses, setMaxUses] = useState(1);
  const [expiresAt, setExpiresAt] = useState("");
  const [language, setLanguage] = useState<"en" | "ar">("en");
  const [busy, setBusy] = useState(false);
  const [lastCodes, setLastCodes] = useState<string[]>([]);

  // Email-links-to-delegates panel.
  const [delegates, setDelegates] = useState("");
  const [emailing, setEmailing] = useState(false);
  const [emailResults, setEmailResults] = useState<{ email: string; ok: boolean; error?: string }[]>([]);

  const redeemLink = (code: string) =>
    typeof window !== "undefined"
      ? `${window.location.origin}${REDEEM_PATH}?code=${encodeURIComponent(code)}`
      : `${REDEEM_PATH}?code=${encodeURIComponent(code)}`;

  const generate = async () => {
    setBusy(true);
    const res = await generateCognitiveVouchersAction({
      count,
      label: label || undefined,
      clientName: clientName || undefined,
      projectLabel: projectLabel || undefined,
      maxUses,
      expiresAt: expiresAt || null,
    });
    setBusy(false);
    if ("error" in res) {
      toast.error(res.error);
      return;
    }
    setLastCodes(res.codes);
    toast.success(`Generated ${res.codes.length} code${res.codes.length === 1 ? "" : "s"}.`);
    router.refresh();
  };

  const copy = async (text: string) => {
    try {
      await copyToClipboard(text);
      toast.message("Copied to clipboard.");
    } catch {
      toast.error("Copy failed.");
    }
  };

  const copyLink = async (code: string) => {
    try {
      await copyToClipboard(redeemLink(code));
      toast.message("Redeem link copied.");
    } catch {
      toast.error("Copy failed.");
    }
  };

  // Parse "email" or "email,name" lines.
  const parseDelegates = (raw: string): { email: string; name?: string }[] =>
    raw
      .split(/\r?\n/)
      .map((line) => {
        const [email, ...rest] = line.split(",");
        return { email: (email ?? "").trim(), name: rest.join(",").trim() || undefined };
      })
      .filter((d) => d.email.length > 0);

  const sendDelegates = async () => {
    const parsed = parseDelegates(delegates);
    if (parsed.length === 0) {
      toast.error("Add at least one email (one per line, optionally email,name).");
      return;
    }
    setEmailing(true);
    setEmailResults([]);
    const res = await emailVoucherDelegatesAction({
      delegates: parsed,
      label: label || undefined,
      clientName: clientName || undefined,
      projectLabel: projectLabel || undefined,
      language,
      expiresAt: expiresAt || null,
    });
    setEmailing(false);
    if ("error" in res) {
      toast.error(res.error);
      return;
    }
    setEmailResults(res.results.map((r) => ({ email: r.email, ok: r.ok, error: r.error })));
    const sent = res.results.filter((r) => r.ok).length;
    if (sent === res.results.length) toast.success(`Sent ${sent} link${sent === 1 ? "" : "s"}.`);
    else toast.warning(`Sent ${sent} of ${res.results.length}. See the results below.`);
    router.refresh();
  };

  const emailRow = async (code: string) => {
    const email = window.prompt("Email this code to which address?");
    if (!email) return;
    const res = await emailExistingVoucherCodeAction({ code, email, language });
    if ("error" in res) toast.error(res.error);
    else toast.success(`Sent to ${email.trim()}.`);
  };

  const disable = async (id: string) => {
    if (!confirm("Disable this voucher? Unredeemed seats become unusable.")) return;
    const res = await disableCognitiveVoucherAction(id);
    if ("error" in res) toast.error(res.error);
    else {
      toast.success("Voucher disabled.");
      router.refresh();
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Generate codes</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="w-24 space-y-1.5">
            <Label className="text-xs">How many</Label>
            <Input type="number" min={1} max={500} value={count} onChange={(e) => setCount(Number(e.target.value))} />
          </div>
          <div className="w-28 space-y-1.5">
            <Label className="text-xs">Seats / code</Label>
            <Input type="number" min={1} value={maxUses} onChange={(e) => setMaxUses(Number(e.target.value))} />
          </div>
          <div className="flex-1 min-w-[12rem] space-y-1.5">
            <Label className="text-xs">Client (optional)</Label>
            <Input value={clientName} onChange={(e) => setClientName(e.target.value)} list="cognitive-client-list" placeholder="Tag to a client org" />
            <datalist id="cognitive-client-list">
              {clients.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
          <div className="flex-1 min-w-[12rem] space-y-1.5">
            <Label className="text-xs">Project / cohort (optional)</Label>
            <Input value={projectLabel} onChange={(e) => setProjectLabel(e.target.value)} placeholder="Groups with Persona for reporting" />
          </div>
          <div className="flex-1 min-w-[10rem] space-y-1.5">
            <Label className="text-xs">Label (optional)</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Q3 intake" />
          </div>
          <div className="w-44 space-y-1.5">
            <Label className="text-xs">Expires (optional)</Label>
            <Input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
          </div>
          <div className="w-32 space-y-1.5">
            <Label className="text-xs">Language</Label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value === "ar" ? "ar" : "en")}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="en">English</option>
              <option value="ar">العربية</option>
            </select>
          </div>
          <Button onClick={generate} disabled={busy || count < 1} className="gap-1.5">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ticket className="h-4 w-4" />}
            Generate
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Mail className="h-4 w-4" /> Email links to delegates
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            One delegate per line, as <code className="font-mono">email</code> or{" "}
            <code className="font-mono">email,name</code>. Each gets a fresh single-use code emailed as a
            one-click redeem link. The client, label, language, and expiry above apply to this batch.
          </p>
          <textarea
            value={delegates}
            onChange={(e) => setDelegates(e.target.value)}
            rows={4}
            placeholder={"sara@example.com\nahmed@example.com, Ahmed Ali"}
            className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm"
          />
          <Button onClick={sendDelegates} disabled={emailing || !delegates.trim()} className="gap-1.5">
            {emailing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Send links
          </Button>
          {emailResults.length > 0 && (
            <div className="space-y-1 rounded-md border border-slate-200 p-3 text-sm">
              {emailResults.map((r) => (
                <div key={r.email} className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs">{r.email}</span>
                  {r.ok ? (
                    <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-50">
                      Sent
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-destructive" title={r.error}>
                      Failed
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {lastCodes.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Just generated ({lastCodes.length})</CardTitle>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => copy(lastCodes.join("\n"))}>
              <Copy className="h-3.5 w-3.5" /> Copy all
            </Button>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {lastCodes.map((c) => (
                <code key={c} className="rounded border bg-muted/40 px-2 py-1 font-mono text-xs">{c}</code>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

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
                  <TableHead>Client</TableHead>
                  <TableHead>Label</TableHead>
                  <TableHead>Seats</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vouchers.map((v) => {
                  const exhausted = v.used_count >= v.max_uses;
                  return (
                    <TableRow key={v.id}>
                      <TableCell className="font-mono text-xs">{v.code}</TableCell>
                      <TableCell className="text-sm">{v.client_name ?? "-"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{v.label ?? "-"}</TableCell>
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
                      <TableCell className="text-xs text-muted-foreground">
                        {fmtDate(v.expires_at)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Copy code" onClick={() => copy(v.code)}>
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Copy redeem link" onClick={() => copyLink(v.code)}>
                            <Link2 className="h-3.5 w-3.5" />
                          </Button>
                          {v.status === "active" && !exhausted && (
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Email link" onClick={() => emailRow(v.code)}>
                              <Mail className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {v.status === "active" && (
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
