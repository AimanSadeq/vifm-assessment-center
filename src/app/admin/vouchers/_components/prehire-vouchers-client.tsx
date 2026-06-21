"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Copy, Ban, Ticket } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
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
        <form onSubmit={onCreate} className="rounded-xl border bg-card p-4">
          <div className="mb-3 flex items-center gap-2">
            <Ticket className="h-4 w-4 text-accent" />
            <h3 className="text-sm font-semibold text-[#010131]">Issue Pre-Hire® vouchers</h3>
          </div>
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
      )}

      {/* Existing vouchers */}
      {vouchers.length === 0 ? (
        <p className="text-sm text-muted-foreground">No Pre-Hire vouchers issued yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Code</th>
                <th className="px-3 py-2 font-medium">Requisition</th>
                <th className="px-3 py-2 font-medium">Seats</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Link</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {vouchers.map((v) => (
                <tr key={v.id} className="border-t">
                  <td className="px-3 py-2">
                    <span className="font-mono text-xs">{v.code}</span>
                    {v.label ? <span className="ms-2 text-xs text-muted-foreground">{v.label}</span> : null}
                    {v.assigned_email ? (
                      <span className="ms-2 text-xs text-muted-foreground">{v.assigned_name || v.assigned_email}</span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2">{v.requisition_title ?? "-"}</td>
                  <td className="px-3 py-2 tabular-nums">
                    {v.used_count}/{v.max_uses}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        v.status === "active"
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-slate-200 text-slate-700"
                      }`}
                    >
                      {v.status}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <button
                      onClick={() => copyLink(v.code)}
                      className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
                    >
                      <Copy className="h-3 w-3" /> Copy
                    </button>
                  </td>
                  <td className="px-3 py-2 text-right">
                    {v.status === "active" && (
                      <button
                        onClick={() => onDisable(v.id)}
                        disabled={pending}
                        className="inline-flex items-center gap-1 text-xs text-rose-600 hover:underline disabled:opacity-50"
                      >
                        <Ban className="h-3 w-3" /> Disable
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
