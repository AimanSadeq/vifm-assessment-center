"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Plus, UserPlus, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PortalServiceMeta, CaliberService } from "@/lib/clients/portal-services";
import { grantAllocationAction, provisionClientManagerAction } from "../actions";

export type AllocationRow = {
  id: string;
  organization_id: string;
  service: CaliberService;
  seats_total: number;
  seats_used: number;
  seats_remaining: number;
  expires_at: string | null;
  status: string;
  notes: string | null;
  orgName: string;
};

type ClientOpt = { id: string; name: string };

const input =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-[#5391D5] focus:outline-none";
const label = "block text-xs font-medium text-muted-foreground mb-1";

export function AllocationsClient({
  clients,
  services,
  allocations,
}: {
  clients: ClientOpt[];
  services: PortalServiceMeta[];
  allocations: AllocationRow[];
}) {
  const [pending, start] = useTransition();
  const serviceLabel = (id: string) => services.find((s) => s.id === id)?.label ?? id;

  const [gOrg, setGOrg] = useState(clients[0]?.id ?? "");
  const [gService, setGService] = useState<CaliberService>(services[0]?.id ?? "fluent");
  const [gSeats, setGSeats] = useState(10);
  const [gExpiry, setGExpiry] = useState("");
  const [gNotes, setGNotes] = useState("");

  const [pOrg, setPOrg] = useState(clients[0]?.id ?? "");
  const [pEmail, setPEmail] = useState("");
  const [pName, setPName] = useState("");
  const [setupLink, setSetupLink] = useState<string | null>(null);

  const grant = () =>
    start(async () => {
      const res = await grantAllocationAction({
        organizationId: gOrg,
        service: gService,
        seatsTotal: gSeats,
        expiresAt: gExpiry || null,
        notes: gNotes,
      });
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success(`Granted ${gSeats} ${serviceLabel(gService)} seat(s)`);
    });

  const provision = () =>
    start(async () => {
      const res = await provisionClientManagerAction({ organizationId: pOrg, email: pEmail, fullName: pName });
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      setSetupLink(res.data.setupLink);
      toast.success("Client manager provisioned");
    });

  if (clients.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
        No clients yet. Add a client from the Clients page first, then grant allocations here.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        {/* Grant allocation */}
        <div className="rounded-xl border bg-card p-5">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
            <Plus className="h-4 w-4 text-accent" /> Grant / top up allocation
          </h2>
          <div className="space-y-3">
            <div>
              <label className={label}>Client</label>
              <select className={input} value={gOrg} onChange={(e) => setGOrg(e.target.value)}>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={label}>Service</label>
                <select className={input} value={gService} onChange={(e) => setGService(e.target.value as CaliberService)}>
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>{s.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={label}>Seats (total)</label>
                <input className={input} type="number" min={0} value={gSeats} onChange={(e) => setGSeats(Number(e.target.value))} />
              </div>
            </div>
            <div>
              <label className={label}>Expiry (optional)</label>
              <input className={input} type="date" value={gExpiry} onChange={(e) => setGExpiry(e.target.value)} />
            </div>
            <div>
              <label className={label}>Notes (optional)</label>
              <input className={input} type="text" value={gNotes} onChange={(e) => setGNotes(e.target.value)} placeholder="e.g. FY26 intake" />
            </div>
            <Button onClick={grant} disabled={pending} className="gap-2">
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Grant
            </Button>
            <p className="text-[11px] text-muted-foreground">Re-granting the same client + service updates the total (seats already used are preserved).</p>
          </div>
        </div>

        {/* Provision client manager */}
        <div className="rounded-xl border bg-card p-5">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
            <UserPlus className="h-4 w-4 text-accent" /> Provision client manager
          </h2>
          <div className="space-y-3">
            <div>
              <label className={label}>Client</label>
              <select className={input} value={pOrg} onChange={(e) => setPOrg(e.target.value)}>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={label}>Manager email</label>
              <input className={input} type="email" value={pEmail} onChange={(e) => setPEmail(e.target.value)} placeholder="manager@client.com" />
            </div>
            <div>
              <label className={label}>Full name</label>
              <input className={input} type="text" value={pName} onChange={(e) => setPName(e.target.value)} placeholder="Full name" />
            </div>
            <Button onClick={provision} disabled={pending} variant="outline" className="gap-2">
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />} Provision login
            </Button>
            {setupLink && (
              <div className="rounded-md border border-emerald-300 bg-emerald-50 p-2 text-xs">
                <div className="mb-1 font-medium text-emerald-900">Set-password link (share securely):</div>
                <div className="flex items-center gap-2">
                  <code className="min-w-0 flex-1 truncate text-[10px] text-emerald-800">{setupLink}</code>
                  <button
                    type="button"
                    onClick={() => { navigator.clipboard.writeText(setupLink); toast.success("Link copied"); }}
                    className="inline-flex items-center gap-1 rounded border border-emerald-300 px-2 py-1 text-emerald-800 hover:bg-emerald-100"
                  >
                    <Copy className="h-3 w-3" /> Copy
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Existing allocations */}
      <div className="rounded-xl border bg-card p-5">
        <h2 className="mb-3 text-sm font-semibold text-foreground">Current allocations</h2>
        {allocations.length === 0 ? (
          <p className="text-sm text-muted-foreground">No allocations granted yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-3">Client</th>
                  <th className="py-2 pr-3">Service</th>
                  <th className="py-2 pr-3 text-right">Total</th>
                  <th className="py-2 pr-3 text-right">Used</th>
                  <th className="py-2 pr-3 text-right">Remaining</th>
                  <th className="py-2 pr-3">Expiry</th>
                  <th className="py-2 pr-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {allocations.map((a) => (
                  <tr key={a.id} className="border-b last:border-0">
                    <td className="py-2 pr-3 font-medium text-foreground">{a.orgName}</td>
                    <td className="py-2 pr-3">{serviceLabel(a.service)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{a.seats_total}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{a.seats_used}</td>
                    <td className="py-2 pr-3 text-right tabular-nums font-semibold">{a.seats_remaining}</td>
                    <td className="py-2 pr-3 text-muted-foreground">{a.expires_at ? new Date(a.expires_at).toLocaleDateString("en-GB") : "-"}</td>
                    <td className="py-2 pr-3">{a.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
