"use client";

import { useMemo, useState } from "react";
import { Download, Search, Ticket } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LocalDate } from "@/components/shared/local-date";
import {
  REGISTER_SERVICES,
  REGISTER_SERVICE_LABEL,
  REGISTER_STATUS_LABEL,
  type RegisterService,
  type RegisterStatus,
  type VoucherRegister,
  type VoucherRegisterRow,
} from "@/lib/vouchers/register-types";

const ALL = "all";

const STATUS_TONE: Record<RegisterStatus, string> = {
  unused: "border-slate-300 bg-slate-50 text-slate-700",
  partly_redeemed: "border-sky-300 bg-sky-50 text-sky-800",
  fully_redeemed: "border-emerald-300 bg-emerald-50 text-emerald-800",
  expired: "border-amber-300 bg-amber-50 text-amber-800",
  revoked: "border-rose-300 bg-rose-50 text-rose-800",
};

const SERVICE_TONE: Record<RegisterService, string> = {
  arc: "text-violet-700",
  technical: "text-indigo-700",
  fluent: "text-sky-700",
  cognitive: "text-emerald-700",
  persona: "text-fuchsia-700",
  prehire: "text-rose-700",
  role_readiness: "text-amber-700",
  bundle: "text-teal-700",
};

const STATUS_ORDER: RegisterStatus[] = ["unused", "partly_redeemed", "fully_redeemed", "expired", "revoked"];

function csvCell(v: string | number | null): string {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(rows: VoucherRegisterRow[]): string {
  const head = ["Code", "Service", "Company", "Scope", "Label", "Seats", "Redeemed", "Status", "Issued by", "Issuer role", "Issued at", "Expires", "Sample"];
  const lines = rows.map((r) =>
    [
      r.code,
      REGISTER_SERVICE_LABEL[r.service],
      r.company,
      r.scope,
      r.label,
      r.seats,
      r.redeemed,
      REGISTER_STATUS_LABEL[r.status],
      r.issuedBy,
      r.issuedByRole,
      r.issuedAt,
      r.expiresAt,
      r.isSample ? "yes" : "",
    ]
      .map(csvCell)
      .join(","),
  );
  // BOM so Excel opens Arabic company names correctly.
  return "﻿" + [head.join(","), ...lines].join("\n");
}

function Stat({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="rounded-xl border bg-white p-4">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-[#010131]">{value}</p>
      {sub ? <p className="text-xs text-muted-foreground">{sub}</p> : null}
    </div>
  );
}

export function RegisterTable({ register }: { register: VoucherRegister }) {
  const [service, setService] = useState<string>(ALL);
  const [status, setStatus] = useState<string>(ALL);
  const [company, setCompany] = useState<string>(ALL);
  const [issuer, setIssuer] = useState<string>(ALL);
  const [query, setQuery] = useState("");
  const [hideSamples, setHideSamples] = useState(true);

  const companies = useMemo(
    () => Array.from(new Set(register.rows.map((r) => r.company))).sort((a, b) => a.localeCompare(b)),
    [register.rows],
  );
  const issuers = useMemo(
    () => Array.from(new Set(register.rows.map((r) => r.issuedBy))).sort((a, b) => a.localeCompare(b)),
    [register.rows],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return register.rows.filter((r) => {
      if (hideSamples && r.isSample) return false;
      if (service !== ALL && r.service !== service) return false;
      if (status !== ALL && r.status !== status) return false;
      if (company !== ALL && r.company !== company) return false;
      if (issuer !== ALL && r.issuedBy !== issuer) return false;
      if (q) {
        const hay = [r.code, r.company, r.label ?? "", r.scope ?? "", r.issuedBy].join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [register.rows, service, status, company, issuer, query, hideSamples]);

  const totals = useMemo(() => {
    let seats = 0;
    let redeemed = 0;
    const byStatus = new Map<RegisterStatus, number>();
    for (const r of filtered) {
      seats += r.seats;
      redeemed += r.redeemed;
      byStatus.set(r.status, (byStatus.get(r.status) ?? 0) + 1);
    }
    return { codes: filtered.length, seats, redeemed, outstanding: Math.max(0, seats - redeemed), byStatus };
  }, [filtered]);

  const download = () => {
    const blob = new Blob([toCsv(filtered)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `caliber-voucher-register-${register.loadedAt.slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl bg-[#010131] px-5 py-4 text-white">
        <div className="flex items-center gap-2">
          <Ticket className="h-4 w-4 text-[#5391D5]" />
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#5391D5]">VIFM &middot; Vouchers</p>
        </div>
        <h1 className="mt-1 text-2xl font-bold text-white">Voucher register</h1>
        <p className="mt-1 text-sm text-white/70">
          Every code issued by every service: which company it went to, whether it has been redeemed, and who issued it.
        </p>
      </div>

      {register.unavailable.length > 0 ? (
        <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          Not readable in this environment: {register.unavailable.map((s) => REGISTER_SERVICE_LABEL[s]).join(", ")}. Their codes are
          missing from the counts below.
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Codes" value={totals.codes} sub="matching the filters" />
        <Stat label="Seats" value={totals.seats} />
        <Stat label="Redeemed" value={totals.redeemed} />
        <Stat label="Outstanding" value={totals.outstanding} sub="seats not yet used" />
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUS_ORDER.map((s) => {
          const n = totals.byStatus.get(s) ?? 0;
          const active = status === s;
          return (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(active ? ALL : s)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${STATUS_TONE[s]} ${active ? "ring-2 ring-[#5391D5]" : "opacity-80 hover:opacity-100"}`}
            >
              {REGISTER_STATUS_LABEL[s]} <span className="tabular-nums">{n}</span>
            </button>
          );
        })}
      </div>

      <div className="grid gap-2 md:grid-cols-[1fr_180px_200px_200px_auto]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search code, company, label, issuer"
            className="pl-8"
            aria-label="Search the register"
          />
        </div>
        <Select value={service} onValueChange={setService}>
          <SelectTrigger aria-label="Filter by service"><SelectValue placeholder="Service" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All services</SelectItem>
            {REGISTER_SERVICES.map((s) => (
              <SelectItem key={s} value={s}>{REGISTER_SERVICE_LABEL[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={company} onValueChange={setCompany}>
          <SelectTrigger aria-label="Filter by company"><SelectValue placeholder="Company" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All companies</SelectItem>
            {companies.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={issuer} onValueChange={setIssuer}>
          <SelectTrigger aria-label="Filter by issuer"><SelectValue placeholder="Issued by" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Anyone</SelectItem>
            {issuers.map((p) => (
              <SelectItem key={p} value={p}>{p}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="button" variant="outline" onClick={download} disabled={filtered.length === 0}>
          <Download className="mr-2 h-4 w-4" /> CSV
        </Button>
      </div>

      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <input type="checkbox" checked={hideSamples} onChange={(e) => setHideSamples(e.target.checked)} className="h-3.5 w-3.5" />
        Hide sample and demo codes
      </label>

      <div className="overflow-x-auto rounded-xl border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Service</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>For</TableHead>
              <TableHead className="text-right">Seats</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Issued by</TableHead>
              <TableHead>Issued</TableHead>
              <TableHead>Expires</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="py-10 text-center text-sm text-muted-foreground">
                  No vouchers match these filters.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((r) => {
                const pct = r.seats > 0 ? Math.min(100, Math.round((r.redeemed / r.seats) * 100)) : 0;
                return (
                  <TableRow key={`${r.service}:${r.id}`}>
                    <TableCell className="font-mono text-xs">
                      {r.code}
                      {r.isSample ? <Badge variant="outline" className="ml-2 text-[10px]">sample</Badge> : null}
                      {r.label ? <p className="mt-0.5 font-sans text-[11px] text-muted-foreground">{r.label}</p> : null}
                    </TableCell>
                    <TableCell className={`text-sm font-medium ${SERVICE_TONE[r.service]}`}>{REGISTER_SERVICE_LABEL[r.service]}</TableCell>
                    <TableCell className="text-sm">{r.company}</TableCell>
                    <TableCell className="max-w-[240px] truncate text-xs text-muted-foreground" title={r.scope ?? undefined}>
                      {r.scope ?? "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-sm tabular-nums">
                        {r.redeemed} / {r.seats}
                      </span>
                      <div className="mt-1 h-1 w-16 overflow-hidden rounded-full bg-slate-200">
                        <div className="h-full bg-[#5391D5]" style={{ width: `${pct}%` }} />
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={`inline-block rounded-full border px-2 py-0.5 text-[11px] font-medium ${STATUS_TONE[r.status]}`}>
                        {REGISTER_STATUS_LABEL[r.status]}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm">
                      {r.issuedBy}
                      {r.issuedByRole ? <p className="text-[11px] text-muted-foreground">{r.issuedByRole.replace(/_/g, " ")}</p> : null}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground"><LocalDate value={r.issuedAt} /></TableCell>
                    <TableCell className="text-xs text-muted-foreground"><LocalDate value={r.expiresAt} /></TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground">
        Status is derived from seats used and expiry, not read from each service&apos;s own status field. &quot;Not recorded&quot; under
        Issued by means the code predates issuer tracking.
      </p>
    </div>
  );
}
