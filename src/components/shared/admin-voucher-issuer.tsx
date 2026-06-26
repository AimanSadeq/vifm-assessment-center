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
import { Loader2, Ticket, Copy, Ban, Link2, Mail, Send, SlidersHorizontal } from "lucide-react";
import { fmtDate } from "@/lib/utils/format-date";
import { copyToClipboard } from "@/lib/utils/clipboard";

// ─────────────────────────────────────────────────────────────
// Shared admin voucher-issuer shell. One consistent look + behaviour for every
// service's admin voucher page: a "Generate codes" card (common fields + an
// optional per-service `options` slot), a "Just generated" card with copy-link,
// and an "All vouchers" table with copy-link / copy-code / disable per row.
// Each service renders this with its own options + generate/disable actions, so
// the chrome is identical and only the options block differs.
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
  /** Per-service inline options rendered in the generate field row (small fields). */
  options?: ReactNode;
  /** Per-service options rendered as a full-width block below the field row
   *  (for richer panels, e.g. Persona's purpose + scope picker). */
  optionsBlock?: ReactNode;
  /** Short service name for the options callout header, e.g. "Fluent" -> "Fluent options". */
  optionsLabel?: string;
  onGenerate: (c: GenerateCommon) => Promise<{ codes: string[] } | { error: string }>;
  onDisable?: (id: string) => Promise<{ ok: true } | { error: string }>;
  /** Optional "email links to delegates" card (parent adds its own options, e.g. language). */
  onEmailDelegates?: (a: {
    delegates: { email: string; name?: string }[];
    common: GenerateCommon;
  }) => Promise<{ results: { email: string; ok: boolean; error?: string }[] } | { error: string }>;
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
  onEmailDelegates,
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
  const [count, setCount] = useState(1);
  const [label, setLabel] = useState("");
  const [clientName, setClientName] = useState("");
  const [maxUses, setMaxUses] = useState(1);
  const [expiresAt, setExpiresAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [lastCodes, setLastCodes] = useState<string[]>([]);
  const [delegates, setDelegates] = useState("");
  const [emailing, setEmailing] = useState(false);
  const [emailResults, setEmailResults] = useState<{ email: string; ok: boolean; error?: string }[]>([]);
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
      .filter((d) => d.email.length > 0);

  const sendDelegates = async () => {
    if (!onEmailDelegates) return;
    const parsed = parseDelegates(delegates);
    if (parsed.length === 0) {
      toast.error("Add at least one email (one per line, optionally email,name).");
      return;
    }
    setEmailing(true);
    setEmailResults([]);
    const res = await onEmailDelegates({ delegates: parsed, common: { count, maxUses, clientName, label, expiresAt: expiresAt || null } });
    setEmailing(false);
    if ("error" in res) {
      toast.error(res.error);
      return;
    }
    setEmailResults(res.results);
    const sent = res.results.filter((r) => r.ok).length;
    if (sent === res.results.length) toast.success(`Sent ${sent} link${sent === 1 ? "" : "s"}.`);
    else toast.warning(`Sent ${sent} of ${res.results.length}. See the results below.`);
    router.refresh();
  };

  const genButton = (
    <Button onClick={generate} disabled={busy || count < 1} className="gap-1.5">
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ticket className="h-4 w-4" />}
      Generate
    </Button>
  );
  const hasExtras = !!options || !!optionsBlock;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Generate codes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
          <div className="w-24 space-y-1.5">
            <Label className="text-xs">How many</Label>
            <Input type="number" min={1} max={500} value={count} onChange={(e) => setCount(Number(e.target.value))} />
          </div>
          <div className="w-28 space-y-1.5">
            <Label className="text-xs">Seats / code</Label>
            <Input type="number" min={1} value={maxUses} onChange={(e) => setMaxUses(Number(e.target.value))} />
          </div>
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
            {!hasExtras && genButton}
          </div>
          {options && (
            <div className="rounded-lg border border-dashed border-[#5391D5]/50 bg-[#5391D5]/5 p-3">
              <div className="mb-2.5 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-sm font-semibold text-[#010131]">
                  <SlidersHorizontal className="h-4 w-4 text-[#5391D5]" />
                  {optionsLabel ? `${optionsLabel} options` : "Options"}
                </div>
                <span className="rounded-full bg-[#5391D5]/10 px-2 py-0.5 text-[11px] font-medium text-[#5391D5]">
                  swaps per service
                </span>
              </div>
              <div className="flex flex-wrap items-end gap-3">{options}</div>
            </div>
          )}
          {optionsBlock}
          {hasExtras && genButton}
        </CardContent>
      </Card>

      {onEmailDelegates && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Mail className="h-4 w-4" /> Email links to delegates
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              One delegate per line, as <code className="font-mono">email</code> or <code className="font-mono">email,name</code>.
              Each gets a fresh single-use code emailed as a one-click redeem link. The fields above apply to this batch.
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
                      <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-50">Sent</Badge>
                    ) : (
                      <Badge variant="outline" className="text-destructive" title={r.error}>Failed</Badge>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {lastCodes.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Just generated ({lastCodes.length})</CardTitle>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => copy(lastCodes.map(fullLink).join("\n"))}>
              <Link2 className="h-3.5 w-3.5" /> Copy all links
            </Button>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-xs text-muted-foreground">
              Send the full link to the client - they forward it to the candidate, who starts directly (the code is pre-filled).
            </p>
            <div className="space-y-2">
              {lastCodes.map((c) => (
                <div key={c} className="flex items-center gap-2 rounded border bg-muted/40 px-2.5 py-1.5">
                  <code className="shrink-0 font-mono text-xs text-primary">{c}</code>
                  <span className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">{fullLink(c)}</span>
                  <Button variant="ghost" size="sm" className="h-7 shrink-0 gap-1 px-2 text-xs" onClick={() => copy(fullLink(c))}>
                    <Link2 className="h-3 w-3" /> Copy link
                  </Button>
                </div>
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
