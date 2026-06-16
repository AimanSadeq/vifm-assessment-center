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
import { Loader2, Ticket, Copy, Ban } from "lucide-react";
import { fmtDate } from "@/lib/utils/format-date";
import { copyToClipboard } from "@/lib/utils/clipboard";
import { generatePersonaVouchersAction, disablePersonaVoucherAction } from "../actions";

export type PersonaVoucherRow = {
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

export function VouchersClient({ vouchers, clients }: { vouchers: PersonaVoucherRow[]; clients: string[] }) {
  const router = useRouter();
  const [count, setCount] = useState(1);
  const [label, setLabel] = useState("");
  const [clientName, setClientName] = useState("");
  const [maxUses, setMaxUses] = useState(1);
  const [expiresAt, setExpiresAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [lastCodes, setLastCodes] = useState<string[]>([]);

  const generate = async () => {
    setBusy(true);
    const res = await generatePersonaVouchersAction({
      count,
      label: label || undefined,
      clientName: clientName || undefined,
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

  const disable = async (id: string) => {
    if (!confirm("Disable this voucher? Unredeemed seats become unusable.")) return;
    const res = await disablePersonaVoucherAction(id);
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
            <Input value={clientName} onChange={(e) => setClientName(e.target.value)} list="persona-client-list" placeholder="Tag to a client org" />
            <datalist id="persona-client-list">
              {clients.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
          <div className="flex-1 min-w-[10rem] space-y-1.5">
            <Label className="text-xs">Label (optional)</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Q3 intake" />
          </div>
          <div className="w-44 space-y-1.5">
            <Label className="text-xs">Expires (optional)</Label>
            <Input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
          </div>
          <Button onClick={generate} disabled={busy || count < 1} className="gap-1.5">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ticket className="h-4 w-4" />}
            Generate
          </Button>
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
