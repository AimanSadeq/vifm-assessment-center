/**
 * The recent issuances of one voucher service, each with a link to its
 * engagement checklist. Sits under the voucher list on the Persona, Logica,
 * Fluent and Techno voucher pages, which is where those services are run from.
 */

import Link from "next/link";
import { ListChecks } from "lucide-react";
import { createServiceClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { VOUCHER_SPECS, type VoucherService } from "@/lib/checklists/voucher-facts";
import { LocalDate } from "@/components/shared/local-date";

type Row = Record<string, unknown>;

export async function VoucherBatchChecklists({ service, limit = 12 }: { service: VoucherService; limit?: number }) {
  const spec = VOUCHER_SPECS[service];
  const sb = createServiceClient();
  const orgCol = service === "techno" ? "organization_name" : "client_name";
  const { data } = await sb
    .from(spec.table)
    .select(`id, batch_id, label, ${orgCol}, max_uses, used_count, status, expires_at, created_at`)
    .order("created_at", { ascending: false })
    .limit(600);
  const rows = (data ?? []) as Row[];
  const now = Date.now();
  const batches = new Map<string, { id: string; label: string | null; org: string | null; codes: number; seats: number; used: number; created: string; closed: boolean }>();
  for (const v of rows) {
    const key = String(v.batch_id ?? v.id);
    const expired = v.expires_at ? Date.parse(String(v.expires_at)) < now : false;
    const b = batches.get(key) ?? { id: key, label: (v.label as string | null) ?? null, org: (v[orgCol] as string | null) ?? null, codes: 0, seats: 0, used: 0, created: String(v.created_at ?? ""), closed: true };
    b.codes += 1;
    b.seats += Number(v.max_uses ?? 0);
    b.used += Number(v.used_count ?? 0);
    b.closed = b.closed && (v.status === "disabled" || expired);
    batches.set(key, b);
  }
  const list = [...batches.values()].slice(0, limit);
  if (!list.length) return null;

  return (
    <Card className="mt-6">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <ListChecks className="h-4 w-4 text-accent" /> Engagement checklists
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          One per issuance: what has been done and what is missing, from the first conversation to close. Codes issued together share a checklist.
        </p>
      </CardHeader>
      <CardContent>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="py-1 pe-3">Client</th>
              <th className="py-1 pe-3">Label</th>
              <th className="py-1 pe-3">Issued</th>
              <th className="py-1 pe-3 text-right">Codes</th>
              <th className="py-1 pe-3 text-right">Seats used</th>
              <th className="py-1 pe-3">State</th>
              <th className="py-1"></th>
            </tr>
          </thead>
          <tbody>
            {list.map((b) => (
              <tr key={b.id} className="border-t">
                <td className="py-1.5 pe-3">{b.org ?? <span className="text-muted-foreground">No client</span>}</td>
                <td className="py-1.5 pe-3 text-muted-foreground">{b.label ?? "-"}</td>
                <td className="py-1.5 pe-3 text-muted-foreground"><LocalDate value={b.created} /></td>
                <td className="py-1.5 pe-3 text-right">{b.codes}</td>
                <td className="py-1.5 pe-3 text-right">{b.used} / {b.seats}</td>
                <td className="py-1.5 pe-3 text-xs">{b.closed ? "Closed" : b.used >= b.seats ? "Fully redeemed" : b.used > 0 ? "In progress" : "Issued"}</td>
                <td className="py-1.5 text-right">
                  <Link className="text-accent hover:underline" href={`/admin/checklists/${service}/${b.id}`}>Checklist</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
