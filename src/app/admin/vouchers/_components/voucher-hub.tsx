"use client";

import { useState, type ReactNode } from "react";
import { Ticket, Compass, BadgeCheck, Languages, BrainCircuit, Layers } from "lucide-react";

export type ServiceSummary = { codes: number; redeemed: number; outstanding: number; available: boolean };

export type ServiceKey = "arc" | "technical" | "fluent" | "cognitive" | "persona";

export type HubService = { key: ServiceKey; summary: ServiceSummary; slot: ReactNode };

// Display metadata lives here (client side) so the server only passes
// serializable data + the rendered slot - icon components can't cross the
// server/client boundary as props.
const SERVICE_META: Record<ServiceKey, { label: string; sub: string; icon: typeof Compass; tone: string }> = {
  arc:       { label: "AI Readiness Compass", sub: "VIFM-ARC codes",  icon: Compass,     tone: "text-violet-600" },
  technical: { label: "Techno", sub: "VIFM-TECH codes", icon: BadgeCheck,  tone: "text-indigo-600" },
  fluent:    { label: "Fluent (English)",     sub: "Fluent codes",    icon: Languages,   tone: "text-sky-600" },
  cognitive: { label: "Mentium",               sub: "Mentium codes",    icon: BrainCircuit, tone: "text-emerald-600" },
  persona:   { label: "Persona",              sub: "Persona codes",   icon: Layers,      tone: "text-fuchsia-600" },
};

function SummaryCard({
  serviceKey,
  summary,
  active,
  onClick,
}: {
  serviceKey: ServiceKey;
  summary: ServiceSummary;
  active: boolean;
  onClick: () => void;
}) {
  const meta = SERVICE_META[serviceKey];
  const Icon = meta.icon;
  return (
    <button
      onClick={onClick}
      className={`rounded-xl border p-4 text-left transition-colors ${active ? "border-accent bg-accent/5" : "hover:border-accent/50"}`}
    >
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 ${meta.tone}`} />
        <span className="text-sm font-semibold text-[#010131]">{meta.label}</span>
      </div>
      {summary.available ? (
        <div className="mt-3 flex gap-5">
          <Stat label="Codes" value={summary.codes} />
          <Stat label="Redeemed" value={summary.redeemed} />
          <Stat label="Outstanding" value={summary.outstanding} />
        </div>
      ) : (
        <p className="mt-3 text-xs text-amber-700">Not set up in this environment.</p>
      )}
    </button>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-lg font-bold tabular-nums text-[#010131]">{value}</p>
    </div>
  );
}

export function VoucherHub({
  services,
  initialTab,
}: {
  services: HubService[];
  initialTab?: ServiceKey;
}) {
  const firstKey = services[0]?.key ?? "arc";
  const known = (k: ServiceKey | undefined): k is ServiceKey => !!k && services.some((s) => s.key === k);
  const [tab, setTab] = useState<ServiceKey>(known(initialTab) ? initialTab : firstKey);
  const active = services.find((s) => s.key === tab) ?? services[0];

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
          <Ticket className="h-5 w-5 text-accent" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Vouchers</h1>
          <p className="mt-1 max-w-2xl text-muted-foreground">
            One place to generate, distribute and track redeem codes across every service that uses them.
            Each voucher hands a client a code their delegates redeem to start an assessment - no account needed.
          </p>
        </div>
      </div>

      {/* Per-service summary cards double as the tab selector */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {services.map((s) => (
          <SummaryCard key={s.key} serviceKey={s.key} summary={s.summary} active={tab === s.key} onClick={() => setTab(s.key)} />
        ))}
      </div>

      {/* Tab strip (mirrors the cards, for clarity on which is open) */}
      <div className="flex flex-wrap gap-1 border-b">
        {services.map((s) => (
          <button
            key={s.key}
            onClick={() => setTab(s.key)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              tab === s.key ? "border-accent text-[#010131]" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {SERVICE_META[s.key].label}
          </button>
        ))}
      </div>

      {/* Active service manager (the existing per-service client, reused) */}
      <div>{active?.slot}</div>
    </div>
  );
}
