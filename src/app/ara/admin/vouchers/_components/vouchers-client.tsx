"use client";

import { useState, useTransition } from "react";
import { Ticket, Copy, Download, Check, Ban, RotateCcw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { createVoucherBatchAction, setVoucherStatusAction } from "../actions";

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
type OrgOption = { id: string; name: string };

const selectClass =
  "h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function VouchersClient({ vouchers, orgs }: { vouchers: VoucherRow[]; orgs: OrgOption[] }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [generated, setGenerated] = useState<string[]>([]);
  const [copied, setCopied] = useState<string | null>(null);

  function copy(text: string, key: string) {
    void navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  }

  function downloadCsv(codes: string[]) {
    const csv = "code\n" + codes.join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `arc-vouchers-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function onGenerate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
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
          <Ticket className="h-6 w-6 text-[#5391D5]" /> AI Readiness Compass — Vouchers
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Generate practice-access codes for clients. Each code provisions a sandbox (practice) Compass run.
        </p>
      </div>

      {/* Generate */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Generate codes</CardTitle>
          <CardDescription>Snapshot tier · practice/sandbox · seat pool via &ldquo;uses per code&rdquo;.</CardDescription>
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
              <Label htmlFor="organizationId">Client org (tag for tracking)</Label>
              <select id="organizationId" name="organizationId" className={selectClass} defaultValue="">
                <option value="">— none —</option>
                {orgs.map((o) => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
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
              <Label htmlFor="region">Region</Label>
              <select id="region" name="region" className={selectClass} defaultValue="uae">
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
                  <Button size="sm" variant="outline" className="gap-1" onClick={() => copy(generated.join("\n"), "all")}>
                    {copied === "all" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} Copy all
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1" onClick={() => downloadCsv(generated)}>
                    <Download className="h-3.5 w-3.5" /> CSV
                  </Button>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {generated.map((c) => (
                  <code key={c} className="rounded bg-card px-2 py-1 text-xs">{c}</code>
                ))}
              </div>
            </div>
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
                      <td className="py-2 pe-3 text-muted-foreground">{v.label ?? v.client_name ?? "—"}</td>
                      <td className="py-2 pe-3 tabular-nums">{v.used_count}/{v.max_uses}</td>
                      <td className="py-2 pe-3">
                        <Badge variant={v.status === "active" ? "secondary" : "outline"}>{v.status}</Badge>
                      </td>
                      <td className="py-2 pe-3 text-muted-foreground">
                        {v.expires_at ? new Date(v.expires_at).toLocaleDateString() : "—"}
                      </td>
                      <td className="py-2 text-right">
                        <Button size="sm" variant="ghost" className="gap-1" disabled={pending} onClick={() => toggle(v)}>
                          {v.status === "active" ? <><Ban className="h-3.5 w-3.5" /> Disable</> : <><RotateCcw className="h-3.5 w-3.5" /> Enable</>}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
