"use client";
// Framework showcase (client): the 9 domains as a compact grid of designed cards.
// Click a card to open a detail panel with that domain's functions; live ones show
// their pillars -> competencies/skill blocks and a "Preview" action. Built to demo
// the breadth to a client without a long scroll, then drill into the live one.
import { useState } from "react";
import {
  ChevronDown,
  Landmark,
  Users,
  Building2,
  BrainCircuit,
  Banknote,
  KanbanSquare,
  Truck,
  Compass,
  Scale,
  LayoutGrid,
  type LucideIcon,
} from "lucide-react";
import type { OverviewDomain } from "@/lib/technical-sandbox/service";
import { PreviewButton } from "./preview-button";

const ENGINE_LABEL: Record<string, string> = {
  spreadsheet: "Spreadsheet",
  advanced_spreadsheet: "Spreadsheet (data table)",
  logic_input: "Calculation input",
  sql: "SQL",
  python: "Python",
};

function iconFor(name: string): LucideIcon {
  const n = name.toLowerCase();
  if (/financ|account|invest/.test(n)) return Landmark;
  if (/human|\bhr\b|people|talent/.test(n)) return Users;
  if (/real estate|facilit|propert/.test(n)) return Building2;
  if (/data|analyt|artificial|intelligence/.test(n)) return BrainCircuit;
  if (/bank/.test(n)) return Banknote;
  if (/supply|procure|chain/.test(n)) return Truck;
  if (/project/.test(n)) return KanbanSquare;
  if (/strateg|leadership|\bod\b|organi/.test(n)) return Compass;
  if (/legal|complian|\blaw\b/.test(n)) return Scale;
  return LayoutGrid;
}

function liveCountOf(d: OverviewDomain) {
  return d.functions.filter((f) => f.status === "active").length;
}

// Professional standards / frameworks each domain's assessments are aligned to.
// Shown as chips on every domain card. Curated defaults - edit per VIFM's content.
const DOMAIN_FRAMEWORKS: { match: RegExp; frameworks: string[] }[] = [
  { match: /financ|account|invest/, frameworks: ["IFRS", "US GAAP", "SOCPA", "CFA Institute", "IMA (CMA)"] },
  { match: /human|\bhr\b|people|talent/, frameworks: ["SHRM", "CIPD", "ISO 30414"] },
  { match: /real estate|facilit|propert/, frameworks: ["RICS", "IFMA", "ISO 41001"] },
  { match: /data|analyt|artificial|intelligence/, frameworks: ["DAMA DMBOK", "ISO/IEC 42001", "NIST AI RMF"] },
  { match: /bank/, frameworks: ["Basel III", "IFRS 9", "ISO 31000", "COSO ERM"] },
  { match: /supply|procure|chain/, frameworks: ["CIPS", "ASCM SCOR", "ISO 20400"] },
  { match: /project/, frameworks: ["PMI PMBOK", "PRINCE2", "COBIT"] },
  { match: /strateg|leadership|\bod\b|organi/, frameworks: ["Balanced Scorecard", "OKR", "McKinsey 7S"] },
  { match: /legal|complian|\blaw\b|governance/, frameworks: ["COSO", "ISO 37301", "OECD CG"] },
];

function frameworksFor(name: string): string[] {
  const n = name.toLowerCase();
  return DOMAIN_FRAMEWORKS.find((d) => d.match.test(n))?.frameworks ?? [];
}

function FrameworkChip({ label, tone = "muted" }: { label: string; tone?: "muted" | "accent" }) {
  return (
    <span
      className={
        tone === "accent"
          ? "rounded border border-[#5391D5]/30 bg-[#5391D5]/10 px-1.5 py-0.5 text-[10px] font-medium text-[#3f73a8]"
          : "rounded border border-border bg-muted/60 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
      }
    >
      {label}
    </span>
  );
}

export function FrameworkOverview({ domains }: { domains: OverviewDomain[] }) {
  const activeCount = domains.reduce((n, d) => n + liveCountOf(d), 0);
  const totalCount = domains.reduce((n, d) => n + d.functions.length, 0);

  // Default-open the first domain that has a live function (so the demo lands on it).
  const [openKey, setOpenKey] = useState<string | null>(
    () => domains.find((d) => liveCountOf(d) > 0)?.key ?? null,
  );
  const selected = domains.find((d) => d.key === openKey) ?? null;

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        <span className="font-semibold text-foreground">{domains.length}</span> domains ·{" "}
        <span className="font-semibold text-foreground">{totalCount}</span> functions ·{" "}
        <span className="font-semibold text-emerald-700">{activeCount} live</span> now (the rest are
        on the roadmap). Click a domain to view its competencies.
      </p>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {domains.map((d) => {
          const Icon = iconFor(d.nameEn);
          const live = liveCountOf(d);
          const isOpen = d.key === openKey;
          const fw = frameworksFor(d.nameEn);
          return (
            <button
              key={d.key}
              onClick={() => setOpenKey(isOpen ? null : d.key)}
              aria-expanded={isOpen}
              className={`group flex flex-col rounded-xl border p-4 text-start transition ${
                isOpen
                  ? "border-[#5391D5] bg-[#5391D5]/5 ring-2 ring-[#5391D5]/30"
                  : "border-border bg-card hover:-translate-y-0.5 hover:border-[#5391D5]/50 hover:shadow-md"
              }`}
            >
              <div className="flex items-start justify-between">
                <span
                  className={`inline-flex rounded-lg p-2 transition ${
                    isOpen ? "bg-[#010131] text-white" : "bg-[#010131]/5 text-[#010131] group-hover:bg-[#010131]/10"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                </span>
                {live > 0 ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    {live} live
                  </span>
                ) : (
                  <span className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">
                    Roadmap
                  </span>
                )}
              </div>
              <div className="mt-3 text-sm font-semibold leading-snug text-foreground">{d.nameEn}</div>
              {fw.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {fw.slice(0, 3).map((f) => (
                    <FrameworkChip key={f} label={f} />
                  ))}
                  {fw.length > 3 && (
                    <span className="px-0.5 text-[10px] text-muted-foreground">+{fw.length - 3}</span>
                  )}
                </div>
              )}
              <div className="mt-auto flex items-center justify-between pt-2.5">
                <span className="text-xs text-muted-foreground">{d.functions.length} functions</span>
                <ChevronDown
                  className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? "rotate-180 text-[#5391D5]" : ""}`}
                />
              </div>
            </button>
          );
        })}
      </div>

      {selected && <DomainDetail domain={selected} />}
    </div>
  );
}

function DomainDetail({ domain }: { domain: OverviewDomain }) {
  const Icon = iconFor(domain.nameEn);
  const fw = frameworksFor(domain.nameEn);
  return (
    <div className="rounded-xl border border-[#5391D5]/40 bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-start gap-2.5">
        <span className="inline-flex shrink-0 rounded-lg bg-[#010131] p-2 text-white">
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-[#5391D5]">{domain.nameEn}</h3>
          {fw.length > 0 && (
            <div className="mt-1.5 flex flex-wrap items-center gap-1">
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Frameworks:</span>
              {fw.map((f) => (
                <FrameworkChip key={f} label={f} tone="accent" />
              ))}
            </div>
          )}
        </div>
      </div>

      <ul className="space-y-2">
        {domain.functions.map((f) => (
          <li
            key={f.id}
            className={`rounded-lg border p-3 ${
              f.status === "active" ? "border-emerald-300 bg-emerald-50/40" : "border-border"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm text-foreground">
                <span className="font-mono text-xs text-muted-foreground">{f.nodeId}</span> {f.nameEn}
              </span>
              {f.status === "active" ? (
                <span className="flex shrink-0 items-center gap-2">
                  <span className="rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                    Live
                  </span>
                  <PreviewButton functionId={f.id} />
                </span>
              ) : (
                <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">
                  Coming soon
                </span>
              )}
            </div>

            {f.status === "active" && f.pillars.length > 0 && (
              <div className="mt-2.5 space-y-1.5 border-s-2 border-[#5391D5]/30 ps-3">
                {f.pillars.map((p) => (
                  <div key={p.nameEn}>
                    <div className="text-xs font-medium text-foreground">{p.nameEn}</div>
                    <ul className="ms-2 mt-0.5 space-y-0.5">
                      {p.blocks.map((b) => (
                        <li
                          key={b.nameEn}
                          className="flex items-center justify-between gap-2 text-xs text-muted-foreground"
                        >
                          <span>• {b.nameEn}</span>
                          <span className="shrink-0 text-[10px]">
                            {ENGINE_LABEL[b.engineType] ?? b.engineType}
                            {b.frameworkRef ? ` · ${b.frameworkRef}` : ""}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
