"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Copy, Ban, Ticket } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
  const [label, setLabel] = useState("");
  const [count, setCount] = useState(1);
  const [seats, setSeats] = useState(1);
  const [expiresAt, setExpiresAt] = useState("");

  function redeemUrl(code: string): string {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return `${origin}/prehire/redeem?code=${code}`;
  }

  async function copyLink(code: string) {
    try {
      await navigator.clipboard.writeText(redeemUrl(code));
      toast.success("Redeem link copied");
    } catch {
      toast.error("Could not copy. Link: " + redeemUrl(code));
    }
  }

  function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!requisitionId) {
      toast.error("Pick a requisition.");
      return;
    }
    const org = requisitions.find((r) => r.id === requisitionId)?.organization_name ?? null;
    startTransition(async () => {
      const res = await createPrehireVoucherBatchAction({
        requisitionId,
        label: label.trim() || undefined,
        count: Math.max(1, count),
        seatsPerCode: Math.max(1, seats),
        expiresAt: expiresAt || null,
        organizationName: org,
      });
      if (res.ok) {
        toast.success(`Created ${res.created} voucher${res.created === 1 ? "" : "s"}`);
        setLabel("");
        setCount(1);
        setSeats(1);
        setExpiresAt("");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
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

  return (
    <div className="space-y-6">
      {requisitions.length === 0 ? (
        <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          No requisitions yet. Create a Pre-Hire requisition first, then issue vouchers against it.
        </p>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Ticket className="h-4 w-4 text-accent" /> Issue Pre-Hire® vouchers
            </CardTitle>
          </CardHeader>
          <CardContent>
          <form onSubmit={onCreate}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="space-y-1 lg:col-span-2">
              <Label htmlFor="ph-req" className="text-xs">Requisition</Label>
              <select
                id="ph-req"
                value={requisitionId}
                onChange={(e) => setRequisitionId(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
              >
                {requisitions.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.title}
                    {r.organization_name ? ` - ${r.organization_name}` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="ph-label" className="text-xs">Label (optional)</Label>
              <Input id="ph-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. analyst intake" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ph-count" className="text-xs">Codes</Label>
              <Input id="ph-count" type="number" min={1} max={500} value={count} onChange={(e) => setCount(Number(e.target.value))} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ph-seats" className="text-xs">Seats / code</Label>
              <Input id="ph-seats" type="number" min={1} max={1000} value={seats} onChange={(e) => setSeats(Number(e.target.value))} />
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label htmlFor="ph-exp" className="text-xs">Expires (optional)</Label>
              <Input id="ph-exp" type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className="w-44" />
            </div>
            <Button type="submit" disabled={pending}>
              {pending ? "Working..." : "Create vouchers"}
            </Button>
            <p className="text-xs text-muted-foreground">
              One code with N seats = a single link your client shares with N applicants. N codes x 1 seat = single-use links.
            </p>
          </div>
          </form>
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
                        onClick={() => copyLink(v.code)}
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
